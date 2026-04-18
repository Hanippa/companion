import { useEffect, useMemo, useState, type CSSProperties } from "react"
import {
  BarChart3Icon,
  CircleAlert,
  MapPinned,
  Route,
  Users2,
  Workflow,
  type LucideIcon,
} from "lucide-react"

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getOrganizationsCached } from "@/lib/organizations"
import { supabase } from "@/lib/supabase"

type Organization = {
  id: number
  name: string | null
  notes: string | null
  status: string | null
}

type PointRow = {
  id: number
  name: string | null
}

type TrackTypeRow = {
  id: number
  name: string | null
  status: string | null
}

type TrackRow = {
  id: number
  ref_id: number
  name: string | null
  status: string | null
  updated_at: string | null
  point_id: number | null
}

const getOrganizationLabel = (organization: Organization | null) =>
  organization?.name?.trim() || "ללא ארגון"

const getStatusLabel = (status: string | null | undefined) =>
  status === "active" ? "פעיל" : status?.trim() || "לא פעיל"

export default function StatisticsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("")
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [points, setPoints] = useState<PointRow[]>([])
  const [trackTypes, setTrackTypes] = useState<TrackTypeRow[]>([])
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [teamCount, setTeamCount] = useState(0)

  useEffect(() => {
    let isMounted = true

    const loadOrganizations = async () => {
      setLoadingOrganizations(true)
      setOrganizationsError(null)

      try {
        const nextOrganizations = await getOrganizationsCached()
        if (!isMounted) return
        setOrganizations(nextOrganizations)
        setSelectedOrganizationId((currentValue) => {
          if (
            currentValue &&
            nextOrganizations.some((organization) => organization.id.toString() === currentValue)
          ) {
            return currentValue
          }

          return nextOrganizations[0]?.id.toString() ?? ""
        })
      } catch (error) {
        if (!isMounted) return
        console.error("Error loading organizations for statistics:", error)
        setOrganizations([])
        setOrganizationsError("לא הצלחנו לטעון את הארגונים עבור מסך הסטטיסטיקות.")
      } finally {
        if (isMounted) setLoadingOrganizations(false)
      }
    }

    void loadOrganizations()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadStatistics = async () => {
      if (!selectedOrganizationId) {
        setPoints([])
        setTrackTypes([])
        setTracks([])
        setTeamCount(0)
        setLoadingStats(false)
        return
      }

      setLoadingStats(true)
      setStatsError(null)

      const organizationId = Number(selectedOrganizationId)

      const [pointsResult, trackTypesResult, teamResult] = await Promise.all([
        supabase
          .from("points")
          .select("id, name")
          .eq("organization_id", organizationId)
          .order("name", { ascending: true, nullsFirst: false }),
        supabase
          .from("track_types")
          .select("id, name, status")
          .eq("organization_id", organizationId)
          .order("name", { ascending: true, nullsFirst: false }),
        supabase
          .from("organization_users")
          .select("user_id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("status", "active"),
      ])

      if (!isMounted) return

      if (pointsResult.error || trackTypesResult.error || teamResult.error) {
        console.error("Error loading organization statistics:", {
          pointsError: pointsResult.error,
          trackTypesError: trackTypesResult.error,
          teamError: teamResult.error,
        })
        setPoints([])
        setTrackTypes([])
        setTracks([])
        setTeamCount(0)
        setStatsError("לא הצלחנו לטעון את נתוני הסטטיסטיקה של הארגון.")
        setLoadingStats(false)
        return
      }

      const nextPoints = (pointsResult.data ?? []) as PointRow[]
      const pointIds = nextPoints.map((point) => point.id)

      let nextTracks: TrackRow[] = []
      if (pointIds.length > 0) {
        const { data: tracksData, error: tracksError } = await supabase
          .from("tracking_records")
          .select("id, ref_id, name, status, updated_at, point_id")
          .in("point_id", pointIds)
          .order("updated_at", { ascending: false })
          .limit(24)

        if (!isMounted) return

        if (tracksError) {
          console.error("Error loading organization tracks for statistics:", tracksError)
          setStatsError("חלק מנתוני המסלולים לא נטענו. מציגים את מה שזמין כרגע.")
        } else {
          nextTracks = (tracksData ?? []) as TrackRow[]
        }
      }

      setPoints(nextPoints)
      setTrackTypes((trackTypesResult.data ?? []) as TrackTypeRow[])
      setTracks(nextTracks)
      setTeamCount(teamResult.count ?? 0)
      setLoadingStats(false)
    }

    void loadStatistics()

    return () => {
      isMounted = false
    }
  }, [selectedOrganizationId])

  const organizationOptions = useMemo(
    () =>
      organizations.map((organization) => ({
        id: organization.id,
        label: organization.name?.trim() || `ארגון #${organization.id}`,
      })),
    [organizations]
  )

  const selectedOrganization =
    organizations.find((organization) => organization.id.toString() === selectedOrganizationId) ?? null

  const activeTracksCount = tracks.filter((track) => track.status === "active").length
  const idleTracksCount = Math.max(tracks.length - activeTracksCount, 0)
  const recentTracks = tracks.slice(0, 6)

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
          title="סטטיסטיקות"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganizationId}
          onOrganizationChange={setSelectedOrganizationId}
        />
        <PageBody>
          <div className="page-stack flex-1" dir="rtl">
            {loadingOrganizations ? (
              <PageMainLayout>
                <PageMainRail>
                  <Skeleton className="h-[30rem] rounded-3xl" />
                </PageMainRail>
                <PageMainContent>
                  <Skeleton className="h-56 rounded-3xl" />
                  <Skeleton className="h-64 rounded-3xl" />
                </PageMainContent>
              </PageMainLayout>
            ) : organizationsError ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>עמוד הסטטיסטיקות אינו זמין</AlertTitle>
                <AlertDescription>{organizationsError}</AlertDescription>
              </Alert>
            ) : (
              <PageMainLayout>
                <PageMainRail>
                  <InfoPanel>
                    <InfoPanelHeader
                      icon={BarChart3Icon}
                      title={getOrganizationLabel(selectedOrganization)}
                      description={
                        selectedOrganization?.notes?.trim() ||
                        "תמונת מצב תפעולית מרוכזת של הארגון, הנקודות והמסלולים."
                      }
                      badge={
                        <Badge variant="outline" className="rounded-full">
                          {getStatusLabel(selectedOrganization?.status)}
                        </Badge>
                      }
                    />
                    <InfoPanelBody>
                      <InfoPanelStats>
                        <InfoPanelStat
                          icon={MapPinned}
                          label="נקודות"
                          value={loadingStats ? "..." : points.length}
                          description="כל הנקודות הפעילות בארגון"
                        />
                        <InfoPanelStat
                          icon={Users2}
                          label="חברי צוות"
                          value={loadingStats ? "..." : teamCount}
                          description="חברי הארגון הפעילים"
                        />
                      </InfoPanelStats>

                      <InfoPanelSection title="כיסוי תפעולי">
                        <InfoPanelDetailList>
                          <InfoPanelDetail label="סוגי מסלולים" value={loadingStats ? "..." : trackTypes.length} />
                          <InfoPanelDetail label="מסלולים פעילים" value={loadingStats ? "..." : activeTracksCount} />
                          <InfoPanelDetail label="מסלולים לא פעילים" value={loadingStats ? "..." : idleTracksCount} />
                        </InfoPanelDetailList>
                      </InfoPanelSection>
                    </InfoPanelBody>
                  </InfoPanel>
                </PageMainRail>

                <PageMainContent>
                  {statsError ? (
                    <Alert variant="destructive">
                      <CircleAlert className="size-4" />
                      <AlertTitle>חלק מהנתונים לא זמינים</AlertTitle>
                      <AlertDescription>{statsError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {loadingStats ? (
                    <>
                      <Skeleton className="h-56 rounded-3xl" />
                      <Skeleton className="h-64 rounded-3xl" />
                    </>
                  ) : (
                    <>
                      <Card className="border-border/70 shadow-none">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-xl">
                            <BarChart3Icon className="size-5" />
                            מדדי ליבה
                          </CardTitle>
                          <CardDescription>
                            סקירה מהירה של מבנה הארגון והעומס התפעולי שלו כרגע.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <StatCard
                            icon={MapPinned}
                            label="נקודות"
                            value={points.length}
                            description="מרכזי שירות ונקודות עבודה"
                          />
                          <StatCard
                            icon={Workflow}
                            label="סוגי מסלולים"
                            value={trackTypes.length}
                            description="תבניות מעקב זמינות"
                          />
                          <StatCard
                            icon={Route}
                            label="מסלולים פעילים"
                            value={activeTracksCount}
                            description="רשומות שטיפולן עדיין פתוח"
                          />
                          <StatCard
                            icon={Users2}
                            label="חברי צוות"
                            value={teamCount}
                            description="משתמשים פעילים בארגון"
                          />
                        </CardContent>
                      </Card>

                      <Card className="border-border/70 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-xl">מסלולים אחרונים</CardTitle>
                          <CardDescription>
                            מבט קצר על הרשומות שהתעדכנו לאחרונה בארגון.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {recentTracks.length === 0 ? (
                            <Alert>
                              <AlertTitle>אין עדיין פעילות</AlertTitle>
                              <AlertDescription>
                                בארגון הזה עדיין לא נפתחו מסלולים שמוצגים בסטטיסטיקות.
                              </AlertDescription>
                            </Alert>
                          ) : (
                            recentTracks.map((track) => (
                              <div
                                key={track.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3"
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-medium">
                                    {track.name?.trim() || `מסלול #${track.id}`}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    מס' {track.ref_id}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge
                                    variant={track.status === "active" ? "default" : "outline"}
                                    className="rounded-full"
                                  >
                                    {getStatusLabel(track.status)}
                                  </Badge>
                                  <div className="text-xs text-muted-foreground">
                                    {track.updated_at
                                      ? new Date(track.updated_at).toLocaleString("he-IL")
                                      : "ללא עדכון"}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </PageMainContent>
              </PageMainLayout>
            )}
          </div>
        </PageBody>
      </SidebarInset>
    </SidebarProvider>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: LucideIcon
  label: string
  value: number
  description: string
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      <div className="mt-3 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </div>
  )
}
