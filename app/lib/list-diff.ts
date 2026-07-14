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

import jsonpatch, { type Operation } from "fast-json-patch";
import z from "zod";
import { listSnapshot, type ListItem, type ListSnapshot } from "~/lib/list";

const jsonPointerSchema = z.string().trim().min(1).refine((value) => value.startsWith("/"), {
  message: "Path must start with /",
});

export const listPatchOperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add"),
    path: jsonPointerSchema,
    value: z.json(),
  }),
  z.object({
    op: z.literal("replace"),
    path: jsonPointerSchema,
    value: z.json(),
  }),
  z.object({
    op: z.literal("remove"),
    path: jsonPointerSchema,
  }),
]);

export const listDiffSchema = z.object({
  changes: z.array(listPatchOperationSchema),
});

export type ListDiff = z.infer<typeof listDiffSchema>;

export const pullRequestSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['open', 'closed', 'merged']),
})

export const branchRecordSchema = z.object({
  owner: z.string(),
  baseCommitId: z.string(),
  headCommitId: z.string(),
  parentBranch: z.string().optional(),
  isPR: z.boolean().optional(),
  PR: pullRequestSchema.optional(),
  cachedSnapshot: listSnapshot,
})

export const branchInfoSchema = branchRecordSchema.pick({
  owner: true,
  baseCommitId: true,
  headCommitId: true,
  parentBranch: true,
  isPR: true,
  PR: true,
}).extend({
  name: z.string(),
})

export const branch = z.record(z.string(), branchRecordSchema)

export const diff = z.object({
  changes: listDiffSchema.shape.changes.min(1),
})

export type Diff = ListDiff

export const versionCommitSchema = z.object({
  parentId: z.string().nullish(),
  author: z.string(),
  message: z.string(),
  createdAt: z.string(),
  diff,
})

export const commitHistoryEntrySchema = versionCommitSchema.extend({
  id: z.string(),
})

export const versionData = z.object({
  branches: branch,
  commits: z.record(z.string(), versionCommitSchema),
})

export type VersionCommit = z.infer<typeof versionCommitSchema>
export type VersionData = z.infer<typeof versionData>
export type BranchRecord = z.infer<typeof branchRecordSchema>

export function snapshotFromEditableItems(items: ListItem[]): ListSnapshot {
  return items.filter((item) => !(item.question.trim() === "" && item.answer.trim() === ""));
}

export function buildListDiff(beforeSnapshot: ListSnapshot, afterSnapshot: ListSnapshot): ListDiff {
  return listDiffSchema.parse({
    changes: jsonpatch.compare(beforeSnapshot, afterSnapshot),
  });
}

export function applyListDiffToSnapshot(snapshot: ListSnapshot, listDiff: ListDiff): ListSnapshot {
  const result = jsonpatch.applyPatch(structuredClone(snapshot), listDiff.changes as Operation[]);

  return snapshotFromEditableItems(listSnapshot.parse(result.newDocument));
}
