export type JourneyEvent = {
  id: number
  event_type: string
  step_key: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

export type TrackJourneyVisit<TEvent extends JourneyEvent = JourneyEvent> = {
  visitId: string
  nodeId: string
  occurrence: number
  enteredAt: string | null
  exitedAt: string | null
  events: TEvent[]
}

const getPayloadString = (
  payload: Record<string, unknown> | null | undefined,
  key: string
) => {
  const value = payload?.[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function buildTrackJourneyVisits<TEvent extends JourneyEvent>({
  nodeIds,
  startNodeId,
  currentNodeId,
  createdAt,
  events,
}: {
  nodeIds: string[]
  startNodeId: string | null
  currentNodeId: string | null
  createdAt?: string | null
  events: TEvent[]
}) {
  const knownNodeIds = new Set(nodeIds)
  const orderedEvents = [...events].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  )

  const initialNodeId =
    (startNodeId && knownNodeIds.has(startNodeId) ? startNodeId : null) ??
    (currentNodeId && knownNodeIds.has(currentNodeId) ? currentNodeId : null) ??
    orderedEvents.find((event) => event.step_key && knownNodeIds.has(event.step_key))?.step_key ??
    nodeIds[0] ??
    null

  if (!initialNodeId) {
    return []
  }

  const visits: TrackJourneyVisit<TEvent>[] = []
  const occurrences = new Map<string, number>()

  const openVisit = (nodeId: string, enteredAt: string | null) => {
    const occurrence = (occurrences.get(nodeId) ?? 0) + 1
    occurrences.set(nodeId, occurrence)

    const visit: TrackJourneyVisit<TEvent> = {
      visitId: `${nodeId}::${occurrence}`,
      nodeId,
      occurrence,
      enteredAt,
      exitedAt: null,
      events: [],
    }

    visits.push(visit)
    return visit
  }

  let currentVisit = openVisit(
    initialNodeId,
    createdAt ?? orderedEvents[0]?.created_at ?? null
  )

  for (const event of orderedEvents) {
    if (event.event_type === "step_advance") {
      const fromNodeId = getPayloadString(event.payload, "from_node_id")
      const toNodeId = getPayloadString(event.payload, "to_node_id") ?? event.step_key

      if (
        currentVisit &&
        (!fromNodeId || fromNodeId === currentVisit.nodeId) &&
        !currentVisit.exitedAt
      ) {
        currentVisit.exitedAt = event.created_at
      }

      if (toNodeId && knownNodeIds.has(toNodeId)) {
        currentVisit = openVisit(toNodeId, event.created_at)
        currentVisit.events.push(event)
        continue
      }

      currentVisit.events.push(event)
      continue
    }

    const explicitVisitId = getPayloadString(event.payload, "visit_id")
    if (explicitVisitId) {
      const explicitVisit = visits.find((visit) => visit.visitId === explicitVisitId)
      if (explicitVisit) {
        explicitVisit.events.push(event)
        continue
      }
    }

    if (currentVisit && (!event.step_key || event.step_key === currentVisit.nodeId)) {
      currentVisit.events.push(event)
      continue
    }

    if (event.step_key && knownNodeIds.has(event.step_key)) {
      const fallbackVisit = [...visits].reverse().find((visit) => visit.nodeId === event.step_key)
      if (fallbackVisit) {
        fallbackVisit.events.push(event)
      }
    }
  }

  if (
    currentNodeId &&
    knownNodeIds.has(currentNodeId) &&
    currentVisit.nodeId !== currentNodeId
  ) {
    currentVisit = openVisit(currentNodeId, orderedEvents.at(-1)?.created_at ?? null)
  }

  return visits
}

export function calculateVisitSlaSnapshot({
  slaMinutes,
  enteredAt,
  exitedAt,
  now,
  isCurrent,
}: {
  slaMinutes: number | null | undefined
  enteredAt: string | null
  exitedAt: string | null
  now: number
  isCurrent: boolean
}) {
  const enteredMs = enteredAt ? new Date(enteredAt).getTime() : Number.NaN
  const endMs = exitedAt ? new Date(exitedAt).getTime() : now
  const elapsedMs =
    Number.isFinite(enteredMs) && Number.isFinite(endMs) && endMs >= enteredMs
      ? endMs - enteredMs
      : null

  const normalizedSla =
    typeof slaMinutes === "number" && Number.isFinite(slaMinutes) && slaMinutes > 0
      ? slaMinutes
      : null

  if (!normalizedSla) {
    return {
      elapsedMs,
      remainingMs: null,
      progressPercent: 0,
      isOverdue: false,
    }
  }

  const totalMs = normalizedSla * 60_000
  const safeElapsed = elapsedMs ?? 0

  return {
    elapsedMs,
    remainingMs: isCurrent ? totalMs - safeElapsed : null,
    progressPercent: totalMs > 0 ? Math.min((safeElapsed / totalMs) * 100, 100) : 0,
    isOverdue: safeElapsed > totalMs,
  }
}
