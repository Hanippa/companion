import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CircleAlert, Copy, ShieldUser, UserPlus, Users2 } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  InfoPanel,
  InfoPanelBody,
  InfoPanelHeader,
} from "@/components/info-panel"
import { MemberCard } from "@/components/member-card"
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
import { getProfilesByIdsCached } from "@/lib/profile-cache"
import { supabase } from "@/lib/supabase"

type Organization = {
  id: number
  name: string | null
  notes: string | null
  status: string | null
}

type OrganizationMemberRow = {
  organization_id: number
  user_id: string
  role: string | null
  status: string | null
  title?: string | null
}

type ProfileSummary = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

type TeamMember = OrganizationMemberRow & {
  profile: ProfileSummary | null
}

const ROLE_OPTIONS = [
  { value: "member", label: "חבר צוות" },
  { value: "admin", label: "מנהל ארגון" },
  { value: "owner", label: "בעל ארגון" },
]

const STATUS_OPTIONS = [
  { value: "active", label: "פעיל" },
  { value: "inactive", label: "לא פעיל" },
]

function generateTemporaryPassword() {
  return `Comp-${Math.random().toString(36).slice(2, 8)}A1!`
}

export default function OrganizationTeamPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { organizationSlug } = useParams()
  const organizationIdFromRoute = getRecordIdFromSegment(organizationSlug)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)

  const [members, setMembers] = useState<TeamMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [canManage, setCanManage] = useState(false)

  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [title, setTitle] = useState("")
  const [role, setRole] = useState("member")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [memberDisplayName, setMemberDisplayName] = useState("")
  const [memberTitle, setMemberTitle] = useState("")
  const [memberRole, setMemberRole] = useState("member")
  const [memberStatus, setMemberStatus] = useState("active")
  const [memberSaveError, setMemberSaveError] = useState<string | null>(null)
  const [memberSaveMessage, setMemberSaveMessage] = useState<string | null>(null)
  const [memberSaving, setMemberSaving] = useState(false)
  const [memberRemoving, setMemberRemoving] = useState(false)

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
      navigate(`/${expectedSegment}/team`, { replace: true })
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

    const loadMembers = async () => {
      if (!selectedOrganization) {
        setMembers([])
        setLoadingMembers(false)
        return
      }

      setLoadingMembers(true)
      setMembersError(null)

      try {
        const [membersResult, ownerResult] = await Promise.all([
          supabase
            .from("organization_users")
            .select("organization_id, user_id, role, status, title")
            .eq("organization_id", selectedOrganization.id)
            .eq("status", "active")
            .order("user_id", { ascending: true }),
          supabase
            .from("organization_users")
            .select("role")
            .eq("organization_id", selectedOrganization.id)
            .eq("user_id", user?.id ?? "")
            .eq("status", "active")
            .eq("role", "owner"),
        ])

        if (membersResult.error) throw membersResult.error
        if (ownerResult.error) throw ownerResult.error

        const memberRows = membersResult.data ?? []
        const viewerIsOwner = (ownerResult.data ?? []).length > 0
        const profilesById = await getProfilesByIdsCached(memberRows.map((member) => member.user_id))

        if (!isMounted) return

        setCanManage(viewerIsOwner)
        setMembers(
          memberRows.map((member) => ({
            ...member,
            profile: profilesById[member.user_id] ?? null,
          }))
        )
      } catch (error) {
        if (!isMounted) return
        console.error("Error loading organization team:", error)
        setMembers([])
        setCanManage(false)
        setMembersError("לא הצלחנו לטעון את צוות הארגון כרגע.")
      } finally {
        if (isMounted) {
          setLoadingMembers(false)
        }
      }
    }

    if (selectedOrganization) {
      void loadMembers()
    }

    return () => {
      isMounted = false
    }
  }, [selectedOrganization, user?.id])

  useEffect(() => {
    setSelectedMemberId((current) => {
      if (members.length === 0) {
        return null
      }

      if (current && members.some((member) => member.user_id === current)) {
        return current
      }

      return members[0]?.user_id ?? null
    })
  }, [members])

  const selectedMember =
    members.find((member) => member.user_id === selectedMemberId) ?? null

  useEffect(() => {
    if (!selectedMember) {
      setMemberDisplayName("")
      setMemberTitle("")
      setMemberRole("member")
      setMemberStatus("active")
      setMemberSaveError(null)
      setMemberSaveMessage(null)
      return
    }

    setMemberDisplayName(selectedMember.profile?.display_name?.trim() || "")
    setMemberTitle(selectedMember.title?.trim() || "")
    setMemberRole(selectedMember.role || "member")
    setMemberStatus(selectedMember.status || "active")
    setMemberSaveError(null)
    setMemberSaveMessage(null)
  }, [selectedMember])

  const organizationOptions = useMemo(
    () =>
      organizations.map((organization) => ({
        id: organization.id,
        label: organization.name?.trim() || `ארגון #${organization.id}`,
      })),
    [organizations]
  )

  const handleOrganizationChange = (value: string) => {
    const nextOrganization = organizations.find(
      (organization) => organization.id.toString() === value
    )
    if (!nextOrganization) return
    navigate(`/${getOrganizationSegment(nextOrganization)}`)
  }

  const resetForm = () => {
    setEmail("")
    setDisplayName("")
    setTitle("")
    setRole("member")
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

      if (error) {
        throw error
      }

      const createdUserId =
        (data as { user?: { id?: string } } | null)?.user?.id ?? null

      const nextMember: TeamMember = {
        organization_id: selectedOrganization.id,
        user_id: createdUserId || `pending-${Date.now()}`,
        role,
        status: "active",
        title: title.trim() || null,
        profile: {
          id: createdUserId || `pending-${Date.now()}`,
          display_name: displayName.trim(),
          avatar_url: null,
        },
      }

      setMembers((current) => [nextMember, ...current])
      setSaveMessage(`המשתמש נוצר בהצלחה עבור ${email.trim()}.`)
      setCreatedPassword(temporaryPassword)
      resetForm()
    } catch (error) {
      console.error("Error creating managed user:", error)
      setSaveError("לא הצלחנו ליצור את המשתמש כרגע.")
    } finally {
      setSaving(false)
    }
  }

  const handleCopyPassword = async () => {
    if (!createdPassword) return
    await navigator.clipboard.writeText(createdPassword)
    setSaveMessage("הסיסמה הזמנית הועתקה.")
  }

  const handleSaveMember = async () => {
    if (!selectedOrganization || !selectedMember || !canManage) return

    setMemberSaving(true)
    setMemberSaveError(null)
    setMemberSaveMessage(null)

    try {
      const trimmedDisplayName = memberDisplayName.trim()
      const trimmedTitle = memberTitle.trim()

      const [profileResult, membershipResult] = await Promise.all([
        supabase
          .from("profiles")
          .update({
            display_name: trimmedDisplayName || null,
          })
          .eq("id", selectedMember.user_id),
        supabase
          .from("organization_users")
          .update({
            role: memberRole,
            status: memberStatus,
            title: trimmedTitle || null,
          })
          .eq("organization_id", selectedOrganization.id)
          .eq("user_id", selectedMember.user_id),
      ])

      if (profileResult.error) throw profileResult.error
      if (membershipResult.error) throw membershipResult.error

      const updatedMember: TeamMember = {
        ...selectedMember,
        role: memberRole,
        status: memberStatus,
        title: trimmedTitle || null,
        profile: selectedMember.profile
          ? {
              ...selectedMember.profile,
              display_name: trimmedDisplayName || null,
            }
          : {
              id: selectedMember.user_id,
              display_name: trimmedDisplayName || null,
              avatar_url: null,
            },
      }

      if (memberStatus === "inactive") {
        setMembers((current) =>
          current.filter((member) => member.user_id !== selectedMember.user_id)
        )
        setMemberSaveMessage("חבר הצוות הועבר למצב לא פעיל והוסר מהרשימה הפעילה.")
      } else {
        setMembers((current) =>
          current.map((member) =>
            member.user_id === selectedMember.user_id ? updatedMember : member
          )
        )
        setMemberSaveMessage("פרטי חבר הצוות עודכנו.")
      }
    } catch (error) {
      console.error("Error updating organization member:", error)
      setMemberSaveError("לא הצלחנו לעדכן את חבר הצוות כרגע.")
    } finally {
      setMemberSaving(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!selectedOrganization || !selectedMember || !canManage) return

    const shouldRemove = window.confirm("להסיר את חבר הצוות מהארגון?")
    if (!shouldRemove) return

    setMemberRemoving(true)
    setMemberSaveError(null)
    setMemberSaveMessage(null)

    try {
      const { error } = await supabase
        .from("organization_users")
        .delete()
        .eq("organization_id", selectedOrganization.id)
        .eq("user_id", selectedMember.user_id)

      if (error) throw error

      setMembers((current) =>
        current.filter((member) => member.user_id !== selectedMember.user_id)
      )
      setMemberSaveMessage("חבר הצוות הוסר מהארגון.")
    } catch (error) {
      console.error("Error removing organization member:", error)
      setMemberSaveError("לא הצלחנו להסיר את חבר הצוות כרגע.")
    } finally {
      setMemberRemoving(false)
    }
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
      <SidebarInset dir="rtl">
        <SiteHeader
          title="ניהול צוות ארגוני"
          organizations={organizationOptions}
          selectedOrganizationId={selectedOrganization?.id.toString()}
          onOrganizationChange={handleOrganizationChange}
        />

        <PageBody>
          <div className="page-stack flex-1">
            {loadingOrganizations || loadingMembers ? (
              <PageMainLayout>
                <PageMainContent>
                  <Skeleton className="h-[32rem] rounded-3xl" />
                </PageMainContent>
                <PageMainRail>
                  <Skeleton className="h-[32rem] rounded-3xl" />
                </PageMainRail>
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
                  <div className="space-y-4">
                    <InfoPanel>
                      <InfoPanelHeader
                        icon={ShieldUser}
                        title={selectedOrganization.name?.trim() || `ארגון #${selectedOrganization.id}`}
                        description={selectedOrganization.notes?.trim() || "ניהול משתמשים ברמת הארגון."}
                        badge={
                          <Badge variant={canManage ? "default" : "outline"}>
                            {canManage ? "בעלים" : "קריאה בלבד"}
                          </Badge>
                        }
                      />
                      <InfoPanelBody className="pt-0" />
                    </InfoPanel>

                    <Card className="border-border/70 shadow-none">
                      <CardHeader className="gap-3">
                        <CardTitle className="flex items-center gap-2 text-xl">
                          <UserPlus className="size-5" />
                          יצירת משתמש ארגוני
                        </CardTitle>
                        <CardDescription>
                          בעל ארגון יכול להוסיף משתמש חדש ישירות ל־Auth ולשייך אותו לארגון עם תפקיד ושם.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        {!canManage ? (
                          <Alert variant="destructive">
                            <AlertTitle>אין הרשאה</AlertTitle>
                            <AlertDescription>רק בעלי ארגון יכולים ליצור משתמשים חדשים.</AlertDescription>
                          </Alert>
                        ) : null}

                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">אימייל</label>
                            <Input
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              disabled={!canManage || saving}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">שם מלא</label>
                            <Input
                              value={displayName}
                              onChange={(event) => setDisplayName(event.target.value)}
                              disabled={!canManage || saving}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">תפקיד ארגוני</label>
                            <Select value={role} onValueChange={setRole} disabled={!canManage || saving}>
                              <SelectTrigger className="rounded-xl">
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
                            <label className="text-sm font-medium">טייטל</label>
                            <Input
                              value={title}
                              onChange={(event) => setTitle(event.target.value)}
                              disabled={!canManage || saving}
                            />
                          </div>
                        </div>

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
                              <span>מסרו למשתמש את הסיסמה הזמנית הזו לצורך כניסה ראשונה.</span>
                              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                                <code className="text-sm">{createdPassword}</code>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-xl"
                                  onClick={handleCopyPassword}
                                >
                                  <Copy className="size-4" />
                                  העתקה
                                </Button>
                              </div>
                            </AlertDescription>
                          </Alert>
                        ) : null}

                        <div className="flex justify-end">
                          <Button
                            onClick={handleCreateUser}
                            disabled={!canManage || saving || !email.trim() || !displayName.trim()}
                            className="rounded-xl"
                          >
                            <UserPlus className="size-4" />
                            {saving ? "יוצר משתמש..." : "יצירת משתמש"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-none">
                      <CardHeader className="gap-3">
                        <CardTitle className="flex items-center gap-2 text-xl">
                          <Users2 className="size-5" />
                          ניהול חבר קיים
                        </CardTitle>
                        <CardDescription>
                          כאן אפשר לערוך את פרטי החבר, התפקיד, הסטטוס והשיוך הארגוני שלו.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        {!selectedMember ? (
                          <Alert>
                            <AlertTitle>לא נבחר חבר צוות</AlertTitle>
                            <AlertDescription>בחרו חבר צוות מהרשימה כדי לערוך אותו.</AlertDescription>
                          </Alert>
                        ) : (
                          <>
                            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
                              <MemberCard
                                name={
                                  selectedMember.profile?.display_name?.trim() ||
                                  selectedMember.title?.trim() ||
                                  "חבר צוות"
                                }
                                meta={selectedMember.title?.trim() || "ללא תיאור תפקיד"}
                                avatarUrl={selectedMember.profile?.avatar_url ?? undefined}
                                initialsSource={
                                  selectedMember.profile?.display_name || selectedMember.title
                                }
                                badgeLabel={selectedMember.role || "member"}
                                className="border-border/70 bg-card"
                              />
                            </div>

                            <div className="grid gap-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium">אימייל</label>
                                <Input value="נדרש backend ייעודי לעדכון אימייל" disabled readOnly />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">שם מלא</label>
                                <Input
                                  value={memberDisplayName}
                                  onChange={(event) => setMemberDisplayName(event.target.value)}
                                  disabled={!canManage || memberSaving || memberRemoving}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">טייטל</label>
                                <Input
                                  value={memberTitle}
                                  onChange={(event) => setMemberTitle(event.target.value)}
                                  disabled={!canManage || memberSaving || memberRemoving}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">תפקיד ארגוני</label>
                                <Select
                                  value={memberRole}
                                  onValueChange={setMemberRole}
                                  disabled={!canManage || memberSaving || memberRemoving}
                                >
                                  <SelectTrigger className="rounded-xl">
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
                                <label className="text-sm font-medium">סטטוס</label>
                                <Select
                                  value={memberStatus}
                                  onValueChange={setMemberStatus}
                                  disabled={!canManage || memberSaving || memberRemoving}
                                >
                                  <SelectTrigger className="rounded-xl">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent align="end">
                                    {STATUS_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {memberSaveError ? (
                              <Alert variant="destructive">
                                <AlertTitle>העדכון נכשל</AlertTitle>
                                <AlertDescription>{memberSaveError}</AlertDescription>
                              </Alert>
                            ) : null}

                            {memberSaveMessage ? (
                              <Alert>
                                <AlertTitle>העדכון בוצע</AlertTitle>
                                <AlertDescription>{memberSaveMessage}</AlertDescription>
                              </Alert>
                            ) : null}

                            <div className="flex items-center justify-between gap-3">
                              <Button
                                variant="destructive"
                                onClick={handleRemoveMember}
                                disabled={!canManage || memberSaving || memberRemoving}
                              >
                                {memberRemoving ? "מסיר..." : "הסרה מהארגון"}
                              </Button>
                              <Button
                                onClick={handleSaveMember}
                                disabled={!canManage || memberSaving || memberRemoving}
                                className="rounded-xl"
                              >
                                {memberSaving ? "שומר..." : "שמירת שינויים"}
                              </Button>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </PageMainRail>

                <PageMainContent>
                  <Card className="border-border/70 shadow-none">
                    <CardHeader className="gap-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-2">
                          <CardTitle className="flex items-center gap-2 text-xl">
                            <Users2 className="size-5" />
                            חברי הארגון
                          </CardTitle>
                          <CardDescription>
                            זהו מוקד הניהול הראשי של צוות הארגון: חברים פעילים, תפקידים וטייטלים.
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          סה"כ {members.length} חברים
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {membersError ? (
                        <Alert variant="destructive">
                          <AlertTitle>אי אפשר לטעון את הצוות</AlertTitle>
                          <AlertDescription>{membersError}</AlertDescription>
                        </Alert>
                      ) : members.length === 0 ? (
                        <Alert>
                          <AlertTitle>עדיין אין חברי צוות</AlertTitle>
                          <AlertDescription>אפשר ליצור את המשתמש הראשון של הארגון מהפאנל הימני.</AlertDescription>
                        </Alert>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                          {members.map((member) => {
                            const memberName =
                              member.profile?.display_name?.trim() || member.title?.trim() || "חבר צוות"
                            return (
                              <button
                                key={member.user_id}
                                type="button"
                                className="w-full text-right"
                                onClick={() => setSelectedMemberId(member.user_id)}
                              >
                                <MemberCard
                                  name={memberName}
                                  meta={member.title?.trim() || "ללא תיאור תפקיד"}
                                  avatarUrl={member.profile?.avatar_url ?? undefined}
                                  initialsSource={member.profile?.display_name || member.title}
                                  badgeLabel={member.role || "member"}
                                  className={
                                    selectedMemberId === member.user_id
                                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                                      : "border-border/70 bg-card transition-colors hover:border-primary/30"
                                  }
                                />
                              </button>
                            )
                          })}
                        </div>
                      )}
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
