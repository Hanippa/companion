import { Link, useLocation } from "react-router-dom"
import { CirclePlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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

  const isItemActive = (url: string) => {
    if (url === "/dashboard") {
      return location.pathname === "/dashboard" || /^\/[^/]+$/.test(location.pathname)
    }

    return location.pathname === url || location.pathname.startsWith(`${url}/`)
  }

  return (
    <SidebarGroup dir="rtl">
      <SidebarGroupLabel>ראשי</SidebarGroupLabel>
      <SidebarGroupContent className="space-y-3">
        <Button className="h-11 w-full justify-start rounded-xl bg-primary text-black shadow-none transition hover:bg-primary/90">
          <CirclePlusIcon className="size-4" />
          יצירה מהירה
        </Button>
        <SidebarMenu className="space-y-1">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={isItemActive(item.url)}
                className="h-10 rounded-xl text-sm hover:bg-sidebar-accent/80 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium"
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
