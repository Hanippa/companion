import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CircleAlert, PlusCircle, Route } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  getOrganizationSegment,
  getPointSegment,
  getRecordIdFromSegment,
  getTrackSegment,
} from "@/lib/drilldown"
import { supabase } from "@/lib/supabase"
import { normalizeTrackSchema } from "@/lib/track-schema"

type Organization = { id: number; name: string | null; status: string | null }
type PointRecord = { id: number; organization_id: number; name: string | null; notes: string | null; status: string | null }
type FormNode = { id: string; label: string; children?: FormNode[] }
type FormField = {
  id: string
  type: string
  label: string
  required?: boolean
  placeholder?: string
  nodes?: FormNode[]
}
type FormSection = { id: string; title: string; fields: FormField[] }
type TrackNode = { id: string; title: string }
type TrackSchema = {
  start_node_id?: string | null
  initial_step?: string | null
  nodes?: TrackNode[]
  steps?: TrackNode[]
}
type FormSchema = { title?: string | null; sections?: FormSection[] }
type TrackType = {
  id: number
  name: string | null
  status: string | null
  sla: number | null
  form_schema: FormSchema | null
  track_schema: TrackSchema | null
}

type StoredTrackField = {
  label: string
  type: string
  value: unknown
}

type StoredTrackSection = {
  title: string
  fields: Record<string, StoredTrackField>
}

const buildInitialFormData = (trackType: TrackType | null) => {
  const data: Record<string, Record<string, unknown>> = {}
  const sections = trackType?.form_schema?.sections ?? []
  sections.forEach((section) => {
    data[section.id] = {}
    section.fields.forEach((field) => {
      data[section.id][field.id] = field.type === "nested_multi_select" ? {} : ""
    })
  })
  return data
}

const getInitialStepKey = (trackType: TrackType | null) => {
  const schema = normalizeTrackSchema(trackType?.track_schema)
  return schema?.start_node_id || schema?.nodes[0]?.id || null
}

const resolveRefId = (data: Record<string, Record<string, unknown>>) => {
  const rawValue =
    (data.sap_details?.sap_tracking_number as string | undefined) ||
    (data.sap?.sap_tracking_number as string | undefined) ||
    ""
  const digits = rawValue.replace(/\D/g, "")
  if (digits.length > 0) {
    return Number(digits.slice(0, 15))
  }
  return Date.now()
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const buildTrackName = (trackType: TrackType | null, data: Record<string, Record<string, unknown>>) => {
  const sapValue =
    (data.sap_details?.sap_tracking_number as string | undefined) ||
    (data.sap?.sap_tracking_number as string | undefined)
  if (sapValue?.trim()) {
    return `${trackType?.name?.trim() || "מסלול"} - ${sapValue.trim()}`
  }
  return trackType?.name?.trim() || "מסלול חדש"
}

const buildStoredFieldValue = (field: FormField, value: unknown) => {
  if (field.type !== "nested_multi_select") {
    return value
  }

  const groups = field.nodes ?? []
  const groupedValue = isObjectRecord(value) ? value : {}

  return groups
    .map((group) => {
      const rawItems = groupedValue[group.id]
      const selectedIds = Array.isArray(rawItems) ? rawItems.map((item) => String(item)) : []

      if (selectedIds.length === 0) return null

      const labelMap = new Map((group.children ?? []).map((child) => [child.id, child.label]))

      return {
        group_label: group.label,
        items: selectedIds.map((item) => labelMap.get(item) ?? item),
      }
    })
    .filter(Boolean)
}

const buildStoredTrackData = (
  trackType: TrackType | null,
  data: Record<string, Record<string, unknown>>
): Record<string, StoredTrackSection> => {
  const sections = trackType?.form_schema?.sections ?? []
  const storedData: Record<string, StoredTrackSection> = {}

  sections.forEach((section) => {
    const sectionValues = data[section.id] ?? {}
    const fields: Record<string, StoredTrackField> = {}

    section.fields.forEach((field) => {
      fields[field.id] = {
        label: field.label,
        type: field.type,
        value: buildStoredFieldValue(field, sectionValues[field.id]),
      }
    })

    storedData[section.id] = {
      title: section.title,
      fields,
    }
  })

  return storedData
}

function NestedMultiSelectField({
  field,
  value,
  onChange,
}: {
  field: FormField
  value: Record<string, string[]>
  onChange: (value: Record<string, string[]>) => void
}) {
  const groups = field.nodes ?? []

  const toggleChild = (groupId: string, childId: string, checked: boolean) => {
    const next = { ...value }
    const current = new Set(next[groupId] ?? [])

    if (checked) current.add(childId)
    else current.delete(childId)

    if (current.size === 0) delete next[groupId]
    else next[groupId] = Array.from(current)

    onChange(next)
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const selectedChildren = value[group.id] ?? []
        return (
          <div key={group.id} className="rounded-3xl border border-border/60 bg-card/60 p-4">
            <div className="font-medium">{group.label}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(group.children ?? []).map((child) => {
                const checked = selectedChildren.includes(child.id)
                return (
                  <label key={child.id} className="flex items-center gap-3 rounded-2xl bg-background/70 px-3 py-2">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) => toggleChild(group.id, child.id, nextChecked === true)}
                    />
                    <span className="text-sm">{child.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function TrackCreatePage() {
  const navigate = useNavigate()
  const { organizationSlug, pointSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)
  const pointIdFromRoute = getRecordIdFromSegment(pointSlug)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [point, setPoint] = useState<PointRecord | null>(null)
  const [trackTypes, setTrackTypes] = useState<TrackType[]>([])
  const [selectedTrackTypeId, setSelectedTrackTypeId] = useState<string>("")
  const [slaMode, setSlaMode] = useState<"derived" | "manual">("derived")
  const [trackSlaMinutes, setTrackSlaMinutes] = useState<string>("0")
  const [formData, setFormData] = useState<Record<string, Record<string, unknown>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedOrganization =
    organizations.find((organization) => organization.id === organizationIdFromRoute) ?? null
  const selectedTrackType =
    trackTypes.find((trackType) => trackType.id.toString() === selectedTrackTypeId) ?? null

  useEffect(() => {
    let isMounted = true

    const loadPage = async () => {
      if (organizationIdFromRoute === null || pointIdFromRoute === null) {
        setError("כתובת יצירת המסלול אינה תקינה.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const [organizationsResult, pointResult, trackTypesResult] = await Promise.all([
        supabase.from("organizations").select("id, name, status").order("name", { ascending: true, nullsFirst: false }),
        supabase.from("points").select("id, organization_id, name, notes, status").eq("id", pointIdFromRoute).single<PointRecord>(),
        supabase
          .from("track_types")
          .select("id, name, status, sla, form_schema, track_schema")
          .eq("organization_id", organizationIdFromRoute)
          .eq("status", "active")
          .order("name", { ascending: true, nullsFirst: false }),
      ])

      if (!isMounted) return

      if (organizationsResult.error || pointResult.error || trackTypesResult.error) {
        console.error("Error loading track create page:", {
          organizationsError: organizationsResult.error,
          pointError: pointResult.error,
          trackTypesError: trackTypesResult.error,
        })
        setError("לא הצלחנו לטעון את דף יצירת המסלול כרגע.")
        setLoading(false)
        return
      }

      const nextPoint = pointResult.data
      if (!nextPoint || nextPoint.organization_id !== organizationIdFromRoute) {
        setError("הנקודה הזו לא שייכת לארגון שנבחר.")
        setLoading(false)
        return
      }

      const nextTrackTypes = (trackTypesResult.data ?? []) as TrackType[]

      setOrganizations(organizationsResult.data ?? [])
      setPoint(nextPoint)
      setTrackTypes(nextTrackTypes)
      if (nextTrackTypes[0]) {
        setSelectedTrackTypeId(nextTrackTypes[0].id.toString())
        setSlaMode("derived")
        setTrackSlaMinutes(String(nextTrackTypes[0].sla ?? 0))
        setFormData(buildInitialFormData(nextTrackTypes[0]))
      }
      setLoading(false)
    }

    void loadPage()
    return () => {
      isMounted = false
    }
  }, [organizationIdFromRoute, pointIdFromRoute])

  useEffect(() => {
    setFormData(buildInitialFormData(selectedTrackType))
    setSlaMode("derived")
    setTrackSlaMinutes(String(selectedTrackType?.sla ?? 0))
  }, [selectedTrackTypeId])

  const organizationOptions = organizations.map((organization) => ({
    id: organization.id,
    label: organization.name?.trim() || `Organization #${organization.id}`,
  }))

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find((organization) => organization.id.toString() === value)
    if (!nextOrganization) return
    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const handleFieldChange = (sectionId: string, fieldId: string, value: unknown) => {
    setFormData((current) => ({
      ...current,
      [sectionId]: {
        ...(current[sectionId] ?? {}),
        [fieldId]: value,
      },
    }))
  }

  const validationError = useMemo(() => {
    const sections = selectedTrackType?.form_schema?.sections ?? []
    for (const section of sections) {
      const sectionValues = formData[section.id] ?? {}
      for (const field of section.fields) {
        if (!field.required) continue
        const value = sectionValues[field.id]
        if (field.type === "nested_multi_select") {
          const groupedValue = value as Record<string, string[]>
          const hasSelection = Object.values(groupedValue ?? {}).some((items) => items.length > 0)
          if (!hasSelection) return `יש למלא את השדה "${field.label}".`
        } else if (!String(value ?? "").trim()) {
          return `יש למלא את השדה "${field.label}".`
        }
      }
    }
    return null
  }, [formData, selectedTrackType])

  const handleSubmit = async () => {
    if (!point || !selectedOrganization || !selectedTrackType) return
    if (validationError) {
      setError(validationError)
      return
    }

    const currentStep = getInitialStepKey(selectedTrackType)
    const refId = resolveRefId(formData)
    const name = buildTrackName(selectedTrackType, formData)
    const storedData = buildStoredTrackData(selectedTrackType, formData)
    const resolvedSla = Number.isFinite(Number(trackSlaMinutes)) ? Number(trackSlaMinutes) : 0

    setSaving(true)
    setError(null)

    const { data: insertedRecord, error: insertError } = await supabase
      .from("tracking_records")
      .insert({
        ref_id: refId,
        point_id: point.id,
        track_type_id: selectedTrackType.id,
        name,
        status: "active",
        current_step: currentStep,
        sla_mode: slaMode,
        sla: resolvedSla,
        data: storedData,
      })
      .select("id, name")
      .single<{ id: number; name: string | null }>()

    if (insertError || !insertedRecord) {
      console.error("Error creating tracking record:", insertError)
      setError("לא הצלחנו ליצור את המסלול כרגע.")
      setSaving(false)
      return
    }

    await supabase.from("tracking_record_events").insert({
      tracking_record_id: insertedRecord.id,
      event_type: "general",
      step_key: currentStep,
      payload: {
        kind: "created",
        track_type_id: selectedTrackType.id,
        track_name: name,
      },
    })

    const trackUrl = `/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(point)}/track/${getTrackSegment({
      id: insertedRecord.id,
      name: insertedRecord.name || selectedTrackType.name || null,
    })}`

    navigate(trackUrl)
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as CSSProperties}>
      <AppSidebar side="right" variant="inset" tracks={[]} tracksLoading={false} />
      <SidebarInset>
        <SiteHeader
          title="יצירת מסלול"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-5 md:py-5">
              {loading ? (
                <div className="px-4 lg:px-6">
                  <Card>
                    <CardHeader><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-64" /></CardHeader>
                    <CardContent className="space-y-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </CardContent>
                  </Card>
                </div>
              ) : error && !point ? (
                <div className="px-4 lg:px-6">
                  <Alert variant="destructive">
                    <CircleAlert className="size-4" />
                    <AlertTitle>יצירת מסלול אינה זמינה</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="px-4 lg:px-6">
                  <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <Card className="xl:sticky xl:top-6 xl:h-fit">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PlusCircle className="size-5" />מסלול חדש</CardTitle>
                        <CardDescription>יצירת רשומת מסלול חדשה עבור הנקודה שנבחרה.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-3xl bg-muted/35 p-4 ring-1 ring-border/40">
                          <div className="text-sm font-medium">נקודה</div>
                          <div className="mt-2 text-sm text-muted-foreground">{point?.name?.trim() || `Point #${point?.id ?? "—"}`}</div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm font-medium">סוג מסלול</div>
                          <Select value={selectedTrackTypeId} onValueChange={setSelectedTrackTypeId}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="בחרו סוג מסלול" />
                            </SelectTrigger>
                            <SelectContent>
                              {trackTypes.map((trackType) => (
                                <SelectItem key={trackType.id} value={trackType.id.toString()}>
                                  {trackType.name?.trim() || `Track type #${trackType.id}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {normalizeTrackSchema(selectedTrackType?.track_schema)?.nodes.length ? (
                          <div className="rounded-3xl border border-dashed border-border/60 bg-background/70 p-4">
                            <div className="text-sm font-medium">צומת פתיחה</div>
                            <div className="mt-2 text-sm text-muted-foreground">
                              {normalizeTrackSchema(selectedTrackType?.track_schema)?.nodes.find((node) => node.id === getInitialStepKey(selectedTrackType))?.title ||
                                getInitialStepKey(selectedTrackType)}
                            </div>
                          </div>
                        ) : null}
                        <div className="space-y-2">
                          <div className="text-sm font-medium">מצב SLA</div>
                          <Select value={slaMode} onValueChange={(value: "derived" | "manual") => setSlaMode(value)}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="derived">Derived · SLA בסיסי עם modifiers</SelectItem>
                              <SelectItem value="manual">Manual · SLA ידני ללא modifiers</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm font-medium">SLA למסלול (דקות)</div>
                          <Input
                            type="number"
                            min="0"
                            value={trackSlaMinutes}
                            onChange={(event) => setTrackSlaMinutes(event.target.value)}
                          />
                          <div className="text-xs text-muted-foreground">
                            {slaMode === "derived"
                              ? "במצב derived המערכת תוסיף modifiers של צמתים למסלול."
                              : "במצב manual המערכת תתעלם מ־sla_modifier של הצמתים."}
                          </div>
                        </div>
                        {error ? (
                          <Alert variant="destructive">
                            <CircleAlert className="size-4" />
                            <AlertTitle>לא ניתן לשמור כרגע</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                          </Alert>
                        ) : null}
                        <Button className="w-full" onClick={handleSubmit} disabled={saving || !selectedTrackType}>
                          {saving ? "שומר..." : "יצירת מסלול"}
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Route className="size-5" />טופס יצירה</CardTitle>
                        <CardDescription>
                          הטופס נטען דינמית מתוך `form_schema` של סוג המסלול.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {!selectedTrackType ? (
                          <Alert>
                            <AlertTitle>אין סוג מסלול זמין</AlertTitle>
                            <AlertDescription>לא נמצאו סוגי מסלול פעילים עבור הארגון הזה.</AlertDescription>
                          </Alert>
                        ) : (
                          (selectedTrackType.form_schema?.sections ?? []).map((section) => (
                            <div key={section.id} className="rounded-3xl border border-border/60 bg-card/60 p-5">
                              <div className="mb-4">
                                <div className="font-medium">{section.title}</div>
                                <Badge variant="outline" className="mt-2">{section.id}</Badge>
                              </div>
                              <div className="space-y-4">
                                {section.fields.map((field) => {
                                  const sectionValues = formData[section.id] ?? {}
                                  const value = sectionValues[field.id]

                                  if (field.type === "text" || field.type === "phone") {
                                    return (
                                      <div key={field.id} className="space-y-2">
                                        <div className="text-sm font-medium">
                                          {field.label}
                                          {field.required ? <span className="text-destructive"> *</span> : null}
                                        </div>
                                        <Input
                                          type={field.type === "phone" ? "tel" : "text"}
                                          value={String(value ?? "")}
                                          placeholder={field.placeholder}
                                          onChange={(event) => handleFieldChange(section.id, field.id, event.target.value)}
                                        />
                                      </div>
                                    )
                                  }

                                  if (field.type === "nested_multi_select") {
                                    return (
                                      <div key={field.id} className="space-y-2">
                                        <div className="text-sm font-medium">
                                          {field.label}
                                          {field.required ? <span className="text-destructive"> *</span> : null}
                                        </div>
                                        <NestedMultiSelectField
                                          field={field}
                                          value={(value as Record<string, string[]>) ?? {}}
                                          onChange={(nextValue) => handleFieldChange(section.id, field.id, nextValue)}
                                        />
                                      </div>
                                    )
                                  }

                                  return (
                                    <Alert key={field.id}>
                                      <AlertTitle>שדה לא נתמך עדיין</AlertTitle>
                                      <AlertDescription>
                                        סוג השדה `{field.type}` עדיין לא נתמך בדף היצירה.
                                      </AlertDescription>
                                    </Alert>
                                  )
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
