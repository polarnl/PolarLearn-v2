
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

import { Input, Button, CheckWithLabel } from "@polarnl/polarui-react";
import { useState } from "react";
import { useRouteLoaderData, useRevalidator, useNavigate } from "react-router";
import { useTRPC } from "~/server/react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "~/i18n";
import { Loader2, Save, Trash2, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";

export default function SettingsPage() {
  const loaderData = useRouteLoaderData("../routes/app/group/layout")
  const rootData = useRouteLoaderData("root")
  const trpc = useTRPC()
  const revalidator = useRevalidator()
  const navigate = useNavigate()
  const t = i18n.t
  const theme = rootData?.theme ?? "dark"
  const isLoggedIn = Boolean(rootData?.user?.id)

  if (!loaderData.isModerator) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        {isLoggedIn
          ? t("groups.onlyModeratorsCanManageSettings")
          : t("groups.loginToManage")}
      </div>
    )
  }

  const [groupName, setGroupName] = useState(loaderData.group.name)
  const [groupDescription, setGroupDescription] = useState(loaderData.group.description ?? "")
  const [approvalRequired, setApprovalRequired] = useState(loaderData.group.approvalRequired ?? false)
  const [onlyModsCanAddLists, setOnlyModsCanAddLists] = useState(loaderData.group.onlyModsCanAddLists ?? false)

  const updateMutation = useMutation({
    ...trpc.groups.updateGroup.mutationOptions(),
    onSuccess: async () => {
      toast.success(t("groups.update.success"))
      revalidator.revalidate()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("errors.unknown"))
    }
  })

  const rmGroupMutation = useMutation({
    ...trpc.groups.rmGroup.mutationOptions(),
    onSuccess: async () => {
      toast.success(t("groups.delete.success"))
      navigate("/app/groups")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("errors.unknown"))
    }
  })

  const hasChanges =
    groupName.trim() !== (loaderData.group.name ?? "").trim() ||
    (groupDescription ?? "").trim() !== (loaderData.group.description ?? "").trim() ||
    approvalRequired !== (loaderData.group.approvalRequired ?? false) ||
    onlyModsCanAddLists !== (loaderData.group.onlyModsCanAddLists ?? false)

  return (
    <div className="w-full flex flex-col gap-y-4 p-4">
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-2">
          <label className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t("groups.create.nameLabel")}
          </label>
          <Input
            scheme={theme}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={t("groups.create.namePlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <label className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t("groups.create.descriptionLabel")}
          </label>
          <Input
            scheme={theme}
            value={groupDescription}
            onChange={(e) => setGroupDescription(e.target.value)}
            placeholder={t("groups.create.descriptionPlaceholder")}
          />
        </div>

        <div className="rounded-xl border border-neutral-300/80 dark:border-neutral-700 p-4 space-y-4 bg-neutral-50/70 dark:bg-neutral-900/40 mt-2">
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
              {t("groups.create.settingsTitle")}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("groups.create.settingsDescription")}
            </p>
          </div>

          <div className="space-y-1">
            <CheckWithLabel
              label={t("groups.create.approvalRequiredLabel")}
              checked={approvalRequired}
              onChange={() => setApprovalRequired((prev: any) => !prev)}
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
              onChange={() => setOnlyModsCanAddLists((prev: any) => !prev)}
              className="[&>span:last-child]:text-neutral-900! dark:[&>span:last-child]:text-neutral-100!"
            />
            <p className="ml-6 text-sm text-neutral-500 dark:text-neutral-400">
              {t("groups.create.onlyModsCanAddListsDescription")}
            </p>
          </div>
        </div>
      </div>

      {rootData?.user?.id === loaderData.group.creatorId ? (
        <div className="space-y-4 rounded-xl border border-red-500/20 bg-red-500/5 p-5 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">
              {t("groups.delete.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("groups.delete.description")}
            </p>
          </div>

          <div className="flex justify-end">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  scheme={theme}
                  type="button"
                  color="red"
                  textColor="white"
                  icon={<Trash2 className="size-4" />}
                >
                  {t("common.delete")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold">
                    {t("groups.delete.title")}
                  </DialogTitle>
                  <DialogDescription>
                    {t("groups.delete.dialogDescription")}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      scheme={theme}
                      variant="transparent"
                      textColor="white"
                      icon={<X className="size-4" />}
                    >
                      {t("groups.delete.cancel")}
                    </Button>
                  </DialogClose>
                  <Button
                    scheme={theme}
                    type="button"
                    color="red"
                    textColor="white"
                    icon={rmGroupMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 className="size-4" />}
                    disabled={rmGroupMutation.isPending}
                    onClick={() => {
                      rmGroupMutation.mutate({
                        id: loaderData.group.id,
                      })
                    }}
                  >
                    {t("groups.delete.confirm")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      ) : null}

      <div className="flex gap-x-3 justify-end pt-4">
        <Button
          scheme={theme}
          onClick={() => {
            updateMutation.mutate({
              id: loaderData.group.id,
              name: groupName.trim(),
              description: groupDescription.trim() || undefined,
              approvalRequired,
              onlyModsCanAddLists,
            })
          }}
          disabled={updateMutation.isPending || !groupName.trim() || groupName.trim().length < 3 || !hasChanges}
          icon={updateMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
        >
          {updateMutation.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  )
}