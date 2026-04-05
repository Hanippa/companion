import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Building2,
  CircleAlert,
  MapPinned,
  PencilLine,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { getAvatarInitials, resolveAvatarUrl } from "@/lib/avatar"
import {
  getOrganizationSegment,
  getPointSegment,
  getRecordIdFromSegment,
} from "@/lib/drilldown"
import { supabase } from "@/lib/supabase"

type Organization = {
  id: number
  name: string | null
  notes: string | null
  status: string | null
}

type Track = {
  id: number
  point_id: number
  name: string | null
  notes: string | null
  status: string | null
}

type ProfileRecord = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

type PointMember = {
  point_id: number
  user_id: string
  role: string | null
  status: string | null
  title?: string | null
  profile: ProfileRecord | null
  avatarUrl?: string
}

const formatMemberName = (member: PointMember) =>
  member.profile?.display_name?.trim() || member.title?.trim() || "משתמש בצוות"

const formatMemberMeta = (member: PointMember) =>
  [member.title?.trim(), member.status?.trim()].filter(Boolean).join(" · ") || "חבר נקודה פעיל"

export default function PointPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { organizationSlug, pointSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)
  const pointIdFromRoute = getRecordIdFromSegment(pointSlug)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)
  const [loadingPoint, setLoadingPoint] = useState(true)
  const [pointError, setPointError] = useState<string | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loadingTracks, setLoadingTracks] = useState(true)
  const [tracksError, setTracksError] = useState<string | null>(null)
  const [members, setMembers] = useState<PointMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [loadingPermissions, setLoadingPermissions] = useState(true)
  const [pointName, setPointName] = useState("")
  const [pointNotes, setPointNotes] = useState("")

  useEffect(() => {
    let isMounted = true

    const fetchOrganizations = async () => {
      setLoadingOrganizations(true)
      setOrganizationsError(null)

      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, notes, status")
        .order("name", { ascending: true, nullsFirst: false })

      if (!isMounted) {
        return
      }

      if (error) {
        console.error("Error fetching organizations:", error)
        setOrganizations([])
        setOrganizationsError("לא הצלחנו לטעון את הארגונים שלך כרגע.")
        setLoadingOrganizations(false)
        return
      }

      setOrganizations(data ?? [])
      setLoadingOrganizations(false)
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
    if (loadingOrganizations || organizationsError || organizations.length === 0) {
      return
    }

    if (!selectedOrganization || organizationIdFromRoute === null || pointIdFromRoute === null) {
      navigate("/dashboard", { replace: true })
      return
    }

    const expectedOrganizationSegment = getOrganizationSegment(selectedOrganization)
    if (organizationSlug !== expectedOrganizationSegment) {
      navigate(`/${expectedOrganizationSegment}/${pointSlug ?? ""}`, { replace: true })
    }
  }, [
    loadingOrganizations,
    organizations,
    organizationsError,
    navigate,
    organizationIdFromRoute,
    organizationSlug,
    pointIdFromRoute,
    pointSlug,
    selectedOrganization,
  ])

  const organizationOptions = organizations.map((organization) => ({
    id: organization.id,
    label: organization.name?.trim() || `Organization #${organization.id}`,
  }))

  useEffect(() => {
    let isMounted = true

    const fetchPointDetails = async () => {
      if (!selectedOrganization || pointIdFromRoute === null) {
        setLoadingPoint(false)
        setLoadingTracks(false)
        setLoadingMembers(false)
        setLoadingPermissions(false)
        return
      }

      setLoadingPoint(true)
      setPointError(null)
      setLoadingTracks(true)
      setTracksError(null)
      setLoadingMembers(true)
      setMembersError(null)
      setLoadingPermissions(true)

      const [tracksResult, membersResult, permissionResult, pointResult] = await Promise.all([
        supabase
          .from("tracks")
          .select("id, point_id, name, notes, status")
          .eq("point_id", pointIdFromRoute)
          .order("name", { ascending: true, nullsFirst: false }),
        supabase
          .from("point_users")
          .select("point_id, user_id, role, status, title")
          .eq("point_id", pointIdFromRoute)
          .order("user_id", { ascending: true }),
        supabase
          .from("organization_users")
          .select("role")
          .eq("organization_id", selectedOrganization.id)
          .eq("user_id", user?.id ?? "")
          .eq("status", "active")
          .in("role", ["admin", "owner"]),
        supabase
          .from("points")
          .select("id, organization_id, name, notes, status")
          .eq("id", pointIdFromRoute)
          .single(),
      ])

      if (!isMounted) {
        return
      }

      if (pointResult.error || !pointResult.data) {
        console.error("Error fetching point:", pointResult.error)
        setPointError("לא הצלחנו לטעון את הנקודה הזו כרגע.")
        setLoadingPoint(false)
        navigate(`/${getOrganizationSegment(selectedOrganization)}`, { replace: true })
        return
      }

      const point = pointResult.data
      if (point.organization_id !== selectedOrganization.id) {
        setPointError("הנקודה הזו לא שייכת לארגון שנבחר.")
        setLoadingPoint(false)
        navigate(`/${getOrganizationSegment(selectedOrganization)}`, { replace: true })
        return
      }

      const expectedPointSegment = getPointSegment(point)
      if (pointSlug !== expectedPointSegment) {
        navigate(`/${getOrganizationSegment(selectedOrganization)}/${expectedPointSegment}`, {
          replace: true,
        })
      }

      setPointName(point.name?.trim() || "")
      setPointNotes(point.notes?.trim() || "")
      setLoadingPoint(false)

      if (tracksResult.error) {
        console.error("Error fetching tracks:", tracksResult.error)
        setTracks([])
        setTracksError("לא הצלחנו לטעון את המסלולים של הנקודה הזו כרגע.")
      } else {
        setTracks(tracksResult.data ?? [])
      }
      setLoadingTracks(false)

      if (permissionResult.error) {
        console.error("Error fetching point permissions:", permissionResult.error)
        setCanEdit(false)
      } else {
        setCanEdit((permissionResult.data ?? []).length > 0)
      }
      setLoadingPermissions(false)

      if (membersResult.error) {
        console.error("Error fetching point members:", membersResult.error)
        setMembers([])
        setMembersError("לא הצלחנו לטעון את חברי הנקודה כרגע.")
        setLoadingMembers(false)
        return
      }

      const memberRows = membersResult.data ?? []
      const userIds = memberRows.map((member) => member.user_id)

      if (userIds.length === 0) {
        setMembers([])
        setLoadingMembers(false)
        return
      }

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds)

      if (!isMounted) {
        return
      }

      if (profilesError) {
        console.error("Error fetching point member profiles:", profilesError)
        setMembers(
          memberRows.map((member) => ({
            ...member,
            profile: null,
          }))
        )
        setMembersError("לא הצלחנו לטעון את פרטי החברים בנקודה כרגע.")
        setLoadingMembers(false)
        return
      }

      const profilesById = new Map(
        (profileRows ?? []).map((profile) => [profile.id, profile] as const)
      )

      const nextMembers = await Promise.all(
        memberRows.map(async (member) => {
          const profile = profilesById.get(member.user_id) ?? null
          return {
            ...member,
            profile,
            avatarUrl: await resolveAvatarUrl(profile?.avatar_url),
          }
        })
      )

      if (!isMounted) {
        return
      }

      setMembers(nextMembers)
      setLoadingMembers(false)
    }

    if (user) {
      void fetchPointDetails()
    }

    return () => {
      isMounted = false
    }
  }, [navigate, pointIdFromRoute, pointSlug, selectedOrganization, user])

  const currentPoint = useMemo(
    () =>
      pointIdFromRoute !== null
        ? {
            id: pointIdFromRoute,
            organization_id: selectedOrganization?.id ?? 0,
            name: pointName || null,
            notes: pointNotes || null,
            status: null,
          }
        : null,
    [pointIdFromRoute, pointName, pointNotes, selectedOrganization?.id]
  )

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find(
      (organization) => organization.id.toString() === value
    )

    if (!nextOrganization) {
      return
    }

    navigate(`/${getOrganizationSegment(nextOrganization)}`)
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
      <AppSidebar side="right" variant="inset" tracks={tracks} tracksLoading={loadingTracks} />
      <SidebarInset>
        <SiteHeader
          title={pointName || "נקודה"}
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-5 md:py-5">
              {loadingOrganizations || loadingPoint ? (
                <div className="px-4 lg:px-6">
                  <div className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
                    <Card className="xl:sticky xl:top-6 xl:h-fit">
                      <CardHeader>
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-full" />
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Skeleton className="h-20 w-full" />
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                        <Skeleton className="h-28 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </CardContent>
                    </Card>

                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <Skeleton className="h-6 w-32" />
                          <Skeleton className="h-4 w-64" />
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                            <Skeleton className="h-32 w-full" />
                            <Skeleton className="h-32 w-full" />
                            <Skeleton className="h-32 w-full" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <Skeleton className="h-6 w-32" />
                          <Skeleton className="h-4 w-56" />
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              ) : organizationsError || pointError ? (
                <div className="px-4 lg:px-6">
                  <Alert variant="destructive">
                    <CircleAlert className="size-4" />
                    <AlertTitle>הנקודה לא זמינה</AlertTitle>
                    <AlertDescription>
                      {pointError || organizationsError || "לא הצלחנו לטעון את הנקודה הזו כרגע."}
                    </AlertDescription>
                  </Alert>
                </div>
              ) : !selectedOrganization ? (
                <div className="px-4 lg:px-6">
                  <Alert variant="destructive">
                    <CircleAlert className="size-4" />
                    <AlertTitle>הנקודה לא זמינה</AlertTitle>
                    <AlertDescription>
                      לא הצלחנו לזהות את הארגון עבור הנקודה הזו.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="px-4 lg:px-6">
                  <div className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
                    <Card className="xl:sticky xl:top-6 xl:h-fit">
                      <CardHeader className="gap-1.5">
                        <CardTitle className="flex items-center gap-2">
                          <MapPinned className="size-5" />
                          פרטי נקודה
                        </CardTitle>
                        <CardDescription>
                          מבט מרוכז על הצוות, המסלולים והמידע המשלים של הנקודה.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 ring-1 ring-border/40">
                          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            <Building2 className="size-3.5" />
                            ארגון
                          </div>
                          <div className="mt-2 text-base font-semibold leading-tight">
                            {selectedOrganization.name?.trim() ||
                              `Organization #${selectedOrganization.id}`}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-background/80 px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-border/50">
                              {selectedOrganization.status || "active"}
                            </span>
                            {canEdit ? (
                              <span className="rounded-full bg-background/80 px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-border/50">
                                גישת ניהול
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                          <div className="rounded-3xl bg-card/70 p-3.5 ring-1 ring-border/50 backdrop-blur-sm">
                            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                              מסלולים
                            </div>
                            <div className="mt-1.5 text-2xl font-semibold">{tracks.length}</div>
                            <div className="mt-1 text-xs text-muted-foreground">במרכז העבודה של הנקודה</div>
                          </div>
                          <div className="rounded-3xl bg-card/70 p-3.5 ring-1 ring-border/50 backdrop-blur-sm">
                            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                              חברים
                            </div>
                            <div className="mt-1.5 text-2xl font-semibold">{members.length}</div>
                            <div className="mt-1 text-xs text-muted-foreground">משויכים כרגע לנקודה הזו</div>
                          </div>
                        </div>

                        <div className="rounded-3xl bg-muted/35 p-4 ring-1 ring-border/40">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <MapPinned className="size-4 text-primary" />
                            הערות וסיכום
                          </div>
                          <div className="mt-3">
                            <p className="text-sm leading-6 text-muted-foreground">
                              {pointNotes || "עדיין לא נוספו הערות לנקודה הזו."}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-3xl border border-dashed border-border/60 bg-background/70 p-4">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <ShieldCheck className="size-4 text-primary" />
                            גישה וניהול
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            עריכת הנקודה נשארת בעמוד נפרד כדי לשמור על תצוגת הקריאה נקייה ופשוטה.
                          </div>
                        </div>

                        {canEdit ? (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() =>
                              navigate(
                                `/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(
                                  currentPoint ?? {
                                    id: pointIdFromRoute ?? 0,
                                    organization_id: selectedOrganization.id,
                                    name: pointName || null,
                                    notes: pointNotes || null,
                                    status: null,
                                  }
                                )}/edit`
                              )
                            }
                            disabled={loadingPermissions || !currentPoint}
                          >
                            <PencilLine className="size-4" />
                            עריכת נקודה
                          </Button>
                        ) : (
                          <Alert>
                            <AlertTitle>תצוגה לקריאה בלבד</AlertTitle>
                            <AlertDescription>
                              עריכה זמינה רק לבעלי הארגון ולמנהלים.
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>

                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Route className="size-5" />
                            מסלולים
                          </CardTitle>
                          <CardDescription>
                            המסלולים הם אזור העבודה המרכזי של הנקודה הזו.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {loadingTracks ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <Skeleton className="h-32 w-full" />
                              <Skeleton className="h-32 w-full" />
                              <Skeleton className="h-32 w-full" />
                              <Skeleton className="h-32 w-full" />
                            </div>
                          ) : tracksError ? (
                            <Alert variant="destructive">
                              <AlertTitle>המסלולים לא זמינים</AlertTitle>
                              <AlertDescription>{tracksError}</AlertDescription>
                            </Alert>
                          ) : tracks.length === 0 ? (
                            <Alert>
                              <AlertTitle>אין עדיין מסלולים</AlertTitle>
                              <AlertDescription>
                                לנקודה הזו עדיין אין מסלולים גלויים עבור החשבון שלך.
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                              {tracks.map((track) => (
                                <Card
                                  key={track.id}
                                  size="sm"
                                  className="border border-border/60 bg-muted/10"
                                >
                                  <CardHeader>
                                    <CardTitle>{track.name?.trim() || `מסלול #${track.id}`}</CardTitle>
                                    <CardDescription>
                                      {track.notes?.trim() || "עדיין לא נוספו הערות למסלול הזה."}
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent className="flex items-center justify-between gap-3">
                                    <Badge variant="outline" className="uppercase">
                                      {track.status || "active"}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      מסלול #{track.id}
                                    </span>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Users className="size-5" />
                            חברי נקודה
                          </CardTitle>
                          <CardDescription>
                            האנשים שמשויכים כרגע לנקודה הזו.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {loadingMembers ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <Skeleton className="h-24 w-full" />
                              <Skeleton className="h-24 w-full" />
                              <Skeleton className="h-24 w-full" />
                              <Skeleton className="h-24 w-full" />
                            </div>
                          ) : membersError ? (
                            <Alert variant="destructive">
                              <AlertTitle>חברי הנקודה לא זמינים</AlertTitle>
                              <AlertDescription>{membersError}</AlertDescription>
                            </Alert>
                          ) : members.length === 0 ? (
                            <Alert>
                              <AlertTitle>אין עדיין חברים</AlertTitle>
                              <AlertDescription>
                                לנקודה הזו עדיין אין חברים גלויים עבור החשבון שלך.
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                              {members.map((member) => (
                                <Card
                                  key={`${member.point_id}-${member.user_id}`}
                                  size="sm"
                                  className="border border-border/60"
                                >
                                  <CardContent className="flex items-center gap-3 py-4">
                                    <Avatar className="size-11 rounded-2xl">
                                      <AvatarImage
                                        src={member.avatarUrl}
                                        alt={formatMemberName(member)}
                                      />
                                      <AvatarFallback className="rounded-2xl">
                                        {getAvatarInitials(
                                          member.profile?.display_name,
                                          member.user_id
                                        )}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate font-medium">
                                        {formatMemberName(member)}
                                      </div>
                                      <div className="truncate text-xs text-muted-foreground">
                                        {formatMemberMeta(member)}
                                      </div>
                                    </div>
                                    <Badge variant="outline" className="uppercase">
                                      {member.role || "member"}
                                    </Badge>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
