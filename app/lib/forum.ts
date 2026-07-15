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

import { z } from "zod";
import { Globe, GraduationCap, Megaphone, type LucideIcon } from "lucide-react";
import type { PrismaClient } from "~/prisma/client";
import { SubjectNamesArray } from "./subjectnames";

export type CategoryInfo = {
  label: string;
  color: string;
  icon: LucideIcon;
};

export const forumCategories = [
  "school-related",
  "non-school-related",
  "announcement",
] as const;
export type ForumCategory = (typeof forumCategories)[number];

export const userForumCategories = [
  "school-related",
  "non-school-related",
] as const satisfies readonly ForumCategory[];
export const forumCategorySchema = z.enum(forumCategories);
export const defaultForumCategory: ForumCategory = "school-related";

export function getAvailableForumCategories(
  isAdmin: boolean,
): readonly ForumCategory[] {
  return isAdmin ? forumCategories : userForumCategories;
}

export function forumCategoryRequiresSubject(category: ForumCategory): boolean {
  return category === "school-related";
}

export const forumCategoryInfo = {
  "school-related": {
    label: "forum.categories.schoolRelated",
    color: "#3b82f6",
    icon: GraduationCap,
  },
  "non-school-related": {
    label: "forum.categories.nonSchoolRelated",
    color: "#16a34a",
    icon: Globe,
  },
  announcement: {
    label: "forum.categories.announcement",
    color: "#ef4444",
    icon: Megaphone,
  },
} satisfies Record<ForumCategory, CategoryInfo>;

export function getCategoryInfo(category: ForumCategory): CategoryInfo {
  return forumCategoryInfo[category];
}

export const getPostsInputSchema = z.object({
  cursor: z.string().min(1).nullish(),
  limit: z.number().int().min(1).max(50).default(10),
  category: forumCategorySchema.optional(),
  subject: z.string().min(1).optional(),
  fromDate: z.date().optional(),
  toDate: z.date().optional(),
  authorId: z.string().min(1).optional(),
});

export type GetPostsInput = z.infer<typeof getPostsInputSchema>;

export const getMyRepliesInputSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(10),
  category: forumCategorySchema.optional(),
});

export type GetMyRepliesInput = z.infer<typeof getMyRepliesInputSchema>;

export const getPostInputSchema = z.object({
  postId: z.string().min(1),
});
export type GetPostInput = z.infer<typeof getPostInputSchema>;

export const createPostInputSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  subject: z.string().min(1).max(255).optional(),
  category: forumCategorySchema,
});

export type CreatePostInput = z.infer<typeof createPostInputSchema>;

export const createPostOutputSchema = z.object({
  id: z.string(),
});

export type CreatePostOutput = z.infer<typeof createPostOutputSchema>;

export const editPostInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  subject: z.enum(SubjectNamesArray).optional(),
  category: forumCategorySchema.optional(),
});

export type EditPostInput = z.infer<typeof editPostInputSchema>;

export const editPostOutputSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  content: z.string(),
  subject: z.string().nullable(),
  category: forumCategorySchema,
  updatedAt: z.date(),
});

export type EditPostOutput = z.infer<typeof editPostOutputSchema>;

export const deletePostInputSchema = z.object({
  id: z.string().min(1),
});
export type DeletePostInput = z.infer<typeof deletePostInputSchema>;

export const voteSchema = z.enum(["up", "down"]);
export type Vote = z.infer<typeof voteSchema>;

export const votersSchema = z.record(z.string().min(1), voteSchema);
export type Voters = z.infer<typeof votersSchema>;

export const voterProfileSchema = z.object({
  id: z.string(),
  displayUsername: z.string().nullable(),
  image: z.string().nullable(),
});

export type VoterProfile = z.infer<typeof voterProfileSchema>;

export async function hydrateVoters<T extends { voters: unknown }>(
  prisma: PrismaClient,
  posts: T[],
) {
  const voterIdsByPost = posts.map(({ voters }) =>
    Object.keys(votersSchema.parse(voters)),
  );
  const voterIds = [...new Set(voterIdsByPost.flat())];
  const profiles = voterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: voterIds } },
        select: { id: true, displayUsername: true, image: true },
      })
    : [];
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  return posts.map((post, index) => ({
    ...post,
    voterProfiles: (voterIdsByPost[index] ?? []).flatMap((id) => {
      const profile = profilesById.get(id);
      return profile ? [profile] : [];
    }),
  }));
}

export function calculateVoteTotals(voters: Voters) {
  const voteValues = Object.values(voters);
  const votes = voteValues.reduce(
    (total, currentVote) => total + (currentVote === "up" ? 1 : -1),
    0,
  );

  return {
    votes,
    cachedTotalVotes: voteValues.length,
  };
}

export const votePostInputSchema = z.object({
  postId: z.string().min(1),
  vote: voteSchema,
});

export type VotePostInput = z.infer<typeof votePostInputSchema>;

export const votePostOutputSchema = z.object({
  votes: z.number(),
  cachedTotalVotes: z.number(),
  voters: votersSchema,
  voterProfiles: z.array(voterProfileSchema),
});

export type VotePostOutput = z.infer<typeof votePostOutputSchema>;

export const replyToPostInputSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1),
});

export type ReplyToPostInput = z.infer<typeof replyToPostInputSchema>;

export const postAuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayUsername: z.string().nullable(),
  role: z.string(),
  image: z.string().nullable(),
});

export type PostAuthor = z.infer<typeof postAuthorSchema>;

export const postSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  content: z.string(),
  category: forumCategorySchema,
  subject: z.string().nullable(),
  replyToId: z.string().nullable().optional(),
  replyToTitle: z.string().nullable().optional(),
  pinned: z.boolean(),
  votes: z.number(),
  cachedTotalVotes: z.number(),
  voters: votersSchema,
  voterProfiles: z.array(voterProfileSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
  author: postAuthorSchema.nullable(),
});

export type Post = z.infer<typeof postSchema>;

export const getPostsOutputSchema = z.object({
  posts: z.array(postSchema),
  nextCursor: z.string().nullable(),
});

export type GetPostsOutput = z.infer<typeof getPostsOutputSchema>;

export const getPostRepliesInputSchema = z.object({
  postId: z.string().min(1),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export type GetPostRepliesInput = z.infer<typeof getPostRepliesInputSchema>;

export const getPostRepliesOutputSchema = z.object({
  replies: z.array(postSchema),
  nextCursor: z.string().nullable(),
});

export type GetPostRepliesOutput = z.infer<typeof getPostRepliesOutputSchema>;
