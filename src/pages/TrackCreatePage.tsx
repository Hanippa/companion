import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CircleAlert, MapPinned, PlusCircle, Route, ShieldCheck } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  InfoPanel,
  InfoPanelBody,
  InfoPanelDetail,
  InfoPanelDetailList,
  InfoPanelHeader,
  InfoPanelSection,
  InfoPanelStat,
  InfoPanelStats,
} from "@/components/info-panel"
import {
  PageBody,
  PageMainContent,
  PageMainLayout,
  PageMainRail,
} from "@/components/page-main-layout"
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
import { useAuth } from "@/contexts/AuthContext"
import {
  getOrganizationSegment,
  getPointSegment,
  getRecordIdFromSegment,
  getTrackSegment,
} from "@/lib/drilldown"
import { supabase } from "@/lib/supabase"
import { normalizeTrackSchema } from "@/lib/track-schema"
import { formatMinutesLabel } from "@/lib/track-sla"
import {
  buildTrackingRecordSearchText,
  upsertTrackingRecordSearch,
} from "@/lib/tracking-record-search"

type Organization = {
  id: number
  name: string | null
  status: string | null
}

type PointRecord = {
  id: number
  organization_id: number
  name: string | null
  notes: string | null
  status: string | null
}

type FormNode = {
  id: string
  label: string
  children?: FormNode[]
}

type FormField = {
  id: string
  type: string
  label: string
  required?: boolean
  placeholder?: string
  nodes?: FormNode[]
}

type FormSection = {
  id: string
  title: string
  fields: FormField[]
}

type TrackNode = {
  id: string
  title: string
}

type TrackSchema = {
  start_node_id?: string | null
  initial_step?: string | null
  nodes?: TrackNode[]
  steps?: TrackNode[]
}

type FormSchema = {
  title?: string | null
  sections?: FormSection[]
}

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

const buildTrackName = ({
  trackType,
  point,
  refId,
}: {
  trackType: TrackType | null
  point: PointRecord | null
  refId: number
}) => {
  const trackTypeLabel = trackType?.name?.trim() || "מסלול"
  const pointLabel = point?.name?.trim() || `נקודה #${point?.id ?? "—"}`

  return `${trackTypeLabel} · ${pointLabel} · #${refId}`
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
                  <label
                    key={child.id}
                    className="flex items-center gap-3 rounded-2xl bg-background/70 px-3 py-2"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) =>
                        toggleChild(group.id, child.id, nextChecked === true)
                      }
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
  const { user } = useAuth()
  const navigate = useNavigate()
  const { organizationSlug, pointSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)
  const pointIdFromRoute = getRecordIdFromSegment(pointSlug)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [point, setPoint] = useState<PointRecord | null>(null)
  const [trackTypes, setTrackTypes] = useState<TrackType[]>([])
  const [selectedTrackTypeId, setSelectedTrackTypeId] = useState("")
  const [slaMode, setSlaMode] = useState<"derived" | "manual">("derived")
  const [trackSlaMinutes, setTrackSlaMinutes] = useState("0")
  const [formData, setFormData] = useState<Record<string, Record<string, unknown>>>({})
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingPermissions, setLoadingPermissions] = useState(true)
  const [canCreateTrack, setCanCreateTrack] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedOrganization =
    organizations.find((organization) => organization.id === organizationIdFromRoute) ?? null
  const selectedTrackType =
    trackTypes.find((trackType) => trackType.id.toString() === selectedTrackTypeId) ?? null
  const selectedTrackSchema = useMemo(
    () => normalizeTrackSchema(selectedTrackType?.track_schema),
    [selectedTrackType]
  )
  const formSections = selectedTrackType?.form_schema?.sections ?? []
  const totalRequiredFields = useMemo(
    () =>
      formSections.reduce(
        (count, section) => count + section.fields.filter((field) => field.required).length,
        0
      ),
    [formSections]
  )
  const initialStepKey = getInitialStepKey(selectedTrackType)
  const initialNodeTitle =
    selectedTrackSchema?.nodes.find((node) => node.id === initialStepKey)?.title || initialStepKey
  const currentSection = formSections[currentSectionIndex] ?? null
  const totalSections = formSections.length

  useEffect(() => {
    let isMounted = true

    const loadPage = async () => {
      if (organizationIdFromRoute === null || pointIdFromRoute === null) {
        setError("כתובת יצירת המסלול אינה תקינה.")
        setLoading(false)
        setLoadingPermissions(false)
        return
      }

      setLoading(true)
      setLoadingPermissions(true)
      setError(null)

      const [
        organizationsResult,
        pointResult,
        trackTypesResult,
        orgPermissionResult,
        pointPermissionResult,
      ] = await Promise.all([
        supabase
          .from("organizations")
          .select("id, name, status")
          .order("name", { ascending: true, nullsFirst: false }),
        supabase
          .from("points")
          .select("id, organization_id, name, notes, status")
          .eq("id", pointIdFromRoute)
          .single<PointRecord>(),
        supabase
          .from("track_types")
          .select("id, name, status, sla, form_schema, track_schema")
          .eq("organization_id", organizationIdFromRoute)
          .eq("status", "active")
          .order("name", { ascending: true, nullsFirst: false }),
        supabase
          .from("organization_users")
          .select("role")
          .eq("organization_id", organizationIdFromRoute)
          .eq("user_id", user?.id ?? "")
          .eq("status", "active")
          .in("role", ["admin", "owner"]),
        supabase
          .from("point_users")
          .select("role")
          .eq("point_id", pointIdFromRoute)
          .eq("user_id", user?.id ?? "")
          .eq("status", "active")
          .limit(1),
      ])

      if (!isMounted) return

      if (
        organizationsResult.error ||
        pointResult.error ||
        trackTypesResult.error ||
        orgPermissionResult.error ||
        pointPermissionResult.error
      ) {
        console.error("Error loading track create page:", {
          organizationsError: organizationsResult.error,
          pointError: pointResult.error,
          trackTypesError: trackTypesResult.error,
          orgPermissionError: orgPermissionResult.error,
          pointPermissionError: pointPermissionResult.error,
        })
        setError("לא הצלחנו לטעון את דף יצירת המסלול כרגע.")
        setLoading(false)
        setLoadingPermissions(false)
        return
      }

      const nextPoint = pointResult.data
      if (!nextPoint || nextPoint.organization_id !== organizationIdFromRoute) {
        setError("הנקודה הזו לא שייכת לארגון שנבחר.")
        setLoading(false)
        setLoadingPermissions(false)
        return
      }

      const nextTrackTypes = (trackTypesResult.data ?? []) as TrackType[]

      setOrganizations(organizationsResult.data ?? [])
      setPoint(nextPoint)
      setTrackTypes(nextTrackTypes)
      setCanCreateTrack(
        (orgPermissionResult.data ?? []).length > 0 ||
          (pointPermissionResult.data ?? []).length > 0
      )

      if (nextTrackTypes[0]) {
        setSelectedTrackTypeId(nextTrackTypes[0].id.toString())
        setSlaMode("derived")
        setTrackSlaMinutes(String(nextTrackTypes[0].sla ?? 0))
        setFormData(buildInitialFormData(nextTrackTypes[0]))
        setCurrentSectionIndex(0)
      }

      setLoading(false)
      setLoadingPermissions(false)
    }

    void loadPage()

    return () => {
      isMounted = false
    }
  }, [organizationIdFromRoute, pointIdFromRoute, user?.id])

  useEffect(() => {
    setFormData(buildInitialFormData(selectedTrackType))
    setSlaMode("derived")
    setTrackSlaMinutes(String(selectedTrackType?.sla ?? 0))
    setCurrentSectionIndex(0)
  }, [selectedTrackTypeId, selectedTrackType])

  const organizationOptions = organizations.map((organization) => ({
    id: organization.id,
    label: organization.name?.trim() || `Organization #${organization.id}`,
  }))

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find(
      (organization) => organization.id.toString() === value
    )
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
    for (const section of formSections) {
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
  }, [formData, formSections])

  const getSectionValidationError = (section: FormSection | null) => {
    if (!section) return null

    const sectionValues = formData[section.id] ?? {}

    for (const field of section.fields) {
      if (!field.required) continue

      const value = sectionValues[field.id]

      if (field.type === "nested_multi_select") {
        const groupedValue = value as Record<string, string[]>
        const hasSelection = Object.values(groupedValue ?? {}).some((items) => items.length > 0)
        if (!hasSelection) return `יש למלא את השדה "${field.label}" לפני שממשיכים.`
      } else if (!String(value ?? "").trim()) {
        return `יש למלא את השדה "${field.label}" לפני שממשיכים.`
      }
    }

    return null
  }

  const currentSectionValidationError = getSectionValidationError(currentSection)

  const handleNextSection = () => {
    if (!currentSection || currentSectionValidationError) {
      if (currentSectionValidationError) {
        setError(currentSectionValidationError)
      }
      return
    }

    setError(null)
    setCurrentSectionIndex((current) => Math.min(current + 1, Math.max(totalSections - 1, 0)))
  }

  const handlePreviousSection = () => {
    setError(null)
    setCurrentSectionIndex((current) => Math.max(current - 1, 0))
  }

  const handleSubmit = async () => {
    if (!point || !selectedOrganization || !selectedTrackType || !canCreateTrack) return

    if (validationError) {
      setError(validationError)
      return
    }

    const currentStep = getInitialStepKey(selectedTrackType)
    const refId = resolveRefId(formData)
    const name = buildTrackName({
      trackType: selectedTrackType,
      point,
      refId,
    })
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

    try {
      const currentNodeTitle =
        normalizeTrackSchema(selectedTrackType.track_schema)?.nodes.find(
          (node) => node.id === currentStep
        )?.title ?? currentStep

      await upsertTrackingRecordSearch({
        trackingRecordId: insertedRecord.id,
        organizationId: selectedOrganization.id,
        pointId: point.id,
        searchText: buildTrackingRecordSearchText({
          trackName: name,
          refId,
          status: "active",
          pointName: point.name,
          trackTypeName: selectedTrackType.name,
          currentStepKey: currentStep,
          currentNodeTitle,
          data: storedData,
        }),
      })
    } catch (searchError) {
      console.error("Error indexing tracking record for search:", searchError)
    }

    const trackUrl = `/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(point)}/track/${getTrackSegment({
      id: insertedRecord.id,
      name: insertedRecord.name || selectedTrackType.name || null,
    })}`

    navigate(trackUrl)
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar side="right" variant="inset" />
      <SidebarInset>
        <SiteHeader
          title="יצירת מסלול"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />

        <PageBody>
          <div className="page-stack flex-1" dir="rtl">
            {loading ? (
              <PageMainLayout>
                <PageMainRail>
                  <Skeleton className="h-[36rem] rounded-3xl" />
                </PageMainRail>
                <PageMainContent>
                  <Skeleton className="h-[36rem] rounded-3xl" />
                </PageMainContent>
              </PageMainLayout>
            ) : error && !point ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>יצירת מסלול אינה זמינה</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <PageMainLayout>
                <PageMainRail>
                  <InfoPanel>
                    <InfoPanelHeader
                      icon={PlusCircle}
                      title={selectedTrackType?.name?.trim() || "מסלול חדש"}
                      description={
                        point?.notes?.trim() ||
                        "פתיחת רשומת מסלול חדשה בתוך הנקודה שנבחרה."
                      }
                      badge={
                        <Badge
                          variant={canCreateTrack ? "default" : "outline"}
                          className="rounded-full"
                        >
                          {canCreateTrack ? "ניתן ליצירה" : "ללא הרשאה"}
                        </Badge>
                      }
                    />

                    <InfoPanelBody>
                      <InfoPanelStats>
                        <InfoPanelStat
                          icon={Route}
                          label="מקטעים בטופס"
                          value={formSections.length}
                          description="מספר אזורי הקלט שהוגדרו למסלול הזה"
                        />
                        <InfoPanelStat
                          icon={ShieldCheck}
                          label="שדות חובה"
                          value={totalRequiredFields}
                          description="שדות שחייבים מילוי לפני פתיחת הרשומה"
                        />
                        <InfoPanelStat
                          icon={MapPinned}
                          label="SLA פתיחה"
                          value={formatMinutesLabel(Number(trackSlaMinutes) || 0)}
                          description={
                            slaMode === "derived"
                              ? "המערכת תוסיף modifiers מהצמתים לאורך המסלול"
                              : "המסלול יעבוד עם SLA ידני קבוע"
                          }
                        />
                      </InfoPanelStats>

                      <InfoPanelSection title="הקשר פתיחה">
                        <InfoPanelDetailList>
                          <InfoPanelDetail
                            label="ארגון"
                            value={
                              selectedOrganization?.name?.trim() ||
                              `ארגון #${selectedOrganization?.id ?? "—"}`
                            }
                          />
                          <InfoPanelDetail
                            label="נקודה"
                            value={point?.name?.trim() || `נקודה #${point?.id ?? "—"}`}
                          />
                          <InfoPanelDetail
                            label="צומת פתיחה"
                            value={initialNodeTitle || "לא הוגדר"}
                          />
                        </InfoPanelDetailList>
                      </InfoPanelSection>

                      <InfoPanelSection title="הגדרת המסלול">
                        <div className="space-y-4">
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

                          <div className="space-y-2">
                            <div className="text-sm font-medium">מצב SLA</div>
                            <Select
                              value={slaMode}
                              onValueChange={(value: "derived" | "manual") => setSlaMode(value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="derived">
                                  Derived · SLA בסיסי עם modifiers
                                </SelectItem>
                                <SelectItem value="manual">
                                  Manual · SLA ידני ללא modifiers
                                </SelectItem>
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
                              disabled={!canCreateTrack || saving}
                            />
                            <div className="text-xs text-muted-foreground">
                              {slaMode === "derived"
                                ? "המערכת תיקח בחשבון גם SLA modifiers של צמתים קיצוניים."
                                : "המערכת תתעלם מ-sla_modifier ותשאיר את הערך הידני כמו שהוא."}
                            </div>
                          </div>
                        </div>
                      </InfoPanelSection>

                      <InfoPanelSection
                        icon={ShieldCheck}
                        title="הרשאות יצירה"
                        description={
                          canCreateTrack
                            ? "יצירת מסלולים זמינה למשתמשי הנקודה הפעילים ולמנהלי הארגון."
                            : "החשבון הזה יכול לצפות במבנה, אבל אינו מורשה לפתוח רשומות מסלול חדשות."
                        }
                      />

                      {error ? (
                        <Alert variant="destructive">
                          <CircleAlert className="size-4" />
                          <AlertTitle>לא ניתן לשמור כרגע</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      ) : null}

                      {!canCreateTrack && !loadingPermissions ? (
                        <Alert variant="destructive">
                          <CircleAlert className="size-4" />
                          <AlertTitle>אין הרשאה ליצירת מסלול</AlertTitle>
                          <AlertDescription>
                            יצירת מסלולים זמינה למשתמשי הנקודה הפעילים ולמנהלי הארגון.
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      <Button
                        className="w-full rounded-xl"
                        onClick={handleSubmit}
                        disabled={saving || !selectedTrackType || !canCreateTrack}
                      >
                        {saving ? "שומר..." : "יצירת מסלול"}
                      </Button>
                    </InfoPanelBody>
                  </InfoPanel>
                </PageMainRail>

                <PageMainContent>
                  <Card className="border-border/70 shadow-none">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Route className="size-5" />
                        טופס יצירה
                      </CardTitle>
                      <CardDescription>
                        הטופס נבנה מתוך מבנה המסלול שנבחר, כדי לשמור על התאמה מלאה בין
                        תבנית המסלול לבין המידע שנשמר ברשומה.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {!selectedTrackType ? (
                        <Alert>
                          <AlertTitle>אין סוג מסלול זמין</AlertTitle>
                          <AlertDescription>
                            לא נמצאו סוגי מסלול פעילים עבור הארגון הזה.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <>
                          <div className="rounded-3xl border border-border/60 bg-card/60 p-5">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                              <div className="space-y-1">
                                <div className="font-medium">סוג המסלול</div>
                                <div className="text-sm text-muted-foreground">
                                  בחרו קודם את סוג המסלול. הטופס למטה יתעדכן מיד לפי הבחירה.
                                </div>
                              </div>
                              <Badge variant="outline" className="rounded-full">
                                {trackTypes.length}
                              </Badge>
                            </div>

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

                          <div className="rounded-3xl border border-border/60 bg-card/60 p-5">
                            <div className="mb-5 flex flex-wrap items-center gap-2">
                              {formSections.map((section, index) => {
                                const isActive = index === currentSectionIndex
                                const isCompleted = index < currentSectionIndex

                                return (
                                  <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => setCurrentSectionIndex(index)}
                                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                                      isActive
                                        ? "border-primary bg-primary text-black"
                                        : isCompleted
                                          ? "border-primary/30 bg-primary/10 text-foreground"
                                          : "border-border/70 bg-background text-muted-foreground"
                                    }`}
                                  >
                                    {index + 1}. {section.title}
                                  </button>
                                )
                              })}
                            </div>

                            {currentSection ? (
                              <>
                                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="text-sm text-muted-foreground">
                                      שלב {currentSectionIndex + 1} מתוך {totalSections}
                                    </div>
                                    <div className="font-medium">{currentSection.title}</div>
                                    <div className="text-sm text-muted-foreground">
                                      מלאו את הפרטים של המקטע הזה ואז המשיכו לשלב הבא.
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="rounded-full">
                                    {currentSection.fields.length} שדות
                                  </Badge>
                                </div>

                                <div className="mb-5 h-2 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{
                                      width: `${((currentSectionIndex + 1) / Math.max(totalSections, 1)) * 100}%`,
                                    }}
                                  />
                                </div>

                                <div className="space-y-4">
                                  {currentSection.fields.map((field) => {
                                    const sectionValues = formData[currentSection.id] ?? {}
                                    const value = sectionValues[field.id]

                                    if (field.type === "text" || field.type === "phone") {
                                      return (
                                        <div key={field.id} className="space-y-2">
                                          <div className="text-sm font-medium">
                                            {field.label}
                                            {field.required ? (
                                              <span className="text-destructive"> *</span>
                                            ) : null}
                                          </div>
                                          <Input
                                            type={field.type === "phone" ? "tel" : "text"}
                                            value={String(value ?? "")}
                                            placeholder={field.placeholder}
                                            onChange={(event) =>
                                              handleFieldChange(
                                                currentSection.id,
                                                field.id,
                                                event.target.value
                                              )
                                            }
                                          />
                                        </div>
                                      )
                                    }

                                    if (field.type === "nested_multi_select") {
                                      return (
                                        <div key={field.id} className="space-y-2">
                                          <div className="text-sm font-medium">
                                            {field.label}
                                            {field.required ? (
                                              <span className="text-destructive"> *</span>
                                            ) : null}
                                          </div>
                                          <NestedMultiSelectField
                                            field={field}
                                            value={(value as Record<string, string[]>) ?? {}}
                                            onChange={(nextValue) =>
                                              handleFieldChange(currentSection.id, field.id, nextValue)
                                            }
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

                                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handlePreviousSection}
                                    disabled={currentSectionIndex === 0}
                                  >
                                    הקודם
                                  </Button>

                                  <div className="flex items-center gap-3">
                                    {currentSectionValidationError ? (
                                      <div className="text-sm text-destructive">
                                        כדי להמשיך, צריך להשלים את שדות החובה במקטע הזה.
                                      </div>
                                    ) : null}

                                    {currentSectionIndex < totalSections - 1 ? (
                                      <Button type="button" onClick={handleNextSection}>
                                        הבא
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        onClick={handleSubmit}
                                        disabled={saving || !selectedTrackType || !canCreateTrack}
                                      >
                                        {saving ? "שומר..." : "יצירת מסלול"}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <Alert>
                                <AlertTitle>אין שדות להצגה</AlertTitle>
                                <AlertDescription>
                                  לסוג המסלול שנבחר עדיין לא הוגדרו מקטעי טופס.
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </PageMainContent>
              </PageMainLayout>
            )}
          </div>
        </PageBody>
      </SidebarInset>
    </SidebarProvider>
  )
}

