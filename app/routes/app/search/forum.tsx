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

import InfiniteScroll from "react-infinite-scroll-component";
import { MessageSquare } from "lucide-react";
import { useLoaderData, useNavigate } from "react-router";
import { useInfiniteQuery } from "@tanstack/react-query";

import { t } from "~/i18n";
import { appRouter } from "~/server/main";
import { createCallerFactory, createTRPCContext } from "~/server/trpc";
import type { Route } from "./+types/forum";
import { useTRPC } from "~/server/react";
import { ForumPostCard } from "../forum/PostCard";

const PAGE_SIZE = 10;

export async function loader({ request }: Route.LoaderArgs) {
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
  const navigate = useNavigate();
  const query = useInfiniteQuery(
    trpc.search.searchForum.infiniteQueryOptions(
      { q, limit: PAGE_SIZE },
      {
        enabled: Boolean(q),
        getNextPageParam: (page) => page.nextCursor ?? undefined,
        initialData: { pages: [initialPosts], pageParams: [null] },
      },
    ),
  );
  const posts = query.data.pages.flatMap((page) => page.posts);

  return (
    <div className="flex flex-col gap-3">
      {query.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("errors.unknown")}
        </div>
      ) : null}

      <InfiniteScroll
        dataLength={posts.length}
        next={() => void query.fetchNextPage()}
        hasMore={Boolean(q && query.hasNextPage)}
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
