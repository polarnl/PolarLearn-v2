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
import { MessageSquare } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "~/server/react";
import type { GetPostsOutput } from "~/lib/forum";
import i18n, { t } from "~/i18n";
import { createCallerFactory, createTRPCContext } from "~/server/trpc";
import { appRouter } from "~/server/main";
import type { Route } from "./+types/posts";
import type { ForumOutletContext } from "./layout";
import { ForumPostCard } from "./PostCard";

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
        //staleTime: 1000,
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
