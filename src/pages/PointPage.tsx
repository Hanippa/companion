import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowRight,
  ArrowDown,
  CircleAlert,
  MapPinned,
  PencilLine,
  Route,
  UserPlus,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  InfoPanel,
  InfoPanelBody,
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
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { resolveAvatarUrl } from "@/lib/avatar"
import {
  getOrganizationSegment,
  getPointSegment,
  getRecordIdFromSegment,
  getTrackSegment,
} from "@/lib/drilldown"
import {
  getTrackCurrentNode,
  normalizeTrackSchema,
  type NormalizedTrackSchema,
  type TrackNode,
  type TrackNodeConnection,
} from "@/lib/track-schema"
import { formatMinutesLabel } from "@/lib/track-sla"
import { supabase } from "@/lib/supabase"

type Organization = { id: number; name: string | null; notes: string | null; status: string | null }
type PointRecord = { id: number; organization_id: number; name: string | null; notes: string | null; status: string | null }
type ProfileRecord = { id: string; display_name: string | null; avatar_url: string | null }
type PointMember = { point_id: number; user_id: string; role: string | null; status: string | null; title?: string | null; profile: ProfileRecord | null; avatarUrl?: string }
type TrackSchema = NormalizedTrackSchema | Record<string, unknown> | null
type TrackType = { id: number; name: string | null; status: string | null; sla: number | null; form_schema: unknown; track_schema: TrackSchema; vesrion: number | null }
type TrackingRecordRow = {
  id: number
  ref_id: number
  point_id: number | null
  track_type_id: number | null
  name: string | null
  status: string | null
  current_step: string | null
  sla: number | null
  sla_mode: string | null
  data: Record<string, unknown> | null
  notes: string | null
  track_type: TrackType | TrackType[] | null
}
type TrackRecord = {
  id: number
  refId: number
  name: string | null
  status: string | null
  currentStepKey: string | null
  sla: number | null
  slaMode: string | null
  data: Record<string, unknown> | null
  notes: string | null
  trackType: TrackType | null
  currentNode: TrackNode | null
  nextConnections: TrackNodeConnection[]
  url: string
}

const formatMemberName = (member: PointMember) =>
  member.profile?.display_name?.trim() || member.title?.trim() || "משתמש בצוות"

const formatMemberMeta = (member: PointMember) =>
  [member.title?.trim(), member.status?.trim()].filter(Boolean).join(" · ") || "חבר נקודה פעיל"

const normalizeTrackType = (trackType: TrackType | TrackType[] | null) =>
  Array.isArray(trackType) ? trackType[0] ?? null : trackType

const getTrackRecordTitle = (track: TrackRecord) =>
  track.name?.trim() || track.trackType?.name?.trim() || `רשומת מסלול #${track.id}`

const getStatusLabel = (status: string | null | undefined) =>
  status === "active" ? "פעיל" : status?.trim() || "לא פעיל"

const POINT_MEMBER_PREVIEW_LIMIT = 3

export default function PointPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { organizationSlug, pointSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)
  const pointIdFromRoute = getRecordIdFromSegment(pointSlug)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)
  const [loadingPoint, setLoadingPoint] = useState(true)
  const [pointError, setPointError] = useState<string | null>(null)
  const [tracks, setTracks] = useState<TrackRecord[]>([])
  const [loadingTracks, setLoadingTracks] = useState(true)
  const [tracksError, setTracksError] = useState<string | null>(null)
  const [members, setMembers] = useState<PointMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [canCreateTrack, setCanCreateTrack] = useState(false)
  const [canManageTeam, setCanManageTeam] = useState(false)
  const [loadingPermissions, setLoadingPermissions] = useState(true)
  const [pointName, setPointName] = useState("")
  const [pointNotes, setPointNotes] = useState("")
  const [pointStatus, setPointStatus] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const fetchOrganizations = async () => {
      setLoadingOrganizations(true)
      setOrganizationsError(null)
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, notes, status")
        .order("name", { ascending: true, nullsFirst: false })
      if (!isMounted) return
      if (error) {
        console.error("Error fetching organizations:", error)
        setOrganizations([])
        setOrganizationsError("לא הצלחנו לטעון את הארגונים שלך כרגע.")
        setLoadingOrganizations(false)
        return
      }
      setOrganizations(data ?? [])
      setLoadingOrganizations(false)
    }
    if (user) void fetchOrganizations()
    else {
      setOrganizations([])
      setLoadingOrganizations(false)
    }
    return () => {
      isMounted = false
    }
  }, [user])

  const selectedOrganization =
    organizations.find((organization) => organization.id === organizationIdFromRoute) ?? null

  useEffect(() => {
    if (loadingOrganizations || organizationsError || organizations.length === 0) return
    if (!selectedOrganization || organizationIdFromRoute === null || pointIdFromRoute === null) {
      navigate("/dashboard", { replace: true })
      return
    }
    const expectedOrganizationSegment = getOrganizationSegment(selectedOrganization)
    if (organizationSlug !== expectedOrganizationSegment) {
      navigate(`/${expectedOrganizationSegment}/${pointSlug ?? ""}`, { replace: true })
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

  const organizationOptions = organizations.map((organization) => ({
    id: organization.id,
    label: organization.name?.trim() || `Organization #${organization.id}`,
  }))

  useEffect(() => {
    let isMounted = true
    const fetchPointDetails = async () => {
      if (!selectedOrganization || pointIdFromRoute === null) {
        setLoadingPoint(false)
        setLoadingTracks(false)
        setLoadingMembers(false)
        setLoadingPermissions(false)
        return
      }

      setLoadingPoint(true)
      setPointError(null)
      setLoadingTracks(true)
      setTracksError(null)
      setLoadingMembers(true)
      setMembersError(null)
      setLoadingPermissions(true)

      const [tracksResult, membersResult, orgPermissionResult, pointPermissionResult, pointAccessResult, pointResult] = await Promise.all([
        supabase
          .from("tracking_records")
          .select("id, ref_id, point_id, track_type_id, name, status, current_step, sla, sla_mode, data, notes, track_type:track_types(id, name, status, sla, form_schema, track_schema, vesrion)")
          .eq("point_id", pointIdFromRoute)
          .order("updated_at", { ascending: false }),
        supabase
          .from("point_users")
          .select("point_id, user_id, role, status, title")
          .eq("point_id", pointIdFromRoute)
          .order("user_id", { ascending: true }),
        supabase
          .from("organization_users")
          .select("role")
          .eq("organization_id", selectedOrganization.id)
          .eq("user_id", user?.id ?? "")
          .eq("status", "active")
          .in("role", ["admin", "owner"]),
        supabase
          .from("point_users")
          .select("role")
          .eq("point_id", pointIdFromRoute)
          .eq("user_id", user?.id ?? "")
          .eq("status", "active")
          .eq("role", "admin"),
        supabase
          .from("point_users")
          .select("role")
          .eq("point_id", pointIdFromRoute)
          .eq("user_id", user?.id ?? "")
          .eq("status", "active")
          .limit(1),
        supabase
          .from("points")
          .select("id, organization_id, name, notes, status")
          .eq("id", pointIdFromRoute)
          .single<PointRecord>(),
      ])

      if (!isMounted) return
      if (pointResult.error || !pointResult.data) {
        console.error("Error fetching point:", pointResult.error)
        setPointError("לא הצלחנו לטעון את הנקודה הזו כרגע.")
        setLoadingPoint(false)
        navigate(`/${getOrganizationSegment(selectedOrganization)}`, { replace: true })
        return
      }

      const point = pointResult.data
      if (point.organization_id !== selectedOrganization.id) {
        setPointError("הנקודה הזו לא שייכת לארגון שנבחר.")
        setLoadingPoint(false)
        navigate(`/${getOrganizationSegment(selectedOrganization)}`, { replace: true })
        return
      }

      const expectedPointSegment = getPointSegment(point)
      if (pointSlug !== expectedPointSegment) {
        navigate(`/${getOrganizationSegment(selectedOrganization)}/${expectedPointSegment}`, { replace: true })
      }

      setPointName(point.name?.trim() || "")
      setPointNotes(point.notes?.trim() || "")
      setPointStatus(point.status ?? null)
      setLoadingPoint(false)

      if (tracksResult.error) {
        console.error("Error fetching tracking records:", tracksResult.error)
        setTracks([])
        setTracksError("לא הצלחנו לטעון את המסלולים של הנקודה הזו כרגע.")
      } else {
        const nextTracks = ((tracksResult.data ?? []) as TrackingRecordRow[]).map((trackRow) => {
          const trackType = normalizeTrackType(trackRow.track_type)
          const normalizedTrackSchema = normalizeTrackSchema(trackType?.track_schema)
          const currentNode = getTrackCurrentNode(normalizedTrackSchema, trackRow.current_step)
          const trackSegment = getTrackSegment({
            id: trackRow.id,
            name: trackRow.name || trackType?.name || null,
          })
          return {
            id: trackRow.id,
            refId: trackRow.ref_id,
            name: trackRow.name,
            status: trackRow.status,
            currentStepKey: trackRow.current_step,
            sla: trackRow.sla,
            slaMode: trackRow.sla_mode,
            data: trackRow.data && typeof trackRow.data === "object" ? (trackRow.data as Record<string, unknown>) : null,
            notes: trackRow.notes,
            trackType: trackType ? { ...trackType, track_schema: normalizedTrackSchema } : null,
            currentNode,
            nextConnections: currentNode?.next_nodes ?? [],
            url: `/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(point)}/track/${trackSegment}`,
          }
        })
        setTracks(nextTracks)
      }
      setLoadingTracks(false)

      if (orgPermissionResult.error || pointPermissionResult.error || pointAccessResult.error) {
        console.error("Error fetching point permissions:", {
          orgPermissionError: orgPermissionResult.error,
          pointPermissionError: pointPermissionResult.error,
          pointAccessError: pointAccessResult.error,
        })
        setCanEdit(false)
        setCanCreateTrack(false)
        setCanManageTeam(false)
      } else {
        const hasOrganizationManagementAccess = (orgPermissionResult.data ?? []).length > 0
        const hasPointAdminAccess = (pointPermissionResult.data ?? []).length > 0
        const hasPointAccess = (pointAccessResult.data ?? []).length > 0
        setCanEdit(hasOrganizationManagementAccess)
        setCanCreateTrack(hasOrganizationManagementAccess || hasPointAccess)
        setCanManageTeam(hasOrganizationManagementAccess || hasPointAdminAccess)
      }
      setLoadingPermissions(false)

      if (membersResult.error) {
        console.error("Error fetching point members:", membersResult.error)
        setMembers([])
        setMembersError("לא הצלחנו לטעון את חברי הנקודה כרגע.")
        setLoadingMembers(false)
        return
      }

      const memberRows = membersResult.data ?? []
      const userIds = Array.from(new Set(memberRows.map((member) => member.user_id)))
      if (userIds.length === 0) {
        setMembers([])
        setLoadingMembers(false)
        return
      }

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds)

      if (!isMounted) return
      if (profilesError) {
        console.error("Error fetching point member profiles:", profilesError)
        setMembers(memberRows.map((member) => ({ ...member, profile: null })))
        setMembersError("לא הצלחנו לטעון את פרטי החברים בנקודה כרגע.")
        setLoadingMembers(false)
        return
      }

      const profilesById = new Map((profileRows ?? []).map((profile) => [profile.id, profile] as const))
      const nextMembers = await Promise.all(
        memberRows.map(async (member) => {
          const profile = profilesById.get(member.user_id) ?? null
          return { ...member, profile, avatarUrl: await resolveAvatarUrl(profile?.avatar_url) }
        })
      )
      if (!isMounted) return
      setMembers(nextMembers)
      setLoadingMembers(false)
    }

    if (user) void fetchPointDetails()
    return () => {
      isMounted = false
    }
  }, [navigate, pointIdFromRoute, pointSlug, selectedOrganization, user])

  const currentPoint = useMemo(
    () =>
      pointIdFromRoute !== null
        ? {
            id: pointIdFromRoute,
            organization_id: selectedOrganization?.id ?? 0,
            name: pointName || null,
            notes: pointNotes || null,
            status: pointStatus,
          }
        : null,
    [pointIdFromRoute, pointName, pointNotes, pointStatus, selectedOrganization?.id]
  )

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find((organization) => organization.id.toString() === value)
    if (!nextOrganization) return
    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const navigateToPointTarget = (suffix: "team" | "edit" | "track/new") => {
    if (!currentPoint || !selectedOrganization) return
    navigate(`/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(currentPoint)}/${suffix}`)
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 74)", "--header-height": "calc(var(--spacing) * 13)" } as CSSProperties}>
      <AppSidebar side="right" variant="inset" />
      <SidebarInset>
        <SiteHeader
          title="עמוד נקודה"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />
        <PageBody>
          <div className="@container/main flex flex-1 flex-col">
            <div className="page-stack" dir="rtl">
              {loadingOrganizations || loadingPoint ? (
                <PointPageSkeleton />
              ) : organizationsError || pointError ? (
                <Alert variant="destructive">
                  <CircleAlert className="size-4" />
                  <AlertTitle>הנקודה לא זמינה</AlertTitle>
                  <AlertDescription>{pointError || organizationsError || "לא הצלחנו לטעון את הנקודה הזו כרגע."}</AlertDescription>
                </Alert>
              ) : !selectedOrganization ? (
                <Alert variant="destructive">
                  <CircleAlert className="size-4" />
                  <AlertTitle>הנקודה לא זמינה</AlertTitle>
                  <AlertDescription>לא הצלחנו לזהות את הארגון עבור הנקודה הזו.</AlertDescription>
                </Alert>
              ) : (
                <PageMainLayout>
                  <PageMainRail>
                    <InfoPanel className="xl:static">
                      <InfoPanelHeader
                        icon={MapPinned}
                        title={pointName || `נקודה #${pointIdFromRoute ?? "—"}`}
                        description={pointNotes || "עדיין לא נוספו הערות לנקודה הזו."}
                        badge={
                          <Badge variant={pointStatus === "active" ? "default" : "outline"} className="rounded-full">
                            {getStatusLabel(pointStatus)}
                          </Badge>
                        }
                      />
                      <InfoPanelBody>
                        <InfoPanelSection
                          title="פעולות נקודה"
                          description="כל מה שקשור לניהול הנקודה מרוכז כאן, בלי להעמיס על התוכן הראשי."
                        >
                          <div className="grid gap-2">
                            <Button
                              variant="outline"
                              className="w-full justify-start rounded-xl"
                              disabled={!canCreateTrack || !currentPoint || loadingPermissions}
                              onClick={() => navigateToPointTarget("track/new")}
                            >
                              <Route className="size-4" />
                              יצירת מסלול
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full justify-start rounded-xl"
                              disabled={!canManageTeam || !currentPoint || loadingPermissions}
                              onClick={() => navigateToPointTarget("team")}
                            >
                              <UserPlus className="size-4" />
                              ניהול צוות נקודה
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full justify-start rounded-xl"
                              disabled={!canEdit || !currentPoint || loadingPermissions}
                              onClick={() => navigateToPointTarget("edit")}
                            >
                              <PencilLine className="size-4" />
                              עריכת נקודה
                            </Button>
                          </div>
                        </InfoPanelSection>

                        <InfoPanelSection
                          title="חברי נקודה"
                          description="תצוגה מקוצרת של הצוות הפעיל בנקודה הזו."
                        >
                          <PointMembersList
                            members={members}
                            loading={loadingMembers}
                            error={membersError}
                            canManage={canManageTeam}
                            onManage={() => navigateToPointTarget("team")}
                          />
                        </InfoPanelSection>
                      </InfoPanelBody>
                    </InfoPanel>
                  </PageMainRail>

                  <PageMainContent>
                    <Card className="overflow-hidden border-border/70 shadow-none">
                      <CardHeader className="gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="flex items-center gap-2"><Route className="size-5" />מסלולים</CardTitle>
                            <CardDescription>רשומות המעקב הפעילות של הנקודה, במבנה תצוגה נקי וקצר.</CardDescription>
                          </div>
                          <Badge variant="outline" className="rounded-full">{tracks.length} מסלולים</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {loadingTracks ? (
                          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3"><Skeleton className="h-56 w-full" /><Skeleton className="h-56 w-full" /><Skeleton className="h-56 w-full" /></div>
                        ) : tracksError ? (
                          <Alert variant="destructive"><AlertTitle>המסלולים לא זמינים</AlertTitle><AlertDescription>{tracksError}</AlertDescription></Alert>
                        ) : tracks.length === 0 ? (
                          <Alert><AlertTitle>אין עדיין מסלולים</AlertTitle><AlertDescription>לנקודה הזו עדיין אין רשומות מסלול גלויות עבור החשבון שלך.</AlertDescription></Alert>
                        ) : (
                          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                            {tracks.map((track) => (
                              <Card key={track.id} size="sm" className="point-entry-card overflow-hidden border-border/70 bg-card/95 shadow-none">
                                <CardHeader className="gap-2 pb-2.5">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0 space-y-1">
                                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                        <Route className="size-3.5" />
                                        מסלול
                                      </div>
                                      <CardTitle className="truncate text-base">{getTrackRecordTitle(track)}</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="shrink-0 rounded-full uppercase">{track.status || "active"}</Badge>
                                  </div>
                                  <CardDescription className="space-y-1 leading-6">
                                    <div>סוג מסלול: {track.trackType?.name?.trim() || `סוג #${track.trackType?.id ?? "—"}`}</div>
                                    <div>מספר ייחוס: {track.refId}</div>
                                    <div>שלב נוכחי: {track.currentNode?.title || track.currentStepKey || "לא הוגדר"}</div>
                                    <div>SLA: {formatMinutesLabel(track.sla ?? track.trackType?.sla ?? null)} · {track.slaMode === "manual" ? "ידני" : "נגזר"}</div>
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  {track.currentNode?.description ? (
                                    <div className="rounded-[1.1rem] border border-border/60 bg-linear-to-l from-muted/5 via-background to-background px-3 py-2.5 text-sm leading-6 text-muted-foreground">
                                      {track.currentNode.description}
                                    </div>
                                  ) : null}
                                  <div className="rounded-[1.1rem] border border-border/60 bg-linear-to-l from-muted/5 via-background to-background px-3 py-2.5">
                                    <div className="mb-2 text-sm font-medium">צעדי המשך זמינים</div>
                                    {track.nextConnections.length === 0 ? (
                                      <div className="text-sm text-muted-foreground">אין מעבר זמין לשלב הבא כרגע.</div>
                                    ) : (
                                      <div className="flex flex-wrap gap-2">
                                        {track.nextConnections.map((transition) => (
                                          <Badge key={transition.id} variant="secondary" className="gap-1 rounded-full px-3 py-1">
                                            <ArrowRight className="size-3" />
                                            {transition.label}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {track.notes ? <div className="line-clamp-2 text-sm text-muted-foreground">{track.notes}</div> : null}
                                  <Button variant="outline" className="w-full rounded-xl" onClick={() => navigate(track.url)}>
                                    פתיחת מסלול
                                  </Button>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                  </PageMainContent>
                </PageMainLayout>
              )}
            </div>
          </div>
        </PageBody>
      </SidebarInset>
    </SidebarProvider>
  )
}

function PointPageSkeleton() {
  return (
    <PageMainLayout>
      <PageMainRail>
        <div className="space-y-4">
          <InfoPanel className="xl:static">
            <CardHeader>
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </CardHeader>
            <CardContent className="pt-0" />
          </InfoPanel>
          <Card className="border-border/70 shadow-none">
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-none">
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </CardContent>
          </Card>
        </div>
      </PageMainRail>
      <PageMainContent>
        <Card className="border-border/70 shadow-none">
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              <Skeleton className="h-56 w-full rounded-2xl" />
              <Skeleton className="h-56 w-full rounded-2xl" />
              <Skeleton className="h-56 w-full rounded-2xl" />
            </div>
          </CardContent>
        </Card>
      </PageMainContent>
    </PageMainLayout>
  )
}

function PointMembersList({
  members,
  loading,
  error,
  canManage,
  onManage,
}: {
  members: PointMember[]
  loading: boolean
  error: string | null
  canManage: boolean
  onManage: () => void
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>חברי הנקודה לא זמינים</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (members.length === 0) {
    return (
      <Alert>
        <AlertTitle>אין עדיין חברים</AlertTitle>
        <AlertDescription>לנקודה הזו עדיין אין חברים גלויים עבור החשבון שלך.</AlertDescription>
      </Alert>
    )
  }

  const displayedMembers = members.slice(0, POINT_MEMBER_PREVIEW_LIMIT)
  const hiddenMembersCount = Math.max(members.length - displayedMembers.length, 0)

  return (
    <div className="space-y-2">
      {displayedMembers.map((member) => (
        <MemberCard
          key={`${member.point_id}-${member.user_id}`}
          name={formatMemberName(member)}
          meta={formatMemberMeta(member)}
          avatarUrl={member.avatarUrl}
          initialsSource={member.profile?.display_name || member.title}
          badgeLabel={member.role || "member"}
          className="border-border/70 bg-card"
        />
      ))}

      {hiddenMembersCount > 0 ? (
        canManage ? (
          <button
            type="button"
            className="relative block h-9 w-full overflow-hidden rounded-xl text-right"
            onClick={onManage}
          >
            <ArrowDown className="pointer-events-none absolute inset-x-0 top-1 z-10 mx-auto size-3.5 animate-bounce text-muted-foreground/80" />
            <MemberCard
              name="חברים נוספים"
              meta="הרשימה המלאה זמינה בעמוד צוות הנקודה"
              initialsSource="..."
              className="border-border/60 bg-muted/15 opacity-75 transition-opacity hover:opacity-95"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </button>
        ) : (
          <div className="relative h-9 overflow-hidden rounded-xl">
            <ArrowDown className="pointer-events-none absolute inset-x-0 top-1 z-10 mx-auto size-3.5 animate-bounce text-muted-foreground/80" />
            <MemberCard
              name="חברים נוספים"
              meta="יש עוד חברים ברשימה"
              initialsSource="..."
              className="border-border/60 bg-muted/15 opacity-70"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </div>
        )
      ) : null}
    </div>
  )
}
