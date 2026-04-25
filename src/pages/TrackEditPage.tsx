import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CircleAlert, PencilLine, Route, SaveIcon, Trash2 } from "lucide-react"

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
import {
  getOrganizationSegment,
  getPointSegment,
  getRecordIdFromSegment,
  getTrackSegment,
} from "@/lib/drilldown"
import { getOrganizationsCached } from "@/lib/organizations"
import { removeTrackQuickAccessItem } from "@/lib/track-quick-access"
import { supabase } from "@/lib/supabase"

type Organization = {
  id: number
  name: string | null
  notes: string | null
  status: string | null
}

type PointRecord = {
  id: number
  organization_id: number
  name: string | null
  notes: string | null
  status: string | null
}

type TrackTypeRecord = {
  id: number
  name: string | null
  status: string | null
}

type TrackingRecordRow = {
  id: number
  ref_id: number
  point_id: number | null
  name: string | null
  status: string | null
  current_step: string | null
  sla: number | null
  notes: string | null
  point: PointRecord | PointRecord[] | null
  track_type: TrackTypeRecord | TrackTypeRecord[] | null
}

type TrackRecord = {
  id: number
  refId: number
  pointId: number | null
  name: string | null
  status: string | null
  currentStepKey: string | null
  sla: number | null
  notes: string | null
  point: PointRecord | null
  trackType: TrackTypeRecord | null
}

const normalizeSingleRow = <T,>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? value[0] ?? null : value

const getStatusLabel = (status: string | null | undefined) =>
  status === "active" ? "פעיל" : status?.trim() || "לא פעיל"

const getTrackTitle = (track: TrackRecord | null) => {
  if (!track) return "מסלול"
  return track.name?.trim() || track.trackType?.name?.trim() || `מסלול #${track.id}`
}

export default function TrackEditPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { organizationSlug, pointSlug, trackSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)
  const pointIdFromRoute = getRecordIdFromSegment(pointSlug)
  const trackIdFromRoute = getRecordIdFromSegment(trackSlug)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)
  const [track, setTrack] = useState<TrackRecord | null>(null)
  const [loadingTrack, setLoadingTrack] = useState(true)
  const [trackError, setTrackError] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [canDelete, setCanDelete] = useState(false)
  const [loadingPermissions, setLoadingPermissions] = useState(true)
  const [trackName, setTrackName] = useState("")
  const [trackNotes, setTrackNotes] = useState("")
  const [savingTrack, setSavingTrack] = useState(false)
  const [deletingTrack, setDeletingTrack] = useState(false)
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

    const fetchTrackAndPermissions = async () => {
      if (!selectedOrganization || !user?.id || trackIdFromRoute === null) {
        setLoadingTrack(false)
        setLoadingPermissions(false)
        setCanEdit(false)
        setCanDelete(false)
        return
      }

      setLoadingTrack(true)
      setTrackError(null)
      setLoadingPermissions(true)
      setSaveMessage(null)
      setSaveError(null)

      const [trackResult, orgPermissionResult] = await Promise.all([
        supabase
          .from("tracking_records")
          .select(
            "id, ref_id, point_id, name, status, current_step, sla, notes, point:points(id, organization_id, name, notes, status), track_type:track_types(id, name, status)"
          )
          .eq("id", trackIdFromRoute)
          .single<TrackingRecordRow>(),
        supabase
          .from("organization_users")
          .select("role")
          .eq("organization_id", selectedOrganization.id)
          .eq("user_id", user.id)
          .eq("status", "active")
          .in("role", ["admin", "owner"]),
      ])

      if (!isMounted) return

      if (trackResult.error || !trackResult.data) {
        console.error("Error fetching track:", trackResult.error)
        setTrack(null)
        setTrackError("לא הצלחנו לטעון את פרטי המסלול כרגע.")
        setLoadingTrack(false)
        setLoadingPermissions(false)
        setCanEdit(false)
        setCanDelete(false)
        return
      }

      const point = normalizeSingleRow(trackResult.data.point)
      const trackType = normalizeSingleRow(trackResult.data.track_type)

      if (!point) {
        setTrack(null)
        setTrackError("המסלול הזה אינו משויך לנקודה תקינה.")
        setLoadingTrack(false)
        setLoadingPermissions(false)
        setCanEdit(false)
        setCanDelete(false)
        return
      }

      if (point.organization_id !== selectedOrganization.id) {
        setTrack(null)
        setTrackError("המסלול הזה אינו שייך לארגון שנבחר.")
        setLoadingTrack(false)
        setLoadingPermissions(false)
        setCanEdit(false)
        setCanDelete(false)
        return
      }

      if (pointIdFromRoute !== null && point.id !== pointIdFromRoute) {
        setTrack(null)
        setTrackError("המסלול הזה אינו שייך לנקודה שנבחרה.")
        setLoadingTrack(false)
        setLoadingPermissions(false)
        setCanEdit(false)
        setCanDelete(false)
        return
      }

      const pointPermissionResult = await supabase
        .from("point_users")
        .select("role")
        .eq("point_id", point.id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .in("role", ["admin", "owner"])

      if (!isMounted) return

      if (orgPermissionResult.error || pointPermissionResult.error) {
        console.error("Error fetching track permissions:", {
          orgPermissionError: orgPermissionResult.error,
          pointPermissionError: pointPermissionResult.error,
        })
        setCanEdit(false)
        setCanDelete(false)
      } else {
        const hasManagementAccess =
          (orgPermissionResult.data ?? []).length > 0 ||
          (pointPermissionResult.data ?? []).length > 0

        setCanEdit(hasManagementAccess)
        setCanDelete(hasManagementAccess)
      }

      const nextTrack: TrackRecord = {
        id: trackResult.data.id,
        refId: trackResult.data.ref_id,
        pointId: trackResult.data.point_id,
        name: trackResult.data.name,
        status: trackResult.data.status,
        currentStepKey: trackResult.data.current_step,
        sla: trackResult.data.sla,
        notes: trackResult.data.notes,
        point,
        trackType,
      }

      const expectedOrganizationSegment = getOrganizationSegment(selectedOrganization)
      const expectedPointSegment = getPointSegment(point)
      const expectedTrackSegment = getTrackSegment({
        id: nextTrack.id,
        name: nextTrack.name,
      })

      if (
        organizationSlug !== expectedOrganizationSegment ||
        pointSlug !== expectedPointSegment ||
        trackSlug !== expectedTrackSegment
      ) {
        navigate(
          `/${expectedOrganizationSegment}/${expectedPointSegment}/track/${expectedTrackSegment}/edit`,
          { replace: true }
        )
        return
      }

      setTrack(nextTrack)
      setTrackName(nextTrack.name?.trim() || "")
      setTrackNotes(nextTrack.notes?.trim() || "")
      setLoadingTrack(false)
      setLoadingPermissions(false)
    }

    if (user) {
      void fetchTrackAndPermissions()
    }

    return () => {
      isMounted = false
    }
  }, [
    navigate,
    organizationSlug,
    pointIdFromRoute,
    pointSlug,
    selectedOrganization,
    trackIdFromRoute,
    trackSlug,
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

    if (!nextOrganization) return

    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const trackViewUrl = useMemo(() => {
    if (!selectedOrganization || !track?.point || !track) return null

    return `/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(track.point)}/track/${getTrackSegment(
      {
        id: track.id,
        name: track.name,
      }
    )}`
  }, [selectedOrganization, track])

  const handleSaveTrack = async () => {
    if (!track || !canEdit || savingTrack) return

    const normalizedName = trackName.trim()
    const normalizedNotes = trackNotes.trim()

    if (!normalizedName) {
      setSaveError("צריך לתת למסלול שם לפני השמירה.")
      setSaveMessage(null)
      return
    }

    setSavingTrack(true)
    setSaveError(null)
    setSaveMessage(null)

    const { data, error } = await supabase
      .from("tracking_records")
      .update({
        name: normalizedName,
        notes: normalizedNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", track.id)
      .select("id, name, notes")
      .single<{ id: number; name: string | null; notes: string | null }>()

    if (error || !data) {
      console.error("Error saving track:", error)
      setSaveError("לא הצלחנו לשמור את השינויים במסלול.")
      setSavingTrack(false)
      return
    }

    const nextTrack = {
      ...track,
      name: data.name,
      notes: data.notes,
    }

    setTrack(nextTrack)
    setTrackName(data.name?.trim() || "")
    setTrackNotes(data.notes?.trim() || "")
    setSaveMessage("פרטי המסלול נשמרו.")
    setSavingTrack(false)

    if (selectedOrganization && nextTrack.point) {
      navigate(
        `/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(nextTrack.point)}/track/${getTrackSegment(
          {
            id: nextTrack.id,
            name: nextTrack.name,
          }
        )}/edit`,
        { replace: true }
      )
    }
  }

  const handleDeleteTrack = async () => {
    if (!track || !canDelete || deletingTrack || !selectedOrganization || !track.point) return

    const shouldDelete = window.confirm(
      `למחוק את המסלול "${getTrackTitle(track)}"? הפעולה תמחק גם את אירועי המעקב והמידע המשויך למסלול הזה.`
    )

    if (!shouldDelete) return

    setDeletingTrack(true)
    setSaveError(null)
    setSaveMessage(null)

    const { error } = await supabase.functions.invoke("delete-track", {
      body: { tracking_record_id: track.id },
    })

    if (error) {
      console.error("Error deleting track:", error)
      setSaveError("לא הצלחנו למחוק את המסלול הזה כרגע.")
      setDeletingTrack(false)
      return
    }

    navigate(
      `/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(track.point)}`,
      { replace: true }
    )

    if (user?.id) {
      removeTrackQuickAccessItem(user.id, track.id)
    }
  }

  const isBusy = savingTrack || deletingTrack

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar
        side="right"
        variant="inset"
        currentTrack={
          track && trackViewUrl
            ? {
                id: track.id,
                name: track.name,
                url: trackViewUrl,
                pointName: track.point?.name,
                trackTypeName: track.trackType?.name,
                refId: track.refId,
                currentStepKey: track.currentStepKey ?? undefined,
              }
            : null
        }
      />
      <SidebarInset dir="rtl">
        <SiteHeader
          title="ניהול מסלול"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id?.toString()}
          onOrganizationChange={handleOrganizationChange}
        />

        <PageBody>
          <div className="space-y-6">
            {loadingOrganizations || loadingTrack ? (
              <PageMainLayout>
                <PageMainContent>
                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="space-y-3">
                      <Skeleton className="h-7 w-40 rounded-lg" />
                      <Skeleton className="h-4 w-72 rounded-lg" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <Skeleton className="h-24 w-full rounded-2xl" />
                      <Skeleton className="h-36 w-full rounded-2xl" />
                    </CardContent>
                  </Card>
                </PageMainContent>
                <PageMainRail>
                  <InfoPanel className="xl:static">
                    <InfoPanelHeader
                      icon={Route}
                      title="טוען מסלול"
                      description="אוסף את פרטי המסלול וההרשאות."
                    />
                    <InfoPanelBody className="space-y-4">
                      <Skeleton className="h-24 w-full rounded-2xl" />
                      <Skeleton className="h-32 w-full rounded-2xl" />
                    </InfoPanelBody>
                  </InfoPanel>
                </PageMainRail>
              </PageMainLayout>
            ) : organizationsError ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>אין גישה לארגון</AlertTitle>
                <AlertDescription>{organizationsError}</AlertDescription>
              </Alert>
            ) : !selectedOrganization ||
              organizationIdFromRoute === null ||
              pointIdFromRoute === null ||
              trackIdFromRoute === null ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>כתובת לא תקינה</AlertTitle>
                <AlertDescription>
                  לא הצלחנו לזהות את הארגון, הנקודה או המסלול מתוך הכתובת.
                </AlertDescription>
              </Alert>
            ) : trackError ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>המסלול לא זמין</AlertTitle>
                <AlertDescription>{trackError}</AlertDescription>
              </Alert>
            ) : !track ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>המסלול לא זמין</AlertTitle>
                <AlertDescription>לא נמצאה רשומת מסלול לעריכה.</AlertDescription>
              </Alert>
            ) : (
              <PageMainLayout>
                <PageMainContent className="xl:order-2">
                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="text-xl">פרטי המסלול</CardTitle>
                          <CardDescription>
                            כאן אפשר לעדכן את שם המסלול ואת ההערות הפנימיות שלו, או למחוק
                            אותו אם כבר אין בו צורך.
                          </CardDescription>
                        </div>
                        <Badge variant={track.status === "active" ? "default" : "secondary"}>
                          {getStatusLabel(track.status)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {!loadingPermissions && !canEdit ? (
                        <Alert variant="destructive">
                          <CircleAlert className="size-4" />
                          <AlertTitle>אין הרשאה לנהל את המסלול</AlertTitle>
                          <AlertDescription>
                            ניהול מסלול זמין למנהלי ובעלי ארגון, וגם למנהלי ובעלי נקודה.
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      {saveMessage ? (
                        <Alert>
                          <PencilLine className="size-4" />
                          <AlertTitle>השינויים נשמרו</AlertTitle>
                          <AlertDescription>{saveMessage}</AlertDescription>
                        </Alert>
                      ) : null}

                      {saveError ? (
                        <Alert variant="destructive">
                          <CircleAlert className="size-4" />
                          <AlertTitle>לא הצלחנו להשלים את הפעולה</AlertTitle>
                          <AlertDescription>{saveError}</AlertDescription>
                        </Alert>
                      ) : null}

                      <div className="grid gap-5">
                        <div className="space-y-2">
                          <label className="text-sm font-medium" htmlFor="track-name">
                            שם המסלול
                          </label>
                          <Input
                            id="track-name"
                            value={trackName}
                            onChange={(event) => setTrackName(event.target.value)}
                            placeholder="למשל: תיקון iPhone 15 Pro"
                            disabled={!canEdit || isBusy}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium" htmlFor="track-notes">
                            הערות פנימיות
                          </label>
                          <textarea
                            id="track-notes"
                            value={trackNotes}
                            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                              setTrackNotes(event.target.value)
                            }
                            placeholder="הערות לצוות על המסלול הזה, אם צריך."
                            className="min-h-32 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            disabled={!canEdit || isBusy}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => trackViewUrl && navigate(trackViewUrl)}
                        >
                          חזרה למסלול
                        </Button>
                        <div className="flex flex-wrap items-center gap-3">
                          {canDelete ? (
                            <Button
                              type="button"
                              variant="destructive"
                              className="rounded-xl"
                              onClick={handleDeleteTrack}
                              disabled={isBusy}
                            >
                              <Trash2 className="size-4" />
                              {deletingTrack ? "מוחק..." : "מחיקת מסלול"}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            className="rounded-xl"
                            onClick={handleSaveTrack}
                            disabled={!canEdit || isBusy}
                          >
                            <SaveIcon className="size-4" />
                            {savingTrack ? "שומר..." : "שמירת שינויים"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </PageMainContent>

                <PageMainRail className="xl:order-1">
                  <InfoPanel className="xl:static">
                    <InfoPanelHeader
                      icon={Route}
                      title={getTrackTitle(track)}
                      description={track.trackType?.name?.trim() || "מסלול פעיל"}
                      badge={
                        <Badge variant={track.status === "active" ? "default" : "secondary"}>
                          {getStatusLabel(track.status)}
                        </Badge>
                      }
                    />
                    <InfoPanelBody className="space-y-4">
                      <InfoPanelSection
                        title="הקשר"
                        description="המסלול הזה משויך לנקודה ולארגון הנוכחיים."
                      >
                        <InfoPanelDetailList>
                          <InfoPanelDetail
                            label="ארגון"
                            value={selectedOrganization.name?.trim() || `ארגון #${selectedOrganization.id}`}
                          />
                          <InfoPanelDetail
                            label="נקודה"
                            value={track.point?.name?.trim() || `נקודה #${track.point?.id ?? pointIdFromRoute}`}
                          />
                          <InfoPanelDetail label="מספר מסלול" value={`#${track.refId}`} />
                          <InfoPanelDetail
                            label="שלב נוכחי"
                            value={track.currentStepKey?.trim() || "עדיין לא הוגדר"}
                          />
                        </InfoPanelDetailList>
                      </InfoPanelSection>

                      <InfoPanelSection
                        title="פעולות"
                        description="עריכת המסלול נעשית כאן, והמעקב עצמו נשאר בעמוד המסלול."
                      >
                        <div className="flex flex-col gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="justify-start rounded-xl"
                            onClick={() => trackViewUrl && navigate(trackViewUrl)}
                          >
                            <Route className="size-4" />
                            מעבר לעמוד המסלול
                          </Button>
                        </div>
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
