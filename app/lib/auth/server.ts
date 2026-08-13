import { prisma } from "../db";
import { betterAuth } from "better-auth";
import { i18n as betterAuthI18n } from "@better-auth/i18n";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, username, organization } from "better-auth/plugins";
import { APIError, createAuthMiddleware, getIp } from "better-auth/api";
import { sso } from "@better-auth/sso"
import { passkey } from "@better-auth/passkey"
import nunjucks from "nunjucks";
import { logger as appLogger } from "../logger"
import { betterAuthTranslations } from "./betterauth-i18n";
import i18n from "~/i18n";
import { smtpTransport } from "~/lib/smtp";

import activationEmailTemplate from "./activation-email.html?raw";
import forgotPasswordEmailTemplate from "./forgot-password-email.html?raw";

export const auth = betterAuth({
  telemetry: {
    enabled: false, // fuck you
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.APP_BASE as string,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: !!process.env.SMTP_HOST,
    sendResetPassword: async ({ user, url }) => {
      if (!smtpTransport) {
        appLogger.warn({
          event: "auth.email.verification.skipped",
          reason: "smtp-not-configured",
          userId: user.id,
          email: user.email,
        });
        return;
      }
      const html = nunjucks.renderString(forgotPasswordEmailTemplate, {
        username: user.name?.trim() || user.email.split("@")[0] || "",
        reset_url: url,
      });
      await smtpTransport.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to: user.email,
        subject: "PolarLearn | Wachtwoord Resetten",
        html,
      });
    },
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }, request) => {
      if (!smtpTransport) {
        appLogger.warn({
          event: "auth.email.verification.skipped",
          reason: "smtp-not-configured",
          userId: user.id,
          email: user.email,
        });
        return;
      }

      const username = user.name?.trim() || user.email.split("@")[0] || "";
      const fromAddress = process.env.SMTP_FROM ?? process.env.SMTP_USER;

      if (!fromAddress) {
        throw new Error("NO_SMTP");
      }

      const html = nunjucks.renderString(activationEmailTemplate, {
        username,
        activation_url: url,
      });

      await smtpTransport.sendMail({
        from: fromAddress,
        to: user.email,
        subject: "PolarLearn | Activeer je account",
        html,
      });
    },
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
  },
  user: {
    deleteUser: {
      enabled: true,
    },
    additionalFields: {
      theme: {
        type: "string",
        nullable: true,
      },
      forumBanned: {
        type: "boolean",
        input: false,
      },
      forumBanReason: {
        type: "string",
        nullable: true,
        input: false,
      },
      banReason: {
        type: "string",
        nullable: true,
        input: false,
      },
    },
  },
  secret: process.env.SECRET,
  trustedOrigins:
    process.env.NODE_ENV === "production"
      ? [process.env.APP_BASE as string]
      : ["*"],
  advanced: {
    database: {
      generateId: () => {
        return crypto.randomUUID();
      },
    },
    ipAddress: {
      ipAddressHeaders: [
        "cf-connecting-ip",
        "true-client-ip",
        "x-forwarded-for",
        "x-real-ip",
      ],
      disableIpTracking: false,
    },
    useSecureCookies: process.env.NODE_ENV === "production",
    disableCSRFCheck: false,
    disableOriginCheck: false,
    cookiePrefix: "polarlearn.auth",
  },
  logger: {
    level: "debug",
    log: (level, message, ...args) => {
      appLogger[level](message, ...args);
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      switch (ctx.path) {
        case "/organization/delete": {
          if (ctx.context.session?.user.role !== "admin") {
            throw APIError.from("FORBIDDEN", {
              code: "ORGANIZATION_DELETE_FORBIDDEN",
              message: i18n.t("admin.tenancies.deleteForbidden"),
            });
          }
          return;
        }
        case "/admin/ban-user": {
          const reason =
            typeof ctx.body === "object" && ctx.body !== null
              ? (ctx.body as Record<string, unknown>).banReason
              : undefined;
          if (!reason) {
            throw APIError.from("BAD_REQUEST", {
              code: "BAN_REASON_REQUIRED",
              message: i18n.t("admin.users.banDialog.reasonRequired"),
            });
          }
          return;
        }
        case "/sign-out": {
          const session = ctx.context.session;
          if (!session) return;

          const request = ctx.request;
          const ipAddress = request
            ? getIp(request, ctx.context.options)
            : null;

          appLogger.info({
            event: "auth.logout",
            path: ctx.path,
            userId: session.user.id,
            email: session.user.email,
            ipAddress,
            userAgent: request?.headers.get("user-agent") ?? null,
          });
          return;
        }
        default:
          return;
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const request = ctx.request;
      const ipAddress = request ? getIp(request, ctx.context.options) : null;
      const userAgent = request?.headers.get("user-agent") ?? null;

      switch (ctx.path) {
        case "/sign-in/email": {
          const newSession = ctx.context.newSession;
          const body = ctx.body as Record<string, unknown> | undefined;
          const attemptedCredentials = {
            email: typeof body?.email === "string" ? body.email : null,
            callbackURL:
              typeof body?.callbackURL === "string" ? body.callbackURL : null,
          };

          if (!newSession) {
            const returned = ctx.context.returned;
            const returnedBody =
              typeof returned === "object" &&
              returned !== null &&
              "body" in returned
                ? (returned as Record<string, unknown>).body
                : null;
            const errorCode =
              typeof returnedBody === "object" && returnedBody !== null
                ? (returnedBody as Record<string, unknown>).code
                : null;

            if (errorCode === "BANNED_USER") {
              const email = attemptedCredentials.email;
              if (email) {
                const bannedUser = await prisma.user.findFirst({
                  where: {
                    banned: true,
                    OR: [
                      { email: { equals: email, mode: "insensitive" } },
                      { username: { equals: email, mode: "insensitive" } },
                    ],
                  },
                  select: { banReason: true },
                });
                const reason = bannedUser?.banReason?.trim();
                if (reason) {
                  throw APIError.from("FORBIDDEN", {
                    code: "BANNED_USER",
                    message: i18n.t("auth.errors.bannedUser", { reason }),
                  });
                }
              }
            }

            appLogger.info({
              event: "auth.login.failed",
              path: ctx.path,
              attemptedCredentials,
              ipAddress,
              userAgent,
            });
            return;
          }

          appLogger.info({
            event: "auth.login",
            path: ctx.path,
            userId: newSession.user.id,
            email: newSession.user.email,
            ipAddress,
            userAgent,
          });
          return;
        }
        case "/sign-up/email": {
          const newSession = ctx.context.newSession;
          if (!newSession) return;

          appLogger.info({
            event: "auth.signup",
            path: ctx.path,
            userId: newSession.user.id,
            email: newSession.user.email,
            name: newSession.user.name,
            ipAddress,
            userAgent,
          });
          return;
        }
        case "/reset-password": {
          const session = ctx.context.session;
          if (!session) return;

          appLogger.info({
            event: "auth.password.reset",
            path: ctx.path,
            userId: session.user.id,
            email: session.user.email,
            ipAddress,
            userAgent,
          });
          return;
        }
        case "/admin/ban-user": {
          const session = ctx.context.session;
          if (!session) return;
          const body = ctx.body as
            | { userId?: string; banReason?: string }
            | undefined;
          appLogger.info({
            event: "admin.user.banned",
            path: ctx.path,
            userId: session.user.id,
            targetUserId: body?.userId ?? null,
            banReason: body?.banReason ?? null,
            ipAddress,
            userAgent,
          });
          return;
        }
        case "/admin/unban-user": {
          const session = ctx.context.session;
          if (!session) return;
          const body = ctx.body as { userId?: string } | undefined;
          appLogger.info({
            event: "admin.user.unbanned",
            path: ctx.path,
            userId: session.user.id,
            targetUserId: body?.userId ?? null,
            ipAddress,
            userAgent,
          });
          return;
        }
        case "/admin/set-role": {
          const session = ctx.context.session;
          if (!session) return;
          const body = ctx.body as
            | { userId?: string; role?: string }
            | undefined;
          appLogger.info({
            event: "admin.user.role_changed",
            path: ctx.path,
            userId: session.user.id,
            targetUserId: body?.userId ?? null,
            newRole: body?.role ?? null,
            ipAddress,
            userAgent,
          });
          return;
        }
        case "/admin/remove-user": {
          const session = ctx.context.session;
          if (!session) return;
          const body = ctx.body as { userId?: string } | undefined;
          appLogger.info({
            event: "admin.user.deleted",
            path: ctx.path,
            userId: session.user.id,
            targetUserId: body?.userId ?? null,
            ipAddress,
            userAgent,
          });
          return;
        }
        case "/admin/impersonate-user": {
          const session = ctx.context.session;
          if (!session) return;
          const body = ctx.body as { userId?: string } | undefined;
          appLogger.info({
            event: "admin.user.impersonated",
            path: ctx.path,
            userId: session.user.id,
            targetUserId: body?.userId ?? null,
            ipAddress,
            userAgent,
          });
          return;
        }
        case "/admin/set-user-password": {
          const session = ctx.context.session;
          if (!session) return;
          const body = ctx.body as { userId?: string } | undefined;
          appLogger.info({
            event: "admin.user.password_reset",
            path: ctx.path,
            userId: session.user.id,
            targetUserId: body?.userId ?? null,
            ipAddress,
            userAgent,
          });
          return;
        }
        case "/admin/update-user": {
          const session = ctx.context.session;
          if (!session) return;
          const body = ctx.body as
            | { userId?: string; data?: Record<string, unknown> }
            | undefined;
          appLogger.info({
            event: "admin.user.updated",
            path: ctx.path,
            userId: session.user.id,
            targetUserId: body?.userId ?? null,
            updatedFields: Object.keys(body?.data ?? {}),
            ipAddress,
            userAgent,
          });
          return;
        }
      }
    }),
  },
  plugins: [
    betterAuthI18n({
      translations: betterAuthTranslations,
      detection: ["callback"],
      defaultLocale: i18n.DEFAULT_LANG,
      getLocale: () => {
        return i18n.language ?? null;
      },
    }),
    username(),
    admin({
      adminRoles: ["admin"],
    }),
    sso(),
    passkey(),
    organization({
      allowUserToCreateOrganization: (user) => user.role === "admin"
    })
  ],
});
