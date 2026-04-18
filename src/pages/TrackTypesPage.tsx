import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CircleAlert, GitBranchPlus, SaveIcon, Workflow } from "lucide-react"

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
import { normalizeTrackSchema } from "@/lib/track-schema"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

type Organization = {
  id: number
  name: string | null
  notes: string | null
  status: string | null
}

type TrackTypeRecord = {
  id: number
  name: string | null
  status: string | null
  sla: number | null
  form_schema: unknown
  track_schema: unknown
  vesrion: number | null
}

const DEFAULT_TRACK_SCHEMA = {
  version: 1,
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
      next_nodes: [{ node_id: "end", label: "סיום" }],
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

const DEFAULT_FORM_SCHEMA = {
  title: "טופס פתיחה",
  sections: [],
}

const stringifyJson = (value: unknown) => JSON.stringify(value, null, 2)

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

  const [selectedTrackTypeId, setSelectedTrackTypeId] = useState<string>("new")
  const [draftName, setDraftName] = useState("")
  const [draftStatus, setDraftStatus] = useState("active")
  const [draftSla, setDraftSla] = useState("0")
  const [draftVersion, setDraftVersion] = useState("1")
  const [draftTrackSchema, setDraftTrackSchema] = useState(stringifyJson(DEFAULT_TRACK_SCHEMA))
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
        if (isMounted) {
          setLoadingOrganizations(false)
        }
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
      setSaveError(null)

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

      if (permissionResult.error) {
        console.error("Error checking owner permissions:", permissionResult.error)
        setCanManage(false)
      } else {
        setCanManage((permissionResult.data ?? []).length > 0)
      }

      if (trackTypesResult.error) {
        console.error("Error loading track types:", trackTypesResult.error)
        setTrackTypes([])
        setTrackTypesError("לא הצלחנו לטעון את סוגי המסלולים של הארגון הזה.")
        setLoadingTrackTypes(false)
        return
      }

      const nextTrackTypes = (trackTypesResult.data ?? []) as TrackTypeRecord[]
      setTrackTypes(nextTrackTypes)
      setLoadingTrackTypes(false)
    }

    if (selectedOrganization) {
      void loadTrackTypes()
    }

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

  useEffect(() => {
    if (selectedTrackTypeId === "new") {
      setDraftName("")
      setDraftStatus("active")
      setDraftSla("0")
      setDraftVersion("1")
      setDraftTrackSchema(stringifyJson(DEFAULT_TRACK_SCHEMA))
      setDraftFormSchema(stringifyJson(DEFAULT_FORM_SCHEMA))
      setSaveError(null)
      setSaveMessage(null)
      return
    }

    if (!selectedTrackType) return

    setDraftName(selectedTrackType.name?.trim() || "")
    setDraftStatus(selectedTrackType.status?.trim() || "active")
    setDraftSla(String(selectedTrackType.sla ?? 0))
    setDraftVersion(String(selectedTrackType.vesrion ?? 1))
    setDraftTrackSchema(stringifyJson(selectedTrackType.track_schema ?? DEFAULT_TRACK_SCHEMA))
    setDraftFormSchema(stringifyJson(selectedTrackType.form_schema ?? DEFAULT_FORM_SCHEMA))
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

  const parsedTrackSchema = useMemo(() => {
    try {
      return JSON.parse(draftTrackSchema)
    } catch {
      return null
    }
  }, [draftTrackSchema])

  const normalizedTrackSchema = useMemo(
    () => normalizeTrackSchema(parsedTrackSchema),
    [parsedTrackSchema]
  )

  const parsedFormSchema = useMemo(() => {
    try {
      return JSON.parse(draftFormSchema)
    } catch {
      return null
    }
  }, [draftFormSchema])

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find(
      (organization) => organization.id.toString() === value
    )
    if (!nextOrganization) return
    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const handleCreateNew = () => {
    setSelectedTrackTypeId("new")
  }

  const handleSave = async () => {
    if (!selectedOrganization || !canManage) return

    setSaving(true)
    setSaveError(null)
    setSaveMessage(null)

    try {
      if (!parsedTrackSchema) {
        throw new Error("track-schema-invalid")
      }

      if (!parsedFormSchema) {
        throw new Error("form-schema-invalid")
      }

      const normalized = normalizeTrackSchema(parsedTrackSchema)
      if (!normalized || normalized.nodes.length === 0 || !normalized.start_node_id) {
        throw new Error("track-schema-empty")
      }

      const versionNumber = Number(draftVersion)

      const payload = {
        organization_id: selectedOrganization.id,
        name: draftName.trim() || null,
        status: draftStatus.trim() || "active",
        sla: Number.isFinite(Number(draftSla)) ? Number(draftSla) : 0,
        vesrion: Number.isFinite(versionNumber) ? versionNumber : 1,
        track_schema: parsedTrackSchema,
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
          [...current, data].sort((left, right) =>
            (left.name ?? "").localeCompare(right.name ?? "", "he")
          )
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
          current.map((trackType) => (trackType.id === data.id ? data : trackType))
        )
        setSaveMessage("סוג המסלול עודכן בהצלחה.")
      }
    } catch (error) {
      console.error("Error saving track type:", error)

      if (error instanceof Error) {
        if (error.message === "track-schema-invalid") {
          setSaveError("ה־JSON של מבנה המסלול אינו תקין.")
        } else if (error.message === "form-schema-invalid") {
          setSaveError("ה־JSON של טופס היצירה אינו תקין.")
        } else if (error.message === "track-schema-empty") {
          setSaveError("מבנה המסלול חייב לכלול צומת התחלה וצמתים תקינים.")
        } else {
          setSaveError("לא הצלחנו לשמור את סוג המסלול כרגע.")
        }
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
                <PageMainContent className="grid gap-6 2xl:grid-cols-[22rem_minmax(0,1fr)]">
                  <Skeleton className="h-[36rem] rounded-3xl" />
                  <Skeleton className="h-[36rem] rounded-3xl" />
                </PageMainContent>
                <PageMainRail>
                  <Skeleton className="h-[36rem] rounded-3xl" />
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
                <PageMainContent className="grid gap-6 2xl:grid-cols-[22rem_minmax(0,1fr)]">
                <Card className="border-border/70 shadow-none">
                  <CardHeader className="gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl">סוגי מסלולים</CardTitle>
                        <CardDescription>
                          צפייה, בחירה והכנה לעריכה של סוגי המסלולים בארגון.
                        </CardDescription>
                      </div>
                      {canManage ? (
                        <Button variant="outline" size="sm" className="rounded-xl" onClick={handleCreateNew}>
                          <GitBranchPlus className="size-4" />
                          חדש
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {trackTypesError ? (
                      <Alert variant="destructive">
                        <AlertTitle>שגיאה בטעינת סוגי מסלולים</AlertTitle>
                        <AlertDescription>{trackTypesError}</AlertDescription>
                      </Alert>
                    ) : trackTypes.length === 0 ? (
                      <Alert>
                        <AlertTitle>עדיין אין סוגי מסלולים</AlertTitle>
                        <AlertDescription>
                          אפשר להתחיל מסוג מסלול חדש ולבנות את מבנה הצמתים שלו.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      trackTypes.map((trackType) => {
                        const previewSchema = normalizeTrackSchema(trackType.track_schema)
                        const isSelected = trackType.id.toString() === selectedTrackTypeId

                        return (
                          <button
                            key={trackType.id}
                            type="button"
                            onClick={() => setSelectedTrackTypeId(trackType.id.toString())}
                            className={cn(
                              "w-full rounded-2xl border px-4 py-3 text-right transition-colors",
                              isSelected
                                ? "border-primary/50 bg-primary/5"
                                : "border-border/70 bg-card hover:border-primary/30"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {trackType.name?.trim() || `סוג מסלול #${trackType.id}`}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {previewSchema?.title?.trim() || "ללא כותרת תבנית"}
                                </div>
                              </div>
                              <Badge variant={trackType.status === "active" ? "default" : "outline"} className="rounded-full">
                                {trackType.status === "active" ? "פעיל" : trackType.status || "לא פעיל"}
                              </Badge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>{previewSchema?.nodes.length ?? 0} צמתים</span>
                              <span>SLA {trackType.sla ?? 0} דק׳</span>
                              <span>גרסה {trackType.vesrion ?? 1}</span>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  {!canManage ? (
                    <Alert variant="destructive">
                      <CircleAlert className="size-4" />
                      <AlertTitle>גישה מוגבלת</AlertTitle>
                      <AlertDescription>
                        רק בעלי ארגון יכולים ליצור ולעדכן סוגי מסלולים.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="gap-3">
                      <CardTitle className="text-xl">
                        {selectedTrackTypeId === "new" ? "יצירת סוג מסלול" : "עריכת סוג מסלול"}
                      </CardTitle>
                      <CardDescription>
                        העריכה נשמרת מול הטבלאות הקיימות, וה־preview מתעדכן לפי מבנה הצמתים בפועל.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">שם</label>
                          <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} disabled={!canManage} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">סטטוס</label>
                          <Input value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)} disabled={!canManage} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">SLA ברירת מחדל (דקות)</label>
                          <Input value={draftSla} onChange={(event) => setDraftSla(event.target.value)} disabled={!canManage} type="number" min="0" />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-1">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">גרסה</label>
                          <Input value={draftVersion} onChange={(event) => setDraftVersion(event.target.value)} disabled={!canManage} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">מבנה מסלול (`track_schema`)</label>
                        <textarea
                          value={draftTrackSchema}
                          onChange={(event) => setDraftTrackSchema(event.target.value)}
                          disabled={!canManage}
                          className="min-h-72 w-full rounded-2xl border border-input bg-background px-4 py-3 font-mono text-sm leading-6 outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">טופס יצירה (`form_schema`)</label>
                        <textarea
                          value={draftFormSchema}
                          onChange={(event) => setDraftFormSchema(event.target.value)}
                          disabled={!canManage}
                          className="min-h-52 w-full rounded-2xl border border-input bg-background px-4 py-3 font-mono text-sm leading-6 outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                        />
                      </div>

                      {saveError ? (
                        <Alert variant="destructive">
                          <AlertTitle>לא נשמר</AlertTitle>
                          <AlertDescription>{saveError}</AlertDescription>
                        </Alert>
                      ) : null}

                      {saveMessage ? (
                        <Alert>
                          <AlertTitle>נשמר בהצלחה</AlertTitle>
                          <AlertDescription>{saveMessage}</AlertDescription>
                        </Alert>
                      ) : null}

                      <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={!canManage || saving} className="rounded-xl">
                          <SaveIcon className="size-4" />
                          {saving ? "שומר..." : "שמירת סוג מסלול"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="gap-2">
                      <CardTitle className="text-xl">תצוגה גרפית</CardTitle>
                      <CardDescription>
                        הצמתים מסודרים לפי עומק מהצומת ההתחלתי, והקווים מציגים את החיבורים ביניהם.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TrackTypeGraph schema={normalizedTrackSchema} />
                    </CardContent>
                  </Card>
                </div>
                </PageMainContent>

                <PageMainRail>
                <InfoPanel>
                  <InfoPanelHeader
                    icon={Workflow}
                    title={draftName.trim() || "סוג מסלול חדש"}
                    description={normalizedTrackSchema?.title?.trim() || "תבנית מסלול"}
                    badge={
                      <Badge variant={draftStatus === "active" ? "default" : "outline"}>
                        {draftStatus === "active" ? "פעיל" : draftStatus || "לא פעיל"}
                      </Badge>
                    }
                  />
                  <InfoPanelBody>
                    <InfoPanelStats>
                      <InfoPanelStat
                        label="צמתים"
                        value={normalizedTrackSchema?.nodes.length ?? 0}
                        description="מספר הצמתים שמוגדרים בתבנית הזו"
                      />
                      <InfoPanelStat
                        label="SLA ברירת מחדל"
                        value={`${draftSla || 0} דק׳`}
                        description="משך היעד הראשי למסלול לפני modifiers"
                      />
                      <InfoPanelStat
                        label="גרסה"
                        value={draftVersion || "1"}
                        description="גרסת התבנית כפי שתישמר בטבלה"
                      />
                    </InfoPanelStats>

                    <InfoPanelSection title="צמתים מרכזיים">
                      <InfoPanelDetailList>
                        <InfoPanelDetail
                          label="צומת התחלה"
                          value={normalizedTrackSchema?.start_node_id || "לא הוגדר"}
                        />
                        <InfoPanelDetail
                          label="צומת סיום"
                          value={normalizedTrackSchema?.end_node_id || "לא הוגדר"}
                        />
                      </InfoPanelDetailList>
                    </InfoPanelSection>

                    <InfoPanelSection title="תקינות טיוטה">
                      <InfoPanelDetailList>
                        <InfoPanelDetail
                          label="מבנה מסלול"
                          value={parsedTrackSchema ? "JSON תקין" : "JSON לא תקין"}
                        />
                        <InfoPanelDetail
                          label="טופס יצירה"
                          value={parsedFormSchema ? "JSON תקין" : "JSON לא תקין"}
                        />
                      </InfoPanelDetailList>
                    </InfoPanelSection>
                  </InfoPanelBody>
                </InfoPanel>
                </PageMainRail>
              </PageMainLayout>
            )}
          </div>
        </PageBody>
      </SidebarInset>
    </SidebarProvider>
  )
}
