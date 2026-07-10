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

import z from "zod";
import { SubjectNamesArray } from "./subjectnames";

export const listItem = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
});

export const listResultUserSchema = z.object({
  id: z.string(),
  displayUsername: z.string().nullable(),
  username: z.string().nullable(),
  name: z.string().nullable(),
});

export type ListResultUser = z.infer<typeof listResultUserSchema>;

export const listResultSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  subject: z.string().nullable(),
  updatedAt: z.date(),
  verified: z.boolean(),
  user: listResultUserSchema.nullable(),
});

export type ListResult = z.infer<typeof listResultSchema>;

export const listSnapshot = z.array(listItem);

export type ListItem = z.infer<typeof listItem>;
export type ListSnapshot = z.infer<typeof listSnapshot>;

export const RecentSubjectsSchema = z.array(z.enum(SubjectNamesArray))
export const RecentListsSchema = z.array(z.object({
  id: z.string(),
  // name: z.string(),
  // subject: z.enum(SubjectNamesArray).nullish(),
  // Will be fetched in the recent items method to avoid desync
  updatedAt: z.string(),
}))

export const RecentItemsSchema = z.object({
  recent_subjects: RecentSubjectsSchema,
  recent_lists: RecentListsSchema,
})

export type RecentItems = z.infer<typeof RecentItemsSchema>

export function extractRecentItems(recentItems: unknown): RecentItems {
  const defaultValue: RecentItems = { recent_subjects: [], recent_lists: [] }

  if (!recentItems || typeof recentItems !== 'object') {
    return defaultValue
  }

  const raw = recentItems as Record<string, unknown>
  const recentSubjects = RecentSubjectsSchema.safeParse(raw.recent_subjects).data ?? []
  const recentLists = RecentListsSchema.safeParse(raw.recent_lists).data ?? []

  return {
    recent_subjects: recentSubjects,
    recent_lists: recentLists,
  }
}