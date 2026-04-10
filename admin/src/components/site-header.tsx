import { useMemo } from "react"
import { Link, useLocation } from "react-router-dom"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader() {
  const location = useLocation()

  const breadcrumbItems = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean)
    if (parts.length === 0) {
      return [{ label: "Overview", href: "/" }]
    }

    return parts.map((part, index) => ({
      label: part.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      href: `/${parts.slice(0, index + 1).join("/")}`,
    }))
  }, [location.pathname])

  const title = breadcrumbItems[breadcrumbItems.length - 1]?.label ?? "Overview"

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 transition-[width,height] ease-linear lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="min-w-0">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Admin</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbItems.map((item, index) => (
              <BreadcrumbItem key={item.href}>
                <BreadcrumbSeparator />
                {index === breadcrumbItems.length - 1 ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
      </div>
    </header>
  )
}
