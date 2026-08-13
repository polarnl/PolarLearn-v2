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

import { Pin } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import {
  formatForumDate,
  forumCategoryRequiresSubject,
  getCategoryInfo,
  type ForumCategory,
} from "~/lib/forum";
import { getSubjectIcon, getSubjectNameById } from "~/lib/subjects";
import type { SubjectNames } from "~/lib/subjectnames";
import { cn } from "~/lib/utils";
import i18n from "~/i18n";

export function ForumPostCard({ post, author, onClick }: {
  post: {
    id: string;
    title: string | null;
    content: string;
    category: ForumCategory;
    subject: string | null;
    pinned: boolean;
    createdAt: Date | string;
  };
  author?: {
    name: string | null;
    displayUsername: string | null;
    image: string | null;
  } | null;
  onClick?: () => void;
}) {
  const currentCategory = getCategoryInfo(post.category);
  const authorName = author?.displayUsername ?? author?.name ?? null;

  return (
    <button
      type="button"
      className={cn(
        "w-full cursor-pointer rounded-lg border p-4 text-left transition",
        post.pinned
          ? "border-sky-300/60 bg-sky-500/10 hover:bg-sky-500/15 dark:border-sky-400/30 dark:bg-sky-400/10 dark:hover:bg-sky-400/15"
          : "border-border bg-card hover:bg-muted",
      )}
      onClick={onClick}
    >
      <div className="flex gap-4">
        <div className="shrink-0">
          <Avatar>
            <AvatarImage src={author?.image ?? undefined} />
            <AvatarFallback>
              {authorName?.charAt(0).toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="h-auto rounded px-2 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: currentCategory.color }}
            >
              <currentCategory.icon className="mr-1 h-3 w-3" />
              {i18n.t(currentCategory.label)}
            </Badge>
            {post.pinned ? (
              <Badge
                variant="outline"
                className="h-auto rounded border-sky-300/60 bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-100"
              >
                <Pin className="mr-1 h-3 w-3" />
                {i18n.t("forum.posts.pinned")}
              </Badge>
            ) : null}
            {forumCategoryRequiresSubject(post.category) && post.subject ? (
              <>
                <div className="flex items-center gap-1">
                  {getSubjectIcon(post.subject as SubjectNames, {
                    width: 16,
                    height: 16,
                  })}
                  <span className="text-xs text-muted-foreground">
                    {getSubjectNameById(post.subject as SubjectNames)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground" aria-hidden="true">
                  {"\u00b7"}
                </span>
              </>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {formatForumDate(post.createdAt)}
            </span>
          </div>

          {post.title ? (
            <h3 className="mb-2 line-clamp-2 font-semibold text-foreground">
              {post.title}
            </h3>
          ) : null}
          {post.content ? (
            <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
              {post.content}
            </p>
          ) : null}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {i18n.t("lists.authorPrefix", {
                author: authorName ?? i18n.t("forum.unknownAuthor"),
              })}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
