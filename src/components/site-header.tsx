import { Badge } from "@/components/ui/badge"
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
    organizations.find((organization) => organization.id.toString() === selectedOrganizationId)?.label ??
    null

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex h-full w-full items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger className="-ms-1" />
        <div className="h-4 w-px shrink-0 self-center bg-border" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-medium">{title}</h1>
        </div>
        {shouldShowOrganizationPicker ? (
          <Select value={selectedOrganizationId || undefined} onValueChange={onOrganizationChange}>
            <SelectTrigger className="w-full max-w-64">
              <SelectValue placeholder="Choose organization" />
            </SelectTrigger>
            <SelectContent align="end">
              {organizations.map((organization) => (
                <SelectItem key={organization.id} value={organization.id.toString()}>
                  {organization.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : selectedOrganizationLabel ? (
          <Badge variant="outline" className="max-w-64 truncate">
            {selectedOrganizationLabel}
          </Badge>
        ) : null}
      </div>
    </header>
  )
}
