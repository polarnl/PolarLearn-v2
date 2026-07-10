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

import { useTRPC } from "~/server/react";
import { createCallerFactory, createTRPCContext } from "~/server/trpc";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";

import type { Route } from "./+types/layout";
import { appRouter } from "~/server/main";
import {
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useRouteLoaderData,
  useRevalidator,
} from "react-router";
import { Button, Tabs } from "@polarnl/polarui-react";
import { Subject } from "~/lib/subjects";
import i18n from "~/i18n";
import {
  Loader2,
  Pencil,
  BookOpen,
  Trash,
  Star,
  ChevronDown,
  BadgeCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import type { LoaderData, ListData } from "~/lib/viewlist";
import { learningModes } from "~/lib/learn";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";

export async function loader({
  params,
  request,
}: Route.LoaderArgs) {
  const id = params.id as string | undefined;
  if (!id) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response("", { status: 400 });
  }
  const headers = new Headers(request.headers);
  const context = await createTRPCContext({ headers, request });

  if (!context.user) {
    const url = new URL(request.url);
    return redirect(`/auth/sign-in?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
  }
  const userId = context.user.id;
  const caller = createCallerFactory(appRouter)(context);
  try {
    const list: ListData = await caller.list.getLatestListData({ listId: id });
    const canEdit =
      list.userId === userId ||
      list.collaborators.some((collaborator) => collaborator.id === userId) ||
      context.user.role === "admin";

    const collaborators = list.collaborators.map((c) => ({
      name: c.displayUsername ?? c.name ?? c.username ?? c.id,
      id: c.id,
    }));

    return {
      list,
      collaborators,
      canEdit,
      canDelete: list.userId === userId || context.user.role === "admin",
      user_liked: list.favoritedBy.some((fav) => fav.id === userId),
    };
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response(error as string, { status: 500 });
  }
}

export default function Layout() {
  const data = useLoaderData<LoaderData>();
  const rootData = useRouteLoaderData("root");
  const subjects = new Subject();
  const icon = subjects.getIcon(data.list.subject, { width: 50, height: 50 });
  const t = i18n.t;
  const location = useLocation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const theme = rootData?.theme ?? "dark";
  const rpc = useTRPC();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLearnPopoverOpen, setIsLearnPopoverOpen] = useState(false);
  const generateSessionMutation = useMutation({
    ...rpc.learning.generateLearnSession.mutationOptions(),
    onSuccess: (data: { id: string }) => {
      void navigate(`/app/session/${data.id}`);
    },
    onError: () => {
      toast.error(t("errors.unknown"));
    },
  });
  const deleteListMutation = useMutation({
    ...rpc.list.deleteList.mutationOptions({
      onSuccess: () => {
        setIsDeleteDialogOpen(false);
        toast.success(t("lists.delete.success"));
        void navigate("/app");
      },
      onError: () => {
        toast.error(t("errors.unknown"));
      },
    }),
  });
  const likeListMutation = useMutation({
    ...rpc.list.starList.mutationOptions({
      onSuccess: () => {
        void revalidator.revalidate();
      },
      onError: () => {
        toast.error(t("errors.unknown"));
      },
    }),
  });
  const verifyListMutation = useMutation({
    ...rpc.list.toggleVerified.mutationOptions({
      onSuccess: () => {
        toast.success(t("lists.verify.success"));
        void revalidator.revalidate();
      },
      onError: () => {
        toast.error(t("errors.unknown"));
      },
    }),
  });
  return (
    <div className="p-4">
      <div className="flex flex-row items-center gap-3">
        {icon}
        {data.list.verified && <BadgeCheck className="size-9 shrink-0 fill-green-500" />}
        <h1 className="min-w-0 wrap-break-word text-4xl font-bold">{data.list.name}</h1>
      </div>
      <p>{data.list.description}</p>
      <p className="mt-4">
        {t("lists.madeBy")}
        {data.collaborators.map((collaborator, index) => (
          <span key={collaborator.id}>
            {index > 0 && ", "}
            <button
              type="button"
              onClick={() => {
                void navigate(`/app/viewuser/${collaborator.id}`);
              }}
              className="font-bold text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-300"
            >
              {collaborator.name}
            </button>
          </span>
        ))}
      </p>

      <div className="mt-4">
        <Tabs
          scheme={theme}
          tabs={[t("lists.words"), t("lists.stats")]}
          activeIndex={(() => {
            const p = location.pathname.replace(/\/+$/, "");
            if (p.includes(`/app/viewlist/${data.list.id}/stats`)) return 1;
            return 0;
          })()}
          onActiveIndexChange={(idx: number) => {
            if (idx === 0) {
              void navigate(`/app/viewlist/${data.list.id}/words`);
            } else if (idx === 1) {
              void navigate(`/app/viewlist/${data.list.id}/stats`);
            }
          }}
        />
      </div>
      <ScrollArea className="w-full max-w-full overflow-hidden">
        <div className="flex w-max flex-row gap-4 py-4">
          <Popover open={isLearnPopoverOpen} onOpenChange={setIsLearnPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                scheme={theme}
                color="sky"
                textColor="white"
                icon={
                  generateSessionMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <BookOpen />
                  )
                }
                disabled={generateSessionMutation.isPending}
              >
                <span className="flex items-center gap-1">
                  {t("home.learn")}
                  <ChevronDown className="size-4" />
                </span>
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-80 p-2" align="start" portalled={false}>
              <div className="grid gap-1">
                {learningModes.map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={generateSessionMutation.isPending}
                    onClick={() => {
                      setIsLearnPopoverOpen(false);
                      generateSessionMutation.mutate({
                        listId: data.list.id,
                        mode: item.mode,
                      });
                    }}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <item.icon className="size-4" />
                    </span>
                    <span className="font-medium text-foreground">{item.title}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {data.canEdit && (
            <Button
              scheme={theme}
              variant="transparent"
              icon={<Pencil />}
              onClick={() => {
                void navigate(`/app/editlist/${data.list.id}`);
              }}
              className="hover:bg-neutral-200/70 dark:hover:bg-white/10"
            >
              {t("lists.edit.title")}
            </Button>
          )}
          <Button
            scheme={theme}
            variant="transparent"
            icon={
              likeListMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Star
                  className={data.user_liked ? "text-amber-300" : ""}
                  fill={data.user_liked ? "currentColor" : "none"}
                />
              )
            }
            onClick={() => {
              likeListMutation.mutate({ id: data.list.id });
            }}
            disabled={likeListMutation.isPending}
            className="hover:bg-neutral-200/70 dark:hover:bg-white/10"
          >
            {data.user_liked
              ? t("lists.favourites.unlike")
              : t("lists.favourites.like")}
          </Button>
          {data.canDelete && (
            <>
              <Button
                scheme={theme}
                variant="transparent"
                icon={
                  deleteListMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash />
                  )
                }
                onClick={() => {
                  setIsDeleteDialogOpen(true);
                }}
                disabled={deleteListMutation.isPending}
                className="border-none shadow-none text-red-600 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15"
              >
                {t("lists.delete.title")}
              </Button>

              <Dialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-bold text-2xl">
                      {t("lists.delete.title")}
                    </DialogTitle>
                    <DialogDescription>
                      {t("lists.delete.description")}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="transparent"
                      scheme={theme}
                      onClick={() => {
                        setIsDeleteDialogOpen(false);
                      }}
                      disabled={deleteListMutation.isPending}
                    >
                      {t("lists.delete.cancel")}
                    </Button>
                    <Button
                      scheme={theme}
                      color="red"
                      textColor="white"
                      onClick={() => {
                        deleteListMutation.mutate({ id: data.list.id });
                      }}
                      disabled={deleteListMutation.isPending}
                      icon={
                        deleteListMutation.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Trash />
                        )
                      }
                    >
                      {t("lists.delete.title")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button
            variant="transparent"
            scheme={theme}
            onClick={() => {
              verifyListMutation.mutate({ id: data.list.id });
            }}
            disabled={verifyListMutation.isPending}
            icon={verifyListMutation.isPending ? <Loader2 className="animate-spin" /> : <BadgeCheck className={data.list.verified ? "fill-green-500" : ""} />}
          >
            {data.list.verified ? t("lists.unverify") : t("lists.verify")}
          </Button>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <hr className="mb-4" />
      <Outlet />
    </div>
  );
}
