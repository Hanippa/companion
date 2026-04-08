import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CircleAlert, Database, Route } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { TrackRecordData } from "@/components/track-record-data"
import {
  TrackStepper,
  type TrackStep,
  type TrackStepperEvent,
  type TrackTransition,
} from "@/components/track-stepper"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  getOrganizationSegment,
  getPointSegment,
  getRecordIdFromSegment,
  getTrackSegment,
} from "@/lib/drilldown"
import { resolveAvatarUrl } from "@/lib/avatar"
import { supabase } from "@/lib/supabase"

type Organization = { id: number; name: string | null; status: string | null }
type PointRecord = { id: number; organization_id: number; name: string | null; notes: string | null; status: string | null }
type FormNode = { id: string; label: string; children?: FormNode[] }
type FormField = { id: string; type: string; label: string; required?: boolean; placeholder?: string; nodes?: FormNode[] }
type FormSection = { id: string; title: string; fields: FormField[] }
type FormSchema = { title?: string | null; sections?: FormSection[] }
type TrackSchema = { title?: string | null; description?: string | null; initial_step?: string | null; steps?: TrackStep[] }
type TrackType = { id: number; name: string | null; form_schema: FormSchema | null; track_schema: TrackSchema | null }
type TrackingRecordRow = {
  id: number
  ref_id: number
  point_id: number | null
  name: string | null
  status: string | null
  current_step: string | null
  data: Record<string, unknown> | null
  notes: string | null
  track_type: TrackType | TrackType[] | null
}
type EventRow = {
  id: number
  event_type: string
  user_id: string | null
  step_key: string | null
  payload: Record<string, unknown> | null
  created_at: string
  actor_name?: string | null
  actor_avatar_url?: string | null
}
type TrackRecord = {
  id: number
  refId: number
  name: string | null
  status: string | null
  currentStepKey: string | null
  data: Record<string, unknown> | null
  notes: string | null
  trackType: TrackType | null
  currentStep: TrackStep | null
  nextTransitions: TrackTransition[]
  url: string
}

type LoadedTrackPage = {
  organizations: Organization[]
  point: PointRecord
  track: TrackRecord
  pointTracks: TrackRecord[]
  events: EventRow[]
}

const normalizeTrackType = (trackType: TrackType | TrackType[] | null) =>
  Array.isArray(trackType) ? trackType[0] ?? null : trackType

const getCurrentStep = (trackType: TrackType | null, currentStepKey: string | null) => {
  const steps = trackType?.track_schema?.steps ?? []
  if (currentStepKey) {
    const match = steps.find((step) => step.id === currentStepKey)
    if (match) return match
  }
  const initialStepKey = trackType?.track_schema?.initial_step
  if (initialStepKey) return steps.find((step) => step.id === initialStepKey) ?? null
  return steps[0] ?? null
}

const getTrackTitle = (track: { id: number; name: string | null; trackType?: TrackType | null }) =>
  track.name?.trim() || track.trackType?.name?.trim() || `רשומת מסלול #${track.id}`

export default function TrackPage() {
  const navigate = useNavigate()
  const { organizationSlug, pointSlug, trackSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)
  const pointIdFromRoute = getRecordIdFromSegment(pointSlug)
  const trackIdFromRoute = getRecordIdFromSegment(trackSlug)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [point, setPoint] = useState<PointRecord | null>(null)
  const [track, setTrack] = useState<TrackRecord | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [pointTracks, setPointTracks] = useState<TrackRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [advancingError, setAdvancingError] = useState<string | null>(null)
  const [pendingTransitionId, setPendingTransitionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPage = useCallback(async (): Promise<LoadedTrackPage> => {
    if (organizationIdFromRoute === null || pointIdFromRoute === null || trackIdFromRoute === null) {
      throw new Error("כתובת המסלול אינה תקינה.")
    }

    const [organizationsResult, pointResult, trackResult, pointTracksResult, eventsResult] = await Promise.all([
      supabase.from("organizations").select("id, name, status").order("name", { ascending: true, nullsFirst: false }),
      supabase.from("points").select("id, organization_id, name, notes, status").eq("id", pointIdFromRoute).single<PointRecord>(),
      supabase
        .from("tracking_records")
        .select("id, ref_id, point_id, name, status, current_step, data, notes, track_type:track_types(id, name, form_schema, track_schema)")
        .eq("id", trackIdFromRoute)
        .single<TrackingRecordRow>(),
      supabase
        .from("tracking_records")
        .select("id, ref_id, point_id, name, status, current_step, data, notes, track_type:track_types(id, name, form_schema, track_schema)")
        .eq("point_id", pointIdFromRoute)
        .order("updated_at", { ascending: false }),
      supabase
        .from("tracking_record_events")
        .select("id, event_type, user_id, step_key, payload, created_at")
        .eq("tracking_record_id", trackIdFromRoute)
        .order("created_at", { ascending: false }),
    ])

    if (organizationsResult.error || pointResult.error || trackResult.error || pointTracksResult.error || eventsResult.error) {
      console.error("Error loading track page:", {
        organizationsError: organizationsResult.error,
        pointError: pointResult.error,
        trackError: trackResult.error,
        pointTracksError: pointTracksResult.error,
        eventsError: eventsResult.error,
      })
      throw new Error("לא הצלחנו לטעון את המסלול הזה כרגע.")
    }

    const nextOrganizations = organizationsResult.data ?? []
    const nextPoint = pointResult.data
    const nextTrackRow = trackResult.data
    const rawEvents = (eventsResult.data ?? []) as EventRow[]

    if (!nextPoint || !nextTrackRow || nextPoint.organization_id !== organizationIdFromRoute || nextTrackRow.point_id !== nextPoint.id) {
      throw new Error("המסלול הזה לא שייך לנקודה שנבחרה.")
    }

    const actorIds = Array.from(
      new Set(
        rawEvents
          .map((event) => event.user_id)
          .filter((value): value is string => Boolean(value))
      )
    )

    const actorMap = new Map<string, { display_name: string | null; avatar_url: string | null }>()

    if (actorIds.length > 0) {
      const { data: actorProfiles, error: actorProfilesError } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", actorIds)

      if (actorProfilesError) {
        console.error("Error loading event actors:", actorProfilesError)
      } else {
        await Promise.all(
          (actorProfiles ?? []).map(async (profile) => {
            actorMap.set(profile.id, {
              display_name: profile.display_name ?? null,
              avatar_url: (await resolveAvatarUrl(profile.avatar_url)) ?? null,
            })
          })
        )
      }
    }

    const buildTrackRecord = (row: TrackingRecordRow) => {
      const trackType = normalizeTrackType(row.track_type)
      const currentStep = getCurrentStep(trackType, row.current_step)
      const organization = nextOrganizations.find((item) => item.id === nextPoint.organization_id)
      const url = `/${getOrganizationSegment({ id: nextPoint.organization_id, name: organization?.name ?? null })}/${getPointSegment(nextPoint)}/track/${getTrackSegment({ id: row.id, name: row.name || trackType?.name || null })}`

      return {
        id: row.id,
        refId: row.ref_id,
        name: row.name,
        status: row.status,
        currentStepKey: row.current_step,
        data: row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : null,
        notes: row.notes,
        trackType,
        currentStep,
        nextTransitions: currentStep?.transitions ?? [],
        url,
      }
    }

    return {
      organizations: nextOrganizations,
      point: nextPoint,
      track: buildTrackRecord(nextTrackRow),
      pointTracks: ((pointTracksResult.data ?? []) as TrackingRecordRow[]).map(buildTrackRecord),
      events: rawEvents.map((event) => {
        const actor = event.user_id ? actorMap.get(event.user_id) : null

        return {
          ...event,
          actor_name: actor?.display_name ?? null,
          actor_avatar_url: actor?.avatar_url ?? null,
        }
      }),
    }
  }, [organizationIdFromRoute, pointIdFromRoute, trackIdFromRoute])

  useEffect(() => {
    let isMounted = true

    const hydrate = async () => {
      setLoading(true)
      setError(null)

      try {
        const nextState = await loadPage()
        if (!isMounted) return
        setOrganizations(nextState.organizations)
        setPoint(nextState.point)
        setTrack(nextState.track)
        setPointTracks(nextState.pointTracks)
        setEvents(nextState.events)
      } catch (err) {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : "לא הצלחנו לטעון את המסלול הזה כרגע.")
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void hydrate()
    return () => {
      isMounted = false
    }
  }, [loadPage])

  const selectedOrganization =
    organizations.find((organization) => organization.id === organizationIdFromRoute) ?? null

  const organizationOptions = organizations.map((organization) => ({
    id: organization.id,
    label: organization.name?.trim() || `Organization #${organization.id}`,
  }))

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find((organization) => organization.id.toString() === value)
    if (!nextOrganization) return
    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const handleTransitionSelect = async (transition: TrackTransition, sourceStep: TrackStep) => {
    if (!track) return

    setAdvancingError(null)
    setPendingTransitionId(transition.id)

    const { error: updateError } = await supabase
      .from("tracking_records")
      .update({
        current_step: transition.to_step,
        updated_at: new Date().toISOString(),
      })
      .eq("id", track.id)

    if (updateError) {
      console.error("Error updating track step:", updateError)
      setAdvancingError("לא הצלחנו לקדם את המסלול כרגע.")
      setPendingTransitionId(null)
      return
    }

    const { error: eventError } = await supabase.from("tracking_record_events").insert({
      tracking_record_id: track.id,
      event_type: "step_changed",
      step_key: transition.to_step,
      payload: {
        transition_id: transition.id,
        from_step: sourceStep.id,
        to_step: transition.to_step,
      },
    })

    if (eventError) {
      console.error("Error inserting track event:", eventError)
      setAdvancingError("המעבר בוצע, אבל רישום האירוע נכשל. כדאי לבדוק את היסטוריית המסלול.")
      setPendingTransitionId(null)
      return
    }

    try {
      const nextState = await loadPage()
      setOrganizations(nextState.organizations)
      setPoint(nextState.point)
      setTrack(nextState.track)
      setPointTracks(nextState.pointTracks)
      setEvents(nextState.events)
    } catch (err) {
      console.error("Error reloading track after transition:", err)
      setAdvancingError("המסלול קודם, אבל התצוגה לא התרעננה עדיין.")
    } finally {
      setPendingTransitionId(null)
    }
  }

  const trackSteps = useMemo(() => track?.trackType?.track_schema?.steps ?? [], [track])

  return (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 74)", "--header-height": "calc(var(--spacing) * 13)" } as CSSProperties}>
      <AppSidebar
        side="right"
        variant="inset"
        tracks={pointTracks.map((item) => ({
          id: item.id,
          name: getTrackTitle(item),
          url: item.url,
          isActive: item.id === track?.id,
        }))}
        tracksLoading={loading}
      />
      <SidebarInset>
        <SiteHeader
          title="עמוד מסלול"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col">
            <div className="page-shell">
              <div className="page-stack" dir="rtl">
              {loading ? (
                <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
                    <Card className="border-border/70 shadow-none"><CardHeader><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-full" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-32 w-full" /></CardContent></Card>
                    <div className="space-y-5">
                      <Card className="border-border/70 shadow-none"><CardHeader><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-64" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
                      <Card className="border-border/70 shadow-none"><CardHeader><Skeleton className="h-6 w-32" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
                    </div>
                  </div>
              ) : error || !track || !point || !selectedOrganization ? (
                <div>
                  <Alert variant="destructive">
                    <CircleAlert className="size-4" />
                    <AlertTitle>המסלול לא זמין</AlertTitle>
                    <AlertDescription>{error || "לא הצלחנו לטעון את המסלול הזה כרגע."}</AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
                    <Card className="overflow-hidden border-border/70 shadow-none xl:sticky xl:top-24 xl:h-fit">
                      <CardHeader className="gap-3">
                        <CardTitle className="flex items-center gap-2"><Route className="size-5" />מבט מסלול</CardTitle>
                        <CardDescription>תצוגה מלאה של מבנה המסלול, המצב הנוכחי והמידע שנשמר ברשומה.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-xl border border-border bg-primary/5 p-4">
                          <div className="text-sm font-medium">פרטי מסלול</div>
                          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                            <div>נקודה: {point.name?.trim() || `Point #${point.id}`}</div>
                            <div>סוג מסלול: {track.trackType?.name?.trim() || `סוג #${track.trackType?.id ?? "—"}`}</div>
                            <div>מספר ייחוס: {track.refId}</div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border bg-muted/30 p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">שלב נוכחי</div>
                          <div className="mt-2 text-xl font-semibold">{track.currentStep?.title || track.currentStepKey || "לא הוגדר"}</div>
                          {track.currentStep?.description ? <p className="mt-2 text-sm text-muted-foreground">{track.currentStep.description}</p> : null}
                        </div>

                        <div className="rounded-xl border border-border bg-muted/30 p-4">
                          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                            <Database className="size-4" />
                            סיכום הרשומה
                          </div>
                          <TrackRecordData
                            data={track.data}
                            compact
                          />
                        </div>

                        {advancingError ? (
                          <Alert variant="destructive">
                            <AlertTitle>עדכון המסלול נכשל</AlertTitle>
                            <AlertDescription>{advancingError}</AlertDescription>
                          </Alert>
                        ) : null}
                      </CardContent>
                    </Card>

                    <div className="space-y-5">
                      <Card className="overflow-hidden border-border/70 shadow-none">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2"><Route className="size-5" />שלבי המסלול</CardTitle>
                          <CardDescription>המסלול מוצג בציר אנכי מלמעלה למטה לפי הסדר המוגדר ב-`track_schema`.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {trackSteps.length === 0 ? (
                            <Alert><AlertTitle>אין שלבים מוגדרים</AlertTitle><AlertDescription>לסוג המסלול הזה עדיין אין מבנה שלבים זמין.</AlertDescription></Alert>
                          ) : (
                            <TrackStepper
                              steps={trackSteps}
                              currentStepKey={track.currentStep?.id || track.currentStepKey}
                              events={events as TrackStepperEvent[]}
                              pendingTransitionId={pendingTransitionId}
                              onTransitionSelect={handleTransitionSelect}
                            />
                          )}
                        </CardContent>
                      </Card>

                    </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
