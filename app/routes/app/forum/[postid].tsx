// PolarLearn: A free and open-source learning platform.
// Copyright(C) 2024-2026 PolarNL Group
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import {
  useLoaderData,
  useNavigate,
  useRevalidator,
  useRouteLoaderData,
} from "react-router";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { createCallerFactory, createTRPCContext } from "~/server/trpc";
import { appRouter } from "~/server/main";
import {
  forumCategoryRequiresSubject,
  getCategoryInfo,
  type ForumCategory,
  type Post,
  type Vote,
  type PostAuthor,
} from "~/lib/forum";
import { Subject } from "~/lib/subjects";
import type { SubjectNames } from "~/lib/subjectnames";
import { SubjectNamesArray } from "~/lib/subjectnames";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import i18n from "~/i18n";
import { useTRPC } from "~/server/react";
import type { Route } from "./+types/[postid]";
import { Button } from "@polarnl/polarui-react";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  MessageSquareReply,
  PencilLine,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { t } from "~/i18n";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { PostDialog } from "./PostDialog";
import { ReplyDialog } from "./ReplyDialog";
import MarkdownRenderer from "~/lib/markdown";
import { ShieldUser } from "lucide-react";

const REPLIES_PER_PAGE = 10;

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const postTitle = loaderData?.post?.title?.trim() || i18n.t("forum.postFallbackTitle");
  const postExcerpt =
    loaderData?.post?.content
      ?.replace(/\s+/g, " ")
      .trim()
      .slice(0, 160) ||
    i18n.t("forum.post.metaDescriptionFallback");

  return [
    { title: i18n.t("forum.post.metaTitle", { title: postTitle }) },
    {
      name: "description",
      content: postExcerpt,
    },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const postId = params.postid;
  if (!postId) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response(i18n.t("errors.404.message"), { status: 404 });
  }

  const headers = new Headers(request.headers);
  const context = await createTRPCContext({ headers, request });
  const caller = createCallerFactory(appRouter)(context);

  const [post, initialReplies] = await Promise.all([
    caller.forum.getPost({ postId }),
    caller.forum.getPostReplies({
      postId,
      limit: REPLIES_PER_PAGE,
    }),
  ]);

  return { post, initialReplies };
}

export default function PostPage() {
  const { post, initialReplies } = useLoaderData<typeof loader>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [currentPost, setCurrentPost] = useState(post);
  const author = currentPost.author as PostAuthor | null;
  const authorId = author?.id;
  let authorLabel = t("forum.unknownAuthor");
  if (author?.displayUsername) {
    authorLabel = author.displayUsername;
  } else if (author?.name) {
    authorLabel = author.name;
  }
  const currentCategory = getCategoryInfo(currentPost.category);
  const subjects = new Subject();
  const [replies, setReplies] = useState(initialReplies.replies);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialReplies.nextCursor,
  );
  const [isLoadingMoreReplies, setIsLoadingMoreReplies] = useState(false);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(currentPost.title ?? "");
  const [editContent, setEditContent] = useState(currentPost.content);
  const [editCategory, setEditCategory] = useState<ForumCategory>(
    currentPost.category,
  );
  const [editSubject, setEditSubject] = useState<SubjectNames>(
    currentPost.subject
      ? (currentPost.subject as SubjectNames)
      : SubjectNamesArray[0],
  );
  const [isEditSubjectSelectorOpen, setIsEditSubjectSelectorOpen] =
    useState(false);
  const [isEditCategoryPopoverOpen, setIsEditCategoryPopoverOpen] =
    useState(false);
  const [votersDialogOpen, setVotersDialogOpen] = useState(false);
  const rootData = useRouteLoaderData("root");
  const theme = rootData?.theme ?? "light";
  const currentUserId = rootData?.user.id ?? null;
  const currentUserRole = rootData?.user.role ?? null;
  const isForumBanned = rootData?.user.forumBanned === true;
  const isAdmin = currentUserRole === "admin";
  const isOwner = Boolean(currentUserId && author?.id === currentUserId);
  const canManagePost = isOwner || isAdmin;
  const canVote = Boolean(currentUserId);
  const hasUpvoted = currentUserId
    ? currentPost.voters[currentUserId] === "up"
    : false;
  const hasDownvoted = currentUserId
    ? currentPost.voters[currentUserId] === "down"
    : false;
  const revalidator = useRevalidator();

  const voteMutation = useMutation({
    ...trpc.forum.votePost.mutationOptions(),
    onSuccess: (updatedPost) => {
      setCurrentPost((current) => ({
        ...current,
        votes: updatedPost.votes,
        cachedTotalVotes: updatedPost.cachedTotalVotes,
        voters: updatedPost.voters,
        voterProfiles: updatedPost.voterProfiles,
      }));
    },
    onError: () => {
      toast.error(t("errors.unknown"));
    },
  });
  const pendingVote = voteMutation.isPending
    ? voteMutation.variables.vote
    : null;

  const editMutation = useMutation({
    ...trpc.forum.editPost.mutationOptions(),
    onSuccess: (updatedPost) => {
      setCurrentPost((current) => ({
        ...current,
        ...updatedPost,
      }));
      setEditDialogOpen(false);
      toast.success(t("forum.post.updated"));
    },
    onError: () => {
      toast.error(t("errors.unknown"));
    },
  });

  const deleteMutation = useMutation({
    ...trpc.forum.deletePost.mutationOptions(),
    onSuccess: async () => {
      revalidator.revalidate();
      setDeleteDialogOpen(false);
      toast.success(t("forum.post.deleted"));

      void navigate("/app/forum/posts");
    },
    onError: () => {
      toast.error(t("errors.unknown"));
    },
  });

  const pinMutation = useMutation({
    ...trpc.forum.pinPost.mutationOptions(),
    onSuccess: () => {
      setCurrentPost((current) => ({
        ...current,
        pinned: !current.pinned,
      }));
      toast.success(
        t("forum.post.pinnedUpdated", {
          action: currentPost.pinned
            ? t("forum.post.unpin")
            : t("forum.post.pin"),
        }),
      );
    },
    onError: () => {
      toast.error(t("errors.unknown"));
    },
  });

  const handleVote = (vote: Vote) => {
    voteMutation.mutate({
      postId: currentPost.id,
      vote,
    });
  };

  const fetchMoreReplies = async () => {
    if (!nextCursor || isLoadingMoreReplies) {
      return;
    }

    setIsLoadingMoreReplies(true);
    try {
      const nextPage = await queryClient.fetchQuery(
        trpc.forum.getPostReplies.queryOptions({
          postId: currentPost.id,
          cursor: nextCursor,
          limit: REPLIES_PER_PAGE,
        }),
      );

      setReplies((currentReplies) =>
        mergePostsById(currentReplies, nextPage.replies),
      );
      setNextCursor(nextPage.nextCursor);
    } finally {
      setIsLoadingMoreReplies(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border p-6">
        <div className="mb-4 flex items-center gap-3">
          <Avatar>
            <AvatarImage src={author?.image ?? undefined} />
            <AvatarFallback>
              {author?.name ? author.name.charAt(0).toUpperCase() : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start">
            {authorId ? (
              <div className="flex flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void navigate(`/app/viewuser/${authorId}/lists`);
                  }}
                  className="cursor-pointer font-medium text-neutral-800 hover:underline dark:text-neutral-200"
                >
                  {authorLabel}
                </button>
                {author.role === "admin" && (
                  <Badge
                    variant="outline"
                    className="h-auto rounded px-2 py-1 text-xs font-semibold bg-red-500 text-white"
                  >
                    <ShieldUser />
                    {t("userMenu.admin")}
                  </Badge>
                )}
              </div>
            ) : (
              <span className="font-medium">{authorLabel}</span>
            )}
            <span className="text-sm text-muted-foreground">
              {formatDate(currentPost.createdAt)}
            </span>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {currentPost.title && (
                <h1 className="text-2xl font-bold leading-tight wrap-break-word">
                  {currentPost.title}
                </h1>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {currentPost.pinned && (
                  <Badge
                    variant="outline"
                    className="h-auto rounded border-sky-300/60 bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-100"
                  >
                    <Pin className="mr-1 h-3 w-3" />
                    {t("forum.posts.pinned")}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="h-auto rounded px-2 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: currentCategory.color }}
                >
                  <currentCategory.icon className="mr-1 h-3 w-3" />
                  {t(currentCategory.label)}
                </Badge>

                {forumCategoryRequiresSubject(currentPost.category) &&
                  currentPost.subject && (
                    <div className="flex items-center gap-1">
                      {subjects.getIcon(currentPost.subject as SubjectNames, {
                        width: 16,
                        height: 16,
                      })}
                      <span className="text-xs text-muted-foreground">
                        {subjects.getSubjectNameById(
                          currentPost.subject as SubjectNames,
                        )}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>

        <MarkdownRenderer content={currentPost.content} />
      </div>
      <div className="flex flex-wrap items-center gap-2 ml-4">
        {canVote && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="transparent"
              scheme={theme}
              icon={
                pendingVote === "up" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ArrowUp
                    className={hasUpvoted ? "text-orange-500" : "text-white"}
                  />
                )
              }
              onClick={() => {
                handleVote("up");
              }}
              disabled={voteMutation.isPending}
              title={t("forum.vote.up")}
              className="border-none shadow-none hover:bg-neutral-200/70 dark:hover:bg-white/10"
              onContextMenu={(event) => {
                event.preventDefault();
                setVotersDialogOpen(true);
              }}
            >
              {""}
            </Button>
            <span className="min-w-4 text-center text-sm font-semibold tabular-nums text-foreground">
              {typeof currentPost.votes === "number"
                ? currentPost.votes
                : currentPost.cachedTotalVotes}
            </span>
            <Button
              variant="transparent"
              scheme={theme}
              icon={
                pendingVote === "down" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ArrowDown
                    className={hasDownvoted ? "text-violet-500" : "text-white"}
                  />
                )
              }
              onClick={() => {
                handleVote("down");
              }}
              disabled={voteMutation.isPending}
              title={t("forum.vote.down")}
              className="border-none shadow-none hover:bg-neutral-200/70 dark:hover:bg-white/10"
              onContextMenu={(event) => {
                event.preventDefault();
                setVotersDialogOpen(true);
              }}
            >
              {""}
            </Button>
          </div>
        )}
        <Button
          scheme={theme}
          color="sky"
          textColor="white"
          icon={<MessageSquareReply />}
          onClick={() => {
            if (!rootData?.user?.id) {
              return;
            }
            setReplyDialogOpen(true);
          }}
          disabled={!rootData?.user?.id || isForumBanned}
        >
          {rootData?.user?.id
            ? isForumBanned
              ? i18n.t("forum.banned.submitBlocked")
              : i18n.t("forum.reply.buttonLabel")
            : i18n.t("forum.reply.loginToReply")}
        </Button>

        <div className="flex flex-wrap items-center gap-1">
          {canManagePost && (
            <Button
              variant="transparent"
              scheme={theme}
              icon={
                editMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <PencilLine />
                )
              }
              onClick={() => {
                setEditTitle(currentPost.title ?? "");
                setEditContent(currentPost.content);
                setEditCategory(currentPost.category);
                setEditSubject(
                  currentPost.subject
                    ? (currentPost.subject as SubjectNames)
                    : SubjectNamesArray[0],
                );
                setEditDialogOpen(true);
              }}
              disabled={editMutation.isPending}
              title={t("common.edit")}
              className="border-none shadow-none hover:bg-neutral-200/70 dark:hover:bg-white/10"
            >
              {t("common.edit")}
            </Button>
          )}

          {canManagePost && (
            <Button
              variant="transparent"
              scheme={theme}
              icon={
                deleteMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Trash2 />
                )
              }
              onClick={() => {
                setDeleteDialogOpen(true);
              }}
              disabled={deleteMutation.isPending}
              className="border-none shadow-none text-red-600 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15"
              title={t("common.delete")}
            >
              {t("common.delete")}
            </Button>
          )}

          {isAdmin && (
            <Button
              variant="transparent"
              scheme={theme}
              icon={
                pinMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : currentPost.pinned ? (
                  <PinOff />
                ) : (
                  <Pin />
                )
              }
              onClick={() => {
                pinMutation.mutate({
                  id: currentPost.id,
                });
              }}
              disabled={pinMutation.isPending}
              title={
                currentPost.pinned ? t("forum.post.unpin") : t("forum.post.pin")
              }
              className="border-none shadow-none hover:bg-neutral-200/70 dark:hover:bg-white/10"
            >
              {currentPost.pinned ? t("forum.post.unpin") : t("forum.post.pin")}
            </Button>
          )}
        </div>
      </div>

      <ReplyDialog
        open={replyDialogOpen}
        onOpenChange={setReplyDialogOpen}
        postId={currentPost.id}
        onReplySuccess={(newReply) => {
          setReplies((currentReplies) =>
            mergePostsById([newReply], currentReplies),
          );
        }}
      />

      <PostDialog
        isEdit={true}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        theme={theme}
        title={editTitle}
        content={editContent}
        setTitle={setEditTitle}
        setContent={setEditContent}
        category={editCategory}
        setCategory={setEditCategory}
        subject={editSubject}
        setSubject={setEditSubject}
        isSubjectSelectorOpen={isEditSubjectSelectorOpen}
        setIsSubjectSelectorOpen={setIsEditSubjectSelectorOpen}
        isCategoryPopoverOpen={isEditCategoryPopoverOpen}
        setIsCategoryPopoverOpen={setIsEditCategoryPopoverOpen}
        isPending={editMutation.isPending}
        onSubmit={() => {
          const trimmedTitle = editTitle.trim();
          const trimmedContent = editContent.trim();

          if (!trimmedTitle) {
            toast.error(t("forum.post.titleRequired"));
            return;
          }

          if (!trimmedContent) {
            toast.error(t("forum.post.contentRequired"));
            return;
          }

          editMutation.mutate({
            id: currentPost.id,
            title: trimmedTitle,
            content: trimmedContent,
            category: editCategory,
            subject: forumCategoryRequiresSubject(editCategory)
              ? editSubject
              : undefined,
          });
        }}
        subjects={subjects}
        isAdmin={isAdmin}
      />

      <DeletePostDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        theme={theme}
        title={t("forum.post.deleteTitle")}
        description={t("forum.post.deleteConfirm")}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          deleteMutation.mutate({
            id: currentPost.id,
          });
        }}
      />

      <VotersDialog
        open={votersDialogOpen}
        onOpenChange={setVotersDialogOpen}
        post={currentPost}
      />

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">
          {i18n.t("forum.replies.title")}
        </h2>

        <InfiniteScroll
          dataLength={replies.length}
          next={fetchMoreReplies}
          hasMore={Boolean(nextCursor)}
          scrollThreshold={0.8}
          loader={
            <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
              {isLoadingMoreReplies
                ? i18n.t("forum.replies.loadingMore")
                : null}
            </div>
          }
          endMessage={
            replies.length > 0 ? (
              <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                {i18n.t("forum.replies.noMore")}
              </div>
            ) : null
          }
        >
          <div className="space-y-3">
            {replies.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {i18n.t("forum.replies.empty")}
              </div>
            ) : (
              replies.map((reply) => (
                <ReplyCard
                  key={reply.id}
                  reply={reply}
                  theme={theme}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onReplyUpdated={(updatedReply) => {
                    setReplies((currentReplies) =>
                      currentReplies.map((currentReply) =>
                        currentReply.id === updatedReply.id
                          ? { ...currentReply, ...updatedReply }
                          : currentReply,
                      ),
                    );
                  }}
                  onReplyDeleted={(replyId) => {
                    setReplies((currentReplies) =>
                      currentReplies.filter(
                        (currentReply) => currentReply.id !== replyId,
                      ),
                    );
                  }}
                  onReplyPinned={(replyId) => {
                    setReplies((currentReplies) => {
                      const nextReplies = currentReplies.map((currentReply) =>
                        currentReply.id === replyId
                          ? { ...currentReply, pinned: !currentReply.pinned }
                          : currentReply,
                      );

                      return nextReplies.sort((left, right) => {
                        if (left.pinned !== right.pinned) {
                          return left.pinned ? -1 : 1;
                        }

                        return (
                          new Date(right.createdAt).getTime() -
                          new Date(left.createdAt).getTime()
                        );
                      });
                    });
                  }}
                  onReplyVoted={(replyId, updatedVoteTotals) => {
                    setReplies((currentReplies) =>
                      currentReplies.map((currentReply) =>
                        currentReply.id === replyId
                          ? {
                            ...currentReply,
                            votes: updatedVoteTotals.votes,
                            cachedTotalVotes:
                              updatedVoteTotals.cachedTotalVotes,
                            voters: updatedVoteTotals.voters,
                            voterProfiles: updatedVoteTotals.voterProfiles,
                          }
                          : currentReply,
                      ),
                    );
                  }}
                />
              ))
            )}
          </div>
        </InfiniteScroll>
      </div>
    </div>
  );
}

function DeletePostDialog({
  open,
  onOpenChange,
  theme,
  title,
  description,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: "light" | "dark";
  title: string;
  description: string;
  isPending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{description}</p>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="transparent" scheme={theme} disabled={isPending}>
              {t("common.cancel")}
            </Button>
          </DialogClose>
          <Button
            scheme={theme}
            onClick={onConfirm}
            disabled={isPending}
            color="red"
            textColor={theme === "dark" ? "white" : "black"}
            icon={isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          >
            {isPending ? t("common.deleting") : t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function mergePostsById(currentPosts: Post[], nextPosts: Post[]) {
  const seen = new Set(currentPosts.map((post) => post.id));
  const mergedPosts = [...currentPosts];

  for (const post of nextPosts) {
    if (!seen.has(post.id)) {
      seen.add(post.id);
      mergedPosts.push(post);
    }
  }

  return mergedPosts;
}

function ReplyCard({
  reply,
  theme,
  currentUserId,
  isAdmin,
  onReplyUpdated,
  onReplyDeleted,
  onReplyPinned,
  onReplyVoted,
}: {
  reply: Post;
  theme: "light" | "dark";
  currentUserId: string | null;
  isAdmin: boolean;
  onReplyUpdated: (reply: Partial<Post> & { id: string }) => void;
  onReplyDeleted: (replyId: string) => void;
  onReplyPinned: (replyId: string) => void;
  onReplyVoted: (
    replyId: string,
    updatedVoteTotals: Pick<
      Post,
      "votes" | "cachedTotalVotes" | "voters" | "voterProfiles"
    >,
  ) => void;
}) {
  const author = reply.author;
  const authorId = author?.id;
  let authorLabel = t("forum.unknownAuthor");
  if (author) {
    if (author.displayUsername) {
      authorLabel = author.displayUsername;
    } else if (author.name) {
      authorLabel = author.name;
    }
  }
  const navigate = useNavigate();
  const trpc = useTRPC();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [votersDialogOpen, setVotersDialogOpen] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);
  const isOwner = Boolean(currentUserId && authorId === currentUserId);
  const canManageReply = isOwner || isAdmin;
  const canVote = Boolean(currentUserId);
  const hasUpvoted = currentUserId
    ? reply.voters[currentUserId] === "up"
    : false;
  const hasDownvoted = currentUserId
    ? reply.voters[currentUserId] === "down"
    : false;

  const voteMutation = useMutation({
    ...trpc.forum.votePost.mutationOptions(),
    onSuccess: (updatedVoteTotals) => {
      onReplyVoted(reply.id, updatedVoteTotals);
    },
    onError: () => {
      toast.error(t("errors.unknown"));
    },
  });
  const pendingVote = voteMutation.isPending
    ? voteMutation.variables.vote
    : null;

  const editMutation = useMutation({
    ...trpc.forum.editPost.mutationOptions(),
    onSuccess: (updatedReply) => {
      onReplyUpdated(updatedReply);
      setEditDialogOpen(false);
      toast.success(t("forum.reply.updated"));
    },
    onError: () => {
      toast.error(t("errors.unknown"));
    },
  });

  const deleteMutation = useMutation({
    ...trpc.forum.deletePost.mutationOptions(),
    onSuccess: () => {
      onReplyDeleted(reply.id);
      setDeleteDialogOpen(false);
      toast.success(t("forum.reply.deleted"));
    },
    onError: () => {
      toast.error(t("errors.unknown"));
    },
  });

  const pinMutation = useMutation({
    ...trpc.forum.pinPost.mutationOptions(),
    onSuccess: () => {
      onReplyPinned(reply.id);
      toast.success(t("forum.reply.pinnedUpdated"));
    },
    onError: () => {
      toast.error(t("errors.unknown"));
    },
  });

  return (
    <article
      className={`rounded-lg border bg-neutral-800 p-4 ${reply.pinned ? "border-sky-300/60 bg-sky-500/10 dark:border-sky-400/30 dark:bg-sky-400/10" : "border-border"}`}
    >
      <div className="mb-3 flex items-center gap-3">
        <Avatar>
          <AvatarImage src={author?.image ?? undefined} />
          <AvatarFallback>
            {author?.name ? author.name.charAt(0).toUpperCase() : "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-start justify-start">
          {authorId ? (
            <div className="flex flex-row items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void navigate(`/app/viewuser/${authorId}/lists`);
                }}
                className="font-medium text-neutral-800 underline-offset-2 hover:underline dark:text-neutral-200"
              >
                {authorLabel}
              </button>
              {author.role === "admin" && (
                <Badge
                  variant="outline"
                  className="h-auto rounded px-2 py-1 text-xs font-semibold bg-red-500 text-white"
                >
                  <ShieldUser />
                  {t("userMenu.admin")}
                </Badge>  
              )}
            </div>
          ) : (
            <span className="font-medium">{authorLabel}</span>
          )}
          <span className="text-sm text-muted-foreground">
            {formatDate(reply.createdAt)}
          </span>
        </div>
        {reply.pinned && (
          <Badge
            variant="outline"
            className="ml-auto h-auto rounded border-sky-300/60 bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-100"
          >
            <Pin className="mr-1 h-3 w-3" />
            {t("forum.posts.pinned")}
          </Badge>
        )}
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none mb-3">
        <MarkdownRenderer content={reply.content} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canVote && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="transparent"
              scheme={theme}
              icon={
                pendingVote === "up" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ArrowUp
                    className={hasUpvoted ? "text-orange-500" : "text-white"}
                  />
                )
              }
              onClick={() => {
                voteMutation.mutate({ postId: reply.id, vote: "up" });
              }}
              disabled={voteMutation.isPending}
              title={t("forum.vote.up")}
              className="border-none shadow-none hover:bg-neutral-200/70 dark:hover:bg-white/10"
              onContextMenu={(event) => {
                event.preventDefault();
                setVotersDialogOpen(true);
              }}
            >
              {""}
            </Button>
            <span className="min-w-4 text-center text-sm font-semibold tabular-nums text-foreground">
              {typeof reply.votes === "number"
                ? reply.votes
                : reply.cachedTotalVotes}
            </span>
            <Button
              variant="transparent"
              scheme={theme}
              icon={
                pendingVote === "down" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ArrowDown
                    className={hasDownvoted ? "text-violet-500" : "text-white"}
                  />
                )
              }
              onClick={() => {
                voteMutation.mutate({ postId: reply.id, vote: "down" });
              }}
              disabled={voteMutation.isPending}
              title={t("forum.vote.down")}
              className="border-none shadow-none hover:bg-neutral-200/70 dark:hover:bg-white/10"
              onContextMenu={(event) => {
                event.preventDefault();
                setVotersDialogOpen(true);
              }}
            >
              {""}
            </Button>
          </div>
        )}

        {canManageReply && (
          <Button
            variant="transparent"
            scheme={theme}
            icon={
              editMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <PencilLine />
              )
            }
            onClick={() => {
              setEditContent(reply.content);
              setEditDialogOpen(true);
            }}
            disabled={editMutation.isPending}
            title={t("common.edit")}
            className="border-none shadow-none hover:bg-neutral-200/70 dark:hover:bg-white/10"
          >
            {t("common.edit")}
          </Button>
        )}

        {canManageReply && (
          <Button
            variant="transparent"
            scheme={theme}
            icon={
              deleteMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Trash2 />
              )
            }
            onClick={() => {
              setDeleteDialogOpen(true);
            }}
            disabled={deleteMutation.isPending}
            title={t("common.delete")}
            className="border-none shadow-none text-red-600 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15"
          >
            {t("common.delete")}
          </Button>
        )}

        {isAdmin && (
          <Button
            variant="transparent"
            scheme={theme}
            icon={
              pinMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : reply.pinned ? (
                <PinOff />
              ) : (
                <Pin />
              )
            }
            onClick={() => {
              pinMutation.mutate({ id: reply.id });
            }}
            disabled={pinMutation.isPending}
            title={reply.pinned ? t("forum.reply.unpin") : t("forum.reply.pin")}
            className="border-none shadow-none hover:bg-neutral-200/70 dark:hover:bg-white/10"
          >
            {reply.pinned ? t("forum.reply.unpin") : t("forum.reply.pin")}
          </Button>
        )}
      </div>

      <EditReplyDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        theme={theme}
        content={editContent}
        isPending={editMutation.isPending}
        onContentChange={setEditContent}
        onSave={() => {
          const trimmedContent = editContent.trim();

          if (!trimmedContent) {
            toast.error(t("forum.reply.contentRequired"));
            return;
          }

          editMutation.mutate({
            id: reply.id,
            content: trimmedContent,
          });
        }}
      />

      <DeletePostDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        theme={theme}
        title={t("forum.reply.deleteTitle")}
        description={t("forum.reply.deleteConfirm")}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          deleteMutation.mutate({ id: reply.id });
        }}
      />

      <VotersDialog
        open={votersDialogOpen}
        onOpenChange={setVotersDialogOpen}
        post={reply}
      />
    </article>
  );
}

function VotersDialog({
  open,
  onOpenChange,
  post,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Pick<Post, "voters" | "voterProfiles">;
}) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{t("forum.vote.voters.title")}</DialogTitle>
        </DialogHeader>
        {(["up", "down"] as const).map((vote) => {
          const voters = post.voterProfiles.filter(
            (profile) => post.voters[profile.id] === vote,
          );

          return (
            <section key={vote} className="space-y-2">
              <h3 className="font-semibold">{t(`forum.vote.voters.${vote}`)}</h3>
              {voters.length ? (
                <div className="space-y-2">
                  {voters.map((voter) => (
                    <button
                      key={voter.id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-neutral-200 px-4 py-3 text-left text-sm hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 hover:cursor-pointer transition-all"
                      onClick={() => {
                        void navigate(`/app/viewuser/${voter.id}/lists`);
                      }}
                    >
                      <Avatar>
                        <AvatarImage src={voter.image ?? undefined} />
                        <AvatarFallback>
                          {voter.displayUsername?.charAt(0).toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span>{voter.displayUsername ?? t("forum.unknownAuthor")}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("forum.vote.voters.empty")}
                </p>
              )}
            </section>
          );
        })}
      </DialogContent>
    </Dialog>
  );
}

function EditReplyDialog({
  open,
  onOpenChange,
  theme,
  content,
  isPending,
  onContentChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: "light" | "dark";
  content: string;
  isPending: boolean;
  onContentChange: (content: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {t("forum.reply.editTitle")}
          </DialogTitle>
        </DialogHeader>

        <textarea
          value={content}
          onChange={(event) => {
            onContentChange(event.target.value);
          }}
          className="min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={t("forum.reply.placeholder")}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="transparent" scheme={theme} disabled={isPending}>
              {t("common.cancel")}
            </Button>
          </DialogClose>
          <Button
            color="sky"
            textColor="white"
            onClick={onSave}
            disabled={isPending}
            icon={
              isPending ? <Loader2 className="animate-spin" /> : <PencilLine />
            }
          >
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(date: Date | string): string {
  const parsedDate = date instanceof Date ? date : new Date(date);
  return parsedDate.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
