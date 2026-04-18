import type { NormalizedTrackSchema, TrackNode } from "@/lib/track-schema"

type TrackEventLike = {
  event_type: string
  step_key: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

export type SlaMode = "derived" | "manual"

export type TrackSlaSummary = {
  mode: SlaMode
  baseSlaMinutes: number | null
  modifierMinutes: number
  effectiveTrackSlaMinutes: number | null
  trackStartedAt: string | null
  currentNodeStartedAt: string | null
  currentNodeSlaMinutes: number | null
  trackElapsedMs: number | null
  trackRemainingMs: number | null
  currentNodeElapsedMs: number | null
  currentNodeRemainingMs: number | null
  isTrackOverdue: boolean
  isCurrentNodeOverdue: boolean
}

export type NodeSlaSnapshot = {
  startedAt: string | null
  slaMinutes: number | null
  elapsedMs: number | null
  remainingMs: number | null
  progressPercent: number
  isOverdue: boolean
}

const MINUTE_MS = 60 * 1000

const getTimestamp = (value: string | null | undefined) => {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

const getPayloadString = (
  payload: Record<string, unknown> | null | undefined,
  key: string
) => {
  const value = payload?.[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export const normalizeSlaMode = (value: string | null | undefined): SlaMode =>
  value === "manual" ? "manual" : "derived"

export const formatMinutesLabel = (minutes: number | null | undefined) => {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) {
    return "לא הוגדר"
  }

  const absoluteMinutes = Math.max(0, Math.round(minutes))
  const days = Math.floor(absoluteMinutes / 1440)
  const hours = Math.floor((absoluteMinutes % 1440) / 60)
  const remainingMinutes = absoluteMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days} ימים`)
  if (hours > 0) parts.push(`${hours} שעות`)
  if (remainingMinutes > 0 || parts.length === 0) parts.push(`${remainingMinutes} דק׳`)

  return parts.join(" ")
}

export const formatRemainingLabel = (remainingMs: number | null | undefined) => {
  if (typeof remainingMs !== "number" || !Number.isFinite(remainingMs)) {
    return "לא זמין"
  }

  const isOverdue = remainingMs < 0
  const absoluteMinutes = Math.ceil(Math.abs(remainingMs) / MINUTE_MS)
  const label = formatMinutesLabel(absoluteMinutes)

  return isOverdue ? `חריגה של ${label}` : `נותרו ${label}`
}

const getTrackStartTimestamp = (
  createdAt: string | null | undefined,
  events: TrackEventLike[]
) => {
  const createdTimestamp = getTimestamp(createdAt)
  if (createdTimestamp) return createdTimestamp

  for (const event of events) {
    const timestamp = getTimestamp(event.created_at)
    if (timestamp) return timestamp
  }

  return null
}

const getNodeEntryTimestamp = (
  nodeId: string | null,
  schema: NormalizedTrackSchema | null,
  events: TrackEventLike[],
  createdAt: string | null | undefined
) => {
  if (!nodeId) return null

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.event_type !== "step_advance") continue

    const toNodeId = getPayloadString(event.payload, "to_node_id") ?? event.step_key
    if (toNodeId === nodeId) {
      return getTimestamp(event.created_at)
    }
  }

  if (schema?.start_node_id === nodeId) {
    return getTrackStartTimestamp(createdAt, events)
  }

  return null
}

export const calculateNodeSlaSnapshot = ({
  schema,
  events,
  createdAt,
  nodeId,
  now = Date.now(),
}: {
  schema: NormalizedTrackSchema | null
  events: TrackEventLike[]
  createdAt?: string | null
  nodeId: string | null
  now?: number
}): NodeSlaSnapshot => {
  const node =
    schema?.nodes.find((candidate) => candidate.id === nodeId) ??
    (schema?.start_node_id === nodeId
      ? schema.nodes.find((candidate) => candidate.id === schema.start_node_id) ?? null
      : null)
  const startedAtTs = getNodeEntryTimestamp(nodeId, schema, events, createdAt)
  const slaMinutes =
    typeof node?.sla === "number" && Number.isFinite(node.sla) ? node.sla : null
  const elapsedMs = startedAtTs !== null ? Math.max(0, now - startedAtTs) : null
  const remainingMs =
    slaMinutes !== null && elapsedMs !== null ? slaMinutes * MINUTE_MS - elapsedMs : null

  const rawProgressPercent =
    slaMinutes !== null && elapsedMs !== null && slaMinutes > 0
      ? (elapsedMs / (slaMinutes * MINUTE_MS)) * 100
      : 0

  return {
    startedAt: startedAtTs !== null ? new Date(startedAtTs).toISOString() : null,
    slaMinutes,
    elapsedMs,
    remainingMs,
    progressPercent: Math.max(0, Math.min(100, rawProgressPercent)),
    isOverdue: typeof remainingMs === "number" ? remainingMs < 0 : false,
  }
}

const getVisitedNodes = (
  schema: NormalizedTrackSchema | null,
  currentNodeId: string | null,
  events: TrackEventLike[]
) => {
  const nodeMap = new Map((schema?.nodes ?? []).map((node) => [node.id, node] as const))
  const visitedNodes: TrackNode[] = []

  const pushNode = (nodeId: string | null) => {
    if (!nodeId) return
    const node = nodeMap.get(nodeId)
    if (!node) return
    visitedNodes.push(node)
  }

  pushNode(schema?.start_node_id ?? null)

  for (const event of events) {
    if (event.event_type !== "step_advance") continue
    pushNode(getPayloadString(event.payload, "to_node_id") ?? event.step_key)
  }

  if (
    currentNodeId &&
    visitedNodes[visitedNodes.length - 1]?.id !== currentNodeId
  ) {
    pushNode(currentNodeId)
  }

  return visitedNodes
}

export const calculateTrackSlaSummary = ({
  schema,
  events,
  createdAt,
  currentNodeId,
  baseSlaMinutes,
  slaMode,
  now = Date.now(),
}: {
  schema: NormalizedTrackSchema | null
  events: TrackEventLike[]
  createdAt?: string | null
  currentNodeId: string | null
  baseSlaMinutes: number | null
  slaMode: string | null | undefined
  now?: number
}): TrackSlaSummary => {
  const mode = normalizeSlaMode(slaMode)
  const trackStartedAtTs = getTrackStartTimestamp(createdAt, events)
  const currentNodeStartedAtTs = getNodeEntryTimestamp(currentNodeId, schema, events, createdAt)
  const currentNode =
    schema?.nodes.find((node) => node.id === currentNodeId) ??
    (schema?.start_node_id === currentNodeId
      ? schema.nodes.find((node) => node.id === schema.start_node_id) ?? null
      : null)

  const modifierMinutes =
    mode === "manual"
      ? 0
      : getVisitedNodes(schema, currentNodeId, events).reduce(
          (sum, node) => sum + (typeof node.sla_modifier === "number" ? node.sla_modifier : 0),
          0
        )

  const effectiveTrackSlaMinutes =
    typeof baseSlaMinutes === "number" && Number.isFinite(baseSlaMinutes)
      ? baseSlaMinutes + modifierMinutes
      : null

  const trackElapsedMs =
    trackStartedAtTs !== null ? Math.max(0, now - trackStartedAtTs) : null
  const trackRemainingMs =
    effectiveTrackSlaMinutes !== null && trackElapsedMs !== null
      ? effectiveTrackSlaMinutes * MINUTE_MS - trackElapsedMs
      : null

  const currentNodeSlaMinutes =
    typeof currentNode?.sla === "number" && Number.isFinite(currentNode.sla)
      ? currentNode.sla
      : null
  const currentNodeElapsedMs =
    currentNodeStartedAtTs !== null ? Math.max(0, now - currentNodeStartedAtTs) : null
  const currentNodeRemainingMs =
    currentNodeSlaMinutes !== null && currentNodeElapsedMs !== null
      ? currentNodeSlaMinutes * MINUTE_MS - currentNodeElapsedMs
      : null

  return {
    mode,
    baseSlaMinutes,
    modifierMinutes,
    effectiveTrackSlaMinutes,
    trackStartedAt: trackStartedAtTs !== null ? new Date(trackStartedAtTs).toISOString() : null,
    currentNodeStartedAt:
      currentNodeStartedAtTs !== null ? new Date(currentNodeStartedAtTs).toISOString() : null,
    currentNodeSlaMinutes,
    trackElapsedMs,
    trackRemainingMs,
    currentNodeElapsedMs,
    currentNodeRemainingMs,
    isTrackOverdue:
      typeof trackRemainingMs === "number" ? trackRemainingMs < 0 : false,
    isCurrentNodeOverdue:
      typeof currentNodeRemainingMs === "number" ? currentNodeRemainingMs < 0 : false,
  }
}
