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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
    name: track.name?.trim() || `Track #${track.id}`,
    url: "#",
    icon: <RouteIcon />,
  }))

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="min-h-14 data-[slot=sidebar-menu-button]:px-3"
            >
              <Link to="/dashboard" className="flex items-center gap-3">
                <img className="size-9 shrink-0" src={Logo} alt="" />
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold leading-none">companion</div>
                  <div className="truncate pt-1 text-xs text-sidebar-foreground/70">
                    סביבת עבודה
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <div className="px-2">
          <Card size="sm" className="border border-sidebar-border/70 bg-sidebar-accent/35">
            <CardHeader className="gap-1">
              <CardTitle className="text-sm">סביבת עבודה</CardTitle>
              <CardDescription>
                ניווט מהיר בין נקודות, סטטיסטיקות וכלי עזר.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-sidebar-foreground/70">
              פתחו נקודה כדי לטעון את המסלולים שלה ולשמור על זרימת עבודה ממוקדת.
            </CardContent>
          </Card>
        </div>
        <NavDocuments
          label="מסלולים"
          items={trackItems}
          loading={tracksLoading}
          emptyMessage="פתחו נקודה כדי לטעון את המסלולים שלה"
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
