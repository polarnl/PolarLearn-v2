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

import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  route("api/rpc/*", "routes/api/rpc.ts"), // remove this and i will find you
  route("api/report-error", "routes/api/report-error.ts"),
  route("api/profile-picture", "routes/api/profile-picture.ts"),
  index("routes/_index.tsx"),
  route("api/auth/*", "routes/api/auth/[...auth].ts"),
  route("auth/sign-in", "routes/auth/sign-in.tsx"),
  route("auth/sign-up", "routes/auth/sign-up.tsx"),
  route("auth/reset-password", "routes/auth/reset-password.tsx"),
  layout("routes/app/layout.tsx", [
    route("app", "routes/app/_index.tsx"),
    layout("routes/app/forum/layout.tsx", [
      route("app/forum/posts", "routes/app/forum/posts.tsx"),
      route("app/forum/myPosts", "routes/app/forum/myPosts.tsx"),
      route("app/forum/myReplies", "routes/app/forum/myReplies.tsx"),
      route("app/forum", "routes/app/forum/_index.tsx"),
    ]),
    route("app/forum/posts/:postid", "routes/app/forum/[postid].tsx"),
    route("app/editlist/:id", "routes/app/editlist/[id].tsx"),
    layout("routes/app/viewlist/layout.tsx", [
      route("app/viewlist/:id/words", "routes/app/viewlist/words.tsx"),
      route("app/viewlist/:id", "routes/app/viewlist/main.tsx"),
      route("app/viewlist/:id/history", "routes/app/viewlist/history/main.tsx"),
      route("app/viewlist/:id/history/:commitid", "routes/app/viewlist/history/[commitid].tsx"),
      route("app/viewlist/:id/stats", "routes/app/viewlist/stats.tsx"),
      route("app/viewlist/:id/stats/:sessionId", "routes/app/viewlist/stats-session.tsx"),
    ]),
    route("app/favorites", "routes/app/favorites.tsx"),
    route("app/mylists", "routes/app/mylists.tsx"),
    layout("routes/app/viewuser/layout.tsx", [
      route("app/viewuser/:id/admin", "routes/app/viewuser/admin.tsx"),
      route("app/viewuser/:id/folders", "routes/app/viewuser/folders.tsx"),
      route("app/viewuser/:id/groups", "routes/app/viewuser/groups.tsx"),
      route("app/viewuser/:id/lists", "routes/app/viewuser/lists.tsx"),
      route("app/viewuser/:id/posts", "routes/app/viewuser/posts.tsx"),
      route("app/viewuser/:id", "routes/app/viewuser/_index.tsx"),
    ]),
    layout("routes/app/group/layout.tsx", [
      route("app/group/:id/lists", "routes/app/group/lists.tsx"),
      route("app/group/:id/members", "routes/app/group/members.tsx"),
      route("app/group/:id/settings", "routes/app/group/settings.tsx"),
      route("app/group/:id", "routes/app/group/_index.tsx"),
    ]),
    route("app/groups", "routes/app/groups.tsx"),
    layout("routes/app/administration/layout.tsx", [
      route("app/administration/general", "routes/app/administration/general.tsx"),
      route("app/administration/users", "routes/app/administration/users.tsx"),
      route("app/administration/tenancies", "routes/app/administration/tenancies.tsx"),
      route("app/administration/tenancies/:id", "routes/app/administration/[tenancy].tsx"),
      route("app/administration/lists", "routes/app/administration/lists.tsx"),
      route("app/administration", "routes/app/administration/_index.tsx"),
    ]),
    route("app/usersettings", "routes/app/usersettings.tsx"),
    layout("routes/app/search/layout.tsx", [
      route("app/search", "routes/app/search/_index.tsx"),
      route("app/search/lists", "routes/app/search/lists.tsx"),
      route("app/search/groups", "routes/app/search/groups.tsx"),
      route("app/search/forum", "routes/app/search/forum.tsx"),
      route("app/search/users", "routes/app/search/users.tsx"),
    ]),
  ]),
  route("app/session/:id", "routes/app/session/[id].tsx")
] satisfies RouteConfig;
