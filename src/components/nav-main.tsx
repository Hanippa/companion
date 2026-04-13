import { Link, useLocation } from "react-router-dom"
import { CirclePlusIcon } from "lucide-react"
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
            <SidebarMenuButton
              asChild
              tooltip="יצירה מהירה"
              className="min-w-8 bg-primary text-black transition-colors hover:bg-primary/90 hover:text-black active:bg-primary/90 active:text-black"
            >
              <button type="button">
                <CirclePlusIcon className="size-4" />
                <span>יצירה מהירה</span>
              </button>
            </SidebarMenuButton>
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
