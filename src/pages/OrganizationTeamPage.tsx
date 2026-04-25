import { useDeferredValue, useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CircleAlert, FileJson, ShieldUser, Upload, UserPlus, Users2 } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  InfoPanel,
  InfoPanelBody,
  InfoPanelHeader,
} from "@/components/info-panel"
import { MemberCard } from "@/components/member-card"
import { PageBody, PageMainContent, PageMainLayout, PageMainRail } from "@/components/page-main-layout"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { getOrganizationSegment, getRecordIdFromSegment } from "@/lib/drilldown"
import { getOrganizationsCached } from "@/lib/organizations"
import { getProfilesByIdsCached } from "@/lib/profile-cache"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

type Organization = {
  id: number
  name: string | null
  notes: string | null
  status: string | null
}

type OrganizationMemberRow = {
  organization_id: number
  user_id: string
  role: string | null
  status: string | null
  title?: string | null
}

type ProfileSummary = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

type TeamMember = OrganizationMemberRow & {
  profile: ProfileSummary | null
}

const ROLE_OPTIONS = [
  { value: "member", label: "חבר צוות" },
  { value: "admin", label: "מנהל ארגון" },
  { value: "owner", label: "בעלים" },
]

const STATUS_OPTIONS = [
  { value: "active", label: "פעיל" },
  { value: "inactive", label: "לא פעיל" },
]

const MEMBERS_PAGE_SIZE = 48
const IMPORT_REQUEST_CHUNK_SIZE = 50

const getRoleLabel = (role: string | null) => {
  switch (role) {
    case "owner":
      return "בעלים"
    case "admin":
      return "מנהל ארגון"
    case "member":
    default:
      return "חבר צוות"
  }
}

export default function OrganizationTeamPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { organizationSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)
  const [leadershipMembers, setLeadershipMembers] = useState<TeamMember[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [totalMembersCount, setTotalMembersCount] = useState(0)
  const [totalRegularMembersCount, setTotalRegularMembersCount] = useState(0)
  const [canManage, setCanManage] = useState(false)
  const [memberSearchQuery, setMemberSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [memberDisplayName, setMemberDisplayName] = useState("")
  const [memberTitle, setMemberTitle] = useState("")
  const [memberRole, setMemberRole] = useState("member")
  const [memberStatus, setMemberStatus] = useState("active")
  const [memberSaveError, setMemberSaveError] = useState<string | null>(null)
  const [memberSaveMessage, setMemberSaveMessage] = useState<string | null>(null)
  const [memberSaving, setMemberSaving] = useState(false)
  const [memberRemoving, setMemberRemoving] = useState(false)
  const [memberRefreshKey, setMemberRefreshKey] = useState(0)
  const [importFileName, setImportFileName] = useState<string | null>(null)
  const [importUsersCount, setImportUsersCount] = useState(0)
  const [importUsers, setImportUsers] = useState<unknown[]>([])
  const [importingUsers, setImportingUsers] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importProgressLabel, setImportProgressLabel] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<{
    requested: number
    created: number
    failed: number
  } | null>(null)
  const [importFailures, setImportFailures] = useState<Array<{ email: string; error: string }>>([])
  const deferredMemberSearchQuery = useDeferredValue(memberSearchQuery.trim())

  useEffect(() => {
    let isMounted = true

    const loadOrganizations = async () => {
      setLoadingOrganizations(true)
      setOrganizationsError(null)

      try {
        const nextOrganizations = await getOrganizationsCached()
        if (!isMounted) return
        setOrganizations(nextOrganizations)
      } catch (error) {
        if (!isMounted) return
        console.error("Error loading organizations:", error)
        setOrganizations([])
        setOrganizationsError("לא הצלחנו לטעון את הארגונים שלך כרגע.")
      } finally {
        if (isMounted) {
          setLoadingOrganizations(false)
        }
      }
    }

    void loadOrganizations()

    return () => {
      isMounted = false
    }
  }, [])

  const selectedOrganization =
    organizations.find((organization) => organization.id === organizationIdFromRoute) ?? null

  useEffect(() => {
    if (loadingOrganizations || organizationsError || organizations.length === 0) return

    if (!selectedOrganization || organizationIdFromRoute === null) {
      navigate("/dashboard", { replace: true })
      return
    }

    const expectedSegment = getOrganizationSegment(selectedOrganization)
    if (expectedSegment !== organizationSlug) {
      navigate(`/${expectedSegment}/team`, { replace: true })
    }
  }, [
    loadingOrganizations,
    organizations,
    organizationsError,
    navigate,
    organizationIdFromRoute,
    organizationSlug,
    selectedOrganization,
  ])

  useEffect(() => {
    setCurrentPage(1)
  }, [deferredMemberSearchQuery, selectedOrganization?.id])

  useEffect(() => {
    let isMounted = true

    const loadMembers = async () => {
      if (!selectedOrganization) {
        setLeadershipMembers([])
        setMembers([])
        setTotalMembersCount(0)
        setTotalRegularMembersCount(0)
        setLoadingMembers(false)
        return
      }

      setLoadingMembers(true)
      setMembersError(null)

      try {
        const ownerPromise = supabase
          .from("organization_users")
          .select("role")
          .eq("organization_id", selectedOrganization.id)
          .eq("user_id", user?.id ?? "")
          .eq("status", "active")
          .eq("role", "owner")

        const from = (currentPage - 1) * MEMBERS_PAGE_SIZE
        const to = from + MEMBERS_PAGE_SIZE - 1

        let memberRows: OrganizationMemberRow[] = []
        let leadershipRows: OrganizationMemberRow[] = []
        let viewerIsOwner = false
        let nextTotalCount = 0
        let nextRegularCount = 0

        if (!deferredMemberSearchQuery) {
          const [leadershipResult, membersResult, ownerResult] = await Promise.all([
            supabase
              .from("organization_users")
              .select("organization_id, user_id, role, status, title")
              .eq("organization_id", selectedOrganization.id)
              .eq("status", "active")
              .in("role", ["owner", "admin"])
              .order("role", { ascending: false })
              .order("user_id", { ascending: true }),
            supabase
              .from("organization_users")
              .select("organization_id, user_id, role, status, title", { count: "exact" })
              .eq("organization_id", selectedOrganization.id)
              .eq("status", "active")
              .eq("role", "member")
              .order("user_id", { ascending: true })
              .range(from, to),
            ownerPromise,
          ])

          if (leadershipResult.error) throw leadershipResult.error
          if (membersResult.error) throw membersResult.error
          if (ownerResult.error) throw ownerResult.error

          leadershipRows = leadershipResult.data ?? []
          memberRows = membersResult.data ?? []
          viewerIsOwner = (ownerResult.data ?? []).length > 0
          nextRegularCount = membersResult.count ?? memberRows.length
          nextTotalCount = leadershipRows.length + nextRegularCount
        } else {
          const [profilesResult, titleMatchesResult, ownerResult] = await Promise.all([
            supabase
              .from("profiles")
              .select("id")
              .ilike("display_name", `%${deferredMemberSearchQuery}%`),
            supabase
              .from("organization_users")
              .select("organization_id, user_id, role, status, title")
              .eq("organization_id", selectedOrganization.id)
              .eq("status", "active")
              .ilike("title", `%${deferredMemberSearchQuery}%`)
              .order("user_id", { ascending: true }),
            ownerPromise,
          ])

          if (profilesResult.error) throw profilesResult.error
          if (titleMatchesResult.error) throw titleMatchesResult.error
          if (ownerResult.error) throw ownerResult.error

          const matchedProfileIds = (profilesResult.data ?? []).map((profile) => profile.id)
          const profileMatchesResult =
            matchedProfileIds.length > 0
              ? await supabase
                  .from("organization_users")
                  .select("organization_id, user_id, role, status, title")
                  .eq("organization_id", selectedOrganization.id)
                  .eq("status", "active")
                  .in("user_id", matchedProfileIds)
                  .order("user_id", { ascending: true })
              : { data: [] as OrganizationMemberRow[], error: null }

          if (profileMatchesResult.error) throw profileMatchesResult.error

          const mergedRowsById = new Map<string, OrganizationMemberRow>()
          ;[...(titleMatchesResult.data ?? []), ...(profileMatchesResult.data ?? [])].forEach((member) => {
            mergedRowsById.set(member.user_id, member)
          })

          const filteredRows = Array.from(mergedRowsById.values())
          leadershipRows = filteredRows.filter((member) => ["owner", "admin"].includes(member.role ?? "member"))
          const regularRows = filteredRows.filter((member) => !["owner", "admin"].includes(member.role ?? "member"))
          memberRows = regularRows.slice(from, to + 1)
          viewerIsOwner = (ownerResult.data ?? []).length > 0
          nextTotalCount = filteredRows.length
          nextRegularCount = regularRows.length
        }

        const profilesById = await getProfilesByIdsCached([
          ...leadershipRows.map((member) => member.user_id),
          ...memberRows.map((member) => member.user_id),
        ])

        if (!isMounted) return

        setCanManage(viewerIsOwner)
        setTotalMembersCount(nextTotalCount)
        setTotalRegularMembersCount(nextRegularCount)
        setLeadershipMembers(
          leadershipRows.map((member) => ({
            ...member,
            profile: profilesById[member.user_id] ?? null,
          }))
        )
        setMembers(
          memberRows.map((member) => ({
            ...member,
            profile: profilesById[member.user_id] ?? null,
          }))
        )
      } catch (error) {
        if (!isMounted) return
        console.error("Error loading organization team:", error)
        setLeadershipMembers([])
        setMembers([])
        setTotalMembersCount(0)
        setTotalRegularMembersCount(0)
        setCanManage(false)
        setMembersError("לא הצלחנו לטעון את צוות הארגון כרגע.")
      } finally {
        if (isMounted) {
          setLoadingMembers(false)
        }
      }
    }

    if (selectedOrganization) {
      void loadMembers()
    }

    return () => {
      isMounted = false
    }
  }, [currentPage, deferredMemberSearchQuery, memberRefreshKey, selectedOrganization, user?.id])

  useEffect(() => {
    setSelectedMemberId((current) => {
      if (!current) return null
      return members.some((member) => member.user_id === current) ? current : null
    })
  }, [leadershipMembers, members])

  const totalPages = Math.max(1, Math.ceil(totalRegularMembersCount / MEMBERS_PAGE_SIZE))
  const shouldShowInitialMembersSkeleton = loadingOrganizations || (loadingMembers && members.length === 0 && totalMembersCount === 0 && !membersError)

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const selectedMember = members.find((member) => member.user_id === selectedMemberId) ?? null

  useEffect(() => {
    if (!selectedMember) {
      setMemberDisplayName("")
      setMemberTitle("")
      setMemberRole("member")
      setMemberStatus("active")
      setMemberSaveError(null)
      setMemberSaveMessage(null)
      return
    }

    setMemberDisplayName(selectedMember.profile?.display_name?.trim() || "")
    setMemberTitle(selectedMember.title?.trim() || "")
    setMemberRole(selectedMember.role || "member")
    setMemberStatus(selectedMember.status || "active")
    setMemberSaveError(null)
    setMemberSaveMessage(null)
  }, [selectedMember])

  const organizationOptions = useMemo(
    () =>
      organizations.map((organization) => ({
        id: organization.id,
        label: organization.name?.trim() || `ארגון #${organization.id}`,
      })),
    [organizations]
  )

  const groupedMembers = useMemo(() => {
    const leadership = leadershipMembers
    const regular = members


    return [
      { key: "leadership", title: "בעלים ומנהלים", members: leadership },
      { key: "regular", title: "חברי צוות", members: regular },
    ].filter((group) => group.members.length > 0)
  }, [members])

  const visibleGroupedMembers = useMemo(
    () =>
      [
        { key: "leadership", title: "בעלים ומנהלים", members: leadershipMembers },
        { key: "regular", title: "חברי צוות", members },
      ].filter((group) => group.members.length > 0),
    [leadershipMembers, members]
  )

  const groupCounts = useMemo(
    () => ({
      leadership: leadershipMembers.length,
      regular: totalRegularMembersCount,
    }),
    [leadershipMembers.length, totalRegularMembersCount]
  )
  void visibleGroupedMembers

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find((organization) => organization.id.toString() === value)
    if (!nextOrganization) return
    navigate(`/${getOrganizationSegment(nextOrganization)}/team`)
  }

  const handleSaveMember = async () => {
    if (!selectedOrganization || !selectedMember || !canManage) return

    setMemberSaving(true)
    setMemberSaveError(null)
    setMemberSaveMessage(null)

    try {
      const trimmedDisplayName = memberDisplayName.trim()
      const trimmedTitle = memberTitle.trim()

      const [profileResult, membershipResult] = await Promise.all([
        supabase.from("profiles").update({ display_name: trimmedDisplayName || null }).eq("id", selectedMember.user_id),
        supabase
          .from("organization_users")
          .update({ role: memberRole, status: memberStatus, title: trimmedTitle || null })
          .eq("organization_id", selectedOrganization.id)
          .eq("user_id", selectedMember.user_id),
      ])

      if (profileResult.error) throw profileResult.error
      if (membershipResult.error) throw membershipResult.error

      const updatedMember: TeamMember = {
        ...selectedMember,
        role: memberRole,
        status: memberStatus,
        title: trimmedTitle || null,
        profile: selectedMember.profile
          ? { ...selectedMember.profile, display_name: trimmedDisplayName || null }
          : { id: selectedMember.user_id, display_name: trimmedDisplayName || null, avatar_url: null },
      }

      if (memberStatus === "inactive") {
        setMembers((current) => current.filter((member) => member.user_id !== selectedMember.user_id))
        setMemberSaveMessage("חבר הצוות הועבר למצב לא פעיל והוסר מהרשימה הפעילה.")
      } else {
        setMembers((current) =>
          current.map((member) => (member.user_id === selectedMember.user_id ? updatedMember : member))
        )
        setMemberSaveMessage("פרטי חבר הצוות עודכנו.")
      }
    } catch (error) {
      console.error("Error updating organization member:", error)
      setMemberSaveError("לא הצלחנו לעדכן את חבר הצוות כרגע.")
    } finally {
      setMemberSaving(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!selectedOrganization || !selectedMember || !canManage) return

    const shouldRemove = window.confirm("להסיר את חבר הצוות מהארגון?")
    if (!shouldRemove) return

    setMemberRemoving(true)
    setMemberSaveError(null)
    setMemberSaveMessage(null)

    try {
      const { error } = await supabase
        .from("organization_users")
        .delete()
        .eq("organization_id", selectedOrganization.id)
        .eq("user_id", selectedMember.user_id)

      if (error) throw error

      setMembers((current) => current.filter((member) => member.user_id !== selectedMember.user_id))
      setMemberSaveMessage("חבר הצוות הוסר מהארגון.")
    } catch (error) {
      console.error("Error removing organization member:", error)
      setMemberSaveError("לא הצלחנו להסיר את חבר הצוות כרגע.")
    } finally {
      setMemberRemoving(false)
    }
  }

  const handleOpenCreatePage = () => {
    if (!selectedOrganization) return
    navigate(`/${getOrganizationSegment(selectedOrganization)}/team/new`)
  }

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    setImportError(null)
    setImportProgressLabel(null)
    setImportSummary(null)
    setImportFailures([])

    if (!file) {
      setImportFileName(null)
      setImportUsers([])
      setImportUsersCount(0)
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown

      if (!Array.isArray(parsed)) {
        throw new Error("קובץ הייבוא חייב להכיל מערך JSON של משתמשים.")
      }

      setImportFileName(file.name)
      setImportUsers(parsed)
      setImportUsersCount(parsed.length)
    } catch (error) {
      console.error("Error parsing import file:", error)
      setImportFileName(file.name)
      setImportUsers([])
      setImportUsersCount(0)
      setImportError(error instanceof Error ? error.message : "לא הצלחנו לקרוא את קובץ ה-JSON.")
    } finally {
      event.target.value = ""
    }
  }

  const handleImportUsers = async () => {
    if (!selectedOrganization || !canManage || importUsers.length === 0) return
    const organizationId = selectedOrganization.id

    setImportingUsers(true)
    setImportError(null)
    setImportSummary(null)
    setImportFailures([])

    try {
      const importChunks = Array.from(
        { length: Math.ceil(importUsers.length / IMPORT_REQUEST_CHUNK_SIZE) },
        (_, index) =>
          importUsers.slice(
            index * IMPORT_REQUEST_CHUNK_SIZE,
            (index + 1) * IMPORT_REQUEST_CHUNK_SIZE
          )
      )

      let createdCount = 0
      let failedCount = 0
      const collectedFailures: Array<{ email: string; error: string }> = []

      for (const [index, usersChunk] of importChunks.entries()) {
        setImportProgressLabel(
          `מייבא אצווה ${index + 1} מתוך ${importChunks.length} (${Math.min(
            (index + 1) * IMPORT_REQUEST_CHUNK_SIZE,
            importUsers.length
          )}/${importUsers.length})`
        )

        const { data, error } = await supabase.functions.invoke<{
          summary?: {
            requested: number
            created: number
            failed: number
          }
          results?: Array<{
            email?: string
            success?: boolean
            error?: string
          }>
        }>("bulk-create-managed-users", {
          body: {
            organization_id: organizationId,
            batch_size: 5,
            concurrency: 1,
            users: usersChunk,
          },
        })

        if (error) {
          throw new Error(`הייבוא נעצר באצווה ${index + 1} מתוך ${importChunks.length}: ${error.message}`)
        }

        createdCount += data?.summary?.created ?? 0
        failedCount += data?.summary?.failed ?? 0

        for (const result of data?.results ?? []) {
          if (result.success) continue
          if (collectedFailures.length >= 5) break

          collectedFailures.push({
            email: result.email?.trim() || "ללא אימייל",
            error: result.error?.trim() || "שגיאה לא ידועה",
          })
        }
      }

      setImportSummary({
        requested: importUsers.length,
        created: createdCount,
        failed: failedCount,
      })
      setImportFailures(collectedFailures)
      setMemberRefreshKey((current) => current + 1)
      return

      const { data, error } = await supabase.functions.invoke<{
        summary?: {
          requested: number
          created: number
          failed: number
        }
        results?: Array<{
          email?: string
          success?: boolean
          error?: string
        }>
      }>("bulk-create-managed-users", {
        body: {
          organization_id: organizationId,
          batch_size: 25,
          concurrency: 5,
          users: importUsers,
        },
      })

      if (error) throw error

      const summary = data?.summary ?? {
        requested: importUsers.length,
        created: 0,
        failed: 0,
      }

      const failures = (data?.results ?? [])
        .filter((result) => !result.success)
        .slice(0, 5)
        .map((result) => ({
          email: result.email?.trim() || "ללא אימייל",
          error: result.error?.trim() || "שגיאה לא ידועה",
        }))

      setImportSummary(summary)
      setImportFailures(failures)
      setMemberRefreshKey((current) => current + 1)
    } catch (error) {
      console.error("Error importing organization members:", error)
      if (error instanceof Error) {
        setImportError(error.message)
        return
      }
      setImportError("לא הצלחנו לייבא את קובץ המשתמשים כרגע.")
    } finally {
      setImportProgressLabel(null)
      setImportingUsers(false)
    }
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as CSSProperties}>
      <AppSidebar side="right" variant="inset" />
      <SidebarInset dir="rtl">
        <SiteHeader
          title="ניהול צוות ארגוני"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />
        <PageBody>
          <div className="page-stack flex-1">
            {shouldShowInitialMembersSkeleton ? (
              <PageMainLayout>
                <PageMainContent>
                  <Skeleton className="h-[32rem] rounded-3xl" />
                </PageMainContent>
                <PageMainRail>
                  <Skeleton className="h-[32rem] rounded-3xl" />
                </PageMainRail>
              </PageMainLayout>
            ) : organizationsError ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>העמוד אינו זמין</AlertTitle>
                <AlertDescription>{organizationsError}</AlertDescription>
              </Alert>
            ) : !selectedOrganization ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>הארגון לא זמין</AlertTitle>
                <AlertDescription>לא הצלחנו לזהות את הארגון לעמוד הזה.</AlertDescription>
              </Alert>
            ) : (
              <PageMainLayout>
                <PageMainRail>
                  <div className="space-y-4">
                    <InfoPanel className="xl:static">
                      <InfoPanelHeader
                        icon={ShieldUser}
                        title={selectedOrganization.name?.trim() || `ארגון #${selectedOrganization.id}`}
                        description={selectedOrganization.notes?.trim() || "ניהול חברי הארגון והרשאותיהם."}
                        badge={<Badge variant={canManage ? "default" : "outline"}>{canManage ? "בעלים" : "קריאה בלבד"}</Badge>}
                      />
                      <InfoPanelBody className="pt-0" />
                    </InfoPanel>

                    <Card className="border-border/70 shadow-none">
                      <CardContent className="flex flex-col gap-3 p-5">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">יצירת חבר חדש</p>
                          <p className="text-sm text-muted-foreground">
                            פתיחת משתמש חדש נעשית בעמוד ייעודי, כדי להשאיר את עמוד הצוות ממוקד בניהול הקיים.
                          </p>
                        </div>
                        <Button onClick={handleOpenCreatePage} disabled={!canManage} className="w-full rounded-xl">
                          <UserPlus className="size-4" />
                          יצירת חבר חדש
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-none">
                      <CardContent className="flex flex-col gap-4 p-5">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">ייבוא חברים מ-JSON</p>
                          <p className="text-sm text-muted-foreground">
                            העלו קובץ JSON של עובדים כדי ליצור חשבונות בכמות גדולה דרך מנגנון הייבוא החדש.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="organization-members-import" className="text-sm font-medium">
                            קובץ JSON
                          </label>
                          <Input
                            id="organization-members-import"
                            type="file"
                            accept=".json,application/json"
                            onChange={handleImportFileChange}
                            disabled={!canManage || importingUsers}
                            className="cursor-pointer rounded-xl"
                          />
                        </div>

                        {importFileName ? (
                          <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-3">
                            <FileJson className="mt-0.5 size-4 text-muted-foreground" />
                            <div className="space-y-1 text-sm">
                              <div className="font-medium">{importFileName}</div>
                              <div className="text-muted-foreground">
                                {importUsersCount} רשומות מוכנות לייבוא
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {importProgressLabel ? (
                          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                            {importProgressLabel}
                          </div>
                        ) : null}

                        {importError ? (
                          <Alert variant="destructive">
                            <AlertTitle>הייבוא נכשל</AlertTitle>
                            <AlertDescription>{importError}</AlertDescription>
                          </Alert>
                        ) : null}

                        {importSummary ? (
                          <Alert>
                            <AlertTitle>סיכום ייבוא</AlertTitle>
                            <AlertDescription className="space-y-2">
                              <div>
                                התבקשו {importSummary.requested} משתמשים, נוצרו {importSummary.created}, ונכשלו {importSummary.failed}.
                              </div>
                              {importFailures.length > 0 ? (
                                <div className="space-y-1 text-sm">
                                  {importFailures.map((failure) => (
                                    <div key={`${failure.email}-${failure.error}`} className="text-muted-foreground">
                                      {failure.email}: {failure.error}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </AlertDescription>
                          </Alert>
                        ) : null}

                        <Button
                          onClick={handleImportUsers}
                          disabled={!canManage || importingUsers || importUsers.length === 0}
                          className="w-full rounded-xl"
                          variant="outline"
                        >
                          <Upload className="size-4" />
                          {importingUsers ? "מייבא משתמשים..." : "ייבוא משתמשים מהקובץ"}
                        </Button>
                      </CardContent>
                    </Card>

                  </div>
                </PageMainRail>

                <PageMainContent>
                  <div
                    dir="ltr"
                    className={cn(
                      "grid gap-4",
                      selectedMember && "xl:grid-cols-[minmax(22rem,0.82fr)_minmax(0,1.18fr)]"
                    )}
                  >
                    {selectedMember ? (
                      <Card dir="rtl" className="border-border/70 shadow-none xl:sticky xl:top-24 animate-in fade-in-0 zoom-in-95 slide-in-from-left-2 duration-200">
                        <CardHeader className="gap-3">
                          <CardTitle className="flex items-center gap-2 text-xl">
                            <Users2 className="size-5" />
                            ניהול חבר קיים
                          </CardTitle>
                          <CardDescription>
                            כאן אפשר לעדכן את פרטי החבר שבחרתם מהרשימה.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
                            <MemberCard
                              name={selectedMember.profile?.display_name?.trim() || selectedMember.title?.trim() || "חבר צוות"}
                              meta={selectedMember.title?.trim() || "ללא תיאור תפקיד"}
                              avatarUrl={selectedMember.profile?.avatar_url ?? undefined}
                              initialsSource={selectedMember.profile?.display_name || selectedMember.title}
                              badgeLabel={getRoleLabel(selectedMember.role)}
                              className="border-border/70 bg-card"
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">שם מלא</label>
                              <Input value={memberDisplayName} onChange={(event) => setMemberDisplayName(event.target.value)} disabled={!canManage || memberSaving || memberRemoving} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">טייטל</label>
                              <Input value={memberTitle} onChange={(event) => setMemberTitle(event.target.value)} disabled={!canManage || memberSaving || memberRemoving} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">תפקיד ארגוני</label>
                              <Select value={memberRole} onValueChange={setMemberRole} disabled={!canManage || memberSaving || memberRemoving}>
                                <SelectTrigger className="rounded-xl">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
                                  {ROLE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">סטטוס</label>
                              <Select value={memberStatus} onValueChange={setMemberStatus} disabled={!canManage || memberSaving || memberRemoving}>
                                <SelectTrigger className="rounded-xl">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
                                  {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {memberSaveError ? (
                            <Alert variant="destructive">
                              <AlertTitle>העדכון נכשל</AlertTitle>
                              <AlertDescription>{memberSaveError}</AlertDescription>
                            </Alert>
                          ) : null}

                          {memberSaveMessage ? (
                            <Alert>
                              <AlertTitle>העדכון בוצע</AlertTitle>
                              <AlertDescription>{memberSaveMessage}</AlertDescription>
                            </Alert>
                          ) : null}

                          <div className="flex items-center justify-between gap-3">
                            <Button variant="destructive" onClick={handleRemoveMember} disabled={!canManage || memberSaving || memberRemoving}>
                              {memberRemoving ? "מסיר..." : "הסרה מהארגון"}
                            </Button>
                            <Button onClick={handleSaveMember} disabled={!canManage || memberSaving || memberRemoving} className="rounded-xl">
                              {memberSaving ? "שומר..." : "שמירת שינויים"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}

                    <Card dir="rtl" className="border-border/70 shadow-none">
                      <CardHeader className="gap-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                          <div className="space-y-2">
                            <CardTitle className="flex items-center gap-2 text-xl">
                              <Users2 className="size-5" />
                              חברי הארגון
                            </CardTitle>
                            <CardDescription>
                              זהו מוקד הניהול הראשי של צוות הארגון: חברים פעילים, תפקידים, ופרטי השיוך הארגוני שלהם.
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="rounded-full">
                            סה"כ {totalMembersCount} חברים
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="organization-members-search" className="text-sm font-medium">
                            חיפוש חברים
                          </label>
                          <Input
                            id="organization-members-search"
                            value={memberSearchQuery}
                            onChange={(event) => setMemberSearchQuery(event.target.value)}
                            placeholder="חיפוש לפי שם או טייטל"
                            className="rounded-xl"
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {membersError ? (
                          <Alert variant="destructive">
                            <AlertTitle>אי אפשר לטעון את הצוות</AlertTitle>
                            <AlertDescription>{membersError}</AlertDescription>
                          </Alert>
                        ) : totalMembersCount === 0 ? (
                          <Alert>
                            <AlertTitle>{deferredMemberSearchQuery ? "לא נמצאו תוצאות" : "עדיין אין חברי צוות"}</AlertTitle>
                            <AlertDescription>
                              {deferredMemberSearchQuery
                                ? "נסו לחפש בשם אחר או בטייטל אחר."
                                : "אפשר ליצור את המשתמש הראשון של הארגון מהעמוד הייעודי ליצירת חבר חדש."}
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <div className="space-y-5">
                            {loadingMembers ? (
                              <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                                טוען את חברי הארגון...
                              </div>
                            ) : null}
                            {groupedMembers.map((group) => (
                              <div key={group.key} className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-medium">{group.title}</div>
                                  <Badge variant="outline" className="rounded-full">
                                    {group.key === "leadership" ? groupCounts.leadership : groupCounts.regular}
                                  </Badge>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                  {group.members.map((member) => (
                                    <button
                                      key={member.user_id}
                                      type="button"
                                      className="w-full text-right"
                                      onClick={() =>
                                        setSelectedMemberId((current) =>
                                          current === member.user_id ? null : member.user_id
                                        )
                                      }
                                    >
                                      <MemberCard
                                        name={member.profile?.display_name?.trim() || member.title?.trim() || "חבר צוות"}
                                        meta={member.title?.trim() || "ללא תיאור תפקיד"}
                                        avatarUrl={member.profile?.avatar_url ?? undefined}
                                        initialsSource={member.profile?.display_name || member.title}
                                        badgeLabel={getRoleLabel(member.role)}
                                        className={
                                          selectedMemberId === member.user_id
                                            ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                                            : "border-border/70 bg-card transition-colors hover:border-primary/30"
                                        }
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                            <div className="flex flex-col gap-3 border-t border-border/60 pt-4 md:flex-row md:items-center md:justify-between">
                              <p className="text-sm text-muted-foreground">
                                עמוד {currentPage} מתוך {totalPages}
                              </p>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-xl"
                                  disabled={currentPage <= 1}
                                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                >
                                  הקודם
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-xl"
                                  disabled={currentPage >= totalPages}
                                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                >
                                  הבא
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </PageMainContent>
              </PageMainLayout>
            )}
          </div>
        </PageBody>
      </SidebarInset>
    </SidebarProvider>
  )
}
