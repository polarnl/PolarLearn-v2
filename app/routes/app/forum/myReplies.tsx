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

import { redirect, useLoaderData, useNavigate } from "react-router";
import InfiniteScroll from "react-infinite-scroll-component";
import { MessageSquare } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "~/server/react";
import {
  formatForumDate,
  forumCategoryRequiresSubject,
  getCategoryInfo,
  type Post,
} from "~/lib/forum";
import i18n from "~/i18n";
import { createCallerFactory, createTRPCContext } from "~/server/trpc";
import { appRouter } from "~/server/main";
import type { Route } from "./+types/myReplies";
import { getSubjectIcon, getSubjectNameById } from "~/lib/subjects";
import type { SubjectNames } from "~/lib/subjectnames";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export async function loader({
  request,
}: Route.LoaderArgs) {
  const headers = new Headers(request.headers);
  const context = await createTRPCContext({ headers, request });

  if (!context.user) {
    const url = new URL(request.url);
    return redirect(`/auth/sign-in?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
  }

  const caller = createCallerFactory(appRouter)(context);
  const initialReplies = await caller.forum.getMyReplies({
    limit: 10,
    cursor: undefined,
  });

  return {
    initialReplies,
  };
}

export default function MyRepliesPage() {
  const { initialReplies } = useLoaderData<typeof loader>();
  const trpc = useTRPC();
  const navigate = useNavigate();
  const query = useInfiniteQuery(
    trpc.forum.getMyReplies.infiniteQueryOptions(
      { limit: 10 },
      {
        getNextPageParam: (page) => page.nextCursor ?? undefined,
        initialData: { pages: [initialReplies], pageParams: [null] },
      },
    ),
  );
  const replies = query.data.pages.flatMap((page) => page.posts);

  return (
    <div className="flex flex-col gap-3">
      {query.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {i18n.t("forum.posts.failedToLoad")}
        </div>
      ) : null}

      <InfiniteScroll
        dataLength={replies.length}
        next={() => void query.fetchNextPage()}
        hasMore={query.hasNextPage}
        loader={
          <div className="flex items-center justify-center p-4">
            <div className="text-muted-foreground">
              {i18n.t("forum.posts.loadingMore")}
            </div>
          </div>
        }
        endMessage={
          replies.length > 0 ? (
            <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
              {i18n.t("forum.posts.noMore")}
            </div>
          ) : null
        }
      >
        <div className="space-y-3">
          {replies.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900/80">
              <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {i18n.t("forum.myReplies.empty")}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {i18n.t("forum.myReplies.emptyDescription")}
              </p>
            </div>
          ) : (
            replies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                onClick={() => {
                  void navigate(
                    `/app/forum/posts/${reply.replyToId ?? reply.id}`,
                  );
                }}
              />
            ))
          )}
        </div>
      </InfiniteScroll>
    </div>
  );
}

function ReplyCard({ reply, onClick }: { reply: Post; onClick: () => void }) {
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    onClick();
  };
  const author = reply.author as { name: string; image: string | null } | null;
  const authorName = author?.name ?? null;
  const currentCategory = getCategoryInfo(reply.category);
  const t = i18n.t;

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-lg border p-4 text-left transition cursor-pointer",
        reply.pinned
          ? "border-sky-300/60 bg-sky-500/10 hover:bg-sky-500/15 dark:border-sky-400/30 dark:bg-sky-400/10 dark:hover:bg-sky-400/15"
          : "border-border bg-card hover:bg-muted",
      )}
      onClick={handleClick}
    >
      <div className="flex gap-4">
        <div className="shrink-0">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
            {authorName ? authorName.charAt(0).toUpperCase() : "?"}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="h-auto rounded px-2 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: currentCategory.color }}
            >
              <currentCategory.icon className="mr-1 h-3 w-3" />
              {t(currentCategory.label)}
            </Badge>
            {forumCategoryRequiresSubject(reply.category) && reply.subject && (
              <>
                <div className="flex items-center gap-1">
                  {getSubjectIcon(reply.subject as SubjectNames, {
                    width: 16,
                    height: 16,
                  })}
                  <span className="text-xs text-muted-foreground">
                    {getSubjectNameById(reply.subject as SubjectNames)}
                  </span>
                </div>
                <span
                  className="text-xs text-muted-foreground"
                  aria-hidden="true"
                >
                  {"\u00b7"}
                </span>
              </>
            )}
            <span className="text-xs text-muted-foreground">
              {formatForumDate(reply.createdAt)}
            </span>
          </div>
          <div className="text-lg font-semibold text-foreground">
            {reply.replyToTitle ?? t("forum.myReplies.unknownOriginalPost")}
          </div>

          {reply.content && (
            <p className="mb-1 mt-1 text-sm text-foreground">{reply.content}</p>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {t("lists.authorPrefix", {
                author:
                  reply.author?.displayUsername ??
                  reply.author?.name ??
                  t("forum.unknownAuthor"),
              })}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
