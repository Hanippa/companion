import { cn } from "@/lib/utils"

export function PageBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("page-body", className)} {...props} />
  )
}

export function PageMainLayout({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("main-two-pane", className)} {...props} />
  )
}

export function PageMainRail({
  className,
  ...props
}: React.ComponentProps<"aside">) {
  return (
    <aside className={cn("main-rail", className)} {...props} />
  )
}

export function PageMainContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("main-content", className)} {...props} />
  )
}

