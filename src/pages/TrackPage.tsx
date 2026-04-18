import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Building2,
  CircleAlert,
  Link2,
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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { getOrganizationSegment, getPointSegment, getRecordIdFromSegment, getTrackSegment } from "@/lib/drilldown"
import { getOrganizationsCached } from "@/lib/organizations"
import { getProfilesByIdsCached } from "@/lib/profile-cache"
import { supabase } from "@/lib/supabase"
import { getTrackCurrentNode, normalizeTrackSchema, type NormalizedTrackSchema, type TrackNode } from "@/lib/track-schema"
import {
  buildTrackingRecordSearchText,
  upsertTrackingRecordSearch,
} from "@/lib/tracking-record-search"
import { calculateTrackSlaSummary, formatMinutesLabel, formatRemainingLabel } from "@/lib/track-sla"

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
  sla: number | null
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
  sla: number | null
  sla_mode: string | null
  data: Record<string, unknown> | null
  created_at: string | null
  notes: string | null
  public_tracking_token: string | null
  point: PointRecord | PointRecord[] | null
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
  createdAt: string | null
  notes: string | null
  publicTrackingToken: string | null
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

type CurrentActor = {
  user_id: string | null
  actor_name: string | null
  actor_avatar_url: string | null
}

type RealtimeStatus = "CONNECTING" | "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR"

const normalizeSingleRow = <T,>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? value[0] ?? null : value

const getTrackRecordTitle = (track: TrackRecord | null) => {
  if (!track) return "מסלול"
  return track.name?.trim() || track.trackType?.name?.trim() || `מסלול #${track.id}`
}

const getStatusLabel = (status: string | null | undefined) =>
  status === "active" ? "פעיל" : status?.trim() || "לא פעיל"

const getRealtimeStatusLabel = (status: RealtimeStatus) => {
  switch (status) {
    case "SUBSCRIBED":
      return "עדכון חי פעיל"
    case "CONNECTING":
      return "מתחבר לעדכון חי"
    case "TIMED_OUT":
      return "עדכון חי מושהה"
    case "CHANNEL_ERROR":
      return "שגיאת עדכון חי"
    case "CLOSED":
    default:
      return "עדכון חי לא פעיל"
  }
}

export default function TrackPage() {
  const { user } = useAuth()
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
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("CONNECTING")
  const [copiedPublicLink, setCopiedPublicLink] = useState(false)
  const [slaModeDraft, setSlaModeDraft] = useState<"derived" | "manual">("derived")
  const [trackSlaDraft, setTrackSlaDraft] = useState("0")
  const [savingSla, setSavingSla] = useState(false)
  const [canManageSla, setCanManageSla] = useState(false)
  const [currentActor, setCurrentActor] = useState<CurrentActor>({
    user_id: null,
    actor_name: null,
    actor_avatar_url: null,
  })

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

  useEffect(() => {
    let isMounted = true

    const loadCurrentActor = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error) {
        console.error("Error fetching current user:", error)
        return
      }

      if (!user || !isMounted) return

      const profilesById = await getProfilesByIdsCached([user.id])
      if (!isMounted) return

      setCurrentActor({
        user_id: user.id,
        actor_name: profilesById[user.id]?.display_name ?? null,
        actor_avatar_url: profilesById[user.id]?.avatar_url ?? null,
      })
    }

    void loadCurrentActor()

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
    setPendingTransitionId(null)

    const { data: trackData, error: trackQueryError } = await supabase
      .from("tracking_records")
      .select(
        "id, ref_id, point_id, track_type_id, name, status, current_step, sla, sla_mode, data, created_at, notes, public_tracking_token, point:points(id, organization_id, name, notes, status), track_type:track_types(id, name, status, sla, form_schema, track_schema, vesrion)"
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
      sla: trackData.sla,
      slaMode: trackData.sla_mode,
      data: trackData.data,
      createdAt: trackData.created_at,
      notes: trackData.notes,
      publicTrackingToken: trackData.public_tracking_token,
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

    if (pointIdFromRoute !== null && point.id !== pointIdFromRoute) {
      setTrack(nextTrack)
      setEvents([])
      setPointTracks([])
      setTrackError("המסלול הזה אינו שייך לנקודה שנבחרה.")
      setLoadingTrack(false)
      return
    }

    if (selectedOrganization && point.organization_id !== selectedOrganization.id) {
      setTrack(nextTrack)
      setEvents([])
      setPointTracks([])
      setTrackError("המסלול הזה אינו שייך לארגון שנבחר.")
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
    setSlaModeDraft(trackData.sla_mode === "manual" ? "manual" : "derived")
    setTrackSlaDraft(String(trackData.sla ?? trackType?.sla ?? 0))
    setEvents(nextEvents)
    setPointTracks(nextPointTracks)
    setLoadingTrack(false)
  }, [pointIdFromRoute, selectedOrganization, trackIdFromRoute])

  useEffect(() => {
    if (loadingOrganizations) return
    if (organizationsError) return

    if (!selectedOrganization || organizationIdFromRoute === null || pointIdFromRoute === null) {
      navigate("/dashboard", { replace: true })
      return
    }

    setTrack(null)
    setEvents([])
    setPointTracks([])
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

  useEffect(() => {
    if (trackIdFromRoute === null) return

    let isActive = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    setRealtimeStatus("CONNECTING")

    const channelName = `track-page-${trackIdFromRoute}`

    const subscribeToRealtime = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token)
      }

      if (!isActive) return

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tracking_records",
            filter: `id=eq.${trackIdFromRoute}`,
          },
          (payload) => {
            const nextCurrentStep =
              typeof payload.new.current_step === "string" ? payload.new.current_step : null
            const nextStatus =
              typeof payload.new.status === "string" ? payload.new.status : null
            const nextNotes =
              typeof payload.new.notes === "string" ? payload.new.notes : null
            const nextData =
              payload.new.data && typeof payload.new.data === "object"
                ? (payload.new.data as Record<string, unknown>)
                : null

            setTrack((currentTrack) =>
              currentTrack && currentTrack.id === trackIdFromRoute
                ? {
                    ...currentTrack,
                    status: nextStatus,
                    notes: nextNotes,
                    data: nextData,
                    currentStepKey: nextCurrentStep,
                    currentNode: getTrackCurrentNode(currentTrack.trackSchema, nextCurrentStep),
                    sla:
                      typeof payload.new.sla === "number" ? payload.new.sla : currentTrack.sla,
                    slaMode:
                      typeof payload.new.sla_mode === "string"
                        ? payload.new.sla_mode
                        : currentTrack.slaMode,
                  }
                : currentTrack
            )
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "tracking_record_events",
            filter: `tracking_record_id=eq.${trackIdFromRoute}`,
          },
          async (payload) => {
            const nextEvent = payload.new as RawEventRow
            let actor_name: string | null = null
            let actor_avatar_url: string | null = null

            if (nextEvent.user_id) {
              const profilesById = await getProfilesByIdsCached([nextEvent.user_id])
              actor_name = profilesById[nextEvent.user_id]?.display_name ?? null
              actor_avatar_url = profilesById[nextEvent.user_id]?.avatar_url ?? null
            }

            setEvents((currentEvents) => {
              if (currentEvents.some((event) => event.id === nextEvent.id)) {
                return currentEvents
              }

              return [
                ...currentEvents,
                {
                  ...nextEvent,
                  actor_name,
                  actor_avatar_url,
                },
              ].sort(
                (left, right) =>
                  new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
              )
            })
          }
        )
        .subscribe((status, err) => {
          setRealtimeStatus(status as RealtimeStatus)
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error("Track realtime subscription issue:", {
              trackId: trackIdFromRoute,
              channelName,
              status,
              err,
              sessionError,
            })
          }
        })
    }

    void subscribeToRealtime()

    return () => {
      isActive = false
      setRealtimeStatus("CLOSED")
      if (channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [trackIdFromRoute])

  useEffect(() => {
    let isMounted = true

    const loadSlaPermissions = async () => {
      if (!selectedOrganization || !track?.point || !user?.id) {
        setCanManageSla(false)
        return
      }

      const [orgPermissionResult, pointPermissionResult] = await Promise.all([
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
          .eq("point_id", track.point.id)
          .eq("user_id", user.id)
          .eq("status", "active")
          .eq("role", "admin"),
      ])

      if (!isMounted) return

      if (orgPermissionResult.error || pointPermissionResult.error) {
        console.error("Error loading track SLA permissions:", {
          orgPermissionError: orgPermissionResult.error,
          pointPermissionError: pointPermissionResult.error,
        })
        setCanManageSla(false)
        return
      }

      setCanManageSla(
        (orgPermissionResult.data ?? []).length > 0 ||
          (pointPermissionResult.data ?? []).length > 0
      )
    }

    void loadSlaPermissions()

    return () => {
      isMounted = false
    }
  }, [selectedOrganization, track?.point, user?.id])

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
    if (!track || pendingTransitionId) return

    setPendingTransitionId(action.id)
    setTrackError(null)

    try {
      const { data: updatedRows, error: updateError } = await supabase
        .from("tracking_records")
        .update({
          current_step: action.node_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", track.id)
        .select("id, current_step")

      if (updateError) {
        throw updateError
      }

      const updatedRecord = updatedRows?.[0] ?? null

      if (!updatedRecord) {
        throw new Error("No track record was updated.")
      }

      const { data: insertedEvents, error: eventError } = await supabase
        .from("tracking_record_events")
        .insert({
          tracking_record_id: track.id,
          event_type: "step_advance",
          step_key: action.node_id,
          payload: {
            transition_id: action.id,
            transition_label: action.label,
            from_node_id: sourceNode.id,
            to_node_id: action.node_id,
          },
        })
        .select("id, user_id, event_type, step_key, payload, created_at")

      if (eventError) {
        throw eventError
      }

      const insertedEvent = insertedEvents?.[0] ?? null

      setTrack((currentTrack) =>
        currentTrack && currentTrack.id === track.id
          ? {
              ...currentTrack,
              currentStepKey:
                typeof updatedRecord.current_step === "string"
                  ? updatedRecord.current_step
                  : action.node_id,
              currentNode:
                currentTrack.trackSchema?.nodes.find(
                  (node) =>
                    node.id ===
                    (typeof updatedRecord.current_step === "string"
                      ? updatedRecord.current_step
                      : action.node_id)
                ) ?? null,
            }
          : currentTrack
      )

      if (insertedEvent) {
        setEvents((currentEvents) => [
          ...currentEvents,
          {
            ...insertedEvent,
            actor_name: currentActor.actor_name,
            actor_avatar_url: currentActor.actor_avatar_url,
          },
        ])
      }

      try {
        const resolvedStepKey =
          typeof updatedRecord.current_step === "string"
            ? updatedRecord.current_step
            : action.node_id
        const currentNodeTitle =
          track.trackSchema?.nodes.find((node) => node.id === resolvedStepKey)?.title ??
          resolvedStepKey

        if (selectedOrganization) {
          await upsertTrackingRecordSearch({
            trackingRecordId: track.id,
            organizationId: selectedOrganization.id,
            pointId: track.point?.id ?? null,
            searchText: buildTrackingRecordSearchText({
              trackName: track.name,
              refId: track.refId,
              status: track.status,
              notes: track.notes,
              pointName: track.point?.name,
              trackTypeName: track.trackType?.name,
              currentStepKey: resolvedStepKey,
              currentNodeTitle,
              data: track.data,
            }),
          })
        }
      } catch (searchError) {
        console.error("Error updating tracking record search index:", searchError)
      }

      return
    } catch (error) {
      console.error("Error advancing track:", error)
      setTrackError("לא הצלחנו לקדם את המסלול כרגע.")
      return
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
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(interval)
  }, [])

  const slaSummary = useMemo(
    () =>
      calculateTrackSlaSummary({
        schema: track?.trackSchema ?? null,
        events,
        createdAt: track?.createdAt ?? null,
        currentNodeId: track?.currentNode?.id ?? track?.currentStepKey ?? null,
        baseSlaMinutes: track?.sla ?? track?.trackType?.sla ?? null,
        slaMode: track?.slaMode,
        now,
      }),
    [events, now, track]
  )

  const publicTrackUrl =
    track?.publicTrackingToken && typeof window !== "undefined"
      ? `${window.location.origin}/tracking/${track.publicTrackingToken}`
      : null

  const handleCopyPublicTrackLink = async () => {
    if (!publicTrackUrl || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(publicTrackUrl)
      setCopiedPublicLink(true)
      window.setTimeout(() => setCopiedPublicLink(false), 2000)
    } catch (error) {
      console.error("Error copying public track link:", error)
    }
  }

  const handleSaveSla = async () => {
    if (!track || !canManageSla) return

    setSavingSla(true)
    setTrackError(null)

    try {
      const resolvedSla = Number.isFinite(Number(trackSlaDraft)) ? Number(trackSlaDraft) : 0
      const { error } = await supabase
        .from("tracking_records")
        .update({
          sla: resolvedSla,
          sla_mode: slaModeDraft,
          updated_at: new Date().toISOString(),
        })
        .eq("id", track.id)

      if (error) throw error

      setTrack((currentTrack) =>
        currentTrack
          ? {
              ...currentTrack,
              sla: resolvedSla,
              slaMode: slaModeDraft,
            }
          : currentTrack
      )
    } catch (error) {
      console.error("Error updating track SLA:", error)
      setTrackError("לא הצלחנו לעדכן את הגדרות ה־SLA כרגע.")
    } finally {
      setSavingSla(false)
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
                <PageMainRail>
                  <Skeleton className="h-[32rem] rounded-3xl" />
                </PageMainRail>
                <PageMainContent>
                  <Skeleton className="h-32 rounded-3xl" />
                  <Skeleton className="h-96 rounded-3xl" />
                </PageMainContent>
              </PageMainLayout>
            ) : track ? (
              <PageMainLayout>
                <PageMainContent className="xl:order-2">
                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">התקדמות המסלול</div>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium">
                          <span
                            className={[
                              "size-2 rounded-full",
                              realtimeStatus === "SUBSCRIBED"
                                ? "bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]"
                                : realtimeStatus === "CONNECTING"
                                  ? "bg-amber-500"
                                  : "bg-muted-foreground/40",
                            ].join(" ")}
                          />
                          <span>{getRealtimeStatusLabel(realtimeStatus)}</span>
                        </div>
                      </div>
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
                        createdAt={track.createdAt}
                        slaMode={track.slaMode}
                        baseSlaMinutes={track.sla ?? track.trackType?.sla ?? null}
                        onTransitionSelect={handleTransitionSelect}
                      />
                    </CardContent>
                  </Card>
                </PageMainContent>

                <PageMainRail className="xl:order-1">
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
                    <InfoPanelSection icon={Route} title="פרטי מסלול">
                      <InfoPanelDetailList>
                        <InfoPanelDetail
                          label="תיאור"
                          value={trackDescription}
                        />
                        <InfoPanelDetail
                          label="סוג מסלול"
                          value={track.trackType?.name?.trim() || "—"}
                        />
                      </InfoPanelDetailList>
                    </InfoPanelSection>

                    <InfoPanelSection
                      title="קישור ציבורי"
                      description="שיתוף קישור מעקב ללקוח ללא כניסה למערכת."
                      action={
                        publicTrackUrl ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={handleCopyPublicTrackLink}
                          >
                            <Link2 className="size-4" />
                            {copiedPublicLink ? "הקישור הועתק" : "העתקת קישור"}
                          </Button>
                        ) : null
                      }
                    >
                      <InfoPanelDetailList>
                        <InfoPanelDetail
                          label="קישור"
                          value={
                            publicTrackUrl ? (
                              <span className="break-all text-left">{publicTrackUrl}</span>
                            ) : (
                              "לא נוצר עדיין טוקן ציבורי למסלול הזה."
                            )
                          }
                        />
                      </InfoPanelDetailList>
                    </InfoPanelSection>

                    <InfoPanelStats>
                      <InfoPanelStat
                        icon={TimerReset}
                        label="צומת נוכחי"
                        value={currentNodeLabel}
                        description="זהו הצומת הפעיל שממנו אפשר להמשיך."
                      />
                      <InfoPanelStat
                        icon={TimerReset}
                        label="SLA למסלול"
                        value={formatMinutesLabel(slaSummary.effectiveTrackSlaMinutes)}
                        description={
                          slaSummary.trackRemainingMs !== null
                            ? formatRemainingLabel(slaSummary.trackRemainingMs)
                            : "טרם הוגדר SLA למסלול"
                        }
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

                    <InfoPanelSection
                      icon={TimerReset}
                      title="ניהול SLA"
                      description={
                        canManageSla
                          ? "אפשר לעדכן את מצב החישוב ואת ערך ה-SLA הבסיסי של המסלול."
                          : "אפשר לצפות בנתוני ה-SLA, אך העריכה זמינה רק למנהלי נקודה ולמנהלי ארגון."
                      }
                    >
                      <InfoPanelDetailList>
                        <InfoPanelDetail
                          label="מצב חישוב"
                          value={track.slaMode === "manual" ? "Manual" : "Derived"}
                        />
                        <InfoPanelDetail
                          label="SLA בסיסי"
                          value={formatMinutesLabel(track.sla ?? track.trackType?.sla ?? null)}
                        />
                        <InfoPanelDetail
                          label="Modifiers שנצברו"
                          value={formatMinutesLabel(slaSummary.modifierMinutes)}
                        />
                        <InfoPanelDetail
                          label="SLA לצומת נוכחי"
                          value={
                            slaSummary.currentNodeRemainingMs !== null
                              ? formatRemainingLabel(slaSummary.currentNodeRemainingMs)
                              : formatMinutesLabel(slaSummary.currentNodeSlaMinutes)
                          }
                        />
                      </InfoPanelDetailList>
                      <div className="mt-4 grid gap-3">
                        <select
                          className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                          value={slaModeDraft}
                          onChange={(event) =>
                            setSlaModeDraft(event.target.value as "derived" | "manual")
                          }
                          disabled={!canManageSla || savingSla}
                        >
                          <option value="derived">Derived · עם modifiers</option>
                          <option value="manual">Manual · ללא modifiers</option>
                        </select>
                        <input
                          className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                          type="number"
                          min="0"
                          value={trackSlaDraft}
                          onChange={(event) => setTrackSlaDraft(event.target.value)}
                          disabled={!canManageSla || savingSla}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          onClick={handleSaveSla}
                          disabled={!canManageSla || savingSla}
                        >
                          {savingSla ? "שומר..." : "שמירת SLA"}
                        </Button>
                      </div>
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
