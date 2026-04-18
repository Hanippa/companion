"use client"

import { Link, useLocation } from "react-router-dom"
import { PinIcon, RouteIcon, StarOffIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar"
import { type TrackQuickAccessItem } from "@/lib/track-quick-access"

function TrackMenuList({
  title,
  items,
  onPinToggle,
  onRemoveRecent,
}: {
  title: string
  items: TrackQuickAccessItem[]
  onPinToggle: (trackId: number, pinned: boolean) => void
  onRemoveRecent?: (trackId: number) => void
}) {
  const location = useLocation()

  if (items.length === 0) return null

  return (
    <div className="space-y-1">
      <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/50">
        {title}
      </div>
      <SidebarMenu>
        {items.map((item) => {
          const meta = [item.pointName?.trim(), item.refId ? `#${item.refId}` : null]
            .filter(Boolean)
            .join(" · ")
          const isPinned = Boolean(item.pinnedAt)

          return (
            <SidebarMenuItem key={`${title}-${item.id}`}>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === item.url}
                className="h-auto min-h-11 items-start py-2"
              >
                <Link to={item.url}>
                  <RouteIcon className="mt-0.5 size-4" />
                  <span className="flex min-w-0 flex-1 flex-col items-start">
                    <span className="truncate text-sm font-medium">
                      {item.name?.trim() || `מסלול #${item.id}`}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      {meta || item.currentStepKey || "גישה מהירה"}
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
              <SidebarMenuAction
                showOnHover
                onClick={() => onPinToggle(item.id, isPinned)}
                aria-label={isPinned ? "הסרת מסלול מהמוצמדים" : "הצמדת מסלול"}
                title={isPinned ? "הסרת מסלול מהמוצמדים" : "הצמדת מסלול"}
              >
                {isPinned ? <StarOffIcon className="size-4" /> : <PinIcon className="size-4" />}
              </SidebarMenuAction>
              {onRemoveRecent ? (
                <SidebarMenuBadge
                  className="end-8 cursor-pointer text-[10px] text-sidebar-foreground/45 hover:text-sidebar-accent-foreground"
                  onClick={() => onRemoveRecent(item.id)}
                >
                  הסר
                </SidebarMenuBadge>
              ) : null}
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </div>
  )
}

export function NavTracks({
  pinnedItems,
  recentItems,
  loading = false,
  onPinToggle,
  onRemoveRecent,
}: {
  pinnedItems: TrackQuickAccessItem[]
  recentItems: TrackQuickAccessItem[]
  loading?: boolean
  onPinToggle: (trackId: number, pinned: boolean) => void
  onRemoveRecent: (trackId: number) => void
}) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden" dir="rtl">
      <SidebarGroupLabel>גישה מהירה</SidebarGroupLabel>
      <SidebarGroupContent>
        {loading ? (
          <SidebarMenu>
            <SidebarMenuSkeleton showIcon />
            <SidebarMenuSkeleton showIcon />
            <SidebarMenuSkeleton showIcon />
          </SidebarMenu>
        ) : pinnedItems.length === 0 && recentItems.length === 0 ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton disabled className="h-auto py-2 text-sidebar-foreground/70">
                <RouteIcon className="size-4" />
                <span className="flex min-w-0 flex-1 flex-col items-start">
                  <span className="truncate text-sm font-medium">אין עדיין מסלולים מהירים</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    פתחו מסלול או הצמידו אחד כדי לראות אותו כאן
                  </span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <div className="space-y-3">
            <TrackMenuList
              title="מוצמדים"
              items={pinnedItems}
              onPinToggle={onPinToggle}
            />
            <TrackMenuList
              title="אחרונים"
              items={recentItems}
              onPinToggle={onPinToggle}
              onRemoveRecent={onRemoveRecent}
            />
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
