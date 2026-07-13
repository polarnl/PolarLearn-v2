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

import { forumCategorySchema, postAuthorSchema, postSchema } from "~/lib/forum";
import {
  listResultSchema,
  listResultUserSchema,
  type ListResult,
  type ListResultUser,
} from "~/lib/list";

export const searchPageInputSchema = z.object({
  q: z.string().trim().min(1),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export type SearchPageInput = z.infer<typeof searchPageInputSchema>;

export const searchUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayUsername: z.string().nullable(),
  username: z.string().nullable(),
  image: z.string().nullable(),
  role: z.string().nullable(),
  createdAt: z.date(),
});

export type SearchUser = z.infer<typeof searchUserSchema>;

export const searchUsersOutputSchema = z.object({
  users: z.array(searchUserSchema),
  nextCursor: z.string().nullable(),
});

export type SearchUsersOutput = z.infer<typeof searchUsersOutputSchema>;

// Aliases for backward compatibility -- canonical schemas live in ~/lib/list
export const searchListUserSchema = listResultUserSchema;
export type SearchListUser = ListResultUser;
export const searchListSchema = listResultSchema;
export type SearchList = ListResult;

export const searchListsOutputSchema = z.object({
  lists: z.array(listResultSchema),
  nextCursor: z.string().nullable(),
});

export type SearchListsOutput = z.infer<typeof searchListsOutputSchema>;

export const searchGroupMemberSchema = z.object({
  id: z.string(),
});

export type SearchGroupMember = z.infer<typeof searchGroupMemberSchema>;

export const searchGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  members: z.array(searchGroupMemberSchema),
});

export type SearchGroup = z.infer<typeof searchGroupSchema>;

export const searchGroupsOutputSchema = z.object({
  groups: z.array(searchGroupSchema),
  nextCursor: z.string().nullable(),
});

export type SearchGroupsOutput = z.infer<typeof searchGroupsOutputSchema>;

export const searchForumPostSchema = postSchema
  .omit({
    replyToId: true,
    replyToTitle: true,
    votes: true,
    cachedTotalVotes: true,
    voters: true,
    voterProfiles: true,
    updatedAt: true,
  })
  .extend({
    author: postAuthorSchema.omit({ id: true, role: true }).nullable(),
  });

export type SearchForumPost = z.infer<typeof searchForumPostSchema>;

export const searchForumOutputSchema = z.object({
  posts: z.array(searchForumPostSchema),
  nextCursor: z.string().nullable(),
});
export type SearchForumOutput = z.infer<typeof searchForumOutputSchema>;

export const searchForumInputSchema = searchPageInputSchema;
export const searchListsInputSchema = searchPageInputSchema;
export const searchGroupsInputSchema = searchPageInputSchema;
export const searchUsersInputSchema = searchPageInputSchema;

export const searchForumCategorySchema = forumCategorySchema;
