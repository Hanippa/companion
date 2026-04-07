import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowRight,
  CircleAlert,
  Clock3,
  Database,
  Route,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getOrganizationSegment, getPointSegment, getRecordIdFromSegment, getTrackSegment } from "@/lib/drilldown"
import { supabase } from "@/lib/supabase"

type Organization = { id: number; name: string | null; status: string | null }
type PointRecord = { id: number; organization_id: number; name: string | null; notes: string | null; status: string | null }
type TrackTransition = { id: string; label: string; to_step: string }
type TrackStep = { id: string; title: string; description?: string | null; transitions?: TrackTransition[] }
type TrackSchema = { title?: string | null; description?: string | null; initial_step?: string | null; steps?: TrackStep[] }
type TrackType = { id: number; name: string | null; track_schema: TrackSchema | null }
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
  step_key: string | null
  payload: Record<string, unknown> | null
  created_at: string
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

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return JSON.stringify(value, null, 2)
}

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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadPage = async () => {
      if (organizationIdFromRoute === null || pointIdFromRoute === null || trackIdFromRoute === null) {
        setError("כתובת המסלול אינה תקינה.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const [organizationsResult, pointResult, trackResult, pointTracksResult, eventsResult] = await Promise.all([
        supabase.from("organizations").select("id, name, status").order("name", { ascending: true, nullsFirst: false }),
        supabase.from("points").select("id, organization_id, name, notes, status").eq("id", pointIdFromRoute).single<PointRecord>(),
        supabase
          .from("tracking_records")
          .select("id, ref_id, point_id, name, status, current_step, data, notes, track_type:track_types(id, name, track_schema)")
          .eq("id", trackIdFromRoute)
          .single<TrackingRecordRow>(),
        supabase
          .from("tracking_records")
          .select("id, ref_id, point_id, name, status, current_step, data, notes, track_type:track_types(id, name, track_schema)")
          .eq("point_id", pointIdFromRoute)
          .order("updated_at", { ascending: false }),
        supabase
          .from("tracking_record_events")
          .select("id, event_type, step_key, payload, created_at")
          .eq("tracking_record_id", trackIdFromRoute)
          .order("created_at", { ascending: false }),
      ])

      if (!isMounted) return

      if (organizationsResult.error || pointResult.error || trackResult.error || pointTracksResult.error || eventsResult.error) {
        console.error("Error loading track page:", {
          organizationsError: organizationsResult.error,
          pointError: pointResult.error,
          trackError: trackResult.error,
          pointTracksError: pointTracksResult.error,
          eventsError: eventsResult.error,
        })
        setError("לא הצלחנו לטעון את המסלול הזה כרגע.")
        setLoading(false)
        return
      }

      const nextOrganizations = organizationsResult.data ?? []
      const nextPoint = pointResult.data
      const nextTrackRow = trackResult.data

      if (!nextPoint || !nextTrackRow || nextPoint.organization_id !== organizationIdFromRoute || nextTrackRow.point_id !== nextPoint.id) {
        setError("המסלול הזה לא שייך לנקודה שנבחרה.")
        setLoading(false)
        return
      }

      const buildTrackRecord = (row: TrackingRecordRow) => {
        const trackType = normalizeTrackType(row.track_type)
        const currentStep = getCurrentStep(trackType, row.current_step)
        const url = `/${getOrganizationSegment({ id: nextPoint.organization_id, name: nextOrganizations.find((item) => item.id === nextPoint.organization_id)?.name ?? null })}/${getPointSegment(nextPoint)}/track/${getTrackSegment({ id: row.id, name: row.name || trackType?.name || null })}`

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

      const nextTrack = buildTrackRecord(nextTrackRow)
      const nextPointTracks = ((pointTracksResult.data ?? []) as TrackingRecordRow[]).map(buildTrackRecord)

      setOrganizations(nextOrganizations)
      setPoint(nextPoint)
      setTrack(nextTrack)
      setPointTracks(nextPointTracks)
      setEvents((eventsResult.data ?? []) as EventRow[])
      setLoading(false)
    }

    void loadPage()

    return () => {
      isMounted = false
    }
  }, [organizationIdFromRoute, pointIdFromRoute, trackIdFromRoute])

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

  const trackSteps = useMemo(() => track?.trackType?.track_schema?.steps ?? [], [track])

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as CSSProperties}
    >
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
          title={track ? getTrackTitle(track) : "מסלול"}
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-5 md:py-5">
              {loading ? (
                <div className="px-4 lg:px-6">
                  <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <Card><CardHeader><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-full" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-32 w-full" /></CardContent></Card>
                    <div className="space-y-4">
                      <Card><CardHeader><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-64" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
                      <Card><CardHeader><Skeleton className="h-6 w-32" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
                    </div>
                  </div>
                </div>
              ) : error || !track || !point || !selectedOrganization ? (
                <div className="px-4 lg:px-6">
                  <Alert variant="destructive">
                    <CircleAlert className="size-4" />
                    <AlertTitle>המסלול לא זמין</AlertTitle>
                    <AlertDescription>{error || "לא הצלחנו לטעון את המסלול הזה כרגע."}</AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="px-4 lg:px-6">
                  <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <Card className="xl:sticky xl:top-6 xl:h-fit">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Route className="size-5" />
                          מבט מסלול
                        </CardTitle>
                        <CardDescription>
                          תצוגה מלאה של מבנה המסלול, המצב הנוכחי והמידע שנשמר ברשומה.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-3xl bg-muted/35 p-4 ring-1 ring-border/40">
                          <div className="text-sm font-medium">פרטי מסלול</div>
                          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                            <div>נקודה: {point.name?.trim() || `Point #${point.id}`}</div>
                            <div>סוג מסלול: {track.trackType?.name?.trim() || `סוג #${track.trackType?.id ?? "—"}`}</div>
                            <div>מספר ייחוס: {track.refId}</div>
                          </div>
                        </div>

                        <div className="rounded-3xl bg-card/70 p-4 ring-1 ring-border/50">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">שלב נוכחי</div>
                          <div className="mt-2 text-xl font-semibold">
                            {track.currentStep?.title || track.currentStepKey || "לא הוגדר"}
                          </div>
                          {track.currentStep?.description ? (
                            <p className="mt-2 text-sm text-muted-foreground">{track.currentStep.description}</p>
                          ) : null}
                        </div>

                        <div className="rounded-3xl border border-dashed border-border/60 bg-background/70 p-4">
                          <div className="text-sm font-medium">צעדי המשך זמינים</div>
                          {track.nextTransitions.length === 0 ? (
                            <div className="mt-2 text-sm text-muted-foreground">אין צעדי המשך זמינים כרגע.</div>
                          ) : (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {track.nextTransitions.map((transition) => (
                                <Badge key={transition.id} variant="secondary" className="gap-1 rounded-full">
                                  <ArrowRight className="size-3" />
                                  {transition.label}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Route className="size-5" />
                            שלבי המסלול
                          </CardTitle>
                          <CardDescription>
                            המבנה המלא של המסלול נטען מתוך `track_schema`.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {trackSteps.length === 0 ? (
                            <Alert>
                              <AlertTitle>אין שלבים מוגדרים</AlertTitle>
                              <AlertDescription>לסוג המסלול הזה עדיין אין מבנה שלבים זמין.</AlertDescription>
                            </Alert>
                          ) : (
                            trackSteps.map((step) => {
                              const isCurrent = step.id === (track.currentStep?.id || track.currentStepKey)
                              return (
                                <div
                                  key={step.id}
                                  className={`rounded-3xl border p-4 ${isCurrent ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card/60"}`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="font-medium">{step.title}</div>
                                      {step.description ? (
                                        <div className="mt-1 text-sm text-muted-foreground">{step.description}</div>
                                      ) : null}
                                    </div>
                                    {isCurrent ? <Badge>נוכחי</Badge> : <Badge variant="outline">{step.id}</Badge>}
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Database className="size-5" />
                            נתוני הרשומה
                          </CardTitle>
                          <CardDescription>
                            כל המידע שנשמר ב-`tracking_records.data`.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {!track.data || Object.keys(track.data).length === 0 ? (
                            <Alert>
                              <AlertTitle>אין מידע שמור</AlertTitle>
                              <AlertDescription>לרשומת המסלול הזו עדיין אין נתונים שמורים.</AlertDescription>
                            </Alert>
                          ) : (
                            Object.entries(track.data).map(([key, value]) => (
                              <div key={key} className="rounded-3xl border border-border/60 bg-card/60 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{key}</div>
                                <pre className="mt-2 whitespace-pre-wrap break-words text-sm">{formatValue(value)}</pre>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Clock3 className="size-5" />
                            ציר אירועים
                          </CardTitle>
                          <CardDescription>
                            הפעולות שנרשמו עבור המסלול מתוך `tracking_record_events`.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {events.length === 0 ? (
                            <Alert>
                              <AlertTitle>אין עדיין אירועים</AlertTitle>
                              <AlertDescription>למסלול הזה עדיין לא נרשמו אירועים.</AlertDescription>
                            </Alert>
                          ) : (
                            events.map((event) => (
                              <div key={event.id} className="rounded-3xl border border-border/60 bg-card/60 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="font-medium">{event.event_type}</div>
                                  <Badge variant="outline">{new Date(event.created_at).toLocaleString()}</Badge>
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">
                                  שלב: {event.step_key || "ללא שלב"}
                                </div>
                                {event.payload ? (
                                  <pre className="mt-3 whitespace-pre-wrap break-words text-sm">{formatValue(event.payload)}</pre>
                                ) : null}
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
