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
import { Gavel, Loader2, MailCheck, MailWarning, MessageSquareX, ShieldAlert, ShieldUser } from "lucide-react";
import { redirect, useLoaderData, useNavigate } from "react-router";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { authClient } from "~/lib/auth/client";
import { auth } from "~/lib/auth/server";
import type { UserModel } from "~/prisma/models";
import type { Route } from "./+types/users";
import i18n from "~/i18n";
import { getRequestSession } from "~/server/trpc";

const PAGE_SIZE = 50;

export async function loader({ request }: Route.LoaderArgs) {
  const headers = new Headers(request.headers);
  const session = await getRequestSession({ headers, request });

  if (!session?.user) {
    const url = new URL(request.url);
    return redirect(`/auth/sign-in?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
  }

  if (session.user.role !== "admin") {
    return redirect("/app");
  }

  const initialPage = await auth.api.listUsers({
    headers,
    query: {
      limit: PAGE_SIZE,
      offset: 0,
      sortBy: "createdAt",
      sortDirection: "desc",
    },
  });

  return {
    currentUserId: session.user.id,
    initialPage: normalizeUsersPage(initialPage),
  };
}

export default function UsersAdminPage() {
  const { initialPage } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserModel[]>(initialPage.users);
  const [total, setTotal] = useState(initialPage.total);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const t = i18n.t;

  const hasMore = users.length < total;

  const loadMoreUsers = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setLoadError(null);

    const { data, error } = await authClient.admin.listUsers({
      query: {
        limit: PAGE_SIZE,
        offset: users.length,
        sortBy: "createdAt",
        sortDirection: "desc",
      },
    });

    if (error || !data) {
      setLoadError(error?.message ?? t("admin.users.loadError"));
      setIsLoadingMore(false);
      return;
    }

    const nextPage = normalizeUsersPage(data);
    setUsers((currentUsers) => {
      const seen = new Set(currentUsers.map((user) => user.id));
      const mergedUsers = [...currentUsers];

      for (const user of nextPage.users) {
        if (!seen.has(user.id)) {
          seen.add(user.id);
          mergedUsers.push(user);
        }
      }

      return mergedUsers;
    });
    setTotal(nextPage.total);
    setIsLoadingMore(false);
  };

  return (
    <section className="space-y-4">
      {loadError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <ShieldAlert className="size-4" />
          <span>{loadError}</span>
        </div>
      ) : null}

      <InfiniteScroll
        dataLength={users.length}
        next={loadMoreUsers}
        hasMore={hasMore}
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
          {
            users.map((user) => (
              <button
                key={user.id}
                type="button"
                className="w-full flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 text-left transition hover:bg-muted cursor-pointer"
                onClick={() => void navigate(`/app/viewuser/${user.id}`)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.image ?? undefined} alt={user.name ?? user.email} />
                    <AvatarFallback>
                      {(user.name ?? user.email).trim().charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <div className="min-w-0 truncate font-medium text-foreground">
                        {user.name ?? user.email}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {user.role === "admin" ? (
                          <Badge
                            variant="outline"
                            className="h-auto rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white"
                          >
                            <ShieldUser className="mr-1 h-3 w-3" />
                            {t("userMenu.admin")}
                          </Badge>
                        ) : null}
                        {user.banned ? (
                          <Badge variant="destructive" className="h-auto rounded px-2 py-1 text-xs font-semibold">
                            <Gavel className="mr-1 h-3 w-3" /> {t("admin.users.badges.platformBanned")}
                          </Badge>
                        ) : null}
                        {user.forumBanned ? (
                          <Badge variant="outline" className="h-auto rounded px-2 py-1 text-xs font-semibold bg-orange-500 text-white">
                            <MessageSquareX className="mr-1 h-3 w-3" /> {t("admin.users.badges.forumBanned")}
                          </Badge>
                        ) : null}
                        {user.emailVerified ? (
                          <Badge variant="outline" className="h-auto rounded px-2 py-1 text-xs font-semibold bg-green-500 text-white">
                            <MailCheck className="mr-1 h-3 w-3" /> {t("admin.users.badges.verified")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="h-auto rounded px-2 py-1 text-xs font-semibold bg-amber-500 text-white">
                            <MailWarning className="mr-1 h-3 w-3" /> {t("admin.users.badges.unverified")}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="truncate text-sm text-muted-foreground">{user.email}</div>
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
          }
        </div>
      </InfiniteScroll>
    </section>
  );
}

function normalizeUsersPage(page: unknown): { users: UserModel[]; total: number } {
  const value = page as { users?: unknown; total?: unknown };

  return {
    users: Array.isArray(value.users) ? (value.users as UserModel[]) : [],
    total: typeof value.total === "number" ? value.total : 0,
  };
}
