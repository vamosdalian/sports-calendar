import { Link, useLocation } from "react-router-dom"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

type HeaderContext = {
  label: string
  href?: string
}

function formatLabel(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function getHeaderContext(pathname: string): HeaderContext {
  const parts = pathname.split("/").filter(Boolean)

  if (parts.length === 0) {
    return { label: "Overview" }
  }

  if (parts[0] === "locales") {
    return { label: "Locales" }
  }

  if (parts[0] !== "sports") {
    return { label: formatLabel(parts[parts.length - 1]) }
  }

  const sportSlug = parts[1]
  const leagueSlug = parts[3]
  const seasonSlug = parts[5]

  if (!sportSlug) {
    return { label: "Sports" }
  }

  if (parts.length === 2 || (parts.length === 3 && parts[2] === "leagues")) {
    return { label: formatLabel(sportSlug), href: "/sports" }
  }

  if (leagueSlug && (parts[4] === "teams" || parts[4] === "seasons")) {
    return {
      label: formatLabel(leagueSlug),
      href: `/sports/${sportSlug}/leagues`,
    }
  }

  if (seasonSlug && parts[6] === "matches") {
    return {
      label: formatLabel(seasonSlug),
      href: `/sports/${sportSlug}/leagues/${leagueSlug}/seasons`,
    }
  }

  return { label: formatLabel(parts[parts.length - 1]) }
}

export function SiteHeader() {
  const location = useLocation()
  const context = getHeaderContext(location.pathname)

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 transition-[width,height] ease-linear lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="min-w-0">
        {context.href ? (
          <Link className="truncate text-sm font-medium text-foreground hover:text-primary" to={context.href}>
            {context.label}
          </Link>
        ) : (
          <p className="truncate text-sm font-medium text-foreground">{context.label}</p>
        )}
      </div>
    </header>
  )
}
