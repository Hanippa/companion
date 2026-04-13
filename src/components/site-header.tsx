import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type OrganizationOption = {
  id: number
  label: string
}

interface SiteHeaderProps {
  title?: string
  organizations?: OrganizationOption[]
  selectedOrganizationId?: string
  onOrganizationChange?: (value: string) => void
}

export function SiteHeader({
  title = "Dashboard",
  organizations = [],
  selectedOrganizationId,
  onOrganizationChange,
}: SiteHeaderProps) {
  const shouldShowOrganizationPicker = organizations.length > 1 && onOrganizationChange

  const selectedOrganizationLabel =
    organizations.find((organization) => organization.id.toString() === selectedOrganizationId)
      ?.label ?? null

  return (
    <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="flex h-full w-full items-center gap-3 px-4 lg:px-6" dir="rtl">
        <SidebarTrigger className="flex size-9 items-center justify-center rounded-lg bg-card p-0 text-foreground hover:bg-accent" />
        <Separator
          orientation="vertical"
          className="data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
        />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base tracking-tight md:text-lg">
            {title}
          </h1>
        </div>

        {shouldShowOrganizationPicker ? (
          <Select value={selectedOrganizationId || undefined} onValueChange={onOrganizationChange}>
            <SelectTrigger className="h-10 w-full max-w-72 rounded-xl border-border bg-card text-right shadow-none">
              <SelectValue placeholder="בחירת ארגון" />
            </SelectTrigger>
            <SelectContent align="end" className="rounded-xl">
              {organizations.map((organization) => (
                <SelectItem key={organization.id} value={organization.id.toString()}>
                  {organization.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : selectedOrganizationLabel ? (
          <Badge variant="outline" className="max-w-64 rounded-full px-3 py-1 text-sm font-medium">
            {selectedOrganizationLabel}
          </Badge>
        ) : null}
      </div>
    </header>
  )
}
