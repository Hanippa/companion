"use client"

import { Link } from "react-router-dom"
import { FolderIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar"

export function NavDocuments({
  label = "מסלולים",
  items,
  emptyMessage = "בחרו נקודה כדי לטעון מסלולים",
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
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {loading ? (
          <>
            <SidebarMenuSkeleton showIcon />
            <SidebarMenuSkeleton showIcon />
            <SidebarMenuSkeleton showIcon />
          </>
        ) : items.length === 0 ? (
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <FolderIcon />
              <span>{emptyMessage}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : (
          items.map((item) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton asChild isActive={item.isActive}>
                <Link to={item.url}>
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
