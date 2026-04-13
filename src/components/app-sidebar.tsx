import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  BarChart3Icon,
  CircleHelpIcon,
  LayoutDashboardIcon,
  RouteIcon,
  SearchIcon,
  UserRoundIcon,
} from "lucide-react"

import Logo from "../../public/Logo.svg"
import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
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

type TrackNavigationItem = {
  id: number
  name: string | null
  url?: string
  isActive?: boolean
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
  tracks?: TrackNavigationItem[]
  tracksLoading?: boolean
}

export function AppSidebar({
  tracks = [],
  tracksLoading = false,
  ...props
}: AppSidebarProps) {
  const { user, profile } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)

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

  const trackItems = tracks.map((track) => ({
    name: track.name?.trim() || `מסלול #${track.id}`,
    url: track.url || "#",
    icon: <RouteIcon className="size-4" />,
    isActive: track.isActive,
  }))

  return (
    <Sidebar variant="inset" collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu dir="rtl">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="data-[slot=sidebar-menu-button]:!p-2"
            >
              <Link to="/dashboard" className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <img className="size-5 shrink-0" src={Logo} alt="" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold leading-none">
                    companion
                  </div>
                  <div className="truncate pt-1 text-xs text-sidebar-foreground/70">
                    סביבת עבודה חכמה
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMain} />
        <NavDocuments
          label="מסלולים"
          items={trackItems}
          loading={tracksLoading}
          emptyMessage="פתחו נקודה כדי לראות את המסלולים שלה"
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
