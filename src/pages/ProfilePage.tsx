import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from "react"
import { CameraIcon, Loader2Icon, SaveIcon, UserRoundIcon } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  InfoPanel,
  InfoPanelBody,
  InfoPanelDetail,
  InfoPanelDetailList,
  InfoPanelHeader,
  InfoPanelSection,
} from "@/components/info-panel"
import {
  PageBody,
  PageMainContent,
  PageMainLayout,
  PageMainRail,
} from "@/components/page-main-layout"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import {
  AVATAR_BUCKET,
  getAvatarInitials,
  getAvatarStoragePath,
  isSupportedAvatarFile,
  normalizeAvatarFile,
  resolveAvatarUrl,
} from "@/lib/avatar"
import { supabase } from "@/lib/supabase"

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingAvatar, setLoadingAvatar] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    setDisplayName(profile?.display_name || "")
  }, [profile?.display_name])

  useEffect(() => {
    let isMounted = true
    let objectUrl: string | undefined

    const loadAvatar = async () => {
      setLoadingAvatar(true)

      if (selectedAvatarFile) {
        objectUrl = URL.createObjectURL(selectedAvatarFile)
        if (isMounted) {
          setAvatarUrl(objectUrl)
          setLoadingAvatar(false)
        }
        return
      }

      const resolvedUrl = await resolveAvatarUrl(profile?.avatar_url)
      if (isMounted) {
        setAvatarUrl(resolvedUrl)
        setLoadingAvatar(false)
      }
    }

    void loadAvatar()

    return () => {
      isMounted = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [profile?.avatar_url, selectedAvatarFile])

  const fallback = useMemo(
    () => getAvatarInitials(displayName || profile?.display_name, user?.email),
    [displayName, profile?.display_name, user?.email]
  )

  const handleAvatarSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    if (file && !isSupportedAvatarFile(file)) {
      setSelectedAvatarFile(null)
      setErrorMessage("יש לבחור קובץ מסוג PNG, JPG או WEBP.")
      setSuccessMessage(null)
      event.target.value = ""
      return
    }

    setSelectedAvatarFile(file)
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  const handleProfileSave = async () => {
    if (!user) return

    setSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      let nextAvatarPath = profile?.avatar_url ?? null

      if (selectedAvatarFile) {
        const normalizedAvatarFile = await normalizeAvatarFile(selectedAvatarFile)
        const avatarPath = getAvatarStoragePath(user.id)
        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(avatarPath, normalizedAvatarFile, {
            cacheControl: "3600",
            upsert: true,
            contentType: normalizedAvatarFile.type,
          })

        if (uploadError) {
          throw uploadError
        }

        nextAvatarPath = avatarPath
      }

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          display_name: displayName.trim() || null,
          avatar_url: nextAvatarPath,
        },
        { onConflict: "id" }
      )

      if (profileError) {
        throw profileError
      }

      setSelectedAvatarFile(null)
      await refreshProfile()
      setSuccessMessage("הפרופיל שלכם עודכן בהצלחה.")
    } catch (error) {
      console.error("Error saving profile:", error)
      setErrorMessage("לא הצלחנו לשמור את הפרופיל כרגע.")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setDisplayName(profile?.display_name || "")
    setSelectedAvatarFile(null)
    setErrorMessage(null)
    setSuccessMessage(null)
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
        <SiteHeader title="פרופיל משתמש" />
        <PageBody>
          <div className="page-stack flex-1" dir="rtl">
            <PageMainLayout>
              <PageMainRail>
                <InfoPanel>
                  <InfoPanelHeader
                    icon={UserRoundIcon}
                    title={displayName.trim() || profile?.display_name || "משתמש"}
                    description="הפרטים כאן מוצגים ברחבי המערכת."
                  />
                  <InfoPanelBody>
                    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-muted/20 px-4 py-5">
                      <Avatar data-size="lg" className="size-28 rounded-3xl">
                        <AvatarImage src={avatarUrl} alt={displayName || profile?.display_name} />
                        <AvatarFallback className="rounded-3xl text-xl">
                          {loadingAvatar ? <Loader2Icon className="size-5 animate-spin" /> : fallback}
                        </AvatarFallback>
                      </Avatar>
                      <div className="w-full space-y-2">
                        <label className="block">
                          <Input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={handleAvatarSelection}
                          />
                          <span className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-4xl border border-input bg-input/30 px-3 py-2 text-sm font-medium transition-colors hover:bg-input/50">
                            <CameraIcon className="size-4" />
                            בחירת תמונת פרופיל
                          </span>
                        </label>
                        <p className="text-center text-xs text-muted-foreground">
                          מומלץ להעלות קובץ PNG, JPG או WEBP.
                        </p>
                      </div>
                    </div>

                    <InfoPanelSection title="מה יוצג לאחרים?">
                      <InfoPanelDetailList>
                        <InfoPanelDetail label="שם תצוגה" value={displayName.trim() || "לא הוגדר"} />
                        <InfoPanelDetail label="אימייל" value={user?.email || "—"} />
                        <InfoPanelDetail
                          label="תמונת פרופיל"
                          value={selectedAvatarFile ? "מוכנה לשמירה" : avatarUrl ? "קיימת" : "ללא תמונה"}
                        />
                      </InfoPanelDetailList>
                    </InfoPanelSection>
                  </InfoPanelBody>
                </InfoPanel>
              </PageMainRail>

              <PageMainContent>
                <Card className="border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <UserRoundIcon className="size-5" />
                      עריכת פרופיל
                    </CardTitle>
                    <CardDescription>
                      עדכנו את השם והתמונה שיופיעו ברחבי המערכת.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {errorMessage ? (
                      <Alert variant="destructive">
                        <AlertTitle>שמירת הפרופיל נכשלה</AlertTitle>
                        <AlertDescription>{errorMessage}</AlertDescription>
                      </Alert>
                    ) : null}

                    {successMessage ? (
                      <Alert>
                        <AlertTitle>הפרופיל עודכן</AlertTitle>
                        <AlertDescription>{successMessage}</AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="space-y-2">
                      <label htmlFor="display-name" className="text-sm font-medium">
                        שם תצוגה
                      </label>
                      <Input
                        id="display-name"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder="הזינו שם תצוגה"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium">
                        אימייל
                      </label>
                      <Input id="email" value={user?.email || ""} disabled readOnly />
                    </div>

                    <Alert>
                      <AlertTitle>טיפ</AlertTitle>
                      <AlertDescription>
                        שם ברור ותמונת פרופיל עדכנית מקלים על זיהוי המשתמש בכל רחבי המערכת.
                      </AlertDescription>
                    </Alert>

                    <div className="flex flex-wrap justify-end gap-3">
                      <Button variant="outline" onClick={handleReset} disabled={saving}>
                        איפוס
                      </Button>
                      <Button onClick={handleProfileSave} disabled={saving || !user}>
                        {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
                        שמירת שינויים
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </PageMainContent>
            </PageMainLayout>
          </div>
        </PageBody>
      </SidebarInset>
    </SidebarProvider>
  )
}
