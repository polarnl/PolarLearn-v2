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

import { redirect, useLoaderData, useNavigate, useRouteLoaderData } from "react-router"
import { MoveLeft } from "lucide-react"
import { createTRPCContext } from "~/server/trpc"
import { prisma } from "~/lib/db"
import { answerLogSchema } from "~/lib/learn"
import i18n from "~/i18n"
import { Button } from "@polarnl/polarui-react"

type MistakeRow = {
  label: string
  count: number
  lastUserAnswer: string
}

export async function loader({ params, request }: { params: Record<string, string | undefined>; request: Request }) {
  const listId = params.id
  const sessionId = params.sessionId

  if (!listId || !sessionId) {
    throw new Response("Missing route params", { status: 400 })
  }

  const headers = new Headers(request.headers)
  const context = await createTRPCContext({ headers, request })

  if (!context.user) {
    const url = new URL(request.url)
    return redirect(`/auth/sign-in?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`)
  }

  const session = await prisma.learnSession.findFirst({
    where: {
      id: sessionId,
      listId,
      userId: context.user.id,
      isComplete: true,
    },
    select: {
      id: true,
      updatedAt: true,
      answerLog: true,
    },
  })

  if (!session) {
    throw new Response("Session not found", { status: 404 })
  }

  const parsedAnswerLog = answerLogSchema.safeParse(session.answerLog)
  const answerLog = parsedAnswerLog.success ? parsedAnswerLog.data : []

  const total = answerLog.length
  const correct = answerLog.filter((entry) => entry.isCorrect).length
  const incorrect = total - correct
  const scorePercentage = total > 0 ? Math.round((correct / total) * 100) : 0
  const grade = total > 0 ? Number((((correct / total) * 9) + 1).toFixed(1)) : 1

  const mistakeMap = new Map<string, MistakeRow>()
  for (const entry of answerLog) {
    if (entry.isCorrect) continue

    const label = entry.correctAnswer ?? entry.questionText ?? "Onbekend item"
    const current = mistakeMap.get(label)

    if (current) {
      current.count += 1
      current.lastUserAnswer = entry.answer
    } else {
      mistakeMap.set(label, {
        label,
        count: 1,
        lastUserAnswer: entry.answer,
      })
    }
  }

  const oftenMistakenWords = [...mistakeMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    listId,
    session: {
      id: session.id,
      updatedAt: session.updatedAt.toISOString(),
      correct,
      incorrect,
      total,
      scorePercentage,
      grade,
      oftenMistakenWords,
    },
  }
}

export default function StatsSessionPage() {
  const t = i18n.t
  const navigate = useNavigate()
  const { listId, session } = useLoaderData<typeof loader>()
  const rootData = useRouteLoaderData("root")

  return (
    <div className="space-y-4">
      <Button
        variant="transparent"
        onClick={() => {
          void navigate(`/app/viewlist/${listId}/stats`)
        }}
        icon={<MoveLeft />}
        scheme={rootData.theme as "light" | "dark"}
      >
        {t("learn.stats.backToSessions")}
      </Button>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/80">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {t("learn.stats.sessionOverview", { id: session.id.slice(0, 8) })}
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {t("learn.stats.finishedAt", { date: new Date(session.updatedAt).toLocaleString("nl-NL") })}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">{t("learn.stats.grade")}</div>
            <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{session.grade.toFixed(1)}</div>
          </div>
          <div className="rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">{t("learn.stats.score")}</div>
            <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{`${String(session.scorePercentage)}%`}</div>
          </div>
          <div className="rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">{t("learn.stats.correct")}</div>
            <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{String(session.correct)}</div>
          </div>
          <div className="rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">{t("learn.stats.incorrect")}</div>
            <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{String(session.incorrect)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/80">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {t("learn.stats.oftenMistakenWords")}
        </h3>

        {session.oftenMistakenWords.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {t("learn.stats.noMistakes")}
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <thead>
                <tr className="bg-neutral-50 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  <th className="w-1/2 px-4 py-3">{t("learn.stats.word")}</th>
                  <th className="w-1/4 px-4 py-3">{t("learn.stats.timesWrong")}</th>
                  <th className="w-1/4 px-4 py-3">{t("learn.stats.lastAnswer")}</th>
                </tr>
              </thead>
              <tbody>
                {session.oftenMistakenWords.map((row) => (
                  <tr
                    key={row.label}
                    className="border-t border-neutral-200 text-neutral-800 dark:border-neutral-800 dark:text-neutral-200"
                  >
                    <td className="px-4 py-3 font-medium">{row.label}</td>
                    <td className="px-4 py-3">{row.count}</td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{row.lastUserAnswer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
