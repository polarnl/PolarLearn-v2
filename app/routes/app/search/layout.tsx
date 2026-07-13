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

import { Outlet, useLocation, useNavigate, useRouteLoaderData } from "react-router";
import { Tabs } from "@polarnl/polarui-react";
import { t } from "~/i18n";

const tabs = [
  { label: t("navigation.lists"), path: "lists" },
  { label: t("navigation.groups"), path: "groups" },
  { label: t("navigation.forum"), path: "forum" },
  { label: t("admin.tabs.users"), path: "users" },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const rootData = useRouteLoaderData("root");
  const theme = rootData?.theme ?? "dark";

  const normalizedPath = location.pathname.replace(/\/+$/, "");
  const basePath = "/app/search";
  const activeTab = tabs.find(
    ({ path }) =>
      normalizedPath === `${basePath}/${path}` ||
      (path === "" && normalizedPath === basePath) ||
      normalizedPath.startsWith(`${basePath}/${path}/`),
  )?.path ?? tabs[0]!.path;

  return (
    <div className="p-4">
      <div className="mt-4 flex flex-row items-center gap-3">
        <Tabs
          scheme={theme}
          tabs={tabs.map(({ label, path }) => ({ value: path, title: label }))}
          activeTab={activeTab}
          onActiveTabChange={(path) => {
            void navigate(`${basePath}/${path}${location.search}`);
          }}
        />
      </div>
      <hr className="mb-4" />
      <Outlet />
    </div>
  );
}
