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

import { useMemo } from "react";
import type { ListSnapshot } from "~/lib/list";
import { applyListDiffToSnapshot, type VersionCommit } from "~/lib/list-diff";

export default function ListDiffView({
  items,
  commit,
}: {
  items: ListSnapshot;
  commit: Pick<VersionCommit, "diff">;
}) {
  const nextItems = useMemo(() => applyListDiffToSnapshot(items, commit.diff), [commit.diff, items]);
  const maxItems = Math.max(items.length, nextItems.length);

  return (
    <div className="max-h-[62vh] overflow-auto">
      {Array.from({ length: maxItems }, (_, index) => {
        const currentItem = items[index];
        const nextItem = nextItems[index];
        const status = currentItem === undefined
          ? "added"
          : nextItem === undefined
            ? "removed"
            : currentItem.question !== nextItem.question || currentItem.answer !== nextItem.answer
              ? "changed"
              : "equal";
        const leftTone = status === "removed"
          ? "bg-destructive/15 text-destructive"
          : status === "equal"
            ? ""
            : "bg-destructive/10";
        const rightTone = status === "added"
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
          : status === "equal"
            ? ""
            : "bg-emerald-500/10";
        const currentText = currentItem
          ? `- pair ${index + 1}: ${currentItem.question.trim() || "—"} | ${currentItem.answer.trim() || "—"}`
          : `- pair ${index + 1}: ∅`;
        const nextText = nextItem
          ? `+ pair ${index + 1}: ${nextItem.question.trim() || "—"} | ${nextItem.answer.trim() || "—"}`
          : `+ pair ${index + 1}: ∅`;

        return (
          <div
            key={index}
            className="grid grid-cols-1 border-b border-border/60 font-mono text-[13px] leading-6 text-foreground last:border-b-0 sm:grid-cols-2"
          >
            <div className={`px-4 py-3 ${leftTone}`}>{currentText}</div>
            <div className={`px-4 py-3 sm:border-l sm:border-border ${rightTone}`}>{nextText}</div>
          </div>
        );
      })}
    </div>
  );
}
