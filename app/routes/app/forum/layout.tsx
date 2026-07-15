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

import {
  Outlet,
  useLocation,
  useNavigate,
  useRouteLoaderData,
} from "react-router";
import { Button, Tabs } from "@polarnl/polarui-react";
import { t } from "~/i18n";
import type { Route } from "./+types/layout";
import { BookOpen, CalendarDays, ChevronDown, Funnel } from "lucide-react";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { forumCategories, forumCategoryInfo, type ForumCategory } from "~/lib/forum";
import type { DateRange } from "react-day-picker";
import { SubjectNamesArray, type SubjectNames } from "~/lib/subjectnames";
import { Subject } from "~/lib/subjects";

export type ForumOutletContext = {
  filterOptions: Record<string, string>;
  setFilterOptions: Dispatch<SetStateAction<Record<string, string>>>;
  filterOptionsOpen: boolean;
  setFilterOptionsOpen: Dispatch<SetStateAction<boolean>>;
  categoryFilter: ForumCategory | null;
  setCategoryFilter: Dispatch<SetStateAction<ForumCategory | null>>;
  subjectFilter: SubjectNames | null;
  setSubjectFilter: Dispatch<SetStateAction<SubjectNames | null>>;
  dateFilter: DateRange | undefined;
  setDateFilter: Dispatch<SetStateAction<DateRange | undefined>>;
};

const tabs = [
  { label: t("forum.tabs.allPosts"), path: "posts" },
  { label: t("forum.tabs.myPosts"), path: "myPosts" },
  { label: t("forum.tabs.myReplies"), path: "myReplies" },
];

const dateFormatter = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" });
const subjects = new Subject();

export function meta(): Route.MetaDescriptors {
  return [
    { title: t("forum.metaTitle") },
    {
      name: "description",
      content: t("forum.metaDescription"),
    },
  ];
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const rootData = useRouteLoaderData("root");
  const theme = rootData?.theme ?? "dark";
  const isLoggedIn = Boolean(rootData?.user?.id);
  const forumBanReason = rootData?.user?.forumBanReason?.trim();
  const visibleTabs = isLoggedIn ? tabs : tabs.slice(0, 1);

  const normalizedPath = location.pathname.replace(/\/+$/, "");
  const basePath = "/app/forum";
  const activeTab = visibleTabs.find(
    ({ path }) =>
      normalizedPath === `${basePath}/${path}` ||
      normalizedPath.startsWith(`${basePath}/${path}/`),
  )?.path ?? visibleTabs[0]!.path;
  const searchParams = new URLSearchParams(location.search);
  const [filterOptionsOpen, setFilterOptionsOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState<Record<string, string>>({});
  const [categoryFilter, setCategoryFilter] = useState<ForumCategory | null>(
    () => forumCategories.find((value) => value === searchParams.get("category")) ?? null,
  );
  const [subjectFilter, setSubjectFilter] = useState<SubjectNames | null>(
    () => SubjectNamesArray.find((value) => value === searchParams.get("subject")) ?? null,
  );
  const [dateFilter, setDateFilter] = useState<DateRange | undefined>(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    return from || to
      ? { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined }
      : undefined;
  });
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [subjectPopoverOpen, setSubjectPopoverOpen] = useState(false);
  const selectedCategory = categoryFilter ? forumCategoryInfo[categoryFilter] : null;
  const SelectedCategoryIcon = selectedCategory?.icon;
  const subjectsClass = new Subject();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);

    for (const [key, value] of [
      ["category", categoryFilter],
      ["subject", subjectFilter],
      ["from", dateFilter?.from?.toLocaleDateString("sv-SE")],
      ["to", dateFilter?.to?.toLocaleDateString("sv-SE")],
    ] as const) {
      if (value) searchParams.set(key, value);
      else searchParams.delete(key);
    }

    const search = searchParams.toString();
    if (search === location.search.slice(1)) return;
    void navigate(`${location.pathname}${search ? `?${search}` : ""}`, { replace: true });
  }, [categoryFilter, dateFilter, location.pathname, location.search, navigate, subjectFilter]);

  return (
    <div className="p-4">
      <h1 className="truncate text-3xl font-bold">{t("navigation.forum")}</h1>
      {!isLoggedIn ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("forum.loginPrompt")}
        </p>
      ) : null}
      {rootData?.user?.forumBanned ? (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("forum.banned.description", {
            reason: forumBanReason || t("forum.banned.noReason"),
          })}
        </div>
      ) : null}
      <div className="mt-4 flex flex-row items-center gap-3">
        <Tabs
          scheme={theme}
          tabs={visibleTabs.map(({ label, path }) => ({ value: path, title: label }))}
          activeTab={activeTab}
          onActiveTabChange={(path) => {
            void navigate(`${basePath}/${path}`);
          }}
        />
        <div className="grow" />
        <Button
          variant="transparent"
          icon={<Funnel />}
          scheme={theme}
          onClick={() => {
            setFilterOptionsOpen((open) => !open)
          }}
        >
          {t("forum.filter.title")}
        </Button>
      </div>
      <hr className="mt-4" />
      <div className="py-4">
        {filterOptionsOpen && (
          <div className="flex flex-row items-center gap-2 mb-4">
            <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="transparent"
                  icon={SelectedCategoryIcon ? <SelectedCategoryIcon /> : <Funnel />}
                  scheme={theme}
                >
                  <span className="flex items-center gap-1">
                    {selectedCategory ? t(selectedCategory.label) : t("forum.filter.category")}
                    <ChevronDown className="size-4" />
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-2" align="start" portalled={false}>
                <div className="grid gap-1">
                  {forumCategories.map((category) => {
                    const info = forumCategoryInfo[category];
                    const CategoryIcon = info.icon;

                    return (
                      <Button
                        key={category}
                        variant="transparent"
                        scheme={theme}
                        onClick={() => {
                          const nextCategory = categoryFilter === category ? null : category;
                          setCategoryFilter(nextCategory);
                          if (nextCategory !== "school-related") setSubjectFilter(null);
                          setCategoryPopoverOpen(false);
                        }}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <CategoryIcon className="size-4" />
                        </span>
                        <span className="font-medium text-foreground">{t(info.label)}</span>
                      </Button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
            {categoryFilter === "school-related" ? (
              <Popover open={subjectPopoverOpen} onOpenChange={setSubjectPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="transparent"
                    icon={
                      subjectFilter
                        ? subjects.getIcon(subjectFilter, {
                          width: 16,
                          height: 16,
                          className: "size-4 rounded-sm",
                        })
                        : <BookOpen />
                    }
                    scheme={theme}
                  >
                    <span className="flex items-center gap-1">
                      {subjectFilter
                        ? subjects.getSubjectNameById(subjectFilter)
                        : t("forum.createPost.subjectLabel")}
                      <ChevronDown className="size-4" />
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-2"
                  portalled={false}
                >
                  <div className="grid max-h-80 gap-1 overflow-y-auto">
                    {SubjectNamesArray.map((subject) => (
                      <Button
                        key={subject}
                        variant="transparent"
                        scheme={theme}
                        onClick={() => {
                          setSubjectFilter(subjectFilter === subject ? null : subject);
                          setSubjectPopoverOpen(false);
                        }}
                        icon={
                          subjectsClass.getIcon(subject, {
                            width: 20,
                            height: 20,
                          })
                        }
                      >
                        {subjectsClass.getSubjectNameById(subject)}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="transparent" icon={<CalendarDays />} scheme={theme}>
                  <span className="flex items-center gap-1">
                    {dateFilter?.from
                      ? dateFilter.to
                        ? `${dateFormatter.format(dateFilter.from)} – ${dateFormatter.format(dateFilter.to)}`
                        : dateFormatter.format(dateFilter.from)
                      : t("forum.filter.date")}
                    <ChevronDown className="size-4" />
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" portalled={false}>
                <Calendar mode="range" selected={dateFilter} onSelect={setDateFilter} />
              </PopoverContent>
            </Popover>
          </div>
        )}
        <Outlet
          context={{
            filterOptions,
            setFilterOptions,
            filterOptionsOpen,
            setFilterOptionsOpen,
            categoryFilter,
            setCategoryFilter,
            subjectFilter,
            setSubjectFilter,
            dateFilter,
            setDateFilter,
          }}
        />
      </div>
    </div>
  );
}
