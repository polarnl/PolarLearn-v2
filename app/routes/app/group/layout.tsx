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
  useLoaderData,
  useLocation,
  useNavigate,
  useRevalidator,
  useRouteLoaderData,
} from "react-router";
import { Button, Tabs } from "@polarnl/polarui-react";
import { t } from "~/i18n";
import type { Route } from "./+types/layout";
import { createCallerFactory, createTRPCContext } from "~/server/trpc";
import { appRouter } from "~/server/main";
import { AvatarFallback, AvatarImage, Avatar } from "~/components/ui/avatar";
import { List, ListPlus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "~/components/ui/dialog";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";
import { subjects as subjectsList } from "~/lib/subjects";
import { useTRPC } from "~/server/react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

type Tab = { label: string; path: string };

function generateTabs(isModerator: boolean): Tab[] {
  const baseTabs: Tab[] = [
    { label: t("navigation.lists"), path: "lists" },
    { label: t("groups.members"), path: "members" },
  ];
  if (isModerator) {
    baseTabs.push({ label: t("navigation.settings"), path: "settings" });
  }
  return baseTabs;
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const groupName = loaderData?.group?.name?.trim() || t("groups.fallbackName");
  const groupDescription =
    loaderData?.group?.description?.trim() ||
    t("groups.metaDescription");

  return [
    { title: t("groups.metaTitle", { groupName }) },
    {
      name: "description",
      content: groupDescription,
    },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const { id } = params;
  if (!id) {
    throw new Response("", { status: 400 });
  }
  const headers = new Headers(request.headers);
  const context = await createTRPCContext({ headers, request });
  const caller = createCallerFactory(appRouter)(context);
  const group = await caller.groups.getGroupData({ id });
  const recentLists = context.user ? await caller.list.getRecentLists() : [];
  if (!group) {
    throw new Response("", { status: 404 });
  }
  return {
    group,
    ...(recentLists.length > 0 ? { recentLists } : {}),
    tabs: generateTabs(
      group.moderators.some((mod) => mod.id === context.user?.id),
    ),
    ownsGroup: group.creatorId === context.user?.id,
    isModerator: group.moderators.some((mod) => mod.id === context.user?.id),
    isMember: group.members.some(
      (member: any) => member.id === context.user?.id,
    ),
    isPending:
      Array.isArray(group.approvalQueue) &&
      group.approvalQueue.some((u: any) => u.id === context.user?.id),
  };
}

export default function Layout() {
  const loaderData = useLoaderData<{ tabs: Tab[];[key: string]: any }>();
  const rootData = useRouteLoaderData("root");
  const location = useLocation();
  const navigate = useNavigate();
  const theme = rootData?.theme ?? "dark";
  const trpc = useTRPC();
  const isModerator = loaderData.isModerator;
  const isLoggedIn = Boolean(rootData?.user?.id);
  const queryClient = useQueryClient();

  const normalizedPath = location.pathname.replace(/\/+$/, "");
  const basePath = "/app/group/" + loaderData.group.id;
  const activeTab = loaderData.tabs.find(
    ({ path }: { path: string }) =>
      normalizedPath === `${basePath}/${path}` ||
      normalizedPath.startsWith(`${basePath}/${path}/`),
  )?.path ?? loaderData.tabs[0]!.path;

  const hasRecentLists =
    Array.isArray(loaderData.recentLists) && loaderData.recentLists.length > 0;
  const [addListDialogOpen, setAddListDialogOpen] = useState(false);
  const [joinRequestSubmitted, setJoinRequestSubmitted] = useState(
    loaderData.isPending,
  );
  const isJoinRequestPending = loaderData.isPending || joinRequestSubmitted;
  const revalidator = useRevalidator();

  const addListMutation = useMutation({
    ...trpc.groups.addListToGroup.mutationOptions(),
    onSuccess: async (result) => {
      if (result === "ALREADY") {
        toast.info(t("groups.listAlreadyInGroup"));
        setAddListDialogOpen(false);
        return;
      }
      revalidator.revalidate();
      toast.success(t("groups.listAddedToGroup"));
      setAddListDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("errors.unknown"));
    },
  });

  const joinGroupMutation = useMutation({
    ...trpc.groups.joinGroup.mutationOptions(),
    onSuccess: (data) => {
      if (data === "PENDING") {
        setJoinRequestSubmitted(true);
        toast.info(t("groups.joinRequestSubmitted"));
      } else {
        toast.success(t("groups.joinedGroup"));
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("errors.unknown"));
    },
  });

  const leaveGroupMutation = useMutation({
    ...trpc.groups.leaveGroup.mutationOptions(),
    onSuccess: () => {
      revalidator.revalidate();
      toast.success(t("groups.leftGroup"));
      navigate("/app/groups");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("errors.unknown"));
    },
  });

  return (
    <div className="p-4">
      <div className="flex flex-col">
        <div className="flex flex-row gap-x-4">
          <Avatar className="h-15 w-15">
            <AvatarImage
              src={loaderData.group.avatarUrl ?? undefined}
              alt={loaderData.group.name}
            />
            <AvatarFallback>
              {loaderData.group.name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h1 className="mt-2 text-2xl font-bold">{loaderData.group.name}</h1>
          <div className="grow" />
          {!isLoggedIn ? (
            <Button disabled>{t("groups.loginToJoin")}</Button>
          ) : loaderData.group.creatorId !== rootData?.user?.id ? (
            <>
              <Button
                onClick={() => {
                  if (loaderData.isMember) {
                    leaveGroupMutation.mutate({ id: loaderData.group.id });
                  } else {
                    joinGroupMutation.mutate({ id: loaderData.group.id });
                  }
                }}
                disabled={
                  joinGroupMutation.isPending ||
                  leaveGroupMutation.isPending ||
                  isJoinRequestPending
                }
              >
                {loaderData.isMember
                  ? t("groups.leaveGroup")
                  : isJoinRequestPending
                    ? t("groups.joinRequestSubmitted")
                    : t("groups.joinGroup")}
              </Button>
            </>
          ) : null}
        </div>
        {!isLoggedIn ? (
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            {t("groups.loginToJoinDescription")}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
          {loaderData.group.description}
        </p>
      </div>
      {loaderData.group.approvalRequired && !loaderData.isMember ? (
        <div className="mt-8 flex items-center justify-center">
          <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-8 text-center dark:border-neutral-700 dark:bg-neutral-900">
            <p className="mt-2 text-neutral-600 dark:text-neutral-400">
              {t("groups.privateGroup")}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-row items-center gap-3">
            <Tabs
              scheme={theme}
              tabs={loaderData.tabs.map(({ label, path }: Tab) => ({ value: path, title: label }))}
              activeTab={activeTab}
              onActiveTabChange={(path) => {
                void navigate(`${basePath}/${path}`);
              }}
            />
            <div className="grow" />
            {hasRecentLists && isModerator ? (
              <>
                <button
                  className="w-12 h-12 rounded-full dark:bg-neutral-800 bg-neutral-200 dark:hover:bg-neutral-700 hover:bg-neutral-300 transition-all cursor-pointer flex items-center justify-center m-1"
                  onClick={() => setAddListDialogOpen(true)}
                >
                  <ListPlus />
                </button>
                <Dialog
                  open={addListDialogOpen}
                  onOpenChange={setAddListDialogOpen}
                >
                  <DialogContent>
                    <DialogTitle className="text-2xl font-bold">
                      {t("lists.addListToGroup")}
                    </DialogTitle>
                    <div className="relative">
                      <ScrollArea
                        className={addListMutation.isPending ? "blur-sm" : ""}
                      >
                        <div className="space-y-3 pr-1">
                          {loaderData.recentLists.map((list: any) => {
                            const hasSubject =
                              typeof list.subject === "string" &&
                              Object.prototype.hasOwnProperty.call(
                                subjectsList,
                                list.subject,
                              );
                            const subject = hasSubject
                              ? subjectsList[
                              list.subject as keyof typeof subjectsList
                              ]
                              : null;
                            const subjectLabel = subject
                              ? t(subject.labelKey)
                              : "";
                            return (
                              <div
                                key={list.id}
                                role="button"
                                tabIndex={0}
                                className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-x-4 rounded-xl bg-neutral-200 hover:bg-neutral-300 px-4 py-3 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-all cursor-pointer"
                                onClick={() => {
                                  addListMutation.mutate({
                                    groupId: loaderData.group.id,
                                    listId: list.id,
                                  });
                                }}
                              >
                                <button
                                  type="button"
                                  className="flex min-w-0 items-center gap-x-3 text-left"
                                >
                                  {subject ? (
                                    <img
                                      src={subject.icon}
                                      alt={subjectLabel}
                                      className="h-6 w-6 shrink-0"
                                    />
                                  ) : (
                                    <List size={20} className="shrink-0" />
                                  )}
                                  <span className="truncate text-base font-semibold">
                                    {list.name ?? t("lists.namePlaceholder")}
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <ScrollBar orientation="vertical" />
                      </ScrollArea>
                      {addListMutation.isPending && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        variant="transparent"
                        onClick={() => setAddListDialogOpen(false)}
                        scheme={rootData!.theme}
                      >
                        {t("common.cancel")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            ) : null}
          </div>
          <hr />
          <div className="py-4">
            <Outlet />
          </div>
        </>
      )}
    </div>
  );
}
