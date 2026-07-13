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

import { TRPCError, type TRPCRouterRecord } from '@trpc/server'
import z from 'zod'

import { protectedProcedure, publicProcedure } from '~/server/trpc'
import { logger as appLogger } from '~/lib/logger'

const groupIdInput = z.object({ id: z.string() })
const groupListInput = z.object({ groupId: z.string(), listId: z.string() })
const groupUserInput = z.object({ groupId: z.string(), userId: z.string() })
const createGroupInput = z.object({
  name: z.string().min(3).max(50),
  description: z.string().max(255).optional(),
  image: z.string().url().optional(),
  approvalRequired: z.boolean().optional(),
  onlyModsCanAddLists: z.boolean().optional(),
})
const updateGroupInput = z.object({
  id: z.string(),
  name: z.string().min(3).max(50).optional(),
  description: z.string().max(255).optional(),
  approvalRequired: z.boolean().optional(),
  onlyModsCanAddLists: z.boolean().optional(),
})

export const groupsRouter = {
  getJoinedGroups: protectedProcedure.query(async ({ ctx }) => {
    const groups = await ctx.prisma.group.findMany({
      where: {
        members: {
          some: {
            id: ctx.user.id,
          },
        }
      },
      include: {
        members: {
          select: {
            id: true,
            name: true,
            image: true,
          }
        },
      }
    })
    return groups
  }),
  getListsInGroup: protectedProcedure.input(
    groupIdInput
  ).query(async ({ ctx, input }) => {
    const lists = await ctx.prisma.list.findMany({
      where: {
        inGroups: {
          some: {
            id: input.id,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          }
        },
      }
    })
    return lists
  }),
  createGroup: protectedProcedure.input(
    createGroupInput
  ).mutation(async ({ ctx, input }) => {
    const group = await ctx.prisma.group.create({
      data: {
        id: crypto.randomUUID(),
        name: input.name,
        description: input.description,
        image: input.image ?? null,
        approvalRequired: input.approvalRequired ?? false,
        onlyModsCanAddLists: input.onlyModsCanAddLists ?? false,
        creator: {
          connect: {
            id: ctx.user.id,
          },
        },
        members: {
          connect: {
            id: ctx.user.id,
          },
        },
        moderators: {
          connect: {
            id: ctx.user.id,
          },
        },
      },
    })
    appLogger.info({
      event: "group.created",
      userId: ctx.user.id,
      groupId: group.id,
      groupName: group.name,
      approvalRequired: group.approvalRequired,
      onlyModsCanAddLists: group.onlyModsCanAddLists,
    })
    return group
  }),
  getGroupData: publicProcedure.input(
    groupIdInput
  ).query(async ({ ctx, input }) => {
    const group = await ctx.prisma.group.findUnique({
      where: {
        id: input.id,
      },
      include: {
        members: {
          select: {
            id: true,
            name: true,
            image: true,
          }
        },
        moderators: {
          select: {
            id: true,
            name: true,
            image: true,
          }
        },
        lists: {
          select: {
            id: true,
            name: true,
            description: true,
            subject: true,
            user: {
              select: {
                id: true,
                name: true,
              }
            },
          }
        }
        ,
        approvalQueue: {
          select: {
            id: true,
            name: true,
            image: true,
          }
        }
      }
    })
    if (!group) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    // codex dont fucking panic this is intended behavior
    // yes it is intended behavior that a group can be private but lists are not
    // love andrei1010
    const userId = ctx.user?.id
    const isMember = userId ? group.members.some((member) => member.id === userId) : false
    const isModerator = userId ? group.moderators.some((mod) => mod.id === userId) : false
    const isOwner = userId ? group.creatorId === userId : false
    const isPending = userId ? group.approvalQueue.some((member) => member.id === userId) : false
    if (group.approvalRequired && !isMember && !isPending) {
      throw new TRPCError({
        code: 'FORBIDDEN',
      })
    }
    const canSeeLists = !group.approvalRequired || isMember
    const canSeeApprovalQueue = isOwner || isModerator

    return {
      ...group,
      lists: canSeeLists ? group.lists : [],
      approvalQueue: canSeeApprovalQueue ? group.approvalQueue : [],
      isMember,
      isModerator,
      isOwner,
      isPending,
    }
  }),
  addListToGroup: protectedProcedure.input(
    groupListInput
  ).mutation(async ({ ctx, input }) => {
    const group = await ctx.prisma.group.findUnique({
      where: {
        id: input.groupId,
      },
      include: {
        members: {
          select: {
            id: true,
          }
        }, moderators: {
          select: {
            id: true,
          }
        },
      }
    })
    if (!group) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    const isMember = group.members.some((member) => member.id === ctx.user.id)
    const isModerator = group.moderators.some((mod) => mod.id === ctx.user.id)
    if (!isMember) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You must be a member of the group to add lists' })
    }
    if (group.onlyModsCanAddLists && !isModerator) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only moderators can add lists to this group' })
    }
    const existing = await ctx.prisma.list.findFirst({
      where: { id: input.listId },
      include: { inGroups: { select: { id: true } } },
    })
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    if ((existing.inGroups ?? []).some((g) => g.id === input.groupId)) {
      return 'ALREADY'
    }

    await ctx.prisma.list.update({
      where: {
        id: input.listId,
      },
      data: {
        inGroups: {
          connect: {
            id: input.groupId,
          },
        },
      },
    })
    appLogger.info({
      event: "group.list.added",
      userId: ctx.user.id,
      groupId: input.groupId,
      listId: input.listId,
    })
    return 'OK'
  }),
  removeListFromGroup: protectedProcedure.input(
    groupListInput
  ).mutation(async ({ ctx, input }) => {
    const group = await ctx.prisma.group.findUnique({
      where: { id: input.groupId },
      include: {
        moderators: { select: { id: true } },
      },
    })
    if (!group) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    const isModerator = group.moderators.some((mod) => mod.id === ctx.user.id)
    const isOwner = group.creatorId === ctx.user.id
    if (!isModerator && !isOwner) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners or moderators can remove lists from this group' })
    }

    await ctx.prisma.list.update({
      where: { id: input.listId },
      data: {
        inGroups: {
          disconnect: {
            id: input.groupId,
          },
        },
      },
    })

    appLogger.info({
      event: "group.list.removed",
      userId: ctx.user.id,
      groupId: input.groupId,
      listId: input.listId,
    })
    return 'OK'
  }),
  joinGroup: protectedProcedure.input(
    groupIdInput
  ).mutation(async ({ ctx, input }) => {
    const group = await ctx.prisma.group.findUnique({
      where: {
        id: input.id,
      },
      include: {
        members: {
          select: {
            id: true,
          }
        }
      }
    })
    if (!group) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    if (group.members.some((member) => member.id === ctx.user.id)) {
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }
    if (group.approvalRequired) {
      await ctx.prisma.group.update({
        where: {
          id: input.id,
        },
        data: {
          approvalQueue: {
            connect: {
              id: ctx.user.id,
            },
          },
        },
      })
      appLogger.info({
        event: "group.join.requested",
        userId: ctx.user.id,
        groupId: input.id,
      })
      return 'PENDING'
    }
    await ctx.prisma.group.update({
      where: {
        id: input.id,
      },
      data: {
        members: {
          connect: {
            id: ctx.user.id,
          },
        },
      },
    })
    appLogger.info({
      event: "group.join",
      userId: ctx.user.id,
      groupId: input.id,
    })
    return 'OK'
  }),
  approveGroupMember: protectedProcedure.input(
    groupUserInput
  ).mutation(async ({ ctx, input }) => {
    const group = await ctx.prisma.group.findUnique({
      where: {
        id: input.groupId,
      },
      include: {
        approvalQueue: {
          select: {
            id: true,
          },
        },
      },
    })
    if (!group) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    if (group.creatorId !== ctx.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }
    if (!group.approvalQueue.some((member) => member.id === input.userId)) {
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }

    await ctx.prisma.group.update({
      where: {
        id: input.groupId,
      },
      data: {
        members: {
          connect: {
            id: input.userId,
          },
        },
        approvalQueue: {
          disconnect: {
            id: input.userId,
          },
        },
      },
    })

    appLogger.info({
      event: "group.member.approved",
      userId: ctx.user.id,
      groupId: input.groupId,
      targetUserId: input.userId,
    })
    return 'OK'
  }),
  rejectGroupMember: protectedProcedure.input(
    groupUserInput
  ).mutation(async ({ ctx, input }) => {
    const group = await ctx.prisma.group.findUnique({
      where: {
        id: input.groupId,
      },
      include: {
        approvalQueue: {
          select: {
            id: true,
          },
        },
      },
    })
    if (!group) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    if (group.creatorId !== ctx.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }
    if (!group.approvalQueue.some((member) => member.id === input.userId)) {
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }

    await ctx.prisma.group.update({
      where: {
        id: input.groupId,
      },
      data: {
        approvalQueue: {
          disconnect: {
            id: input.userId,
          },
        },
      },
    })

    appLogger.info({
      event: "group.member.rejected",
      userId: ctx.user.id,
      groupId: input.groupId,
      targetUserId: input.userId,
    })
    return 'OK'
  }),
  toggleGroupModerator: protectedProcedure.input(
    groupUserInput
  ).mutation(async ({ ctx, input }) => {
    const group = await ctx.prisma.group.findUnique({
      where: {
        id: input.groupId,
      },
      include: {
        members: {
          select: {
            id: true,
          },
        },
        moderators: {
          select: {
            id: true,
          },
        },
      },
    })
    if (!group) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    if (group.creatorId !== ctx.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }
    if (input.userId === group.creatorId) {
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }
    if (!group.members.some((member) => member.id === input.userId)) {
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }

    const isModerator = group.moderators.some((moderator) => moderator.id === input.userId)

    await ctx.prisma.group.update({
      where: {
        id: input.groupId,
      },
      data: isModerator
        ? {
          moderators: {
            disconnect: {
              id: input.userId,
            },
          },
        }
        : {
          moderators: {
            connect: {
              id: input.userId,
            },
          },
        },
    })

    appLogger.info({
      event: "group.moderator.toggled",
      userId: ctx.user.id,
      groupId: input.groupId,
      targetUserId: input.userId,
      promoted: !isModerator,
    })
    return isModerator ? 'UNPROMOTED' : 'PROMOTED'
  }),
  kickGroupMember: protectedProcedure.input(
    groupUserInput
  ).mutation(async ({ ctx, input }) => {
    const group = await ctx.prisma.group.findUnique({
      where: {
        id: input.groupId,
      },
      include: {
        members: {
          select: {
            id: true,
          },
        },
        moderators: {
          select: {
            id: true,
          },
        },
      },
    })
    if (!group) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    if (group.creatorId !== ctx.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }
    if (input.userId === group.creatorId) {
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }
    if (!group.members.some((member) => member.id === input.userId)) {
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }

    await ctx.prisma.group.update({
      where: {
        id: input.groupId,
      },
      data: {
        members: {
          disconnect: {
            id: input.userId,
          },
        },
        moderators: {
          disconnect: {
            id: input.userId,
          },
        },
      },
    })

    appLogger.info({
      event: "group.member.kicked",
      userId: ctx.user.id,
      groupId: input.groupId,
      targetUserId: input.userId,
    })
    return 'OK'
  }),
  leaveGroup: protectedProcedure.input(
    groupIdInput
  ).mutation(async ({ ctx, input }) => {
    const group = await ctx.prisma.group.findUnique({
      where: {
        id: input.id,
      },
    })
    if (!group) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    await ctx.prisma.group.update({
      where: {
        id: input.id,
      },
      data: {
        members: {
          disconnect: {
            id: ctx.user.id,
          },
        },
      },
    })
    appLogger.info({
      event: "group.left",
      userId: ctx.user.id,
      groupId: input.id,
    })
    return 'OK'
  }),
  updateGroup: protectedProcedure.input(
    updateGroupInput
  ).mutation(async ({ ctx, input }) => {
    const group = await ctx.prisma.group.findUnique({
      where: {
        id: input.id,
      },
      include: {
        moderators: {
          select: {
            id: true,
          }
        }
      }
    })
    if (!group) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    if (group.creatorId !== ctx.user.id || !group.moderators.some((mod) => mod.id === ctx.user.id)) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }

    const updatedGroup = await ctx.prisma.group.update({
      where: {
        id: input.id,
      },
      data: {
        name: input.name ?? group.name,
        description: input.description ?? group.description,
        approvalRequired: input.approvalRequired ?? group.approvalRequired,
        onlyModsCanAddLists: input.onlyModsCanAddLists ?? group.onlyModsCanAddLists,
      },
    })
    appLogger.info({
      event: "group.updated",
      userId: ctx.user.id,
      groupId: input.id,
      changedFields: {
        name: input.name !== undefined,
        description: input.description !== undefined,
        approvalRequired: input.approvalRequired !== undefined,
        onlyModsCanAddLists: input.onlyModsCanAddLists !== undefined,
      },
    })
    return updatedGroup
  }),
  rmGroup: protectedProcedure.input(
    groupIdInput
  ).mutation(async ({ ctx, input }) => {
    const group = await ctx.prisma.group.findUnique({
      where: {
        id: input.id,
      },
    })
    if (!group) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    if (group.creatorId !== ctx.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }

    await ctx.prisma.group.delete({
      where: {
        id: input.id,
      },
    })
    appLogger.info({
      event: "group.removed",
      userId: ctx.user.id,
      groupId: input.id,
    })
    return 'OK'
  }),
} satisfies TRPCRouterRecord
