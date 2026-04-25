import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowDown,
  Building2,
  CircleAlert,
  GitBranchPlus,
  MapPinned,
  Pin,
  Plus,
  ShieldUser,
  Sparkles,
  Users2,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  InfoPanel,
  InfoPanelBody,
  InfoPanelHeader,
  InfoPanelSection,
} from "@/components/info-panel"
import { MemberCard } from "@/components/member-card"
import { PageMainContent, PageMainLayout, PageMainRail } from "@/components/page-main-layout"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { getAvatarInitials } from "@/lib/avatar"
import {
  getOrganizationSegment,
  getPointSegment,
  getRecordIdFromSegment,
} from "@/lib/drilldown"
import { getOrganizationsCached } from "@/lib/organizations"
import { pinPoint, readPinnedPoints, unpinPoint } from "@/lib/point-quick-access"
import { getProfilesByIdsCached } from "@/lib/profile-cache"
import { supabase } from "@/lib/supabase"

const ORGANIZATION_MEMBER_PREVIEW_LIMIT = 3
const POINT_MEMBER_AVATAR_LIMIT = 3

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

type PointWithStats = Point & {
  membersCount: number
  tracksCount: number
  memberIds: string[]
}

type ProfileSummary = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

type OrganizationMemberSummary = {
  user_id: string
  role: string | null
  title: string | null
}

const getOrganizationLabel = (organization: Organization) =>
  organization.name?.trim() || `ארגון #${organization.id}`

const getPointLabel = (point: Point) => point.name?.trim() || `נקודה #${point.id}`

const getStatusLabel = (status: string | null | undefined) =>
  status === "active" ? "פעיל" : status?.trim() || "לא פעיל"

const getOrganizationDescription = (organization: Organization) =>
  organization.notes?.trim() || "עדיין לא נוסף תיאור לארגון הזה."

const getPointDescription = (point: Point) =>
  point.notes?.trim() || "עדיין לא נוספו הערות לנקודה הזו."


const getOrganizationRoleLabel = (role: string | null | undefined) => {
  switch (role) {
    case "owner":
      return "בעלים"
    case "admin":
      return "מנהל"
    case "member":
      return "חבר צוות"
    default:
      return "חבר ארגון"
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { organizationSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("")
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [pointsWithStats, setPointsWithStats] = useState<PointWithStats[]>([])
  const [organizationMembersCount, setOrganizationMembersCount] = useState(0)
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMemberSummary[]>([])
  const [profilesById, setProfilesById] = useState<Record<string, ProfileSummary>>({})
  const [canManageTrackTypes, setCanManageTrackTypes] = useState(false)
  const [loadingPoints, setLoadingPoints] = useState(false)
  const [pointsError, setPointsError] = useState<string | null>(null)
  const [pointSearchQuery, setPointSearchQuery] = useState("")
  const [pinnedPointIds, setPinnedPointIds] = useState<number[]>([])
  const deferredPointSearchQuery = useDeferredValue(pointSearchQuery)

  useEffect(() => {
    let isMounted = true

    const fetchOrganizations = async () => {
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

          return nextOrganizations[0] ? nextOrganizations[0].id.toString() : ""
        })
      } catch (error) {
        if (!isMounted) return

        console.error("Error fetching organizations:", error)
        setOrganizations([])
        setSelectedOrganizationId("")
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
      setSelectedOrganizationId("")
      setLoadingOrganizations(false)
    }

    return () => {
      isMounted = false
    }
  }, [user])

  const selectedOrganization =
    organizations.find((organization) => {
      if (organizationIdFromRoute !== null) {
        return organization.id === organizationIdFromRoute
      }

      return organization.id.toString() === selectedOrganizationId
    }) ?? null

  useEffect(() => {
    setPinnedPointIds(readPinnedPoints(user?.id))
  }, [user?.id])

  const filteredPoints = useMemo(() => {
    const normalizedQuery = deferredPointSearchQuery.trim().toLocaleLowerCase("he-IL")

    const matchingPoints = normalizedQuery
      ? pointsWithStats.filter((point) => {
          const pointName = point.name?.trim().toLocaleLowerCase("he-IL") || ""
          const pointNotes = point.notes?.trim().toLocaleLowerCase("he-IL") || ""

          return pointName.includes(normalizedQuery) || pointNotes.includes(normalizedQuery)
        })
      : pointsWithStats

    return [...matchingPoints].sort((left, right) => {
      const leftPinned = pinnedPointIds.includes(left.id)
      const rightPinned = pinnedPointIds.includes(right.id)

      if (leftPinned === rightPinned) return 0
      return leftPinned ? -1 : 1
    })
  }, [deferredPointSearchQuery, pinnedPointIds, pointsWithStats])

  const handlePointPinToggle = (pointId: number, pinned: boolean) => {
    if (!user?.id) return

    setPinnedPointIds(pinned ? unpinPoint(user.id, pointId) : pinPoint(user.id, pointId))
  }

  useEffect(() => {
    if (loadingOrganizations || organizationsError || organizations.length === 0) {
      return
    }

    if (!organizationSlug) {
      if (organizations.length === 1) {
        navigate(`/${getOrganizationSegment(organizations[0])}`, {
          replace: true,
        })
      }
      return
    }

    if (!selectedOrganization) {
      navigate("/dashboard", { replace: true })
      return
    }

    if (selectedOrganization.id.toString() !== selectedOrganizationId) {
      setSelectedOrganizationId(selectedOrganization.id.toString())
    }

    const expectedSegment = getOrganizationSegment(selectedOrganization)
    if (expectedSegment !== organizationSlug) {
      navigate(`/${expectedSegment}`, { replace: true })
    }
  }, [
    loadingOrganizations,
    organizations,
    organizationsError,
    navigate,
    organizationSlug,
    selectedOrganization,
    selectedOrganizationId,
  ])

  useEffect(() => {
    let isMounted = true

    const fetchPoints = async () => {
      if (!selectedOrganization) {
        setPoints([])
        setPointsWithStats([])
        setOrganizationMembersCount(0)
        setOrganizationMembers([])
        setPointsError(null)
        setLoadingPoints(false)
        return
      }

      setLoadingPoints(true)
      setPointsError(null)

      const [pointsResult, membersCountResult, membersPreviewResult, ownerAccessResult] =
        await Promise.all([
        supabase
          .from("points")
          .select("id, organization_id, name, notes, status")
          .eq("organization_id", selectedOrganization.id)
          .order("name", { ascending: true, nullsFirst: false }),
        supabase
          .from("organization_users")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", selectedOrganization.id)
          .eq("status", "active"),
        supabase
          .from("organization_users")
          .select("user_id, role, title")
          .eq("organization_id", selectedOrganization.id)
          .eq("status", "active")
          .limit(ORGANIZATION_MEMBER_PREVIEW_LIMIT),
        supabase
          .from("organization_users")
          .select("role")
          .eq("organization_id", selectedOrganization.id)
          .eq("user_id", user?.id ?? "")
          .eq("status", "active")
          .maybeSingle(),
      ])

      if (!isMounted) return

      if (
        pointsResult.error ||
        membersCountResult.error ||
        membersPreviewResult.error ||
        ownerAccessResult.error
      ) {
        console.error("Error fetching dashboard data:", {
          pointsError: pointsResult.error,
          membersCountError: membersCountResult.error,
          membersPreviewError: membersPreviewResult.error,
          ownerAccessError: ownerAccessResult.error,
        })
        setPoints([])
        setPointsWithStats([])
        setOrganizationMembersCount(0)
        setOrganizationMembers([])
        setCanManageTrackTypes(false)
        setPointsError("לא הצלחנו לטעון את הנקודות של הארגון הזה כרגע.")
        setLoadingPoints(false)
        return
      }

      const nextPoints = (pointsResult.data ?? []) as Point[]
      const organizationMembers = (membersPreviewResult.data ?? []) as OrganizationMemberSummary[]
      const nextOrganizationMembersCount = membersCountResult.count ?? 0
      setCanManageTrackTypes(ownerAccessResult.data?.role === "owner")

      setPoints(nextPoints)
      setOrganizationMembersCount(nextOrganizationMembersCount)
      setOrganizationMembers(organizationMembers)

      if (nextPoints.length === 0) {
        setPointsWithStats([])
        setLoadingPoints(false)
        return
      }

      const pointIds = nextPoints.map((point) => point.id)
      const [pointUsersResult, tracksResult] = await Promise.all([
        supabase
          .from("point_users")
          .select("point_id, user_id")
          .in("point_id", pointIds)
          .eq("status", "active"),
        supabase.from("tracking_records").select("point_id").in("point_id", pointIds),
      ])

      if (!isMounted) return

      if (pointUsersResult.error || tracksResult.error) {
        console.error("Error fetching point stats:", {
          pointUsersError: pointUsersResult.error,
          tracksError: tracksResult.error,
        })
        setPointsWithStats(
          nextPoints.map((point) => ({
            ...point,
            membersCount: 0,
            tracksCount: 0,
            memberIds: [],
          }))
        )
        setLoadingPoints(false)
        return
      }

      const membersCountMap = new Map<number, number>()
      const tracksCountMap = new Map<number, number>()
      const memberIdsMap = new Map<number, string[]>()

      ;(pointUsersResult.data ?? []).forEach((row) => {
        membersCountMap.set(row.point_id, (membersCountMap.get(row.point_id) ?? 0) + 1)
        memberIdsMap.set(row.point_id, [...(memberIdsMap.get(row.point_id) ?? []), row.user_id])
      })

      ;(tracksResult.data ?? []).forEach((row) => {
        if (row.point_id === null) return
        tracksCountMap.set(row.point_id, (tracksCountMap.get(row.point_id) ?? 0) + 1)
      })

      setPointsWithStats(
        nextPoints.map((point) => ({
          ...point,
          membersCount: membersCountMap.get(point.id) ?? 0,
          tracksCount: tracksCountMap.get(point.id) ?? 0,
          memberIds: memberIdsMap.get(point.id) ?? [],
        }))
      )
      setLoadingPoints(false)
    }

    void fetchPoints()

    return () => {
      isMounted = false
    }
  }, [selectedOrganization, user?.id])

  useEffect(() => {
    let isMounted = true

    const loadProfiles = async () => {
      const allIds = Array.from(
        new Set([
          ...organizationMembers
            .slice(0, ORGANIZATION_MEMBER_PREVIEW_LIMIT)
            .map((member) => member.user_id),
          ...pointsWithStats.flatMap((point) =>
            point.memberIds.slice(0, POINT_MEMBER_AVATAR_LIMIT)
          ),
        ])
      )

      if (allIds.length === 0) {
        setProfilesById({})
        return
      }

      try {
        const nextProfilesById = await getProfilesByIdsCached(allIds)

        if (!isMounted) return

        setProfilesById(nextProfilesById)
      } catch (error) {
        if (!isMounted) return

        console.error("Error fetching member profiles:", error)
        setProfilesById({})
      }
    }

    void loadProfiles()

    return () => {
      isMounted = false
    }
  }, [organizationMembers, pointsWithStats])

  const organizationOptions = organizations.map((organization) => ({
    id: organization.id,
    label: getOrganizationLabel(organization),
  }))

  const displayedOrganizationMembers = organizationMembers.slice(
    0,
    ORGANIZATION_MEMBER_PREVIEW_LIMIT
  )

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find(
      (organization) => organization.id.toString() === value
    )

    if (!nextOrganization) return

    setSelectedOrganizationId(value)
    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const handlePointOpen = (point: Point) => {
    if (!selectedOrganization) return
    navigate(`/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(point)}`)
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 13)",
        } as CSSProperties
      }
    >
      <AppSidebar side="right" variant="inset" />
      <SidebarInset>
        <SiteHeader
          title="עמוד ראשי"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganizationId}
          onOrganizationChange={handleOrganizationChange}
        />

        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col">
            <div className="page-shell">
              <div className="page-stack" dir="rtl">
                {loadingOrganizations ? (
                  <DashboardSkeleton />
                ) : organizationsError ? (
                  <Alert variant="destructive">
                    <CircleAlert className="size-4" />
                    <AlertTitle>הארגונים אינם זמינים</AlertTitle>
                    <AlertDescription>{organizationsError}</AlertDescription>
                  </Alert>
                ) : organizations.length === 0 ? (
                  <Alert>
                    <CircleAlert className="size-4" />
                    <AlertTitle>עדיין אין ארגונים</AlertTitle>
                    <AlertDescription>
                      כרגע אין ארגונים שזמינים לחשבון הזה.
                    </AlertDescription>
                  </Alert>
                ) : !selectedOrganization ? (
                  <Alert>
                    <Building2 className="size-4" />
                    <AlertTitle>בחרו ארגון</AlertTitle>
                    <AlertDescription>
                      מחליף הארגונים יופיע בסרגל העליון כאשר יש יותר מאפשרות אחת.
                    </AlertDescription>
                  </Alert>
                ) : loadingPoints ? (
                  <DashboardSkeleton />
                ) : (
                  <PageMainLayout>
                    <PageMainRail>
                      <InfoPanel>
                        <InfoPanelHeader
                          icon={Building2}
                          title={getOrganizationLabel(selectedOrganization)}
                          description={getOrganizationDescription(selectedOrganization)}
                          badge={
                            <Badge
                              variant={
                                selectedOrganization.status === "active" ? "default" : "outline"
                              }
                              className="rounded-full"
                            >
                              {getStatusLabel(selectedOrganization.status)}
                            </Badge>
                          }
                        />

                        <InfoPanelBody>
                          {canManageTrackTypes ? (
                            <InfoPanelSection
                              icon={Sparkles}
                              title="פעולות מהירות"
                              description="הפעולות הנפוצות לניהול הארגון."
                            >
                              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-10 justify-start rounded-xl px-3"
                                  onClick={() =>
                                    navigate(`/${getOrganizationSegment(selectedOrganization)}/points/new`)
                                  }
                                >
                                  <Plus className="size-4" />
                                  יצירת נקודה
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-10 justify-start rounded-xl px-3"
                                  onClick={() =>
                                    navigate(`/${getOrganizationSegment(selectedOrganization)}/team`)
                                  }
                                >
                                  <ShieldUser className="size-4" />
                                  ניהול צוות
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-10 justify-start rounded-xl px-3 sm:col-span-2 xl:col-span-1"
                                  onClick={() =>
                                    navigate(`/${getOrganizationSegment(selectedOrganization)}/track-types`)
                                  }
                                >
                                  <GitBranchPlus className="size-4" />
                                  ניהול סוגי מסלולים
                                </Button>
                              </div>
                            </InfoPanelSection>
                          ) : null}

                          <InfoPanelSection
                            icon={Users2}
                            title="חברי ארגון"
                            description="תצוגה מקוצרת של חברי הצוות הפעילים."
                          >
                            <OrganizationMembersList
                              members={displayedOrganizationMembers}
                              profilesById={profilesById}
                              totalCount={organizationMembersCount}
                              canManage={canManageTrackTypes}
                              onManage={() =>
                                navigate(`/${getOrganizationSegment(selectedOrganization)}/team`)
                              }
                            />
                          </InfoPanelSection>
                        </InfoPanelBody>
                      </InfoPanel>
                    </PageMainRail>

                    <PageMainContent>
                      <Card className="border-border/70 shadow-none">
                        <CardHeader className="gap-3">
                          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div className="space-y-2">
                              <CardTitle className="flex items-center gap-2 text-xl">
                                <MapPinned className="size-5" />
                                נקודות הארגון
                              </CardTitle>
                              <CardDescription className="max-w-2xl leading-7">
                                כל הנקודות הפעילות בארגון. נקודות מוצמדות יופיעו קודם.
                              </CardDescription>
                            </div>

                            <Badge variant="outline" className="rounded-full">
                              {deferredPointSearchQuery.trim()
                                ? `${filteredPoints.length} מתוך ${points.length} נקודות`
                                : `סה"כ ${points.length} נקודות`}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="dashboard-points-search" className="text-sm font-medium">
                              חיפוש נקודות
                            </label>
                            <Input
                              id="dashboard-points-search"
                              value={pointSearchQuery}
                              onChange={(event) => setPointSearchQuery(event.target.value)}
                              placeholder="חיפוש לפי שם נקודה או תיאור"
                              className="rounded-xl"
                            />
                          </div>
                        </CardHeader>

                      <CardContent>
                        {pointsError ? (
                          <Alert variant="destructive">
                            <CircleAlert className="size-4" />
                            <AlertTitle>הנקודות אינן זמינות</AlertTitle>
                            <AlertDescription>{pointsError}</AlertDescription>
                          </Alert>
                        ) : pointsWithStats.length === 0 ? (
                          <Alert>
                            <MapPinned className="size-4" />
                            <AlertTitle>עדיין אין נקודות</AlertTitle>
                            <AlertDescription>
                              לארגון הזה אין כרגע נקודות שזמינות לחשבון שלך.
                            </AlertDescription>
                          </Alert>
                        ) : filteredPoints.length === 0 ? (
                          <Alert>
                            <MapPinned className="size-4" />
                            <AlertTitle>לא נמצאו נקודות</AlertTitle>
                            <AlertDescription>
                              לא נמצאו נקודות שתואמות ל־"{deferredPointSearchQuery}".
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {filteredPoints.map((point) => (
                              <DashboardPointCard
                                key={point.id}
                                point={point}
                                profilesById={profilesById}
                                isPinned={pinnedPointIds.includes(point.id)}
                                onPinToggle={handlePointPinToggle}
                                onOpen={() => handlePointOpen(point)}
                              />
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    </PageMainContent>
                  </PageMainLayout>
                )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function DashboardSkeleton() {
  return (
    <PageMainLayout>
      <PageMainRail>
        <InfoPanel>
        <CardHeader className="gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        </CardContent>
      </InfoPanel>
      </PageMainRail>

      <PageMainContent>
        <Card className="border-border/70 shadow-none">
        <CardHeader className="gap-3">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        </CardContent>
      </Card>
      </PageMainContent>
    </PageMainLayout>
  )
}

function DashboardPointCard({
  point,
  profilesById,
  isPinned,
  onPinToggle,
  onOpen,
}: {
  point: PointWithStats
  profilesById: Record<string, ProfileSummary>
  isPinned: boolean
  onPinToggle: (pointId: number, pinned: boolean) => void
  onOpen: () => void
}) {
  return (
    <Card
      size="sm"
      className="entity-entry-card overflow-hidden border-border/70 bg-card/95 shadow-none"
    >
      <CardHeader className="gap-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            <MapPinned className="size-3.5" />
            נקודה
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant={point.status === "active" ? "default" : "outline"}
              className="rounded-full px-2 py-0.5 text-[11px]"
            >
              {getStatusLabel(point.status)}
            </Badge>
            <Button
              type="button"
              variant={isPinned ? "default" : "outline"}
              size="icon-xs"
              className="rounded-full"
              onClick={() => onPinToggle(point.id, isPinned)}
              aria-label={isPinned ? "הסרת הצמדה" : "הצמדת נקודה"}
              title={isPinned ? "הסרת הצמדה" : "הצמדת נקודה"}
            >
              <Pin className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="min-w-0 space-y-1">
          <CardTitle className="line-clamp-2 text-base leading-6">{getPointLabel(point)}</CardTitle>
          <CardDescription className="line-clamp-1 leading-5">
            {getPointDescription(point)}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            חברי צוות
          </div>
          <CompactMemberAvatarStack memberIds={point.memberIds} profilesById={profilesById} />
        </div>
      </CardContent>

      <CardFooter className="border-t border-border/60 pt-3">
        <Button
          className="group h-9 w-full justify-between rounded-xl px-3"
          variant="outline"
          onClick={onOpen}
        >
          פתיחת נקודה
          <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-1" />
        </Button>
      </CardFooter>
    </Card>
  )
}

function CompactMemberAvatarStack({
  memberIds,
  profilesById,
}: {
  memberIds: string[]
  profilesById: Record<string, ProfileSummary>
}) {
  const visibleMemberIds = memberIds.slice(0, POINT_MEMBER_AVATAR_LIMIT)
  const overflowCount = Math.max(memberIds.length - visibleMemberIds.length, 0)

  if (visibleMemberIds.length === 0) {
    return <div className="text-xs text-muted-foreground">אין חברים להצגה</div>
  }

  return (
    <AvatarGroup>
      {visibleMemberIds.map((memberId) => {
        const member = profilesById[memberId]

        return (
          <Avatar key={memberId} size="sm">
            <AvatarImage
              src={member?.avatar_url ?? undefined}
              alt={member?.display_name ?? "חבר צוות"}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <AvatarFallback>{getAvatarInitials(member?.display_name)}</AvatarFallback>
          </Avatar>
        )
      })}
      {overflowCount > 0 ? <AvatarGroupCount>+{overflowCount}</AvatarGroupCount> : null}
    </AvatarGroup>
  )
}

function OrganizationMembersList({
  members,
  profilesById,
  totalCount,
  canManage,
  onManage,
}: {
  members: OrganizationMemberSummary[]
  profilesById: Record<string, ProfileSummary>
  totalCount: number
  canManage?: boolean
  onManage?: () => void
}) {
  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
        עדיין אין חברים זמינים להצגה בארגון הזה.
      </div>
    )
  }

  const hiddenMembersCount = Math.max(totalCount - members.length, 0)

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/60 bg-background/80 p-2">
        <div className="mb-2 flex items-center justify-between gap-3 px-2 py-1">
          <div className="text-xs text-muted-foreground">חברי צוות</div>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
            {totalCount}
          </Badge>
        </div>

        <div className="space-y-2">
          {members.map((organizationMember) => {
            const profile = profilesById[organizationMember.user_id]
            const organizationMemberTitle = organizationMember.title?.trim() || "חבר בארגון"
            const memberDisplayName = profile?.display_name?.trim() || "חבר צוות"
            const roleLabel = getOrganizationRoleLabel(organizationMember.role)

            return (
              <MemberCard
                key={organizationMember.user_id}
                name={memberDisplayName}
                meta={organizationMemberTitle}
                avatarUrl={profile?.avatar_url ?? undefined}
                initialsSource={profile?.display_name || organizationMemberTitle}
                badgeLabel={roleLabel}
              />
            )
          })}

          {hiddenMembersCount > 0 ? (
            canManage && onManage ? (
              <button
                type="button"
                className="relative block h-9 w-full overflow-hidden rounded-xl text-right"
                onClick={onManage}
              >
                <ArrowDown className="pointer-events-none absolute inset-x-0 top-1 z-10 mx-auto size-3.5 animate-bounce text-muted-foreground/80" />
                <MemberCard
                  name="חברים נוספים"
                  meta="הרשימה המלאה זמינה בעמוד הצוות"
                  initialsSource="..."
                  className="border-border/60 bg-muted/15 opacity-75 transition-opacity hover:opacity-95"
                  avatarClassName="size-10"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-background via-background/80 to-transparent" />
                <span className="sr-only">לעמוד הצוות</span>
              </button>
            ) : (
              <div className="relative h-9 overflow-hidden rounded-xl">
                <ArrowDown className="pointer-events-none absolute inset-x-0 top-1 z-10 mx-auto size-3.5 animate-bounce text-muted-foreground/80" />
                <MemberCard
                  name="חברים נוספים"
                  meta="יש עוד חברים ברשימה"
                  initialsSource="..."
                  className="border-border/60 bg-muted/15 opacity-70"
                  avatarClassName="size-10"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-background via-background/80 to-transparent" />
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  )
}


