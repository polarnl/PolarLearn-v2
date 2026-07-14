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

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ListDiffView from "~/components/list-diff";
import { applyListDiffToSnapshot } from "~/lib/list-diff";

const items = [{ id: "one", question: "one", answer: "een" }];
const diff = {
  changes: [
    { op: "replace" as const, path: "/0/answer", value: "uno" },
    { op: "add" as const, path: "/1", value: { id: "two", question: "two", answer: "twee" } },
    { op: "remove" as const, path: "/0" },
  ],
};

describe("list diffs", () => {
  it("applies add, replace, and remove operations", () => {
    expect(applyListDiffToSnapshot(items, diff)).toEqual([{ id: "two", question: "two", answer: "twee" }]);
  });

  it("renders both sides of a commit", () => {
    const html = renderToStaticMarkup(<ListDiffView items={items} commit={{ diff }} />);

    expect(html).toContain("one | een");
    expect(html).toContain("two | twee");
  });
});
