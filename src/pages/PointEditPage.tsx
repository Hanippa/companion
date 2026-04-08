import { useEffect, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CircleAlert, PencilLine, SaveIcon } from "lucide-react"

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
import { Input } from "@/components/ui/input"
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

export default function PointEditPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { organizationSlug, pointSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)
  const pointIdFromRoute = getRecordIdFromSegment(pointSlug)

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
    let isMounted = true

    const fetchPointAndPermissions = async () => {
      if (!selectedOrganization || pointIdFromRoute === null) {
        setLoadingPoint(false)
        setLoadingPermissions(false)
        return
      }

      setLoadingPoint(true)
      setPointError(null)
      setLoadingPermissions(true)
      setSaveMessage(null)
      setSaveError(null)

      const [pointResult, permissionResult] = await Promise.all([
        supabase
          .from("points")
          .select("id, organization_id, name, notes, status")
          .eq("id", pointIdFromRoute)
          .single(),
        supabase
          .from("organization_users")
          .select("role")
          .eq("organization_id", selectedOrganization.id)
          .eq("user_id", user?.id ?? "")
          .eq("status", "active")
          .in("role", ["admin", "owner"]),
      ])

      if (!isMounted) {
        return
      }

      if (permissionResult.error) {
        console.error("Error fetching edit permissions:", permissionResult.error)
        setCanEdit(false)
      } else {
        setCanEdit((permissionResult.data ?? []).length > 0)
      }
      setLoadingPermissions(false)

      if (pointResult.error || !pointResult.data) {
        console.error("Error fetching point:", pointResult.error)
        setPoint(null)
        setPointError("We couldn't load this point right now.")
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
    navigate,
    organizationSlug,
    pointIdFromRoute,
    pointSlug,
    selectedOrganization,
    user,
  ])

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

    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const handlePointSave = async () => {
    if (!point || !canEdit) {
      return
    }

    setSavingPoint(true)
    setSaveError(null)
    setSaveMessage(null)

    const nextName = pointName.trim() || null
    const nextNotes = pointNotes.trim() || null

    const { error } = await supabase
      .from("points")
      .update({
        name: nextName,
        notes: nextNotes,
      })
      .eq("id", point.id)

    if (error) {
      console.error("Error saving point:", error)
      setSaveError("We couldn't save this point right now.")
      setSavingPoint(false)
      return
    }

    const nextPoint = {
      ...point,
      name: nextName,
      notes: nextNotes,
    }

    setPoint(nextPoint)
    setSaveMessage("Point details updated.")
    setSavingPoint(false)

    if (selectedOrganization) {
      navigate(
        `/${getOrganizationSegment(selectedOrganization)}/${getPointSegment(nextPoint)}/edit`,
        { replace: true }
      )
    }
  }

  const handleBackToPoint = () => {
    if (!selectedOrganization || !point) {
      navigate("/dashboard")
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
          title="עריכת נקודה"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PencilLine className="size-5" />
                      Edit point
                    </CardTitle>
                    <CardDescription>
                      Update point details in a dedicated admin page.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {loadingOrganizations || loadingPoint ? (
                      <div className="space-y-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-32 w-full" />
                      </div>
                    ) : organizationsError || pointError ? (
                      <Alert variant="destructive">
                        <CircleAlert className="size-4" />
                        <AlertTitle>Point unavailable</AlertTitle>
                        <AlertDescription>
                          {pointError || organizationsError || "We couldn't load this page."}
                        </AlertDescription>
                      </Alert>
                    ) : !canEdit && !loadingPermissions ? (
                      <Alert variant="destructive">
                        <CircleAlert className="size-4" />
                        <AlertTitle>No edit access</AlertTitle>
                        <AlertDescription>
                          Only organization owners and admins can edit this point.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <>
                        {saveError ? (
                          <Alert variant="destructive">
                            <AlertTitle>Point not saved</AlertTitle>
                            <AlertDescription>{saveError}</AlertDescription>
                          </Alert>
                        ) : null}
                        {saveMessage ? (
                          <Alert>
                            <AlertTitle>Point updated</AlertTitle>
                            <AlertDescription>{saveMessage}</AlertDescription>
                          </Alert>
                        ) : null}

                        <div className="space-y-2">
                          <label htmlFor="point-name" className="text-sm font-medium">
                            Point name
                          </label>
                          <Input
                            id="point-name"
                            value={pointName}
                            onChange={(event) => setPointName(event.target.value)}
                            disabled={loadingPermissions || !canEdit}
                          />
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="point-notes" className="text-sm font-medium">
                            Notes
                          </label>
                          <textarea
                            id="point-notes"
                            value={pointNotes}
                            onChange={(event) => setPointNotes(event.target.value)}
                            disabled={loadingPermissions || !canEdit}
                            className="min-h-40 w-full rounded-3xl border border-input bg-input/30 px-4 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                          />
                        </div>

                        <div className="flex flex-wrap justify-end gap-3">
                          <Button variant="outline" onClick={handleBackToPoint}>
                            Back to point
                          </Button>
                          <Button onClick={handlePointSave} disabled={savingPoint || !canEdit}>
                            <SaveIcon className="size-4" />
                            {savingPoint ? "Saving..." : "Save point"}
                          </Button>
                        </div>

                        {point ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">Point ID {point.id}</Badge>
                            <Badge variant="outline" className="uppercase">
                              {point.status || "active"}
                            </Badge>
                          </div>
                        ) : null}
                      </>
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
