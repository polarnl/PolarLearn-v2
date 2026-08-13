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

import { List } from "lucide-react";
import { redirect, useLoaderData, useNavigate } from "react-router";

import i18n from "~/i18n";
import { prisma } from "~/lib/db";
import { subjects as subjectsList } from "~/lib/subjects";
import type { Route } from "./+types/lists";
import { getRequestSession } from "~/server/trpc";

export async function loader({ request }: Route.LoaderArgs) {
  const headers = new Headers(request.headers);
  const session = await getRequestSession({ headers, request });

  if (!session?.user) {
    const url = new URL(request.url);
    return redirect(`/auth/sign-in?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
  }

  if (session.user.role !== "admin") {
    return redirect("/app");
  }

  const lists = await prisma.list.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      subject: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          displayUsername: true,
          username: true,
          name: true,
        },
      },
    },
  });

  return { lists };
}

export default function ListsAdminPage() {
  const { lists } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const t = i18n.t;

  return (
    <section className="flex min-w-0 flex-col">
      {lists.length === 0 ? (
        <div className="rounded-xl bg-neutral-100 px-5 py-4 text-sm font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
          {t("admin.lists.empty")}
        </div>
      ) : (
        <div className="mt-4 flex w-full flex-col gap-y-3">
          {lists.map((list) => {
            const hasSubject =
              typeof list.subject === "string" &&
              Object.prototype.hasOwnProperty.call(subjectsList, list.subject);
            const subject = hasSubject ? subjectsList[list.subject as keyof typeof subjectsList] : null;
            const subjectLabel = subject ? t(subject.labelKey) : null;
            const authorId = list.user?.id;

            return (
              <div
                key={list.id}
                role="button"
                tabIndex={0}
                className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-x-4 rounded-xl bg-neutral-200 px-4 py-3 transition-all cursor-pointer hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 h-16"
                onClick={() => {
                  void navigate(`/app/viewlist/${list.id}`);
                }}
              >
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-x-3 text-left"
                >
                  {subject ? (
                    <img src={subject.icon} alt={subjectLabel ?? ""} className="h-6 w-6 shrink-0" />
                  ) : (
                    <List size={20} className="shrink-0" />
                  )}
                  <span className="truncate text-base font-semibold">
                    {list.name ?? t("lists.namePlaceholder")}
                  </span>
                </button>

                {authorId ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void navigate(`/app/viewuser/${authorId}`);
                    }}
                    className="justify-self-center truncate text-sm font-bold text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-300"
                  >
                    {list.user?.name ?? list.user?.displayUsername ?? list.user?.username ?? authorId}
                  </button>
                ) : (
                  <span className="justify-self-center truncate text-sm text-neutral-600 dark:text-neutral-300">
                    {t("lists.unknownAuthor")}
                  </span>
                )}

                <span className="flex flex-row items-center gap-4 text-sm text-neutral-600 dark:text-neutral-300">
                  {new Date(list.updatedAt).toLocaleDateString("nl-NL")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
