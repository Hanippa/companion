import { useState } from "react"
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import Logo from "../../public/Logo.svg"
import { supabase } from "../lib/supabase"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "./ui/spinner"

type LoginFeedback =
  | { type: "idle"; title: string; description: string }
  | { type: "loading"; title: string; description: string }
  | { type: "success"; title: string; description: string }
  | { type: "error"; title: string; description: string }

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("")
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [feedback, setFeedback] = useState<LoginFeedback>({
    type: "idle",
    title: "התחברות מאובטחת",
    description: "הזינו את כתובת האימייל שלכם ונשלח אליכם קישור כניסה.",
  })

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()

    if (loadingStatus) {
      return
    }

    setFeedback({
      type: "loading",
      title: "מאמת פרטים",
      description: "אנחנו בודקים את כתובת האימייל ומכינים עבורכם קישור כניסה.",
    })
    setLoadingStatus(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
    })

    if (error) {
      setFeedback({
        type: "error",
        title: "ההתחברות נכשלה",
        description: error.message,
      })
      setLoadingStatus(false)
      return
    }

    setFeedback({
      type: "success",
      title: "שלחנו לכם מייל",
      description: "נשלח אליכם קישור כניסה לכתובת שהזנתם. בדקו גם את תיקיית הספאם.",
    })
    setLoadingStatus(false)
  }

  const feedbackIcon =
    feedback.type === "loading" ? (
      <Loader2 className="size-4 animate-spin" />
    ) : feedback.type === "success" ? (
      <CheckCircle2 className="size-4" />
    ) : feedback.type === "error" ? (
      <CircleAlert className="size-4" />
    ) : null

  const feedbackVariant = feedback.type === "error" ? "destructive" : "default"

  return (
    <div className={cn("flex flex-col gap-6 font-fredoka", className)} {...props}>
      <div className="flex items-center justify-center gap-2">
        <div className="flex items-center justify-center">
          <div className="text-3xl font-light">companion</div>
        </div>
        <img className="size-8" src={Logo} alt="" />
      </div>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="font-fredoka text-3xl font-medium">
            ברוכים הבאים
          </CardTitle>
          <CardDescription>
            התחברו באמצעות חשבון המיקרוסופט שלכם או קבלו קישור כניסה למייל.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <FieldGroup>
              <Field>
                <Button variant="outline" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21">
                    <title>MS-SymbolLockup</title>
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                  התחברות עם מיקרוסופט
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                או המשיכו עם
              </FieldSeparator>
              <Field>
                <FieldLabel htmlFor="email">אימייל</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="mail@example.com"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>

              <Alert variant={feedbackVariant}>
                {feedbackIcon}
                <AlertTitle>{feedback.title}</AlertTitle>
                <AlertDescription>{feedback.description}</AlertDescription>
              </Alert>

              <Field>
                <Button disabled={loadingStatus} className="text-black" type="submit">
                  {loadingStatus ? <Spinner /> : "התחברו"}
                </Button>
                <FieldDescription className="text-center">
                  לא מצליחים להיכנס?
                  {" "}
                  <a href="#">יצירת קשר</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        בלחיצה על התחברות, אתם מסכימים ל<a href="#">תנאי השימוש</a>
        {" "}
        ול<a href="#">מדיניות הפרטיות שלנו</a>
      </FieldDescription>
    </div>
  )
}
