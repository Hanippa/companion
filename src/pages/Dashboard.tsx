import { useEffect, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleAlert,
  MapPinned,
  Route,
  Users2,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { getProfilesByIdsCached } from "@/lib/profile-cache"
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
  const [organizationMemberIds, setOrganizationMemberIds] = useState<string[]>([])
  const [profilesById, setProfilesById] = useState<Record<string, ProfileSummary>>({})
  const [loadingPoints, setLoadingPoints] = useState(false)
  const [pointsError, setPointsError] = useState<string | null>(null)

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
    if (loadingOrganizations || organizationsError || organizations.length === 0) {
      return
    }

    if (!organizationSlug) {
      if (organizations.length === 1) {
        navigate(`/${getOrganizationSegment(organizations[0])}`, { replace: true })
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
        setOrganizationMemberIds([])
        setPointsError(null)
        setLoadingPoints(false)
        return
      }

      setLoadingPoints(true)
      setPointsError(null)

      const [pointsResult, membersResult] = await Promise.all([
        supabase
          .from("points")
          .select("id, organization_id, name, notes, status")
          .eq("organization_id", selectedOrganization.id)
          .order("name", { ascending: true, nullsFirst: false }),
        supabase
          .from("organization_users")
          .select("user_id")
          .eq("organization_id", selectedOrganization.id)
          .eq("status", "active"),
      ])

      if (!isMounted) return

      if (pointsResult.error || membersResult.error) {
        console.error("Error fetching dashboard data:", {
          pointsError: pointsResult.error,
          membersError: membersResult.error,
        })
        setPoints([])
        setPointsWithStats([])
        setOrganizationMembersCount(0)
        setOrganizationMemberIds([])
        setPointsError("לא הצלחנו לטעון את הנקודות של הארגון הזה כרגע.")
        setLoadingPoints(false)
        return
      }

      const nextPoints = (pointsResult.data ?? []) as Point[]
      const nextOrganizationMemberIds = (membersResult.data ?? []).map((member) => member.user_id)

      setPoints(nextPoints)
      setOrganizationMembersCount(nextOrganizationMemberIds.length)
      setOrganizationMemberIds(nextOrganizationMemberIds)

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
  }, [selectedOrganization])

  useEffect(() => {
    let isMounted = true

    const loadProfiles = async () => {
      const allIds = Array.from(
        new Set([
          ...organizationMemberIds,
          ...pointsWithStats.flatMap((point) => point.memberIds),
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
  }, [organizationMemberIds, pointsWithStats])

  const organizationOptions = organizations.map((organization) => ({
    id: organization.id,
    label: organization.name?.trim() || `ארגון #${organization.id}`,
  }))

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
                  <div className="space-y-6">
                    <Skeleton className="h-56 w-full rounded-3xl" />
                    <Skeleton className="h-80 w-full rounded-3xl" />
                  </div>
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
                  <div className="space-y-6">
                    <Skeleton className="h-56 w-full rounded-3xl" />
                    <Skeleton className="h-80 w-full rounded-3xl" />
                  </div>
                ) : pointsError ? (
                  <Alert variant="destructive">
                    <CircleAlert className="size-4" />
                    <AlertTitle>הנקודות אינן זמינות</AlertTitle>
                    <AlertDescription>{pointsError}</AlertDescription>
                  </Alert>
                ) : points.length === 0 ? (
                  <Alert>
                    <MapPinned className="size-4" />
                    <AlertTitle>עדיין אין נקודות</AlertTitle>
                    <AlertDescription>
                      לארגון הזה אין כרגע נקודות שזמינות לחשבון שלך.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Card className="border-border/70 shadow-none">
                      <CardHeader className="gap-6 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-4">
                          <Badge
                            variant={
                              selectedOrganization.status === "active" ? "default" : "outline"
                            }
                            className="rounded-full"
                          >
                            <CheckCircle2 className="size-3.5" />
                            {selectedOrganization.status === "active"
                              ? "פעיל"
                              : selectedOrganization.status || "לא פעיל"}
                          </Badge>

                          <div className="flex items-start gap-3">
                            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15">
                              <Building2 className="size-5" />
                            </div>
                            <div className="space-y-2">
                              <CardTitle className="text-3xl">
                                {selectedOrganization.name?.trim() ||
                                  `ארגון #${selectedOrganization.id}`}
                              </CardTitle>
                              <CardDescription className="max-w-3xl text-sm leading-7">
                                {selectedOrganization.notes?.trim() ||
                                  "עדיין לא נוסף תיאור לארגון הזה."}
                              </CardDescription>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 md:w-[340px]">
                          <div className="rounded-xl border border-border bg-muted/30 p-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Users2 className="size-4" />
                              חברי ארגון
                            </div>
                            <div className="mt-2 text-2xl font-semibold">
                              {organizationMembersCount}
                            </div>
                            <div className="mt-3">
                              <MemberAvatarStack
                                memberIds={organizationMemberIds}
                                profilesById={profilesById}
                              />
                            </div>
                          </div>

                          <div className="rounded-xl border border-border bg-muted/30 p-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPinned className="size-4" />
                              נקודות פעילות
                            </div>
                            <div className="mt-2 text-2xl font-semibold">{points.length}</div>
                            <p className="mt-3 text-xs leading-6 text-muted-foreground">
                              כל נקודה מרכזת צוות, מסלולים ותיעוד שוטף.
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>

                    <Card className="border-border/70 shadow-none">
                      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-2">
                          <CardTitle className="flex items-center gap-2 text-xl">
                            <MapPinned className="size-5" />
                            נקודות הארגון
                          </CardTitle>
                          <CardDescription className="max-w-2xl leading-7">
                            בחרו נקודה כדי להמשיך לעמוד הייעודי שלה ולראות את המסלולים,
                            החברים והפעילות השוטפת בה.
                          </CardDescription>
                        </div>

                        <Badge variant="outline" className="rounded-full">
                          סה"כ {points.length} נקודות
                        </Badge>
                      </CardHeader>

                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {pointsWithStats.map((point) => (
                            <Card
                              key={point.id}
                              className="h-full border-border/70 shadow-none transition-colors hover:border-primary/35"
                            >
                              <CardHeader className="space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="space-y-1.5">
                                    <CardTitle className="text-xl">
                                      {point.name?.trim() || `נקודה #${point.id}`}
                                    </CardTitle>
                                    <CardDescription className="line-clamp-3 leading-6">
                                      {point.notes?.trim() ||
                                        "עדיין לא נוספו הערות לנקודה הזו."}
                                    </CardDescription>
                                  </div>
                                  <Badge
                                    variant={point.status === "active" ? "default" : "outline"}
                                    className="rounded-full"
                                  >
                                    {point.status === "active"
                                      ? "פעיל"
                                      : point.status || "לא פעיל"}
                                  </Badge>
                                </div>
                              </CardHeader>

                              <CardContent className="space-y-4">
                                <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Users2 className="size-4" />
                                      חברים
                                    </div>
                                    <MemberAvatarStack
                                      memberIds={point.memberIds}
                                      profilesById={profilesById}
                                      size="sm"
                                    />
                                  </div>
                                  <div className="text-2xl font-semibold">{point.membersCount}</div>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Route className="size-4" />
                                    מסלולים פעילים
                                  </div>
                                  <div className="text-xl font-semibold">{point.tracksCount}</div>
                                </div>

                                <Button
                                  className="group h-11 w-full justify-between rounded-xl"
                                  variant="outline"
                                  onClick={() => handlePointOpen(point)}
                                >
                                  מעבר לעמוד הנקודה
                                  <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-1" />
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function MemberAvatarStack({
  memberIds,
  profilesById,
  size = "default",
}: {
  memberIds: string[]
  profilesById: Record<string, ProfileSummary>
  size?: "default" | "sm"
}) {
  const visibleMemberIds = memberIds.slice(0, 3)
  const overflowCount = Math.max(memberIds.length - visibleMemberIds.length, 0)

  if (visibleMemberIds.length === 0) {
    return <div className="text-xs text-muted-foreground">עדיין אין חברים זמינים להצגה</div>
  }

  return (
    <AvatarGroup>
      {visibleMemberIds.map((memberId) => {
        const member = profilesById[memberId]

        return (
          <Avatar key={memberId} size={size}>
            <AvatarImage
              src={member?.avatar_url ?? undefined}
              alt={member?.display_name ?? "חבר צוות"}
            />
            <AvatarFallback>{getAvatarInitials(member?.display_name)}</AvatarFallback>
          </Avatar>
        )
      })}
      {overflowCount > 0 ? <AvatarGroupCount>+{overflowCount}</AvatarGroupCount> : null}
    </AvatarGroup>
  )
}
