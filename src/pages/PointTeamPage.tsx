import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CircleAlert, MapPinned, ShieldCheck, UserPlus, Users, Users2 } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  InfoPanel,
  InfoPanelBody,
  InfoPanelDetail,
  InfoPanelDetailList,
  InfoPanelHeader,
  InfoPanelSection,
  InfoPanelStat,
  InfoPanelStats,
} from "@/components/info-panel"
import { MemberCard } from "@/components/member-card"
import { PageBody, PageMainContent, PageMainLayout, PageMainRail } from "@/components/page-main-layout"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { getOrganizationSegment, getPointSegment, getRecordIdFromSegment } from "@/lib/drilldown"
import { getOrganizationsCached } from "@/lib/organizations"
import { getProfilesByIdsCached } from "@/lib/profile-cache"
import { supabase } from "@/lib/supabase"

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

type OrganizationMemberRow = {
  organization_id: number
  user_id: string
  role: string | null
  status: string | null
  title?: string | null
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

type TeamMember = {
  user_id: string
  role: string | null
  status: string | null
  title?: string | null
  profile: ProfileSummary | null
}

const ROLE_OPTIONS = [
  { value: "viewer", label: "צופה" },
  { value: "member", label: "חבר צוות" },
  { value: "admin", label: "מנהל נקודה" },
]

const formatMemberName = (member: TeamMember) =>
  member.profile?.display_name?.trim() || member.title?.trim() || "משתמש ארגוני"

const formatMemberMeta = (member: TeamMember) =>
  [member.title?.trim(), member.status?.trim()].filter(Boolean).join(" · ") || "משויך לנקודה"

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
  const [availableMembers, setAvailableMembers] = useState<TeamMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [membersError, setMembersError] = useState<string | null>(null)

  const [canManageTeam, setCanManageTeam] = useState(false)
  const [permissionLabel, setPermissionLabel] = useState("קריאה בלבד")

  const [selectedUserId, setSelectedUserId] = useState("")
  const [title, setTitle] = useState("")
  const [role, setRole] = useState("member")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

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
        const [pointResult, pointMembersResult, organizationMembersResult, orgPermissionResult, pointPermissionResult] =
          await Promise.all([
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
              .select("organization_id, user_id, role, status, title")
              .eq("organization_id", selectedOrganization.id)
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
        if (organizationMembersResult.error) throw organizationMembersResult.error
        if (orgPermissionResult.error) throw orgPermissionResult.error
        if (pointPermissionResult.error) throw pointPermissionResult.error

        const nextPoint = pointResult.data
        if (!nextPoint) {
          throw new Error("Point not found")
        }

        if (nextPoint.organization_id !== selectedOrganization.id) {
          throw new Error("Point does not belong to the selected organization")
        }

        const expectedPointSegment = getPointSegment(nextPoint)
        if (expectedPointSegment !== pointSlug) {
          navigate(
            `/${getOrganizationSegment(selectedOrganization)}/${expectedPointSegment}/team`,
            { replace: true }
          )
        }

        const orgPermissionRows = orgPermissionResult.data ?? []
        const pointPermissionRows = pointPermissionResult.data ?? []
        const nextCanManageTeam = orgPermissionRows.length > 0 || pointPermissionRows.length > 0

        let nextPermissionLabel = "קריאה בלבד"
        if (orgPermissionRows.some((row) => row.role === "owner")) {
          nextPermissionLabel = "בעלים ארגוני"
        } else if (orgPermissionRows.some((row) => row.role === "admin")) {
          nextPermissionLabel = "מנהל ארגוני"
        } else if (pointPermissionRows.length > 0) {
          nextPermissionLabel = "מנהל נקודה"
        }

        const pointMemberRows = (pointMembersResult.data ?? []) as PointMemberRow[]
        const organizationMemberRows = (organizationMembersResult.data ?? []) as OrganizationMemberRow[]
        const profilesById = await getProfilesByIdsCached(
          organizationMemberRows.map((member) => member.user_id)
        )

        if (!isMounted) return

        const pointMembersByUserId = new Map(
          pointMemberRows.map((member) => [member.user_id, member] as const)
        )

        const nextMembers = pointMemberRows.map((member) => ({
          user_id: member.user_id,
          role: member.role,
          status: member.status,
          title: member.title ?? null,
          profile: profilesById[member.user_id] ?? null,
        }))

        const nextAvailableMembers = organizationMemberRows
          .filter((member) => !pointMembersByUserId.has(member.user_id))
          .map((member) => ({
            user_id: member.user_id,
            role: member.role,
            status: member.status,
            title: member.title ?? null,
            profile: profilesById[member.user_id] ?? null,
          }))
          .sort((left, right) =>
            formatMemberName(left).localeCompare(formatMemberName(right), "he")
          )

        setPoint(nextPoint)
        setMembers(nextMembers)
        setAvailableMembers(nextAvailableMembers)
        setCanManageTeam(nextCanManageTeam)
        setPermissionLabel(nextPermissionLabel)
      } catch (error) {
        if (!isMounted) return
        console.error("Error loading point team:", error)
        setPoint(null)
        setMembers([])
        setAvailableMembers([])
        setCanManageTeam(false)
        setPermissionLabel("קריאה בלבד")
        if (error instanceof Error && error.message.includes("selected organization")) {
          setPointError("הנקודה הזו לא שייכת לארגון שנבחר.")
        } else {
          setPointError("לא הצלחנו לטעון את הנקודה הזו כרגע.")
        }
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

  const organizationOptions = useMemo(
    () =>
      organizations.map((organization) => ({
        id: organization.id,
        label: organization.name?.trim() || `ארגון #${organization.id}`,
      })),
    [organizations]
  )

  const selectedCandidate = useMemo(
    () => availableMembers.find((member) => member.user_id === selectedUserId) ?? null,
    [availableMembers, selectedUserId]
  )

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find(
      (organization) => organization.id.toString() === value
    )
    if (!nextOrganization) return
    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const resetForm = () => {
    setSelectedUserId("")
    setTitle("")
    setRole("member")
  }

  const handleAddMember = async () => {
    if (!point || !selectedOrganization || !selectedUserId || !canManageTeam) return

    setSaving(true)
    setSaveError(null)
    setSaveMessage(null)

    try {
      const { error } = await supabase.from("point_users").upsert(
        {
          point_id: point.id,
          user_id: selectedUserId,
          role,
          title: title.trim() || null,
          status: "active",
        },
        { onConflict: "point_id,user_id" }
      )

      if (error) {
        throw error
      }

      const candidate = selectedCandidate
      const nextMember: TeamMember = {
        user_id: selectedUserId,
        role,
        status: "active",
        title: title.trim() || candidate?.title || null,
        profile: candidate?.profile ?? null,
      }

      setMembers((current) =>
        [nextMember, ...current].sort((left, right) =>
          formatMemberName(left).localeCompare(formatMemberName(right), "he")
        )
      )
      setAvailableMembers((current) =>
        current.filter((member) => member.user_id !== selectedUserId)
      )
      setSaveMessage(
        `המשתמש ${formatMemberName(nextMember)} נוסף בהצלחה לצוות הנקודה.`
      )
      resetForm()
    } catch (error) {
      console.error("Error adding point member:", error)
      setSaveError("לא הצלחנו להוסיף את המשתמש לצוות הנקודה כרגע.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
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
                  <Skeleton className="h-[34rem] rounded-3xl" />
                </PageMainContent>
                <PageMainRail>
                  <Skeleton className="h-[34rem] rounded-3xl" />
                </PageMainRail>
              </PageMainLayout>
            ) : organizationsError || pointError ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>העמוד אינו זמין</AlertTitle>
                <AlertDescription>
                  {pointError || organizationsError || "לא הצלחנו לטעון את עמוד צוות הנקודה."}
                </AlertDescription>
              </Alert>
            ) : !selectedOrganization || !point ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>הנקודה לא זמינה</AlertTitle>
                <AlertDescription>לא הצלחנו לזהות את הנקודה עבור העמוד הזה.</AlertDescription>
              </Alert>
            ) : (
              <PageMainLayout>
                <PageMainContent>
                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="gap-3">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Users2 className="size-5" />
                        חברי הנקודה
                      </CardTitle>
                      <CardDescription>
                        כאן מופיעים כל המשתמשים הפעילים שמשויכים לנקודה, יחד עם התפקיד והטייטל שלהם.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {membersError ? (
                        <Alert variant="destructive">
                          <AlertTitle>אי אפשר לטעון את צוות הנקודה</AlertTitle>
                          <AlertDescription>{membersError}</AlertDescription>
                        </Alert>
                      ) : members.length === 0 ? (
                        <Alert>
                          <AlertTitle>עדיין אין חברי נקודה</AlertTitle>
                          <AlertDescription>
                            אפשר להוסיף את חבר הצוות הראשון לנקודה מתוך חברי הארגון הקיימים.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {members.map((member) => {
                            const memberName = formatMemberName(member)
                            return (
                              <MemberCard
                                key={member.user_id}
                                name={memberName}
                                meta={formatMemberMeta(member)}
                                avatarUrl={member.profile?.avatar_url ?? undefined}
                                initialsSource={member.profile?.display_name || member.title}
                                badgeLabel={member.role || "member"}
                                className="border-border/70 bg-card"
                              />
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="gap-3">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <UserPlus className="size-5" />
                        הוספת חבר צוות לנקודה
                      </CardTitle>
                      <CardDescription>
                        אפשר לבחור רק משתמשים שכבר קיימים בתוך אותו ארגון, ולהוסיף אותם לנקודה עם תפקיד וטייטל מתאימים.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {!canManageTeam ? (
                        <Alert variant="destructive">
                          <AlertTitle>אין הרשאה</AlertTitle>
                          <AlertDescription>
                            רק בעלי ומנהלי הארגון, או מנהלי הנקודה, יכולים לנהל את צוות הנקודה.
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      {availableMembers.length === 0 ? (
                        <Alert>
                          <AlertTitle>אין כרגע משתמשים זמינים להוספה</AlertTitle>
                          <AlertDescription>
                            כל חברי הארגון כבר משויכים לנקודה הזו, או שאין עדיין חברים פעילים בארגון.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium">בחירת משתמש מהארגון</label>
                            <Select
                              value={selectedUserId}
                              onValueChange={setSelectedUserId}
                              disabled={!canManageTeam || saving}
                            >
                              <SelectTrigger className="rounded-xl">
                                <SelectValue placeholder="בחרו משתמש קיים מהארגון" />
                              </SelectTrigger>
                              <SelectContent align="end">
                                {availableMembers.map((member) => (
                                  <SelectItem key={member.user_id} value={member.user_id}>
                                    {formatMemberName(member)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">תפקיד בנקודה</label>
                            <Select
                              value={role}
                              onValueChange={setRole}
                              disabled={!canManageTeam || saving}
                            >
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
                            <label className="text-sm font-medium">טייטל בנקודה</label>
                            <Input
                              value={title}
                              onChange={(event) => setTitle(event.target.value)}
                              disabled={!canManageTeam || saving}
                              placeholder="למשל: טכנאי קבלה"
                            />
                          </div>
                        </div>
                      )}

                      {selectedCandidate ? (
                        <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                          המשתמש שנבחר:{" "}
                          <span className="font-medium text-foreground">
                            {formatMemberName(selectedCandidate)}
                          </span>
                        </div>
                      ) : null}

                      {saveError ? (
                        <Alert variant="destructive">
                          <AlertTitle>ההוספה נכשלה</AlertTitle>
                          <AlertDescription>{saveError}</AlertDescription>
                        </Alert>
                      ) : null}

                      {saveMessage ? (
                        <Alert>
                          <AlertTitle>המשתמש נוסף</AlertTitle>
                          <AlertDescription>{saveMessage}</AlertDescription>
                        </Alert>
                      ) : null}

                      <div className="flex justify-end">
                        <Button
                          onClick={handleAddMember}
                          disabled={!canManageTeam || saving || !selectedUserId}
                          className="rounded-xl"
                        >
                          <UserPlus className="size-4" />
                          {saving ? "מוסיף משתמש..." : "הוספה לצוות הנקודה"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </PageMainContent>

                <PageMainRail>
                <InfoPanel>
                  <InfoPanelHeader
                    icon={MapPinned}
                    title={point.name?.trim() || `נקודה #${point.id}`}
                    description={point.notes?.trim() || "ניהול הצוות הפעיל של הנקודה מתוך משתמשי הארגון."}
                    badge={
                      <Badge variant={canManageTeam ? "default" : "outline"}>
                        {permissionLabel}
                      </Badge>
                    }
                  />
                  <InfoPanelBody>
                    <InfoPanelStats>
                      <InfoPanelStat
                        icon={Users}
                        label="חברי נקודה"
                        value={members.length}
                        description="משתמשים פעילים שכבר משויכים לנקודה"
                      />
                      <InfoPanelStat
                        icon={UserPlus}
                        label="זמינים להוספה"
                        value={availableMembers.length}
                        description="חברי ארגון שניתן לשייך לנקודה הזו"
                      />
                    </InfoPanelStats>

                    <InfoPanelSection
                      icon={ShieldCheck}
                      title="הרשאות ניהול"
                      description="ניהול צוות הנקודה זמין למנהלי נקודה ולמנהלי או בעלי הארגון."
                    >
                      <InfoPanelDetailList>
                        <InfoPanelDetail label="סטטוס גישה" value={permissionLabel} />
                        <InfoPanelDetail
                          label="סטטוס נקודה"
                          value={point.status === "active" ? "פעילה" : point.status || "לא פעילה"}
                        />
                      </InfoPanelDetailList>
                    </InfoPanelSection>

                    <InfoPanelSection title="הקשר ארגוני">
                      <InfoPanelDetailList>
                        <InfoPanelDetail
                          label="ארגון"
                          value={selectedOrganization.name?.trim() || `ארגון #${selectedOrganization.id}`}
                        />
                        <InfoPanelDetail
                          label="מסלול חזרה"
                          value="עמוד הנקודה"
                        />
                      </InfoPanelDetailList>
                    </InfoPanelSection>
                  </InfoPanelBody>
                </InfoPanel>
                </PageMainRail>
              </PageMainLayout>
            )}
          </div>
        </PageBody>
      </SidebarInset>
    </SidebarProvider>
  )
}
