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

import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import z from "zod";

import { logger as appLogger } from "~/lib/logger";
import { protectedProcedure, publicProcedure } from "~/server/trpc";

export const adminRouter = {
  setForumBan: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        banned: z.boolean(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "no" });
      }
      const reason = input.reason?.trim();
      await ctx.prisma.user.update({
        where: { id: input.userId },
        data: {
          forumBanned: input.banned,
          forumBanReason: input.banned ? (reason ?? null) : null,
        },
      });
      appLogger.info({
        event: "admin.forum_ban.updated",
        userId: ctx.user.id,
        targetUserId: input.userId,
        banned: input.banned,
        reason: reason,
      });
      return input.banned ? "BANNED" : "UNBANNED";
    }),
  setAnnouncement: protectedProcedure
    .input(
      z.object({
        content: z.string().max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "noob" });
      }
      const scope = ctx.session?.activeOrganizationId || "global";
      const updated = await ctx.prisma.config.updateMany({
        where: { key: "announcement", scope },
        data: { value: input.content },
      });
      if (!updated.count) {
        await ctx.prisma.config.create({
          data: {
            id: crypto.randomUUID(),
            key: "announcement",
            scope,
            value: input.content,
          },
        });
      }
      appLogger.info({
        event: "admin.announcement.updated",
        userId: ctx.user.id,
        scope,
        content: input.content,
      });
    }),
  rmAnnouncement: protectedProcedure
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "nice try lmao" });
      }
      await ctx.prisma.config.deleteMany({
        where: {
          key: "announcement",
          scope: ctx.session?.activeOrganizationId || "global",
        },
      });
      appLogger.info({
        event: "admin.announcement.removed",
        userId: ctx.user.id,
        scope: ctx.session?.activeOrganizationId || "global",
      });
    }),
  listAllTenancies: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "fuck off" });
    }
    const tenancies = await ctx.prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        createdAt: true,
      },
    });
    return tenancies;
  }),
  switchTenancy: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const organization = await ctx.prisma.organization.findUnique({
        where: { id: input.organizationId },
      });

      if (!organization) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const member = await ctx.prisma.member.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: ctx.user.id,
        },
      });

      if (!member) {
        await ctx.prisma.member.create({
          data: {
            id: crypto.randomUUID(),
            organizationId: input.organizationId,
            userId: ctx.user.id,
            role: "admin",
            createdAt: new Date(),
          },
        });
      }

      await ctx.prisma.session.update({
        where: { id: ctx.session!.id },
        data: { activeOrganizationId: input.organizationId },
      });

      appLogger.info({
        event: "admin.tenancy_switched",
        userId: ctx.user.id,
        organizationId: input.organizationId,
      });
    }),
} satisfies TRPCRouterRecord;
