import { useEffect, useState } from "react"
import {
  Check,
  CircleDot,
  LoaderCircle,
  MoreHorizontal,
  Route,
  SquarePen,
  Trash2,
} from "lucide-react"

import { TrackNodeSlaIndicator } from "@/components/track-node-sla-indicator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { getAvatarInitials } from "@/lib/avatar"
import { buildTrackJourneyVisits, calculateVisitSlaSnapshot } from "@/lib/track-journey"
import type { TrackNode, TrackNodeConnection } from "@/lib/track-schema"
import { formatMinutesLabel } from "@/lib/track-sla"
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
  activeEventVisitId?: string | null
  customEventTitle?: string
  customEventNote?: string
  savingCustomEvent?: boolean
  onToggleEventComposer?: (visitId: string) => void
  onCustomEventTitleChange?: (value: string) => void
  onCustomEventNoteChange?: (value: string) => void
  onCreateCustomEvent?: (visitId: string) => void
  activeEditEventId?: number | null
  editEventTitle?: string
  editEventNote?: string
  savingEditedEvent?: boolean
  deletingEventId?: number | null
  onStartEditEvent?: (event: TrackStepperEvent) => void
  onCancelEditEvent?: () => void
  onEditEventTitleChange?: (value: string) => void
  onEditEventNoteChange?: (value: string) => void
  onSaveEditedEvent?: (eventId: number) => void
  onDeleteEvent?: (event: TrackStepperEvent) => void
  className?: string
}

const getPayloadString = (
  payload: Record<string, unknown> | null | undefined,
  key: string
) => {
  const value = payload?.[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

const isCustomEvent = (event: TrackStepperEvent) =>
  event.event_type === "general" && getPayloadString(event.payload, "kind") === "custom"

const getEventTitle = (event: TrackStepperEvent) => {
  if (event.event_type === "step_advance") return "המסלול קודם"
  if (event.event_type === "general" && getPayloadString(event.payload, "kind") === "created") {
    return "הרשומה נוצרה"
  }

  const customTitle = getPayloadString(event.payload, "title")
  if (customTitle) return customTitle

  return "עדכון כללי"
}

const getEventSubtitle = (event: TrackStepperEvent) => {
  if (event.event_type === "step_advance") {
    const transitionLabel = getPayloadString(event.payload, "transition_label")
    const toNodeId = getPayloadString(event.payload, "to_node_id")

    if (transitionLabel && toNodeId) {
      return `${transitionLabel} · אל ${toNodeId}`
    }

    if (transitionLabel) return transitionLabel
    if (toNodeId) return `מעבר אל ${toNodeId}`
  }

  const note = getPayloadString(event.payload, "note")
  if (note) return note

  return new Date(event.created_at).toLocaleString("he-IL")
}

function StepEventCard({
  event,
  isEditing = false,
  editTitle = "",
  editNote = "",
  savingEditedEvent = false,
  deletingEvent = false,
  onStartEdit,
  onCancelEdit,
  onEditTitleChange,
  onEditNoteChange,
  onSaveEditedEvent,
  onDeleteEvent,
}: {
  event: TrackStepperEvent
  isEditing?: boolean
  editTitle?: string
  editNote?: string
  savingEditedEvent?: boolean
  deletingEvent?: boolean
  onStartEdit?: (event: TrackStepperEvent) => void
  onCancelEdit?: () => void
  onEditTitleChange?: (value: string) => void
  onEditNoteChange?: (value: string) => void
  onSaveEditedEvent?: (eventId: number) => void
  onDeleteEvent?: (event: TrackStepperEvent) => void
}) {
  const actorLabel = event.actor_name?.trim() || "חבר צוות"
  const eventSubtitle = getEventSubtitle(event)
  const canManageEvent = isCustomEvent(event)

  if (isEditing && canManageEvent) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
        <div className="flex items-start gap-3">
          <Avatar className="size-9 border border-border/60">
            <AvatarImage src={event.actor_avatar_url ?? undefined} alt={actorLabel} />
            <AvatarFallback className="text-xs">{getAvatarInitials(actorLabel)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{actorLabel}</div>
                <div className="text-xs text-emerald-950/65">עריכת אירוע ידני</div>
              </div>
              <div className="shrink-0 text-[11px] text-emerald-950/60">
                {new Date(event.created_at).toLocaleString("he-IL")}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor={`edit-event-title-${event.id}`}>
                כותרת האירוע
              </label>
              <Input
                id={`edit-event-title-${event.id}`}
                value={editTitle}
                onChange={(nextEvent) => onEditTitleChange?.(nextEvent.target.value)}
                placeholder="למשל: עדכון ללקוח"
                disabled={savingEditedEvent || deletingEvent}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor={`edit-event-note-${event.id}`}>
                פירוט
              </label>
              <textarea
                id={`edit-event-note-${event.id}`}
                value={editNote}
                onChange={(nextEvent) => onEditNoteChange?.(nextEvent.target.value)}
                placeholder="פרטים נוספים שחשוב לשמור על האירוע הזה."
                className="min-h-24 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                disabled={savingEditedEvent || deletingEvent}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                onClick={onCancelEdit}
                disabled={savingEditedEvent || deletingEvent}
              >
                ביטול
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                onClick={() => onSaveEditedEvent?.(event.id)}
                disabled={savingEditedEvent || deletingEvent}
              >
                {savingEditedEvent ? "שומר..." : "שמירת שינויים"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3">
      <div className="flex items-start gap-3">
        <Avatar className="size-9 border border-border/60">
          <AvatarImage src={event.actor_avatar_url ?? undefined} alt={actorLabel} />
          <AvatarFallback className="text-xs">{getAvatarInitials(actorLabel)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{actorLabel}</div>
              <div className="text-xs text-muted-foreground">{getEventTitle(event)}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="shrink-0 text-[11px] text-muted-foreground">
                {new Date(event.created_at).toLocaleString("he-IL")}
              </div>
              {canManageEvent ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full text-emerald-950/55 hover:text-emerald-950/85"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-40">
                    <DropdownMenuItem onClick={() => onStartEdit?.(event)}>
                      <SquarePen className="size-4" />
                      עריכה
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDeleteEvent?.(event)}
                      disabled={deletingEvent}
                    >
                      <Trash2 className="size-4" />
                      מחיקה
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
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
  visitId,
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
  isEventComposerOpen = false,
  customEventTitle = "",
  customEventNote = "",
  savingCustomEvent = false,
  onToggleEventComposer,
  onCustomEventTitleChange,
  onCustomEventNoteChange,
  onCreateCustomEvent,
  activeEditEventId = null,
  editEventTitle = "",
  editEventNote = "",
  savingEditedEvent = false,
  deletingEventId = null,
  onStartEditEvent,
  onCancelEditEvent,
  onEditEventTitleChange,
  onEditEventNoteChange,
  onSaveEditedEvent,
  onDeleteEvent,
}: {
  node: TrackNode
  visitId: string
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
  isEventComposerOpen?: boolean
  customEventTitle?: string
  customEventNote?: string
  savingCustomEvent?: boolean
  onToggleEventComposer?: (visitId: string) => void
  onCustomEventTitleChange?: (value: string) => void
  onCustomEventNoteChange?: (value: string) => void
  onCreateCustomEvent?: (visitId: string) => void
  activeEditEventId?: number | null
  editEventTitle?: string
  editEventNote?: string
  savingEditedEvent?: boolean
  deletingEventId?: number | null
  onStartEditEvent?: (event: TrackStepperEvent) => void
  onCancelEditEvent?: () => void
  onEditEventTitleChange?: (value: string) => void
  onEditEventNoteChange?: (value: string) => void
  onSaveEditedEvent?: (eventId: number) => void
  onDeleteEvent?: (event: TrackStepperEvent) => void
}) {
  const canAdvance = isCurrent && node.next_nodes.length > 0 && onTransitionSelect
  const canAnnotateVisit = isCurrent || isCompleted
  const shouldShowEventsSection = events.length > 0 || canAnnotateVisit

  return (
    <div
      className={cn(
        "w-full rounded-2xl border p-5 transition-colors",
        isCurrent && "border-primary/30 bg-primary/5",
        isCompleted && "border-primary/15 bg-primary/5",
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
                <Badge variant="secondary" className="rounded-full border-primary/15 bg-primary/10 text-emerald-950/75">
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
              isCompleted && "bg-primary/10 text-emerald-950/80",
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

      {shouldShowEventsSection ? (
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-medium tracking-wide text-muted-foreground">
              אירועים בביקור הזה
            </div>
            {canAnnotateVisit && !isEventComposerOpen ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-primary/20 bg-primary/10 text-emerald-950/80 hover:bg-primary/15 hover:text-emerald-950"
                onClick={() => onToggleEventComposer?.(visitId)}
              >
                <SquarePen className="size-4" />
                הוספת אירוע
              </Button>
            ) : null}
          </div>

          {events.length > 0 ? (
            <div className="space-y-3">
              {events.map((event) => (
                <StepEventCard
                  key={event.id}
                  event={event}
                  isEditing={activeEditEventId === event.id}
                  editTitle={editEventTitle}
                  editNote={editEventNote}
                  savingEditedEvent={savingEditedEvent}
                  deletingEvent={deletingEventId === event.id}
                  onStartEdit={onStartEditEvent}
                  onCancelEdit={onCancelEditEvent}
                  onEditTitleChange={onEditEventTitleChange}
                  onEditNoteChange={onEditEventNoteChange}
                  onSaveEditedEvent={onSaveEditedEvent}
                  onDeleteEvent={onDeleteEvent}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-4 text-sm text-muted-foreground">
              עדיין לא נוספו אירועים לביקור הזה.
            </div>
          )}

          {canAnnotateVisit && isEventComposerOpen ? (
            <div className="space-y-3 rounded-xl border border-primary/15 bg-primary/5 px-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor={`event-title-${visitId}`}>
                  כותרת האירוע
                </label>
                <Input
                  id={`event-title-${visitId}`}
                  value={customEventTitle}
                  onChange={(event) => onCustomEventTitleChange?.(event.target.value)}
                  placeholder="למשל: הלקוח אישר עבודה חריגה"
                  disabled={savingCustomEvent}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor={`event-note-${visitId}`}>
                  פירוט
                </label>
                <textarea
                  id={`event-note-${visitId}`}
                  value={customEventNote}
                  onChange={(event) => onCustomEventNoteChange?.(event.target.value)}
                  placeholder="פרטים נוספים שחשוב לשמור על השלב הזה."
                  className="min-h-28 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  disabled={savingCustomEvent}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => onToggleEventComposer?.(visitId)}
                  disabled={savingCustomEvent}
                >
                  ביטול
                </Button>
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={() => onCreateCustomEvent?.(visitId)}
                  disabled={savingCustomEvent}
                >
                  {savingCustomEvent ? "מוסיף אירוע..." : "שמירת אירוע"}
                </Button>
              </div>
            </div>
          ) : null}
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
  activeEventVisitId = null,
  customEventTitle = "",
  customEventNote = "",
  savingCustomEvent = false,
  onToggleEventComposer,
  onCustomEventTitleChange,
  onCustomEventNoteChange,
  onCreateCustomEvent,
  activeEditEventId = null,
  editEventTitle = "",
  editEventNote = "",
  savingEditedEvent = false,
  deletingEventId = null,
  onStartEditEvent,
  onCancelEditEvent,
  onEditEventTitleChange,
  onEditEventNoteChange,
  onSaveEditedEvent,
  onDeleteEvent,
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
  const visits = buildTrackJourneyVisits({
    nodeIds: nodes.map((node) => node.id),
    startNodeId,
    currentNodeId,
    createdAt,
    events: orderedEvents,
  })

  const visibleVisits = visits
    .map((visit) => {
      const node = nodeMap.get(visit.nodeId)
      if (!node) return null
      return { visit, node }
    })
    .filter(
      (item): item is { visit: (typeof visits)[number]; node: TrackNode } => Boolean(item)
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
      {visibleVisits.map(({ visit, node }, index) => {
        const isLast = index === visibleVisits.length - 1
        const isCurrent = isLast
        const isCompleted = !isCurrent
        const nodeSlaSnapshot = calculateVisitSlaSnapshot({
          slaMinutes: node.sla ?? null,
          enteredAt: visit.enteredAt,
          exitedAt: visit.exitedAt,
          now,
          isCurrent,
        })

        return (
          <div key={visit.visitId} className="relative flex gap-4 pb-5 last:pb-0">
            <div className="relative flex w-10 shrink-0 justify-center">
              {!isLast ? (
                <div
                  className={cn(
                    "absolute left-1/2 top-9 h-[calc(100%-1.25rem)] -translate-x-1/2 border-l",
                    isCompleted ? "border-primary/25" : "border-border"
                  )}
                />
              ) : null}
              <div
                className={cn(
                  "relative z-10 mt-1 flex size-8 items-center justify-center rounded-full border transition-colors",
                  isCurrent && "border-primary bg-primary text-primary-foreground",
                  isCompleted && "border-primary/20 bg-primary/10 text-emerald-950/80",
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
              visitId={visit.visitId}
              events={visit.events}
              isCurrent={isCurrent}
              isCompleted={isCompleted}
              pendingTransitionId={pendingTransitionId}
              nodeElapsedMs={nodeSlaSnapshot.elapsedMs}
              nodeSlaProgress={nodeSlaSnapshot.progressPercent}
              nodeRemainingMs={nodeSlaSnapshot.remainingMs}
              isNodeOverdue={nodeSlaSnapshot.isOverdue}
              slaMode={slaMode}
              onTransitionSelect={onTransitionSelect}
              isEventComposerOpen={activeEventVisitId === visit.visitId}
              customEventTitle={customEventTitle}
              customEventNote={customEventNote}
              savingCustomEvent={savingCustomEvent}
              onToggleEventComposer={onToggleEventComposer}
              onCustomEventTitleChange={onCustomEventTitleChange}
              onCustomEventNoteChange={onCustomEventNoteChange}
              onCreateCustomEvent={onCreateCustomEvent}
              activeEditEventId={activeEditEventId}
              editEventTitle={editEventTitle}
              editEventNote={editEventNote}
              savingEditedEvent={savingEditedEvent}
              deletingEventId={deletingEventId}
              onStartEditEvent={onStartEditEvent}
              onCancelEditEvent={onCancelEditEvent}
              onEditEventTitleChange={onEditEventTitleChange}
              onEditEventNoteChange={onEditEventNoteChange}
              onSaveEditedEvent={onSaveEditedEvent}
              onDeleteEvent={onDeleteEvent}
            />
          </div>
        )
      })}
    </div>
  )
}
