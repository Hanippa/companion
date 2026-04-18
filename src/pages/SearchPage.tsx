import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate } from "react-router-dom"
import {
  CircleAlert,
  DatabaseZap,
  Route,
  SearchIcon,
  Target,
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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getOrganizationSegment, getPointSegment, getTrackSegment } from "@/lib/drilldown"
import { getOrganizationsCached } from "@/lib/organizations"
import { supabase } from "@/lib/supabase"

type Organization = {
  id: number
  name: string | null
  notes: string | null
  status: string | null
}

type SearchIndexRow = {
  tracking_record_id: number
  organization_id: number
  point_id: number | null
}

type PointSummary = {
  id: number
  organization_id: number
  name: string | null
  status: string | null
}

type TrackTypeSummary = {
  id: number
  name: string | null
}

type SearchTrackRow = {
  id: number
  ref_id: number
  name: string | null
  status: string | null
  current_step: string | null
  updated_at?: string | null
  notes?: string | null
  point: PointSummary | PointSummary[] | null
  track_type: TrackTypeSummary | TrackTypeSummary[] | null
}

type SearchResult = {
  id: number
  refId: number
  name: string | null
  status: string | null
  currentStepKey: string | null
  point: PointSummary | null
  trackType: TrackTypeSummary | null
  url: string
}

const normalizeSingleRow = <T,>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? value[0] ?? null : value

const getStatusLabel = (status: string | null | undefined) =>
  status === "active" ? "פעיל" : status?.trim() || "לא פעיל"

const getTrackTitle = (track: SearchResult) =>
  track.name?.trim() || track.trackType?.name?.trim() || `מסלול #${track.id}`

export default function SearchPage() {
  const navigate = useNavigate()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("")
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [resultsError, setResultsError] = useState<string | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [query])

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
        console.error("Error loading organizations for search:", error)
        setOrganizations([])
        setOrganizationsError("לא הצלחנו לטעון את הארגונים הזמינים לחיפוש.")
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

    const runSearch = async () => {
      if (!selectedOrganizationId || debouncedQuery.length < 2) {
        setResults([])
        setResultsError(null)
        setLoadingResults(false)
        return
      }

      setLoadingResults(true)
      setResultsError(null)

      const organizationId = Number(selectedOrganizationId)
      const normalizedQuery = debouncedQuery.trim()
      const numericQuery = /^\d+$/.test(normalizedQuery) ? Number(normalizedQuery) : null

      const { data: pointRows, error: pointsError } = await supabase
        .from("points")
        .select("id")
        .eq("organization_id", organizationId)

      if (!isMounted) return

      if (pointsError) {
        console.error("Error loading organization points for search:", pointsError)
        setResults([])
        setResultsError("לא הצלחנו להכין את החיפוש עבור הארגון הזה.")
        setLoadingResults(false)
        return
      }

      const pointIds = (pointRows ?? []).map((row) => row.id)

      const [indexedSearchResult, fallbackSearchResult] = await Promise.all([
        supabase
          .from("tracking_record_search")
          .select("tracking_record_id, organization_id, point_id")
          .eq("organization_id", organizationId)
          .ilike("search_text", `%${normalizedQuery}%`)
          .limit(25),
        pointIds.length === 0
          ? Promise.resolve({ data: [], error: null })
          : (() => {
              let fallbackQuery = supabase
                .from("tracking_records")
                .select(
                  "id, ref_id, name, status, current_step, updated_at, notes, point:points(id, organization_id, name, status), track_type:track_types(id, name)"
                )
                .in("point_id", pointIds)
                .order("updated_at", { ascending: false })
                .limit(12)

              if (numericQuery !== null) {
                fallbackQuery = fallbackQuery.eq("ref_id", numericQuery)
              } else {
                fallbackQuery = fallbackQuery.or(
                  `name.ilike.%${normalizedQuery}%,notes.ilike.%${normalizedQuery}%`
                )
              }

              return fallbackQuery
            })(),
      ])

      if (!isMounted) return

      if (indexedSearchResult.error && fallbackSearchResult.error) {
        console.error("Error searching tracking records:", {
          indexedError: indexedSearchResult.error,
          fallbackError: fallbackSearchResult.error,
        })
        setResults([])
        setResultsError("לא הצלחנו לבצע חיפוש כרגע.")
        setLoadingResults(false)
        return
      }

      const indexedRows = (indexedSearchResult.data ?? []) as SearchIndexRow[]
      const fallbackRows = (fallbackSearchResult.data ?? []) as SearchTrackRow[]
      const fallbackIds = fallbackRows.map((row) => row.id)
      const indexedIds = indexedRows.map((row) => row.tracking_record_id)
      const orderedIds = Array.from(new Set([...indexedIds, ...fallbackIds]))

      if (orderedIds.length === 0) {
        setResults([])
        setLoadingResults(false)
        return
      }

      const fallbackTracksById = new Map(fallbackRows.map((row) => [row.id, row] as const))
      const missingIds = orderedIds.filter((id) => !fallbackTracksById.has(id))

      let missingRows: SearchTrackRow[] = []
      if (missingIds.length > 0) {
        const { data: rawTrackRows, error: tracksError } = await supabase
          .from("tracking_records")
          .select(
            "id, ref_id, name, status, current_step, updated_at, notes, point:points(id, organization_id, name, status), track_type:track_types(id, name)"
          )
          .in("id", missingIds)

        if (!isMounted) return

        if (tracksError) {
          console.error("Error loading indexed search results:", tracksError)
          setResults([])
          setResultsError("לא הצלחנו לטעון את תוצאות החיפוש.")
          setLoadingResults(false)
          return
        }

        missingRows = (rawTrackRows ?? []) as SearchTrackRow[]
      }

      const selectedOrganization =
        organizations.find((organization) => organization.id.toString() === selectedOrganizationId) ??
        null

      const tracksById = new Map<number, SearchTrackRow>([
        ...fallbackTracksById.entries(),
        ...missingRows.map((row) => [row.id, row] as const),
      ])

      const nextResults = orderedIds
        .map((id) => tracksById.get(id))
        .filter((row): row is SearchTrackRow => Boolean(row))
        .map((row) => {
          const point = normalizeSingleRow(row.point)
          const trackType = normalizeSingleRow(row.track_type)

          return {
            id: row.id,
            refId: row.ref_id,
            name: row.name,
            status: row.status,
            currentStepKey: row.current_step,
            point,
            trackType,
            url: point
              ? `/${getOrganizationSegment({
                  id: point.organization_id,
                  name: selectedOrganization?.name ?? null,
                })}/${getPointSegment(point)}/track/${getTrackSegment({
                  id: row.id,
                  name: row.name ?? trackType?.name ?? null,
                })}`
              : "#",
          } satisfies SearchResult
        })

      setResults(nextResults)
      setLoadingResults(false)
    }

    void runSearch()

    return () => {
      isMounted = false
    }
  }, [debouncedQuery, organizations, selectedOrganizationId])

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
          title="חיפוש"
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
                  <Skeleton className="h-40 rounded-3xl" />
                  <Skeleton className="h-64 rounded-3xl" />
                </PageMainContent>
              </PageMainLayout>
            ) : organizationsError ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>החיפוש אינו זמין</AlertTitle>
                <AlertDescription>{organizationsError}</AlertDescription>
              </Alert>
            ) : (
              <PageMainLayout>
                <PageMainRail>
                  <InfoPanel>
                    <InfoPanelHeader
                      icon={SearchIcon}
                      title={selectedOrganization?.name?.trim() || "חיפוש ארגוני"}
                      description={
                        selectedOrganization?.notes?.trim() ||
                        "חיפוש רוחבי בתוך מסלולי הארגון, כולל נתוני טופס ששויכו לרשומות."
                      }
                      badge={
                        <Badge variant="outline" className="rounded-full">
                          {selectedOrganization?.status === "active" ? "פעיל" : getStatusLabel(selectedOrganization?.status)}
                        </Badge>
                      }
                    />
                    <InfoPanelBody>
                      <InfoPanelStats>
                        <InfoPanelStat
                          icon={Target}
                          label="שאילתה"
                          value={debouncedQuery || "—"}
                          description="מופעל אחרי שני תווים ומעלה."
                        />
                        <InfoPanelStat
                          icon={Route}
                          label="תוצאות"
                          value={loadingResults ? "..." : results.length}
                          description="שילוב בין אינדקס ייעודי לבין חיפוש ישיר לשדות בסיסיים."
                        />
                      </InfoPanelStats>

                      <InfoPanelSection
                        icon={DatabaseZap}
                        title="מה כלול בחיפוש?"
                        description="החיפוש סורק גם מידע אינדקסי וגם שדות ליבה של המסלול."
                      >
                        <InfoPanelDetailList>
                          <InfoPanelDetail label="אינדקס" value="שם מסלול, מספר ייחוס, נתוני טופס ושדות שמורים" />
                          <InfoPanelDetail label="Fallback" value="שם מסלול, הערות ומספר ייחוס מתוך הרשומה עצמה" />
                          <InfoPanelDetail label="הקשר" value={selectedOrganization?.name?.trim() || "ארגון נבחר"} />
                        </InfoPanelDetailList>
                      </InfoPanelSection>

                      <InfoPanelSection title="טיפים לחיפוש טוב יותר">
                        <InfoPanelDetailList>
                          <InfoPanelDetail label="מספרים" value="מספר ייחוס, טלפון, סידורי או SAP" />
                          <InfoPanelDetail label="טקסט" value="שם לקוח, דגם, סוג מסלול או מילות הערה" />
                          <InfoPanelDetail label="תוצאה מהירה" value="נסו לחפש עם 2–4 תווים ראשונים או מספר מלא" />
                        </InfoPanelDetailList>
                      </InfoPanelSection>
                    </InfoPanelBody>
                  </InfoPanel>
                </PageMainRail>

                <PageMainContent>
                  <Card className="border-border/70 shadow-none">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <SearchIcon className="size-5" />
                        חיפוש מסלולים
                      </CardTitle>
                      <CardDescription>
                        חפשו לפי שם מסלול, מספר ייחוס, פרטי טופס שמורים, הערות או סוג מסלול.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="חפשו לפי שם, לקוח, טלפון, דגם, מספר ייחוס או כל שדה שמור..."
                      />
                      <div className="text-xs text-muted-foreground">
                        החיפוש משתמש תחילה באינדקס הייעודי, ובמידת הצורך מבצע גם חיפוש ישיר בשדות
                        הבסיס של רשומות המסלול כדי לצמצם מצבים של תוצאה חסרה.
                      </div>
                    </CardContent>
                  </Card>

                  {debouncedQuery.length === 0 ? (
                    <Alert>
                      <AlertTitle>התחילו להקליד</AlertTitle>
                      <AlertDescription>
                        החיפוש מתחיל אחרי שני תווים ומעלה, ומוגבל לארגון שנבחר בכותרת העליונה.
                      </AlertDescription>
                    </Alert>
                  ) : debouncedQuery.length < 2 ? (
                    <Alert>
                      <AlertTitle>צריך קצת יותר מידע</AlertTitle>
                      <AlertDescription>הקלידו לפחות שני תווים כדי להתחיל חיפוש.</AlertDescription>
                    </Alert>
                  ) : loadingResults ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <Skeleton className="h-48 rounded-2xl" />
                      <Skeleton className="h-48 rounded-2xl" />
                      <Skeleton className="h-48 rounded-2xl" />
                    </div>
                  ) : resultsError ? (
                    <Alert variant="destructive">
                      <CircleAlert className="size-4" />
                      <AlertTitle>החיפוש נכשל</AlertTitle>
                      <AlertDescription>{resultsError}</AlertDescription>
                    </Alert>
                  ) : results.length === 0 ? (
                    <Alert>
                      <AlertTitle>לא נמצאו תוצאות</AlertTitle>
                      <AlertDescription>
                        לא נמצאו מסלולים שתואמים ל־"{debouncedQuery}" בארגון הזה.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {results.map((result) => (
                        <Card
                          key={result.id}
                          className="border-border/70 shadow-none transition-colors hover:border-primary/35"
                        >
                          <CardHeader className="gap-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <CardTitle className="text-lg">{getTrackTitle(result)}</CardTitle>
                                <CardDescription>
                                  סוג: {result.trackType?.name?.trim() || "ללא סוג"} · מס' {result.refId}
                                </CardDescription>
                              </div>
                              <Badge
                                variant={result.status === "active" ? "default" : "outline"}
                                className="rounded-full"
                              >
                                {getStatusLabel(result.status)}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">נקודה</span>
                                <span className="text-right font-medium">
                                  {result.point?.name?.trim() || "ללא נקודה"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">שלב נוכחי</span>
                                <span className="text-right font-medium">
                                  {result.currentStepKey || "לא הוגדר"}
                                </span>
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              className="w-full rounded-xl"
                              onClick={() => navigate(result.url)}
                              disabled={result.url === "#"}
                            >
                              <Route className="size-4" />
                              פתיחת מסלול
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
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
