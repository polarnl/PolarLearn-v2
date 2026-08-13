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
import { useLoaderData, useNavigate } from "react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

import { t } from "~/i18n";
import { appRouter } from "~/server/main";
import { createCallerFactory, createTRPCContext } from "~/server/trpc";
import type { Route } from "./+types/groups";
import { useTRPC } from "~/server/react";

const PAGE_SIZE = 10;

export async function loader({ request }: Route.LoaderArgs) {
  const headers = new Headers(request.headers);
  const context = await createTRPCContext({ headers, request });
  const caller = createCallerFactory(appRouter)(context);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (!q) {
    return { initialGroups: { groups: [], nextCursor: null }, q };
  }

  const initialGroups = await caller.search.searchGroups({ q, limit: PAGE_SIZE, cursor: undefined });

  return { initialGroups, q };
}

export default function SearchGroups() {
  const { initialGroups, q } = useLoaderData<typeof loader>();
  const trpc = useTRPC();
  const navigate = useNavigate();
  const query = useInfiniteQuery(
    trpc.search.searchGroups.infiniteQueryOptions(
      { q, limit: PAGE_SIZE },
      {
        enabled: Boolean(q),
        getNextPageParam: (page) => page.nextCursor ?? undefined,
        initialData: { pages: [initialGroups], pageParams: [null] },
      },
    ),
  );
  const groups = query.data.pages.flatMap((page) => page.groups);

  return (
    <div className="flex flex-col gap-4">
      {query.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("errors.unknown")}
        </div>
      ) : null}

      <InfiniteScroll
        dataLength={groups.length}
        next={() => void query.fetchNextPage()}
        hasMore={Boolean(q && query.hasNextPage)}
        loader={
          <div className="flex items-center justify-center p-4">
            <div className="text-muted-foreground">{t("forum.posts.loadingMore")}</div>
          </div>
        }
        endMessage={
          groups.length > 0 ? (
            <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
              {t("forum.posts.noMore")}
            </div>
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          {groups.length === 0 ? (
            <p className="text-sm text-neutral-500">{q ? t("search.notFound") : t("search.placeholder")}</p>
          ) : (
            groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className="grid h-15 w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 rounded-xl bg-neutral-200 px-4 py-3 text-left transition-all hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                onClick={() => {
                  void navigate(`/app/group/${group.id}`);
                }}
              >
                <span className="flex min-w-0 items-center gap-x-3">
                  <Avatar size="sm">
                    <AvatarImage src={group.image ?? undefined} alt={group.name} />
                    <AvatarFallback>{group.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-base font-semibold">{group.name}</span>
                </span>

                <span className="justify-self-end whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">
                  {group.members.length} {group.members.length === 1 ? "member" : "members"}
                </span>
              </button>
            ))
          )}
        </div>
      </InfiniteScroll>
    </div>
  );
}
