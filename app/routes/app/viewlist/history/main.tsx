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

import { redirect, useLoaderData, useNavigate } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { versionData } from "~/lib/list-diff";
import { createTRPCContext } from "~/server/trpc";
import type { Route } from "./+types/main";

export async function loader({ params, request }: Route.LoaderArgs) {
  const context = await createTRPCContext({ headers: new Headers(request.headers), request });
  if (!context.user) return redirect("/auth/sign-in");

  const list = await context.prisma.list.findUnique({
    where: { id: params.id },
    select: { versionData: true },
  });
  if (!list) throw new Response("", { status: 404 });

  const commits = versionData.parse(list.versionData).commits;
  const authorIds = [...new Set(Object.values(commits).map((commit) => commit.author))];
  const authors = await context.prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, displayUsername: true, name: true, username: true, image: true },
  });

  return {
    listId: params.id,
    commits,
    authors: authors.map((author) => ({
      id: author.id,
      displayUsername: author.displayUsername ?? author.name ?? author.username ?? author.id,
      image: author.image,
    })),
  };
}

export default function HistoryPage() {
  const { listId, commits, authors: authorData } = useLoaderData<typeof loader>();
  const authors = new Map(authorData.map((author) => [author.id, author]));
  const navigate = useNavigate();
  const sortedCommits = Object.entries(commits).sort(([, a], [, b]) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return (
    <div className="flex flex-col gap-y-4">
      {sortedCommits.map(([id, commit]) => {
        const author = authors.get(commit.author);
        return (
          <div
            key={id}
            className="flex flex-row gap-2 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-all cursor-pointer"
            onClick={() => {
              navigate(`/app/viewlist/${listId}/history/${id}`);
            }}
          >
            <div className="bg-neutral-100 dark:bg-neutral-900 p-2 rounded-md flex items-center mr-2">
              <pre>{id.slice(0, 8)}</pre>
            </div>
            <div className="flex flex-col gap-y-1">
              <p className="font-bold">{commit.message}</p>
              {author ? (
                <button type="button" onClick={() => void navigate(`/app/viewuser/${author.id}`)} className="flex items-center gap-2">
                  <Avatar className="size-7">
                    <AvatarImage src={author.image ?? undefined} />
                    <AvatarFallback>{author.displayUsername.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <p className="hover:underline cursor-pointer">{author.displayUsername}</p>
                </button>
              ) : commit.author}
            </div>
          </div>
        );
      })}
    </div>
  );
}
