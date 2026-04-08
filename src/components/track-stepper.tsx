import { Check, CircleDot, GitBranch, LoaderCircle } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getAvatarInitials } from "@/lib/avatar"
import { cn } from "@/lib/utils"

export type TrackTransition = {
  id: string
  label: string
  to_step: string
}

export type TrackStep = {
  id: string
  title: string
  description?: string | null
  transitions?: TrackTransition[]
}

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
  steps: TrackStep[]
  currentStepKey: string | null
  events?: TrackStepperEvent[]
  pendingTransitionId?: string | null
  onTransitionSelect?: (transition: TrackTransition, sourceStep: TrackStep) => void
  className?: string
}

type BranchGroup = {
  sourceStepId: string
  optionIds: string[]
}

type StepItem = {
  type: "step"
  id: string
  step: TrackStep
  orderIndex: number
}

type BranchItem = {
  type: "branch"
  id: string
  sourceStep: TrackStep
  options: TrackStep[]
  orderIndex: number
}

type DisplayItem = StepItem | BranchItem

const getPayloadStepValue = (
  payload: Record<string, unknown> | null | undefined,
  key: "to_step" | "from_step" | "transition_id"
) => {
  const value = payload?.[key]
  return typeof value === "string" && value.trim() ? value : null
}

const formatEventTitle = (event: TrackStepperEvent) => {
  if (event.event_type === "created") return "הרשומה נוצרה"
  if (event.event_type === "step_changed") return "המסלול קודם"
  return event.event_type
}

const formatEventSubtitle = (event: TrackStepperEvent) => {
  const fromStep = getPayloadStepValue(event.payload, "from_step")
  const toStep = getPayloadStepValue(event.payload, "to_step")

  if (fromStep && toStep) {
    return `מעבר מ-${fromStep} אל ${toStep}`
  }

  if (toStep) {
    return `מעבר אל ${toStep}`
  }

  return new Date(event.created_at).toLocaleString("he-IL")
}

const buildBranchGroups = (steps: TrackStep[]) => {
  const stepIds = new Set(steps.map((step) => step.id))
  const groups: BranchGroup[] = []

  for (const step of steps) {
    const optionIds = (step.transitions ?? [])
      .map((transition) => transition.to_step)
      .filter((stepId, index, array) => stepIds.has(stepId) && array.indexOf(stepId) === index)

    if (optionIds.length > 1) {
      groups.push({
        sourceStepId: step.id,
        optionIds,
      })
    }
  }

  return groups
}

const buildDisplayItems = (steps: TrackStep[]) => {
  const groups = buildBranchGroups(steps)
  const groupBySource = new Map(groups.map((group) => [group.sourceStepId, group]))
  const collapsedStepIds = new Set(groups.flatMap((group) => group.optionIds))
  const stepMap = new Map(steps.map((step) => [step.id, step]))
  const items: DisplayItem[] = []

  steps.forEach((step, index) => {
    if (collapsedStepIds.has(step.id)) return

    items.push({
      type: "step",
      id: step.id,
      step,
      orderIndex: index,
    })

    const group = groupBySource.get(step.id)
    if (!group) return

    const options = group.optionIds
      .map((optionId) => stepMap.get(optionId))
      .filter((option): option is TrackStep => Boolean(option))

    if (options.length < 2) return

    items.push({
      type: "branch",
      id: `${step.id}-branch`,
      sourceStep: step,
      options,
      orderIndex: index + 0.5,
    })
  })

  return { items }
}

const resolveVisitedStepIds = (events: TrackStepperEvent[], currentStepKey: string | null) => {
  const visited = new Set<string>()

  if (currentStepKey) visited.add(currentStepKey)

  for (const event of events) {
    if (event.step_key) visited.add(event.step_key)

    const toStep = getPayloadStepValue(event.payload, "to_step")
    if (toStep) visited.add(toStep)

    const fromStep = getPayloadStepValue(event.payload, "from_step")
    if (fromStep) visited.add(fromStep)
  }

  return visited
}

const getLatestVisitedOptionId = (events: TrackStepperEvent[], optionIds: Set<string>) => {
  for (const event of events) {
    const toStep = getPayloadStepValue(event.payload, "to_step")
    if (toStep && optionIds.has(toStep)) return toStep

    if (event.step_key && optionIds.has(event.step_key)) return event.step_key
  }

  return null
}

const getStepEvents = (events: TrackStepperEvent[], stepId: string) =>
  events.filter((event) => {
    if (event.step_key === stepId) return true
    return getPayloadStepValue(event.payload, "to_step") === stepId
  })

const getBranchEvents = (events: TrackStepperEvent[], optionIds: Set<string>) =>
  events.filter((event) => {
    if (event.step_key && optionIds.has(event.step_key)) return true
    const toStep = getPayloadStepValue(event.payload, "to_step")
    return Boolean(toStep && optionIds.has(toStep))
  })

export function TrackStepper({
  steps,
  currentStepKey,
  events = [],
  pendingTransitionId = null,
  onTransitionSelect,
  className,
}: TrackStepperProps) {
  const { items } = buildDisplayItems(steps)
  const stepIndexMap = new Map(steps.map((step, index) => [step.id, index]))
  const currentIndex = currentStepKey ? (stepIndexMap.get(currentStepKey) ?? -1) : -1
  const visitedStepIds = resolveVisitedStepIds(events, currentStepKey)

  return (
    <div className={cn("space-y-0", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const isCurrent =
          item.type === "step"
            ? item.step.id === currentStepKey
            : item.options.some((option) => option.id === currentStepKey)
        const isCompleted =
          !isCurrent &&
          (item.type === "step"
            ? currentIndex > item.orderIndex
            : item.options.some((option) => visitedStepIds.has(option.id)))
        const isUpcoming = !isCurrent && !isCompleted

        return (
          <div key={item.id} className="relative flex gap-4 pb-5 last:pb-0">
            <div className="relative flex w-10 shrink-0 justify-center">
              {!isLast ? (
                <div
                  className={cn(
                    "absolute left-1/2 top-9 h-[calc(100%-1.25rem)] -translate-x-1/2 border-l",
                    isCompleted ? "border-primary/50" : "border-border"
                  )}
                />
              ) : null}
              <div
                className={cn(
                  "relative z-10 mt-1 flex size-8 items-center justify-center rounded-full border transition-colors",
                  isCurrent && "border-primary bg-primary text-primary-foreground shadow-sm",
                  isCompleted && "border-primary/30 bg-primary/10 text-primary",
                  isUpcoming && "border-border bg-white text-muted-foreground"
                )}
              >
                {item.type === "branch" ? (
                  <GitBranch className="size-4" />
                ) : isCurrent ? (
                  <CircleDot className="size-4" />
                ) : isCompleted ? (
                  <Check className="size-4" />
                ) : null}
              </div>
            </div>

            {item.type === "step" ? (
              <StepCard
                step={item.step}
                events={getStepEvents(events, item.step.id)}
                isCurrent={isCurrent}
                isCompleted={isCompleted}
                isUpcoming={isUpcoming}
                pendingTransitionId={pendingTransitionId}
                onTransitionSelect={onTransitionSelect}
              />
            ) : (
              <BranchStepCard
                sourceStep={item.sourceStep}
                options={item.options}
                currentStepKey={currentStepKey}
                events={getBranchEvents(events, new Set(item.options.map((option) => option.id)))}
                visitedStepIds={visitedStepIds}
                isCurrent={isCurrent}
                isCompleted={isCompleted}
                isUpcoming={isUpcoming}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

type StepCardProps = {
  step: TrackStep
  events: TrackStepperEvent[]
  isCurrent: boolean
  isCompleted: boolean
  isUpcoming: boolean
  pendingTransitionId: string | null
  onTransitionSelect?: (transition: TrackTransition, sourceStep: TrackStep) => void
}

function StepCard({
  step,
  events,
  isCurrent,
  isCompleted,
  isUpcoming,
  pendingTransitionId,
  onTransitionSelect,
}: StepCardProps) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-[1.4rem] border p-4 transition-colors",
        isCurrent && "border-primary/35 bg-primary/[0.055]",
        isCompleted && "border-primary/20 bg-primary/[0.035]",
        isUpcoming && "border-border/70 bg-white/94"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{step.title}</div>
          {step.description ? (
            <div className="mt-1 text-sm leading-6 text-muted-foreground">{step.description}</div>
          ) : null}
        </div>
        {isCurrent ? <Badge>נוכחי</Badge> : null}
        {isCompleted ? <Badge variant="secondary">הושלם</Badge> : null}
      </div>

      {events.length > 0 ? (
        <div className="mt-4 space-y-2">
          {events.map((event) => (
            <div key={event.id} className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar size="sm">
                    <AvatarImage src={event.actor_avatar_url ?? undefined} alt={event.actor_name ?? "משתמש"} />
                    <AvatarFallback>{getAvatarInitials(event.actor_name ?? undefined)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                  <div className="text-sm font-medium">{formatEventTitle(event)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {event.actor_name?.trim() || "משתמש לא מזוהה"}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full border-border/70 bg-white/90">
                  {new Date(event.created_at).toLocaleString("he-IL")}
                </Badge>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{formatEventSubtitle(event)}</div>
            </div>
          ))}
        </div>
      ) : null}

      {isCurrent && step.transitions && step.transitions.length > 0 && onTransitionSelect ? (
        <div className="mt-4 space-y-3">
          <div className="text-sm font-medium">המשך המסלול</div>
          <div className="flex flex-wrap gap-2">
            {step.transitions.map((transition) => {
              const isPending = pendingTransitionId === transition.id

              return (
                <Button
                  key={transition.id}
                  size="sm"
                  variant="secondary"
                  disabled={Boolean(pendingTransitionId)}
                  onClick={() => onTransitionSelect(transition, step)}
                  className="rounded-full"
                >
                  {isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  {transition.label}
                </Button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

type BranchStepCardProps = {
  sourceStep: TrackStep
  options: TrackStep[]
  currentStepKey: string | null
  events: TrackStepperEvent[]
  visitedStepIds: Set<string>
  isCurrent: boolean
  isCompleted: boolean
  isUpcoming: boolean
}

function BranchStepCard({
  sourceStep,
  options,
  currentStepKey,
  events,
  visitedStepIds,
  isCurrent,
  isCompleted,
  isUpcoming,
}: BranchStepCardProps) {
  const optionIds = new Set(options.map((option) => option.id))
  const activeOptionId =
    (currentStepKey && optionIds.has(currentStepKey) ? currentStepKey : null) ??
    getLatestVisitedOptionId(events, optionIds)

  return (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-[1.4rem] border p-4 transition-colors",
        isCurrent && "border-primary/35 bg-primary/[0.055]",
        isCompleted && "border-primary/20 bg-primary/[0.035]",
        isUpcoming && "border-border/70 bg-white/94"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">נתיב המשך</div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">
            אחרי {sourceStep.title} המסלול יכול להמשיך באחד מהנתיבים הבאים.
          </div>
        </div>
        {isCurrent ? <Badge>בבחירה פעילה</Badge> : null}
        {isCompleted ? <Badge variant="secondary">נתיב נבחר</Badge> : null}
      </div>

      {events.length > 0 ? (
        <div className="mt-4 space-y-2">
          {events.map((event) => (
            <div key={event.id} className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar size="sm">
                    <AvatarImage src={event.actor_avatar_url ?? undefined} alt={event.actor_name ?? "משתמש"} />
                    <AvatarFallback>{getAvatarInitials(event.actor_name ?? undefined)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{formatEventTitle(event)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {event.actor_name?.trim() || "משתמש לא מזוהה"}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full border-border/70 bg-white/90">
                  {new Date(event.created_at).toLocaleString("he-IL")}
                </Badge>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{formatEventSubtitle(event)}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {options.map((option) => {
          const isActive = option.id === activeOptionId
          const wasVisited = visitedStepIds.has(option.id)

          return (
            <div
              key={option.id}
              className={cn(
                "rounded-[1.1rem] border p-3 transition-colors",
                isActive && "border-primary/35 bg-primary/10",
                !isActive && wasVisited && "border-primary/20 bg-primary/[0.05]",
                !isActive && !wasVisited && "border-border/70 bg-[rgba(248,249,244,0.9)]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{option.title}</div>
                  {option.description ? (
                    <div className="mt-1 text-sm text-muted-foreground">{option.description}</div>
                  ) : null}
                </div>
                {isActive ? <Badge>נבחר</Badge> : null}
                {!isActive && wasVisited ? <Badge variant="secondary">בוצע</Badge> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
