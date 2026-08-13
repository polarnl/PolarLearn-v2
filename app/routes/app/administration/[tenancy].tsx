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

import { Button, Input } from "@polarnl/polarui-react"
import {
  ArrowLeft,
  AtSign,
  Building2,
  Check,
  ChevronDown,
  Globe2,
  Hash,
  ImageIcon,
  KeyRound,
  Loader2,
  Mail,
  Save,
  ShieldAlert,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"
import { useState } from "react"
import { Link, useLoaderData, useNavigate, useRevalidator, useRouteLoaderData } from "react-router"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button as UiButton } from "~/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { t } from "~/i18n"
import { authClient } from "~/lib/auth/client"
import { auth } from "~/lib/auth/server"

import type { Route } from "./+types/[tenancy]"

const organizationRoles = ["admin", "owner", "member"] as const
type OrganizationRole = (typeof organizationRoles)[number]

export async function loader({ request, params }: Route.LoaderArgs) {
  const headers = new Headers(request.headers)
  const [tenancy, { providers }] = await Promise.all([
    auth.api.getFullOrganization({
      headers,
      query: { organizationId: params.id },
    }),
    auth.api.listSSOProviders({ headers }),
  ])

  if (!tenancy) throw new Response(t("admin.tenancies.notFound"), { status: 404 })

  const metadata =
    typeof tenancy.metadata === "object" && tenancy.metadata !== null
      ? (tenancy.metadata as Record<string, unknown>)
      : {}

  return {
    tenancy,
    metadata,
    domain: typeof metadata.domain === "string" ? metadata.domain : "",
    provider: providers.find((provider) => provider.organizationId === tenancy.id) ?? null,
    invitations: tenancy.invitations.filter((invitation) => invitation.status === "pending"),
  }
}

const role = (value: string) =>
  organizationRoles.includes(value as OrganizationRole) ? (value as OrganizationRole) : "member"

export default function TenancyPage() {
  const { tenancy, metadata, domain, provider, invitations } = useLoaderData<typeof loader>()
  const rootData = useRouteLoaderData("root")
  const revalidator = useRevalidator()
  const navigate = useNavigate()
  const [pending, setPending] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<
    { type: "member"; id: string } | { type: "sso"; providerId: string } | null
  >(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("member")
  const theme = rootData?.theme ?? "dark"

  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-3">
        <Link
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          to="/app/administration/tenancies"
        >
          <ArrowLeft className="size-4" />
          {t("admin.tenancies.back")}
        </Link>

        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-14">
            <AvatarImage src={tenancy.logo ?? undefined} alt={tenancy.name} />
            <AvatarFallback>{tenancy.name.trim().charAt(0).toUpperCase() || "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold">{tenancy.name}</h2>
            <p className="truncate text-sm text-muted-foreground">{tenancy.slug}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{t("admin.tenancies.description")}</p>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return

            const data = new FormData(event.currentTarget)
            const nextDomain = String(data.get("domain") ?? "")
              .trim()
              .toLowerCase()

            setPending("general")
            void authClient.organization
              .update({
                organizationId: tenancy.id,
                data: {
                  name: String(data.get("name") ?? "").trim(),
                  slug: String(data.get("slug") ?? "").trim(),
                  logo: String(data.get("logo") ?? "").trim() || null,
                  metadata: { ...metadata, domain: nextDomain },
                },
              })
              .then(async ({ error }) => {
                if (error || !provider || provider.domain === nextDomain) {
                  return { error }
                }
                const { error: providerError } = await authClient.sso.updateProvider({
                  providerId: provider.providerId,
                  domain: nextDomain,
                })
                return { error: providerError }
              })
              .then(({ error }) => {
                if (error) {
                  toast.error(error.message ?? t("errors.unknown"))
                  return
                }

                toast.success(t("admin.tenancies.generalSaved"))
                void revalidator.revalidate()
              })
              .catch((error) => toast.error(error instanceof Error ? error.message : t("errors.unknown")))
              .finally(() => setPending(null))
          }}
        >
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{t("admin.tenancies.sections.general")}</h3>
            <p className="text-sm text-muted-foreground">{t("admin.tenancies.generalDescription")}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="tenancy-name">
                {t("admin.tenancies.name")}
              </label>
              <Input
                id="tenancy-name"
                name="name"
                scheme={theme}
                icon={<Building2 className="size-4" />}
                defaultValue={tenancy.name}
                pattern=".*\S.*"
                disabled={pending !== null}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="tenancy-slug">
                {t("admin.tenancies.slug")}
              </label>
              <Input
                id="tenancy-slug"
                name="slug"
                scheme={theme}
                icon={<Hash className="size-4" />}
                defaultValue={tenancy.slug}
                pattern=".*\S.*"
                disabled={pending !== null}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="tenancy-logo">
                {t("admin.tenancies.logo")}
              </label>
              <Input
                id="tenancy-logo"
                name="logo"
                type="url"
                scheme={theme}
                icon={<ImageIcon className="size-4" />}
                defaultValue={tenancy.logo ?? ""}
                placeholder="https://…"
                disabled={pending !== null}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="tenancy-domain">
                {t("admin.tenancies.domain")}
              </label>
              <Input
                id="tenancy-domain"
                name="domain"
                scheme={theme}
                icon={<Globe2 className="size-4" />}
                defaultValue={domain}
                placeholder="school.com"
                pattern=".*\S.*"
                disabled={pending !== null}
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              scheme={theme}
              disabled={pending !== null}
              icon={pending === "general" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            >
              {pending === "general" ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <form
          className="space-y-4"
          key={`${provider?.providerId ?? "new"}:${provider?.issuer ?? ""}:${provider?.oidcConfig?.clientIdLastFour ?? ""}`}
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return

            const data = new FormData(event.currentTarget)
            const issuer = String(data.get("issuer") ?? "").trim()
            const clientId = String(data.get("clientId") ?? "").trim()
            const clientSecret = String(data.get("clientSecret") ?? "").trim()

            setPending("sso")
            void (
              provider
                ? authClient.sso.updateProvider({
                    providerId: provider.providerId,
                    issuer,
                    domain,
                    ...(clientId || clientSecret
                      ? {
                          oidcConfig: {
                            ...(clientId ? { clientId } : {}),
                            ...(clientSecret ? { clientSecret } : {}),
                          },
                        }
                      : {}),
                  })
                : authClient.sso.register({
                    providerId: `tenancy-${tenancy.id}`,
                    organizationId: tenancy.id,
                    issuer,
                    domain,
                    oidcConfig: { clientId, clientSecret },
                  })
            )
              .then(({ error }) => {
                if (error) {
                  toast.error(error.message ?? t("errors.unknown"))
                  return
                }

                toast.success(t("admin.tenancies.ssoSaved"))
                void revalidator.revalidate()
              })
              .catch((error) => toast.error(error instanceof Error ? error.message : t("errors.unknown")))
              .finally(() => setPending(null))
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{t("admin.tenancies.sections.sso")}</h3>
              <p className="text-sm text-muted-foreground">{t("admin.tenancies.ssoDescription")}</p>
            </div>
            {provider ? <Badge variant="secondary">{t("admin.tenancies.ssoConfigured")}</Badge> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium" htmlFor="tenancy-issuer">
                {t("admin.tenancies.issuer")}
              </label>
              <Input
                id="tenancy-issuer"
                name="issuer"
                type="url"
                scheme={theme}
                icon={<KeyRound className="size-4" />}
                defaultValue={provider?.issuer ?? ""}
                placeholder="https://login.school.nl"
                disabled={pending !== null}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="tenancy-client-id">
                {t("admin.tenancies.clientId")}
              </label>
              <Input
                id="tenancy-client-id"
                name="clientId"
                scheme={theme}
                placeholder={
                  provider?.oidcConfig?.clientIdLastFour ? `••••${provider.oidcConfig.clientIdLastFour}` : undefined
                }
                disabled={pending !== null}
                required={!provider}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="tenancy-client-secret">
                {t("admin.tenancies.clientSecret")}
              </label>
              <Input
                id="tenancy-client-secret"
                name="clientSecret"
                type="password"
                scheme={theme}
                placeholder={provider ? t("admin.tenancies.secretUnchanged") : undefined}
                disabled={pending !== null}
                required={!provider}
              />
            </div>
          </div>

          {!domain ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">{t("admin.tenancies.domainRequiredForSso")}</p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            {provider ? (
              <Button
                type="button"
                color="red"
                textColor="white"
                scheme={theme}
                disabled={pending !== null}
                icon={<Trash2 className="size-4" />}
                onClick={() => {
                  setConfirmation({
                    type: "sso",
                    providerId: provider.providerId,
                  })
                }}
              >
                {t("admin.tenancies.removeSso")}
              </Button>
            ) : null}
            <Button
              type="submit"
              scheme={theme}
              disabled={pending !== null || !domain}
              icon={pending === "sso" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            >
              {pending === "sso" ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{t("admin.tenancies.sections.members")}</h3>
          <p className="text-sm text-muted-foreground">{t("admin.tenancies.membersDescription")}</p>
        </div>

        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return

            const form = event.currentTarget
            const data = new FormData(form)

            setPending("invite")
            void authClient.organization
              .inviteMember({
                email: String(data.get("email") ?? "").trim(),
                role: inviteRole,
                organizationId: tenancy.id,
              })
              .then(({ error }) => {
                if (error) {
                  toast.error(error.message ?? t("errors.unknown"))
                  return
                }

                toast.success(t("admin.tenancies.invitationCreated"))
                form.reset()
                setInviteRole("member")
                void revalidator.revalidate()
              })
              .catch((error) => toast.error(error instanceof Error ? error.message : t("errors.unknown")))
              .finally(() => setPending(null))
          }}
        >
          <Input
            name="email"
            type="email"
            scheme={theme}
            icon={<AtSign className="size-4" />}
            placeholder={t("admin.tenancies.memberEmail")}
            disabled={pending !== null}
            required
          />
          <RoleDropdown
            value={inviteRole}
            onValueChange={setInviteRole}
            disabled={pending !== null}
            className="h-12 min-w-32"
          />
          <Button
            type="submit"
            scheme={theme}
            disabled={pending !== null}
            icon={pending === "invite" ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          >
            {t("admin.tenancies.invite")}
          </Button>
        </form>

        <div className="space-y-3">
          {tenancy.members.map((member) => {
            const isOwner = member.role.split(",").includes("owner")
            const memberRole = role(member.role)

            return (
              <div
                className="flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 text-left transition hover:bg-muted"
                key={`${member.id}:${member.role}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    <AvatarImage src={member.user.image ?? undefined} alt={member.user.name} />
                    <AvatarFallback>{member.user.name.trim().charAt(0).toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{member.user.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{member.user.email}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <RoleDropdown
                    value={memberRole}
                    ariaLabel={`${t("admin.tenancies.role")}: ${member.user.name}`}
                    title={isOwner ? t("admin.tenancies.ownerLocked") : undefined}
                    disabled={isOwner || pending !== null}
                    onValueChange={(nextRole) => {
                      if (pending) return

                      setPending("member-role")
                      void authClient.organization
                        .updateMemberRole({
                          memberId: member.id,
                          role: nextRole,
                          organizationId: tenancy.id,
                        })
                        .then(({ error }) => {
                          if (error) {
                            toast.error(error.message ?? t("errors.unknown"))
                            return
                          }

                          toast.success(t("admin.tenancies.memberUpdated"))
                          void revalidator.revalidate()
                        })
                        .catch((error) => toast.error(error instanceof Error ? error.message : t("errors.unknown")))
                        .finally(() => setPending(null))
                    }}
                  />

                  <Button
                    type="button"
                    variant="transparent"
                    aria-label={`${t("admin.tenancies.removeMember")}: ${member.user.name}`}
                    title={isOwner ? t("admin.tenancies.ownerLocked") : undefined}
                    disabled={isOwner || pending !== null}
                    onClick={() => {
                      setConfirmation({
                        type: "member",
                        id: member.id,
                      })
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {invitations.length > 0 ? (
          <div className="space-y-3 pt-2">
            <h4 className="font-medium">{t("admin.tenancies.pendingInvitations")}</h4>
            {invitations.map((invitation) => (
              <div
                className="flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 text-left transition hover:bg-muted"
                key={invitation.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      <Mail className="size-4 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <p className="truncate font-medium">{invitation.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <RoleDropdown
                    value={role(invitation.role ?? "member")}
                    disabled
                    ariaLabel={`${t("admin.tenancies.role")}: ${invitation.email}`}
                  />
                  <Button
                    type="button"
                    variant="transparent"
                    scheme={theme}
                    disabled={pending !== null}
                    onClick={() => {
                      if (pending) return

                      setPending("invitation")
                      void authClient.organization
                        .cancelInvitation({
                          invitationId: invitation.id,
                        })
                        .then(({ error }) => {
                          if (error) {
                            toast.error(error.message ?? t("errors.unknown"))
                            return
                          }

                          toast.success(t("admin.tenancies.invitationCancelled"))
                          void revalidator.revalidate()
                        })
                        .catch((error) => toast.error(error instanceof Error ? error.message : t("errors.unknown")))
                        .finally(() => setPending(null))
                    }}
                  >
                    <X className="text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border border-red-500/20 bg-red-500/5 p-5 shadow-sm">
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-red-700 dark:text-red-300">
            <ShieldAlert className="size-5" />
            {t("admin.tenancies.sections.danger")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("admin.tenancies.deleteDescription", { slug: tenancy.slug })}
          </p>
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            color="red"
            textColor="white"
            scheme={theme}
            disabled={pending !== null}
            icon={<Trash2 />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            {t("admin.tenancies.delete")}
          </Button>
        </div>
      </section>

      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open && pending === null) setConfirmation(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {confirmation?.type === "sso" ? t("admin.tenancies.removeSso") : t("admin.tenancies.removeMember")}
            </DialogTitle>
            <DialogDescription>
              {confirmation?.type === "sso"
                ? t("admin.tenancies.removeSsoConfirm")
                : t("admin.tenancies.removeMemberConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="transparent" scheme={theme} disabled={pending !== null}>
                {t("common.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              color="red"
              textColor="white"
              scheme={theme}
              disabled={!confirmation || pending !== null}
              icon={
                pending === "remove" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="text-red-400" />
              }
              onClick={() => {
                if (!confirmation) return
                if (pending) return

                const action = confirmation
                setPending("remove")
                void (
                  action.type === "sso"
                    ? authClient.sso.deleteProvider({
                        providerId: action.providerId,
                      })
                    : authClient.organization.removeMember({
                        memberIdOrEmail: action.id,
                        organizationId: tenancy.id,
                      })
                )
                  .then(({ error }) => {
                    if (error) {
                      toast.error(error.message ?? t("errors.unknown"))
                      return
                    }

                    toast.success(
                      action.type === "sso" ? t("admin.tenancies.ssoDeleted") : t("admin.tenancies.memberRemoved"),
                    )
                    setConfirmation(null)
                    void revalidator.revalidate()
                  })
                  .catch((error) => toast.error(error instanceof Error ? error.message : t("errors.unknown")))
                  .finally(() => setPending(null))
              }}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (pending === null) {
            setDeleteDialogOpen(open)
            if (!open) setDeleteConfirmation("")
          }
        }}
      >
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (deleteConfirmation !== tenancy.slug) {
                toast.error(t("admin.tenancies.deleteConfirmationError"))
                return
              }
              if (pending) return

              setPending("delete-organization")
              const request = provider
                ? authClient.sso.deleteProvider({ providerId: provider.providerId }).then((result) =>
                    result.error
                      ? result
                      : authClient.organization.delete({
                          organizationId: tenancy.id,
                        }),
                  )
                : authClient.organization.delete({
                    organizationId: tenancy.id,
                  })

              void request
                .then(({ error }) => {
                  if (error) {
                    toast.error(error.message ?? t("errors.unknown"))
                    return
                  }

                  toast.success(t("admin.tenancies.deleteSuccess"))
                  void navigate("/app/administration/tenancies")
                })
                .catch((error) => toast.error(error instanceof Error ? error.message : t("errors.unknown")))
                .finally(() => setPending(null))
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-red-700 dark:text-red-300">
                {t("admin.tenancies.delete")}
              </DialogTitle>
              <DialogDescription>{t("admin.tenancies.deleteDescription", { slug: tenancy.slug })}</DialogDescription>
            </DialogHeader>

            <Input
              name="confirmation"
              scheme={theme}
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={tenancy.slug}
              autoComplete="off"
              disabled={pending !== null}
              required
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="transparent" scheme={theme} disabled={pending !== null}>
                  {t("common.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                color="red"
                textColor="white"
                scheme={theme}
                disabled={pending !== null || deleteConfirmation !== tenancy.slug}
                icon={
                  pending === "delete-organization" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )
                }
              >
                {pending === "delete-organization" ? t("common.deleting") : t("admin.tenancies.delete")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RoleDropdown({
  value,
  onValueChange,
  disabled,
  ariaLabel = t("admin.tenancies.role"),
  title,
  className,
}: {
  value: OrganizationRole
  onValueChange?: (value: OrganizationRole) => void
  disabled?: boolean
  ariaLabel?: string
  title?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!disabled) setOpen(nextOpen)
      }}
    >
      <PopoverTrigger asChild>
        <UiButton
          type="button"
          variant="outline"
          className={`min-w-32 justify-between font-normal ${className ?? ""}`}
          aria-label={ariaLabel}
          title={title}
          disabled={disabled}
        >
          {t(`admin.tenancies.roles.${value}`)}
          <ChevronDown className="size-4 text-muted-foreground" />
        </UiButton>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="end">
        {organizationRoles.map((organizationRole) => (
          <UiButton
            type="button"
            variant="ghost"
            className="w-full justify-start font-normal"
            onClick={() => {
              setOpen(false)
              if (organizationRole !== value) onValueChange?.(organizationRole)
            }}
            key={organizationRole}
          >
            <Check className={`size-4 ${organizationRole === value ? "opacity-100" : "opacity-0"}`} />
            {t(`admin.tenancies.roles.${organizationRole}`)}
          </UiButton>
        ))}
      </PopoverContent>
    </Popover>
  )
}
