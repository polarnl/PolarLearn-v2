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

import { useLoaderData, useNavigate, useOutletContext } from "react-router";
import InfiniteScroll from "react-infinite-scroll-component";
import { MessageSquare, Pin } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "~/server/react";
import { forumCategoryRequiresSubject, getCategoryInfo, type GetPostsOutput, type Post } from "~/lib/forum";
import i18n, { t } from "~/i18n";
import { createCallerFactory, createTRPCContext } from "~/server/trpc";
import { appRouter } from "~/server/main";
import type { Route } from "./+types/posts";
import { Subject } from "~/lib/subjects";
import type { SubjectNames } from "~/lib/subjectnames";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { ForumOutletContext } from "./layout";

export function meta(): Route.MetaDescriptors {
  return [
    { title: t("forum.posts.metaTitle") },
    {
      name: "description",
      content: t("forum.posts.metaDescription"),
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs): Promise<{ initialPosts: GetPostsOutput }> {
  const headers = new Headers(request.headers);
  const context = await createTRPCContext({ headers, request });
  const caller = createCallerFactory(appRouter)(context);

  const initialPosts = await caller.forum.getPosts({
    limit: 10,
    cursor: undefined,
  });

  return { initialPosts };
}

export default function PostsPage() {
  const { initialPosts } = useLoaderData<typeof loader>();
  const { categoryFilter, subjectFilter, dateFilter } =
    useOutletContext<ForumOutletContext>();
  const trpc = useTRPC();
  const navigate = useNavigate();
  const query = useInfiniteQuery(
    trpc.forum.getPosts.infiniteQueryOptions(
      {
        limit: 10,
        category: categoryFilter ?? undefined,
        subject: subjectFilter ?? undefined,
        fromDate: dateFilter?.from,
        toDate: dateFilter?.to,
      },
      {
        getNextPageParam: (page) => page.nextCursor ?? undefined,
        initialData:
          categoryFilter || subjectFilter || dateFilter?.from || dateFilter?.to
            ? undefined
            : { pages: [initialPosts], pageParams: [null] },
      },
    ),
  );
  const posts = query.data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <div className="flex flex-col gap-3">
      {query.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {i18n.t("forum.posts.failedToLoad")}
        </div>
      ) : null}

      <InfiniteScroll
        dataLength={posts.length}
        next={() => {
          void query.fetchNextPage();
        }}
        hasMore={query.hasNextPage}
        loader={
          <div className="flex items-center justify-center p-4">
            <div className="text-muted-foreground">{i18n.t("forum.posts.loadingMore")}</div>
          </div>
        }
        endMessage={
          posts.length > 0 ? (
            <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
              {i18n.t("forum.posts.noMore")}
            </div>
          ) : null
        }
      >
        <div className="space-y-3">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">{i18n.t("forum.posts.empty")}</h3>
              <p className="text-muted-foreground">
                {i18n.t("forum.posts.beFirst")}
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onClick={() => {
                  void navigate(`/app/forum/posts/${post.id}`);
                }}
              />
            ))
          )}
        </div>
      </InfiniteScroll>
    </div>
  );
}

function PostCard({
  post,
  onClick,
}: {
  post: Post;
  onClick: () => void;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick();
  };
  const subjects = new Subject();
  const author = post.author as { name: string; image: string | null } | null;
  const authorName = author?.name ?? null;
  const authorImage = author?.image ?? null;
  const currentCategory = getCategoryInfo(post.category);
  const t = i18n.t;

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-lg border p-4 text-left transition cursor-pointer",
        post.pinned
          ? "border-sky-300/60 bg-sky-500/10 hover:bg-sky-500/15 dark:border-sky-400/30 dark:bg-sky-400/10 dark:hover:bg-sky-400/15"
          : "border-border bg-card hover:bg-muted"
      )}
      onClick={handleClick}
    >
      <div className="flex gap-4">
        <div className="shrink-0">
          <Avatar>
            <AvatarImage src={authorImage ?? undefined} />
            <AvatarFallback>
              {authorName ? authorName.charAt(0).toUpperCase() : "?"}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Badge
              variant="outline"
              className="h-auto rounded px-2 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: currentCategory.color }}
            >
              <currentCategory.icon className="mr-1 h-3 w-3" />
              {t(currentCategory.label)}
            </Badge>
            {post.pinned && (
              <Badge
                variant="outline"
                className="h-auto rounded border-sky-300/60 bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-100"
              >
                <Pin className="mr-1 h-3 w-3" />
                {t("forum.posts.pinned")}
              </Badge>
            )}
            {forumCategoryRequiresSubject(post.category) && post.subject && (
              <>
                <div className="flex items-center gap-1">
                  {subjects.getIcon(post.subject as SubjectNames, { width: 16, height: 16 })}
                  <span className="text-xs text-muted-foreground">
                    {subjects.getSubjectNameById(post.subject as SubjectNames)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground" aria-hidden="true">{"\u00b7"}</span>
              </>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(post.createdAt)}
            </span>
          </div>

          {post.title && (
            <h3 className="mb-2 line-clamp-2 font-semibold text-foreground">{post.title}</h3>
          )}

          {post.content && (
            <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
              {post.content}
            </p>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {t("lists.authorPrefix", {
                author: post.author?.displayUsername ?? post.author?.name ?? t("forum.unknownAuthor"),
              })}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function formatDate(date: Date | string): string {
  const parsedDate = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - parsedDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return i18n.t("forum.posts.time.justNow");
  }
  if (diffMins < 60) {
    return i18n.t("forum.posts.time.minutesAgo", { count: diffMins });
  }
  if (diffHours < 24) {
    return i18n.t("forum.posts.time.hoursAgo", { count: diffHours });
  }
  if (diffDays < 7) {
    return i18n.t("forum.posts.time.daysAgo", { count: diffDays });
  }
  return parsedDate.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}
