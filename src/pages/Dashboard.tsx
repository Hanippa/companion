import { useEffect, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Building2, CheckCircle2, CircleAlert, MapPinned } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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

type Point = {
  id: number
  organization_id: number
  name: string | null
  notes: string | null
  status: string | null
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
  const [loadingPoints, setLoadingPoints] = useState(false)
  const [pointsError, setPointsError] = useState<string | null>(null)

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
        setSelectedOrganizationId("")
        setOrganizationsError("We couldn't load your organizations right now.")
        setLoadingOrganizations(false)
        return
      }

      const nextOrganizations = data ?? []
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
      setLoadingOrganizations(false)
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

  const selectedOrganization = organizations.find((organization) => {
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
        setPointsError(null)
        setLoadingPoints(false)
        return
      }

      setLoadingPoints(true)
      setPointsError(null)

      const { data, error } = await supabase
        .from("points")
        .select("id, organization_id, name, notes, status")
        .eq("organization_id", selectedOrganization.id)
        .order("name", { ascending: true, nullsFirst: false })

      if (!isMounted) {
        return
      }

      if (error) {
        console.error("Error fetching points:", error)
        setPoints([])
        setPointsError("We couldn't load the points for this organization right now.")
        setLoadingPoints(false)
        return
      }

      setPoints(data ?? [])
      setLoadingPoints(false)
    }

    void fetchPoints()

    return () => {
      isMounted = false
    }
  }, [selectedOrganization])

  const organizationOptions = organizations.map((organization) => ({
    id: organization.id,
    label: organization.name?.trim() || `Organization #${organization.id}`,
  }))

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find(
      (organization) => organization.id.toString() === value
    )

    if (!nextOrganization) {
      return
    }

    setSelectedOrganizationId(value)
    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const handlePointOpen = (point: Point) => {
    if (!selectedOrganization) {
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
      <SidebarInset>
        <SiteHeader
          title={selectedOrganization?.name?.trim() || "Dashboard"}
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganizationId}
          onOrganizationChange={handleOrganizationChange}
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPinned className="size-5" />
                      Points
                    </CardTitle>
                    <CardDescription>
                      Choose a point to move into its dedicated page with members, tracks, and
                      management tools.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loadingOrganizations ? (
                      <div className="space-y-3">
                        <Skeleton className="h-10 w-full max-w-64" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                    ) : organizationsError ? (
                      <Alert variant="destructive">
                        <CircleAlert className="size-4" />
                        <AlertTitle>Organizations unavailable</AlertTitle>
                        <AlertDescription>{organizationsError}</AlertDescription>
                      </Alert>
                    ) : organizations.length === 0 ? (
                      <Alert>
                        <CircleAlert className="size-4" />
                        <AlertTitle>No organizations yet</AlertTitle>
                        <AlertDescription>
                          No organizations are currently visible for this account.
                        </AlertDescription>
                      </Alert>
                    ) : !selectedOrganization ? (
                      <Alert>
                        <Building2 className="size-4" />
                        <AlertTitle>Select an organization</AlertTitle>
                        <AlertDescription>
                          The organization switcher appears in the top bar when you have more than
                          one option.
                        </AlertDescription>
                      </Alert>
                    ) : loadingPoints ? (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <Skeleton className="h-40 w-full" />
                        <Skeleton className="h-40 w-full" />
                        <Skeleton className="h-40 w-full" />
                      </div>
                    ) : pointsError ? (
                      <Alert variant="destructive">
                        <CircleAlert className="size-4" />
                        <AlertTitle>Points unavailable</AlertTitle>
                        <AlertDescription>{pointsError}</AlertDescription>
                      </Alert>
                    ) : points.length === 0 ? (
                      <Alert>
                        <MapPinned className="size-4" />
                        <AlertTitle>No points yet</AlertTitle>
                        <AlertDescription>
                          This organization does not have any visible points for your account.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                          <div className="space-y-2">
                            <div className="text-base font-medium">
                              {selectedOrganization.name?.trim() ||
                                `Organization #${selectedOrganization.id}`}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {selectedOrganization.notes?.trim() ||
                                "No notes were added for this organization."}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="uppercase">
                              <CheckCircle2 className="size-3.5" />
                              {selectedOrganization.status || "active"}
                            </Badge>
                            <Badge variant="outline">{points.length} points</Badge>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {points.map((point) => (
                            <Card key={point.id}>
                              <CardHeader>
                                <CardTitle>{point.name?.trim() || `Point #${point.id}`}</CardTitle>
                                <CardDescription>
                                  {point.notes?.trim() || "No notes were added for this point."}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="flex items-center justify-between gap-3">
                                <Badge variant="outline" className="uppercase">
                                  {point.status || "active"}
                                </Badge>
                                <Button variant="outline" onClick={() => handlePointOpen(point)}>
                                  Open point
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
