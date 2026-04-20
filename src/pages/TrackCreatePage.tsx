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
  const trackTypeLabel = trackType?.name?.trim() || "×ž×¡×œ×•×œ"
  const pointLabel = point?.name?.trim() || `× ×§×•×“×” #${point?.id ?? "â€”"}`

  return `${trackTypeLabel} Â· ${pointLabel} Â· #${refId}`
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

  useEffect(() => {
    let isMounted = true

    const loadPage = async () => {
      if (organizationIdFromRoute === null || pointIdFromRoute === null) {
        setError("×›×ª×•×‘×ª ×™×¦×™×¨×ª ×”×ž×¡×œ×•×œ ××™× ×” ×ª×§×™× ×”.")
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
        setError("×œ× ×”×¦×œ×—× ×• ×œ×˜×¢×•×Ÿ ××ª ×“×£ ×™×¦×™×¨×ª ×”×ž×¡×œ×•×œ ×›×¨×’×¢.")
        setLoading(false)
        setLoadingPermissions(false)
        return
      }

      const nextPoint = pointResult.data
      if (!nextPoint || nextPoint.organization_id !== organizationIdFromRoute) {
        setError("×”× ×§×•×“×” ×”×–×• ×œ× ×©×™×™×›×ª ×œ××¨×’×•×Ÿ ×©× ×‘×—×¨.")
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
          if (!hasSelection) return `×™×© ×œ×ž×œ× ××ª ×”×©×“×” "${field.label}".`
        } else if (!String(value ?? "").trim()) {
          return `×™×© ×œ×ž×œ× ××ª ×”×©×“×” "${field.label}".`
        }
      }
    }

    return null
  }, [formData, formSections])

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
      setError("×œ× ×”×¦×œ×—× ×• ×œ×™×¦×•×¨ ××ª ×”×ž×¡×œ×•×œ ×›×¨×’×¢.")
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
          title="×™×¦×™×¨×ª ×ž×¡×œ×•×œ"
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
                <AlertTitle>×™×¦×™×¨×ª ×ž×¡×œ×•×œ ××™× ×” ×–×ž×™× ×”</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <PageMainLayout>
                <PageMainRail>
                  <InfoPanel>
                    <InfoPanelHeader
                      icon={PlusCircle}
                      title={selectedTrackType?.name?.trim() || "×ž×¡×œ×•×œ ×—×“×©"}
                      description={
                        point?.notes?.trim() ||
                        "×¤×ª×™×—×ª ×¨×©×•×ž×ª ×ž×¡×œ×•×œ ×—×“×©×” ×‘×ª×•×š ×”× ×§×•×“×” ×©× ×‘×—×¨×”."
                      }
                      badge={
                        <Badge
                          variant={canCreateTrack ? "default" : "outline"}
                          className="rounded-full"
                        >
                          {canCreateTrack ? "× ×™×ª×Ÿ ×œ×™×¦×™×¨×”" : "×œ×œ× ×”×¨×©××”"}
                        </Badge>
                      }
                    />

                    <InfoPanelBody>
                      <InfoPanelStats>
                        <InfoPanelStat
                          icon={Route}
                          label="×¡×§×©× ×™× ×‘×˜×•×¤×¡"
                          value={formSections.length}
                          description="×ž×¡×¤×¨ ××–×•×¨×™ ×”×§×œ×˜ ×©×”×•×’×“×¨×• ×œ×ž×¡×œ×•×œ ×”×–×”"
                        />
                        <InfoPanelStat
                          icon={ShieldCheck}
                          label="×©×“×•×ª ×—×•×‘×”"
                          value={totalRequiredFields}
                          description="×©×“×•×ª ×©×—×™×™×‘×™× ×ž×™×œ×•×™ ×œ×¤× ×™ ×¤×ª×™×—×ª ×”×¨×©×•×ž×”"
                        />
                        <InfoPanelStat
                          icon={MapPinned}
                          label="SLA ×¤×ª×™×—×”"
                          value={formatMinutesLabel(Number(trackSlaMinutes) || 0)}
                          description={
                            slaMode === "derived"
                              ? "×”×ž×¢×¨×›×ª ×ª×•×¡×™×£ modifiers ×ž×”×¦×ž×ª×™× ×œ××•×¨×š ×”×ž×¡×œ×•×œ"
                              : "×”×ž×¡×œ×•×œ ×™×¢×‘×•×“ ×¢× SLA ×™×“× ×™ ×§×‘×•×¢"
                          }
                        />
                      </InfoPanelStats>

                      <InfoPanelSection title="×”×§×©×¨ ×¤×ª×™×—×”">
                        <InfoPanelDetailList>
                          <InfoPanelDetail
                            label="××¨×’×•×Ÿ"
                            value={
                              selectedOrganization?.name?.trim() ||
                              `××¨×’×•×Ÿ #${selectedOrganization?.id ?? "â€”"}`
                            }
                          />
                          <InfoPanelDetail
                            label="× ×§×•×“×”"
                            value={point?.name?.trim() || `Point #${point?.id ?? "â€”"}`}
                          />
                          <InfoPanelDetail
                            label="×¦×•×ž×ª ×¤×ª×™×—×”"
                            value={initialNodeTitle || "×œ× ×”×•×’×“×¨"}
                          />
                        </InfoPanelDetailList>
                      </InfoPanelSection>

                      <InfoPanelSection title="×”×’×“×¨×ª ×”×ž×¡×œ×•×œ">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="text-sm font-medium">×¡×•×’ ×ž×¡×œ×•×œ</div>
                            <Select value={selectedTrackTypeId} onValueChange={setSelectedTrackTypeId}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="×‘×—×¨×• ×¡×•×’ ×ž×¡×œ×•×œ" />
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
                            <div className="text-sm font-medium">×ž×¦×‘ SLA</div>
                            <Select
                              value={slaMode}
                              onValueChange={(value: "derived" | "manual") => setSlaMode(value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="derived">
                                  Derived Â· SLA ×‘×¡×™×¡×™ ×¢× modifiers
                                </SelectItem>
                                <SelectItem value="manual">
                                  Manual Â· SLA ×™×“× ×™ ×œ×œ× modifiers
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <div className="text-sm font-medium">SLA ×œ×ž×¡×œ×•×œ (×“×§×•×ª)</div>
                            <Input
                              type="number"
                              min="0"
                              value={trackSlaMinutes}
                              onChange={(event) => setTrackSlaMinutes(event.target.value)}
                              disabled={!canCreateTrack || saving}
                            />
                            <div className="text-xs text-muted-foreground">
                              {slaMode === "derived"
                                ? "×”×ž×¢×¨×›×ª ×ª×™×§×— ×‘×—×©×‘×•×Ÿ ×’× SLA modifiers ×©×œ ×¦×ž×ª×™× ×§×™×¦×•× ×™×™×."
                                : "×”×ž×¢×¨×›×ª ×ª×ª×¢×œ× ×ž-sla_modifier ×•×ª×©××™×¨ ××ª ×”×¢×¨×š ×”×™×“× ×™ ×›×ž×• ×©×”×•×."}
                            </div>
                          </div>
                        </div>
                      </InfoPanelSection>

                      <InfoPanelSection
                        icon={ShieldCheck}
                        title="×”×¨×©××•×ª ×™×¦×™×¨×”"
                        description={
                          canCreateTrack
                            ? "×™×¦×™×¨×ª ×ž×¡×œ×•×œ×™× ×–×ž×™× ×” ×œ×ž×©×ª×ž×©×™ ×”× ×§×•×“×” ×”×¤×¢×™×œ×™× ×•×œ×ž× ×”×œ×™ ×”××¨×’×•×Ÿ."
                            : "×”×—×©×‘×•×Ÿ ×”×–×” ×™×›×•×œ ×œ×¦×¤×•×ª ×‘×ž×‘× ×”, ××‘×œ ××™× ×• ×ž×•×¨×©×” ×œ×¤×ª×•×— ×¨×©×•×ž×•×ª ×ž×¡×œ×•×œ ×—×“×©×•×ª."
                        }
                      />

                      {error ? (
                        <Alert variant="destructive">
                          <CircleAlert className="size-4" />
                          <AlertTitle>×œ× × ×™×ª×Ÿ ×œ×©×ž×•×¨ ×›×¨×’×¢</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      ) : null}

                      {!canCreateTrack && !loadingPermissions ? (
                        <Alert variant="destructive">
                          <CircleAlert className="size-4" />
                          <AlertTitle>××™×Ÿ ×”×¨×©××” ×œ×™×¦×™×¨×ª ×ž×¡×œ×•×œ</AlertTitle>
                          <AlertDescription>
                            ×™×¦×™×¨×ª ×ž×¡×œ×•×œ×™× ×–×ž×™× ×” ×œ×ž×©×ª×ž×©×™ ×”× ×§×•×“×” ×”×¤×¢×™×œ×™× ×•×œ×ž× ×”×œ×™ ×”××¨×’×•×Ÿ.
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      <Button
                        className="w-full rounded-xl"
                        onClick={handleSubmit}
                        disabled={saving || !selectedTrackType || !canCreateTrack}
                      >
                        {saving ? "×©×•×ž×¨..." : "×™×¦×™×¨×ª ×ž×¡×œ×•×œ"}
                      </Button>
                    </InfoPanelBody>
                  </InfoPanel>
                </PageMainRail>

                <PageMainContent>
                  <Card className="border-border/70 shadow-none">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Route className="size-5" />
                        ×˜×•×¤×¡ ×™×¦×™×¨×”
                      </CardTitle>
                      <CardDescription>
                        ×”×˜×•×¤×¡ × ×‘× ×” ×ž×ª×•×š ×ž×‘× ×” ×”×ž×¡×œ×•×œ ×©× ×‘×—×¨, ×›×“×™ ×œ×©×ž×•×¨ ×¢×œ ×”×ª××ž×” ×ž×œ××” ×‘×™×Ÿ
                        ×ª×‘× ×™×ª ×”×ž×¡×œ×•×œ ×œ×‘×™×Ÿ ×”×ž×™×“×¢ ×©× ×©×ž×¨ ×‘×¨×©×•×ž×”.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {!selectedTrackType ? (
                        <Alert>
                          <AlertTitle>××™×Ÿ ×¡×•×’ ×ž×¡×œ×•×œ ×–×ž×™×Ÿ</AlertTitle>
                          <AlertDescription>
                            ×œ× × ×ž×¦××• ×¡×•×’×™ ×ž×¡×œ×•×œ ×¤×¢×™×œ×™× ×¢×‘×•×¨ ×”××¨×’×•×Ÿ ×”×–×”.
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

                          {formSections.map((section) => (
                            <div
                              key={section.id}
                              className="rounded-3xl border border-border/60 bg-card/60 p-5"
                            >
                              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                <div className="font-medium">{section.title}</div>
                                <Badge variant="outline" className="rounded-full">
                                  {section.id}
                                </Badge>
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
                                              section.id,
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
                                            handleFieldChange(section.id, field.id, nextValue)
                                          }
                                        />
                                      </div>
                                    )
                                  }

                                  return (
                                    <Alert key={field.id}>
                                      <AlertTitle>×©×“×” ×œ× × ×ª×ž×š ×¢×“×™×™×Ÿ</AlertTitle>
                                      <AlertDescription>
                                        ×¡×•×’ ×”×©×“×” `{field.type}` ×¢×“×™×™×Ÿ ×œ× × ×ª×ž×š ×‘×“×£ ×”×™×¦×™×¨×”.
                                      </AlertDescription>
                                    </Alert>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
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

