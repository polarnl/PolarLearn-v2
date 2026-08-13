"use server";

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

import { unstable_getRequest as getRequest } from "react-router";
import z from "zod";

import { prisma } from "~/lib/db";
import { getRequestSession } from "~/server/trpc";

const EXPORT_COOLDOWN = 7 * 24 * 60 * 60 * 1000;

const ActionResultSchema = z.object({
  ok: z.boolean(),
  content: z.string().optional(),
  filename: z.string().optional(),
  nextExportAvailableAt: z.string().optional(),
  error: z.enum(["UNAUTHENTICATED", "EXPORT_COOLDOWN", "EXPORT_FAILED"]).optional(),
  availableAt: z.string().optional(),
})

export async function exportAccountAction(): Promise<z.infer<typeof ActionResultSchema>> {
  const request = getRequest();
  const session = await getRequestSession({
    headers: new Headers(request.headers),
    request,
  });

  if (!session?.user) {
    return {
      ok: false,
      error: "UNAUTHENTICATED",
    };
  }

  const now = new Date();
  const cooldownCutoff = new Date(now.getTime() - EXPORT_COOLDOWN);
  const exportUpdate = await prisma.user.updateMany({
    where: {
      id: session.user.id,
      OR: [
        { lastExportedAt: null },
        { lastExportedAt: { lte: cooldownCutoff } },
      ],
    },
    data: { lastExportedAt: now },
  });

  if (exportUpdate.count === 0) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { lastExportedAt: true },
    });
    const availableAt = user?.lastExportedAt
      ? new Date(user.lastExportedAt.getTime() + EXPORT_COOLDOWN)
      : new Date(now.getTime() + EXPORT_COOLDOWN);

    return {
      ok: false,
      error: "EXPORT_COOLDOWN",
      availableAt: availableAt.toISOString(),
    };
  }

  const user = await getAccountExportUser(session.user.id);

  if (!user) {
    return {
      ok: false,
      error: "EXPORT_FAILED",
    };
  }

  const exportedAt = now.toISOString();

  return {
    ok: true,
    content: JSON.stringify(
      {
        exportedAt,
        user,
      },
      null,
      2,
    ),
    filename: `polarlearn-account-export-${exportedAt.slice(0, 10)}.json`,
    nextExportAvailableAt: new Date(now.getTime() + EXPORT_COOLDOWN).toISOString(),
  };
}

function getAccountExportUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      username: true,
      displayUsername: true,
      role: true,
      banned: true,
      banReason: true,
      forumBanned: true,
      forumBanReason: true,
      banExpires: true,
      recentItems: true,
      theme: true,
      optinAI: true,
      lastExportedAt: true,
      sessions: {
        select: {
          id: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          ipAddress: true,
          userAgent: true,
          impersonatedBy: true,
          activeOrganizationId: true,
        },
      },
      accounts: {
        select: {
          id: true,
          accountId: true,
          providerId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      lists: {
        select: {
          id: true,
          name: true,
          description: true,
          subject: true,
          items: true,
          versionData: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      collaboratingLists: {
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
        },
      },
      quizzes: {
        select: {
          id: true,
          title: true,
          description: true,
          subject: true,
          questions: true,
          versionData: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      collaboratingQuizzes: {
        select: {
          id: true,
          title: true,
          description: true,
          subject: true,
          userId: true,
          questions: true,
          versionData: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      learnSessions: {
        select: {
          id: true,
          listId: true,
          queue: true,
          answerLog: true,
          isComplete: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      favoriteLists: {
        select: {
          id: true,
          name: true,
          subject: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      forumPosts: {
        select: {
          id: true,
          title: true,
          content: true,
          category: true,
          subject: true,
          votes: true,
          pinned: true,
          cachedTotalVotes: true,
          deleted: true,
          isReply: true,
          replyToId: true,
          associatedQuiz: true,
          associatedList: true,
          associatedBranch: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      inGroups: {
        select: {
          id: true,
          name: true,
          description: true,
          image: true,
          creatorId: true,
          approvalRequired: true,
          onlyModsCanAddLists: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      applyingToGroups: {
        select: {
          id: true,
          name: true,
          description: true,
          creatorId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      moderatingGroups: {
        select: {
          id: true,
          name: true,
          description: true,
          creatorId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      createdGroups: {
        select: {
          id: true,
          name: true,
          description: true,
          image: true,
          approvalRequired: true,
          onlyModsCanAddLists: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      invitations: {
        select: {
          id: true,
          organizationId: true,
          email: true,
          role: true,
          status: true,
          expiresAt: true,
          createdAt: true,
        },
      },
      members: {
        select: {
          id: true,
          organizationId: true,
          role: true,
          createdAt: true,
        },
      },
      ssoproviders: {
        select: {
          id: true,
          providerId: true,
          domain: true,
          organizationId: true,
        },
      },
      passkeys: {
        select: {
          id: true,
          name: true,
          deviceType: true,
          backedUp: true,
          transports: true,
          createdAt: true,
          aaguid: true,
        },
      },
    },
  });
}
