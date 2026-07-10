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
import { listSnapshot } from "~/lib/list";
import { SubjectNamesArray } from "~/lib/subjectnames";

export const listDataSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  subject: z.enum(SubjectNamesArray),
  items: listSnapshot,
  collaborators: z.array(z.object({
    id: z.string(),
    name: z.string().nullable().optional(),
    displayUsername: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
  })),
  verified: z.boolean(),
  favoritedBy: z.array(z.object({ id: z.string() })),
  versionData: z.record(z.string(), z.unknown()),
});

export type ListData = z.infer<typeof listDataSchema>;

export const loaderDataSchema = z.object({
  list: listDataSchema,
  collaborators: z.array(z.object({ name: z.string(), id: z.string() })),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  user_liked: z.boolean(),
});

export type LoaderData = z.infer<typeof loaderDataSchema>;
