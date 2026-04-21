import { TimerReset } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { formatMinutesLabel, formatRemainingLabel } from "@/lib/track-sla"
import { cn } from "@/lib/utils"

type TrackNodeSlaIndicatorProps = {
  slaMinutes: number | null
  elapsedMs?: number | null
  remainingMs?: number | null
  progressPercent?: number
  isOverdue?: boolean
  status: "current" | "completed" | "pending"
  className?: string
}

const formatCountdownClock = (remainingMs: number | null | undefined) => {
  if (typeof remainingMs !== "number" || !Number.isFinite(remainingMs)) {
    return null
  }

  const totalSeconds = Math.max(0, Math.ceil(Math.abs(remainingMs) / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const timeLabel = [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":")

  return days > 0 ? `${days}d ${timeLabel}` : timeLabel
}

export function TrackNodeSlaIndicator({
  slaMinutes,
  elapsedMs = null,
  remainingMs = null,
  progressPercent = 0,
  isOverdue = false,
  status,
  className,
}: TrackNodeSlaIndicatorProps) {
  if (typeof slaMinutes !== "number" || !Number.isFinite(slaMinutes) || slaMinutes <= 0) {
    return null
  }

  const clampedProgress =
    status === "pending" ? 0 : Math.max(0, Math.min(100, progressPercent))

  const countdownClock = status === "current" ? formatCountdownClock(remainingMs) : null
  const elapsedMinutesLabel =
    elapsedMs !== null ? formatMinutesLabel(Math.max(1, Math.ceil(elapsedMs / 60000))) : null

  const summaryLabel =
    status === "completed"
      ? `נמשך ${elapsedMinutesLabel ?? "לא זמין"}`
      : status === "pending"
        ? `יעד משוער: ${formatMinutesLabel(slaMinutes)}`
        : formatRemainingLabel(remainingMs)

  return (
    <div className={cn("space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline" className="gap-1 rounded-full">
          <TimerReset className="size-3.5" />
          SLA צומת: {formatMinutesLabel(slaMinutes)}
        </Badge>
        {countdownClock ? (
          <div
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
              isOverdue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            )}
          >
            {isOverdue ? "חריגה " : ""}
            {countdownClock}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-border/60">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              status === "completed" && !isOverdue && "bg-primary/80",
              status === "completed" && isOverdue && "bg-destructive/80",
              status === "pending" && "bg-muted-foreground/30",
              status === "current" && !isOverdue && "bg-primary animate-pulse",
              status === "current" && isOverdue && "bg-destructive animate-pulse"
            )}
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{summaryLabel}</span>
          <span className="tabular-nums">{Math.round(clampedProgress)}%</span>
        </div>
      </div>
    </div>
  )
}
