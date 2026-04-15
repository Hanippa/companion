import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Building2,
  CircleAlert,
  MapPinned,
  Route,
  Rows3,
  TimerReset,
} from "lucide-react"

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
import { PageBody, PageMainContent, PageMainLayout, PageMainRail } from "@/components/page-main-layout"
import { SiteHeader } from "@/components/site-header"
import { TrackRecordData } from "@/components/track-record-data"
import {
  TrackStepper,
  type TrackNodeAction,
  type TrackStepperEvent,
} from "@/components/track-stepper"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getOrganizationSegment, getPointSegment, getRecordIdFromSegment, getTrackSegment } from "@/lib/drilldown"
import { getOrganizationsCached } from "@/lib/organizations"
import { getProfilesByIdsCached } from "@/lib/profile-cache"
import { supabase } from "@/lib/supabase"
import { getTrackCurrentNode, normalizeTrackSchema, type NormalizedTrackSchema, type TrackNode } from "@/lib/track-schema"

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

type TrackType = {
  id: number
  name: string | null
  status: string | null
  form_schema: unknown
  track_schema: NormalizedTrackSchema | Record<string, unknown> | null
  vesrion: number | null
}

type TrackingRecordRow = {
  id: number
  ref_id: number
  point_id: number | null
  track_type_id: number | null
  name: string | null
  status: string | null
  current_step: string | null
  data: Record<string, unknown> | null
  notes: string | null
  point: PointRecord | PointRecord[] | null
  track_type: TrackType | TrackType[] | null
}

type TrackRecord = {
  id: number
  refId: number
  name: string | null
  status: string | null
  currentStepKey: string | null
  data: Record<string, unknown> | null
  notes: string | null
  point: PointRecord | null
  trackType: TrackType | null
  trackSchema: NormalizedTrackSchema | null
  currentNode: TrackNode | null
}

type RawEventRow = {
  id: number
  user_id: string | null
  event_type: string
  step_key: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

const normalizeSingleRow = <T,>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? value[0] ?? null : value

const getTrackRecordTitle = (track: TrackRecord | null) => {
  if (!track) return "מסלול"
  return track.name?.trim() || track.trackType?.name?.trim() || `מסלול #${track.id}`
}

const getStatusLabel = (status: string | null | undefined) =>
  status === "active" ? "פעיל" : status?.trim() || "לא פעיל"

export default function TrackPage() {
  const navigate = useNavigate()
  const { organizationSlug, pointSlug, trackSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)
  const pointIdFromRoute = getRecordIdFromSegment(pointSlug)
  const trackIdFromRoute = getRecordIdFromSegment(trackSlug)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)

  const [track, setTrack] = useState<TrackRecord | null>(null)
  const [events, setEvents] = useState<TrackStepperEvent[]>([])
  const [pointTracks, setPointTracks] = useState<Array<{ id: number; name: string | null; url: string; isActive?: boolean }>>([])
  const [loadingTrack, setLoadingTrack] = useState(true)
  const [trackError, setTrackError] = useState<string | null>(null)
  const [pendingTransitionId, setPendingTransitionId] = useState<string | null>(null)

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
        console.error("Error fetching organizations:", error)
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

  const loadTrackPage = useCallback(async () => {
    if (trackIdFromRoute === null) {
      setTrack(null)
      setEvents([])
      setPointTracks([])
      setTrackError("כתובת המסלול אינה תקינה.")
      setLoadingTrack(false)
      return
    }

    setLoadingTrack(true)
    setTrackError(null)

    const { data: trackData, error: trackQueryError } = await supabase
      .from("tracking_records")
      .select(
        "id, ref_id, point_id, track_type_id, name, status, current_step, data, notes, point:points(id, organization_id, name, notes, status), track_type:track_types(id, name, status, form_schema, track_schema, vesrion)"
      )
      .eq("id", trackIdFromRoute)
      .single<TrackingRecordRow>()

    if (trackQueryError || !trackData) {
      console.error("Error fetching track:", trackQueryError)
      setTrack(null)
      setEvents([])
      setPointTracks([])
      setTrackError("לא הצלחנו לטעון את המסלול הזה כרגע.")
      setLoadingTrack(false)
      return
    }

    const point = normalizeSingleRow(trackData.point)
    const trackType = normalizeSingleRow(trackData.track_type)
    const trackSchema = normalizeTrackSchema(trackType?.track_schema)
    const currentNode = getTrackCurrentNode(trackSchema, trackData.current_step)

    const nextTrack: TrackRecord = {
      id: trackData.id,
      refId: trackData.ref_id,
      name: trackData.name,
      status: trackData.status,
      currentStepKey: trackData.current_step,
      data: trackData.data,
      notes: trackData.notes,
      point,
      trackType,
      trackSchema,
      currentNode,
    }

    if (!point) {
      setTrack(nextTrack)
      setEvents([])
      setPointTracks([])
      setTrackError("המסלול הזה אינו משויך לנקודה תקינה.")
      setLoadingTrack(false)
      return
    }

    const [eventsResult, pointTracksResult] = await Promise.all([
      supabase
        .from("tracking_record_events")
        .select("id, user_id, event_type, step_key, payload, created_at")
        .eq("tracking_record_id", trackData.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("tracking_records")
        .select("id, name, point_id")
        .eq("point_id", point.id)
        .order("updated_at", { ascending: false }),
    ])

    if (eventsResult.error) {
      console.error("Error fetching track events:", eventsResult.error)
    }

    if (pointTracksResult.error) {
      console.error("Error fetching point tracks:", pointTracksResult.error)
    }

    const rawEvents = (eventsResult.data ?? []) as RawEventRow[]
    const userIds = rawEvents.map((event) => event.user_id).filter((value): value is string => Boolean(value))
    const profilesById = await getProfilesByIdsCached(userIds)

    const nextEvents: TrackStepperEvent[] = rawEvents.map((event) => ({
      ...event,
      actor_name: event.user_id ? profilesById[event.user_id]?.display_name ?? null : null,
      actor_avatar_url: event.user_id ? profilesById[event.user_id]?.avatar_url ?? null : null,
    }))

    const nextPointTracks = (pointTracksResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      url: `/${getOrganizationSegment({
        id: point.organization_id,
        name: selectedOrganization?.name ?? null,
      })}/${getPointSegment(point)}/track/${getTrackSegment({
        id: row.id,
        name: row.name,
      })}`,
      isActive: row.id === trackData.id,
    }))

    setTrack(nextTrack)
    setEvents(nextEvents)
    setPointTracks(nextPointTracks)
    setLoadingTrack(false)
  }, [trackIdFromRoute, selectedOrganization?.name])

  useEffect(() => {
    if (loadingOrganizations) return
    if (organizationsError) return

    if (!selectedOrganization || organizationIdFromRoute === null || pointIdFromRoute === null) {
      navigate("/dashboard", { replace: true })
      return
    }

    void loadTrackPage()
  }, [
    loadTrackPage,
    loadingOrganizations,
    navigate,
    organizationIdFromRoute,
    organizationsError,
    pointIdFromRoute,
    selectedOrganization,
  ])

  useEffect(() => {
    if (!track || !selectedOrganization || !track.point) return

    const expectedOrganizationSegment = getOrganizationSegment(selectedOrganization)
    const expectedPointSegment = getPointSegment(track.point)
    const expectedTrackSegment = getTrackSegment({
      id: track.id,
      name: track.name,
    })

    if (
      organizationSlug !== expectedOrganizationSegment ||
      pointSlug !== expectedPointSegment ||
      trackSlug !== expectedTrackSegment
    ) {
      navigate(
        `/${expectedOrganizationSegment}/${expectedPointSegment}/track/${expectedTrackSegment}`,
        { replace: true }
      )
    }
  }, [navigate, organizationSlug, pointSlug, selectedOrganization, track, trackSlug])

  const organizationOptions = useMemo(
    () =>
      organizations.map((organization) => ({
        id: organization.id,
        label: organization.name?.trim() || `ארגון #${organization.id}`,
      })),
    [organizations]
  )

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find(
      (organization) => organization.id.toString() === value
    )

    if (!nextOrganization) return

    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const handleTransitionSelect = async (action: TrackNodeAction, sourceNode: TrackNode) => {
    if (!track) return

    setPendingTransitionId(action.id)

    try {
      const { error: updateError } = await supabase
        .from("tracking_records")
        .update({
          current_step: action.node_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", track.id)

      if (updateError) {
        throw updateError
      }

      const { error: eventError } = await supabase
        .from("tracking_record_events")
        .insert({
          tracking_record_id: track.id,
          event_type: "step_advance",
          step_key: sourceNode.id,
          payload: {
            transition_id: action.id,
            transition_label: action.label,
            from_node_id: sourceNode.id,
            to_node_id: action.node_id,
          },
        })

      if (eventError) {
        throw eventError
      }

      await loadTrackPage()
    } catch (error) {
      console.error("Error advancing track:", error)
      setTrackError("לא הצלחנו לקדם את המסלול כרגע.")
    } finally {
      setPendingTransitionId(null)
    }
  }

  const currentNodeLabel = track?.currentNode?.title || track?.currentStepKey || "לא הוגדר"
  const trackNodes = track?.trackSchema?.nodes ?? []
  const startNodeId = track?.trackSchema?.start_node_id ?? null
  const pointDescription = track?.point?.notes?.trim() || "עדיין לא נוספו הערות לנקודה הזו."
  const trackDescription =
    track?.notes?.trim() ||
    track?.trackSchema?.description?.trim() ||
    "המסלול מוצג לפי הצמתים שהרשומה עברה בפועל, יחד עם האירועים ואפשרויות ההמשך מהצומת הנוכחי."

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar
        side="right"
        variant="inset"
        tracks={pointTracks}
        tracksLoading={loadingTrack}
      />
      <SidebarInset dir="rtl">
        <SiteHeader
          title="עמוד מסלול"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />

        <PageBody>
          <div className="page-stack flex-1">
            {organizationsError ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>שגיאה בטעינת ארגונים</AlertTitle>
                <AlertDescription>{organizationsError}</AlertDescription>
              </Alert>
            ) : null}

            {trackError && !loadingTrack ? (
              <Alert variant="destructive" className="mb-6">
                <CircleAlert className="size-4" />
                <AlertTitle>אי אפשר להציג את המסלול</AlertTitle>
                <AlertDescription>{trackError}</AlertDescription>
              </Alert>
            ) : null}

            {loadingTrack ? (
              <PageMainLayout>
                <PageMainContent>
                  <Skeleton className="h-32 rounded-3xl" />
                  <Skeleton className="h-96 rounded-3xl" />
                </PageMainContent>
                <PageMainRail>
                  <Skeleton className="h-[32rem] rounded-3xl" />
                </PageMainRail>
              </PageMainLayout>
            ) : track ? (
              <PageMainLayout>
                <PageMainContent>
                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="gap-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <CardTitle className="text-3xl tracking-tight">
                            {getTrackRecordTitle(track)}
                          </CardTitle>
                          <CardDescription className="max-w-3xl leading-7">
                            {trackDescription}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          {getStatusLabel(track.status)}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>

                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="gap-2">
                      <CardTitle className="text-xl">מהלך המסלול</CardTitle>
                      <CardDescription>
                        כל צומת מציג את האירועים שקרו בו בפועל, ואת אפשרויות ההמשך הזמינות מהצומת הנוכחי.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TrackStepper
                        nodes={trackNodes}
                        startNodeId={startNodeId}
                        currentNodeId={track.currentNode?.id || track.currentStepKey}
                        events={events}
                        pendingTransitionId={pendingTransitionId}
                        onTransitionSelect={handleTransitionSelect}
                      />
                    </CardContent>
                  </Card>
                </PageMainContent>

                <PageMainRail>
                <InfoPanel>
                  <InfoPanelHeader
                    icon={Route}
                    title={getTrackRecordTitle(track)}
                    description={track.trackType?.name?.trim() || "מסלול פעיל"}
                    badge={
                      <Badge variant={track.status === "active" ? "default" : "secondary"}>
                        {getStatusLabel(track.status)}
                      </Badge>
                    }
                  />
                  <InfoPanelBody>
                    <InfoPanelStats>
                      <InfoPanelStat
                        icon={TimerReset}
                        label="צומת נוכחי"
                        value={currentNodeLabel}
                        description="זהו הצומת הפעיל שממנו אפשר להמשיך."
                      />
                      <InfoPanelStat
                        icon={Rows3}
                        label="אירועים"
                        value={events.length}
                        description="כולל קידומי מסלול והערות כלליות."
                      />
                    </InfoPanelStats>

                    <InfoPanelSection icon={MapPinned} title="הקשר נקודה">
                      <InfoPanelDetailList>
                        <InfoPanelDetail
                          label="שם נקודה"
                          value={track.point?.name?.trim() || `נקודה #${track.point?.id ?? "?"}`}
                        />
                        <InfoPanelDetail label="סטטוס" value={getStatusLabel(track.point?.status)} />
                        <InfoPanelDetail label="תיאור" value={pointDescription} />
                      </InfoPanelDetailList>
                    </InfoPanelSection>

                    <InfoPanelSection icon={Building2} title="הקשר ארגוני">
                      <InfoPanelDetailList>
                        <InfoPanelDetail
                          label="ארגון"
                          value={selectedOrganization?.name?.trim() || `ארגון #${selectedOrganization?.id ?? "?"}`}
                        />
                        <InfoPanelDetail
                          label="מזהה חיצוני"
                          value={track.refId}
                        />
                        <InfoPanelDetail
                          label="גרסת תבנית"
                          value={track.trackType?.vesrion ?? "—"}
                        />
                      </InfoPanelDetailList>
                    </InfoPanelSection>

                    <InfoPanelSection title="סיכום הרשומה">
                      <TrackRecordData data={track.data} compact />
                    </InfoPanelSection>
                  </InfoPanelBody>
                </InfoPanel>
                </PageMainRail>
              </PageMainLayout>
            ) : (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>מסלול לא זמין</AlertTitle>
                <AlertDescription>לא נמצאה רשומת מסלול להצגה.</AlertDescription>
              </Alert>
            )}
          </div>
        </PageBody>
      </SidebarInset>
    </SidebarProvider>
  )
}
