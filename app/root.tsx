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
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  ScrollRestoration,
  useNavigation,
  useRouteLoaderData,
} from "react-router";
import { useEffect, useState } from "react";
import { ChevronDown, Megaphone } from "lucide-react";
import NProgress from "nprogress";

import type { Route } from "./+types/root";
import "nprogress/nprogress.css";
import "./app.css";
import { initI18n } from "./i18n";
import { Toaster } from "./components/ui/sonner";
import i18n from "./i18n";
import polarlearnLogo from "~/img/polarlearn.svg";
import { prisma } from "./lib/db";
import { createCallerFactory, createTRPCContext, getRequestSession } from "./server/trpc";
import { appRouter } from "./server/main";
import { TRPCReactProvider } from "./server/react";
import ImpersonationBanner from "./components/impersonation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Button } from "@polarnl/polarui-react";
import { auth } from "./lib/auth/server";

NProgress.configure({ showSpinner: false });

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: polarlearnLogo },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
  },
  {
    rel: "icon",
    href: "/polarlearn.svg",
    type: "image/svg+xml"
  },
];

export function meta({ }: Route.MetaArgs) {
  const t = i18n.t;
  return [
    { title: "PolarLearn" },
    { name: "description", content: t("home.description") },
    { name: "twitter:card", content: "summary" },
    { property: "og:title", content: "PolarLearn" },
    { property: "og:description", content: t("home.description") },
    { property: "og:image", content: '/banner.png' },
  ]
}
// the provided info from loader likely wont change during navigation
export function shouldRevalidate() {
  return false
}

export async function loader(loaderArgs: { request: Request }) {
  const headers = new Headers(loaderArgs.request.headers)
  const result = await getRequestSession({ headers, request: loaderArgs.request })
  const user = result?.user
  const session = result?.session
  const userRecord = user as Record<string, unknown> | undefined
  const sessionRecord = session as Record<string, unknown> | undefined
  const theme = userRecord?.theme as 'light' | 'dark'
  const activeOrganizationId = sessionRecord?.activeOrganizationId as string ?? null
  const ctx = await createTRPCContext({ headers, request: loaderArgs.request, session: result })
  const caller = createCallerFactory(appRouter)(ctx)

  const [notificationResult, unreadNotificationsCount, announcement, tenancy, tenancyMembership] = await Promise.all([
    user?.id
      ? caller.notification.getNotifications({ limit: 5 }).then(r => ({ notifications: r.notifications, nextCursor: r.nextCursor }))
      : Promise.resolve({ notifications: [], nextCursor: undefined }),
    user?.id
      ? prisma.notification.count({
          where: {
            userId: user.id,
            read: false,
          },
        })
      : Promise.resolve(0),
    prisma.config.findFirst({
      where: {
        scope: activeOrganizationId ?? "global",
        key: "announcement",
      },
    }),
    userRecord?.role === "admin" && activeOrganizationId
      ? prisma.organization.findUnique({
          where: { id: activeOrganizationId },
          select: { id: true, name: true, slug: true, logo: true },
        })
      : Promise.resolve(null),
    activeOrganizationId
      ? auth.api.getActiveMember({ headers })
      : Promise.resolve(null),
  ])
  return {
    theme,
    lang: process.env.APP_LANG ?? "nl",
    user: {
      id: user?.id ?? null,
      name: user?.name ?? null,
      image: user?.image ?? null,
      email: user?.email ?? null,
      role: userRecord?.role ?? null,
      forumBanned: userRecord?.forumBanned === true,
      forumBanReason: userRecord?.forumBanReason ?? null,
    },
    impersonatedBy: sessionRecord?.impersonatedBy ?? null,
    tenancy,
    tenancyMembership,
    notifications: notificationResult.notifications,
    notificationsNextCursor: notificationResult.nextCursor ?? null,
    unreadNotificationsCount,
    announcement: announcement?.value ?? null,
  };
}

function AnnouncementDialog({ announcement }: { announcement: string }) {
  const [open, setOpen] = useState(true);
  const t = i18n.t;
  const storageKey = `polarlearn.announcement-${btoa(announcement)}`;

  useEffect(() => {
    if (localStorage.getItem(storageKey)) {
      setOpen(false);
    }
  }, [storageKey]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex flex-row gap-2 items-center font-bold text-xl">
            <Megaphone />
            {t("navigation.announcement")}
          </DialogTitle>
        </DialogHeader>
        <p>{announcement}</p>
        <DialogFooter>
          <Button
            onClick={() => {
              localStorage.setItem(storageKey, "1");
              setOpen(false);
            }}
          >
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const loaderData = useRouteLoaderData<typeof loader>("root");
  const navigation = useNavigation();
  const theme = loaderData?.theme ?? "dark";
  const lang = loaderData?.lang;

  useEffect(() => {
    if (navigation.state === "idle") {
      NProgress.done();
    } else {
      NProgress.start();
    }
  }, [navigation.state]);

  initI18n(lang);

  return (
    <html lang={lang} className={theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="font-sans">
        <Toaster richColors position="top-center" theme={theme} />
        <TRPCReactProvider>
          <ImpersonationBanner />
          {loaderData?.announcement ? (
            <AnnouncementDialog announcement={loaderData.announcement} />
          ) : null}
          {children}
        </TRPCReactProvider>
        <ScrollRestoration />
      </body>
    </html>
  );
}

// istg if anyone removes this i will find you and I will end you
// remove = break entire app
// neither do i know why it is like that
// best regards andrei1010
export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const t = i18n.t;
  let message = t("errors.page.unavailableTitle");
  let details = t("errors.500.message");
  let stack: string | undefined;
  let technicalDetails = t("errors.unknown");

  if (isRouteErrorResponse(error)) {
    message =
      error.status === 404
        ? t("errors.404.title")
        : t("errors.page.unavailableTitle");
    details =
      error.status === 404 ? t("errors.404.message") : t("errors.500.message");
    technicalDetails = error.statusText || error.status.toString();
  } else if (error && error instanceof Error) {
    details = error.message || details;
    stack = error.stack;
    technicalDetails = error.message;
  }

  const [isMoreInfoOpen, setIsMoreInfoOpen] = useState(false);

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-12">
      <section className="w-full max-w-155 text-left">
        <img src={polarlearnLogo} alt="PolarLearn" className="h-15 w-15 mb-5" />

        <h1 className="text-[23px] leading-tight font-bold text-foreground mb-2">
          {message}
        </h1>
        <p className="text-[19px] leading-relaxed text-muted-foreground">
          {details}
        </p>

        <p className="text-[16px] text-muted-foreground mt-4">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            {t("errors.page.reloadAction")}
          </button>{" "}
          {t("errors.page.reloadHint")}
        </p>

        <button
          type="button"
          onClick={() => {
            setIsMoreInfoOpen((value) => !value);
          }}
          className="mt-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          {t("errors.page.moreInfo")}
          <ChevronDown
            className={`size-3.5 transition-transform ${isMoreInfoOpen ? "rotate-180" : "rotate-0"}`}
          />
        </button>

        {isMoreInfoOpen ? (
          <div className="mt-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
            <p>{technicalDetails}</p>
            {stack ? (
              <pre className="mt-2 max-h-52 overflow-auto rounded-md bg-background/80 p-2 text-[11px] text-muted-foreground">
                <code>{stack}</code>
              </pre>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
