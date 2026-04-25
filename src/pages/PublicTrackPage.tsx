import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleDot,
  Hash,
  MapPin,
  PackageCheck,
  TimerReset,
} from "lucide-react"

import { TrackNodeSlaIndicator } from "@/components/track-node-sla-indicator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getAvatarInitials } from "@/lib/avatar"
import { buildTrackJourneyVisits, calculateVisitSlaSnapshot } from "@/lib/track-journey"
import { supabase } from "@/lib/supabase"
import {
  getTrackCurrentNode,
  normalizeTrackSchema,
  type NormalizedTrackSchema,
  type TrackNode,
} from "@/lib/track-schema"
import {
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

const formatPublicEventTimestamp = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const dayMonth = date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
  })
  const time = date.toLocaleTimeString("he-IL", {
    hour: "numeric",
    minute: "2-digit",
  })

  return `${dayMonth} בשעה ${time}`
}

const getPublicEventTitle = (event: PublicTrackEvent) => {
  if (event.event_type === "step_advance") {
    return getPayloadString(event.payload, "transition_label") || "הטיפול התקדם"
  }

  const customTitle = getPayloadString(event.payload, "title")
  if (customTitle) {
    return customTitle
  }

  return getPayloadString(event.payload, "note") || "עדכון כללי"
}

const getPublicEventSubtitle = (event: PublicTrackEvent) => {
  const note = getPayloadString(event.payload, "note")
  if (!note) return null
  if (event.event_type !== "step_advance" && !getPayloadString(event.payload, "title")) {
    return null
  }
  return note
}

const getNodeTitle = (schema: NormalizedTrackSchema | null, nodeId: string | null | undefined) => {
  if (!schema || !nodeId) return null
  return schema.nodes.find((node) => node.id === nodeId)?.title ?? null
}

function CompactInfoPill({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <div className="public-track-card rounded-2xl border border-border/60 bg-background/88 px-4 py-3 shadow-sm shadow-black/5">
      <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm font-semibold leading-6 text-foreground">{value}</div>
      {description ? <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{description}</div> : null}
    </div>
  )
}

export default function PublicTrackPage() {
  const { trackSlug } = useParams()
  const trackingToken = trackSlug ?? null

  const [track, setTrack] = useState<PublicTrackRecord | null>(null)
  const [events, setEvents] = useState<PublicTrackEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("CONNECTING")
  const [showMeta, setShowMeta] = useState(false)
  const [recentEventIds, setRecentEventIds] = useState<number[]>([])
  const [recentStepKey, setRecentStepKey] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const previousEventIdsRef = useRef<number[]>([])
  const previousStepRef = useRef<string | null>(null)
  const firstLoadRef = useRef(true)

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
    const currentIds = events.map((event) => event.id)
    const previousIds = previousEventIdsRef.current

    if (firstLoadRef.current) {
      previousEventIdsRef.current = currentIds
      return
    }

    const nextNewIds = currentIds.filter((id) => !previousIds.includes(id))
    if (nextNewIds.length > 0) {
      setRecentEventIds((current) => Array.from(new Set([...current, ...nextNewIds])))
      const timeout = window.setTimeout(() => {
        setRecentEventIds((current) => current.filter((id) => !nextNewIds.includes(id)))
      }, 2400)

      previousEventIdsRef.current = currentIds
      return () => window.clearTimeout(timeout)
    }

    previousEventIdsRef.current = currentIds
    return
  }, [events])

  useEffect(() => {
    const currentStep = track?.currentStepKey ?? null

    if (firstLoadRef.current) {
      previousStepRef.current = currentStep
      return
    }

    if (currentStep && previousStepRef.current && currentStep !== previousStepRef.current) {
      setRecentStepKey(currentStep)
      const timeout = window.setTimeout(() => setRecentStepKey(null), 2600)
      previousStepRef.current = currentStep
      return () => window.clearTimeout(timeout)
    }

    previousStepRef.current = currentStep
    return
  }, [track?.currentStepKey])

  useEffect(() => {
    if (!loading) {
      firstLoadRef.current = false
    }
  }, [loading])

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

  const visibleNodes = useMemo(() => track?.trackSchema?.nodes ?? [], [track?.trackSchema?.nodes])
  const journeyVisits = useMemo(
    () =>
      buildTrackJourneyVisits({
        nodeIds: visibleNodes.map((node) => node.id),
        startNodeId: track?.trackSchema?.start_node_id ?? null,
        currentNodeId: track?.currentStepKey ?? null,
        createdAt: track?.createdAt ?? null,
        events,
      }),
    [events, track?.createdAt, track?.currentStepKey, track?.trackSchema?.start_node_id, visibleNodes]
  )
  const reversedVisibleVisits = useMemo(() => {
    const nodeMap = new Map(visibleNodes.map((node) => [node.id, node] as const))
    return [...journeyVisits]
      .map((visit) => {
        const node = nodeMap.get(visit.nodeId)
        if (!node) return null
        return { visit, node }
      })
      .filter(
        (item): item is { visit: (typeof journeyVisits)[number]; node: TrackNode } => Boolean(item)
      )
      .reverse()
  }, [journeyVisits, visibleNodes])
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

  const mainSlaValue =
    slaSummary.trackRemainingMs !== null
      ? formatRemainingLabel(slaSummary.trackRemainingMs)
      : formatMinutesLabel(slaSummary.effectiveTrackSlaMinutes)

  const mainSlaCaption =
    slaSummary.effectiveTrackSlaMinutes !== null
      ? `SLA למסלול: ${formatMinutesLabel(slaSummary.effectiveTrackSlaMinutes)}`
      : "למסלול הזה לא הוגדר זמן יעד."

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(203,255,77,0.18),_transparent_32%),linear-gradient(180deg,rgba(250,250,247,1)_0%,rgba(246,246,242,1)_100%)]"
    >
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-[16rem] rounded-[2rem]" />
            <Skeleton className="h-[30rem] rounded-[2rem]" />
          </div>
        ) : error || !track ? (
          <Alert variant="destructive" className="rounded-[2rem] border-destructive/30 bg-background/90">
            <CircleAlert className="size-4" />
            <AlertTitle>המעקב אינו זמין</AlertTitle>
            <AlertDescription>{error || "לא נמצאה רשומת מעקב להצגה."}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            <Card className="overflow-hidden rounded-[2rem] border-border/60 bg-background/92 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <CardHeader className="public-track-hero relative gap-4 overflow-hidden border-b border-border/50 px-5 py-5 sm:px-7">
                <div className="public-track-hero-base" />
                <div className="public-track-blob public-track-blob-right" />
                <div className="public-track-blob public-track-blob-left" />

                <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMeta((current) => !current)}
                    className="flex min-w-0 items-center gap-2 text-right transition-opacity hover:opacity-80"
                  >
                    <span className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      {getTrackTitle(track)}
                    </span>
                    {showMeta ? (
                      <ChevronUp className="mt-1 size-5 shrink-0 text-foreground" />
                    ) : (
                      <ChevronDown className="mt-1 size-5 shrink-0 text-foreground" />
                    )}
                  </button>

                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
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

                <div className="public-track-sla-panel relative z-10 rounded-[1.75rem] border border-primary/20 bg-background/94 px-5 py-5 text-right shadow-[0_10px_30px_rgba(203,255,77,0.1)]">
                  <div className="text-sm font-medium text-muted-foreground">הזמן שנותר לטיפול</div>
                  <div className="mt-2.5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                    {mainSlaValue}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">{mainSlaCaption}</div>
                </div>

                {showMeta ? (
                  <div className="relative z-10 grid gap-3 border-t border-border/50 pt-1 sm:grid-cols-2 xl:grid-cols-4">
                    <CompactInfoPill
                      icon={PackageCheck}
                      label="סטטוס נוכחי"
                      value={
                        <Badge
                          variant={track.status === "active" ? "default" : "secondary"}
                          className="rounded-full bg-primary text-black"
                        >
                          {getTrackStatusLabel(track.status)}
                        </Badge>
                      }
                    />
                    <CompactInfoPill icon={CircleDot} label="שלב נוכחי" value={currentNodeLabel} />
                    <CompactInfoPill icon={Hash} label="מספר מעקב" value={track.refId} />
                    <CompactInfoPill
                      icon={MapPin}
                      label="נקודה מטפלת"
                      value={track.point?.name?.trim() || "—"}
                    />
                    {slaSummary.currentNodeSlaMinutes !== null ? (
                      <CompactInfoPill
                        icon={TimerReset}
                        label="SLA לשלב הנוכחי"
                        value={
                          slaSummary.currentNodeRemainingMs !== null
                            ? formatRemainingLabel(slaSummary.currentNodeRemainingMs)
                            : formatMinutesLabel(slaSummary.currentNodeSlaMinutes)
                        }
                      />
                    ) : null}
                  </div>
                ) : null}
              </CardHeader>

              <CardContent className="px-5 pb-6 pt-5 sm:px-7">
                {reversedVisibleVisits.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
                    עדיין אין שלבים להצגה במסלול הזה.
                  </div>
                ) : (
                  <div className="space-y-0">
                    {reversedVisibleVisits.map(({ visit, node }, index) => {
                      const isCurrent = node.id === (track.currentNode?.id ?? track.currentStepKey) && index === 0
                      const isCompleted = !isCurrent
                      const nodeEvents = visit.events
                      const nodeSlaSnapshot = calculateVisitSlaSnapshot({
                        slaMinutes: node.sla ?? null,
                        enteredAt: visit.enteredAt,
                        exitedAt: visit.exitedAt,
                        now,
                        isCurrent,
                      })

                      return (
                        <div key={visit.visitId} className="relative flex gap-4 pb-6 last:pb-0 sm:gap-5">
                          <div className="relative flex w-10 shrink-0 justify-center">
                            {index < reversedVisibleVisits.length - 1 ? (
                              <div
                                className={[
                                  "absolute left-1/2 top-9 h-[calc(100%-1.1rem)] -translate-x-1/2 border-l",
                                  isCompleted || isCurrent ? "border-primary/50" : "border-border/80",
                                ].join(" ")}
                              />
                            ) : null}
                            <div
                              className={[
                                "relative z-10 mt-1 flex size-8 items-center justify-center rounded-full border shadow-sm transition-transform duration-300",
                                isCurrent
                                  ? "bg-primary text-black border-primary public-track-current-node"
                                  : isCompleted
                                    ? "border-primary/30 bg-primary/10 text-black"
                                    : "border-border bg-background text-muted-foreground",
                              ].join(" ")}
                            >
                              {isCurrent ? <CircleDot className="size-4" /> : <PackageCheck className="size-4" />}
                            </div>
                          </div>

                          <div
                            className={[
                              "public-track-card w-full rounded-[1.75rem] border px-4 py-4 sm:px-5 sm:py-5",
                              isCurrent
                                ? "border-primary/25 bg-[linear-gradient(180deg,rgba(203,255,77,0.1),rgba(255,255,255,0.98))] shadow-[0_10px_30px_rgba(203,255,77,0.12)]"
                                : "border-border/70 bg-background",
                              recentStepKey === node.id ? "public-track-step-arrive" : "",
                            ].join(" ")}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1.5">
                                <div className="text-lg font-semibold tracking-tight text-foreground">{node.title}</div>
                                {node.description ? (
                                  <div className="text-sm leading-6 text-muted-foreground">{node.description}</div>
                                ) : null}
                              </div>
                              <div
                                className={[
                                  "rounded-full px-2.5 py-1 text-xs font-medium",
                                  isCurrent
                                    ? "bg-primary text-black"
                                    : isCompleted
                                      ? "bg-primary/10 text-black"
                                      : "bg-muted text-muted-foreground",
                                ].join(" ")}
                              >
                                {isCurrent ? "בטיפול כעת" : isCompleted ? "הושלם" : "ממתין"}
                              </div>
                            </div>

                            <TrackNodeSlaIndicator
                              className="mt-4"
                              slaMinutes={node.sla ?? null}
                              elapsedMs={isCurrent || isCompleted ? nodeSlaSnapshot.elapsedMs : null}
                              remainingMs={isCurrent ? nodeSlaSnapshot.remainingMs : null}
                              progressPercent={isCurrent || isCompleted ? nodeSlaSnapshot.progressPercent : 0}
                              isOverdue={isCurrent || isCompleted ? nodeSlaSnapshot.isOverdue : false}
                              status={isCurrent ? "current" : isCompleted ? "completed" : "pending"}
                            />

                            {nodeEvents.length > 0 ? (
                              <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
                                {nodeEvents.map((event) => (
                                  <div
                                    key={event.id}
                                    className={[
                                      "public-track-card rounded-2xl border border-border/50 bg-muted/15 px-3 py-3.5 text-sm",
                                      recentEventIds.includes(event.id) ? "public-track-event-arrive" : "",
                                    ].join(" ")}
                                  >
                                    <div className="flex items-start gap-3">
                                      <Avatar className="size-10 border border-border/60 shadow-sm">
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
                                      <div className="min-w-0 flex-1 space-y-1.5">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-foreground">
                                              {event.actor_name?.trim() || "נציג שירות"}
                                            </div>
                                            <div className="text-sm leading-6 text-muted-foreground">
                                              {getPublicEventTitle(event)}
                                            </div>
                                            {getPublicEventSubtitle(event) ? (
                                              <div className="text-sm leading-6 text-muted-foreground/90">
                                                {getPublicEventSubtitle(event)}
                                              </div>
                                            ) : null}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {formatPublicEventTimestamp(event.created_at)}
                                          </div>
                                        </div>

                                        {event.event_type === "step_advance" &&
                                        getPayloadString(event.payload, "to_node_id") ? (
                                          <div className="text-xs leading-5 text-muted-foreground">
                                            יעד:{" "}
                                            {getNodeTitle(
                                              track.trackSchema,
                                              getPayloadString(event.payload, "to_node_id")
                                            ) ?? getPayloadString(event.payload, "to_node_id")}
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
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}

