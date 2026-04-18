import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CircleAlert, GitBranchPlus, Plus, SaveIcon, Trash2, Workflow } from "lucide-react"

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
import { useAuth } from "@/contexts/AuthContext"
import { getOrganizationSegment, getRecordIdFromSegment } from "@/lib/drilldown"
import { getOrganizationsCached } from "@/lib/organizations"
import {
  normalizeTrackSchema,
  type NormalizedTrackSchema,
  type TrackNode,
  type TrackNodeConnection,
} from "@/lib/track-schema"
import { formatMinutesLabel } from "@/lib/track-sla"
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

const DEFAULT_TRACK_SCHEMA: NormalizedTrackSchema = {
  title: "מסלול חדש",
  description: "הגדירו כאן את צמתי המסלול והמעברים ביניהם.",
  start_node_id: "start",
  end_node_id: "end",
  nodes: [
    {
      id: "start",
      title: "התחלה",
      description: "צומת פתיחה ראשוני",
      sla: 15,
      sla_modifier: 0,
      next_nodes: [{ id: "start-1", node_id: "end", label: "סיום" }],
    },
    {
      id: "end",
      title: "סיום",
      description: "צומת סיום",
      sla: 15,
      sla_modifier: 0,
      next_nodes: [],
    },
  ],
}

const DEFAULT_FORM_SCHEMA = { title: "טופס פתיחה", sections: [] }

const cloneSchema = (schema: NormalizedTrackSchema | null | undefined) =>
  JSON.parse(JSON.stringify(schema ?? DEFAULT_TRACK_SCHEMA)) as NormalizedTrackSchema
const stringifyJson = (value: unknown) => JSON.stringify(value, null, 2)
const parseJson = (value: string) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
const getTrackTypeLabel = (trackType: TrackTypeRecord) => trackType.name?.trim() || `סוג מסלול #${trackType.id}`
const getNodeLabel = (node: TrackNode | null | undefined) => node?.title?.trim() || node?.id || "צומת"
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
  const [draftName, setDraftName] = useState("")
  const [draftStatus, setDraftStatus] = useState("active")
  const [draftSla, setDraftSla] = useState("0")
  const [draftVersion, setDraftVersion] = useState("1")
  const [draftSchema, setDraftSchema] = useState<NormalizedTrackSchema>(cloneSchema(DEFAULT_TRACK_SCHEMA))
  const [draftFormSchema, setDraftFormSchema] = useState(stringifyJson(DEFAULT_FORM_SCHEMA))
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
    if (expectedSegment !== organizationSlug) navigate(`/${expectedSegment}/track-types`, { replace: true })
  }, [loadingOrganizations, navigate, organizationIdFromRoute, organizationSlug, organizations, organizationsError, selectedOrganization])

  const selectedTrackType =
    trackTypes.find((trackType) => trackType.id.toString() === selectedTrackTypeId) ?? null

  useEffect(() => {
    if (selectedTrackTypeId === "new") {
      const freshSchema = cloneSchema(DEFAULT_TRACK_SCHEMA)
      setDraftName("")
      setDraftStatus("active")
      setDraftSla("0")
      setDraftVersion("1")
      setDraftSchema(freshSchema)
      setDraftFormSchema(stringifyJson(DEFAULT_FORM_SCHEMA))
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
    setDraftFormSchema(stringifyJson(selectedTrackType.form_schema ?? DEFAULT_FORM_SCHEMA))
    setSelectedNodeId(normalized.start_node_id ?? normalized.nodes[0]?.id ?? null)
    setSaveError(null)
    setSaveMessage(null)
  }, [selectedTrackType, selectedTrackTypeId])

  const organizationOptions = useMemo(
    () => organizations.map((organization) => ({ id: organization.id, label: organization.name?.trim() || `ארגון #${organization.id}` })),
    [organizations]
  )
  const selectedNode = useMemo(() => draftSchema.nodes.find((node) => node.id === selectedNodeId) ?? null, [draftSchema.nodes, selectedNodeId])
  const parsedFormSchema = useMemo(() => parseJson(draftFormSchema), [draftFormSchema])
  const totalConnections = useMemo(() => draftSchema.nodes.reduce((sum, node) => sum + node.next_nodes.length, 0), [draftSchema.nodes])

  const updateSchema = (updater: (current: NormalizedTrackSchema) => NormalizedTrackSchema) => {
    setDraftSchema((current) => updater(cloneSchema(current)))
  }
  const updateNode = (nodeId: string, updater: (node: TrackNode) => TrackNode) => {
    updateSchema((current) => ({ ...current, nodes: current.nodes.map((node) => (node.id === nodeId ? updater(node) : node)) }))
  }
  const updateConnection = (nodeId: string, connectionId: string, updater: (connection: TrackNodeConnection) => TrackNodeConnection) => {
    updateNode(nodeId, (node) => ({ ...node, next_nodes: node.next_nodes.map((connection) => (connection.id === connectionId ? updater(connection) : connection)) }))
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
        title: "צומת חדש",
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

  const handleSave = async () => {
    if (!selectedOrganization || !canManage) return
    setSaving(true)
    setSaveError(null)
    setSaveMessage(null)
    try {
      if (draftSchema.nodes.length === 0 || !draftSchema.start_node_id) throw new Error("track-schema-empty")
      if (!parsedFormSchema) throw new Error("form-schema-invalid")

      const payload = {
        organization_id: selectedOrganization.id,
        name: draftName.trim() || null,
        status: draftStatus.trim() || "active",
        sla: Number.isFinite(Number(draftSla)) ? Number(draftSla) : 0,
        vesrion: Number.isFinite(Number(draftVersion)) ? Number(draftVersion) : 1,
        track_schema: draftSchema,
        form_schema: parsedFormSchema,
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
      if (error instanceof Error && error.message === "form-schema-invalid") {
        setSaveError("ה־JSON של טופס היצירה אינו תקין.")
      } else if (error instanceof Error && error.message === "track-schema-empty") {
        setSaveError("מבנה המסלול חייב לכלול לפחות צומת אחד וצומת התחלה תקין.")
      } else {
        setSaveError("לא הצלחנו לשמור את סוג המסלול כרגע.")
      }
    } finally {
      setSaving(false)
    }
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
                <PageMainRail className="xl:order-1">
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
                      description={draftSchema.description?.trim() || "תבנית מסלול ארגונית"}
                      badge={
                        <Badge variant={draftStatus === "active" ? "default" : "outline"}>
                          {draftStatus === "active" ? "פעיל" : draftStatus || "לא פעיל"}
                        </Badge>
                      }
                    />
                    <InfoPanelBody>
                      <InfoPanelStats>
                        <InfoPanelStat label="צמתים" value={draftSchema.nodes.length} description="מספר הצמתים בתבנית" />
                        <InfoPanelStat label="חיבורים" value={totalConnections} description="מעברים אפשריים בין הצמתים" />
                        <InfoPanelStat label="SLA ברירת מחדל" value={formatMinutesLabel(Number(draftSla) || 0)} description="משך היעד למסלול לפני modifiers" />
                      </InfoPanelStats>

                      <InfoPanelSection title="פרטי סוג מסלול">
                        <div className="grid gap-3">
                          <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} disabled={!canManage} placeholder="שם סוג המסלול" />
                          <Input value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)} disabled={!canManage} placeholder="סטטוס" />
                          <Input value={draftSla} onChange={(event) => setDraftSla(event.target.value)} disabled={!canManage} type="number" min="0" placeholder="SLA בדקות" />
                          <Input value={draftVersion} onChange={(event) => setDraftVersion(event.target.value)} disabled={!canManage} placeholder="גרסה" />
                        </div>
                      </InfoPanelSection>

                      <InfoPanelSection title="צמתים מרכזיים">
                        <InfoPanelDetailList>
                          <InfoPanelDetail label="צומת התחלה" value={getNodeLabel(draftSchema.nodes.find((node) => node.id === draftSchema.start_node_id)) || "לא הוגדר"} />
                          <InfoPanelDetail label="צומת סיום" value={getNodeLabel(draftSchema.nodes.find((node) => node.id === draftSchema.end_node_id)) || "לא הוגדר"} />
                        </InfoPanelDetailList>
                      </InfoPanelSection>

                      <InfoPanelSection
                        title={selectedNode ? "הצומת הנבחר" : "בחירת צומת"}
                        description={selectedNode ? "כאן אפשר לעדכן את הצומת ולנהל את המעברים היוצאים ממנו." : "בחרו צומת מהמפה כדי לערוך אותו."}
                        action={
                          canManage ? (
                            <Button variant="outline" size="sm" className="rounded-xl" onClick={handleAddNode}>
                              <Plus className="size-4" />
                              צומת חדש
                            </Button>
                          ) : null
                        }
                      >
                        {selectedNode ? (
                          <div className="space-y-4">
                            <div className="grid gap-3">
                              <Input
                                value={selectedNode.id}
                                onChange={(event) => {
                                  const nextId = event.target.value.trim()
                                  if (!nextId) return
                                  updateSchema((current) => ({
                                    ...current,
                                    start_node_id: current.start_node_id === selectedNode.id ? nextId : current.start_node_id,
                                    end_node_id: current.end_node_id === selectedNode.id ? nextId : current.end_node_id,
                                    nodes: current.nodes.map((node) =>
                                      node.id === selectedNode.id
                                        ? { ...node, id: nextId }
                                        : {
                                            ...node,
                                            next_nodes: node.next_nodes.map((connection) =>
                                              connection.node_id === selectedNode.id ? { ...connection, node_id: nextId } : connection
                                            ),
                                          }
                                    ),
                                  }))
                                  setSelectedNodeId(nextId)
                                }}
                                disabled={!canManage}
                                placeholder="מזהה צומת"
                              />
                              <Input value={selectedNode.title} onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, title: event.target.value }))} disabled={!canManage} placeholder="כותרת הצומת" />
                              <textarea
                                value={selectedNode.description ?? ""}
                                onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, description: event.target.value }))}
                                disabled={!canManage}
                                className="min-h-24 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                                placeholder="תיאור הצומת"
                              />
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <Input value={selectedNode.sla ?? 0} onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, sla: Number(event.target.value) || 0 }))} disabled={!canManage} type="number" min="0" placeholder="SLA צומת" />
                              <Input value={selectedNode.sla_modifier ?? 0} onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, sla_modifier: Number(event.target.value) || 0 }))} disabled={!canManage} type="number" min="0" placeholder="SLA modifier" />
                            </div>

                            <div className="grid gap-2 md:grid-cols-2">
                              <Button type="button" variant="outline" className="rounded-xl" disabled={!canManage} onClick={() => updateSchema((current) => ({ ...current, start_node_id: selectedNode.id }))}>סימון כהתחלה</Button>
                              <Button type="button" variant="outline" className="rounded-xl" disabled={!canManage} onClick={() => updateSchema((current) => ({ ...current, end_node_id: selectedNode.id }))}>סימון כסיום</Button>
                            </div>

                            <div className="space-y-3 border-t border-border/60 pt-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium">מעברים יוצאים</div>
                                {canManage ? (
                                  <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={handleAddConnection}>
                                    <Plus className="size-4" />
                                    מעבר חדש
                                  </Button>
                                ) : null}
                              </div>

                              {selectedNode.next_nodes.length === 0 ? (
                                <div className="text-sm text-muted-foreground">עדיין לא הוגדרו מעברים מהצומת הזה.</div>
                              ) : (
                                <div className="space-y-3">
                                  {selectedNode.next_nodes.map((connection) => (
                                    <div key={connection.id} className="rounded-xl border border-border/60 bg-background/70 p-3">
                                      <div className="grid gap-3">
                                        <Input value={connection.label} onChange={(event) => updateConnection(selectedNode.id, connection.id, (currentConnection) => ({ ...currentConnection, label: event.target.value }))} disabled={!canManage} placeholder="תווית מעבר" />
                                        <select
                                          className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                                          value={connection.node_id}
                                          disabled={!canManage}
                                          onChange={(event) => updateConnection(selectedNode.id, connection.id, (currentConnection) => ({ ...currentConnection, node_id: event.target.value }))}
                                        >
                                          {draftSchema.nodes.map((node) => (
                                            <option key={node.id} value={node.id}>{node.title} ({node.id})</option>
                                          ))}
                                        </select>
                                        {canManage ? (
                                          <Button type="button" variant="ghost" className="justify-start rounded-xl text-destructive hover:text-destructive" onClick={() => handleRemoveConnection(connection.id)}>
                                            <Trash2 className="size-4" />
                                            מחיקת מעבר
                                          </Button>
                                        ) : null}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {canManage && draftSchema.nodes.length > 1 ? (
                              <Button type="button" variant="ghost" className="justify-start rounded-xl text-destructive hover:text-destructive" onClick={() => handleRemoveNode(selectedNode.id)}>
                                <Trash2 className="size-4" />
                                מחיקת צומת
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </InfoPanelSection>

                      <InfoPanelSection title="טופס יצירה">
                        <textarea
                          value={draftFormSchema}
                          onChange={(event) => setDraftFormSchema(event.target.value)}
                          disabled={!canManage}
                          className="min-h-40 w-full rounded-2xl border border-input bg-background px-4 py-3 font-mono text-sm leading-6 outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                        />
                        <div className="mt-3 text-xs text-muted-foreground">{parsedFormSchema ? "JSON תקין" : "JSON לא תקין"}</div>
                      </InfoPanelSection>

                      {saveError ? <Alert variant="destructive"><AlertTitle>לא נשמר</AlertTitle><AlertDescription>{saveError}</AlertDescription></Alert> : null}
                      {saveMessage ? <Alert><AlertTitle>נשמר בהצלחה</AlertTitle><AlertDescription>{saveMessage}</AlertDescription></Alert> : null}

                      <Button onClick={handleSave} disabled={!canManage || saving} className="w-full rounded-xl">
                        <SaveIcon className="size-4" />
                        {saving ? "שומר..." : "שמירת סוג מסלול"}
                      </Button>
                    </InfoPanelBody>
                  </InfoPanel>
                </PageMainRail>

                <PageMainContent className="xl:order-2">
                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="text-xl">מפת מסלול</CardTitle>
                          <CardDescription>
                            בחרו סוג מסלול מהרשימה, ערכו את הצמתים ישירות מהמפה, וצרו תבנית חדשה בלי לרדת ל־JSON של מבנה המסלול.
                          </CardDescription>
                        </div>
                        {canManage ? (
                          <Button variant="outline" size="sm" className="rounded-xl" onClick={handleCreateNew}>
                            <GitBranchPlus className="size-4" />
                            סוג מסלול חדש
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {trackTypesError ? <Alert variant="destructive"><AlertTitle>שגיאה בטעינת סוגי מסלולים</AlertTitle><AlertDescription>{trackTypesError}</AlertDescription></Alert> : null}
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant={selectedTrackTypeId === "new" ? "default" : "outline"} className="rounded-full" onClick={handleCreateNew}>חדש</Button>
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

                      <TrackTypeGraph
                        schema={draftSchema}
                        highlightedNodeId={selectedNodeId}
                        onNodeSelect={setSelectedNodeId}
                        className="min-h-[34rem]"
                      />
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
