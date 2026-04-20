import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CircleAlert, MapPinned, PencilLine, Plus, SaveIcon } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  InfoPanel,
  InfoPanelBody,
  InfoPanelDetail,
  InfoPanelDetailList,
  InfoPanelHeader,
  InfoPanelSection,
} from "@/components/info-panel"
import { PageBody, PageMainContent, PageMainLayout, PageMainRail } from "@/components/page-main-layout"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { getOrganizationSegment, getPointSegment, getRecordIdFromSegment } from "@/lib/drilldown"
import { getOrganizationsCached } from "@/lib/organizations"
import { supabase } from "@/lib/supabase"

type Organization = {
  id: number
  name: string | null
  notes: string | null
  status: string | null
}

type Point = {
  id: number
  organization_id: number
  name: string | null
  notes: string | null
  status: string | null
}

const getStatusLabel = (status: string | null | undefined) =>
  status === "active" ? "פעילה" : status?.trim() || "לא פעילה"

export default function PointEditPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { organizationSlug, pointSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)
  const pointIdFromRoute = getRecordIdFromSegment(pointSlug)
  const isCreateMode = pointSlug === undefined

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)
  const [point, setPoint] = useState<Point | null>(null)
  const [loadingPoint, setLoadingPoint] = useState(true)
  const [pointError, setPointError] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [loadingPermissions, setLoadingPermissions] = useState(true)
  const [pointName, setPointName] = useState("")
  const [pointNotes, setPointNotes] = useState("")
  const [savingPoint, setSavingPoint] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchOrganizations = async () => {
      setLoadingOrganizations(true)
      setOrganizationsError(null)

      try {
        const data = await getOrganizationsCached()
        if (!isMounted) return
        setOrganizations(data)
      } catch (error) {
        if (!isMounted) return
        console.error("Error fetching organizations:", error)
        setOrganizations([])
        setOrganizationsError("לא הצלחנו לטעון את הארגונים שלך כרגע.")
      } finally {
        if (isMounted) {
          setLoadingOrganizations(false)
        }
      }
    }

    if (user) {
      void fetchOrganizations()
    } else {
      setOrganizations([])
      setLoadingOrganizations(false)
    }

    return () => {
      isMounted = false
    }
  }, [user])

  const selectedOrganization =
    organizations.find((organization) => organization.id === organizationIdFromRoute) ?? null

  useEffect(() => {
    let isMounted = true

    const fetchPointAndPermissions = async () => {
      if (!selectedOrganization) {
        setLoadingPoint(false)
        setLoadingPermissions(false)
        return
      }

      setLoadingPoint(true)
      setPointError(null)
      setLoadingPermissions(true)
      setSaveMessage(null)
      setSaveError(null)

      const permissionQuery = supabase
        .from("organization_users")
        .select("role")
        .eq("organization_id", selectedOrganization.id)
        .eq("user_id", user?.id ?? "")
        .eq("status", "active")

      const [permissionResult, pointResult] = await Promise.all([
        isCreateMode
          ? permissionQuery.eq("role", "owner")
          : permissionQuery.in("role", ["admin", "owner"]),
        isCreateMode
          ? Promise.resolve({ data: null, error: null })
          : supabase
              .from("points")
              .select("id, organization_id, name, notes, status")
              .eq("id", pointIdFromRoute ?? -1)
              .single<Point>(),
      ])

      if (!isMounted) {
        return
      }

      if (permissionResult.error) {
        console.error("Error fetching point permissions:", permissionResult.error)
        setCanEdit(false)
      } else {
        setCanEdit((permissionResult.data ?? []).length > 0)
      }
      setLoadingPermissions(false)

      if (isCreateMode) {
        setPoint(null)
        setPointName("")
        setPointNotes("")
        setLoadingPoint(false)
        return
      }

      if (pointResult.error || !pointResult.data) {
        console.error("Error fetching point:", pointResult.error)
        setPoint(null)
        setPointError("לא הצלחנו לטעון את הנקודה הזו כרגע.")
        setLoadingPoint(false)
        return
      }

      const nextPoint = pointResult.data
      if (nextPoint.organization_id !== selectedOrganization.id) {
        navigate(`/${getOrganizationSegment(selectedOrganization)}`, { replace: true })
        return
      }

      const expectedOrganizationSegment = getOrganizationSegment(selectedOrganization)
      const expectedPointSegment = getPointSegment(nextPoint)

      if (
        organizationSlug !== expectedOrganizationSegment ||
        pointSlug !== expectedPointSegment
      ) {
        navigate(`/${expectedOrganizationSegment}/${expectedPointSegment}/edit`, {
          replace: true,
        })
      }

      setPoint(nextPoint)
      setPointName(nextPoint.name?.trim() || "")
      setPointNotes(nextPoint.notes?.trim() || "")
      setLoadingPoint(false)
    }

    if (user) {
      void fetchPointAndPermissions()
    }

    return () => {
      isMounted = false
    }
  }, [
    isCreateMode,
    navigate,
    organizationSlug,
    pointIdFromRoute,
    pointSlug,
    selectedOrganization,
    user,
  ])

  const organizationOptions = organizations.map((organization) => ({
    id: organization.id,
    label: organization.name?.trim() || `ארגון #${organization.id}`,
  }))

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find(
      (organization) => organization.id.toString() === value
    )

    if (!nextOrganization) {
      return
    }

    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const pageTitle = isCreateMode ? "יצירת נקודה" : "עריכת נקודה"
  const pageDescription = isCreateMode
    ? "בעל הארגון יכול להקים נקודה חדשה בארגון, ולהגדיר לה שם ותיאור."
    : "עריכת פרטי הנקודה נשארת בעמוד ייעודי כדי לשמור על עמוד הנקודה עצמו נקי וקריא."

  const permissionDescription = useMemo(() => {
    if (isCreateMode) {
      return "יצירת נקודה חדשה זמינה לבעלי הארגון בלבד."
    }

    return "עריכת נקודה זמינה לבעלי הארגון ולמנהלי הארגון."
  }, [isCreateMode])

  const handlePointSave = async () => {
    if (!selectedOrganization || !canEdit) {
      return
    }

    setSavingPoint(true)
    setSaveError(null)
    setSaveMessage(null)

    const nextName = pointName.trim() || null
    const nextNotes = pointNotes.trim() || null

    try {
      if (isCreateMode) {
        const { data, error } = await supabase
          .from("points")
          .insert({
            organization_id: selectedOrganization.id,
            name: nextName,
            notes: nextNotes,
            status: "active",
          })
          .select("id, organization_id, name, notes, status")
          .single<Point>()

        if (error || !data) {
          throw error ?? new Error("create-point-failed")
        }

        setSaveMessage("הנקודה נוצרה בהצלחה.")
        navigate(
          `/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(data)}`,
          { replace: true }
        )
        return
      }

      if (!point) {
        throw new Error("missing-point")
      }

      const { error } = await supabase
        .from("points")
        .update({
          name: nextName,
          notes: nextNotes,
        })
        .eq("id", point.id)

      if (error) {
        throw error
      }

      const nextPoint = {
        ...point,
        name: nextName,
        notes: nextNotes,
      }

      setPoint(nextPoint)
      setSaveMessage("פרטי הנקודה עודכנו.")

      navigate(
        `/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(nextPoint)}/edit`,
        { replace: true }
      )
    } catch (error) {
      console.error("Error saving point:", error)
      setSaveError(
        isCreateMode
          ? "לא הצלחנו ליצור את הנקודה כרגע."
          : "לא הצלחנו לשמור את פרטי הנקודה כרגע."
      )
    } finally {
      setSavingPoint(false)
    }
  }

  const handleBack = () => {
    if (!selectedOrganization) {
      navigate("/dashboard")
      return
    }

    if (isCreateMode || !point) {
      navigate(`/${getOrganizationSegment(selectedOrganization)}`)
      return
    }

    navigate(`/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(point)}`)
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
          title={pageTitle}
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />
        <PageBody>
          <div className="page-stack flex-1">
            {loadingOrganizations || loadingPoint ? (
              <PageMainLayout>
                <PageMainRail>
                  <Skeleton className="h-[28rem] rounded-3xl" />
                </PageMainRail>
                <PageMainContent>
                  <Skeleton className="h-[28rem] rounded-3xl" />
                </PageMainContent>
              </PageMainLayout>
            ) : organizationsError || pointError ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>העמוד אינו זמין</AlertTitle>
                <AlertDescription>
                  {pointError || organizationsError || "לא הצלחנו לטעון את העמוד הזה."}
                </AlertDescription>
              </Alert>
            ) : (
              <PageMainLayout>
                <PageMainRail>
                  <InfoPanel>
                    <InfoPanelHeader
                      icon={MapPinned}
                      title={pointName.trim() || (isCreateMode ? "נקודה חדשה" : `נקודה #${point?.id ?? "—"}`)}
                      description={pointNotes.trim() || pageDescription}
                      badge={
                        <Badge variant={canEdit ? "default" : "outline"}>
                          {isCreateMode ? "יצירה" : getStatusLabel(point?.status)}
                        </Badge>
                      }
                    />
                    <InfoPanelBody>
                      <InfoPanelSection title="הקשר">
                        <InfoPanelDetailList>
                          <InfoPanelDetail
                            label="ארגון"
                            value={selectedOrganization?.name?.trim() || `ארגון #${selectedOrganization?.id ?? "—"}`}
                          />
                          {!isCreateMode && point ? (
                            <InfoPanelDetail label="מזהה נקודה" value={point.id} />
                          ) : null}
                        </InfoPanelDetailList>
                      </InfoPanelSection>
                    </InfoPanelBody>
                  </InfoPanel>
                </PageMainRail>
                <PageMainContent>
                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="gap-3">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        {isCreateMode ? <Plus className="size-5" /> : <PencilLine className="size-5" />}
                        {pageTitle}
                      </CardTitle>
                      <CardDescription>
                        {isCreateMode
                          ? "הגדירו שם ברור לנקודה והוסיפו תיאור קצר שיעזור לצוות להבין במה מדובר."
                          : "עדכנו את פרטי הנקודה בצורה מסודרת, בלי להעמיס על עמוד הנקודה הראשי."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {!canEdit && !loadingPermissions ? (
                        <Alert variant="destructive">
                          <AlertTitle>אין הרשאה</AlertTitle>
                          <AlertDescription>{permissionDescription}</AlertDescription>
                        </Alert>
                      ) : null}
                      {saveError ? (
                        <Alert variant="destructive">
                          <AlertTitle>{isCreateMode ? "הנקודה לא נוצרה" : "הנקודה לא נשמרה"}</AlertTitle>
                          <AlertDescription>{saveError}</AlertDescription>
                        </Alert>
                      ) : null}
                      {saveMessage ? (
                        <Alert>
                          <AlertTitle>{isCreateMode ? "הנקודה נוצרה" : "הנקודה עודכנה"}</AlertTitle>
                          <AlertDescription>{saveMessage}</AlertDescription>
                        </Alert>
                      ) : null}
                      <div className="grid gap-5">
                        <div className="space-y-2">
                          <label htmlFor="point-name" className="text-sm font-medium">
                            שם הנקודה
                          </label>
                          <Input
                            id="point-name"
                            value={pointName}
                            onChange={(event) => setPointName(event.target.value)}
                            disabled={loadingPermissions || !canEdit}
                            placeholder="למשל: מרכז שירות דיזנגוף"
                            className="h-11 rounded-2xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="point-notes" className="text-sm font-medium">
                            תיאור / הערות
                          </label>
                          <textarea
                            id="point-notes"
                            value={pointNotes}
                            onChange={(event) => setPointNotes(event.target.value)}
                            disabled={loadingPermissions || !canEdit}
                            className="min-h-44 w-full rounded-3xl border border-input bg-input/30 px-4 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                            placeholder="מה חשוב לדעת על הנקודה הזו?"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-3 border-t border-border/60 pt-4">
                        <Button variant="outline" onClick={handleBack} className="rounded-xl">
                          חזרה
                        </Button>
                        <Button
                          onClick={handlePointSave}
                          disabled={savingPoint || !canEdit}
                          className="rounded-xl"
                        >
                          <SaveIcon className="size-4" />
                          {savingPoint
                            ? isCreateMode
                              ? "יוצר נקודה..."
                              : "שומר..."
                            : isCreateMode
                              ? "יצירת נקודה"
                              : "שמירת נקודה"}
                        </Button>
                      </div>
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
