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

import { Input, Button } from "@polarnl/polarui-react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Megaphone, Save } from "lucide-react";
import { useState } from "react";
import { useRouteLoaderData } from "react-router";
import { t } from "~/i18n";
import { useTRPC } from "~/server/react";

export default function GeneralAdminPage() {
  const rootData = useRouteLoaderData("root")
  const rpc = useTRPC()
  const saveAnnouncementMutation = useMutation({
    ...rpc.admin.setAnnouncement.mutationOptions()
  })
  const rmAnnouncementMutation = useMutation({
    ...rpc.admin.rmAnnouncement.mutationOptions()
  })
  const [announcement, setAnnouncement] = useState(rootData?.announcement ?? "")
  return (
    <div className="p-4">
      <div className="dark:bg-neutral-800 bg-neutral-200 border dark:border-neutral-700 border-neutral-300 rounded-lg p-4">
        <h1 className="text-xl font-bold mb-4 flex flex-row gap-2 items-center justify-start">
          <Megaphone/>
          {t("admin.general.announcements.title")}
        </h1>
        <Input
          scheme={rootData.theme}
          placeholder={t("admin.general.announcements.placeholder")}
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
        />
        <div className="flex flex-row mt-4 gap-2">
          <Button
            icon={saveAnnouncementMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            onClick={() => {
              void saveAnnouncementMutation.mutate({
                content: announcement,
              })
            }}
            disabled={saveAnnouncementMutation.isPending}
          >
            {t("common.save")}
          </Button>
          <Button
            color="red"
            onClick={() => {
              void rmAnnouncementMutation.mutate()
              setAnnouncement("")
            }}
            disabled={rmAnnouncementMutation.isPending}
            icon={rmAnnouncementMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          >
            {t("common.delete")}  
          </Button>
        </div>
      </div>
    </div>
  )
}
