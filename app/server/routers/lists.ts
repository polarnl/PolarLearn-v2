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
import { createTRPCRouter, protectedProcedure } from "../trpc";
import crypto from "crypto";
import { logger as appLogger } from "~/lib/logger";
import { SubjectNamesArray } from "~/lib/subjectnames";
import {
  extractRecentItems,
  listSnapshot,
  type ListItem,
  type ListSnapshot,
} from "~/lib/list";
import {
  applyListDiffToSnapshot,
  branchInfoSchema,
  buildListDiff,
  commitHistoryEntrySchema,
  diff,
  listPatchOperationSchema,
  snapshotFromEditableItems,
  type BranchRecord,
  type Diff,
  type VersionCommit,
  type VersionData,
} from "~/lib/list-diff";
import { TRPCError } from "@trpc/server";
import { t } from "~/i18n";
import { listDataSchema } from "~/lib/viewlist";

export { listPatchOperationSchema };

const listIdInput = z.object({ id: z.string() })
const listBranchQueryInput = z.object({ listId: z.string(), branch: z.string().optional() })
const listBranchMutationInput = z.object({ id: z.string(), branch: z.string() })

function generateCommitHash(diff: Diff): string {
  return crypto.createHash("sha256")
    .update(JSON.stringify(diff) +
      crypto.randomBytes(32).toString("hex")
      /* random data so hash is unique, no conflicts */)
    .digest("hex");
}

const listRecordSchema = listDataSchema.loose()

type ListRecord = z.infer<typeof listRecordSchema>

const listRecordInclude = {
  collaborators: {
    select: { id: true, name: true, displayUsername: true, username: true },
  },
  favoritedBy: {
    select: { id: true },
  },
} as const

function areListItemsEqual(left: ListItem, right: ListItem): boolean {
  return left.id === right.id
    && left.question === right.question
    && left.answer === right.answer
}

function hasBranchAccess(list: ListRecord, branch: BranchRecord, userId: string): boolean {
  return list.userId === userId
    || list.collaborators.some((collaborator) => collaborator.id === userId)
    || branch.owner === userId
}

function getBranch(versioning: VersionData, branchName: string): BranchRecord {
  const selectedBranch = versioning.branches[branchName]

  if (!(branchName in versioning.branches)) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: t('lists.branches.notFound', { branchName }),
    })
  }

  return selectedBranch
}

function mergeSnapshots(base: ListSnapshot, main: ListSnapshot, branch: ListSnapshot): ListSnapshot {
  const baseById = new Map(base.map((item) => [item.id, item]))
  const mainById = new Map(main.map((item) => [item.id, item]))
  const branchById = new Map(branch.map((item) => [item.id, item]))
  const mergedById = new Map<string, ListItem>()

  const allItemIds = new Set([
    ...baseById.keys(),
    ...mainById.keys(),
    ...branchById.keys(),
  ])

  for (const itemId of allItemIds) {
    const baseItem = baseById.get(itemId)
    const mainItem = mainById.get(itemId)
    const branchItem = branchById.get(itemId)

    if (!baseItem) {
      if (mainItem && branchItem) {
        if (!areListItemsEqual(mainItem, branchItem)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: t('lists.merge.conflictBothCreatedDifferently', { itemId }),
          })
        }

        mergedById.set(itemId, structuredClone(mainItem))
        continue
      }

      if (mainItem) {
        mergedById.set(itemId, structuredClone(mainItem))
        continue
      }

      if (branchItem) {
        mergedById.set(itemId, structuredClone(branchItem))
      }

      continue
    }

    if (!mainItem && !branchItem) {
      continue
    }

    if (!mainItem && branchItem) {
      if (areListItemsEqual(branchItem, baseItem)) {
        continue
      }

      throw new TRPCError({
        code: 'CONFLICT',
        message: t('lists.merge.conflictMainDeletedBranchChanged', { itemId }),
      })
    }

    if (mainItem && !branchItem) {
      if (areListItemsEqual(mainItem, baseItem)) {
        continue
      }

      throw new TRPCError({
        code: 'CONFLICT',
        message: t('lists.merge.conflictBranchDeletedMainChanged', { itemId }),
      })
    }

    const resolvedMainItem = mainItem as ListItem
    const resolvedBranchItem = branchItem as ListItem

    if (areListItemsEqual(resolvedMainItem, resolvedBranchItem)) {
      mergedById.set(itemId, structuredClone(resolvedMainItem))
      continue
    }

    const mainChanged = !areListItemsEqual(resolvedMainItem, baseItem)
    const branchChanged = !areListItemsEqual(resolvedBranchItem, baseItem)

    if (!mainChanged && !branchChanged) {
      mergedById.set(itemId, structuredClone(baseItem))
      continue
    }

    if (!mainChanged) {
      mergedById.set(itemId, structuredClone(resolvedBranchItem))
      continue
    }

    if (!branchChanged) {
      mergedById.set(itemId, structuredClone(resolvedMainItem))
      continue
    }

    const mergedItem = structuredClone(baseItem)

    for (const field of ['question', 'answer'] as const) {
      const baseValue = baseItem[field]
      const mainValue = resolvedMainItem[field]
      const branchValue = resolvedBranchItem[field]

      if (Object.is(mainValue, branchValue)) {
        mergedItem[field] = mainValue
        continue
      }

      const mainChanged = !Object.is(mainValue, baseValue)
      const branchChanged = !Object.is(branchValue, baseValue)

      if (mainChanged && branchChanged) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: t('lists.merge.conflictBothChangedField', { itemId: baseItem.id, field }),
        })
      }

      if (mainChanged) {
        mergedItem[field] = mainValue
        continue
      }

      if (branchChanged) {
        mergedItem[field] = branchValue
        continue
      }

      mergedItem[field] = baseValue
    }

    mergedById.set(itemId, mergedItem)
  }

  const mergedSnapshot: ListSnapshot = []
  const addedItemIds = new Set<string>()

  const pushIfMerged = (item: ListItem | undefined) => {
    if (!item || addedItemIds.has(item.id)) {
      return
    }

    const mergedItem = mergedById.get(item.id)

    if (!mergedItem) {
      return
    }

    mergedSnapshot.push(structuredClone(mergedItem))
    addedItemIds.add(item.id)
  }

  for (const item of main) {
    pushIfMerged(item)
  }

  for (const item of branch) {
    pushIfMerged(item)
  }

  return mergedSnapshot
}

function applyListDiff(snapshot: ListSnapshot, listDiff: Diff): ListSnapshot {
  try {
    return applyListDiffToSnapshot(snapshot, listDiff);
  } catch {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: t('lists.diff.cannotApply'),
    })
  }
}

export const ListRouter = createTRPCRouter({
  getLatestListData: protectedProcedure
    .input(listBranchQueryInput)
    .query(async ({ ctx, input }) => {
      const rawList = await ctx.prisma.list.findFirst({
        where: {
          id: input.listId,
        },
        select: {
          id: true,
          name: true,
          description: true,
          subject: true,
          userId: true,
          items: true,
          versionData: true,
          createdAt: true,
          updatedAt: true,
          verified: true,
          user: {
            select: { id: true, name: true, displayUsername: true, username: true },
          },
          collaborators: {
            select: { id: true, name: true, displayUsername: true, username: true },
          },
          favoritedBy: { select: { id: true } },
        },
      })

      if (!rawList) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const list = listRecordSchema.parse(rawList)

      const versioning = list.versionData
      const resolvedBranchName = input.branch ?? 'main'
      const selectedBranch = versioning.branches[resolvedBranchName]

      if (!(resolvedBranchName in versioning.branches)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
        })
      }

      try {
        const user = await ctx.prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { recentItems: true },
        })

        const { recent_lists: existingRecentLists, recent_subjects: existingRecentSubjects } = extractRecentItems(user?.recentItems)

        if (existingRecentLists[0]?.id !== list.id || existingRecentSubjects[0] !== list.subject) {
          await ctx.prisma.user.update({
            where: { id: ctx.user.id },
            data: {
              recentItems: {
                recent_subjects: [list.subject, ...existingRecentSubjects.filter((subject) => subject !== list.subject)],
                recent_lists: [{ id: list.id, updatedAt: new Date().toISOString() }, ...existingRecentLists.filter((item) => item.id !== list.id)],
              },
            },
          })
        }
      } catch { }

      return {
        ...list,
        items: structuredClone(selectedBranch.cachedSnapshot),
      }
    }),
  getBranchHistory: protectedProcedure
    .input(listBranchQueryInput)
    .query(async ({ ctx, input }) => {
      const rawList = await ctx.prisma.list.findFirst({
        where: {
          id: input.listId,
        },
        include: listRecordInclude,
      })

      if (!rawList) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const list = listRecordSchema.parse(rawList)

      if (!(list.userId === ctx.user.id || list.collaborators.some((collaborator) => collaborator.id === ctx.user.id))) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      const versioning = list.versionData
      const resolvedBranchName = input.branch ?? 'main'
      const selectedBranch = versioning.branches[resolvedBranchName]

      if (!(resolvedBranchName in versioning.branches)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: t('lists.branches.notFound', { branchName: resolvedBranchName }),
        })
      }
      const history: (VersionCommit & { id: string })[] = []

      let currentCommitId: string | null | undefined = selectedBranch.headCommitId

      while (currentCommitId) {
        const commit: VersionCommit | undefined = versioning.commits[currentCommitId]

        if (!(currentCommitId in versioning.commits)) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: t('lists.commits.notFound', { commitId: currentCommitId }),
          })
        }

        history.push(commitHistoryEntrySchema.parse({
          id: currentCommitId,
          parentId: commit.parentId,
          author: commit.author,
          message: commit.message,
          createdAt: commit.createdAt,
          diff: commit.diff,
        }))

        currentCommitId = commit.parentId ?? undefined
      }

      return {
        list: {
          ...list,
          items: structuredClone(selectedBranch.cachedSnapshot),
        },
        branch: branchInfoSchema.parse({
          name: resolvedBranchName,
          owner: selectedBranch.owner,
          baseCommitId: selectedBranch.baseCommitId,
          headCommitId: selectedBranch.headCommitId,
          parentBranch: selectedBranch.parentBranch,
          isPR: selectedBranch.isPR,
          PR: selectedBranch.PR,
        }),
        history: history.reverse(),
      }
    }),
  getRecentItems: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { recentItems: true },
      })

      const { recent_lists: lists, recent_subjects: recentSubjects } = extractRecentItems(user?.recentItems)

      const recentListsSlice = lists.slice(0, 20)

      const seen = new Set<string>()
      const deduped = recentListsSlice.filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })

      const rawLists = await ctx.prisma.list.findMany({
        where: {
          id: {
            in: deduped.map((item) => item.id),
          },
        },
        select: {
          id: true,
          name: true,
          subject: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              displayUsername: true,
              username: true,
            },
          },
        },
      })

      const rawListsById = new Map(rawLists.map((list) => [list.id, list]))
      const hydratedLists = deduped.map((item) => {
        return rawListsById.get(item.id) ?? null
      })

      const missingListIds = new Set(
        deduped
          .filter((item) => !rawListsById.has(item.id))
          .map((item) => item.id),
      )

      if (missingListIds.size > 0) {
        await ctx.prisma.user.update({
          where: { id: ctx.user.id },
          data: {
            recentItems: {
              recent_subjects: recentSubjects,
              recent_lists: lists.filter((item) => !missingListIds.has(item.id)),
            },
          },
        })
      }

      const seenSubjects = new Set<string>()
      const dedupedSubjects = [...recentSubjects].slice(0, 10).reverse().filter((subject) => {
        if (seenSubjects.has(subject)) return false
        seenSubjects.add(subject)
        return true
      })

      return {
        recent_lists: hydratedLists.filter((list): list is NonNullable<typeof list> => Boolean(list)),
        recent_subjects: dedupedSubjects,
      }
    }),
  getRecentLists: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { recentItems: true },
      })

      const { recent_lists: lists, recent_subjects: recentSubjects } = extractRecentItems(user?.recentItems)

      const recentListsSlice = lists.slice(0, 20)

      const seen = new Set<string>()
      const deduped = recentListsSlice.filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })

      const rawLists = await ctx.prisma.list.findMany({
        where: {
          id: {
            in: deduped.map((item) => item.id),
          },
        },
        include: {
          user: {
            select: { id: true, name: true, displayUsername: true, username: true },
          },
          ...listRecordInclude,
        },
      })

      const rawListsById = new Map(rawLists.map((list) => [list.id, list]))
      const hydratedLists = deduped.map((item) => {
        const rawList = rawListsById.get(item.id)

        return rawList ? listRecordSchema.parse(rawList) : null
      })

      const missingListIds = new Set(
        deduped
          .filter((item) => !rawListsById.has(item.id))
          .map((item) => item.id),
      )

      if (missingListIds.size > 0) {
        await ctx.prisma.user.update({
          where: { id: ctx.user.id },
          data: {
            recentItems: {
              recent_subjects: recentSubjects,
              recent_lists: lists.filter((item) => !missingListIds.has(item.id)),
            },
          },
        })
      }

      return hydratedLists.filter((list): list is NonNullable<typeof list> => Boolean(list))
    }),
  rmListFromRecent: protectedProcedure
    .input(z.object({
      listId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { recentItems: true },
      })

      const { recent_lists: existingRecentLists, recent_subjects: existingRecentSubjects } = extractRecentItems(user?.recentItems)

      const newRecentLists = existingRecentLists.filter((list) => list.id !== input.listId)

      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          recentItems: {
            recent_subjects: existingRecentSubjects,
            recent_lists: newRecentLists,
          },
        },
      })
      appLogger.info({
        event: "list.recent_item_removed",
        userId: ctx.user.id,
        listId: input.listId,
      })
      return 'OK'
    }),
  deleteList: protectedProcedure
    .input(listIdInput)
    .mutation(async ({ ctx, input }) => {
      const rawList = await ctx.prisma.list.findFirst({
        where: {
          id: input.id,
        },
        select: {
          userId: true,
        },
      })

      if (!rawList) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      if (rawList.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      await ctx.prisma.list.delete({
        where: {
          id: input.id,
        },
      })

      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { recentItems: true },
      })

      const { recent_lists: existingRecentLists, recent_subjects: existingRecentSubjects } = extractRecentItems(user?.recentItems)

      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          recentItems: {
            recent_subjects: existingRecentSubjects,
            recent_lists: existingRecentLists.filter((list) => list.id !== input.id),
          },
        },
      })

      appLogger.info({
        event: "list.deleted",
        userId: ctx.user.id,
        listId: input.id,
      })

      return 'OK'
    }),
  commitToList: protectedProcedure
    .input(z.object({
      id: z.string(),
      commitMessage: z.string(),
      baseCommitId: z.string(),
      diff,
      branch: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const rawList = await ctx.prisma.list.findFirst({
        where: {
          id: input.id,
        },
        include: listRecordInclude,
      })
      if (!rawList) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const list = listRecordSchema.parse(rawList)

      const versioning = list.versionData
      const currentBranch = getBranch(versioning, input.branch)

      if (!hasBranchAccess(list, currentBranch, ctx.user.id)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      const headCommitId = currentBranch.headCommitId

      if (!headCommitId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
        })
      }

      if (headCommitId !== input.baseCommitId) {
        throw new TRPCError({
          code: 'CONFLICT',
        })
      }


      if (!(headCommitId in versioning.commits)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
        })
      }

      const branchSnapshot = snapshotFromEditableItems(currentBranch.cachedSnapshot)
      const nextSnapshot = applyListDiff(branchSnapshot, input.diff)
      const sanitizedDiff = buildListDiff(branchSnapshot, nextSnapshot)

      if (sanitizedDiff.changes.length === 0 && JSON.stringify(branchSnapshot) === JSON.stringify(nextSnapshot)) {
        return 'OK'
      }

      const commitDiff = diff.parse(sanitizedDiff.changes.length > 0 ? sanitizedDiff : input.diff)
      const newCommitId = generateCommitHash(commitDiff)

      const updatedItems = !currentBranch.parentBranch ? structuredClone(nextSnapshot) : list.items
      const newHistory = {
        ...versioning,
        branches: {
          ...versioning.branches,
          [input.branch]: {
            ...currentBranch,
            headCommitId: newCommitId,
            cachedSnapshot: nextSnapshot,
          }
        },
        commits: {
          ...versioning.commits,
          [newCommitId]: {
            parentId: headCommitId,
            author: ctx.user.id,
            message: input.commitMessage,
            createdAt: new Date().toISOString(),
            diff: commitDiff
          }
        }
      }

      await ctx.prisma.list.update({
        where: {
          id: input.id,
        },
        data: {
          versionData: newHistory,
          items: updatedItems,
        }
      })
      
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { recentItems: true },
      })

      const { recent_lists: existingRecentLists, recent_subjects: existingRecentSubjects } = extractRecentItems(user?.recentItems)

      const newRecentLists = [{ id: list.id, updatedAt: new Date().toISOString() }, ...existingRecentLists.filter((item) => item.id !== list.id)]

      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          recentItems: {
            recent_subjects: [...existingRecentSubjects, list.subject],
            recent_lists: newRecentLists,
          },
        },
      })
      appLogger.info({
        event: "list.commit.created",
        userId: ctx.user.id,
        listId: input.id,
        branch: input.branch,
        baseCommitId: input.baseCommitId,
        commitId: newCommitId,
        commitMessage: input.commitMessage,
        diffChangeCount: commitDiff.changes.length,
      })
      return 'OK'
    }),
  createBranch: protectedProcedure
    .input(z.object({
      id: z.string(),
      newBranchName: z.string(),
      baseBranchName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const rawList = await ctx.prisma.list.findFirst({
        where: {
          id: input.id,
        },
        include: listRecordInclude,
      })
      if (!rawList) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const list = listRecordSchema.parse(rawList)

      const versioning = list.versionData
      const baseBranch = getBranch(versioning, input.baseBranchName)

      // PS: no auth checks, anyone should be able to create a pr / suggest new items

      if (input.newBranchName in versioning.branches) {
        throw new TRPCError({
          code: 'CONFLICT',
        })
      }

      const newHistory = {
        ...versioning,
        branches: {
          ...versioning.branches,
          [input.newBranchName]: {
            baseCommitId: baseBranch.headCommitId,
            headCommitId: baseBranch.headCommitId,
            parentBranch: input.baseBranchName,
            isPR: false,
            cachedSnapshot: structuredClone(baseBranch.cachedSnapshot),
            owner: ctx.user.id,
          }
        }
      }

      await ctx.prisma.list.update({
        where: {
          id: input.id,
        },
        data: {
          versionData: newHistory,
        }
      })
      appLogger.info({
        event: "list.branch.created",
        userId: ctx.user.id,
        listId: input.id,
        branch: input.newBranchName,
        baseBranch: input.baseBranchName,
      })
      return 'OK'
    }),
  createList: protectedProcedure
    .input(z.object({
      name: z.string(),
      subject: z.enum(SubjectNamesArray),
    }))
    .mutation(async ({ ctx, input }) => {
      const diff = {
        changes: [
          {
            op: 'add',
            path: '/0',
            value: {
              id: crypto.randomUUID(),
              question: '',
              answer: '',
            }
          },
          {
            op: 'remove',
            path: '/0',
          }
        ],
      } as Diff
      const initialItems = applyListDiff([], diff)
      const initialCommitId = generateCommitHash(diff)
      const newList = await ctx.prisma.list.create({
        data: {
          id: crypto.randomUUID(),
          name: input.name,
          subject: input.subject,
          userId: ctx.user.id,
          items: structuredClone(initialItems),
          versionData: {
            branches: {
              main: {
                owner: ctx.user.id,
                baseCommitId: initialCommitId,
                headCommitId: initialCommitId,
                isPR: false,
                cachedSnapshot: structuredClone(initialItems),
              }
            },
            commits: {
              [initialCommitId]: {
                parentId: null,
                author: ctx.user.id,
                message: t('lists.commits.initial'),
                createdAt: new Date().toISOString(),
                diff: diff
              }
            }
          },
          collaborators: {
            connect: { id: ctx.user.id }
          }
        },
        include: listRecordInclude,
      })

      const parsedList = listRecordSchema.parse(newList)

      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { recentItems: true },
      })

      const { recent_lists: existingRecentLists, recent_subjects: existingRecentSubjects } = extractRecentItems(user?.recentItems)

      const newRecentLists = [{ id: parsedList.id, updatedAt: new Date().toISOString() }, ...existingRecentLists.filter((item) => item.id !== parsedList.id)]

      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          recentItems: {
            recent_subjects: [...existingRecentSubjects, parsedList.subject],
            recent_lists: newRecentLists,
          },
        },
      })
      appLogger.info({
        event: "list.created",
        userId: ctx.user.id,
        listId: parsedList.id,
        name: parsedList.name,
        subject: parsedList.subject,
      })
      return parsedList
    }),
  createPullRequest: protectedProcedure
    .input(z.object({
      id: z.string(),
      branch: z.string(),
      title: z.string(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const rawList = await ctx.prisma.list.findFirst({
        where: {
          id: input.id,
        },
        include: listRecordInclude,
      })
      if (!rawList) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const list = listRecordSchema.parse(rawList)

      const versioning = list.versionData
      const currentBranch = getBranch(versioning, input.branch)

      if (currentBranch.parentBranch !== 'main') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: t('lists.branches.prOnlyFromMain'),
        })
      }

      if (!hasBranchAccess(list, currentBranch, ctx.user.id)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      if (currentBranch.PR?.status === 'open' || currentBranch.isPR) {
        throw new TRPCError({
          code: 'CONFLICT',
        })
      }

      const newHistory = {
        ...versioning,
        branches: {
          ...versioning.branches,
          [input.branch]: {
            ...currentBranch,
            isPR: true,
            PR: {
              title: input.title,
              description: input.description,
              status: 'open' as const,
            },
          }
        }
      }

      await ctx.prisma.list.update({
        where: {
          id: input.id,
        },
        data: {
          versionData: newHistory,
        }
      })
      appLogger.info({
        event: "list.pull_request.opened",
        userId: ctx.user.id,
        listId: input.id,
        branch: input.branch,
        title: input.title,
      })
      return 'OK'
    }),
  closePullRequest: protectedProcedure
    .input(listBranchMutationInput)
    .mutation(async ({ ctx, input }) => {
      const rawList = await ctx.prisma.list.findFirst({
        where: {
          id: input.id,
        },
        include: listRecordInclude,
      })
      if (!rawList) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const list = listRecordSchema.parse(rawList)

      const versioning = list.versionData
      const currentBranch = getBranch(versioning, input.branch)

      if (currentBranch.parentBranch !== 'main') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: t('lists.branches.prCloseOnlyFromMain'),
        })
      }

      if (!hasBranchAccess(list, currentBranch, ctx.user.id)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      if (currentBranch.PR?.status !== 'open') {
        throw new TRPCError({
          code: 'CONFLICT',
        })
      }

      const newHistory = {
        ...versioning,
        branches: {
          ...versioning.branches,
          [input.branch]: {
            ...currentBranch,
            isPR: true,
            PR: {
              ...currentBranch.PR,
              status: 'closed' as const,
            },
          }
        }
      }

      await ctx.prisma.list.update({
        where: {
          id: input.id,
        },
        data: {
          versionData: newHistory,
        }
      })
      appLogger.info({
        event: "list.pull_request.closed",
        userId: ctx.user.id,
        listId: input.id,
        branch: input.branch,
      })
      return 'OK'
    }),
  reopenPullRequest: protectedProcedure
    .input(listBranchMutationInput)
    .mutation(async ({ ctx, input }) => {
      const rawList = await ctx.prisma.list.findFirst({
        where: {
          id: input.id,
        },
        include: listRecordInclude,
      })
      if (!rawList) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const list = listRecordSchema.parse(rawList)

      const versioning = list.versionData
      const currentBranch = getBranch(versioning, input.branch)

      if (!hasBranchAccess(list, currentBranch, ctx.user.id)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      if (currentBranch.parentBranch !== 'main') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: t('lists.branches.prReopenOnlyFromMain'),
        })
      }

      if (currentBranch.PR?.status !== 'closed') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: t('lists.branches.prReopenRequiresClosed'),
        })
      }

      const newHistory = {
        ...versioning,
        branches: {
          ...versioning.branches,
          [input.branch]: {
            ...currentBranch,
            isPR: true,
            PR: {
              ...currentBranch.PR,
              status: 'open' as const,
            },
          }
        }
      }

      await ctx.prisma.list.update({
        where: {
          id: input.id,
        },
        data: {
          versionData: newHistory,
        }
      })
      appLogger.info({
        event: "list.pull_request.reopened",
        userId: ctx.user.id,
        listId: input.id,
        branch: input.branch,
      })
      return 'OK'
    }),
  mergePullRequest: protectedProcedure
    .input(listBranchMutationInput)
    .mutation(async ({ ctx, input }) => {
      const rawList = await ctx.prisma.list.findFirst({
        where: {
          id: input.id,
        },
        include: listRecordInclude,
      })
      if (!rawList) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const list = listRecordSchema.parse(rawList)

      if (list.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      const versioning = list.versionData
      const currentBranch = getBranch(versioning, input.branch)
      const mainBranch = getBranch(versioning, 'main')

      if (input.branch === 'main') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: t('lists.branches.cannotMergeMainIntoItself'),
        })
      }

      if (currentBranch.parentBranch !== 'main') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: t('lists.branches.onlyMainClonesCanMerge'),
        })
      }

      if (currentBranch.PR?.status !== 'open') {
        throw new TRPCError({
          code: 'CONFLICT',
        })
      }

      const commitsInOrder: VersionCommit[] = []
      let currentCommitId: string | null | undefined = currentBranch.baseCommitId

      while (currentCommitId) {
        const commit: VersionCommit | undefined = versioning.commits[currentCommitId]

        if (!(currentCommitId in versioning.commits)) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: t('lists.commits.notFound', { commitId: currentCommitId }),
          })
        }

        commitsInOrder.push(commit)
        currentCommitId = commit.parentId ?? undefined
      }

      const baseSnapshot = commitsInOrder
        .reverse()
        .reduce<ListSnapshot>((snapshot, commit) => applyListDiff(snapshot, commit.diff), [])
      const mainSnapshot = structuredClone(mainBranch.cachedSnapshot)
      const branchSnapshot = structuredClone(currentBranch.cachedSnapshot)
      const mergedSnapshot = mergeSnapshots(baseSnapshot, mainSnapshot, branchSnapshot)
      const shouldCreateMergeCommit = JSON.stringify(mainSnapshot) !== JSON.stringify(mergedSnapshot)

      const mergeDiff = shouldCreateMergeCommit
        ? (() => {
          const changes: z.infer<typeof listPatchOperationSchema>[] = []

          for (let index = mainSnapshot.length - 1; index >= 0; index -= 1) {
            changes.push({
              op: 'remove',
              path: `/${index.toString()}`,
            })
          }

          for (let index = 0; index < mergedSnapshot.length; index += 1) {
            changes.push({
              op: 'add',
              path: `/${index.toString()}`,
              value: structuredClone(mergedSnapshot[index]),
            })
          }

          return diff.parse({ changes })
        })()
        : null

      const mergeCommitId = mergeDiff
        ? generateCommitHash(mergeDiff)
        : null

      const newHistory = {
        ...versioning,
        branches: {
          ...versioning.branches,
          main: shouldCreateMergeCommit && mergeCommitId
            ? {
              ...mainBranch,
              headCommitId: mergeCommitId,
              cachedSnapshot: mergedSnapshot,
            }
            : {
              ...mainBranch,
              cachedSnapshot: mergedSnapshot,
            },
          [input.branch]: {
            ...currentBranch,
            isPR: true,
            PR: {
              ...currentBranch.PR,
              status: 'merged' as const,
            },
          },
        },
        commits: mergeDiff && mergeCommitId
          ? {
            ...versioning.commits,
            [mergeCommitId]: {
              parentId: mainBranch.headCommitId,
              author: ctx.user.id,
              message: t('lists.commits.merge', { branch: input.branch }),
              createdAt: new Date().toISOString(),
              diff: mergeDiff,
            },
          }
          : versioning.commits,
      }

      await ctx.prisma.list.update({
        where: {
          id: input.id,
        },
        data: {
          versionData: newHistory,
          items: mergedSnapshot,
        }
      })

      // Sessions must be cleared after a merge which changes the list items,
      // otherwise clients may resume an invalid session state.
      await ctx.prisma.learnSession.deleteMany({
        where: { listId: input.id },
      })
      appLogger.info({
        event: "list.pull_request.merged",
        userId: ctx.user.id,
        listId: input.id,
        branch: input.branch,
        mergeCommitCreated: Boolean(mergeCommitId),
      })
      return 'OK'
    }),
  updateListMeta: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      subject: z.enum(SubjectNamesArray).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.name && !input.description && !input.subject) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
        })
      }
      const rawList = await ctx.prisma.list.findFirst({
        where: {
          id: input.id,
        },
        include: listRecordInclude,
      })
      if (!rawList) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const list = listRecordSchema.parse(rawList)

      if (list.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      const updatedList = await ctx.prisma.list.update({
        where: {
          id: input.id,
        },
        include: listRecordInclude,
        data: {
          name: input.name ?? list.name,
          description: input.description ?? list.description,
          subject: input.subject ?? list.subject,
        }
      })
      appLogger.info({
        event: "list.meta.updated",
        userId: ctx.user.id,
        listId: input.id,
        changedFields: {
          name: input.name !== undefined,
          description: input.description !== undefined,
          subject: input.subject !== undefined,
        },
      })
      return listRecordSchema.parse(updatedList)
    }),
  starList: protectedProcedure
    .input(listIdInput)
    .mutation(async ({ ctx, input }) => {
      const rawList = await ctx.prisma.list.findFirst({
        where: {
          id: input.id,
        },
        include: {
          favoritedBy: {
            select: { id: true },
          },
        }
      })
      if (!rawList) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }
      const hasFavorited = rawList.favoritedBy.some((user) => user.id === ctx.user.id)

      await ctx.prisma.list.update({
        where: {
          id: input.id,
        },
        data: {
          favoritedBy: {
            [hasFavorited ? 'disconnect' : 'connect']: { id: ctx.user.id },
          },
        }
      })
      appLogger.info({
        event: "list.star.toggled",
        userId: ctx.user.id,
        listId: input.id,
        starred: !hasFavorited,
      })
      return 'OK'
    }),
  toggleVerified: protectedProcedure
    .input(listIdInput)
    .mutation(async ({ ctx, input }) => {
      const rawList = await ctx.prisma.list.findFirst({
        where: {
          id: input.id,
        },
      })
      if (!rawList) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      const updatedList = await ctx.prisma.list.update({
        where: { 
          id: input.id,
        },
        data: {
          verified: !rawList.verified,
        }
      })
      appLogger.info({
        event: "list.verified.toggled",
        userId: ctx.user.id,
        listId: input.id,
        verified: updatedList.verified,
      })
    })
})
