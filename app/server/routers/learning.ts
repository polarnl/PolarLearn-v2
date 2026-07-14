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

import { TRPCError } from "@trpc/server";
import crypto from "crypto";

import { createTRPCRouter, protectedProcedure } from "~/server/trpc";
import { z } from "zod";
import {
  answerLogSchema,
  createLearningQueue,
  modes,
  queueSchema,
  type listPrefs,
} from "~/lib/learn";
import { listSnapshot } from "~/lib/list";
import type { VersionData } from "~/lib/list-diff";
import { prisma } from "~/lib/db";
import { logger as appLogger } from "~/lib/logger";

export const learningRouter = createTRPCRouter({
  generateLearnSession: protectedProcedure
    .input(
      z.object({
        listId: z.string(),
        mode: modes.optional().default("learn"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const list = await prisma.list.findFirst({
        where: {
          id: input.listId,
        },
        select: {
          id: true,
          items: true,
          versionData: true,
        },
      });

      if (!list) {
        throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });
      }

      const parsedItems = listSnapshot.parse(list.items);

      const userForPrefs = await prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { listPrefs: true },
      });
      const prefs = (userForPrefs?.listPrefs as listPrefs) ?? {};
      const ask = prefs[input.listId]?.ask ?? "q";

      const queue = createLearningQueue(parsedItems, input.mode, ask);

      const session = await prisma.learnSession.create({
        data: {
          id: crypto.randomUUID(),
          listId: input.listId,
          userId: ctx.user.id,
          mode: input.mode,
          commit: (list.versionData as VersionData).branches.main.headCommitId,
          queue,
          answerLog: [],
          isComplete: false,
        },
      });

      appLogger.info({
        event: "learn.session.created",
        userId: ctx.user.id,
        sessionId: session.id,
        listId: input.listId,
        mode: input.mode ?? "learn",
        queueSize: queue.length,
      });

      return { id: session.id };
    }),
  getLearnSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const session = await prisma.learnSession.findFirst({
        where: {
          id: input.sessionId,
          userId: ctx.user.id,
        },
        select: {
          id: true,
          listId: true,
          queue: true,
          mode: true,
          answerLog: true,
          isComplete: true,
          createdAt: true,
          updatedAt: true,
          commit: true,
        },
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      const userPrefs = await prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { listPrefs: true },
      });
      const prefs = (userPrefs?.listPrefs as listPrefs) ?? {};
      const ask = prefs[session.listId]?.ask ?? "q";

      return {
        id: session.id,
        listId: session.listId,
        queue: queueSchema.parse(session.queue),
        answerLog: answerLogSchema.parse(session.answerLog),
        isComplete: session.isComplete,
        mode: session.mode as z.infer<typeof modes>,
        ask,
        commit: session.commit,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };
    }),
  updateSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        answerLog: answerLogSchema,
        queue: queueSchema,
        isComplete: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const session = await prisma.learnSession.findFirst({
        where: {
          id: input.sessionId,
          userId: ctx.user.id,
        },
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      await prisma.learnSession.update({
        where: {
          id: input.sessionId,
        },
        data: {
          answerLog: input.answerLog,
          queue: input.queue,
          isComplete: input.isComplete,
        },
      });

      if (input.isComplete) {
        const correctCount = input.answerLog.filter(
          (entry) => entry?.isCorrect,
        ).length;
        appLogger.info({
          event: "learn.session.completed",
          userId: ctx.user.id,
          sessionId: input.sessionId,
          listId: session.listId,
          totalAnswers: input.answerLog.length,
          correctAnswers: correctCount,
        });
      }
    }),
  getRecentSessions: protectedProcedure.query(async ({ ctx }) => {
    const recentSessions = await prisma.learnSession.findMany({
      where: {
        userId: ctx.user.id,
        isComplete: false,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        listId: true,
        updatedAt: true,
        queue: true,
        mode: true,
        answerLog: true,
        list: {
          select: {
            id: true,
            name: true,
            subject: true,
          },
        },
      },
    });

    return recentSessions.map((session) => {
      const answerLog = answerLogSchema.parse(session.answerLog);
      const queue = queueSchema.parse(session.queue);
      const completed = answerLog.reduce<number>((count, entry) => {
        if (entry?.isCorrect) {
          return count + 1;
        }

        return count;
      }, 0);
      const total = queue.length + completed;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        id: session.id,
        listId: session.listId,
        updatedAt: session.updatedAt.toISOString(),
        list: session.list,
        mode: session.mode,
        progress: {
          completed,
          total,
          percentage,
        },
      };
    });
  }),
  rmSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const session = await prisma.learnSession.findFirst({
        where: {
          id: input.sessionId,
          userId: ctx.user.id,
        },
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await prisma.learnSession.delete({
        where: {
          id: input.sessionId,
        },
      });

      appLogger.info({
        event: "learn.session.deleted",
        userId: ctx.user.id,
        sessionId: input.sessionId,
        listId: session.listId,
      });
    }),
  changeLearnSettings: protectedProcedure
    .input(
      z.object({
        id: z.string(), // session id
        opts: z.object({
          ask: z.enum(["q", "a", "both"]),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { listPrefs: true },
      });

      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const currentPrefs = (user.listPrefs as listPrefs) ?? {};

      await prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          listPrefs: {
            ...currentPrefs,
            [input.id]: {
              ...(currentPrefs[input.id] || {}),
              ...input.opts,
            },
          },
        },
      });

      appLogger.info({
        event: "learn.changeLearnSettings",
        userId: ctx.user.id,
        sessionId: input.id,
        opts: input.opts,
      });
    }),
});
