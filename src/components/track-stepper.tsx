import { useEffect, useMemo, useState } from "react"
import { Check, CircleDot, LoaderCircle, Route } from "lucide-react"

import { TrackNodeSlaIndicator } from "@/components/track-node-sla-indicator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getAvatarInitials } from "@/lib/avatar"
import type { TrackNode, TrackNodeConnection } from "@/lib/track-schema"
import { calculateNodeSlaSnapshot, formatMinutesLabel } from "@/lib/track-sla"
import { cn } from "@/lib/utils"

export type TrackNodeAction = TrackNodeConnection

export type TrackStepperEvent = {
  id: number
  event_type: string
  user_id?: string | null
  step_key: string | null
  payload: Record<string, unknown> | null
  created_at: string
  actor_name?: string | null
  actor_avatar_url?: string | null
}

type TrackStepperProps = {
  nodes: TrackNode[]
  startNodeId: string | null
  currentNodeId: string | null
  events?: TrackStepperEvent[]
  pendingTransitionId?: string | null
  createdAt?: string | null
  slaMode?: string | null
  baseSlaMinutes?: number | null
  onTransitionSelect?: (action: TrackNodeAction, sourceNode: TrackNode) => void
  className?: string
}

const getPayloadString = (
  payload: Record<string, unknown> | null | undefined,
  key: string
) => {
  const value = payload?.[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

const getEventTitle = (event: TrackStepperEvent) => {
  if (event.event_type === "step_advance") return "המסלול קודם"
  if (event.event_type === "general" && getPayloadString(event.payload, "kind") === "created") {
    return "הרשומה נוצרה"
  }
  return "עדכון כללי"
}

const getEventSubtitle = (event: TrackStepperEvent) => {
  if (event.event_type === "step_advance") {
    const transitionLabel = getPayloadString(event.payload, "transition_label")
    const toNodeId = getPayloadString(event.payload, "to_node_id")

    if (transitionLabel && toNodeId) {
      return `${transitionLabel} · אל ${toNodeId}`
    }

    if (transitionLabel) {
      return transitionLabel
    }

    if (toNodeId) {
      return `מעבר אל ${toNodeId}`
    }
  }

  const note = getPayloadString(event.payload, "note")
  if (note) return note

  return new Date(event.created_at).toLocaleString("he-IL")
}

const buildTraversedNodeIds = ({
  nodes,
  startNodeId,
  currentNodeId,
  events,
}: {
  nodes: TrackNode[]
  startNodeId: string | null
  currentNodeId: string | null
  events: TrackStepperEvent[]
}) => {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const orderedPath: string[] = []

  const pushNode = (nodeId: string | null) => {
    if (!nodeId || !nodeIds.has(nodeId)) return
    if (orderedPath[orderedPath.length - 1] === nodeId) return
    orderedPath.push(nodeId)
  }

  pushNode(startNodeId)

  for (const event of events) {
    if (event.event_type === "step_advance") {
      pushNode(getPayloadString(event.payload, "from_node_id") ?? event.step_key)
      pushNode(getPayloadString(event.payload, "to_node_id"))
      continue
    }

    if (orderedPath.length === 0) {
      pushNode(event.step_key)
    }
  }

  pushNode(currentNodeId)

  if (orderedPath.length === 0 && nodes[0]) {
    orderedPath.push(nodes[0].id)
  }

  return orderedPath
}

const groupEventsByNode = (events: TrackStepperEvent[]) => {
  const grouped = new Map<string, TrackStepperEvent[]>()

  for (const event of events) {
    if (!event.step_key) continue
    const current = grouped.get(event.step_key) ?? []
    current.push(event)
    grouped.set(event.step_key, current)
  }

  return grouped
}

function StepEventCard({ event }: { event: TrackStepperEvent }) {
  const actorLabel = event.actor_name?.trim() || "חבר צוות"
  const eventSubtitle = getEventSubtitle(event)

  return (
    <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3">
      <div className="flex items-start gap-3">
        <Avatar className="size-9 border border-border/60">
          <AvatarImage src={event.actor_avatar_url ?? undefined} alt={actorLabel} />
          <AvatarFallback className="text-xs">
            {getAvatarInitials(actorLabel)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{actorLabel}</div>
              <div className="text-xs text-muted-foreground">{getEventTitle(event)}</div>
            </div>
            <div className="shrink-0 text-[11px] text-muted-foreground">
              {new Date(event.created_at).toLocaleString("he-IL")}
            </div>
          </div>
          <div className="text-sm leading-6 text-muted-foreground">{eventSubtitle}</div>
        </div>
      </div>
    </div>
  )
}

function NodeCard({
  node,
  events,
  isCurrent,
  isCompleted,
  pendingTransitionId,
  nodeElapsedMs = null,
  nodeSlaProgress = 0,
  nodeRemainingMs = null,
  isNodeOverdue = false,
  slaMode = "derived",
  onTransitionSelect,
}: {
  node: TrackNode
  events: TrackStepperEvent[]
  isCurrent: boolean
  isCompleted: boolean
  pendingTransitionId: string | null
  nodeElapsedMs?: number | null
  nodeSlaProgress?: number
  nodeRemainingMs?: number | null
  isNodeOverdue?: boolean
  slaMode?: string | null
  onTransitionSelect?: (action: TrackNodeAction, sourceNode: TrackNode) => void
}) {
  const canAdvance = isCurrent && node.next_nodes.length > 0 && onTransitionSelect

  return (
    <div
      className={cn(
        "w-full rounded-2xl border p-5 transition-colors",
        isCurrent && "border-primary/40 bg-primary/5",
        isCompleted && "border-primary/20 bg-primary/5",
        !isCurrent && !isCompleted && "border-border/70 bg-card"
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-lg font-semibold">{node.title}</div>
            {node.description ? (
              <div className="text-sm leading-6 text-muted-foreground">{node.description}</div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              {typeof node.sla_modifier === "number" && node.sla_modifier > 0 ? (
                <Badge variant="secondary" className="rounded-full">
                  {slaMode === "manual"
                    ? `+${formatMinutesLabel(node.sla_modifier)} ignored`
                    : `+${formatMinutesLabel(node.sla_modifier)} ל-SLA הכולל`}
                </Badge>
              ) : null}
            </div>
          </div>
          <div
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              isCurrent && "bg-primary text-primary-foreground",
              isCompleted && "bg-primary/10 text-primary",
              !isCurrent && !isCompleted && "bg-muted text-muted-foreground"
            )}
          >
            {isCurrent ? "נוכחי" : isCompleted ? "הושלם" : "ממתין"}
          </div>
        </div>

        <TrackNodeSlaIndicator
          className="pt-1"
          slaMinutes={node.sla ?? null}
          elapsedMs={isCurrent || isCompleted ? nodeElapsedMs : null}
          remainingMs={isCurrent ? nodeRemainingMs : null}
          progressPercent={isCurrent || isCompleted ? nodeSlaProgress : 0}
          isOverdue={isCurrent || isCompleted ? isNodeOverdue : false}
          status={isCurrent ? "current" : isCompleted ? "completed" : "pending"}
        />

        {canAdvance ? (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-medium tracking-wide text-muted-foreground">
              אפשרויות המשך
            </div>
            <div className="flex flex-wrap gap-2">
              {node.next_nodes.map((action) => {
                const isPending = pendingTransitionId === action.id
                return (
                  <Button
                    key={action.id}
                    variant={isPending ? "default" : "outline"}
                    size="sm"
                    disabled={Boolean(pendingTransitionId)}
                    onClick={() => onTransitionSelect?.(action, node)}
                    className="rounded-full"
                  >
                    {isPending ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Route className="size-4" />
                    )}
                    {action.label}
                  </Button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      {events.length > 0 ? (
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          <div className="text-xs font-medium tracking-wide text-muted-foreground">
            אירועים בצומת זה
          </div>
          <div className="space-y-3">
            {events.map((event) => (
              <StepEventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function TrackStepper({
  nodes,
  startNodeId,
  currentNodeId,
  events = [],
  pendingTransitionId = null,
  createdAt = null,
  slaMode = "derived",
  onTransitionSelect,
  className,
}: TrackStepperProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const orderedEvents = [...events].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  )
  const nodeMap = new Map(nodes.map((node) => [node.id, node] as const))
  const traversedNodeIds = buildTraversedNodeIds({
    nodes,
    startNodeId,
    currentNodeId,
    events: orderedEvents,
  })
  const visibleNodes = traversedNodeIds
    .map((nodeId) => nodeMap.get(nodeId))
    .filter((node): node is TrackNode => Boolean(node))
  const eventsByNode = groupEventsByNode(orderedEvents)
  const resolvedCurrentNodeId =
    currentNodeId && nodeMap.has(currentNodeId)
      ? currentNodeId
      : visibleNodes[visibleNodes.length - 1]?.id ?? startNodeId

  const trackSchema = useMemo(
    () => ({
      title: null,
      description: null,
      start_node_id: startNodeId,
      end_node_id: null,
      nodes,
    }),
    [nodes, startNodeId]
  )

  if (nodes.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground",
          className
        )}
      >
        לסוג המסלול הזה עדיין אין צמתים מוגדרים.
      </div>
    )
  }

  return (
    <div className={cn("space-y-0", className)}>
      {visibleNodes.map((node, index) => {
        const isLast = index === visibleNodes.length - 1
        const isCurrent = node.id === resolvedCurrentNodeId
        const isCompleted =
          !isCurrent &&
          traversedNodeIds.indexOf(node.id) < traversedNodeIds.indexOf(resolvedCurrentNodeId ?? "")
        const nodeSlaSnapshot = calculateNodeSlaSnapshot({
          schema: trackSchema,
          events: orderedEvents,
          createdAt,
          nodeId: node.id,
          now,
        })

        return (
          <div key={node.id} className="relative flex gap-4 pb-5 last:pb-0">
            <div className="relative flex w-10 shrink-0 justify-center">
              {!isLast ? (
                <div
                  className={cn(
                    "absolute left-1/2 top-9 h-[calc(100%-1.25rem)] -translate-x-1/2 border-l",
                    isCompleted ? "border-primary/40" : "border-border"
                  )}
                />
              ) : null}
              <div
                className={cn(
                  "relative z-10 mt-1 flex size-8 items-center justify-center rounded-full border transition-colors",
                  isCurrent && "border-primary bg-primary text-primary-foreground",
                  isCompleted && "border-primary/30 bg-primary/10 text-primary",
                  !isCurrent && !isCompleted && "border-border bg-background text-muted-foreground"
                )}
              >
                {isCurrent ? (
                  <CircleDot className="size-4" />
                ) : isCompleted ? (
                  <Check className="size-4" />
                ) : null}
              </div>
            </div>

            <NodeCard
              node={node}
              events={eventsByNode.get(node.id) ?? []}
              isCurrent={isCurrent}
              isCompleted={isCompleted}
          pendingTransitionId={pendingTransitionId}
          nodeElapsedMs={nodeSlaSnapshot.elapsedMs}
          nodeSlaProgress={nodeSlaSnapshot.progressPercent}
          nodeRemainingMs={nodeSlaSnapshot.remainingMs}
          isNodeOverdue={nodeSlaSnapshot.isOverdue}
              slaMode={slaMode}
              onTransitionSelect={onTransitionSelect}
            />
          </div>
        )
      })}
    </div>
  )
}
