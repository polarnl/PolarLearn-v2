import { Link, useLoaderData, useRevalidator, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/tenancies";
import { auth } from "~/lib/auth/server";
import { Button, Input } from "@polarnl/polarui-react";
import { t } from "~/i18n";
import { authClient } from "~/lib/auth/client";
import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

export async function loader(loaderArgs: Route.LoaderArgs) {
  const headers = new Headers(loaderArgs.request.headers)
  const initialTenancies = await auth.api.listOrganizations({
    headers
  })
  return { initialTenancies }
}

export default function TenanciesPage() {
  const loaderData = useLoaderData<typeof loader>()
  const rootData = useRouteLoaderData("root")
  const revalidator = useRevalidator()
  const [isCreationDialogOpen, setIsCreationDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const theme = rootData?.theme ?? "dark"

  return (
    <div className="flex flex-col gap-4">
      <Button
        className="w-fit"
        variant="transparent"
        scheme={theme}
        icon={<Building2 />}
        onClick={() => {
          setIsCreationDialogOpen(true)
        }}
      >
        {t("admin.tenancies.create")}
      </Button>
      <Dialog
        open={isCreationDialogOpen}
        onOpenChange={setIsCreationDialogOpen}
      >
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              setIsCreating(true)

              void authClient.organization.create({
                name: String(data.get("name")).trim(),
                slug: String(data.get("slug")).trim(),
                keepCurrentActiveOrganization: true,
              }).then(({ error }) => {
                if (error) {
                  toast.error(error.message ?? t("admin.tenancies.createError"))
                  return
                }

                toast.success(t("admin.tenancies.createSuccess"))
                setIsCreationDialogOpen(false)
                void revalidator.revalidate()
              }).finally(() => {
                setIsCreating(false)
              })
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                {t("admin.tenancies.create")}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="tenancy-name">{t("admin.tenancies.name")}</label>
                <Input
                  id="tenancy-name"
                  name="name"
                  scheme={theme}
                  placeholder={t("admin.tenancies.namePlaceholder")}
                  pattern=".*\S.*"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="tenancy-slug">{t("admin.tenancies.slug")}</label>
                <Input
                  id="tenancy-slug"
                  name="slug"
                  scheme={theme}
                  placeholder={t("admin.tenancies.slugPlaceholder")}
                  pattern=".*\S.*"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="transparent" scheme={theme}>
                  {t("common.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                scheme={theme}
                disabled={isCreating}
                icon={isCreating ? <Loader2 className="animate-spin" /> : <Building2 />}
              >
                {isCreating ? t("admin.tenancies.creating") : t("admin.tenancies.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {loaderData.initialTenancies.length === 0 ? (
        <div className="text-center text-muted-foreground">
          {t("admin.tenancies.noTenancies")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {loaderData.initialTenancies.map((tenancy) => (
            <Link to={`/app/administration/tenancies/${tenancy.id}`} key={tenancy.id}>
              <div
                className="flex items-center gap-2 rounded-lg border p-4 hover:bg-neutral-200 hover:dark:bg-neutral-800 transition-all cursor-pointer"
              >
                <Avatar>
                  <AvatarFallback>
                    {tenancy.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                  <AvatarImage src={tenancy.logo || undefined} alt={tenancy.name} />
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold">{tenancy.name}</span>
                  <span className="text-sm text-muted-foreground">{tenancy.slug}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
