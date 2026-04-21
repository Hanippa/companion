import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  CircleAlert,
  Info,
  FileText,
  GitBranchPlus,
  Plus,
  SaveIcon,
  Trash2,
  Workflow,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  InfoPanel,
  InfoPanelBody,
  InfoPanelHeader,
  InfoPanelSection,
} from "@/components/info-panel"
import { PageBody, PageMainContent, PageMainLayout, PageMainRail } from "@/components/page-main-layout"
import { SiteHeader } from "@/components/site-header"
import { TrackTypeGraph } from "@/components/track-type-graph"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/contexts/AuthContext"
import { getOrganizationSegment, getRecordIdFromSegment } from "@/lib/drilldown"
import { getOrganizationsCached } from "@/lib/organizations"
import {
  normalizeTrackSchema,
  type NormalizedTrackSchema,
  type TrackNode,
  type TrackNodeConnection,
} from "@/lib/track-schema"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

type Organization = { id: number; name: string | null; notes: string | null; status: string | null }

type TrackTypeRecord = {
  id: number
  name: string | null
  status: string | null
  sla: number | null
  form_schema: unknown
  track_schema: unknown
  vesrion: number | null
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

type FormSchema = {
  title?: string | null
  sections?: FormSection[]
}

const DEFAULT_TRACK_SCHEMA: NormalizedTrackSchema = {
  title: "מסלול חדש",
  description: "כאן מגדירים את שלבי המסלול ואת המעברים ביניהם.",
  start_node_id: "start",
  end_node_id: "end",
  nodes: [
    {
      id: "start",
      title: "פתיחה",
      description: "הצומת הראשון במסלול",
      sla: 15,
      sla_modifier: 0,
      next_nodes: [{ id: "start-1", node_id: "end", label: "סיום" }],
    },
    {
      id: "end",
      title: "סיום",
      description: "הצומת האחרון במסלול",
      sla: 15,
      sla_modifier: 0,
      next_nodes: [],
    },
  ],
}

const DEFAULT_FORM_SCHEMA: FormSchema = {
  title: "טופס פתיחה",
  sections: [],
}

const cloneSchema = (schema: NormalizedTrackSchema | null | undefined) =>
  JSON.parse(JSON.stringify(schema ?? DEFAULT_TRACK_SCHEMA)) as NormalizedTrackSchema

const cloneFormSchema = (schema: FormSchema | null | undefined) =>
  JSON.parse(JSON.stringify(schema ?? DEFAULT_FORM_SCHEMA)) as FormSchema

const getTrackTypeLabel = (trackType: TrackTypeRecord) =>
  trackType.name?.trim() || `סוג מסלול #${trackType.id}`

const getNodeLabel = (node: TrackNode | null | undefined) =>
  node?.title?.trim() || node?.id || "צומת"

const normalizeFormSchema = (rawSchema: unknown): FormSchema => {
  if (!rawSchema || typeof rawSchema !== "object" || Array.isArray(rawSchema)) {
    return cloneFormSchema(DEFAULT_FORM_SCHEMA)
  }

  const schema = rawSchema as FormSchema
  return {
    title: schema.title?.trim() || DEFAULT_FORM_SCHEMA.title,
    sections: Array.isArray(schema.sections)
      ? schema.sections.map((section, sectionIndex) => ({
          id: section.id?.trim() || `section_${sectionIndex + 1}`,
          title: section.title?.trim() || `מקטע ${sectionIndex + 1}`,
          fields: Array.isArray(section.fields)
            ? section.fields.map((field, fieldIndex) => ({
                id: field.id?.trim() || `field_${fieldIndex + 1}`,
                type: field.type?.trim() || "text",
                label: field.label?.trim() || `שדה ${fieldIndex + 1}`,
                required: field.required === true,
                placeholder: field.placeholder?.trim() || "",
                nodes: Array.isArray(field.nodes) ? field.nodes : undefined,
              }))
            : [],
        }))
      : [],
  }
}

const createNodeId = (schema: NormalizedTrackSchema) => {
  let index = schema.nodes.length + 1
  while (schema.nodes.some((node) => node.id === `node_${index}`)) index += 1
  return `node_${index}`
}

const createConnectionId = (node: TrackNode) => {
  let index = node.next_nodes.length + 1
  while (node.next_nodes.some((connection) => connection.id === `${node.id}-${index}`)) index += 1
  return `${node.id}-${index}`
}

const createFormSectionId = (schema: FormSchema) => {
  const sections = schema.sections ?? []
  let index = sections.length + 1
  while (sections.some((section) => section.id === `section_${index}`)) index += 1
  return `section_${index}`
}

const createFieldId = (section: FormSection) => {
  let index = section.fields.length + 1
  while (section.fields.some((field) => field.id === `field_${index}`)) index += 1
  return `field_${index}`
}

const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "טקסט קצר" },
  { value: "phone", label: "מספר טלפון" },
  { value: "textarea", label: "טקסט ארוך" },
  { value: "checkbox", label: "תיבת סימון" },
  { value: "nested_multi_select", label: "בחירה מקובצת" },
]

function InlineHelp({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-full border border-border/70 bg-muted/30 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
          aria-label={title}
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={10} className="max-w-sm rounded-2xl px-4 py-3 text-right text-sm leading-6">
        <div className="font-medium">{title}</div>
        <div className="mt-1 opacity-90">{children}</div>
      </TooltipContent>
    </Tooltip>
  )
}

export default function TrackTypesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { organizationSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)
  const [trackTypes, setTrackTypes] = useState<TrackTypeRecord[]>([])
  const [loadingTrackTypes, setLoadingTrackTypes] = useState(true)
  const [trackTypesError, setTrackTypesError] = useState<string | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [selectedTrackTypeId, setSelectedTrackTypeId] = useState("new")
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(DEFAULT_TRACK_SCHEMA.start_node_id)
  const [activeEditorTab, setActiveEditorTab] = useState("graph")
  const [draftName, setDraftName] = useState("")
  const [draftStatus, setDraftStatus] = useState("active")
  const [draftSla, setDraftSla] = useState("0")
  const [draftVersion, setDraftVersion] = useState("1")
  const [draftSchema, setDraftSchema] = useState<NormalizedTrackSchema>(cloneSchema(DEFAULT_TRACK_SCHEMA))
  const [draftFormSchema, setDraftFormSchema] = useState<FormSchema>(cloneFormSchema(DEFAULT_FORM_SCHEMA))
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let isMounted = true
    const loadOrganizations = async () => {
      setLoadingOrganizations(true)
      setOrganizationsError(null)
      try {
        const nextOrganizations = await getOrganizationsCached()
        if (!isMounted) return
        setOrganizations(nextOrganizations)
      } catch (error) {
        if (!isMounted) return
        console.error("Error loading organizations:", error)
        setOrganizations([])
        setOrganizationsError("לא הצלחנו לטעון את הארגונים שלך כרגע.")
      } finally {
        if (isMounted) setLoadingOrganizations(false)
      }
    }
    void loadOrganizations()
    return () => {
      isMounted = false
    }
  }, [])

  const selectedOrganization =
    organizations.find((organization) => organization.id === organizationIdFromRoute) ?? null

  useEffect(() => {
    let isMounted = true
    const loadTrackTypes = async () => {
      if (!selectedOrganization) {
        setTrackTypes([])
        setLoadingTrackTypes(false)
        return
      }

      setLoadingTrackTypes(true)
      setTrackTypesError(null)

      const [permissionResult, trackTypesResult] = await Promise.all([
        supabase
          .from("organization_users")
          .select("role")
          .eq("organization_id", selectedOrganization.id)
          .eq("user_id", user?.id ?? "")
          .eq("status", "active")
          .eq("role", "owner"),
        supabase
          .from("track_types")
          .select("id, name, status, sla, form_schema, track_schema, vesrion")
          .eq("organization_id", selectedOrganization.id)
          .order("name", { ascending: true, nullsFirst: false }),
      ])

      if (!isMounted) return

      setCanManage(!permissionResult.error && (permissionResult.data ?? []).length > 0)
      if (trackTypesResult.error) {
        console.error("Error loading track types:", trackTypesResult.error)
        setTrackTypes([])
        setTrackTypesError("לא הצלחנו לטעון את סוגי המסלולים של הארגון הזה.")
      } else {
        setTrackTypes((trackTypesResult.data ?? []) as TrackTypeRecord[])
      }
      setLoadingTrackTypes(false)
    }

    if (selectedOrganization) void loadTrackTypes()
    return () => {
      isMounted = false
    }
  }, [selectedOrganization, user?.id])

  useEffect(() => {
    if (loadingOrganizations || organizationsError || organizations.length === 0) return
    if (!selectedOrganization || organizationIdFromRoute === null) {
      navigate("/dashboard", { replace: true })
      return
    }
    const expectedSegment = getOrganizationSegment(selectedOrganization)
    if (expectedSegment !== organizationSlug) {
      navigate(`/${expectedSegment}/track-types`, { replace: true })
    }
  }, [
    loadingOrganizations,
    navigate,
    organizationIdFromRoute,
    organizationSlug,
    organizations,
    organizationsError,
    selectedOrganization,
  ])

  const selectedTrackType =
    trackTypes.find((trackType) => trackType.id.toString() === selectedTrackTypeId) ?? null

  const currentTrackTypeLabel =
    selectedTrackTypeId === "new"
      ? "סוג מסלול חדש"
      : selectedTrackType
        ? getTrackTypeLabel(selectedTrackType)
        : "סוג מסלול"

  useEffect(() => {
    if (selectedTrackTypeId === "new") {
      const freshSchema = cloneSchema(DEFAULT_TRACK_SCHEMA)
      setDraftName("")
      setDraftStatus("active")
      setDraftSla("0")
      setDraftVersion("1")
      setDraftSchema(freshSchema)
      setDraftFormSchema(cloneFormSchema(DEFAULT_FORM_SCHEMA))
      setSelectedNodeId(freshSchema.start_node_id)
      setSaveError(null)
      setSaveMessage(null)
      return
    }

    if (!selectedTrackType) return

    const normalized = normalizeTrackSchema(selectedTrackType.track_schema) ?? cloneSchema(DEFAULT_TRACK_SCHEMA)
    setDraftName(selectedTrackType.name?.trim() || "")
    setDraftStatus(selectedTrackType.status?.trim() || "active")
    setDraftSla(String(selectedTrackType.sla ?? 0))
    setDraftVersion(String(selectedTrackType.vesrion ?? 1))
    setDraftSchema(cloneSchema(normalized))
    setDraftFormSchema(normalizeFormSchema(selectedTrackType.form_schema ?? DEFAULT_FORM_SCHEMA))
    setSelectedNodeId(normalized.start_node_id ?? normalized.nodes[0]?.id ?? null)
    setSaveError(null)
    setSaveMessage(null)
  }, [selectedTrackType, selectedTrackTypeId])

  const organizationOptions = useMemo(
    () =>
      organizations.map((organization) => ({
        id: organization.id,
        label: organization.name?.trim() || `ארגון #${organization.id}`,
      })),
    [organizations]
  )

  const selectedNode = useMemo(
    () => draftSchema.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [draftSchema.nodes, selectedNodeId]
  )

  const formSections = draftFormSchema.sections ?? []

  const updateSchema = (updater: (current: NormalizedTrackSchema) => NormalizedTrackSchema) => {
    setDraftSchema((current) => updater(cloneSchema(current)))
  }

  const updateNode = (nodeId: string, updater: (node: TrackNode) => TrackNode) => {
    updateSchema((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? updater(node) : node)),
    }))
  }

  const updateConnection = (
    nodeId: string,
    connectionId: string,
    updater: (connection: TrackNodeConnection) => TrackNodeConnection
  ) => {
    updateNode(nodeId, (node) => ({
      ...node,
      next_nodes: node.next_nodes.map((connection) =>
        connection.id === connectionId ? updater(connection) : connection
      ),
    }))
  }

  const updateFormSchema = (updater: (current: FormSchema) => FormSchema) => {
    setDraftFormSchema((current) => updater(cloneFormSchema(current)))
  }

  const updateFormSection = (sectionId: string, updater: (section: FormSection) => FormSection) => {
    updateFormSchema((current) => ({
      ...current,
      sections: (current.sections ?? []).map((section) =>
        section.id === sectionId ? updater(section) : section
      ),
    }))
  }

  const updateFormField = (
    sectionId: string,
    fieldId: string,
    updater: (field: FormField) => FormField
  ) => {
    updateFormSection(sectionId, (section) => ({
      ...section,
      fields: section.fields.map((field) => (field.id === fieldId ? updater(field) : field)),
    }))
  }

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find((organization) => organization.id.toString() === value)
    if (!nextOrganization) return
    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const handleCreateNew = () => setSelectedTrackTypeId("new")

  const handleAddNode = () => {
    updateSchema((current) => {
      const nodeId = createNodeId(current)
      const nextNode: TrackNode = {
        id: nodeId,
        title: "שלב חדש",
        description: "",
        sla: 15,
        sla_modifier: 0,
        next_nodes: [],
      }
      setSelectedNodeId(nodeId)
      return { ...current, nodes: [...current.nodes, nextNode] }
    })
  }

  const handleRemoveNode = (nodeId: string) => {
    updateSchema((current) => {
      if (current.nodes.length <= 1) return current
      const remainingNodes = current.nodes.filter((node) => node.id !== nodeId)
      const fallbackNodeId = remainingNodes[0]?.id ?? null
      setSelectedNodeId((currentSelected) => (currentSelected === nodeId ? fallbackNodeId : currentSelected))
      return {
        ...current,
        start_node_id: current.start_node_id === nodeId ? fallbackNodeId : current.start_node_id,
        end_node_id: current.end_node_id === nodeId ? fallbackNodeId : current.end_node_id,
        nodes: remainingNodes.map((node) => ({
          ...node,
          next_nodes: node.next_nodes.filter((connection) => connection.node_id !== nodeId),
        })),
      }
    })
  }

  const handleAddConnection = () => {
    if (!selectedNode) return
    const availableTarget =
      draftSchema.nodes.find(
        (node) =>
          node.id !== selectedNode.id &&
          !selectedNode.next_nodes.some((connection) => connection.node_id === node.id)
      )?.id ?? selectedNode.id

    updateNode(selectedNode.id, (node) => ({
      ...node,
      next_nodes: [
        ...node.next_nodes,
        { id: createConnectionId(node), label: "מעבר חדש", node_id: availableTarget },
      ],
    }))
  }

  const handleRemoveConnection = (connectionId: string) => {
    if (!selectedNode) return
    updateNode(selectedNode.id, (node) => ({
      ...node,
      next_nodes: node.next_nodes.filter((connection) => connection.id !== connectionId),
    }))
  }

  const handleAddFormSection = () => {
    updateFormSchema((current) => ({
      ...current,
      sections: [
        ...(current.sections ?? []),
        {
          id: createFormSectionId(current),
          title: "מקטע חדש",
          fields: [],
        },
      ],
    }))
  }

  const handleRemoveFormSection = (sectionId: string) => {
    updateFormSchema((current) => ({
      ...current,
      sections: (current.sections ?? []).filter((section) => section.id !== sectionId),
    }))
  }

  const handleAddFormField = (sectionId: string) => {
    updateFormSection(sectionId, (section) => ({
      ...section,
      fields: [
        ...section.fields,
        {
          id: createFieldId(section),
          type: "text",
          label: "שדה חדש",
          required: false,
          placeholder: "המשתמש ימלא כאן ערך",
        },
      ],
    }))
  }

  const handleRemoveFormField = (sectionId: string, fieldId: string) => {
    updateFormSection(sectionId, (section) => ({
      ...section,
      fields: section.fields.filter((field) => field.id !== fieldId),
    }))
  }

  const handleSave = async () => {
    if (!selectedOrganization || !canManage) return

    setSaving(true)
    setSaveError(null)
    setSaveMessage(null)

    try {
      if (draftSchema.nodes.length === 0 || !draftSchema.start_node_id) {
        throw new Error("track-schema-empty")
      }

      const payload = {
        organization_id: selectedOrganization.id,
        name: draftName.trim() || null,
        status: draftStatus.trim() || "active",
        sla: Number.isFinite(Number(draftSla)) ? Number(draftSla) : 0,
        vesrion: Number.isFinite(Number(draftVersion)) ? Number(draftVersion) : 1,
        track_schema: draftSchema,
        form_schema: draftFormSchema,
      }

      if (selectedTrackTypeId === "new") {
        const { data, error } = await supabase
          .from("track_types")
          .insert(payload)
          .select("id, name, status, sla, form_schema, track_schema, vesrion")
          .single<TrackTypeRecord>()

        if (error || !data) throw error ?? new Error("insert-failed")

        setTrackTypes((current) =>
          [...current, data].sort((left, right) => (left.name ?? "").localeCompare(right.name ?? "", "he"))
        )
        setSelectedTrackTypeId(data.id.toString())
        setSaveMessage("סוג המסלול נוצר בהצלחה.")
      } else {
        const { data, error } = await supabase
          .from("track_types")
          .update(payload)
          .eq("id", Number(selectedTrackTypeId))
          .select("id, name, status, sla, form_schema, track_schema, vesrion")
          .single<TrackTypeRecord>()

        if (error || !data) throw error ?? new Error("update-failed")

        setTrackTypes((current) =>
          current
            .map((trackType) => (trackType.id === data.id ? data : trackType))
            .sort((left, right) => (left.name ?? "").localeCompare(right.name ?? "", "he"))
        )
        setSaveMessage("סוג המסלול עודכן בהצלחה.")
      }
    } catch (error) {
      console.error("Error saving track type:", error)
      if (error instanceof Error && error.message === "track-schema-empty") {
        setSaveError("מבנה המסלול חייב לכלול לפחות צומת אחד וצומת התחלה תקין.")
      } else {
        setSaveError("לא הצלחנו לשמור את סוג המסלול כרגע.")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar side="right" variant="inset" />
      <SidebarInset dir="rtl">
        <SiteHeader
          title="ניהול סוגי מסלולים"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />
        <PageBody>
          <div className="page-stack flex-1">
            {loadingOrganizations || loadingTrackTypes ? (
              <PageMainLayout>
                <PageMainContent>
                  <Skeleton className="h-[42rem] rounded-3xl" />
                </PageMainContent>
                <PageMainRail>
                  <Skeleton className="h-[42rem] rounded-3xl" />
                </PageMainRail>
              </PageMainLayout>
            ) : organizationsError ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>העמוד אינו זמין</AlertTitle>
                <AlertDescription>{organizationsError}</AlertDescription>
              </Alert>
            ) : !selectedOrganization ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>הארגון לא זמין</AlertTitle>
                <AlertDescription>לא הצלחנו לזהות את הארגון לעמוד הזה.</AlertDescription>
              </Alert>
            ) : (
              <PageMainLayout>
                <PageMainRail>
                  <InfoPanel>
                    <InfoPanelHeader
                      icon={Workflow}
                      title={draftName.trim() || "סוג מסלול חדש"}
                      description={
                        selectedTrackTypeId === "new"
                          ? "מגדירים כאן תבנית חדשה למסלולים עתידיים"
                          : "עריכת תבנית מסלול קיימת בארגון"
                      }
                      badge={
                        <Badge variant={draftStatus === "active" ? "default" : "outline"}>
                          {draftStatus === "active" ? "פעיל" : draftStatus || "לא פעיל"}
                        </Badge>
                      }
                    />
                    <InfoPanelBody>
                      <InfoPanelSection
                        className="border-primary/30 bg-primary/10 ring-1 ring-primary/35"
                        title="פרטי סוג המסלול"
                        description="הפרטים המרכזיים של סוג המסלול, כפי שיופיעו וינוהלו בארגון."
                        action={
                          <InlineHelp title="מה מגדירים כאן?">
                            כאן מגדירים את הזהות של סוג המסלול: השם שלו, הגרסה הפעילה, הסטטוס וה־SLA הכללי שממנו המסלול מתחיל.
                          </InlineHelp>
                        }
                      >
                        <div className="grid gap-3">
                          <div className="space-y-2">
                            <div className="text-sm font-medium">שם התבנית</div>
                            <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} disabled={!canManage} placeholder="למשל: תיקון מעבדה" />
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <div className="text-sm font-medium">גרסה</div>
                              <Input value={draftVersion} onChange={(event) => setDraftVersion(event.target.value)} disabled={!canManage} placeholder="1" />
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm font-medium">SLA כללי בדקות</div>
                              <Input value={draftSla} onChange={(event) => setDraftSla(event.target.value)} disabled={!canManage} type="number" min="0" placeholder="0" />
                            </div>
                          </div>
                          <div className="rounded-2xl border border-primary/20 bg-background/80 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="text-sm font-medium text-foreground">סטטוס התבנית</div>
                                <div className="text-sm text-muted-foreground">
                                  {selectedTrackTypeId === "new"
                                    ? "סוג מסלול חדש נוצר כפעיל כברירת מחדל."
                                    : draftStatus === "active"
                                      ? "התבנית זמינה לשימוש בעת יצירת מסלולים חדשים."
                                      : "התבנית מושבתת ולא אמורה לשמש לפתיחת מסלולים חדשים."}
                                </div>
                              </div>
                              <Badge variant={draftStatus === "active" ? "default" : "outline"}>
                                {draftStatus === "active" ? "פעיל" : "מושבת"}
                              </Badge>
                            </div>
                            {selectedTrackTypeId !== "new" && canManage ? (
                              <div className="mt-3">
                                <Button
                                  type="button"
                                  variant={draftStatus === "active" ? "outline" : "default"}
                                  className="rounded-xl"
                                  onClick={() => setDraftStatus((current) => (current === "active" ? "inactive" : "active"))}
                                >
                                  {draftStatus === "active" ? "השבתת סוג המסלול" : "הפעלת סוג המסלול"}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </InfoPanelSection>

                      {saveError ? <Alert variant="destructive"><AlertTitle>לא נשמר</AlertTitle><AlertDescription>{saveError}</AlertDescription></Alert> : null}
                      {saveMessage ? <Alert><AlertTitle>נשמר בהצלחה</AlertTitle><AlertDescription>{saveMessage}</AlertDescription></Alert> : null}
                      <Button onClick={handleSave} disabled={!canManage || saving} className="w-full rounded-xl"><SaveIcon className="size-4" />{saving ? "שומר..." : "שמירת סוג מסלול"}</Button>
                    </InfoPanelBody>
                  </InfoPanel>
                </PageMainRail>
                <PageMainContent className="xl:order-2">
                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="text-xl">בניית סוג מסלול</CardTitle>
                          <CardDescription>
                            בוחרים תבנית קיימת או מתחילים חדשה, ואז עובדים בשני אזורים ברורים: מפת המסלול וטופס הפתיחה.
                          </CardDescription>
                        </div>
                        {canManage ? <Button variant="outline" size="sm" className="rounded-xl" onClick={handleCreateNew}><GitBranchPlus className="size-4" />סוג מסלול חדש</Button> : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {trackTypesError ? <Alert variant="destructive"><AlertTitle>שגיאה בטעינת סוגי מסלולים</AlertTitle><AlertDescription>{trackTypesError}</AlertDescription></Alert> : null}

                      <div className="grid gap-4 rounded-3xl border border-border/70 bg-muted/20 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span>עם איזה סוג מסלול עובדים עכשיו?</span>
                            <InlineHelp title="בחירה או יצירה של סוג מסלול">
                              בחרו סוג מסלול קיים כדי לערוך אותו, או התחילו מסוג חדש. אחרי הבחירה עובדים על המפה או על טופס הפתיחה.
                            </InlineHelp>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" variant={selectedTrackTypeId === "new" ? "default" : "outline"} className="rounded-full" onClick={handleCreateNew}>סוג חדש</Button>
                            {trackTypes.map((trackType) => (
                              <Button
                                key={trackType.id}
                                type="button"
                                variant={trackType.id.toString() === selectedTrackTypeId ? "default" : "outline"}
                                className={cn("rounded-full", trackType.id.toString() !== selectedTrackTypeId && "bg-background")}
                                onClick={() => setSelectedTrackTypeId(trackType.id.toString())}
                              >
                                {getTrackTypeLabel(trackType)}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/80 p-4 text-sm leading-6 text-muted-foreground">
                              <div className="font-medium text-foreground">
                                {selectedTrackTypeId === "new" ? "כרגע אתם בונים סוג מסלול חדש" : `כרגע עורכים: ${currentTrackTypeLabel}`}
                              </div>
                          <div className="mt-2">
                            המפה משמאל מציגה את הזרימה המלאה. הסרגל הימני משמש לעריכה מדויקת של סוג המסלול ושל השלב שבחרתם.
                          </div>
                        </div>
                      </div>

                      <Tabs value={activeEditorTab} onValueChange={setActiveEditorTab} className="gap-4">
                        <TabsList className="h-auto flex-wrap gap-2 rounded-2xl bg-muted/30 p-1">
                          <TabsTrigger value="graph" className="rounded-xl px-4 py-2.5"><Workflow className="size-4" />מפת מסלול</TabsTrigger>
                          <TabsTrigger value="form" className="rounded-xl px-4 py-2.5"><FileText className="size-4" />טופס פתיחה</TabsTrigger>
                        </TabsList>

                        <TabsContent value="graph" className="space-y-4">
                          <div className="grid gap-4 rounded-3xl border border-border/70 bg-muted/20 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(14rem,0.8fr)]">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <span>מפת המסלול</span>
                                <InlineHelp title="איך עובדים עם מפת המסלול?">
                                  לחצו על שלב במפה כדי לערוך אותו בסרגל הימני. המפה מוצגת מלמעלה למטה כדי לשקף את הזרימה בפועל, משלב הפתיחה ועד שלב הסיום.
                                </InlineHelp>
                              </div>
                              <div className="text-sm leading-6 text-muted-foreground">
                                כאן בונים את הזרימה עצמה: שלבים, מעברים, נקודת פתיחה ונקודת סיום.
                              </div>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-background/80 p-4 text-sm leading-6 text-muted-foreground">
                              <div className="font-medium text-foreground">השלב הנבחר עכשיו</div>
                              <div className="mt-2">{selectedNode ? getNodeLabel(selectedNode) : "עדיין לא נבחר שלב"}</div>
                            </div>
                          </div>
                          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.9fr)]">
                            <TrackTypeGraph schema={draftSchema} highlightedNodeId={selectedNodeId} onNodeSelect={setSelectedNodeId} className="min-h-[34rem]" />

                            <Card className="border-border/70 shadow-none">
                              <CardHeader className="gap-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <CardTitle className="text-lg">
                                      {selectedNode ? `עריכת השלב: ${getNodeLabel(selectedNode)}` : "עריכת שלב"}
                                    </CardTitle>
                                    <CardDescription>
                                      {selectedNode
                                        ? "כאן מעדכנים את השלב שבחרתם מהמפה, את ה־SLA שלו ואת המעברים לשלב הבא."
                                        : "בחרו שלב מהמפה כדי לערוך אותו כאן."}
                                    </CardDescription>
                                  </div>
                                  {canManage ? (
                                    <Button variant="outline" size="sm" className="rounded-xl" onClick={handleAddNode}>
                                      <Plus className="size-4" />
                                      שלב חדש
                                    </Button>
                                  ) : null}
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                {selectedNode ? (
                                  <>
                                    <div className="grid gap-3">
                                      <div className="space-y-2">
                                        <div className="text-sm font-medium">שם השלב</div>
                                        <Input value={selectedNode.title} onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, title: event.target.value }))} disabled={!canManage} placeholder="למשל: בדיקה ראשונית" />
                                      </div>
                                      <div className="space-y-2">
                                        <div className="text-sm font-medium">מזהה פנימי</div>
                                        <Input value={selectedNode.id} onChange={(event) => {
                                          const nextId = event.target.value.trim()
                                          if (!nextId) return
                                          updateSchema((current) => ({
                                            ...current,
                                            start_node_id: current.start_node_id === selectedNode.id ? nextId : current.start_node_id,
                                            end_node_id: current.end_node_id === selectedNode.id ? nextId : current.end_node_id,
                                            nodes: current.nodes.map((node) =>
                                              node.id === selectedNode.id
                                                ? { ...node, id: nextId }
                                                : { ...node, next_nodes: node.next_nodes.map((connection) => connection.node_id === selectedNode.id ? { ...connection, node_id: nextId } : connection) }
                                            ),
                                          }))
                                          setSelectedNodeId(nextId)
                                        }} disabled={!canManage} placeholder="start_diagnostics" />
                                      </div>
                                      <div className="space-y-2">
                                        <div className="text-sm font-medium">מה קורה בשלב הזה?</div>
                                        <textarea value={selectedNode.description ?? ""} onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, description: event.target.value }))} disabled={!canManage} className="min-h-24 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" placeholder="הסבר קצר שיופיע לעורכים ויעזור להבין את מטרת השלב" />
                                      </div>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                      <div className="space-y-2">
                                        <div className="text-sm font-medium">SLA לשלב בדקות</div>
                                        <Input value={selectedNode.sla ?? 0} onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, sla: Number(event.target.value) || 0 }))} disabled={!canManage} type="number" min="0" placeholder="15" />
                                      </div>
                                      <div className="space-y-2">
                                        <div className="text-sm font-medium">תוספת SLA למסלול</div>
                                        <Input value={selectedNode.sla_modifier ?? 0} onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, sla_modifier: Number(event.target.value) || 0 }))} disabled={!canManage} type="number" min="0" placeholder="0" />
                                      </div>
                                    </div>

                                    <div className="grid gap-2 md:grid-cols-2">
                                      <Button type="button" variant="outline" className="rounded-xl" disabled={!canManage} onClick={() => updateSchema((current) => ({ ...current, start_node_id: selectedNode.id }))}>סימון כשלב פתיחה</Button>
                                      <Button type="button" variant="outline" className="rounded-xl" disabled={!canManage} onClick={() => updateSchema((current) => ({ ...current, end_node_id: selectedNode.id }))}>סימון כשלב סיום</Button>
                                    </div>

                                    <div className="space-y-3 border-t border-border/60 pt-4">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-medium">לאן אפשר להמשיך מכאן?</div>
                                        {canManage ? <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={handleAddConnection}><Plus className="size-4" />מעבר חדש</Button> : null}
                                      </div>
                                      {selectedNode.next_nodes.length === 0 ? <div className="text-sm text-muted-foreground">עדיין לא הוגדרו מעברים מהשלב הזה.</div> : <div className="space-y-3">{selectedNode.next_nodes.map((connection) => (
                                        <div key={connection.id} className="rounded-xl border border-border/60 bg-background/70 p-3">
                                          <div className="grid gap-3">
                                            <Input value={connection.label} onChange={(event) => updateConnection(selectedNode.id, connection.id, (currentConnection) => ({ ...currentConnection, label: event.target.value }))} disabled={!canManage} placeholder="שם הכפתור או המעבר" />
                                            <select className="h-10 rounded-xl border border-input bg-background px-3 text-sm" value={connection.node_id} disabled={!canManage} onChange={(event) => updateConnection(selectedNode.id, connection.id, (currentConnection) => ({ ...currentConnection, node_id: event.target.value }))}>
                                              {draftSchema.nodes.map((node) => <option key={node.id} value={node.id}>{node.title} ({node.id})</option>)}
                                            </select>
                                            {canManage ? <Button type="button" variant="ghost" className="justify-start rounded-xl text-destructive hover:text-destructive" onClick={() => handleRemoveConnection(connection.id)}><Trash2 className="size-4" />מחיקת מעבר</Button> : null}
                                          </div>
                                        </div>
                                      ))}</div>}
                                    </div>

                                    {canManage && draftSchema.nodes.length > 1 ? <Button type="button" variant="ghost" className="justify-start rounded-xl text-destructive hover:text-destructive" onClick={() => handleRemoveNode(selectedNode.id)}><Trash2 className="size-4" />מחיקת שלב</Button> : null}
                                  </>
                                ) : (
                                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                                    לחצו על אחד השלבים במפה כדי לערוך אותו כאן בצורה ממוקדת.
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        </TabsContent>

                        <TabsContent value="form" className="space-y-4">
                          <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <span>{draftFormSchema.title?.trim() || "טופס פתיחה"}</span>
                                <InlineHelp title="איך בונים את טופס הפתיחה?">
                                  מתחילים ממקטעים, מוסיפים שדות לכל מקטע, ובודקים את התצוגה המקדימה כדי להבין איך המשתמש יראה את הטופס בזמן אמת.
                                </InlineHelp>
                              </div>
                              <div className="text-sm leading-6 text-muted-foreground">כאן בונים את הטופס שאנשי הצוות ימלאו כשהם פותחים מסלול חדש.</div>
                            </div>
                            {canManage ? <Button variant="outline" className="rounded-xl" onClick={handleAddFormSection}><Plus className="size-4" />מקטע חדש</Button> : null}
                          </div>

                          <Card className="border-border/70 shadow-none">
                            <CardContent className="space-y-4 p-5">
                              <div className="space-y-2">
                                <div className="text-sm font-medium">שם הטופס שיופיע למשתמשים</div>
                                <Input value={draftFormSchema.title ?? ""} onChange={(event) => updateFormSchema((current) => ({ ...current, title: event.target.value }))} disabled={!canManage} placeholder="למשל: פתיחת טיפול במכשיר" />
                              </div>
                              {formSections.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
                                  עדיין לא נבנו מקטעים לטופס. התחילו ממקטע ראשון, ואז הוסיפו אליו שדות.
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {formSections.map((section, sectionIndex) => (
                                    <div key={`${section.id}-${sectionIndex}`} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 space-y-3">
                                          <div className="space-y-2">
                                            <div className="text-sm font-medium">שם המקטע כפי שיופיע בטופס</div>
                                            <Input
                                              value={section.title}
                                              onChange={(event) =>
                                                updateFormSection(section.id, (currentSection) => ({
                                                  ...currentSection,
                                                  title: event.target.value,
                                                }))
                                              }
                                              disabled={!canManage}
                                              placeholder="למשל: פרטי לקוח"
                                            />
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            <Badge variant="secondary" className="rounded-full">{section.fields.length} שדות</Badge>
                                          </div>
                                        </div>
                                        {canManage ? <div className="flex gap-2"><Button variant="outline" size="sm" className="rounded-xl" onClick={() => handleAddFormField(section.id)}><Plus className="size-4" />שדה</Button><Button variant="ghost" size="sm" className="rounded-xl text-destructive hover:text-destructive" onClick={() => handleRemoveFormSection(section.id)}><Trash2 className="size-4" /></Button></div> : null}
                                      </div>

                                      {section.fields.length === 0 ? (
                                        <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                                          עדיין אין שדות במקטע הזה.
                                        </div>
                                      ) : (
                                        <div className="mt-4 space-y-3">
                                          {section.fields.map((field, fieldIndex) => (
                                            <div key={`${section.id}-${field.id}-${fieldIndex}`} className="rounded-xl border border-border/60 bg-card p-4">
                                              <div className="grid gap-3 md:grid-cols-2">
                                                <div className="space-y-2">
                                                  <div className="text-sm font-medium">מה המשתמש יראה ליד השדה?</div>
                                                  <Input
                                                    value={field.label}
                                                    onChange={(event) =>
                                                      updateFormField(section.id, field.id, (currentField) => ({
                                                        ...currentField,
                                                        label: event.target.value,
                                                      }))
                                                    }
                                                    disabled={!canManage}
                                                    placeholder="למשל: מספר טלפון"
                                                  />
                                                </div>
                                                <div className="space-y-2">
                                                  <div className="text-sm font-medium">סוג השדה</div>
                                                  <select className="h-10 rounded-xl border border-input bg-background px-3 text-sm" value={field.type} disabled={!canManage} onChange={(event) => updateFormField(section.id, field.id, (currentField) => ({ ...currentField, type: event.target.value }))}>
                                                    {FIELD_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                  </select>
                                                </div>
                                                <div className="space-y-2">
                                                  <div className="text-sm font-medium">טקסט עזר בתוך השדה</div>
                                                  <Input value={field.placeholder ?? ""} onChange={(event) => updateFormField(section.id, field.id, (currentField) => ({ ...currentField, placeholder: event.target.value }))} disabled={!canManage} placeholder="למשל: הזן מספר טלפון" />
                                                </div>
                                              </div>
                                              <div className="mt-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm">
                                                <div className="font-medium text-foreground">תצוגה למשתמש</div>
                                                <div className="mt-2 text-muted-foreground">{field.label || "שדה ללא שם"}</div>
                                                {field.type === "textarea" ? (
                                                  <div className="mt-2 min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-muted-foreground">
                                                    {field.placeholder?.trim() || "המשתמש יכתוב כאן טקסט חופשי"}
                                                  </div>
                                                ) : field.type === "checkbox" ? (
                                                  <label className="mt-3 flex items-center gap-2 text-muted-foreground">
                                                    <input type="checkbox" disabled />
                                                    <span>{field.label || "אפשרות לבחירה"}</span>
                                                  </label>
                                                ) : field.type === "phone" ? (
                                                  <div className="mt-2 rounded-lg border border-input bg-background px-3 py-2 text-muted-foreground" dir="ltr">
                                                    {field.placeholder?.trim() || "050-000-0000"}
                                                  </div>
                                                ) : field.type === "nested_multi_select" ? (
                                                  <div className="mt-2 space-y-2">
                                                    {(field.nodes ?? []).length === 0 ? (
                                                      <div className="rounded-lg border border-dashed border-input bg-background px-3 py-2 text-muted-foreground">
                                                        המשתמש יבחר כאן מתוך קבוצות ואפשרויות.
                                                      </div>
                                                    ) : (
                                                      (field.nodes ?? []).map((group) => (
                                                        <div key={`${field.id}-preview-${group.id}`} className="rounded-lg border border-input bg-background px-3 py-3">
                                                          <div className="text-xs font-medium text-foreground">{group.label}</div>
                                                          <div className="mt-2 flex flex-wrap gap-2">
                                                            {(group.children ?? []).map((child) => (
                                                              <Badge key={`${group.id}-${child.id}`} variant="outline" className="rounded-full bg-background">
                                                                {child.label}
                                                              </Badge>
                                                            ))}
                                                          </div>
                                                        </div>
                                                      ))
                                                    )}
                                                  </div>
                                                ) : (
                                                  <div className="mt-2 rounded-lg border border-input bg-background px-3 py-2 text-muted-foreground">
                                                    {field.placeholder?.trim() || "המשתמש ימלא כאן ערך"}
                                                  </div>
                                                )}
                                              </div>
                                              {field.type === "nested_multi_select" ? (
                                                <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                                                  <div className="text-sm font-medium">קבוצות ואפשרויות בחירה</div>
                                                  <div className="mt-2 text-sm text-muted-foreground">
                                                    כאן מגדירים את קבוצות הבחירה ואת האפשרויות שבתוכן, לפי המבנה של `nodes`.
                                                  </div>

                                                  <div className="mt-3 space-y-3">
                                                    {canManage ? (
                                                      <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-xl"
                                                        onClick={() =>
                                                          updateFormField(section.id, field.id, (currentField) => ({
                                                            ...currentField,
                                                            nodes: [
                                                              ...(currentField.nodes ?? []),
                                                              {
                                                                id: `group_${(currentField.nodes?.length ?? 0) + 1}`,
                                                                label: "קבוצה חדשה",
                                                                children: [],
                                                              },
                                                            ],
                                                          }))
                                                        }
                                                      >
                                                        <Plus className="size-4" />
                                                        קבוצה חדשה
                                                      </Button>
                                                    ) : null}
                                                    {(field.nodes ?? []).length === 0 ? (
                                                      <div className="rounded-lg border border-dashed border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                                                        עדיין לא הוגדרו קבוצות לשדה הזה.
                                                      </div>
                                                    ) : (
                                                      (field.nodes ?? []).map((group, groupIndex) => (
                                                        <div key={`${field.id}-${group.id}-${groupIndex}`} className="rounded-xl border border-border/60 bg-background/80 p-3">
                                                          <div className="flex items-start justify-between gap-3">
                                                            <div className="grid flex-1 gap-2">
                                                              <Input
                                                                value={group.label}
                                                                onChange={(event) =>
                                                                  updateFormField(section.id, field.id, (currentField) => ({
                                                                    ...currentField,
                                                                    nodes: (currentField.nodes ?? []).map((currentGroup) =>
                                                                      currentGroup.id === group.id
                                                                        ? { ...currentGroup, label: event.target.value }
                                                                        : currentGroup
                                                                    ),
                                                                  }))
                                                                }
                                                                disabled={!canManage}
                                                                placeholder="שם הקבוצה"
                                                              />
                                                            </div>
                                                            {canManage ? (
                                                              <div className="flex gap-2">
                                                                <Button
                                                                  type="button"
                                                                  variant="outline"
                                                                  size="sm"
                                                                  className="rounded-xl"
                                                                  onClick={() =>
                                                                    updateFormField(section.id, field.id, (currentField) => ({
                                                                      ...currentField,
                                                                      nodes: (currentField.nodes ?? []).map((currentGroup) =>
                                                                        currentGroup.id === group.id
                                                                          ? {
                                                                              ...currentGroup,
                                                                              children: [
                                                                                ...(currentGroup.children ?? []),
                                                                                {
                                                                                  id: `option_${(currentGroup.children?.length ?? 0) + 1}`,
                                                                                  label: "אפשרות חדשה",
                                                                                },
                                                                              ],
                                                                            }
                                                                          : currentGroup
                                                                      ),
                                                                    }))
                                                                  }
                                                                >
                                                                  <Plus className="size-4" />
                                                                  אפשרות
                                                                </Button>
                                                                <Button
                                                                  type="button"
                                                                  variant="ghost"
                                                                  size="sm"
                                                                  className="rounded-xl text-destructive hover:text-destructive"
                                                                  onClick={() =>
                                                                    updateFormField(section.id, field.id, (currentField) => ({
                                                                      ...currentField,
                                                                      nodes: (currentField.nodes ?? []).filter((currentGroup) => currentGroup.id !== group.id),
                                                                    }))
                                                                  }
                                                                >
                                                                  <Trash2 className="size-4" />
                                                                </Button>
                                                              </div>
                                                            ) : null}
                                                          </div>
                                                          {(group.children ?? []).length === 0 ? (
                                                            <div className="mt-3 text-sm text-muted-foreground">
                                                              עדיין אין אפשרויות בקבוצה הזו.
                                                            </div>
                                                          ) : (
                                                            <div className="mt-3 space-y-2">
                                                              {(group.children ?? []).map((child, childIndex) => (
                                                                <div key={`${group.id}-${child.id}-${childIndex}`} className="grid gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 md:grid-cols-[1fr_1fr_auto]">
                                                                  <Input
                                                                    value={child.label}
                                                                    onChange={(event) =>
                                                                      updateFormField(section.id, field.id, (currentField) => ({
                                                                        ...currentField,
                                                                        nodes: (currentField.nodes ?? []).map((currentGroup) =>
                                                                          currentGroup.id === group.id
                                                                            ? {
                                                                                ...currentGroup,
                                                                                children: (currentGroup.children ?? []).map((currentChild) =>
                                                                                  currentChild.id === child.id
                                                                                    ? { ...currentChild, label: event.target.value }
                                                                                    : currentChild
                                                                                ),
                                                                              }
                                                                            : currentGroup
                                                                        ),
                                                                      }))
                                                                    }
                                                                    disabled={!canManage}
                                                                    placeholder="שם האפשרות"
                                                                  />
                                                                  {canManage ? (
                                                                    <Button
                                                                      type="button"
                                                                      variant="ghost"
                                                                      size="sm"
                                                                      className="rounded-xl text-destructive hover:text-destructive"
                                                                      onClick={() =>
                                                                        updateFormField(section.id, field.id, (currentField) => ({
                                                                          ...currentField,
                                                                          nodes: (currentField.nodes ?? []).map((currentGroup) =>
                                                                            currentGroup.id === group.id
                                                                              ? {
                                                                                  ...currentGroup,
                                                                                  children: (currentGroup.children ?? []).filter((currentChild) => currentChild.id !== child.id),
                                                                                }
                                                                              : currentGroup
                                                                          ),
                                                                        }))
                                                                      }
                                                                    >
                                                                      <Trash2 className="size-4" />
                                                                    </Button>
                                                                  ) : null}
                                                                </div>
                                                              ))}
                                                            </div>
                                                          )}
                                                        </div>
                                                      ))
                                                    )}
                                                  </div>
                                                </div>
                                              ) : null}
                                              <div className="mt-3 flex items-center justify-between gap-3">
                                                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                                  <input type="checkbox" checked={field.required === true} disabled={!canManage} onChange={(event) => updateFormField(section.id, field.id, (currentField) => ({ ...currentField, required: event.target.checked }))} />
                                                  שדה חובה
                                                </label>
                                                {canManage ? <Button variant="ghost" size="sm" className="rounded-xl text-destructive hover:text-destructive" onClick={() => handleRemoveFormField(section.id, field.id)}><Trash2 className="size-4" />מחיקת שדה</Button> : null}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </PageMainContent>
              </PageMainLayout>
            )}
          </div>
        </PageBody>
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  )
}
