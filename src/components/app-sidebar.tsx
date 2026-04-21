import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  BarChart3Icon,
  CircleHelpIcon,
  LayoutDashboardIcon,
  SearchIcon,
  UserRoundIcon,
} from "lucide-react"

import Logo from "../../public/Logo.svg"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavTracks } from "@/components/nav-tracks"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { resolveAvatarUrl } from "@/lib/avatar"
import {
  addRecentTrack,
  pinTrack,
  readTrackQuickAccess,
  removeRecentTrack,
  type TrackQuickAccessItem,
  unpinTrack,
} from "@/lib/track-quick-access"

type CurrentTrackItem = {
  id: number
  name: string | null
  url: string
  pointName?: string | null
  refId?: number | null
  currentStepKey?: string | null
}

const navMain = [
  {
    title: "נקודות",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
  },
  {
    title: "סטטיסטיקות",
    url: "/statistics",
    icon: <BarChart3Icon />,
  },
]

const navSecondary = [
  {
    title: "פרופיל",
    url: "/profile",
    icon: <UserRoundIcon />,
  },
  {
    title: "חיפוש",
    url: "/search",
    icon: <SearchIcon />,
  },
  {
    title: "עזרה",
    url: "/help",
    icon: <CircleHelpIcon />,
  },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  currentTrack?: CurrentTrackItem | null
}

export function AppSidebar({
  currentTrack = null,
  ...props
}: AppSidebarProps) {
  const { user, profile } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)
  const [quickAccess, setQuickAccess] = useState<{
    pinned: TrackQuickAccessItem[]
    recent: TrackQuickAccessItem[]
  }>({
    pinned: [],
    recent: [],
  })

  useEffect(() => {
    const loadAvatar = async () => {
      if (!profile?.avatar_url) {
        setAvatarUrl(undefined)
        return
      }

      const resolvedUrl = await resolveAvatarUrl(profile.avatar_url)
      setAvatarUrl(resolvedUrl)
    }

    void loadAvatar()
  }, [profile])

  useEffect(() => {
    if (!user?.id) {
      setQuickAccess({ pinned: [], recent: [] })
      return
    }

    setQuickAccess(readTrackQuickAccess(user.id))
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || !currentTrack) return

    addRecentTrack(user.id, currentTrack)
    setQuickAccess(readTrackQuickAccess(user.id))
  }, [currentTrack, user?.id])

  const pinnedItems = useMemo(
    () =>
      [...quickAccess.pinned].sort((left, right) =>
        (right.pinnedAt ?? "").localeCompare(left.pinnedAt ?? "")
      ),
    [quickAccess.pinned]
  )

  const recentItems = useMemo(
    () =>
      quickAccess.recent.filter(
        (recentItem) => !quickAccess.pinned.some((pinnedItem) => pinnedItem.id === recentItem.id)
      ),
    [quickAccess.pinned, quickAccess.recent]
  )

  const handlePinToggle = (trackId: number, pinned: boolean) => {
    if (!user?.id) return

    const nextState = pinned ? unpinTrack(user.id, trackId) : pinTrack(user.id, trackId)
    setQuickAccess(nextState)
  }

  const handleRemoveRecent = (trackId: number) => {
    if (!user?.id) return

    const nextState = removeRecentTrack(user.id, trackId)
    setQuickAccess(nextState)
  }

  return (
    <Sidebar variant="inset" collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu dir="rtl">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="data-[slot=sidebar-menu-button]:!h-auto data-[slot=sidebar-menu-button]:!px-2.5 data-[slot=sidebar-menu-button]:!py-2"
            >
              <Link to="/dashboard" className="flex items-center gap-2 rounded-xl pb-1">
                <div className="flex size-7 items-center justify-center text-primary">
                  <img className="size-7 shrink-0" src={Logo} alt="" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xl leading-none text-sidebar-foreground">trace</div>
                  <div className="truncate text-xs text-sidebar-foreground/65">מעקב תהליכים חכם</div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMain} />
        <NavTracks
          pinnedItems={pinnedItems}
          recentItems={recentItems}
          onPinToggle={handlePinToggle}
          onRemoveRecent={handleRemoveRecent}
        />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser
          user={{
            name: profile?.display_name,
            email: user?.email,
            avatar: avatarUrl,
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
