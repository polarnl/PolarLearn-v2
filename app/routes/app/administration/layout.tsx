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

import { Outlet, redirect, useLocation, useNavigate, useRouteLoaderData } from "react-router";
import { Tabs } from "@polarnl/polarui-react";
import { t } from "~/i18n";
import type { Route } from "./+types/layout";
import { getRequestSession } from "~/server/trpc";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";

const tabs = [
  { label: t("admin.tabs.general"), path: "general" },
  { label: t("admin.tabs.users"), path: "users" },
  { label: t("admin.tabs.lists"), path: "lists" },
  { label: t("admin.tabs.analytics"), path: "analytics" },
]

export async function loader(loaderArgs: Route.LoaderArgs) {
  const headers = new Headers(loaderArgs.request.headers)
  const result = await getRequestSession({ headers, request: loaderArgs.request })
  const user = result?.user
  if (!user || user.role !== "admin") {
    return redirect('/app')
  }
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const rootData = useRouteLoaderData("root");
  const theme = rootData?.theme ?? "dark";

  const normalizedPath = location.pathname.replace(/\/+$/, "");
  const basePath = "/app/administration";
  const activePath = normalizedPath === basePath ? `${basePath}/general` : normalizedPath;
  const activeIndex = tabs.findIndex(({ path }) => activePath === `${basePath}/${path}` || activePath.startsWith(`${basePath}/${path}/`));

  const handleTabChange = (idx: number) => {
    const tab = tabs[idx];
    if (tab) {
      void navigate(`${basePath}/${tab.path}`);
    }
  };


  return (
    <div className="p-4">
      <h1 className="truncate text-3xl font-bold">{t("navigation.administration")}</h1>
      <ScrollArea >
        <div className="mt-4 flex flex-row items-center gap-3">
          <Tabs
            scheme={theme}
            tabs={tabs.map((tab) => tab.label)}
            activeIndex={activeIndex === -1 ? 0 : activeIndex}
            onActiveIndexChange={handleTabChange}
          />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <hr className="mt-4" />
      <div className="py-4">
        <Outlet />
      </div>
    </div>
  );
}
