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

import { Button, Input } from "@polarnl/polarui-react";
import { Mail, Lock, Loader2, LogIn } from "lucide-react";
import { Link, useLoaderData, useRouteLoaderData, useNavigate, redirect } from "react-router";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { authClient } from "~/lib/auth/client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { getRandomQuote } from "~/lib/quotes";
import entree from "~/img/entree.svg";
import i18n from "~/i18n";
import type { Route } from "./+types/sign-in";
import { getRequestSession } from "~/server/trpc";

gsap.registerPlugin(useGSAP);

export function getSafeNextPath(requestUrl: string) {
  const url = new URL(requestUrl);
  const next = url.searchParams.get("next");

  if (!next) return "/app";

  try {
    const resolved = new URL(next, url.origin);
    if (resolved.origin !== url.origin) return "/app";
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return "/app";
  }
}


export async function loader(loaderArgs: Route.LoaderArgs) {
  const headers = new Headers(loaderArgs.request.headers);
  const result = await getRequestSession({ headers, request: loaderArgs.request });
  const next = getSafeNextPath(loaderArgs.request.url);
  if (result?.user) return redirect(next);

  const lang = process.env.APP_LANG ?? "nl";

  return {
    quote: getRandomQuote(lang),
    enableEntreeFederatedSignIn: !!process.env.ENTREE_THING,
    smtpEnabled: !!process.env.SMTP_HOST,
    next,
  };
}

export default function SignInPage() {
  const { quote, enableEntreeFederatedSignIn, smtpEnabled, next } = useLoaderData<typeof loader>();
  const rootData = useRouteLoaderData("root");
  const theme = rootData?.theme ?? "dark";
  const t = i18n.t;
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false);

  const passwordContainerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (showPassword && passwordContainerRef.current) {
      void gsap.fromTo(
        passwordContainerRef.current,
        { height: 0, opacity: 0 },
        { height: "auto", opacity: 1, duration: 0.4, ease: "power2.out" }
      );
    }
  }, [showPassword]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading || isForgotPasswordLoading) return;
    setIsLoading(true);

    try {
      // Logic for prioritizing SSO if it is linked to an SSO-enforced org
      if (!showPassword) {
        const sso = await authClient.signIn.sso({
          email,
          callbackURL: next,
        });
        if (sso.error) {
          setShowPassword(true);
        }
        return;
      }

      const { error } = await authClient.signIn.email({
        email,
        password,
        callbackURL: next,
      });

      if (error) {
        if (error.status === 403) {
          if (error.code === "BANNED_USER") {
            toast.error(error.message ?? t("auth.errors.accountDisabled"));
          } else if (smtpEnabled) {
            toast.success(t("auth.signIn.notActivated"));
          } else {
            toast.error(t("errors.unknown"));
          }
        } else {
          toast.error(error.message ?? t("auth.errors.unknown"));
        }
        return;
      }

      void navigate(next);
    } catch (err: any) {
      toast.error(err?.message ?? t("auth.errors.unknown"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-row h-screen w-screen">
      <div className="w-[67%] bg-linear-to-b from-sky-400 to-sky-100 h-full md:flex hidden flex-col justify-center px-16 lg:px-32">
        <h1 className="text-5xl lg:text-7xl xl:text-8xl font-bold font-sans text-black tracking-tight leading-tight">
          {quote.text}
        </h1>
        <p className="text-2xl lg:text-4xl text-black font-sans font-semibold mt-8">
          ~ {quote.author}
        </p>
      </div>
      <div className="p-10 w-full md:w-[33%] flex flex-col">
        <h1 className="text-5xl font-bold">{t("auth.signIn.title")}</h1>
        <p className="text-xl mt-3">{t("auth.signIn.subtitle")}</p>
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <label
            htmlFor="email"
            className={`block mt-5 mb-2 text-sm font-medium ${theme === "dark" ? "text-white" : "text-neutral-900"}`}
          >
            {t("auth.signIn.email")}
          </label>
          <Input
            scheme={theme === "dark" ? "dark" : "light"}
            icon={<Mail />}
            placeholder={t("auth.signIn.emailPlaceholder")}
            className="w-full"
            value={email}
            onChange={(e) => { setEmail(e.target.value); }}
            disabled={showPassword}
            required
          />

          <div
            ref={passwordContainerRef}
            className="overflow-hidden opacity-0"
            style={{ height: showPassword ? "auto" : 0 }}
          >
            <label
              htmlFor="password"
              className={`block mt-5 mb-2 text-sm font-medium ${theme === "dark" ? "text-white" : "text-neutral-900"}`}
            >
              {t("auth.signIn.password")}
            </label>
            <Input
              scheme={theme === "dark" ? "dark" : "light"}
              icon={<Lock />}
              type="password"
              placeholder={t("auth.signIn.passwordPlaceholder")}
              className="w-full mb-2"
              value={password}
              onChange={(e) => { setPassword(e.target.value); }}
              required={showPassword}
            />
            {smtpEnabled ? (
              <button
                type="button"
                onClick={async () => {
                  if (isLoading || isForgotPasswordLoading) return;

                  const normalizedEmail = email.trim();
                  if (!normalizedEmail) {
                    toast.error(t("auth.signIn.forgotPasswordEmailRequired"));
                    return;
                  }

                  setIsForgotPasswordLoading(true);

                  try {
                    const resetPasswordUrl = new URL("/auth/reset-password", window.location.origin).toString();
                    const { error } = await authClient.requestPasswordReset({
                      email: normalizedEmail,
                      redirectTo: resetPasswordUrl,
                    });

                    if (error) {
                      toast.error(error.message ?? t("auth.errors.unknown"));
                      return;
                    }

                    toast.success(t("auth.signIn.forgotPasswordSent"));
                  } catch (err: any) {
                    toast.error(err?.message ?? t("auth.errors.unknown"));
                  } finally {
                    setIsForgotPasswordLoading(false);
                  }
                }}
                disabled={isLoading || isForgotPasswordLoading}
                className="text-md text-sky-400 font-bold block mb-2 cursor-pointer hover:underline disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isForgotPasswordLoading
                  ? t("auth.signIn.forgotPasswordSending")
                  : t("auth.signIn.forgotPassword")}
              </button>
            ) : null}
          </div>

          <Button
            textColor={theme === "dark" ? "black" : "white"}
            color="sky"
            className="w-full mt-5"
            type="submit"
            disabled={isLoading || isForgotPasswordLoading}
            icon={isLoading ? <Loader2 className="animate-spin" /> : <LogIn />}
          >
            {isLoading
              ? t("auth.signIn.loading")
              : showPassword
                ? t("auth.actions.login")
                : t("auth.signIn.continue")}
          </Button>

          <div className="w-full items-center justify-center mt-4 flex gap-1">
            <p className="font-bold">{t("auth.signIn.noAccount")}</p>
            <Link
              to="/auth/sign-up"
              className="text-md text-sky-400 font-bold hover:underline"
            >
              {t("auth.signIn.createOne")}
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            {rootData?.lang === "nl" && enableEntreeFederatedSignIn ? (
              <>
                <div className="flex items-center my-4">
                  <hr className="grow border-neutral-600" />
                  <span className="mx-4 text-gray-500 dark:text-gray-400 font-bold">
                    {t("auth.signIn.separator")}
                  </span>
                  <hr className="grow border-neutral-600" />
                </div>
                <Button
                  textColor={theme === "dark" ? "white" : "black"}
                  className="w-full"
                  type="button"
                  color={theme === "dark" ? "dark" : "light"}
                  icon={<img src={entree} alt="" width={23} height={23} />}
                >
                  {t("auth.signIn.entree")}
                </Button>
              </>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
