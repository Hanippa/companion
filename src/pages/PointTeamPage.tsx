import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CircleAlert, MapPinned, UserPlus, Users2 } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { InfoPanel, InfoPanelBody, InfoPanelHeader } from "@/components/info-panel"
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
import { getOrganizationSegment, getPointSegment, getRecordIdFromSegment } from "@/lib/drilldown"
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

type PointRecord = {
  id: number
  organization_id: number
  name: string | null
  notes: string | null
  status: string | null
}

type PointMemberRow = {
  point_id: number
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

type TeamMember = PointMemberRow & {
  profile: ProfileSummary | null
}

const ROLE_OPTIONS = [
  { value: "viewer", label: "צופה" },
  { value: "member", label: "חבר צוות" },
  { value: "admin", label: "מנהל נקודה" },
]

const STATUS_OPTIONS = [
  { value: "active", label: "פעיל" },
  { value: "inactive", label: "לא פעיל" },
]

const getRoleLabel = (role: string | null) => {
  switch (role) {
    case "admin":
      return "מנהל נקודה"
    case "viewer":
      return "צופה"
    case "member":
    default:
      return "חבר צוות"
  }
}

export default function PointTeamPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { organizationSlug, pointSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)
  const pointIdFromRoute = getRecordIdFromSegment(pointSlug)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)
  const [point, setPoint] = useState<PointRecord | null>(null)
  const [loadingPoint, setLoadingPoint] = useState(true)
  const [pointError, setPointError] = useState<string | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [canManageTeam, setCanManageTeam] = useState(false)
  const [permissionLabel, setPermissionLabel] = useState("קריאה בלבד")
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [memberTitle, setMemberTitle] = useState("")
  const [memberRole, setMemberRole] = useState("member")
  const [memberStatus, setMemberStatus] = useState("active")
  const [memberSaveError, setMemberSaveError] = useState<string | null>(null)
  const [memberSaveMessage, setMemberSaveMessage] = useState<string | null>(null)
  const [memberSaving, setMemberSaving] = useState(false)
  const [memberRemoving, setMemberRemoving] = useState(false)

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

    if (!selectedOrganization || organizationIdFromRoute === null || pointIdFromRoute === null) {
      navigate("/dashboard", { replace: true })
      return
    }

    const expectedOrganizationSegment = getOrganizationSegment(selectedOrganization)
    if (expectedOrganizationSegment !== organizationSlug) {
      navigate(`/${expectedOrganizationSegment}/${pointSlug ?? ""}/team`, { replace: true })
    }
  }, [
    loadingOrganizations,
    organizations,
    organizationsError,
    navigate,
    organizationIdFromRoute,
    organizationSlug,
    pointIdFromRoute,
    pointSlug,
    selectedOrganization,
  ])

  useEffect(() => {
    let isMounted = true

    const loadPointTeam = async () => {
      if (!selectedOrganization || pointIdFromRoute === null || !user?.id) {
        setLoadingPoint(false)
        setLoadingMembers(false)
        return
      }

      setLoadingPoint(true)
      setPointError(null)
      setLoadingMembers(true)
      setMembersError(null)

      try {
        const [
          pointResult,
          pointMembersResult,
          orgPermissionResult,
          pointPermissionResult,
        ] = await Promise.all([
          supabase
            .from("points")
            .select("id, organization_id, name, notes, status")
            .eq("id", pointIdFromRoute)
            .single<PointRecord>(),
          supabase
            .from("point_users")
            .select("point_id, user_id, role, status, title")
            .eq("point_id", pointIdFromRoute)
            .eq("status", "active")
            .order("user_id", { ascending: true }),
          supabase
            .from("organization_users")
            .select("role")
            .eq("organization_id", selectedOrganization.id)
            .eq("user_id", user.id)
            .eq("status", "active")
            .in("role", ["admin", "owner"]),
          supabase
            .from("point_users")
            .select("role")
            .eq("point_id", pointIdFromRoute)
            .eq("user_id", user.id)
            .eq("status", "active")
            .eq("role", "admin"),
        ])

        if (pointResult.error) throw pointResult.error
        if (pointMembersResult.error) throw pointMembersResult.error
        if (orgPermissionResult.error) throw orgPermissionResult.error
        if (pointPermissionResult.error) throw pointPermissionResult.error

        const nextPoint = pointResult.data
        if (!nextPoint) throw new Error("Point not found")
        if (nextPoint.organization_id !== selectedOrganization.id) {
          throw new Error("Point does not belong to selected organization")
        }

        const expectedPointSegment = getPointSegment(nextPoint)
        if (expectedPointSegment !== pointSlug) {
          navigate(`/${getOrganizationSegment(selectedOrganization)}/${expectedPointSegment}/team`, {
            replace: true,
          })
        }

        const pointMemberRows = (pointMembersResult.data ?? []) as PointMemberRow[]
        const profilesById = await getProfilesByIdsCached(pointMemberRows.map((member) => member.user_id))

        if (!isMounted) return

        const nextCanManageTeam =
          (orgPermissionResult.data ?? []).length > 0 || (pointPermissionResult.data ?? []).length > 0

        let nextPermissionLabel = "קריאה בלבד"
        if ((orgPermissionResult.data ?? []).length > 0) {
          nextPermissionLabel = "ניהול ארגוני"
        } else if ((pointPermissionResult.data ?? []).length > 0) {
          nextPermissionLabel = "מנהל נקודה"
        }

        setPoint(nextPoint)
        setMembers(
          pointMemberRows.map((member) => ({
            ...member,
            profile: profilesById[member.user_id] ?? null,
          }))
        )
        setCanManageTeam(nextCanManageTeam)
        setPermissionLabel(nextPermissionLabel)
      } catch (error) {
        if (!isMounted) return
        console.error("Error loading point team:", error)
        setPoint(null)
        setMembers([])
        setCanManageTeam(false)
        setPermissionLabel("קריאה בלבד")
        setPointError("לא הצלחנו לטעון את הנקודה הזו כרגע.")
        setMembersError("לא הצלחנו לטעון את צוות הנקודה כרגע.")
      } finally {
        if (isMounted) {
          setLoadingPoint(false)
          setLoadingMembers(false)
        }
      }
    }

    void loadPointTeam()

    return () => {
      isMounted = false
    }
  }, [navigate, pointIdFromRoute, pointSlug, selectedOrganization, user?.id])

  useEffect(() => {
    setSelectedMemberId((current) => {
      if (!current) return null
      return members.some((member) => member.user_id === current) ? current : null
    })
  }, [members])

  const selectedMember = members.find((member) => member.user_id === selectedMemberId) ?? null

  useEffect(() => {
    if (!selectedMember) {
      setMemberTitle("")
      setMemberRole("member")
      setMemberStatus("active")
      setMemberSaveError(null)
      setMemberSaveMessage(null)
      return
    }

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
    const admins = members.filter((member) => member.role === "admin")
    const regular = members.filter((member) => member.role !== "admin")

    return [
      { key: "admins", title: "מנהלי נקודה", members: admins },
      { key: "regular", title: "חברי צוות", members: regular },
    ].filter((group) => group.members.length > 0)
  }, [members])

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find((organization) => organization.id.toString() === value)
    if (!nextOrganization) return
    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const formatMemberName = (member: TeamMember) =>
    member.profile?.display_name?.trim() || member.title?.trim() || "משתמש ארגוני"

  const handleSaveMember = async () => {
    if (!point || !selectedMember || !canManageTeam) return

    setMemberSaving(true)
    setMemberSaveError(null)
    setMemberSaveMessage(null)

    try {
      const trimmedTitle = memberTitle.trim()
      const { error } = await supabase
        .from("point_users")
        .update({
          role: memberRole,
          status: memberStatus,
          title: trimmedTitle || null,
        })
        .eq("point_id", point.id)
        .eq("user_id", selectedMember.user_id)

      if (error) throw error

      const updatedMember: TeamMember = {
        ...selectedMember,
        role: memberRole,
        status: memberStatus,
        title: trimmedTitle || null,
      }

      if (memberStatus === "inactive") {
        setMembers((current) => current.filter((member) => member.user_id !== selectedMember.user_id))
        setMemberSaveMessage("חבר הנקודה הועבר למצב לא פעיל והוסר מהרשימה הפעילה.")
      } else {
        setMembers((current) =>
          current.map((member) => (member.user_id === selectedMember.user_id ? updatedMember : member))
        )
        setMemberSaveMessage("פרטי חבר הנקודה עודכנו.")
      }
    } catch (error) {
      console.error("Error updating point member:", error)
      setMemberSaveError("לא הצלחנו לעדכן את חבר הנקודה כרגע.")
    } finally {
      setMemberSaving(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!point || !selectedMember || !canManageTeam) return

    const shouldRemove = window.confirm("להסיר את חבר הצוות מהנקודה?")
    if (!shouldRemove) return

    setMemberRemoving(true)
    setMemberSaveError(null)
    setMemberSaveMessage(null)

    try {
      const { error } = await supabase
        .from("point_users")
        .delete()
        .eq("point_id", point.id)
        .eq("user_id", selectedMember.user_id)

      if (error) throw error

      setMembers((current) => current.filter((member) => member.user_id !== selectedMember.user_id))
      setMemberSaveMessage("חבר הצוות הוסר מהנקודה.")
    } catch (error) {
      console.error("Error removing point member:", error)
      setMemberSaveError("לא הצלחנו להסיר את חבר הנקודה כרגע.")
    } finally {
      setMemberRemoving(false)
    }
  }

  const handleOpenCreatePage = () => {
    if (!selectedOrganization || !point) return
    navigate(`/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(point)}/team/new`)
  }

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)",
      } as CSSProperties}
    >
      <AppSidebar side="right" variant="inset" />
      <SidebarInset dir="rtl">
        <SiteHeader
          title="ניהול צוות נקודה"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />

        <PageBody>
          <div className="page-stack flex-1">
            {loadingOrganizations || loadingPoint || loadingMembers ? (
              <PageMainLayout>
                <PageMainContent>
                  <Skeleton className="h-[32rem] rounded-3xl" />
                </PageMainContent>
                <PageMainRail>
                  <Skeleton className="h-[32rem] rounded-3xl" />
                </PageMainRail>
              </PageMainLayout>
            ) : organizationsError || pointError ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>העמוד אינו זמין</AlertTitle>
                <AlertDescription>{pointError || organizationsError || "לא הצלחנו לטעון את עמוד צוות הנקודה."}</AlertDescription>
              </Alert>
            ) : !selectedOrganization || !point ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>הנקודה לא זמינה</AlertTitle>
                <AlertDescription>לא הצלחנו לזהות את הנקודה עבור העמוד הזה.</AlertDescription>
              </Alert>
            ) : (
              <PageMainLayout>
                <PageMainRail>
                  <div className="space-y-4">
                    <InfoPanel className="xl:static">
                      <InfoPanelHeader
                        icon={MapPinned}
                        title={point.name?.trim() || `נקודה #${point.id}`}
                        description={point.notes?.trim() || "ניהול חברי הנקודה."}
                        badge={<Badge variant={canManageTeam ? "default" : "outline"}>{permissionLabel}</Badge>}
                      />
                      <InfoPanelBody className="pt-0" />
                    </InfoPanel>

                    <Card className="border-border/70 shadow-none">
                      <CardContent className="flex flex-col gap-3 p-5">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">הוספת חבר חדש</p>
                          <p className="text-sm text-muted-foreground">
                            הוספת חבר לנקודה נעשית בעמוד נפרד, כדי להשאיר את העמוד הזה ממוקד בניהול הצוות.
                          </p>
                        </div>
                        <Button onClick={handleOpenCreatePage} disabled={!canManageTeam} className="w-full rounded-xl">
                          <UserPlus className="size-4" />
                          הוספת חבר לנקודה
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
                            עדכנו כאן את פרטי החבר שנבחר.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
                            <MemberCard
                              name={formatMemberName(selectedMember)}
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
                              <Input
                                value={selectedMember.profile?.display_name?.trim() || "לא הוגדר"}
                                disabled
                                readOnly
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">טייטל בנקודה</label>
                              <Input
                                value={memberTitle}
                                onChange={(event) => setMemberTitle(event.target.value)}
                                disabled={!canManageTeam || memberSaving || memberRemoving}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">תפקיד בנקודה</label>
                              <Select value={memberRole} onValueChange={setMemberRole} disabled={!canManageTeam || memberSaving || memberRemoving}>
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
                              <Select value={memberStatus} onValueChange={setMemberStatus} disabled={!canManageTeam || memberSaving || memberRemoving}>
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
                            <Button variant="destructive" onClick={handleRemoveMember} disabled={!canManageTeam || memberSaving || memberRemoving}>
                              {memberRemoving ? "מסיר..." : "הסרה מהנקודה"}
                            </Button>
                            <Button onClick={handleSaveMember} disabled={!canManageTeam || memberSaving || memberRemoving} className="rounded-xl">
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
                              חברי הנקודה
                            </CardTitle>
                            <CardDescription>
                              כאן מנהלים את חברי הנקודה, התפקידים והסטטוס שלהם.
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="rounded-full">
                            סה"כ {members.length} חברים
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {membersError ? (
                          <Alert variant="destructive">
                            <AlertTitle>אי אפשר לטעון את הצוות</AlertTitle>
                            <AlertDescription>{membersError}</AlertDescription>
                          </Alert>
                        ) : members.length === 0 ? (
                          <Alert>
                            <AlertTitle>עדיין אין חברי נקודה</AlertTitle>
                            <AlertDescription>אפשר להוסיף את חבר הצוות הראשון מהעמוד הייעודי להוספת חבר לנקודה.</AlertDescription>
                          </Alert>
                        ) : (
                          <div className="space-y-5">
                            {groupedMembers.map((group) => (
                              <div key={group.key} className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-medium">{group.title}</div>
                                  <Badge variant="outline" className="rounded-full">
                                    {group.members.length}
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
                                        name={formatMemberName(member)}
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
