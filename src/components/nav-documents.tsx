"use client"

import { Link } from "react-router-dom"
import { FolderIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar"

export function NavDocuments({
  label = "מסלולים",
  items,
  emptyMessage = "בחרו נקודה כדי לראות מסלולים",
  loading = false,
}: {
  label?: string
  items: {
    name: string
    url: string
    icon: React.ReactNode
    isActive?: boolean
  }[]
  emptyMessage?: string
  loading?: boolean
}) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden" dir="rtl">
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {loading ? (
            <>
              <SidebarMenuSkeleton showIcon />
              <SidebarMenuSkeleton showIcon />
              <SidebarMenuSkeleton showIcon />
            </>
          ) : items.length === 0 ? (
            <SidebarMenuItem>
              <SidebarMenuButton disabled className="text-sidebar-foreground/70">
                <FolderIcon />
                <span>{emptyMessage}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            items.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  asChild
                  isActive={item.isActive}
                  className="text-sm data-[active=true]:font-medium"
                >
                  <Link to={item.url}>
                    {item.icon}
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
