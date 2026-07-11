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

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AtSign, Download, Eye, EyeOff, Loader2, Lock, Save, Trash2, Upload, X } from "lucide-react";
import { CheckWithLabel, Button, Input } from "@polarnl/polarui-react";
import {
  redirect,
  useLoaderData,
  useNavigation,
  useRouteLoaderData,
  useNavigate,
} from "react-router";
import { toast } from "sonner";

import i18n from "~/i18n";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { authClient } from "~/lib/auth/client";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { exportAccountAction } from "~/lib/export";
import { prisma } from "~/lib/db";
import type { Route } from "./+types/usersettings";
import { getRequestSession } from "~/server/trpc";

const EXPORT_COOLDOWN = 7 * 24 * 60 * 60 * 1000;

export async function loader({ request }: Route.LoaderArgs) {
  const headers = new Headers(request.headers);
  const session = await getRequestSession({ headers, request });

  if (!session?.user) {
    const url = new URL(request.url);
    return redirect(`/auth/sign-in?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { theme: true, optinAI: true, lastExportedAt: true, username: true, displayUsername: true, image: true },
  });

  return {
    theme: user?.theme ?? "dark",
    aiFeatures: user?.optinAI ?? false,
    username: user?.username ?? null,
    displayUsername: user?.displayUsername ?? null,
    image: user?.image ?? null,
    lastExportedAt: user?.lastExportedAt?.toISOString() ?? null,
    nextExportAvailableAt: user?.lastExportedAt
      ? new Date(user.lastExportedAt.getTime() + EXPORT_COOLDOWN).toISOString()
      : null,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const headers = new Headers(request.headers);
  const session = await getRequestSession({ headers, request });

  if (!session?.user) {
    const url = new URL(request.url);
    return redirect(`/auth/sign-in?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
  }

  const formData = await request.formData();
  const theme = formData.get("theme") as "light" | "dark" | null;
  const aiFeatures = formData.get("aiFeatures") === "true";

  if (!theme) {
    return new Response("Invalid theme", { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      theme,
      optinAI: aiFeatures,
    },
  });

  return redirect("/app/usersettings");
}

export default function UserSettings() {
  const loaderData = useLoaderData<typeof loader>();
  const savedTheme = loaderData?.theme ?? "dark";
  const savedAiFeatures = loaderData?.aiFeatures ?? false;
  const savedUsername = loaderData?.username ?? "";
  const savedDisplayUsername = loaderData?.displayUsername ?? savedUsername;
  const initialNextExportAvailableAt = loaderData?.nextExportAvailableAt ?? null;
  const rootData = useRouteLoaderData("root");
  const navigation = useNavigation();
  const navigate = useNavigate();
  const t = i18n.t;
  const scheme = rootData?.theme ?? "dark";

  const [theme, setTheme] = useState<"light" | "dark">(savedTheme as "light" | "dark");
  const [aiFeatures, setAiFeatures] = useState(savedAiFeatures);
  const [username, setUsername] = useState(savedUsername);
  const [displayUsername, setDisplayUsername] = useState(savedDisplayUsername);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [nextExportAvailableAt, setNextExportAvailableAt] = useState<string | null>(initialNextExportAvailableAt);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [profileImage, setProfileImage] = useState(loaderData?.image ?? null);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [isUpdatingProfilePicture, setIsUpdatingProfilePicture] = useState(false);
  const profilePictureInput = useRef<HTMLInputElement>(null);
  const isPending = navigation.state !== "idle";
  const themeHasChanges = theme !== savedTheme;
  const aiHasChanges = aiFeatures !== savedAiFeatures;
  const usernameHasChanges = username.trim() !== savedUsername || displayUsername.trim() !== savedDisplayUsername;
  const exportAvailableAt = nextExportAvailableAt ? new Date(nextExportAvailableAt) : null;
  const canExport = !exportAvailableAt || exportAvailableAt <= new Date();
  const exportAvailableLabel = exportAvailableAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(exportAvailableAt)
    : null;

  const handleUsernameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isUpdatingUsername) {
      return;
    }

    const nextUsername = username.trim();
    const nextDisplayUsername = displayUsername.trim();

    if (!nextUsername) {
      toast.error(t("userSettings.account.emptyUsernameError"));
      return;
    }

    setIsUpdatingUsername(true);

    try {
      const result = await authClient.updateUser({
        username: nextUsername,
        ...(nextDisplayUsername && nextDisplayUsername !== nextUsername
          ? { displayUsername: nextDisplayUsername }
          : {}),
      });

      if (result?.error) {
        toast.error(result.error.message ?? t("userSettings.account.error"));
        return;
      }

      setUsername(nextUsername);
      setDisplayUsername(nextDisplayUsername || nextUsername);
      toast.success(t("userSettings.account.success"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("userSettings.account.error"));
    } finally {
      setIsUpdatingUsername(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isChangingPassword) {
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t("userSettings.password.requiredError"));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("userSettings.password.mismatchError"));
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        toast.error(error.message ?? t("userSettings.password.error"));
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t("userSettings.password.success"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("userSettings.password.error"));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const avatarError = (code?: string) => {
    const key = `userSettings.avatar.errors.${code}`;
    const translated = t(key);
    return translated === key ? t("userSettings.avatar.error") : translated;
  };

  const clearProfilePictureSelection = () => {
    if (profilePicturePreview) URL.revokeObjectURL(profilePicturePreview);
    setProfilePicture(null);
    setProfilePicturePreview(null);
    if (profilePictureInput.current) profilePictureInput.current.value = "";
  };

  const handleProfilePictureSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0];
    if (!image) return;

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.type)) {
      toast.error(t("userSettings.avatar.errors.INVALID_IMAGE"));
      return;
    }

    if (image.size > 5 * 1024 * 1024) {
      toast.error(t("userSettings.avatar.errors.IMAGE_TOO_LARGE"));
      return;
    }

    clearProfilePictureSelection();
    setProfilePicture(image);
    setProfilePicturePreview(URL.createObjectURL(image));
  };

  const handleProfilePictureUpload = async () => {
    if (!profilePicture || isUpdatingProfilePicture) return;

    setIsUpdatingProfilePicture(true);
    try {
      const formData = new FormData();
      formData.set("image", profilePicture);
      const response = await fetch("/api/profile-picture", { method: "POST", body: formData });
      const result = await response.json() as { code?: string; imageUrl?: string };

      if (!response.ok || !result.imageUrl) {
        toast.error(avatarError(result.code));
        return;
      }

      setProfileImage(result.imageUrl);
      clearProfilePictureSelection();
      await authClient.updateUser({ image: result.imageUrl });
      toast.success(t("userSettings.avatar.success"));
    } catch {
      toast.error(t("userSettings.avatar.error"));
    } finally {
      setIsUpdatingProfilePicture(false);
    }
  };

  const handleProfilePictureDelete = async () => {
    if (isUpdatingProfilePicture) return;

    setIsUpdatingProfilePicture(true);
    try {
      const response = await fetch("/api/profile-picture", { method: "DELETE" });
      const result = await response.json() as { code?: string };

      if (!response.ok) {
        toast.error(avatarError(result.code));
        return;
      }

      setProfileImage(null);
      await authClient.updateUser({ image: null });
      toast.success(t("userSettings.avatar.removed"));
    } catch {
      toast.error(t("userSettings.avatar.errors.DELETE_FAILED"));
    } finally {
      setIsUpdatingProfilePicture(false);
    }
  };

  const handleExportAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isExporting || !canExport) {
      return;
    }

    setIsExporting(true);

    try {
      const result = await exportAccountAction();

      if (!result.ok) {
        if (result.error === "EXPORT_COOLDOWN") {
          const availableAt = result.availableAt;
          if (availableAt) {
            setNextExportAvailableAt(availableAt);
          }

          toast.error(t("userSettings.export.cooldownError", {
            date: availableAt
              ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(availableAt))
              : exportAvailableLabel ?? "",
          }));
          return;
        }

        toast.error(t("userSettings.export.error"));
        return;
      }

      if (!result.content || !result.filename) {
        toast.error(t("userSettings.export.error"));
        return;
      }

      const content = result.content;
      const filename = result.filename ?? `polarlearn-account-export-${new Date().toISOString().slice(0, 10)}.json`;

      const blob = new Blob([content], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNextExportAvailableAt(result.nextExportAvailableAt ?? new Date(Date.now() + EXPORT_COOLDOWN).toISOString());
      toast.success(t("userSettings.export.success"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("userSettings.export.error"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);

    try {
      const result = (await authClient.deleteUser()) as unknown;

      if (
        result &&
        typeof result === "object" &&
        "error" in result &&
        (result as { error?: { message?: string } | null }).error
      ) {
        toast.error(
          (result as { error?: { message?: string } | null }).error?.message ??
          t("userSettings.delete.error"),
        );
        return;
      }

      setIsDeleteDialogOpen(false);
      navigate("/auth/sign-in", { replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("userSettings.delete.error"),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4">
      <div className="max-w-2xl space-y-4">
        <div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("userSettings.description")}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <form className="space-y-4" onSubmit={handleUsernameSubmit}>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">{t("userSettings.account.title")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("userSettings.account.description")}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="username">
                    {t("userSettings.account.usernameLabel")}
                  </label>
                  <Input
                    id="username"
                    scheme={scheme}
                    icon={<AtSign />}
                    value={username}
                    onChange={(event) => { setUsername(event.target.value); }}
                    placeholder={t("userSettings.account.usernamePlaceholder")}
                    autoComplete="username"
                    disabled={isPending || isUpdatingUsername}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="displayUsername">
                    {t("userSettings.account.displayUsernameLabel")}
                  </label>
                  <Input
                    id="displayUsername"
                    scheme={scheme}
                    value={displayUsername}
                    onChange={(event) => { setDisplayUsername(event.target.value); }}
                    placeholder={t("userSettings.account.displayUsernamePlaceholder")}
                    autoComplete="name"
                    disabled={isPending || isUpdatingUsername}
                  />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                {t("userSettings.account.helper")}
              </p>

              <div className="flex justify-end">
                <Button
                  scheme={scheme}
                  type="submit"
                  disabled={isPending || isUpdatingUsername || !usernameHasChanges}
                  icon={isUpdatingUsername ? <Loader2 className="animate-spin" /> : <Save />}
                >
                  {isUpdatingUsername ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">{t("userSettings.avatar.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("userSettings.avatar.description")}</p>
            </div>

            <div className="flex items-center gap-4">
              <Avatar className="size-20">
                <AvatarImage src={profilePicturePreview ?? profileImage ?? undefined} alt={displayUsername || username} />
                <AvatarFallback>{(displayUsername || username || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{profileImage ? t("userSettings.avatar.current") : t("userSettings.avatar.empty")}</p>
                <p className="text-sm text-muted-foreground">{t("userSettings.avatar.formats")}</p>
              </div>
            </div>

            {profilePicture ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t("userSettings.avatar.selected")}</p>
                  <p className="truncate text-sm text-muted-foreground">{profilePicture.name}</p>
                </div>
                <Button type="button" variant="transparent" scheme={scheme} onClick={clearProfilePictureSelection} disabled={isUpdatingProfilePicture} icon={<X className="size-4" />}>
                  {t("common.cancel")}
                </Button>
                <Button type="button" scheme={scheme} onClick={() => { void handleProfilePictureUpload(); }} disabled={isUpdatingProfilePicture} icon={isUpdatingProfilePicture ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}>
                  {isUpdatingProfilePicture ? t("userSettings.avatar.uploading") : t("userSettings.avatar.upload")}
                </Button>
              </div>
            ) : null}

            <input ref={profilePictureInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={handleProfilePictureSelect} disabled={isUpdatingProfilePicture} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" scheme={scheme} onClick={() => profilePictureInput.current?.click()} disabled={isUpdatingProfilePicture} icon={<Upload className="size-4" />}>
                {t("userSettings.avatar.select")}
              </Button>
              {profileImage ? (
                <Button type="button" scheme={scheme} color="red" textColor="white" onClick={() => { void handleProfilePictureDelete(); }} disabled={isUpdatingProfilePicture} icon={isUpdatingProfilePicture ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}>
                  {isUpdatingProfilePicture ? t("userSettings.avatar.removing") : t("userSettings.avatar.remove")}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">{t("userSettings.password.title")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("userSettings.password.description")}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="currentPassword">
                    {t("userSettings.password.currentPasswordLabel")}
                  </label>
                  <Input
                    id="currentPassword"
                    scheme={scheme}
                    icon={<Lock />}
                    type={showPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(event) => { setCurrentPassword(event.target.value); }}
                    placeholder={t("userSettings.password.currentPasswordPlaceholder")}
                    autoComplete="current-password"
                    disabled={isPending || isChangingPassword}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="newPassword">
                    {t("userSettings.password.newPasswordLabel")}
                  </label>
                  <Input
                    id="newPassword"
                    scheme={scheme}
                    icon={<Lock />}
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => { setNewPassword(event.target.value); }}
                    placeholder={t("userSettings.password.newPasswordPlaceholder")}
                    autoComplete="new-password"
                    disabled={isPending || isChangingPassword}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="confirmPassword">
                    {t("userSettings.password.confirmPasswordLabel")}
                  </label>
                  <Input
                    id="confirmPassword"
                    scheme={scheme}
                    icon={<Lock />}
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => { setConfirmPassword(event.target.value); }}
                    placeholder={t("userSettings.password.confirmPasswordPlaceholder")}
                    autoComplete="new-password"
                    disabled={isPending || isChangingPassword}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="transparent"
                  scheme={theme}
                  onClick={() => { setShowPassword((current) => !current); }}
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  <span>{showPassword ? t("userSettings.password.hidePassword") : t("userSettings.password.showPassword")}</span>
                </Button>

                <Button
                  scheme={scheme}
                  type="submit"
                  disabled={isPending || isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                  icon={isChangingPassword ? <Loader2 className="animate-spin" /> : <Save />}
                >
                  {isChangingPassword ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          </div>

          <div className="space-y-4 rounded-xl bg-card p-5 shadow-sm">
            <form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="settings" />
              <input type="hidden" name="theme" value={theme} />
              <input type="hidden" name="aiFeatures" value={aiFeatures ? "true" : "false"} />

              <div className="space-y-2">
                <h2 className="text-lg font-semibold">{t("userSettings.theme.title")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("userSettings.theme.description")}
                </p>
              </div>

              <CheckWithLabel
                label={theme === "dark" ? t("userSettings.theme.dark") : t("userSettings.theme.light")}
                checked={theme === "dark"}
                onChange={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                className="[&>span:last-child]:text-neutral-900! dark:[&>span:last-child]:text-neutral-100!"
              />

              <div className="flex justify-end">
                <Button
                  scheme={scheme}
                  type="submit"
                  disabled={isPending || !themeHasChanges}
                  icon={isPending ? <Loader2 className="animate-spin" /> : <Save />}
                >
                  {isPending ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="settings" />
              <input type="hidden" name="theme" value={theme} />
              <input type="hidden" name="aiFeatures" value={aiFeatures ? "true" : "false"} />

              <div className="space-y-2">
                <h2 className="text-lg font-semibold">{t("userSettings.ai.title")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("userSettings.ai.description")}
                </p>
              </div>

              <CheckWithLabel
                label={t("userSettings.ai.label")}
                checked={aiFeatures}
                onChange={() => setAiFeatures((current) => !current)}
                className="[&>span:last-child]:text-neutral-900! dark:[&>span:last-child]:text-neutral-100!"
              />

              <div className="flex justify-end">
                <Button
                  scheme={scheme}
                  type="submit"
                  disabled={isPending || !aiHasChanges}
                  icon={isPending ? <Loader2 className="animate-spin" /> : <Save />}
                >
                  {isPending ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          </div>
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <form method="post" className="space-y-4" onSubmit={handleExportAccount}>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">{t("userSettings.export.title")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("userSettings.export.description")}
                </p>
                {!canExport && exportAvailableLabel ? (
                  <p className="text-sm text-muted-foreground">
                    {t("userSettings.export.cooldown", { date: exportAvailableLabel })}
                  </p>
                ) : null}
              </div>

              <div className="flex justify-end">
                <Button
                  scheme={scheme}
                  type="submit"
                  disabled={isPending || isExporting || !canExport}
                  icon={isExporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                >
                  {isExporting ? t("userSettings.export.exporting") : t("userSettings.export.button")}
                </Button>
              </div>
            </form>
          </div>
          <div className="space-y-4 rounded-xl border border-red-500/20 bg-red-500/5 p-5 shadow-sm">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">
                {t("userSettings.delete.title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("userSettings.delete.description")}
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                scheme={scheme}
                type="button"
                color="red"
                textColor="white"
                disabled={isPending || isDeleting}
                icon={<Trash2 className="size-4" />}
                onClick={() => {
                  setIsDeleteDialogOpen(true);
                }}
              >
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setIsDeleteDialogOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-red-700 dark:text-red-300">
              {t("userSettings.delete.title")}
            </DialogTitle>
            <DialogDescription>
              {t("userSettings.delete.warning")}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="transparent" scheme={scheme} disabled={isDeleting}>
                {t("common.cancel")}
              </Button>
            </DialogClose>
            <Button
              scheme={scheme}
              type="button"
              color="red"
              textColor="white"
              disabled={isDeleting}
              icon={isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              onClick={() => {
                void handleDeleteAccount();
              }}
            >
              {isDeleting ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
