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

import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { MessageSquare, Pin } from "lucide-react";
import { useLoaderData, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import {
  forumCategoryRequiresSubject,
  getCategoryInfo,
} from "~/lib/forum";
import type { SearchForumOutput, SearchForumPost } from "~/lib/search";
import { Subject } from "~/lib/subjects";
import type { SubjectNames } from "~/lib/subjectnames";
import { t } from "~/i18n";
import { appRouter } from "~/server/main";
import { createCallerFactory, createTRPCContext } from "~/server/trpc";
import type { Route } from "./+types/forum";
import { useTRPC } from "~/server/react";

const PAGE_SIZE = 10;

type LoaderData = {
  initialPosts: SearchForumOutput;
  q: string;
};

export async function loader({ request }: Route.LoaderArgs): Promise<LoaderData> {
  const headers = new Headers(request.headers);
  const context = await createTRPCContext({ headers, request });
  const caller = createCallerFactory(appRouter)(context);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (!q) {
    return { initialPosts: { posts: [], nextCursor: null }, q };
  }

  const initialPosts = await caller.search.searchForum({ q, limit: PAGE_SIZE, cursor: undefined });

  return { initialPosts, q };
}

export default function SearchForum() {
  const { initialPosts, q } = useLoaderData<typeof loader>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<SearchForumPost[]>(initialPosts.posts);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPosts.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setPosts(initialPosts.posts);
    setNextCursor(initialPosts.nextCursor);
    setLoadError(null);
    setIsLoadingMore(false);
  }, [initialPosts.posts, initialPosts.nextCursor, q]);

  const fetchMore = async () => {
    if (!q || !nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const nextPage = await queryClient.fetchQuery(
        trpc.search.searchForum.queryOptions({
          q,
          limit: PAGE_SIZE,
          cursor: nextCursor,
        }),
      );

      setPosts((currentPosts) => mergePostsById(currentPosts, nextPage.posts));
      setNextCursor(nextPage.nextCursor);
    } catch {
      setLoadError(t("errors.unknown"));
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      <InfiniteScroll
        dataLength={posts.length}
        next={() => {
          void fetchMore();
        }}
        hasMore={Boolean(q && nextCursor)}
        loader={
          <div className="flex items-center justify-center p-4">
            <div className="text-muted-foreground">{t("forum.posts.loadingMore")}</div>
          </div>
        }
        endMessage={
          posts.length > 0 ? (
            <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
              {t("forum.posts.noMore")}
            </div>
          ) : null
        }
      >
        <div className="space-y-3">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900/80">
              <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {q ? t("search.notFound") : t("search.placeholder")}
              </h3>
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

function mergePostsById(currentPosts: SearchForumPost[], nextPosts: SearchForumPost[]) {
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

function PostCard({
  post,
  onClick,
}: {
  post: SearchForumPost;
  onClick: () => void;
}) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onClick();
  };
  const subjects = new Subject();
  const author = post.author as { name: string; image: string | null } | null;
  const authorName = author?.name ?? null;
  const authorImage = author?.image ?? null;
  const currentCategory = getCategoryInfo(post.category);

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
                author:
                  post.author?.displayUsername ??
                  post.author?.name ??
                  t("forum.unknownAuthor"),
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
    return t("forum.posts.time.justNow");
  }
  if (diffMins < 60) {
    return t("forum.posts.time.minutesAgo", { count: diffMins });
  }
  if (diffHours < 24) {
    return t("forum.posts.time.hoursAgo", { count: diffHours });
  }
  if (diffDays < 7) {
    return t("forum.posts.time.daysAgo", { count: diffDays });
  }
  return parsedDate.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}
