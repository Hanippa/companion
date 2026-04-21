import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { CircleAlert, CircleDot, PackageCheck } from "lucide-react"

import { TrackNodeSlaIndicator } from "@/components/track-node-sla-indicator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getAvatarInitials } from "@/lib/avatar"
import { supabase } from "@/lib/supabase"
import {
  getTrackCurrentNode,
  normalizeTrackSchema,
  type NormalizedTrackSchema,
  type TrackNode,
} from "@/lib/track-schema"
import {
  calculateNodeSlaSnapshot,
  calculateTrackSlaSummary,
  formatMinutesLabel,
  formatRemainingLabel,
} from "@/lib/track-sla"

type PointRecord = {
  id: number
  name: string | null
}

type TrackType = {
  id: number
  name: string | null
  sla: number | null
  track_schema: NormalizedTrackSchema | Record<string, unknown> | null
}

type PublicTrackRecord = {
  id: number
  refId: number
  name: string | null
  status: string | null
  currentStepKey: string | null
  sla: number | null
  slaMode: string | null
  notes: string | null
  updatedAt: string | null
  createdAt: string | null
  point: PointRecord | null
  trackType: TrackType | null
  trackSchema: NormalizedTrackSchema | null
  currentNode: TrackNode | null
}

type PublicTrackEvent = {
  id: number
  event_type: string
  step_key: string | null
  payload: Record<string, unknown> | null
  created_at: string
  actor_name: string | null
  actor_avatar_url: string | null
}

type PublicTrackFunctionResponse = {
  success: boolean
  track: {
    id: number
    ref_id: number
    name: string | null
    status: string | null
    current_step: string | null
    sla: number | null
    sla_mode: string | null
    notes: string | null
    updated_at: string | null
    created_at: string | null
    point: PointRecord | null
    track_type: TrackType | null
  } | null
  events: PublicTrackEvent[]
}

type RealtimeStatus = "CONNECTING" | "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR"

const getTrackTitle = (track: PublicTrackRecord | null) =>
  track?.name?.trim() || track?.trackType?.name?.trim() || `מעקב #${track?.id ?? "—"}`

const getTrackStatusLabel = (status: string | null | undefined) =>
  status === "active" ? "בטיפול" : status?.trim() || "לא פעיל"

const getRealtimeStatusLabel = (status: RealtimeStatus) => {
  switch (status) {
    case "SUBSCRIBED":
      return "מחובר לעדכונים חיים"
    case "CONNECTING":
      return "מתחבר לעדכונים חיים"
    case "TIMED_OUT":
      return "החיבור לעדכונים מושהה"
    case "CHANNEL_ERROR":
      return "שגיאת חיבור לעדכונים"
    case "CLOSED":
    default:
      return "עדכונים חיים לא פעילים"
  }
}

const getPayloadString = (payload: Record<string, unknown> | null | undefined, key: string) => {
  const value = payload?.[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

const getPublicEventTitle = (event: PublicTrackEvent) => {
  if (event.event_type === "step_advance") {
    return getPayloadString(event.payload, "transition_label") || "הטיפול התקדם"
  }

  return getPayloadString(event.payload, "note") || "עדכון כללי"
}

const getNodeTitle = (schema: NormalizedTrackSchema | null, nodeId: string | null | undefined) => {
  if (!schema || !nodeId) return null
  return schema.nodes.find((node) => node.id === nodeId)?.title ?? null
}

const buildVisibleNodes = (
  schema: NormalizedTrackSchema | null,
  currentStepKey: string | null,
  events: PublicTrackEvent[]
) => {
  const nodes = schema?.nodes ?? []
  const nodeMap = new Map(nodes.map((node) => [node.id, node] as const))
  const orderedPath: string[] = []

  const pushNode = (nodeId: string | null) => {
    if (!nodeId || !nodeMap.has(nodeId)) return
    if (orderedPath[orderedPath.length - 1] === nodeId) return
    orderedPath.push(nodeId)
  }

  pushNode(schema?.start_node_id ?? null)

  for (const event of events) {
    if (event.event_type === "step_advance") {
      pushNode(getPayloadString(event.payload, "to_node_id") ?? event.step_key)
    } else {
      pushNode(event.step_key)
    }
  }

  pushNode(currentStepKey)

  if (orderedPath.length === 0 && nodes[0]) {
    orderedPath.push(nodes[0].id)
  }

  return orderedPath
    .map((nodeId) => nodeMap.get(nodeId))
    .filter((node): node is TrackNode => Boolean(node))
}

export default function PublicTrackPage() {
  const { trackSlug } = useParams()
  const trackingToken = trackSlug ?? null

  const [track, setTrack] = useState<PublicTrackRecord | null>(null)
  const [events, setEvents] = useState<PublicTrackEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("CONNECTING")
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const loadTrack = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!trackingToken) {
        setError("קישור המעקב אינו תקין.")
        setLoading(false)
        return
      }

      if (!options?.silent) {
        setLoading(true)
      }
      setError(null)

      const { data, error: functionError } = await supabase.functions.invoke<PublicTrackFunctionResponse>(
        "get-track-data-by-token",
        { body: { token: trackingToken } }
      )

      if (functionError || !data?.track) {
        console.error("Error fetching public track:", functionError)
        setTrack(null)
        setEvents([])
        setError("לא הצלחנו לטעון את פרטי המעקב כרגע.")
        setLoading(false)
        return
      }

      const trackType = data.track.track_type ?? null
      const trackSchema = normalizeTrackSchema(trackType?.track_schema)

      setTrack({
        id: data.track.id,
        refId: data.track.ref_id,
        name: data.track.name,
        status: data.track.status,
        currentStepKey: data.track.current_step,
        sla: data.track.sla,
        slaMode: data.track.sla_mode,
        notes: data.track.notes,
        updatedAt: data.track.updated_at,
        createdAt: data.track.created_at,
        point: data.track.point,
        trackType,
        trackSchema,
        currentNode: getTrackCurrentNode(trackSchema, data.track.current_step),
      })
      setEvents(data.events ?? [])
      setLoading(false)
    },
    [trackingToken]
  )

  useEffect(() => {
    void loadTrack()
  }, [loadTrack])

  useEffect(() => {
    if (!trackingToken) return

    const topic = `public-track:${trackingToken}`
    let isActive = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    setRealtimeStatus("CONNECTING")

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
        .channel(topic, { config: { private: false } })
        .on("broadcast", { event: "track_updated" }, () => {
          void loadTrack({ silent: true })
        })
        .subscribe((status, err) => {
          setRealtimeStatus(status as RealtimeStatus)
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error("Public track realtime subscription issue:", {
              token: trackingToken,
              topic,
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
  }, [loadTrack, trackingToken])

  const visibleNodes = useMemo(
    () => buildVisibleNodes(track?.trackSchema ?? null, track?.currentStepKey ?? null, events),
    [events, track]
  )

  const currentNodeIndex = visibleNodes.findIndex(
    (node) => node.id === (track?.currentNode?.id ?? track?.currentStepKey)
  )
  const currentNodeLabel = track?.currentNode?.title || track?.currentStepKey || "מתעדכן"

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

  return (
    <main dir="rtl" className="min-h-screen bg-muted/20">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-medium text-primary">Trace</div>
            <div className="text-sm text-muted-foreground">מעקב ציבורי אחר סטטוס הטיפול</div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/login">כניסה למערכת</Link>
          </Button>
        </div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-56 rounded-3xl" />
            <Skeleton className="h-96 rounded-3xl" />
          </div>
        ) : error || !track ? (
          <Alert variant="destructive" className="rounded-3xl">
            <CircleAlert className="size-4" />
            <AlertTitle>המעקב אינו זמין</AlertTitle>
            <AlertDescription>{error || "לא נמצאה רשומת מעקב להצגה."}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            <Card className="overflow-hidden rounded-3xl border-border/70 shadow-none">
              <CardHeader className="gap-6 bg-background">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                      <span className="size-2 rounded-full bg-primary/80" />
                      מעקב ציבורי
                    </div>
                    <CardTitle className="text-3xl tracking-tight">{getTrackTitle(track)}</CardTitle>
                    <CardDescription className="max-w-2xl text-base leading-7">
                      {track.notes?.trim() ||
                        "כאן אפשר לעקוב אחרי ההתקדמות של הטיפול ולקבל תמונת מצב עדכנית בכל שלב."}
                    </CardDescription>
                  </div>

                  <div className="grid min-w-[220px] gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                      <div className="text-xs text-muted-foreground">סטטוס נוכחי</div>
                      <div className="mt-2 flex items-center gap-2 text-sm font-medium">
                        <Badge variant={track.status === "active" ? "default" : "secondary"}>
                          {getTrackStatusLabel(track.status)}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                      <div className="text-xs text-muted-foreground">שלב נוכחי</div>
                      <div className="mt-2 text-sm font-medium">{currentNodeLabel}</div>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                      <div className="text-xs text-muted-foreground">מספר מעקב</div>
                      <div className="mt-2 text-sm font-medium">{track.refId}</div>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                      <div className="text-xs text-muted-foreground">נקודה מטפלת</div>
                      <div className="mt-2 text-sm font-medium">{track.point?.name?.trim() || "—"}</div>
                    </div>
                    {slaSummary.effectiveTrackSlaMinutes !== null ? (
                      <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                        <div className="text-xs text-muted-foreground">SLA למסלול</div>
                        <div className="mt-2 text-sm font-medium">
                          {formatMinutesLabel(slaSummary.effectiveTrackSlaMinutes)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {slaSummary.trackRemainingMs !== null
                            ? formatRemainingLabel(slaSummary.trackRemainingMs)
                            : "טרם הוגדר SLA"}
                        </div>
                      </div>
                    ) : null}
                    {slaSummary.currentNodeSlaMinutes !== null ? (
                      <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                        <div className="text-xs text-muted-foreground">SLA לצומת נוכחי</div>
                        <div className="mt-2 text-sm font-medium">
                          {slaSummary.currentNodeRemainingMs !== null
                            ? formatRemainingLabel(slaSummary.currentNodeRemainingMs)
                            : formatMinutesLabel(slaSummary.currentNodeSlaMinutes)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="rounded-3xl border-border/70 shadow-none">
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl">התקדמות הטיפול</CardTitle>
                    <CardDescription>
                      המסלול מוצג מהשלב הראשון ועד לנקודה שבה הטיפול נמצא כרגע.
                    </CardDescription>
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
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {visibleNodes.map((node, index) => {
                    const isCurrent = index === currentNodeIndex || node.id === track.currentStepKey
                    const isCompleted =
                      currentNodeIndex === -1
                        ? !isCurrent && index < visibleNodes.length - 1
                        : index < currentNodeIndex
                    const nodeEvents = events.filter((event) => event.step_key === node.id)
                    const nodeSlaSnapshot = calculateNodeSlaSnapshot({
                      schema: track.trackSchema,
                      events,
                      createdAt: track.createdAt,
                      nodeId: node.id,
                      now,
                    })

                    return (
                      <div key={node.id} className="relative flex gap-4 pb-6 last:pb-0">
                        <div className="relative flex w-10 shrink-0 justify-center">
                          {index < visibleNodes.length - 1 ? (
                            <div
                              className={[
                                "absolute left-1/2 top-9 h-[calc(100%-1.25rem)] -translate-x-1/2 border-l",
                                isCompleted ? "border-primary/40" : "border-border",
                              ].join(" ")}
                            />
                          ) : null}
                          <div
                            className={[
                              "relative z-10 mt-1 flex size-8 items-center justify-center rounded-full border",
                              isCurrent
                                ? "border-primary bg-primary text-primary-foreground"
                                : isCompleted
                                  ? "border-primary/30 bg-primary/10 text-primary"
                                  : "border-border bg-background text-muted-foreground",
                            ].join(" ")}
                          >
                            {isCurrent ? (
                              <CircleDot className="size-4" />
                            ) : (
                              <PackageCheck className="size-4" />
                            )}
                          </div>
                        </div>

                        <div className="w-full rounded-2xl border border-border/70 bg-background p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-lg font-semibold">{node.title}</div>
                              {node.description ? (
                                <div className="text-sm leading-6 text-muted-foreground">
                                  {node.description}
                                </div>
                              ) : null}
                            </div>
                            <div className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                              {isCurrent ? "בטיפול כעת" : isCompleted ? "הושלם" : "ממתין"}
                            </div>
                          </div>

                          <TrackNodeSlaIndicator
                            className="mt-4"
                            slaMinutes={node.sla ?? null}
                            elapsedMs={isCurrent || isCompleted ? nodeSlaSnapshot.elapsedMs : null}
                            remainingMs={isCurrent ? nodeSlaSnapshot.remainingMs : null}
                            progressPercent={
                              isCurrent || isCompleted ? nodeSlaSnapshot.progressPercent : 0
                            }
                            isOverdue={isCurrent || isCompleted ? nodeSlaSnapshot.isOverdue : false}
                            status={isCurrent ? "current" : isCompleted ? "completed" : "pending"}
                          />

                          {nodeEvents.length > 0 ? (
                            <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
                              {nodeEvents.map((event) => (
                                <div key={event.id} className="rounded-xl bg-muted/20 px-3 py-3 text-sm">
                                  <div className="flex items-start gap-3">
                                    <Avatar className="size-9 border border-border/60">
                                      <AvatarImage
                                        src={event.actor_avatar_url ?? undefined}
                                        alt={event.actor_name ?? "נציג שירות"}
                                        loading="lazy"
                                        referrerPolicy="no-referrer"
                                      />
                                      <AvatarFallback className="text-xs">
                                        {getAvatarInitials(event.actor_name || "נציג שירות")}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-medium">
                                            {event.actor_name?.trim() || "נציג שירות"}
                                          </div>
                                          <div className="text-sm text-muted-foreground">
                                            {getPublicEventTitle(event)}
                                          </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {new Date(event.created_at).toLocaleString("he-IL")}
                                        </div>
                                      </div>
                                      {event.event_type === "step_advance" &&
                                      getPayloadString(event.payload, "to_node_id") ? (
                                        <div className="text-xs text-muted-foreground">
                                          יעד:{" "}
                                          {getNodeTitle(
                                            track.trackSchema,
                                            getPayloadString(event.payload, "to_node_id")
                                          ) ??
                                            getPayloadString(event.payload, "to_node_id")}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}
