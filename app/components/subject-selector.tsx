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

import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Check, ChevronDown } from "lucide-react";
import { SubjectNamesArray, type SubjectNames } from "~/lib/subjectnames";
import { getSubjectIcon, getSubjectNameById } from "~/lib/subjects";

export default function SubjectSelector({
  selected,
  onSelect,
  open,
  onOpenChange,
}: {
  selected: SubjectNames;
  onSelect: (id: SubjectNames) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm font-medium text-foreground transition hover:bg-muted"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0">
              {getSubjectIcon(selected, { width: 20, height: 20, className: "size-5 rounded-sm" })}
            </span>
            <span className="truncate">{getSubjectNameById(selected)}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-2" align="start" portalled={false}>
        <div className="px-1 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Kies een vak
        </div>
        <div className="grid max-h-80 gap-1 overflow-y-auto overscroll-contain [touch-action:pan-y]">
          {SubjectNamesArray.map((subjectId) => {
            const isSelected = subjectId === selected;

            return (
              <button
                key={subjectId}
                type="button"
                className={
                  "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-muted" +
                  (isSelected ? " bg-muted font-medium" : "")
                }
                onClick={() => {
                  onSelect(subjectId);
                  onOpenChange(false);
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0">
                    {getSubjectIcon(subjectId, { width: 20, height: 20, className: "size-5 rounded-sm" })}
                  </span>
                  <span className="truncate">{getSubjectNameById(subjectId)}</span>
                </span>
                {isSelected ? <Check className="size-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
