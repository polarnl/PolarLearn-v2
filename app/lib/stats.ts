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

import { z } from "zod"
import type { Prisma } from "~/prisma/client"
import { answerLogSchema } from "~/lib/learn"

export const sessionSummarySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.literal("finished"),
  correct: z.number(),
  incorrect: z.number(),
  total: z.number(),
  scorePercentage: z.number(),
  grade: z.number(),
})

export type SessionSummary = z.infer<typeof sessionSummarySchema>

export type SessionSummarySource = Prisma.LearnSessionGetPayload<{
  select: {
    id: true
    createdAt: true
    updatedAt: true
    answerLog: true
  }
}>

export function buildSessionSummary(session: SessionSummarySource): SessionSummary {
  const parsedAnswerLog = answerLogSchema.safeParse(session.answerLog)
  const answerLog = parsedAnswerLog.success ? parsedAnswerLog.data : []
  const total = answerLog.length
  const correct = answerLog.filter((entry) => entry.isCorrect).length
  const incorrect = total - correct
  const scorePercentage = total > 0 ? Math.round((correct / total) * 100) : 0
  const grade = total > 0 ? Number((((correct / total) * 9) + 1).toFixed(1)) : 1

  return sessionSummarySchema.parse({
    id: session.id,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    status: "finished",
    correct,
    incorrect,
    total,
    scorePercentage,
    grade,
  })
}
