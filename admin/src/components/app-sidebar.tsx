"use client"

import { ChartNoAxesCombinedIcon, FlagIcon, LanguagesIcon, LogOutIcon, ShieldCheckIcon } from "lucide-react"
import { Link, NavLink, useLocation } from "react-router-dom"

import { useAuth } from "@/components/use-auth"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const navItems = [
  {
    title: "Overview",
    url: "/",
    icon: ChartNoAxesCombinedIcon,
    match: (pathname: string) => pathname === "/",
  },
  {
    title: "Locales",
    url: "/locales",
    icon: LanguagesIcon,
    match: (pathname: string) => pathname.startsWith("/locales"),
  },
  {
    title: "Sports",
    url: "/sports",
    icon: FlagIcon,
    match: (pathname: string) => pathname.startsWith("/sports"),
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const { email, logout } = useAuth()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b px-2 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <ShieldCheckIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Sports Calendar</span>
                  <span className="truncate text-xs text-muted-foreground">Admin Console</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={item.match(location.pathname)} tooltip={item.title}>
                    <NavLink end={item.url === "/"} to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        <div className="rounded-lg border bg-background p-3 group-data-[collapsible=icon]:hidden">
          <p className="truncate text-sm font-medium text-foreground">{email}</p>
          <Button className="mt-3 w-full justify-start" onClick={logout} size="sm" variant="outline">
            <LogOutIcon />
            <span>Sign out</span>
          </Button>
        </div>
        <Button className="hidden group-data-[collapsible=icon]:inline-flex" onClick={logout} size="icon" variant="outline">
          <LogOutIcon />
          <span className="sr-only">Sign out</span>
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
