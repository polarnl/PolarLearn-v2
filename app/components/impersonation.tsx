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

"use client";

import { useRouteLoaderData } from "react-router";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import i18n from "~/i18n";
import { authClient } from "~/lib/auth/client";

export default function ImpersonationBanner() {
  const loaderData = useRouteLoaderData("root")
  const bannerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!loaderData?.impersonatedBy && !loaderData?.tenancy) {
      document.documentElement.style.removeProperty("--impersonation-banner-height");
      return;
    }

    const updateBannerHeight = () => {
      const height = bannerRef.current?.getBoundingClientRect().height ?? 0;
      document.documentElement.style.setProperty(
        "--impersonation-banner-height",
        `${height}px`
      );
    };

    updateBannerHeight();

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateBannerHeight);

    if (bannerRef.current) {
      observer?.observe(bannerRef.current);
    }

    window.addEventListener("resize", updateBannerHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateBannerHeight);
      document.documentElement.style.removeProperty("--impersonation-banner-height");
    };
  }, [loaderData?.impersonatedBy, loaderData?.tenancy]);

  if (!loaderData?.impersonatedBy && !loaderData?.tenancy) {
    return null;
  }

  const handleEndImpersonation = async () => {
    setIsLoading(true);
    try {
      await authClient.admin.stopImpersonating();
      window.location.reload();
    } catch (error) {
      console.error("Failed to end impersonation:", error);
      setIsLoading(false);
    }
  };

  return (
    <div ref={bannerRef} className="sticky top-0 z-60">
      {loaderData.impersonatedBy ? (
        <div className="bg-yellow-900/20 border-b border-yellow-900/30 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-sm text-yellow-800 dark:text-yellow-300">
              You are currently impersonating{" "}
              <span className="font-semibold">
                {loaderData.user.name || "?"}
              </span>
            </div>
          </div>
          <button
            onClick={handleEndImpersonation}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-yellow-800/40 hover:bg-yellow-800/60 text-yellow-800 dark:text-yellow-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Ending..." : "End impersonation"}
            <X className="size-4" />
          </button>
        </div>
      ) : null}
      {loaderData.tenancy ? (
        <div className="border-b border-blue-900/30 bg-blue-900/20 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          {i18n.t("admin.tenancies.operatingIn", {
            name: loaderData.tenancy.name,
          })}
        </div>
      ) : null}
    </div>
  );
}
