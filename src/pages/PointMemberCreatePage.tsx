import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CircleAlert, MapPinned, UserPlus } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  InfoPanel,
  InfoPanelBody,
  InfoPanelDetail,
  InfoPanelDetailList,
  InfoPanelHeader,
  InfoPanelSection,
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
}

type ProfileSummary = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

type CandidateMember = OrganizationMemberRow & {
  profile: ProfileSummary | null
}

const ROLE_OPTIONS = [
  { value: "viewer", label: "צופה" },
  { value: "member", label: "חבר צוות" },
  { value: "admin", label: "מנהל נקודה" },
]

const MEMBER_PICKER_PAGE_SIZE = 24

const formatMemberName = (member: CandidateMember) =>
  member.profile?.display_name?.trim() || member.title?.trim() || "משתמש ארגוני"

export default function PointMemberCreatePage() {
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
  const [canManageTeam, setCanManageTeam] = useState(false)
  const [availableMembers, setAvailableMembers] = useState<CandidateMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [memberSearchQuery, setMemberSearchQuery] = useState("")
  const [memberPickerPage, setMemberPickerPage] = useState(1)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [title, setTitle] = useState("")
  const [role, setRole] = useState("member")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
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

    if (!selectedOrganization || organizationIdFromRoute === null || pointIdFromRoute === null) {
      navigate("/dashboard", { replace: true })
      return
    }

    const expectedOrganizationSegment = getOrganizationSegment(selectedOrganization)
    if (expectedOrganizationSegment !== organizationSlug) {
      navigate(`/${expectedOrganizationSegment}/${pointSlug ?? ""}/team/new`, { replace: true })
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

    const loadPage = async () => {
      if (!selectedOrganization || pointIdFromRoute === null || !user?.id) {
        setLoadingPoint(false)
        setLoadingMembers(false)
        return
      }

      setLoadingPoint(true)
      setPointError(null)
      setLoadingMembers(true)

      try {
        const [
          pointResult,
          pointMembersResult,
          organizationMembersResult,
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
            .select("point_id, user_id")
            .eq("point_id", pointIdFromRoute),
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
        if (!nextPoint) throw new Error("Point not found")
        if (nextPoint.organization_id !== selectedOrganization.id) {
          throw new Error("Point does not belong to selected organization")
        }

        const pointMemberIds = new Set(
          ((pointMembersResult.data ?? []) as PointMemberRow[]).map((member) => member.user_id)
        )
        const organizationMembers = (organizationMembersResult.data ?? []) as OrganizationMemberRow[]
        const profilesById = await getProfilesByIdsCached(
          organizationMembers.map((member) => member.user_id)
        )

        if (!isMounted) return

        setPoint(nextPoint)
        setCanManageTeam(
          (orgPermissionResult.data ?? []).length > 0 || (pointPermissionResult.data ?? []).length > 0
        )
        setAvailableMembers(
          organizationMembers
            .filter((member) => !pointMemberIds.has(member.user_id))
            .map((member) => ({
              ...member,
              profile: profilesById[member.user_id] ?? null,
            }))
            .sort((left, right) => formatMemberName(left).localeCompare(formatMemberName(right), "he"))
        )
      } catch (error) {
        if (!isMounted) return
        console.error("Error loading point member create page:", error)
        setPoint(null)
        setAvailableMembers([])
        setCanManageTeam(false)
        setPointError("לא הצלחנו לטעון את נתוני הנקודה כרגע.")
      } finally {
        if (isMounted) {
          setLoadingPoint(false)
          setLoadingMembers(false)
        }
      }
    }

    void loadPage()

    return () => {
      isMounted = false
    }
  }, [navigate, pointIdFromRoute, selectedOrganization, user?.id])

  useEffect(() => {
    setMemberPickerPage(1)
  }, [deferredMemberSearchQuery])

  const organizationOptions = useMemo(
    () =>
      organizations.map((organization) => ({
        id: organization.id,
        label: organization.name?.trim() || `ארגון #${organization.id}`,
      })),
    [organizations]
  )

  const filteredAvailableMembers = useMemo(() => {
    if (!deferredMemberSearchQuery) return availableMembers

    const normalizedQuery = deferredMemberSearchQuery.toLocaleLowerCase("he")

    return availableMembers.filter((member) => {
      const searchableText = [
        formatMemberName(member),
        member.title ?? "",
        member.profile?.display_name ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("he")

      return searchableText.includes(normalizedQuery)
    })
  }, [availableMembers, deferredMemberSearchQuery])

  const memberPickerTotalPages = Math.max(
    1,
    Math.ceil(filteredAvailableMembers.length / MEMBER_PICKER_PAGE_SIZE)
  )

  useEffect(() => {
    setMemberPickerPage((current) => Math.min(current, memberPickerTotalPages))
  }, [memberPickerTotalPages])

  const visibleAvailableMembers = useMemo(() => {
    const from = (memberPickerPage - 1) * MEMBER_PICKER_PAGE_SIZE
    return filteredAvailableMembers.slice(from, from + MEMBER_PICKER_PAGE_SIZE)
  }, [filteredAvailableMembers, memberPickerPage])

  useEffect(() => {
    setSelectedUserId((current) =>
      current && availableMembers.some((member) => member.user_id === current) ? current : ""
    )
  }, [availableMembers])

  const selectedCandidate =
    availableMembers.find((member) => member.user_id === selectedUserId) ?? null

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find((organization) => organization.id.toString() === value)
    if (!nextOrganization) return
    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const handleBack = () => {
    if (!selectedOrganization || !point) {
      navigate("/dashboard")
      return
    }

    navigate(`/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(point)}/team`)
  }

  const handleAddMember = async () => {
    if (!point || !selectedUserId || !canManageTeam) return

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

      if (error) throw error

      const candidate = selectedCandidate
      setSaveMessage(
        `המשתמש ${candidate ? formatMemberName(candidate) : selectedUserId} נוסף בהצלחה לצוות הנקודה.`
      )
      setAvailableMembers((current) =>
        current.filter((member) => member.user_id !== selectedUserId)
      )
      setSelectedUserId("")
      setTitle("")
      setRole("member")
      setMemberSearchQuery("")
      setMemberPickerPage(1)
    } catch (error) {
      console.error("Error adding point member:", error)
      setSaveError("לא הצלחנו להוסיף את המשתמש לצוות הנקודה כרגע.")
    } finally {
      setSaving(false)
    }
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
          title="הוספת חבר לנקודה"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />

        <PageBody>
          <div className="page-stack flex-1">
            {loadingOrganizations || loadingPoint || loadingMembers ? (
              <PageMainLayout>
                <PageMainRail>
                  <Skeleton className="h-[28rem] rounded-3xl" />
                </PageMainRail>
                <PageMainContent>
                  <Skeleton className="h-[28rem] rounded-3xl" />
                </PageMainContent>
              </PageMainLayout>
            ) : organizationsError || pointError ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>העמוד אינו זמין</AlertTitle>
                <AlertDescription>{pointError || organizationsError || "לא הצלחנו לטעון את העמוד."}</AlertDescription>
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
                  <InfoPanel>
                    <InfoPanelHeader
                      icon={MapPinned}
                      title={point.name?.trim() || `נקודה #${point.id}`}
                      description={point.notes?.trim() || "הוספת חבר קיים מהארגון לצוות הנקודה."}
                      badge={<Badge variant={canManageTeam ? "default" : "outline"}>{canManageTeam ? "ניהול" : "קריאה בלבד"}</Badge>}
                    />
                    <InfoPanelBody>
                      <InfoPanelSection title="הקשר">
                        <InfoPanelDetailList>
                          <InfoPanelDetail
                            label="ארגון"
                            value={selectedOrganization.name?.trim() || `ארגון #${selectedOrganization.id}`}
                          />
                          <InfoPanelDetail label="נקודה" value={point.name?.trim() || `נקודה #${point.id}`} />
                          <InfoPanelDetail label="חברים זמינים" value={availableMembers.length} />
                        </InfoPanelDetailList>
                      </InfoPanelSection>
                    </InfoPanelBody>
                  </InfoPanel>
                </PageMainRail>

                <PageMainContent>
                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="gap-3">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <UserPlus className="size-5" />
                        הוספת חבר לנקודה
                      </CardTitle>
                      <CardDescription>
                        חפשו חבר קיים מהארגון, בחרו אותו מהרשימה, והגדירו עבורו תפקיד וטייטל בנקודה.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {!canManageTeam ? (
                        <Alert variant="destructive">
                          <AlertTitle>אין הרשאה</AlertTitle>
                          <AlertDescription>
                            רק בעלי ומנהלי הארגון, או מנהלי נקודה, יכולים להוסיף חברים לצוות הנקודה.
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
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">חיפוש חבר מהארגון</label>
                            <Input
                              value={memberSearchQuery}
                              onChange={(event) => setMemberSearchQuery(event.target.value)}
                              disabled={!canManageTeam || saving}
                              placeholder="חיפוש לפי שם או טייטל"
                              className="rounded-xl"
                            />
                          </div>

                          {filteredAvailableMembers.length === 0 ? (
                            <Alert>
                              <AlertTitle>לא נמצאו תוצאות</AlertTitle>
                              <AlertDescription>
                                נסו לחפש בשם אחר או להסיר חלק מהמילים כדי לראות חברים נוספים מהארגון.
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <div className="space-y-4">
                              <div className="grid gap-3 md:grid-cols-2">
                                {visibleAvailableMembers.map((member) => (
                                  <button
                                    key={member.user_id}
                                    type="button"
                                    className="w-full text-right"
                                    onClick={() => setSelectedUserId(member.user_id)}
                                    disabled={!canManageTeam || saving}
                                  >
                                    <MemberCard
                                      name={formatMemberName(member)}
                                      meta={member.title?.trim() || "חבר ארגון"}
                                      avatarUrl={member.profile?.avatar_url ?? undefined}
                                      initialsSource={member.profile?.display_name || member.title}
                                      badgeLabel={member.role || "member"}
                                      className={
                                        selectedUserId === member.user_id
                                          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                                          : "border-border/70 bg-card transition-colors hover:border-primary/30"
                                      }
                                    />
                                  </button>
                                ))}
                              </div>

                              <div className="flex flex-col gap-3 border-t border-border/60 pt-4 md:flex-row md:items-center md:justify-between">
                                <p className="text-sm text-muted-foreground">
                                  עמוד {memberPickerPage} מתוך {memberPickerTotalPages}
                                </p>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl"
                                    disabled={memberPickerPage <= 1}
                                    onClick={() => setMemberPickerPage((page) => Math.max(1, page - 1))}
                                  >
                                    הקודם
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl"
                                    disabled={memberPickerPage >= memberPickerTotalPages}
                                    onClick={() => setMemberPickerPage((page) => Math.min(memberPickerTotalPages, page + 1))}
                                  >
                                    הבא
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">תפקיד בנקודה</label>
                              <Select value={role} onValueChange={setRole} disabled={!canManageTeam || saving}>
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
                        </div>
                      )}

                      {selectedCandidate ? (
                        <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
                          <MemberCard
                            name={formatMemberName(selectedCandidate)}
                            meta={selectedCandidate.title?.trim() || "חבר ארגון"}
                            avatarUrl={selectedCandidate.profile?.avatar_url ?? undefined}
                            initialsSource={selectedCandidate.profile?.display_name || selectedCandidate.title}
                            badgeLabel={selectedCandidate.role || "member"}
                            className="border-border/70 bg-card"
                          />
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

                      <div className="flex flex-wrap justify-end gap-3 border-t border-border/60 pt-4">
                        <Button variant="outline" onClick={handleBack} className="rounded-xl">
                          חזרה
                        </Button>
                        <Button
                          onClick={handleAddMember}
                          disabled={!canManageTeam || saving || !selectedUserId}
                          className="rounded-xl"
                        >
                          <UserPlus className="size-4" />
                          {saving ? "מוסיף חבר..." : "הוספה לצוות הנקודה"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </PageMainContent>
              </PageMainLayout>
            )}
          </div>
        </PageBody>
      </SidebarInset>
    </SidebarProvider>
  )
}
