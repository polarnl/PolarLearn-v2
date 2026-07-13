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

import {
  Outlet,
  useLocation,
  useNavigate,
  useLoaderData,
  useRouteLoaderData,
} from "react-router";
import { Tabs } from "@polarnl/polarui-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { prisma } from "~/lib/db";
import type { Route } from "./+types/layout";
import i18n, { t } from "~/i18n";
import { Badge } from "~/components/ui/badge";
import { ShieldUser } from "lucide-react";

export async function loader({ params }: Route.LoaderArgs) {
  const userId = params.id;
  if (!userId) {
    throw new Response("", { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      displayUsername: true,
      image: true,
      role: true,
      lists: {
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          name: true,
          subject: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              displayUsername: true,
              username: true,
              name: true,
            },
          },
        },
      },
      forumPosts: {
        where: {
          isReply: false,
          deleted: false,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          title: true,
          content: true,
          category: true,
          subject: true,
          pinned: true,
          createdAt: true,
        },
      },
      createdGroups: {
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          name: true,
          image: true,
          members: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });
  if (!user) {
    throw new Response("", { status: 404 });
  }
  return { user };
}

export default function Layout() {
  const { user } = useLoaderData<typeof loader>();
  // build tabs dynamically so we can include admin tab only for admin users
  const tabs = [
    { label: i18n.t("navigation.lists"), path: "lists" },
    { label: i18n.t("navigation.groups"), path: "groups" },
    { label: i18n.t("navigation.folders"), path: "folders" },
    { label: i18n.t("navigation.posts"), path: "posts" },
  ];

  const rootData = useRouteLoaderData("root");
  const viewerRole = rootData?.user?.role;

  if (viewerRole === "admin") {
    tabs.push({ label: i18n.t("navigation.administration"), path: "admin" });
  }
  const location = useLocation();
  const navigate = useNavigate();
  const theme = rootData?.theme ?? "dark";

  const basePath = `/app/viewuser/${user.id}`;
  const normalizedPath = location.pathname.replace(/\/+$/, "");
  const activeTab = tabs.find(
    ({ path }) =>
      normalizedPath === `${basePath}/${path}` ||
      normalizedPath.startsWith(`${basePath}/${path}/`),
  )?.path ?? tabs[0]!.path;

  return (
    <div className="p-4">
      <div className="flex flex-row items-center gap-3">
        <Avatar className="size-12">
          <AvatarImage src={user.image ?? undefined} />
          <AvatarFallback>
            {(user.displayUsername ?? user.name ?? "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold flex flex-row items-center gap-2">
            {user.displayUsername ?? user.name ?? "User"}
            {user.role === "admin" ? (
              <Badge
                variant="outline"
                className="h-auto rounded px-2 py-1 text-xs font-semibold bg-red-500 text-white"
              >
                <ShieldUser />
                {t("userMenu.admin")}
              </Badge>
            ) : null}
          </h1>
          {user.name &&
            user.displayUsername &&
            user.name !== user.displayUsername ? (
            <p className="truncate text-sm text-muted-foreground">
              @{user.name}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-row items-center">
        <Tabs
          scheme={theme}
          tabs={tabs.map(({ label, path }) => ({ value: path, title: label }))}
          activeTab={activeTab}
          onActiveTabChange={(path) => {
            void navigate(`${basePath}/${path}`);
          }}
        />
      </div>
      <hr />
      <div className="py-4">
        <Outlet />
      </div>
    </div>
  );
}
