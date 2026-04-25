import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CircleAlert, Copy, ShieldUser, UserPlus } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { getOrganizationSegment, getRecordIdFromSegment } from "@/lib/drilldown"
import { getOrganizationsCached } from "@/lib/organizations"
import { supabase } from "@/lib/supabase"

type Organization = {
  id: number
  name: string | null
  notes: string | null
  status: string | null
}

const ROLE_OPTIONS = [
  { value: "member", label: "חבר צוות" },
  { value: "admin", label: "מנהל ארגון" },
  { value: "owner", label: "בעל ארגון" },
]

function generateTemporaryPassword() {
  return `Comp-${Math.random().toString(36).slice(2, 8)}A1!`
}

export default function OrganizationMemberCreatePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { organizationSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [loadingPermissions, setLoadingPermissions] = useState(true)
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [title, setTitle] = useState("")
  const [role, setRole] = useState("member")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadOrganizations = async () => {
      setLoadingOrganizations(true)
      setOrganizationsError(null)

      try {
        const nextOrganizations = await getOrganizationsCached()
        if (!isMounted) return
        setOrganizations(nextOrganizations)
      } catch (error) {
        if (!isMounted) return
        console.error("Error loading organizations:", error)
        setOrganizations([])
        setOrganizationsError("לא הצלחנו לטעון את הארגונים שלך כרגע.")
      } finally {
        if (isMounted) {
          setLoadingOrganizations(false)
        }
      }
    }

    void loadOrganizations()

    return () => {
      isMounted = false
    }
  }, [])

  const selectedOrganization =
    organizations.find((organization) => organization.id === organizationIdFromRoute) ?? null

  useEffect(() => {
    if (loadingOrganizations || organizationsError || organizations.length === 0) return

    if (!selectedOrganization || organizationIdFromRoute === null) {
      navigate("/dashboard", { replace: true })
      return
    }

    const expectedSegment = getOrganizationSegment(selectedOrganization)
    if (expectedSegment !== organizationSlug) {
      navigate(`/${expectedSegment}/team/new`, { replace: true })
    }
  }, [
    loadingOrganizations,
    organizations,
    organizationsError,
    navigate,
    organizationIdFromRoute,
    organizationSlug,
    selectedOrganization,
  ])

  useEffect(() => {
    let isMounted = true

    const loadPermissions = async () => {
      if (!selectedOrganization) {
        setCanManage(false)
        setLoadingPermissions(false)
        return
      }

      setLoadingPermissions(true)

      try {
        const { data, error } = await supabase
          .from("organization_users")
          .select("role")
          .eq("organization_id", selectedOrganization.id)
          .eq("user_id", user?.id ?? "")
          .eq("status", "active")
          .eq("role", "owner")

        if (error) throw error
        if (!isMounted) return
        setCanManage((data ?? []).length > 0)
      } catch (error) {
        if (!isMounted) return
        console.error("Error loading organization member create permissions:", error)
        setCanManage(false)
      } finally {
        if (isMounted) {
          setLoadingPermissions(false)
        }
      }
    }

    if (selectedOrganization) {
      void loadPermissions()
    }

    return () => {
      isMounted = false
    }
  }, [selectedOrganization, user?.id])

  const organizationOptions = useMemo(
    () =>
      organizations.map((organization) => ({
        id: organization.id,
        label: organization.name?.trim() || `ארגון #${organization.id}`,
      })),
    [organizations]
  )

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find((organization) => organization.id.toString() === value)
    if (!nextOrganization) return
    navigate(`/${getOrganizationSegment(nextOrganization)}/team/new`)
  }

  const handleBack = () => {
    if (!selectedOrganization) {
      navigate("/dashboard")
      return
    }

    navigate(`/${getOrganizationSegment(selectedOrganization)}/team`)
  }

  const handleCopyPassword = async () => {
    if (!createdPassword) return
    await navigator.clipboard.writeText(createdPassword)
    setSaveMessage("הסיסמה הזמנית הועתקה.")
  }

  const handleCreateUser = async () => {
    if (!selectedOrganization || !canManage) return

    setSaving(true)
    setSaveError(null)
    setSaveMessage(null)
    setCreatedPassword(null)

    const temporaryPassword = generateTemporaryPassword()

    try {
      const { data, error } = await supabase.functions.invoke("create-user-owner", {
        body: {
          email: email.trim(),
          password: temporaryPassword,
          display_name: displayName.trim(),
          name: displayName.trim(),
          organization_id: selectedOrganization.id,
          role,
          title: title.trim() || null,
        },
      })

      if (error) throw error

      const createdEmail = (data as { user?: { email?: string } } | null)?.user?.email ?? email.trim()

      setSaveMessage(`המשתמש נוצר בהצלחה עבור ${createdEmail}.`)
      setCreatedPassword(temporaryPassword)
      setEmail("")
      setDisplayName("")
      setTitle("")
      setRole("member")
    } catch (error) {
      console.error("Error creating managed user:", error)
      setSaveError("לא הצלחנו ליצור את המשתמש כרגע.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as CSSProperties}>
      <AppSidebar side="right" variant="inset" />
      <SidebarInset dir="rtl">
        <SiteHeader
          title="יצירת חבר ארגון"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />

        <PageBody>
          <div className="page-stack flex-1">
            {loadingOrganizations || loadingPermissions ? (
              <PageMainLayout>
                <PageMainRail>
                  <Skeleton className="h-[28rem] rounded-3xl" />
                </PageMainRail>
                <PageMainContent>
                  <Skeleton className="h-[28rem] rounded-3xl" />
                </PageMainContent>
              </PageMainLayout>
            ) : organizationsError ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>העמוד אינו זמין</AlertTitle>
                <AlertDescription>{organizationsError}</AlertDescription>
              </Alert>
            ) : !selectedOrganization ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>הארגון לא זמין</AlertTitle>
                <AlertDescription>לא הצלחנו לזהות את הארגון לעמוד הזה.</AlertDescription>
              </Alert>
            ) : (
              <PageMainLayout>
                <PageMainRail>
                  <InfoPanel>
                      <InfoPanelHeader
                        icon={ShieldUser}
                        title={selectedOrganization.name?.trim() || `ארגון #${selectedOrganization.id}`}
                        description={selectedOrganization.notes?.trim() || "יצירת חבר חדש לארגון."}
                      badge={<Badge variant={canManage ? "default" : "outline"}>{canManage ? "בעלים" : "קריאה בלבד"}</Badge>}
                    />
                    <InfoPanelBody>
                      <InfoPanelSection title="הקשר">
                        <InfoPanelDetailList>
                          <InfoPanelDetail label="ארגון" value={selectedOrganization.name?.trim() || `ארגון #${selectedOrganization.id}`} />
                          <InfoPanelDetail label="הרשאה" value={canManage ? "אפשר ליצור חברים חדשים" : "אין הרשאת יצירה"} />
                        </InfoPanelDetailList>
                      </InfoPanelSection>
                    </InfoPanelBody>
                  </InfoPanel>
                </PageMainRail>

                <PageMainContent>
                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="gap-3">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <UserPlus className="size-5" />
                        יצירת חבר ארגון
                      </CardTitle>
                      <CardDescription>
                        מלאו את פרטי המשתמש החדש והוסיפו אותו לארגון.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {!canManage ? (
                        <Alert variant="destructive">
                          <AlertTitle>אין הרשאה</AlertTitle>
                          <AlertDescription>רק בעלי ארגון יכולים ליצור משתמשים חדשים.</AlertDescription>
                        </Alert>
                      ) : null}

                      {saveError ? (
                        <Alert variant="destructive">
                          <AlertTitle>היצירה נכשלה</AlertTitle>
                          <AlertDescription>{saveError}</AlertDescription>
                        </Alert>
                      ) : null}

                      {saveMessage ? (
                        <Alert>
                          <AlertTitle>המשתמש נוצר</AlertTitle>
                          <AlertDescription>{saveMessage}</AlertDescription>
                        </Alert>
                      ) : null}

                      {createdPassword ? (
                        <Alert>
                          <AlertTitle>סיסמה זמנית</AlertTitle>
                          <AlertDescription className="flex flex-col gap-3">
                            <span>אפשר למסור למשתמש את הסיסמה הזו לכניסה הראשונה.</span>
                            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                              <code className="text-sm">{createdPassword}</code>
                              <Button variant="outline" size="sm" className="rounded-xl" onClick={handleCopyPassword}>
                                <Copy className="size-4" />
                                העתקה
                              </Button>
                            </div>
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      <div className="grid gap-5">
                        <div className="space-y-2">
                          <label htmlFor="member-email" className="text-sm font-medium">אימייל</label>
                          <Input id="member-email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!canManage || saving} className="h-11 rounded-2xl" placeholder="name@example.com" />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="member-display-name" className="text-sm font-medium">שם מלא</label>
                          <Input id="member-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={!canManage || saving} className="h-11 rounded-2xl" placeholder="למשל: רות כהן" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">תפקיד ארגוני</label>
                          <Select value={role} onValueChange={setRole} disabled={!canManage || saving}>
                            <SelectTrigger className="h-11 rounded-2xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                              {ROLE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="member-title" className="text-sm font-medium">טייטל</label>
                          <Input id="member-title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!canManage || saving} className="h-11 rounded-2xl" placeholder="למשל: אחראית שירות" />
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-3 border-t border-border/60 pt-4">
                        <Button variant="outline" onClick={handleBack} className="rounded-xl">
                          חזרה
                        </Button>
                        <Button onClick={handleCreateUser} disabled={!canManage || saving || !email.trim() || !displayName.trim()} className="rounded-xl">
                          <UserPlus className="size-4" />
                          {saving ? "יוצר משתמש..." : "יצירת משתמש"}
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
