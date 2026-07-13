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
  useRouteLoaderData,
} from "react-router";
import { Tabs } from "@polarnl/polarui-react";
import { t } from "~/i18n";
import type { Route } from "./+types/layout";

const tabs = [
  { label: t("forum.tabs.allPosts"), path: "posts" },
  { label: t("forum.tabs.myPosts"), path: "myPosts" },
  { label: t("forum.tabs.myReplies"), path: "myReplies" },
];

export function meta(): Route.MetaDescriptors {
  return [
    { title: t("forum.metaTitle") },
    {
      name: "description",
      content: t("forum.metaDescription"),
    },
  ];
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const rootData = useRouteLoaderData("root");
  const theme = rootData?.theme ?? "dark";
  const isLoggedIn = Boolean(rootData?.user?.id);
  const forumBanReason = rootData?.user?.forumBanReason?.trim();
  const visibleTabs = isLoggedIn ? tabs : tabs.slice(0, 1);

  const normalizedPath = location.pathname.replace(/\/+$/, "");
  const basePath = "/app/forum";
  const activeTab = visibleTabs.find(
    ({ path }) =>
      normalizedPath === `${basePath}/${path}` ||
      normalizedPath.startsWith(`${basePath}/${path}/`),
  )?.path ?? visibleTabs[0]!.path;

  return (
    <div className="p-4">
      <h1 className="truncate text-3xl font-bold">{t("navigation.forum")}</h1>
      {!isLoggedIn ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("forum.loginPrompt")}
        </p>
      ) : null}
      {rootData?.user?.forumBanned ? (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("forum.banned.description", {
            reason: forumBanReason || t("forum.banned.noReason"),
          })}
        </div>
      ) : null}
      <div className="mt-4 flex flex-row items-center gap-3">
        <Tabs
          scheme={theme}
          tabs={visibleTabs.map(({ label, path }) => ({ value: path, title: label }))}
          activeTab={activeTab}
          onActiveTabChange={(path) => {
            void navigate(`${basePath}/${path}`);
          }}
        />
      </div>
      <hr className="mt-4" />
      <div className="py-4">
        <Outlet />
      </div>
    </div>
  );
}
