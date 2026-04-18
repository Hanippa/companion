import type { CSSProperties } from "react"
import { CircleHelpIcon, Route, ShieldCheck, UserRoundIcon, Users2 } from "lucide-react"

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

const helpSections = [
  {
    icon: ShieldCheck,
    title: "בעלי ארגון",
    description:
      "בעלי הארגון מקימים את המבנה הראשי של המערכת: נקודות, סוגי מסלולים וצוות ארגוני.",
    bullets: [
      "יצירת נקודות חדשות לארגון מתוך הדשבורד.",
      "ניהול סוגי מסלולים ועריכתם בצורה ויזואלית.",
      "יצירת משתמשים חדשים ושיוכם לארגון.",
    ],
  },
  {
    icon: Users2,
    title: "מנהלי נקודה ואדמינים",
    description:
      "מנהלי נקודה מתמקדים בתפעול היומיומי של הנקודה: צוות, מעקבים וזרימות עבודה.",
    bullets: [
      "הוספת משתמשים קיימים של הארגון לצוות הנקודה.",
      "מעקב אחר מסלולים פעילים וניהול ה-SLA כאשר יש הרשאה.",
      "שימוש במסך הנקודה כמרכז העבודה השוטף.",
    ],
  },
  {
    icon: Route,
    title: "משתמשי מערכת",
    description:
      "משתמשים פנימיים עובדים מתוך עמודי הנקודה והמסלול כדי לקדם טיפול ולעדכן אירועים.",
    bullets: [
      "פתיחת מסלול חדש מתוך הנקודה המתאימה.",
      "קידום המסלול דרך כפתורי המעבר הזמינים.",
      "מעקב אחר אירועים, נתוני הרשומה ו-SLA בעמוד המסלול.",
    ],
  },
  {
    icon: UserRoundIcon,
    title: "לקוחות",
    description:
      "לקוחות לא זקוקים לחשבון. הם מקבלים קישור ציבורי למעקב אחר הסטטוס וההתקדמות.",
    bullets: [
      "פתיחת קישור מעקב ציבורי מכל מכשיר.",
      "צפייה בהתקדמות הטיפול ובאירועים הרלוונטיים בלבד.",
      "עדכונים חיים כאשר החיבור הציבורי פעיל.",
    ],
  },
]

const troubleshootingItems = [
  {
    label: "לא מוצא מסלול",
    value: "בדקו שהארגון הנכון נבחר בכותרת העליונה, ואז השתמשו בעמוד החיפוש.",
  },
  {
    label: "אין לי הרשאת פעולה",
    value: "המערכת מסתירה או נועלת פעולות לפי תפקיד. ודאו שאתם בעלים, אדמין ארגוני או מנהל נקודה לפי הצורך.",
  },
  {
    label: "לקוח לא רואה עדכון",
    value: "בדקו שקישור ציבורי קיים למסלול, ושעמוד המעקב הציבורי מחובר לעדכונים חיים.",
  },
]

export default function HelpPage() {
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
        <SiteHeader title="עזרה והכוונה" />
        <PageBody>
          <div className="page-stack flex-1" dir="rtl">
            <PageMainLayout>
              <PageMainRail>
                <InfoPanel>
                  <InfoPanelHeader
                    icon={CircleHelpIcon}
                    title="מרכז עזרה"
                    description="סיכום קצר של הזרימות המרכזיות לפי תפקידי המערכת, כדי שיהיה ברור מי עושה מה ואיפה."
                  />
                  <InfoPanelBody>
                    <InfoPanelSection title="הזרימה המלאה">
                      <InfoPanelDetailList>
                        <InfoPanelDetail label="1" value="בעלים מקימים ארגון, נקודות וסוגי מסלולים" />
                        <InfoPanelDetail label="2" value="מנהלים בונים את הצוות הארגוני והנקודתי" />
                        <InfoPanelDetail label="3" value="משתמשים פותחים ומקדמים מסלולים" />
                        <InfoPanelDetail label="4" value="לקוחות עוקבים דרך הקישור הציבורי" />
                      </InfoPanelDetailList>
                    </InfoPanelSection>

                    <InfoPanelSection title="תקלות נפוצות">
                      <InfoPanelDetailList>
                        {troubleshootingItems.map((item) => (
                          <InfoPanelDetail key={item.label} label={item.label} value={item.value} />
                        ))}
                      </InfoPanelDetailList>
                    </InfoPanelSection>
                  </InfoPanelBody>
                </InfoPanel>
              </PageMainRail>

              <PageMainContent>
                <Card className="border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <CircleHelpIcon className="size-5" />
                      עבודה לפי תפקיד
                    </CardTitle>
                    <CardDescription>
                      כל אחד מהתפקידים במערכת מקבל תצוגה והרשאות שונות. כאן אפשר לראות את חלוקת האחריות בצורה מרוכזת.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 lg:grid-cols-2">
                    {helpSections.map((section) => (
                      <Card key={section.title} className="border-border/70 shadow-none">
                        <CardHeader className="gap-2">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <section.icon className="size-5 text-primary" />
                            {section.title}
                          </CardTitle>
                          <CardDescription>{section.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                            {section.bullets.map((bullet) => (
                              <div key={bullet} className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                                {bullet}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>

                <Alert>
                  <AlertTitle>נקודת התחלה טובה</AlertTitle>
                  <AlertDescription>
                    אם משהו לא ברור בתוך המערכת, בדרך כלל המסלול הכי מהיר הוא לחזור לעמוד הארגון, לבחור נקודה, ומשם להמשיך למסלול או לצוות הרלוונטי.
                  </AlertDescription>
                </Alert>
              </PageMainContent>
            </PageMainLayout>
          </div>
        </PageBody>
      </SidebarInset>
    </SidebarProvider>
  )
}
