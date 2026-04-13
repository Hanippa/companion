import type { LucideIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function InfoPanel({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-border/70 shadow-none xl:sticky xl:top-24 xl:h-fit",
        className
      )}
      {...props}
    />
  )
}

export function InfoPanelBody({
  className,
  ...props
}: React.ComponentProps<typeof CardContent>) {
  return <CardContent className={cn("space-y-5", className)} {...props} />
}

export function InfoPanelHeader({
  icon: Icon,
  title,
  description,
  badge,
  className,
}: {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  badge?: React.ReactNode
  className?: string
}) {
  return (
    <CardHeader className={cn("gap-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-2xl">
            {Icon ? <Icon className="size-5 text-muted-foreground" /> : null}
            <span>{title}</span>
          </CardTitle>
          {description ? (
            <CardDescription className="leading-7">{description}</CardDescription>
          ) : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
    </CardHeader>
  )
}

export function InfoPanelStats({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-1", className)}
      {...props}
    />
  )
}

export function InfoPanelStat({
  icon: Icon,
  label,
  value,
  description,
  className,
}: {
  icon?: LucideIcon
  label: React.ReactNode
  value: React.ReactNode
  description?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-muted/20 px-4 py-3.5",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon ? <Icon className="size-4" /> : null}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {description ? (
        <div className="mt-1 text-xs text-muted-foreground">{description}</div>
      ) : null}
    </div>
  )
}

export function InfoPanelSection({
  icon: Icon,
  title,
  description,
  action,
  className,
  children,
}: React.ComponentProps<"div"> & {
  icon?: LucideIcon
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      className={cn("rounded-xl border border-border/60 bg-muted/20 p-4", className)}
    >
      {title || description || action ? (
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            {title ? (
              <div className="flex items-center gap-2 text-sm font-medium">
                {Icon ? <Icon className="size-4 text-primary" /> : null}
                <span>{title}</span>
              </div>
            ) : null}
            {description ? (
              <div className="text-sm text-muted-foreground">{description}</div>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children ? <div className={cn(title || description ? "mt-3" : "")}>{children}</div> : null}
    </div>
  )
}

export function InfoPanelDetailList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("space-y-2", className)} {...props} />
}

export function InfoPanelDetail({
  label,
  value,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 text-sm", className)}>
      <div className="text-muted-foreground">{label}</div>
      <div className="text-right font-medium">{value}</div>
    </div>
  )
}
