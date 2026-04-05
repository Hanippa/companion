import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Building2,
  CircleAlert,
  PencilLine,
  MapPinned,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
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
        setOrganizationsError("We couldn't load your organizations right now.")
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

      const [
        tracksResult,
        membersResult,
        permissionResult,
        pointResult,
      ] = await Promise.all([
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
        setPointError("We couldn't load this point right now.")
        setLoadingPoint(false)
        navigate(`/${getOrganizationSegment(selectedOrganization)}`, { replace: true })
        return
      }

      const point = pointResult.data
      if (point.organization_id !== selectedOrganization.id) {
        setPointError("This point does not belong to the selected organization.")
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
        setTracksError("We couldn't load the tracks for this point right now.")
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
        setMembersError("We couldn't load the members for this point right now.")
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
        setMembersError("We couldn't load the member profiles for this point right now.")
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
          title={pointName || "Point"}
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {loadingOrganizations || loadingPoint ? (
                <div className="px-4 lg:px-6">
                  <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <Card className="xl:sticky xl:top-6 xl:h-fit">
                      <CardHeader>
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-full" />
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Skeleton className="h-20 w-full" />
                        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                          <Skeleton className="h-24 w-full" />
                          <Skeleton className="h-24 w-full" />
                          <Skeleton className="h-24 w-full" />
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
                    <AlertTitle>Point unavailable</AlertTitle>
                    <AlertDescription>
                      {pointError || organizationsError || "We couldn't load this point right now."}
                    </AlertDescription>
                  </Alert>
                </div>
              ) : !selectedOrganization ? (
                <div className="px-4 lg:px-6">
                  <Alert variant="destructive">
                    <CircleAlert className="size-4" />
                    <AlertTitle>Point unavailable</AlertTitle>
                    <AlertDescription>
                      We couldn't resolve the organization for this point.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <>
                  <div className="px-4 lg:px-6">
                    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                      <Card className="xl:sticky xl:top-6 xl:h-fit">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <MapPinned className="size-5" />
                            {pointName || `Point #${pointIdFromRoute}`}
                          </CardTitle>
                          <CardDescription>
                            Dedicated point view with organized context and a central track workspace.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                            <div className="text-sm font-medium">
                              {selectedOrganization.name?.trim() ||
                                `Organization #${selectedOrganization.id}`}
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              /{getOrganizationSegment(selectedOrganization)}/
                              {currentPoint ? getPointSegment(currentPoint) : pointSlug}
                            </div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                            <div className="rounded-2xl border border-border/60 p-4">
                              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                Tracks
                              </div>
                              <div className="mt-2 text-2xl font-semibold">{tracks.length}</div>
                            </div>
                            <div className="rounded-2xl border border-border/60 p-4">
                              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                Members
                              </div>
                              <div className="mt-2 text-2xl font-semibold">{members.length}</div>
                            </div>
                            <div className="rounded-2xl border border-border/60 p-4">
                              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                Point ID
                              </div>
                              <div className="mt-2 text-2xl font-semibold">{pointIdFromRoute}</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="uppercase">
                              <Building2 className="size-3.5" />
                              {selectedOrganization.status || "active"}
                            </Badge>
                            {canEdit ? (
                              <Badge variant="outline" className="uppercase">
                                <ShieldCheck className="size-3.5" />
                                Admin access
                              </Badge>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <div className="text-sm font-medium">Point notes</div>
                            <div className="min-h-32 rounded-2xl border border-input bg-input/20 px-4 py-3 text-sm text-muted-foreground">
                              {pointNotes || "No notes were added for this point."}
                            </div>
                          </div>

                          {canEdit ? (
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() =>
                                navigate(
                                  `/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(currentPoint ?? {
                                    id: pointIdFromRoute ?? 0,
                                    organization_id: selectedOrganization.id,
                                    name: pointName || null,
                                    notes: pointNotes || null,
                                    status: null,
                                  })}/edit`
                                )
                              }
                              disabled={loadingPermissions || !currentPoint}
                            >
                              <PencilLine className="size-4" />
                              Edit point
                            </Button>
                          ) : (
                            <Alert>
                              <AlertTitle>Read-only view</AlertTitle>
                              <AlertDescription>
                                Editing is available only to organization owners and admins.
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
                              Tracks
                            </CardTitle>
                            <CardDescription>
                              Tracks are the main working surface for this point.
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
                                <AlertTitle>Tracks unavailable</AlertTitle>
                                <AlertDescription>{tracksError}</AlertDescription>
                              </Alert>
                            ) : tracks.length === 0 ? (
                              <Alert>
                                <AlertTitle>No tracks yet</AlertTitle>
                                <AlertDescription>
                                  This point does not have any visible tracks for your account.
                                </AlertDescription>
                              </Alert>
                            ) : (
                              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                                {tracks.map((track) => (
                                  <Card key={track.id} size="sm" className="border border-border/60 bg-muted/10">
                                    <CardHeader>
                                      <CardTitle>{track.name?.trim() || `Track #${track.id}`}</CardTitle>
                                      <CardDescription>
                                        {track.notes?.trim() || "No notes were added for this track."}
                                      </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex items-center justify-between gap-3">
                                      <Badge variant="outline" className="uppercase">
                                        {track.status || "active"}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        Track #{track.id}
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
                              Members
                            </CardTitle>
                            <CardDescription>
                              People currently assigned to this point.
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
                                <AlertTitle>Members unavailable</AlertTitle>
                                <AlertDescription>{membersError}</AlertDescription>
                              </Alert>
                            ) : members.length === 0 ? (
                              <Alert>
                                <AlertTitle>No members yet</AlertTitle>
                                <AlertDescription>
                                  This point does not have any visible members for your account.
                                </AlertDescription>
                              </Alert>
                            ) : (
                              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                                {members.map((member) => (
                                  <Card key={`${member.point_id}-${member.user_id}`} size="sm" className="border border-border/60">
                                    <CardContent className="flex items-center gap-3 py-4">
                                      <Avatar className="size-11 rounded-2xl">
                                        <AvatarImage
                                          src={member.avatarUrl}
                                          alt={member.profile?.display_name || member.user_id}
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
                                        {member.profile?.display_name ||
                                          member.title ||
                                          member.user_id}
                                      </div>
                                      <div className="truncate text-xs text-muted-foreground">
                                        {member.title || "No point title"}
                                      </div>
                                    </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <Badge variant="outline" className="uppercase">
                                          {member.role || "member"}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {member.status || "active"}
                                        </span>
                                      </div>
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
                </>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
