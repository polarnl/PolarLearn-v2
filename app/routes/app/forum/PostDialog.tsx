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

import { Button, Input } from "@polarnl/polarui-react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useRouteLoaderData } from "react-router";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { forumCategoryInfo, forumCategoryRequiresSubject, getAvailableForumCategories, type ForumCategory } from "~/lib/forum";
import SubjectSelector from "~/components/subject-selector";
import type { SubjectNames } from "~/lib/subjectnames";
import { t } from "~/i18n";
import { cn } from "~/lib/utils";

type PostDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEdit?: boolean;
  theme: "light" | "dark";
  title: string;
  content: string;
  setTitle: (value: string) => void;
  setContent: (value: string) => void;
  category: ForumCategory;
  setCategory: (value: ForumCategory) => void;
  subject: SubjectNames;
  setSubject: (value: SubjectNames) => void;
  isSubjectSelectorOpen: boolean;
  setIsSubjectSelectorOpen: (value: boolean) => void;
  isCategoryPopoverOpen: boolean;
  setIsCategoryPopoverOpen: (value: boolean) => void;
  isPending: boolean;
  onSubmit: () => void;
  isAdmin: boolean;
};

export function PostDialog({
  open,
  onOpenChange,
  isEdit = false,
  theme,
  title,
  content,
  setTitle,
  setContent,
  category,
  setCategory,
  subject,
  setSubject,
  isSubjectSelectorOpen,
  setIsSubjectSelectorOpen,
  isCategoryPopoverOpen,
  setIsCategoryPopoverOpen,
  isPending,
  onSubmit,
  isAdmin,
}: PostDialogProps) {
  const rootData = useRouteLoaderData("root");
  const isForumBanned = rootData?.user?.forumBanned === true;
  const forumBanReason = rootData?.user?.forumBanReason?.trim();
  const canSubmitPost = isEdit || (Boolean(rootData?.user?.id) && !isForumBanned);
  const availableCategories = getAvailableForumCategories(isAdmin);

  const SelectedCategoryIcon = forumCategoryInfo[category].icon;

  const dialogTitle = isEdit
    ? t("forum.post.editTitle")
    : t("forum.createPost.title");

  const submitButtonLabel = isPending
    ? isEdit
      ? t("common.saving")
      : t("forum.createPost.posting")
    : !canSubmitPost
      ? isForumBanned
        ? t("forum.banned.submitBlocked")
        : t("forum.createPost.loginToPost")
      : isEdit
        ? t("common.save")
        : t("forum.createPost.post");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex w-full sm:max-w-xl flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div>
            <label htmlFor="post-title" className="font-medium">
              {t("forum.createPost.titleLabel")}
            </label>
            <Input
              id="post-title"
              placeholder={!isEdit ? t("forum.createPost.titlePlaceholder") : undefined}
              scheme={theme}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              className="mt-2"
              disabled={isPending || !canSubmitPost}
            />
          </div>

          <div className="mt-4">
            <p className="font-medium">{t("forum.createPost.categoryLabel")}</p>
            <Popover open={isCategoryPopoverOpen} onOpenChange={setIsCategoryPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
                  disabled={isPending || !canSubmitPost}
                >
                  <span className="flex items-center gap-2">
                    <SelectedCategoryIcon className="size-4" />
                    {t(forumCategoryInfo[category].label)}
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-2" align="start" portalled={false}>
                <div className="px-1 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("forum.createPost.chooseCategory")}
                </div>
                <div className="grid gap-1">
                  {availableCategories.map((categoryId) => {
                    const isSelected = categoryId === category;
                    const CategoryIcon = forumCategoryInfo[categoryId].icon;

                    return (
                      <button
                        key={categoryId}
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-muted",
                          isSelected && "bg-muted font-medium",
                        )}
                        onClick={() => {
                          setCategory(categoryId);
                          setIsCategoryPopoverOpen(false);
                        }}
                        disabled={isPending || !canSubmitPost}
                      >
                        <span className="flex items-center gap-2">
                          <CategoryIcon className="size-4" />
                          {t(forumCategoryInfo[categoryId].label)}
                        </span>
                        {isSelected ? <Check className="size-4 shrink-0 text-primary" /> : null}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {forumCategoryRequiresSubject(category) && (
            <div className="mt-4">
              <p className="font-medium">{t("forum.createPost.subjectLabel")}</p>
              <div className="mt-2">
                <SubjectSelector
                  selected={subject}
                  onSelect={(id) => {
                    setSubject(id);
                  }}
                  open={isSubjectSelectorOpen}
                  onOpenChange={setIsSubjectSelectorOpen}
                />
              </div>
            </div>
          )}

          <div className="mt-4">
            <label htmlFor="post-content" className="font-medium">
              {t("forum.createPost.contentLabel")}
            </label>
            <textarea
              id="post-content"
              placeholder={!isEdit ? t("forum.createPost.contentPlaceholder") : undefined}
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
              }}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium placeholder-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              rows={8}
              disabled={isPending || !canSubmitPost}
            />
          </div>
        </div>

        {!canSubmitPost ? (
          <p className="px-4 text-sm text-muted-foreground">
            {isForumBanned
              ? t("forum.banned.description", {
                reason: forumBanReason || t("forum.banned.noReason"),
              })
              : t("forum.createPost.loginToPostDescription")}
          </p>
        ) : null}

        <DialogFooter className="mt-4 shrink-0 border-t pt-4">
          <DialogClose asChild>
            <Button variant="transparent" scheme={theme} disabled={isPending}>
              {t("common.cancel")}
            </Button>
          </DialogClose>
          <Button
            color="sky"
            textColor="white"
            onClick={onSubmit}
            disabled={isPending || (!isEdit && !canSubmitPost)}
            icon={isPending ? <Loader2 className="animate-spin" /> : undefined}
          >
            {submitButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
