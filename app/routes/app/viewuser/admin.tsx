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

import { useEffect, useState } from "react";
import { useLoaderData, useRouteLoaderData, useRevalidator, redirect, useNavigate } from "react-router";
import {
  KeyRound, Ban, MessageCircle, Trash2,
  ShieldUser, Loader2, MailCheck,
  UserRound,
  Lock,
  Unlock,
  FileWarning,
  Bell,
  ExternalLink,
  Gavel,
  ScanFace,
  XCircle,
  MailWarning,
  MessageSquareX,
} from "lucide-react";
import { Button, Input } from "@polarnl/polarui-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import type { SessionWithImpersonatedBy } from "better-auth/client/plugins";

import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { authClient } from "~/lib/auth/client";
import { notificationIcons } from "~/lib/notifications";
import { useTRPC } from "~/server/react";
import i18n from "~/i18n";
import type { Route } from "./+types/admin";
import { getRequestSession } from "~/server/trpc";
import { auth } from "~/lib/auth/server";
import type { UserModel } from "~/prisma/models";
import { set } from "zod";

export async function loader(loaderArgs: Route.LoaderArgs) {
  const userId = loaderArgs.params.id;
  if (!userId) {
    throw new Response("", { status: 400 });
  }

  const headers = new Headers(loaderArgs.request.headers);
  const result = await getRequestSession({ headers, request: loaderArgs.request });
  if (result?.user.role !== "admin") return redirect("/app");

  const adminUser = await auth.api.getUser({
    headers,
    query: {
      id: userId,
    },
  });

  if (!adminUser) {
    throw new Response("", { status: 404 });
  }

  return { adminUser: adminUser as UserModel };
}

export default function ViewUserAdminPage() {
  const { adminUser } = useLoaderData<typeof loader>();
  const layoutData = useRouteLoaderData(
    "../routes/app/viewuser/layout",
  ) as { user?: { email: string; username: string; displayUsername: string | null } } | undefined;

  const rootData = useRouteLoaderData("root");
  const theme = rootData?.theme ?? "dark";
  const t = i18n.t;
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const trpc = useTRPC();

  const target = {
    ...layoutData?.user,
    ...adminUser,
  };

  const targetLabel = target.displayUsername ?? target.name ?? target.id;

  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPw, setResetPw] = useState("");
  const [resetPwConfirm, setResetPwConfirm] = useState("");

  const [banOpen, setBanOpen] = useState(false);
  const [unbanOpen, setUnbanOpen] = useState(false);
  const [forumBanOpen, setForumBanOpen] = useState(false);
  const [forumUnbanOpen, setForumUnbanOpen] = useState(false);
  const [banReason, setBanReason] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);

  const [resetting, setResetting] = useState(false);
  const [platformBanPending, setPlatformBanPending] = useState(false);
  const [platformUnbanPending, setPlatformUnbanPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [roleChanging, setRoleChanging] = useState<null | "promote" | "demote">(null);
  const [verifyPending, setVerifyPending] = useState(false);
  const [impersonatePending, setImpersonatePending] = useState(false);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifIcon, setNotifIcon] = useState("info");
  const [notifContent, setNotifContent] = useState("");

  const sendNotifMutation = useMutation({
    ...trpc.notification.sendNotification.mutationOptions(),
    onSuccess: () => {
      toast.success(t("admin.users.notificationDialog.sent"));
      setNotifOpen(false);
      setNotifContent("");
      setNotifIcon("info");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("admin.users.notificationDialog.sendError"));
    },
  });

  const forumBanMutation = useMutation({
    ...trpc.admin.setForumBan.mutationOptions(),
    onSuccess: (result) => {
      toast.success(result === "BANNED" ? t("admin.users.forumBanApplied") : t("admin.users.forumBanLifted"));
      revalidator.revalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("admin.users.actionError"));
    },
  });

  const handleResetPassword = async () => {
    if (resetPw !== resetPwConfirm) {
      toast.error(t("admin.users.resetPasswordDialog.passwordMismatch"));
      return;
    }
    if (resetPw.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setResetting(true);
    try {
      const { error } = await authClient.admin.setUserPassword({
        userId: target.id,
        newPassword: resetPw,
      });
      if (error) throw new Error(error.message ?? "Failed to reset password");
      toast.success(t("admin.users.resetPasswordDialog.success"));
      setResetPwOpen(false);
      setResetPw("");
      setResetPwConfirm("");
    } catch (err: any) {
      toast.error(err.message ?? t("admin.users.actionError"));
    } finally {
      setResetting(false);
    }
  };

  const handlePlatformBan = async () => {
    if (!banReason.trim()) {
      toast.error(t("admin.users.banDialog.reasonRequired"));
      return;
    }
    setPlatformBanPending(true);
    try {
      const { error } = await authClient.admin.banUser({
        userId: target.id,
        banReason: banReason.trim(),
      });
      if (error) throw new Error(error.message ?? "Failed to ban user");
      toast.success(t("admin.users.banSuccess"));
      setBanOpen(false);
      setBanReason("");
      revalidator.revalidate();
    } catch (err: any) {
      toast.error(err.message ?? t("admin.users.actionError"));
    } finally {
      setPlatformBanPending(false);
    }
  };

  const handlePlatformUnban = async () => {
    setPlatformUnbanPending(true);
    try {
      const { error } = await authClient.admin.unbanUser({ userId: target.id });
      if (error) throw new Error(error.message ?? "Failed to unban user");
      toast.success(t("admin.users.unbanSuccess"));
      setUnbanOpen(false);
      revalidator.revalidate();
    } catch (err: any) {
      toast.error(err.message ?? t("admin.users.actionError"));
    } finally {
      setPlatformUnbanPending(false);
    }
  };

  const handleForumBan = () => {
    forumBanMutation.mutate({
      userId: target.id,
      banned: true,
      reason: banReason.trim() || undefined,
    });
    setForumBanOpen(false);
    setBanReason("");
  };

  const handleForumUnban = () => {
    forumBanMutation.mutate({ userId: target.id, banned: false });
    setForumUnbanOpen(false);
  };

  const handleDeleteUser = async () => {
    setDeletePending(true);
    try {
      const { error } = await authClient.admin.removeUser({ userId: target.id });
      if (error) throw new Error(error.message ?? "Failed to delete user");
      toast.success(t("admin.users.deleteSuccess"));
      setDeleteOpen(false);
      navigate("/app/administration/users")
    } catch (err: any) {
      toast.error(err.message ?? t("admin.users.actionError"));
    } finally {
      setDeletePending(false);
    }
  };

  const handleSendNotification = () => {
    if (!notifContent.trim()) {
      toast.error(t("admin.users.notificationDialog.contentRequired"));
      return;
    }
    sendNotifMutation.mutate({
      userId: target.id,
      icon: notifIcon,
      content: notifContent.trim(),
    });
  };

  const handleSetRole = async (role: "user" | "admin") => {
    setRoleChanging(role === "admin" ? "promote" : "demote");
    try {
      const { error } = await authClient.admin.setRole({
        userId: target.id,
        role,
      });
      if (error) throw new Error(error.message ?? "Failed to change role");
      toast.success(role === "admin" ? t("admin.users.promotedToAdmin") : t("admin.users.demotedFromAdmin"));
      revalidator.revalidate();
    } catch (err: any) {
      toast.error(err.message ?? t("admin.users.actionError"));
    } finally {
      setRoleChanging(null);
    }
  };

  const handleVerifyEmail = async () => {
    setVerifyPending(true);
    try {
      const { error } = await authClient.admin.updateUser({
        userId: target.id,
        data: { emailVerified: true },
      });
      if (error) throw new Error(error.message ?? "Failed to verify email");
      toast.success(t("admin.users.emailVerifiedSuccess"));
      revalidator.revalidate();
    } catch (err: any) {
      toast.error(err.message ?? t("admin.users.actionError"));
    } finally {
      setVerifyPending(false);
    }
  };

  const handleImpersonate = async () => {
    setImpersonatePending(true);
    try {
      const { error } = await authClient.admin.impersonateUser({ userId: target.id });
      if (error) throw new Error(error.message ?? "Failed to impersonate");
      window.location.href = "/app";
    } catch (err: any) {
      toast.error(err.message ?? t("admin.users.actionError"));
    } finally {
      setImpersonatePending(false);
    }
  };

  const isAdmin = target.role === "admin";
  const isBanned = !!target.banned;
  const isForumBanned = !!target.forumBanned;
  const isVerified = !!target.emailVerified;
  const platformBanReason = typeof target.banReason === "string" ? target.banReason.trim() : "";
  const forumBanReason = typeof target.forumBanReason === "string" ? target.forumBanReason.trim() : "";

  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionWithImpersonatedBy[] | false>();
  const [pendingDeletion, setPendingDeletion] = useState(false);

  useEffect(() => {
    const loadSessions = async () => {
      if (isSessionDialogOpen) {
        const session = await authClient.admin.listUserSessions({
          userId: target.id,
        });
        if (session.error) {
          setSessions(false);
        } else {
          setSessions(session.data.sessions);
        }
      }
    };

    void loadSessions();
  }, [isSessionDialogOpen, target.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {isVerified ? (
          <Badge variant="outline" className="h-auto rounded px-2 py-1 text-xs font-semibold bg-green-500 text-white">
            <MailCheck className="mr-1 h-3 w-3" /> {t("admin.users.badges.verified")}
          </Badge>
        ) : (
          <Badge variant="outline" className="h-auto rounded px-2 py-1 text-xs font-semibold bg-amber-500 text-white">
            <MailWarning className="mr-1 h-3 w-3" /> {t("admin.users.badges.unverified")}
          </Badge>
        )}
        {isBanned ? (
          <Badge variant="destructive" className="h-auto rounded px-2 py-1 text-xs font-semibold">
            <Gavel className="mr-1 h-3 w-3" /> {t("admin.users.badges.platformBanned")}
          </Badge>
        ) : null}
        {isForumBanned ? (
          <Badge variant="outline" className="h-auto rounded px-2 py-1 text-xs font-semibold bg-orange-500 text-white">
            <MessageSquareX className="mr-1 h-3 w-3" /> {t("admin.users.badges.forumBanned")}
          </Badge>
        ) : null}
        {isAdmin ? (
          <Badge variant="outline" className="h-auto rounded px-2 py-1 text-xs font-semibold bg-red-500 text-white">
            <ShieldUser className="mr-1 h-3 w-3" /> {t("admin.users.badges.admin")}
          </Badge>
        ) : null}
      </div>

      {platformBanReason || forumBanReason ? (
        <div className="space-y-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          {platformBanReason ? (
            <p>
              <span className="font-semibold">{t("admin.users.banReasons.platform")}</span>{" "}
              {platformBanReason}
            </p>
          ) : null}
          {forumBanReason ? (
            <p>
              <span className="font-semibold">{t("admin.users.banReasons.forum")}</span>{" "}
              {forumBanReason}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          scheme={theme}
          variant="transparent"
          className={"w-full justify-start"}
          icon={<KeyRound className="size-4" />}
          onClick={() => {
            setResetPw("");
            setResetPwConfirm("");
            setResetPwOpen(true);
          }}
        >
          {t("admin.users.actions.resetPassword")}
        </Button>

        {isBanned ? (
          <Button
            scheme={theme}
            variant="transparent"
            className={"w-full justify-start"}
            icon={<Unlock className="size-4" />}
            onClick={() => setUnbanOpen(true)}
          >
            {t("admin.users.actions.platformUnban")}
          </Button>
        ) : (
          <Button
            scheme={theme}
            variant="transparent"
            className={"w-full justify-start"}
            icon={<Lock className="size-4" />}
            onClick={() => { setBanReason(""); setBanOpen(true); }}
          >
            {t("admin.users.actions.platformBan")}
          </Button>
        )}

        {isForumBanned ? (
          <Button
            scheme={theme}
            variant="transparent"
            className={"w-full justify-start"}
            icon={<MessageCircle className="size-4" />}
            onClick={() => setForumUnbanOpen(true)}
          >
            {t("admin.users.actions.forumUnban")}
          </Button>
        ) : (
          <Button
            scheme={theme}
            variant="transparent"
            className={"w-full justify-start"}
            icon={<Ban className="size-4" />}
            onClick={() => { setBanReason(""); setForumBanOpen(true); }}
          >
            {t("admin.users.actions.forumBan")}
          </Button>
        )}

        <Button
          scheme={theme}
          variant="transparent"
          className={"w-full justify-start"}
          icon={<Trash2 className="size-4" />}
          onClick={() => setDeleteOpen(true)}
        >
          {t("admin.users.actions.delete")}
        </Button>

        <Button
          scheme={theme}
          variant="transparent"
          className={"w-full justify-start"}
          icon={<Bell className="size-4" />}
          onClick={() => { setNotifIcon("info"); setNotifContent(""); setNotifOpen(true); }}
        >
          {t("admin.users.actions.sendNotification")}
        </Button>

        {isAdmin ? (
          <Button
            scheme={theme}
            variant="transparent"
            className={"w-full justify-start"}
            onClick={() => { void handleSetRole("user"); }}
            disabled={roleChanging !== null}
            icon={roleChanging === "demote" ? <Loader2 className="size-4 animate-spin" /> : <UserRound className="size-4" />}
          >
            {t("admin.users.actions.demote")}
          </Button>
        ) : (
          <Button
            scheme={theme}
            variant="transparent"
            className={"w-full justify-start"}
            icon={roleChanging === "promote" ? <Loader2 className="size-4 animate-spin" /> : <ShieldUser className="size-4" />}
            onClick={() => { void handleSetRole("admin"); }}
            disabled={roleChanging !== null}
          >
            {t("admin.users.actions.appoint")}
          </Button>
        )}
        <Button
          scheme={theme}
          variant="transparent"
          className={"w-full justify-start"}
          icon={<ScanFace className="size-4" />}
          onClick={() => setIsSessionDialogOpen(true)}
        >
          {t("admin.users.session.viewSessions")}
        </Button>
        <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle>{t("admin.users.session.viewSessions")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {sessions === false ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <XCircle className="size-6" />
                  <p className="text-sm text-muted-foreground">{t("admin.users.session.loadError")}</p>
                </div>
              ) : sessions?.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("admin.users.session.noSessions")}</p>
              ) : (
                <ul className="space-y-2">
                  {sessions?.map((session) => (
                    <li key={session.id} className="rounded-lg border border-border bg-neutral-200 dark:bg-neutral-800 px-4 py-3 text-sm">
                      <p><span className="font-semibold">{t("admin.users.session.sessionId")}:</span> {session.id}</p>
                      <p><span className="font-semibold">{t("admin.users.session.createdAt")}:</span> {new Date(session.createdAt).toLocaleString()}</p>
                      <p><span className="font-semibold">{t("admin.users.session.ipAddress")}:</span> {session.ipAddress}</p>
                      <p><span className="font-semibold">{t("admin.users.session.userAgent")}:</span> {session.userAgent}</p>
                      <Button
                        color="red"
                        textColor="white"
                        disabled={pendingDeletion}
                        icon={pendingDeletion ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                        onClick={async () => {
                          try {
                            setPendingDeletion(true);
                            await authClient.admin.revokeUserSession({
                              sessionToken: session.token, 
                            })
                            toast.success(t("admin.users.session.revokeSuccess"));
                            const newSessions = await authClient.admin.listUserSessions({
                              userId: target.id,
                            });
                            if (newSessions.error) {
                              setSessions(false);
                            } else {
                              setSessions(newSessions.data.sessions);
                            }
                          } catch {
                            toast.error(t("errors.unknown"))
                          } finally {
                            setPendingDeletion(false);
                          }
                        }}
                      >
                        {t("admin.users.session.revokeSession")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogContent>
        </Dialog>
        {!isVerified ? (
          <Button
            scheme={theme}
            variant="transparent"
            className={"w-full justify-start"}
            onClick={() => { void handleVerifyEmail(); }}
            disabled={verifyPending}
            icon={verifyPending ? <Loader2 className="size-4 animate-spin" /> : <MailCheck className="size-4" />}
          >
            {t("admin.users.actions.forceVerifyEmail")}
          </Button>
        ) : null}

        <Button
          scheme={theme}
          variant="transparent"
          className={"w-full justify-start"}
          icon={impersonatePending ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
          onClick={() => { void handleImpersonate(); }}
          disabled={impersonatePending}
        >
          {t("admin.users.actions.impersonate")}
        </Button>
      </div>

      <Dialog open={resetPwOpen} onOpenChange={(open) => { if (open) { setResetPw(""); setResetPwConfirm(""); } setResetPwOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.resetPasswordDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("admin.users.resetPasswordDialog.description", { user: targetLabel })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <FileWarning className="size-3.5" />
              {t("admin.users.resetPasswordDialog.warning")}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("admin.users.resetPasswordDialog.newPasswordLabel")}</label>
              <Input
                scheme={theme}
                type="password"
                placeholder={t("admin.users.resetPasswordDialog.newPasswordPlaceholder")}
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("admin.users.resetPasswordDialog.confirmPasswordLabel")}</label>
              <Input
                scheme={theme}
                type="password"
                placeholder={t("admin.users.resetPasswordDialog.confirmPasswordPlaceholder")}
                value={resetPwConfirm}
                onChange={(e) => setResetPwConfirm(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="transparent" scheme={theme}>{t("common.cancel")}</Button>
            </DialogClose>
            <Button
              scheme={theme}
              type="button"
              color="red"
              textColor="white"
              disabled={!resetPw || !resetPwConfirm || resetting}
              icon={resetting ? <Loader2 className="size-4 animate-spin" /> : resetPw ? <KeyRound className="size-4" /> : undefined}
              onClick={() => { void handleResetPassword(); }}
            >
              {t("admin.users.resetPasswordDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.banDialog.platformTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.users.banDialog.description", { user: targetLabel })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("admin.users.banDialog.reasonLabel")}</label>
              <Input
                scheme={theme}
                placeholder={t("admin.users.banDialog.reasonPlaceholder")}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="transparent" scheme={theme}>{t("common.cancel")}</Button>
            </DialogClose>
            <Button
              scheme={theme}
              type="button"
              color="red"
              textColor="white"
              disabled={!banReason.trim() || platformBanPending}
              icon={platformBanPending ? <Loader2 className="size-4 animate-spin" /> : <Gavel className="size-4" />}
              onClick={() => { void handlePlatformBan(); }}
            >
              {t("admin.users.banDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unbanOpen} onOpenChange={setUnbanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.unbanDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("admin.users.unbanDialog.description", { user: targetLabel })}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="transparent" scheme={theme}>{t("common.cancel")}</Button>
            </DialogClose>
            <Button
              scheme={theme}
              type="button"
              color="green"
              textColor="white"
              disabled={platformUnbanPending}
              icon={platformUnbanPending ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />}
              onClick={() => { void handlePlatformUnban(); }}
            >
              {t("admin.users.unbanDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={forumBanOpen} onOpenChange={setForumBanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.banDialog.forumTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.users.banDialog.description", { user: targetLabel })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("admin.users.banDialog.reasonLabel")}</label>
              <Input
                scheme={theme}
                placeholder={t("admin.users.banDialog.reasonPlaceholder")}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="transparent" scheme={theme}>{t("common.cancel")}</Button>
            </DialogClose>
            <Button
              scheme={theme}
              type="button"
              color="red"
              textColor="white"
              disabled={!banReason.trim() || forumBanMutation.isPending}
              icon={forumBanMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
              onClick={handleForumBan}
            >
              {forumBanMutation.isPending ? t("admin.users.banDialog.saving") : t("admin.users.banDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={forumUnbanOpen} onOpenChange={setForumUnbanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.forumUnbanDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("admin.users.forumUnbanDialog.description", { user: targetLabel })}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="transparent" scheme={theme}>{t("common.cancel")}</Button>
            </DialogClose>
            <Button
              scheme={theme}
              type="button"
              color="green"
              textColor="white"
              disabled={forumBanMutation.isPending}
              icon={forumBanMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />}
              onClick={handleForumUnban}
            >
              {t("admin.users.forumUnbanDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-700 dark:text-red-300">{t("admin.users.deleteDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("admin.users.deleteDialog.description", { user: targetLabel })}
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <FileWarning className="size-4" />
            {t("admin.users.deleteDialog.warning")}
          </p>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="transparent" scheme={theme}>{t("common.cancel")}</Button>
            </DialogClose>
            <Button
              scheme={theme}
              type="button"
              color="red"
              textColor="white"
              disabled={deletePending}
              icon={deletePending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              onClick={() => { void handleDeleteUser(); }}
            >
              {t("admin.users.deleteDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={notifOpen} onOpenChange={setNotifOpen}>
        <DialogContent>
          <DialogHeader>ik
            <DialogTitle>{t("admin.users.notificationDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("admin.users.notificationDialog.description", { user: targetLabel })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("admin.users.notificationDialog.iconLabel")}</label>
              <div className="flex flex-wrap gap-2">
                {notificationIcons.map((iconDef) => {
                  const IconComp = iconDef.icon;
                  return (
                    <button
                      key={iconDef.value}
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition cursor-pointer ${notifIcon === iconDef.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:bg-muted"
                        }`}
                      onClick={() => setNotifIcon(iconDef.value)}
                    >
                      <IconComp className="size-4" />
                      {t(iconDef.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("admin.users.notificationDialog.messageLabel")}</label>
              <textarea
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 min-h-20 resize-y"
                placeholder={t("admin.users.notificationDialog.placeholder")}
                value={notifContent}
                onChange={(e) => setNotifContent(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="transparent" scheme={theme}>{t("common.cancel")}</Button>
            </DialogClose>
            <Button
              scheme={theme}
              type="button"
              disabled={!notifContent.trim() || sendNotifMutation.isPending}
              icon={sendNotifMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
              onClick={handleSendNotification}
            >
              {sendNotifMutation.isPending ? t("admin.users.notificationDialog.sending") : t("admin.users.notificationDialog.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
