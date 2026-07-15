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

import { Link, redirect, useLoaderData } from "react-router";
import ListDiffView from "~/components/list-diff";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import type { ListSnapshot } from "~/lib/list";
import { applyListDiffToSnapshot, versionData } from "~/lib/list-diff";
import { createTRPCContext } from "~/server/trpc";
import type { Route } from "./+types/[commitid]";
import { FileWarning } from "lucide-react";
import { t } from "~/i18n";

export async function loader({ params, request }: Route.LoaderArgs) {
  const context = await createTRPCContext({ headers: new Headers(request.headers), request });
  if (!context.user) return redirect("/auth/sign-in");

  const list = await context.prisma.list.findUnique({
    where: { id: params.id },
    select: { versionData: true },
  });
  if (!list || !params.commitid) throw new Response("", { status: 404 });

  const commits = versionData.parse(list.versionData).commits;
  const commit = commits[params.commitid];
  if (!commit) throw new Response("", { status: 404 });

  const author = await context.prisma.user.findUnique({
    where: { id: commit.author },
    select: { id: true, displayUsername: true, name: true, username: true, image: true },
  });

  const parentCommits: typeof commit[] = [];
  let parentId = commit.parentId;

  while (parentId) {
    const parent = commits[parentId];
    if (!parent) throw new Response("", { status: 404 });
    parentCommits.push(parent);
    parentId = parent.parentId;
  }

  return {
    items: parentCommits.reverse().reduce<ListSnapshot>((items, parent) => applyListDiffToSnapshot(items, parent.diff), []),
    commit: {
      ...commit,
      id: params.commitid,
    },
    author: author && {
      id: author.id,
      displayUsername: author.displayUsername ?? author.name ?? author.username ?? author.id,
      image: author.image,
    },
  };
}

export default function CommitHistoryPage() {
  const { items, commit, author } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          Commit <code className="font-mono bg-neutral-200 dark:bg-neutral-700 px-2 py-0.5 rounded text-sm break-all">{commit.id}</code>
        </h1>
        <p>{commit.message}</p>
        {author ? (
          <Link to={`/app/viewuser/${author.id}`} className="flex items-center gap-2 mt-2">
            <Avatar className="size-7">
              <AvatarImage src={author.image ?? undefined} />
              <AvatarFallback>{author.displayUsername.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <p className="hover:underline cursor-pointer">{author.displayUsername}</p>
          </Link>
        ) : <p>{commit.author}</p>}
      </div>
      {items.length === 0 && applyListDiffToSnapshot(items, commit.diff).length === 0
        ? (
          <div className="w-full flex flex-col items-center justify-center">
            <FileWarning className="text-muted-foreground size-10" />
            <p className="text-muted-foreground">{t("lists.commits.empty")}</p>
          </div>
        )
        : <ListDiffView items={items} commit={commit} />}
    </div>
  );
}
