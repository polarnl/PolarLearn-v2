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

import { useNavigate, useRouteLoaderData } from "react-router";
import { MessageSquare } from "lucide-react";
import type { ForumCategory } from "~/lib/forum";
import i18n from "~/i18n";
import { ForumPostCard } from "../forum/PostCard";

type ViewUserPost = {
  id: string;
  title: string | null;
  content: string;
  category: ForumCategory;
  subject: string | null;
  pinned: boolean;
  createdAt: Date | string;
};

export default function ViewUserPostsPage() {
  const loaderData = useRouteLoaderData("../routes/app/viewuser/layout") as {
    user: {
      name: string | null;
      displayUsername: string | null;
      image: string | null;
      forumPosts: ViewUserPost[];
    };
  };
  const navigate = useNavigate();
  const posts = loaderData?.user.forumPosts ?? [];

  return (
    <div className="space-y-3">
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">
            {i18n.t("forum.posts.empty")}
          </h3>
          <p className="text-muted-foreground">
            {i18n.t("forum.posts.beFirst")}
          </p>
        </div>
      ) : (
        posts.map((post) => (
          <ForumPostCard
            key={post.id}
            post={post}
            author={{
              name: loaderData.user.name,
              displayUsername: loaderData.user.displayUsername,
              image: loaderData.user.image,
            }}
            onClick={() => {
              void navigate(`/app/forum/posts/${post.id}`);
            }}
          />
        ))
      )}
    </div>
  );
}
