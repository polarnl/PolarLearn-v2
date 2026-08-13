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
import i18n from "~/i18n";
import { createCallerFactory, createTRPCContext } from "~/server/trpc";
import { appRouter } from "~/server/main";
import type { Route } from "./+types/myPosts";
import { ForumPostCard } from "./PostCard";

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
  const initialPosts = await caller.forum.getPosts({
    limit: 10,
    cursor: undefined,
    authorId: context.user.id,
  });

  return {
    initialPosts,
    authorId: context.user.id,
  };
}

export default function MyPostsPage() {
  const { initialPosts, authorId } = useLoaderData<typeof loader>();
  const trpc = useTRPC();
  const navigate = useNavigate();
  const query = useInfiniteQuery(
    trpc.forum.getPosts.infiniteQueryOptions(
      { limit: 10, authorId },
      {
        getNextPageParam: (page) => page.nextCursor ?? undefined,
        initialData: { pages: [initialPosts], pageParams: [null] },
      },
    ),
  );
  const posts = query.data.pages.flatMap((page) => page.posts);

  if (query.isError) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-destructive">
          {i18n.t("forum.posts.failedToLoad")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <InfiniteScroll
        dataLength={posts.length}
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
          posts.length > 0 ? (
            <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
              {i18n.t("forum.posts.noMore")}
            </div>
          ) : null
        }
      >
        <div className="space-y-3">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900/80">
              <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {i18n.t("forum.myPosts.empty")}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {i18n.t("forum.myPosts.emptyDescription")}
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <ForumPostCard
                key={post.id}
                post={post}
                author={post.author}
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
