import * as React from "react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import Logo from "../../public/Logo.svg"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { LayoutDashboardIcon, ListIcon, ChartBarIcon, FolderIcon, UsersIcon, CameraIcon, FileTextIcon, Settings2Icon, CircleHelpIcon, SearchIcon, DatabaseIcon, FileChartColumnIcon, FileIcon, CommandIcon } from "lucide-react"
import { useState , useEffect } from "react"

import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";


const data = {
  navMain: [
    {
      title: "בית",
      url: "#",
      icon: (
        <LayoutDashboardIcon
        />
      ),
    },
    {
      title: "סטטיסטיקה",
      url: "#",
      icon: (
        <ChartBarIcon
        />
      ),
    },
    {
      title: "פרויקטים",
      url: "#",
      icon: (
        <FolderIcon
        />
      ),
    },
    {
      title: "הקבוצה",
      url: "#",
      icon: (
        <UsersIcon
        />
      ),
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: (
        <CameraIcon
        />
      ),
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: (
        <FileTextIcon
        />
      ),
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: (
        <FileTextIcon
        />
      ),
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "הגדרות",
      url: "#",
      icon: (
        <Settings2Icon
        />
      ),
    },
    {
      title: "עזרה",
      url: "#",
      icon: (
        <CircleHelpIcon
        />
      ),
    },
    {
      title: "חיפוש",
      url: "#",
      icon: (
        <SearchIcon
        />
      ),
    },
  ],
  documents: [
    {
      name: "מרכז שירות דיזנגוף",
      url: "#",
      icon: (
        <DatabaseIcon
        />
      ),
    },
    {
      name: "דוכן בית שמש",
      url: "#",
      icon: (
        <FileChartColumnIcon
        />
      ),
    },
    {
      name: "דינמיקה פלוס מלחה",
      url: "#",
      icon: (
        <FileIcon
        />
      ),
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {

const { user, profile, loading } = useAuth();
const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)

useEffect(() => {

  const loadAvatar = async () => {
    if (!profile?.avatar_url) return

    const { data } = await supabase.storage
      .from("avatars")
      .createSignedUrl("ee2891d6-4f1f-4468-99c4-c401a6db010d/avatar.png", 3600)

    if (data) setAvatarUrl(data.signedUrl)
  }

  loadAvatar()
}, [profile])


  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#">
                <img className="size-8" src={Logo} alt="" />
                <span className="text-base font-semibold">companion</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{name: profile?.display_name ,email: user?.email ,avatar: avatarUrl,}} />
      </SidebarFooter>
    </Sidebar>
  )
}
