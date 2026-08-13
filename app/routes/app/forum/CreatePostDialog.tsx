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

import { useRouteLoaderData, useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { PostDialog } from "./PostDialog";
import { defaultForumCategory, forumCategoryRequiresSubject, type ForumCategory } from "~/lib/forum";
import { SubjectNamesArray, type SubjectNames } from "~/lib/subjectnames";
import { t } from "~/i18n";
import { useTRPC } from "~/server/react";
import { useState } from "react";

type CreatePostDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreatePostDialog({
  open,
  onOpenChange,
}: CreatePostDialogProps) {
  const rootData = useRouteLoaderData("root");
  const theme = rootData?.theme ?? "light";
  const isAdmin = rootData?.user.role === "admin";
  const rpc = useTRPC();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<SubjectNames>(SubjectNamesArray[0]);
  const [category, setCategory] = useState<ForumCategory>(defaultForumCategory);
  const [body, setBody] = useState("");
  const [isSubjectSelectorOpen, setIsSubjectSelectorOpen] = useState(false);
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);
  const navigate = useNavigate();

  const createPostMutation = useMutation({
    ...rpc.forum.createPost.mutationOptions(),
    onSuccess: (data) => {
      toast.success(t("forum.post.created"));
      setTitle("");
      setBody("");
      setSubject(SubjectNamesArray[0]);
      setCategory(defaultForumCategory);
      onOpenChange(false);
      void navigate(`/app/forum/posts/${data.id}`)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t("forum.post.error");
      toast.error(message);
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error(t("forum.post.titleRequired"));
      return;
    }
    if (!body.trim()) {
      toast.error(t("forum.post.contentRequired"));
      return;
    }

    createPostMutation.mutate({
      title: title.trim(),
      content: body.trim(),
      subject: forumCategoryRequiresSubject(category) ? subject : undefined,
      category,
    });
  };

  return (
    <PostDialog
      isEdit={false}
      open={open}
      onOpenChange={onOpenChange}
      theme={theme}
      title={title}
      content={body}
      setTitle={setTitle}
      setContent={setBody}
      category={category}
      setCategory={setCategory}
      subject={subject}
      setSubject={setSubject}
      isSubjectSelectorOpen={isSubjectSelectorOpen}
      setIsSubjectSelectorOpen={setIsSubjectSelectorOpen}
      isCategoryPopoverOpen={isCategoryPopoverOpen}
      setIsCategoryPopoverOpen={setIsCategoryPopoverOpen}
      isPending={createPostMutation.isPending}
      onSubmit={handleSubmit}
      isAdmin={isAdmin}
    />
  );
}
