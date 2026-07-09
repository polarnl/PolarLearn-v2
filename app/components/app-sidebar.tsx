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

import { useNavigate, useRouteLoaderData, useLocation } from "react-router";
import type { ReactElement } from "react";
import {
  Cog,
  Home,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldUser,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "~/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import i18n from "~/i18n";
import { Button } from "@polarnl/polarui-react";
import { cn } from "~/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { authClient } from "~/lib/auth/client";
import pl_logo from "~/img/polarlearn.svg";
import { ChevronsUpDown, LogOut } from "lucide-react";

function SidebarTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  const { state } = useSidebar();

  if (state === "expanded") {
    return children;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" align="center">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarToggleIcon({ isCollapsed }: { isCollapsed: boolean }) {
  const Icon = isCollapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className="relative flex size-9 shrink-0 items-center justify-center text-sidebar-primary-foreground">
      <img
        src={pl_logo}
        alt="PolarLearn"
        className="size-5 object-contain transition-opacity duration-200 group-hover:opacity-0"
      />
      <Icon className="absolute inset-0 m-auto size-5 shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 text-black dark:text-white " />
    </div>
  );
}

export function AppSidebar() {
  const { toggleSidebar, state, isMobile } = useSidebar();
  const showLabels = isMobile || state === "expanded";
  const isCollapsed = state === "collapsed";
  const navigate = useNavigate();
  const location = useLocation();

  const normalizePath = (path: string) => path.replace(/\/+$/, "") || "/";
  const currentPath = normalizePath(location.pathname);

  const rootData = useRouteLoaderData("root");
  const theme = rootData?.theme ?? "dark";
  const user = rootData?.user;

  const navItems = [
    { title: "navigation.home", icon: Home, url: "/app" },
    { title: "navigation.forum", icon: MessageCircle, url: "/app/forum" },
    { title: "navigation.groups", icon: Users, url: "/app/groups" },
  ];

  const isActiveNavItem = (itemUrl: string) => {
    const normalizedItemUrl = normalizePath(itemUrl);

    if (normalizedItemUrl === "/app") {
      return currentPath === normalizedItemUrl;
    }

    return (
      currentPath === normalizedItemUrl ||
      currentPath.startsWith(`${normalizedItemUrl}/`)
    );
  };

  const handleLogout = () => {
    void authClient.signOut().then(() => {
      void navigate("/auth/sign-in");
    });
  };

  if (
    location.pathname.startsWith("/app/editlist/") ||
    location.pathname.startsWith("/app/session/")
  ) {
    return null;
  }

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-neutral-700 bg-neutral-800"
    >
      <SidebarHeader className="hidden py-4 md:flex">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarTooltip
              label={
                state === "collapsed"
                  ? i18n.t("sidebar.expandSidebar")
                  : i18n.t("sidebar.collapseSidebar")
              }
            >
              <Button
                variant="transparent"
                scheme={theme}
                className={cn(
                  "group flex h-9 w-full items-center rounded-xl",
                  showLabels ? "justify-start" : "justify-center p-0!",
                )}
                onClick={toggleSidebar}
              >
                <SidebarToggleIcon isCollapsed={isCollapsed} />
                {!isCollapsed && (
                  <div className="grid flex-1 text-left leading-none ml-2">
                    <span className="truncate text-xl font-bold font-heading flex-row flex text-neutral-700 dark:text-white">
                      <p className=" bg-linear-to-r from-sky-400 to-sky-100 bg-clip-text text-transparent">
                        Polar
                      </p>
                      Learn
                    </span>
                  </div>
                )}
              </Button>
            </SidebarTooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu className="gap-2">
          {navItems.map((item) => {
            const isActive = isActiveNavItem(item.url);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarTooltip label={i18n.t(item.title)}>
                  <Button
                    scheme={theme}
                    onClick={() => void navigate(item.url)}
                    className={cn(
                      "flex h-9 w-full items-center rounded-xl",
                      isCollapsed ? "justify-center p-0!" : "justify-start",
                    )}
                    variant={"transparent"}
                  >
                    <div
                      className={cn(
                        "relative flex size-9 shrink-0 items-center justify-center",
                        isActive &&
                        "before:absolute before:inset-0 before:rounded-md before:bg-sky-400/40 before:content-['']"
                      )}
                    >
                      <item.icon className="relative z-10 size-5 shrink-0" />
                    </div>
                    {showLabels && (
                      <span className="truncate ml-2">
                        {i18n.t(item.title)}
                      </span>
                    )}
                  </Button>
                </SidebarTooltip>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  scheme={theme}
                  variant={"transparent"}
                  className={cn(
                    "flex h-10 w-full items-center rounded-xl py-2",
                    showLabels ? "justify-start px-2" : "justify-center",
                  )}
                >
                  <Avatar>
                    <AvatarImage src={user?.image ?? undefined} />
                    <AvatarFallback>
                      {user?.name ? user.name.charAt(0).toUpperCase() : "?"}
                    </AvatarFallback>
                  </Avatar>
                  {showLabels && (
                    <>
                      <span className="flex-1 truncate text-left font-medium ml-2">
                        {user?.name ?? i18n.t("userMenu.guest")}
                      </span>
                      <ChevronsUpDown className="size-4 shrink-0 opacity-70" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side={isMobile ? "top" : "right"}
                align="end"
                sideOffset={8}
                className={cn(
                  "w-64 rounded-lg border p-1 dark:bg-neutral-800",
                  !isMobile && "ml-2",
                )}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-3 px-2 py-1.5 text-left text-white">
                    <Avatar>
                      <AvatarImage src={user?.image ?? undefined} />
                      <AvatarFallback>
                        {user?.name ? user.name.charAt(0).toUpperCase() : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-sm leading-tight">
                      <span className="truncate font-medium">
                        {user?.name ?? i18n.t("userMenu.guest")}
                      </span>
                      {user?.email ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {user?.role === "admin" && (
                  <DropdownMenuGroup>
                    <Button
                      variant="transparent"
                      scheme={theme}
                      className="gap-2 hover:cursor-pointer font-bold w-full text-xs"
                      icon={<ShieldUser size={20} />}
                      onClick={() => void navigate("/app/administration")}>
                      {i18n.t("userMenu.admin")}
                    </Button>
                  </DropdownMenuGroup>
                )}

                <DropdownMenuGroup>
                  <Button
                    variant="transparent"
                    scheme={theme}
                    className="gap-2 hover:cursor-pointer font-bold w-full text-xs"
                    icon={<Cog size={20} />}
                    onClick={() => void navigate("/app/usersettings")}
                  >
                    {i18n.t("userMenu.settings")}
                  </Button>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <Button
                  variant="transparent"
                  scheme={theme}
                  className="gap-2 hover:cursor-pointer font-bold w-full text-xs"
                  onClick={() => {
                    handleLogout();
                  }}
                  icon={<LogOut size={20} />}
                >
                  {i18n.t("userMenu.logout")}
                </Button>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
