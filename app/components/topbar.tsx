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

import { Bell, ExternalLink, List, Loader2, Plus, MessageCircle, Users, UserPlus } from "lucide-react";
import { useState } from "react";
import { CreatePostDialog } from "~/routes/app/forum/CreatePostDialog";
import { useLocation, useNavigate, useRevalidator, useRouteLoaderData, useSearchParams } from "react-router";
import InfiniteScroll from "react-infinite-scroll-component";

import { SidebarTrigger } from "~/components/ui/sidebar";
import i18n from "~/i18n";
import { PopoverTrigger, Popover, PopoverContent, PopoverHeader } from "./ui/popover";
import { Button, CheckWithLabel, Input } from "@polarnl/polarui-react";
import { useTRPC } from '~/server/react';
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { SearchBar } from "./searchBar";
import { notificationIcons } from "~/lib/notifications";

export function TopBar() {
  const rootData = useRouteLoaderData("root")
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const theme = rootData?.theme ?? "dark"
  const t = i18n.t;
  const userName = rootData?.user.name ?? t("userMenu.guest")
  const rpc = useTRPC()
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [requiresModeratorApproval, setRequiresModeratorApproval] = useState(false)
  const [onlyModsCanAddLists, setOnlyModsCanAddLists] = useState(false)

  const createList = useMutation({
    ...rpc.list.createList.mutationOptions(),
    onSuccess: async (data) => {
      await navigate(`/app/editlist/${data.id}`)
    },
    onError: () => {
      toast.error(t("lists.create.error"))
    }
  })
  const createGroup = useMutation({
    ...rpc.groups.createGroup.mutationOptions(),
    onSuccess: async (data) => {
      setIsCreateGroupDialogOpen(false)
      setGroupName("")
      setGroupDescription("")
      setRequiresModeratorApproval(false)
      setOnlyModsCanAddLists(false)
      toast.success(t("groups.create.success"))
      navigate(`/app/group/${data.id}`)
    },
    onError: () => {
      toast.error(t("errors.unknown"))
    }
  })

  const [isCreatePostDialogOpen, setIsCreatePostDialogOpen] = useState(false);
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);

  const initialNotifications = rootData?.notifications ?? [];
  const unreadNotificationsCount = rootData?.unreadNotificationsCount ?? 0;
  const queryClient = useQueryClient();
  const notificationQueryOptions = rpc.notification.getNotifications.infiniteQueryOptions(
    { limit: 10 },
    {
      enabled: Boolean(rootData?.user?.id),
      getNextPageParam: (page) => page.nextCursor,
      initialData: {
        pages: [{
          notifications: initialNotifications,
          nextCursor: rootData?.notificationsNextCursor,
        }],
        pageParams: [null],
      },
    },
  );
  const notificationsQuery = useInfiniteQuery(notificationQueryOptions);
  const allNotifications = notificationsQuery.data.pages.flatMap(
    (page) => page.notifications,
  );

  const readNotification = useMutation({
    ...rpc.notification.readNotification.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: notificationQueryOptions.queryKey,
      });
      revalidator.revalidate();
    },
  })

  if (location.pathname.startsWith("/app/editlist/") || location.pathname.startsWith("/app/session/")) {
    return null;
  }

  return (
    <div className="border-b dark:border-neutral-700 border-neutral-300 min-h-16 w-full flex items-center gap-3 px-4 top-0 z-10 bg-neutral-50 dark:bg-neutral-900 ">
      <SidebarTrigger
        className="md:hidden shrink-0"
        scheme={theme}
      />
      {location.pathname === "/app" && (
        <h1 className="text-2xl font-bold">👋 {t("home.welcomeText", { username: userName })}</h1>
      )}
      {location.pathname === "/app/forum" && (
        <h1 className="text-2xl font-bold">{t("navigation.forum")}</h1>
      )}
      {location.pathname.startsWith("/app/viewlist/") && (
        <h1 className="text-2xl font-bold">{t("navigation.list")}</h1>
      )}
      {location.pathname === "/app/favorites" && (
        <h1 className="text-2xl font-bold">{t("favorites.title")}</h1>
      )}
      {location.pathname === "/app/mylists" && (
        <h1 className="text-2xl font-bold">{t("mylists.title")}</h1>
      )}
      {location.pathname.startsWith("/app/forum") && (
        <h1 className="text-2xl font-bold">{t("navigation.forum")}</h1>
      )}
      {location.pathname.startsWith("/app/viewuser/") && (
        <h1 className="text-2xl font-bold">{t("navigation.userProfile")}</h1>
      )}
      {location.pathname === "/app/groups" && (
        <h1 className="text-2xl font-bold">{t("navigation.groups")}</h1>
      )}
      {location.pathname.startsWith("/app/group/") && (
        <h1 className="text-2xl font-bold">{t("navigation.group")}</h1>
      )}
      {location.pathname === "/app/usersettings" && (
        <h1 className="text-2xl font-bold">{t("userSettings.title")}</h1>
      )}

      {!location.pathname.startsWith("/app/search") && <div className="grow" />}
      <SearchBar query={searchParams.get("q") ?? ""} />
      {rootData?.user?.id ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 transition-all hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700"
              aria-label="Meldingen"
            >
              <Bell />
              {unreadNotificationsCount > 0 ? (
                <div className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white shadow-sm ring-2 ring-neutral-50 dark:ring-neutral-900">
                  {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                </div>
              ) : null}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-96 max-w-[calc(100vw-1rem)]" align="end">
            <PopoverHeader>
              <h2 className="text-base font-semibold">Meldingen</h2>
            </PopoverHeader>
            {allNotifications.length > 0 ? (
              <InfiniteScroll
                dataLength={allNotifications.length}
                next={() => void notificationsQuery.fetchNextPage()}
                hasMore={notificationsQuery.hasNextPage}
                loader={
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                }
                endMessage={
                  <div className="px-3 py-2 text-center text-xs text-muted-foreground">
                    {t("forum.posts.noMore")}
                  </div>
                }
                height={384}
              >
                {allNotifications.map((notification) => {
                  const Icon = notificationIcons.find((iconDef) => iconDef.value === notification.icon)?.icon ?? Bell;
                  return (
                    <Button
                      variant={"transparent"}
                      scheme={theme}
                      className={`w-full gap-1 justify-start items-center px-0 py-2`}
                      key={notification.id}
                      type="button"
                      onClick={async () => {
                        try {
                          await readNotification.mutateAsync({ id: notification.id })
                          if (notification.navigate) {
                            navigate(notification.navigate);
                          }
                        } catch {
                          toast.error(t("errors.unknown"));
                        }
                      }}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 space-y-1 text-left">
                        <span className={
                          notification.read
                            ? "block text-sm leading-snug text-muted-foreground text-left"
                            : "block text-sm leading-snug font-semibold text-foreground text-left"
                        }>
                          {notification.content}
                        </span>
                        <span className="block text-xs text-muted-foreground text-left">
                          {new Date(notification.createdAt).toLocaleString()}
                        </span>
                      </span>
                      {notification.navigate ? <ExternalLink className="mt-1 size-4 shrink-0 text-muted-foreground" /> : null}
                    </Button>
                  )
                })}
              </InfiniteScroll>
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">Je hebt nog geen meldingen.</p>
            )}
          </PopoverContent>
        </Popover>
      ) : null}
      <Popover>
        <PopoverTrigger>
          <div className="h-10 w-10 flex flex-row items-center justify-center rounded-full bg-neutral-200 cursor-pointer hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-all">
            <Plus />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto" align="center">
          <PopoverHeader>
            <h1 className="font-bold text-xl">
              {t("topbar.new")}
            </h1>
          </PopoverHeader>
          <Button
            variant="transparent"
            onClick={() => {
              createList.mutate({
                name: t("lists.namePlaceholder"),
                subject: "other"
              })
            }}
            scheme={theme}
            icon={createList.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <List />
            )}
            disabled={createList.isPending}
          >
            <span className="ml-2">{t("lists.create.createList")}</span>
          </Button>
          <Button
            variant="transparent"
            scheme={theme}
            onClick={() => {
              setIsCreatePostDialogOpen(true);
            }}
            icon={<MessageCircle />}
          >
            <span className="ml-2">{t("forum.createPost.title")}</span>
          </Button>
          <CreatePostDialog open={isCreatePostDialogOpen} onOpenChange={setIsCreatePostDialogOpen} />
          <Button
            scheme={theme}
            variant="transparent"
            icon={<Users />}
            onClick={() => {
              setIsCreateGroupDialogOpen(true);
            }}
          >
            {t("groups.create.title")}
          </Button>
          <Dialog
            open={isCreateGroupDialogOpen}
            onOpenChange={(open) => {
              setIsCreateGroupDialogOpen(open);
              if (!open) {
                setGroupName("")
                setGroupDescription("")
                setRequiresModeratorApproval(false)
                setOnlyModsCanAddLists(false)
              }
            }}
          >
            <DialogContent>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  createGroup.mutate({
                    name: groupName.trim(),
                    description: groupDescription.trim() || undefined,
                    approvalRequired: requiresModeratorApproval,
                    onlyModsCanAddLists,
                  });
                }}
                className="space-y-4"
              >
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold">{t("groups.create.title")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <label>{t("groups.create.nameLabel")}</label>
                  <Input
                    scheme={theme}
                    value={groupName}
                    onChange={(event) => {
                      setGroupName(event.target.value);
                    }}
                    placeholder={t("groups.create.namePlaceholder")}
                    autoFocus
                  />

                  <label>{t("groups.create.descriptionLabel")}</label>
                  <Input
                    scheme={theme}
                    value={groupDescription}
                    onChange={(event) => {
                      setGroupDescription(event.target.value);
                    }}
                    placeholder={t("groups.create.descriptionPlaceholder")}
                  />
                  <div className="rounded-xl border border-neutral-300/80 dark:border-neutral-700 p-3 space-y-3 bg-neutral-50/70 dark:bg-neutral-900/40">
                    <div>
                      <h3 className="font-semibold">{t("groups.create.settingsTitle")}</h3>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        {t("groups.create.settingsDescription")}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <CheckWithLabel
                        label={t("groups.create.approvalRequiredLabel")}
                        checked={requiresModeratorApproval}
                        onChange={() => setRequiresModeratorApproval((prev) => !prev)}
                        className="[&>span:last-child]:text-neutral-900! dark:[&>span:last-child]:text-neutral-100!"
                      />
                      <p className="ml-6 text-sm text-neutral-500 dark:text-neutral-400">
                        {t("groups.create.approvalRequiredDescription")}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <CheckWithLabel
                        label={t("groups.create.onlyModsCanAddListsLabel")}
                        checked={onlyModsCanAddLists}
                        onChange={() => setOnlyModsCanAddLists((prev) => !prev)}
                        className="[&>span:last-child]:text-neutral-900! dark:[&>span:last-child]:text-neutral-100!"
                      />
                      <p className="ml-6 text-sm text-neutral-500 dark:text-neutral-400">
                        {t("groups.create.onlyModsCanAddListsDescription")}
                      </p>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      variant="transparent"
                      scheme={theme}
                      onClick={() => {
                        setGroupName("")
                        setGroupDescription("")
                        setRequiresModeratorApproval(false)
                        setOnlyModsCanAddLists(false)
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                  </DialogClose>
                  <Button
                    scheme={theme}
                    type="submit"
                    disabled={createGroup.isPending || groupName.trim().length < 3}
                    icon={createGroup.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
                  >
                    {createGroup.isPending ? t("common.saving") : t("groups.create.create")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </PopoverContent>
      </Popover>
    </div>
  )
}
