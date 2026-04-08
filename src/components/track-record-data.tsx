import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

type StoredTrackField = {
  label?: string | null
  type?: string | null
  value: unknown
}

type StoredTrackSection = {
  title?: string | null
  fields?: Record<string, StoredTrackField>
}

type TrackRecordDataProps = {
  data: Record<string, unknown> | null | undefined
  compact?: boolean
}

export function TrackRecordData({ data, compact = false }: TrackRecordDataProps) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <Alert>
        <AlertTitle>אין מידע שמור</AlertTitle>
        <AlertDescription>לרשומת המסלול הזו עדיין אין נתונים שמורים.</AlertDescription>
      </Alert>
    )
  }

  const storedSections = Object.entries(data)
    .map(([sectionKey, value]) => {
      if (!isStoredSection(value)) {
        return null
      }

      const visibleFields = Object.entries(value.fields ?? {})
        .filter(([, field]) => hasDisplayValue(field?.value))
        .map(([fieldKey, field]) => ({
          key: fieldKey,
          label: field.label?.trim() || fieldKey,
          type: field.type ?? null,
          value: field.value,
        }))

      if (visibleFields.length === 0) {
        return null
      }

      return {
        key: sectionKey,
        title: value.title?.trim() || sectionKey,
        fields: visibleFields,
      }
    })
    .filter(
      (
        section
      ): section is {
        key: string
        title: string
        fields: { key: string; label: string; type: string | null; value: unknown }[]
      } => Boolean(section)
    )

  if (storedSections.length === 0) {
    return <GenericDataFallback data={data} compact={compact} />
  }

  return compact ? (
    <div className="space-y-5">
      {storedSections.map((section) => (
        <div key={section.key} className="space-y-3">
          <div className="border-b border-border/50 pb-2">
            <div className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
              {section.title}
            </div>
          </div>
          <div className="space-y-3">
            {section.fields.map((field) => (
              <CompactFieldRow key={field.key} label={field.label} value={field.value} />
            ))}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="space-y-4">
      {storedSections.map((section) => (
        <div key={section.key} className="rounded-3xl border border-border/60 bg-card/60 p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="font-medium">{section.title}</div>
            <Badge variant="outline">{section.key}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {section.fields.map((field) => (
              <div key={field.key} className="rounded-2xl border border-border/50 bg-background/70 p-4">
                <div className="text-sm font-medium">{field.label}</div>
                <div className="mt-3">{renderValue(field.value, false)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function CompactFieldRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {renderValue(value, true)}
    </div>
  )
}

function renderValue(value: unknown, compact: boolean) {
  if (isGroupedList(value)) {
    return (
      <div className={compact ? "space-y-2" : "space-y-3"}>
        {value.map((group, index) => (
          <div
            key={`${group.group_label}-${index}`}
            className={compact ? "rounded-2xl bg-muted/35 px-3 py-2.5" : "rounded-2xl border border-border/50 bg-background/70 p-4"}
          >
            <div className="text-[11px] font-medium text-muted-foreground">{group.group_label}</div>
            <div className="mt-1.5 text-sm leading-6 text-foreground">{group.items.join(", ")}</div>
          </div>
        ))}
      </div>
    )
  }

  if (Array.isArray(value)) {
    return <div className="text-sm leading-6 text-foreground">{value.map((item) => formatScalarValue(item)).join(", ")}</div>
  }

  if (isObjectRecord(value)) {
    return compact ? (
      <div className="space-y-2">
        {Object.entries(value).map(([key, nestedValue]) => (
          <div key={key} className="rounded-2xl bg-muted/35 px-3 py-2.5">
            <div className="text-[11px] font-medium text-muted-foreground">{key}</div>
            <div className="mt-1.5 text-sm leading-6 text-foreground">{formatScalarValue(nestedValue)}</div>
          </div>
        ))}
      </div>
    ) : (
      <div className="space-y-3">
        {Object.entries(value).map(([key, nestedValue]) => (
          <div key={key} className="rounded-2xl border border-border/50 bg-background/70 p-4">
            <div className="text-sm font-medium">{key}</div>
            <div className="mt-2 text-sm leading-6 text-muted-foreground">{formatScalarValue(nestedValue)}</div>
          </div>
        ))}
      </div>
    )
  }

  return <div className={compact ? "text-sm leading-6 text-foreground" : "text-sm leading-6 text-muted-foreground"}>{formatScalarValue(value)}</div>
}

function GenericDataFallback({ data, compact = false }: { data: Record<string, unknown>; compact?: boolean }) {
  return compact ? (
    <div className="space-y-4">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="space-y-2">
          <div className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">{key}</div>
          {renderValue(value, true)}
        </div>
      ))}
    </div>
  ) : (
    <div className="space-y-4">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="rounded-3xl border border-border/60 bg-card/60 p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="font-medium">{key}</div>
            <Badge variant="outline">כללי</Badge>
          </div>
          {renderValue(value, false)}
        </div>
      ))}
    </div>
  )
}

function formatScalarValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—"
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatScalarValue(item)).join(", ")
  }

  if (isObjectRecord(value)) {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${key}: ${formatScalarValue(nestedValue)}`)
      .join(" • ")
  }

  return String(value)
}

function hasDisplayValue(value: unknown) {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (isObjectRecord(value)) return Object.keys(value).length > 0
  return true
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStoredTrackField(value: unknown): value is StoredTrackField {
  return isObjectRecord(value) && "value" in value
}

function isStoredSection(value: unknown): value is StoredTrackSection {
  if (!isObjectRecord(value) || !isObjectRecord(value.fields)) {
    return false
  }

  return Object.values(value.fields).every((field) => isStoredTrackField(field))
}

function isGroupedList(value: unknown): value is Array<{ group_label: string; items: string[] }> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isObjectRecord(item) &&
        typeof item.group_label === "string" &&
        Array.isArray(item.items)
    )
  )
}
