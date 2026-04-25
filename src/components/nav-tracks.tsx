"use client"

import { Link, useLocation } from "react-router-dom"
import { MoreHorizontal, PinIcon, RouteIcon, StarOffIcon, Trash2 } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type TrackQuickAccessItem } from "@/lib/track-quick-access"

function TrackMenuList({
  title,
  items,
  onPinToggle,
  onRemoveRecent,
  onRemoveTrackEverywhere,
}: {
  title: string
  items: TrackQuickAccessItem[]
  onPinToggle: (trackId: number, pinned: boolean) => void
  onRemoveRecent?: (trackId: number) => void
  onRemoveTrackEverywhere?: (trackId: number) => void
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
          const isPinned = Boolean(item.pinnedAt)

          return (
            <SidebarMenuItem key={`${title}-${item.id}`}>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === item.url}
                className="h-auto min-h-14 items-start py-2.5"
              >
                <Link to={item.url}>
                  <RouteIcon className="mt-0.5 size-4 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col items-start">
                    <span className="truncate text-sm font-medium">{item.pointName?.trim() || "ללא נקודה"}</span>
                    <span className="text-xs text-sidebar-foreground/65">מסלול #{item.refId ?? item.id}</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      {item.trackTypeName?.trim() || item.name?.trim() || "ללא סוג מסלול"}
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
              <SidebarMenuAction
                showOnHover={false}
                className="translate-y-0"
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex size-7 items-center justify-center rounded-md text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      aria-label="פעולות מסלול"
                      title="פעולות מסלול"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-40">
                    <DropdownMenuItem onClick={() => onPinToggle(item.id, isPinned)}>
                      {isPinned ? <StarOffIcon className="size-4" /> : <PinIcon className="size-4" />}
                      {isPinned ? "הסרת הצמדה" : "הצמדה"}
                    </DropdownMenuItem>
                    {onRemoveRecent ? (
                      <DropdownMenuItem onClick={() => onRemoveRecent(item.id)}>
                        <Trash2 className="size-4" />
                        הסר מהאחרונים
                      </DropdownMenuItem>
                    ) : null}
                    {onRemoveTrackEverywhere ? (
                      <DropdownMenuItem onClick={() => onRemoveTrackEverywhere(item.id)}>
                        <Trash2 className="size-4" />
                        נקה מהרשימה
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuAction>
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
  onRemoveTrackEverywhere,
}: {
  pinnedItems: TrackQuickAccessItem[]
  recentItems: TrackQuickAccessItem[]
  loading?: boolean
  onPinToggle: (trackId: number, pinned: boolean) => void
  onRemoveRecent: (trackId: number) => void
  onRemoveTrackEverywhere: (trackId: number) => void
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
              onRemoveTrackEverywhere={onRemoveTrackEverywhere}
            />
            <TrackMenuList
              title="אחרונים"
              items={recentItems}
              onPinToggle={onPinToggle}
              onRemoveRecent={onRemoveRecent}
              onRemoveTrackEverywhere={onRemoveTrackEverywhere}
            />
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
