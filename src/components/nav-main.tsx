import { Link, useLocation } from "react-router-dom"
import {
  CirclePlusIcon,
  GitBranchPlusIcon,
  MapPinnedIcon,
  RouteIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
  }[]
}) {
  const location = useLocation()
  const pathSegments = location.pathname.split("/").filter(Boolean)
  const reservedTopLevelSegments = new Set([
    "dashboard",
    "profile",
    "statistics",
    "search",
    "help",
    "login",
    "tracking",
  ])

  const organizationSegment =
    pathSegments[0] && !reservedTopLevelSegments.has(pathSegments[0])
      ? pathSegments[0]
      : null
  const pointSegment =
    organizationSegment &&
    pathSegments[1] &&
    !["team", "track-types", "points"].includes(pathSegments[1])
      ? pathSegments[1]
      : null

  const quickCreateLinks = [
    organizationSegment
      ? {
          title: "נקודה חדשה",
          url: `/${organizationSegment}/points/new`,
          icon: <MapPinnedIcon className="size-4" />,
        }
      : null,
    organizationSegment
      ? {
          title: "סוג מסלול",
          url: `/${organizationSegment}/track-types`,
          icon: <GitBranchPlusIcon className="size-4" />,
        }
      : null,
    organizationSegment && pointSegment
      ? {
          title: "מסלול בנקודה",
          url: `/${organizationSegment}/${pointSegment}/track/new`,
          icon: <RouteIcon className="size-4" />,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; url: string; icon: React.ReactNode }>

  const isItemActive = (url: string) => {
    if (url === "/dashboard") {
      return location.pathname === "/dashboard" || /^\/[^/]+$/.test(location.pathname)
    }

    return location.pathname === url || location.pathname.startsWith(`${url}/`)
  }

  return (
    <SidebarGroup dir="rtl">
      <SidebarGroupContent className="flex flex-col gap-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  tooltip="יצירה מהירה"
                  className="min-w-8 bg-primary text-black transition-colors hover:bg-primary/90 hover:text-black active:bg-primary/90 active:text-black"
                >
                  <CirclePlusIcon className="size-4" />
                  <span>יצירה מהירה</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-56" side="left" align="start">
                {quickCreateLinks.length > 0 ? (
                  <>
                    {quickCreateLinks.map((item, index) => (
                      <div key={item.url}>
                        {index > 0 ? <DropdownMenuSeparator /> : null}
                        <DropdownMenuItem asChild>
                          <Link to={item.url}>
                            {item.icon}
                            <span>{item.title}</span>
                          </Link>
                        </DropdownMenuItem>
                      </div>
                    ))}
                  </>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard">
                      <CirclePlusIcon className="size-4" />
                      <span>בחירת ארגון או נקודה תחילה</span>
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={isItemActive(item.url)}
                className="text-sm data-[active=true]:font-medium"
              >
                <Link to={item.url}>
                  {item.icon}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
