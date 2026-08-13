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
import { Loader2, ShieldUser } from "lucide-react";
import { useLoaderData, useNavigate } from "react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { createCallerFactory, createTRPCContext } from "~/server/trpc";
import { appRouter } from "~/server/main";
import { t } from "~/i18n";
import type { Route } from "./+types/users";
import { useTRPC } from "~/server/react";

const PAGE_SIZE = 10;

export async function loader({ request }: Route.LoaderArgs) {
  const headers = new Headers(request.headers);
  const context = await createTRPCContext({ headers, request });
  const caller = createCallerFactory(appRouter)(context);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (!q) {
    return { users: { users: [], nextCursor: null }, q };
  }

  const initialUsers = await caller.search.searchUser({ q, limit: PAGE_SIZE, cursor: undefined });

  return { users: initialUsers, q };
}

export default function SearchUsers() {
  const { users: initialUsers, q } = useLoaderData<typeof loader>();
  const trpc = useTRPC();
  const navigate = useNavigate();
  const query = useInfiniteQuery(
    trpc.search.searchUser.infiniteQueryOptions(
      { q, limit: PAGE_SIZE },
      {
        enabled: Boolean(q),
        getNextPageParam: (page) => page.nextCursor ?? undefined,
        initialData: { pages: [initialUsers], pageParams: [null] },
      },
    ),
  );
  const users = query.data.pages.flatMap((page) => page.users);

  return (
    <section className="space-y-4">
      {query.isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{t("errors.unknown")}</span>
        </div>
      ) : null}

      <InfiniteScroll
        dataLength={users.length}
        next={() => void query.fetchNextPage()}
        hasMore={Boolean(q && query.hasNextPage)}
        loader={
          <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>{t("admin.users.loadingMore")}</span>
          </div>
        }
        endMessage={
          users.length > 0 ? (
            <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
              {t("admin.users.allLoaded")}
            </div>
          ) : null
        }
      >
        <div className="space-y-3">
          {users.length === 0 ? (
            <p className="text-sm text-neutral-500">{q ? t("search.notFound") : t("search.placeholder")}</p>
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                type="button"
                className="flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 text-left transition hover:bg-muted cursor-pointer"
                onClick={() => void navigate(`/app/viewuser/${user.id}`)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.image ?? undefined} alt={user.displayUsername ?? user.name} />
                    <AvatarFallback>
                      {(user.displayUsername ?? user.name ?? "?").trim().charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <div className="min-w-0 truncate font-medium text-foreground">
                        {user.displayUsername ?? user.name}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {user.role === "admin" ? (
                          <Badge
                            variant="outline"
                            className="h-auto rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white"
                          >
                            <ShieldUser />
                            {t("userMenu.admin")}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      @{user.username ?? user.displayUsername ?? user.name}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </InfiniteScroll>
    </section>
  );
}
