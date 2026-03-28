import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Logo from "../../public/Logo.svg"
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
import { useState } from "react"
import { supabase } from "../lib/supabase"

export function LoginForm() {
    const [email, setEmail] = useState("")
    const [message, setMessage] = useState("")

     const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        const { data, error } = await supabase.auth.signInWithOtp({
          email
        })
    
        if (error) {
          setMessage(error.message)
        } else {
          setMessage("Check your email for the login code!")
        }
      }
  return (
    <div className='flex justify-center items-center h-full w-full'>
    <div className={cn("flex flex-col gap-6 font-fredoka")}>
      <div className="flex items-center justify-center gap-2">
        <div className="flex items-center justify-center"><div className="text-3xl font-light" >companion</div></div>
        <img className="size-8" src={Logo} alt="" />
      </div>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="font-fredoka text-3xl font-medium">  ברוכים הבאים 👋</CardTitle>
          <CardDescription>
            התחברו באמצעות חשבון המייקרוסופט שלכם
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <FieldGroup>
              <Field>
                <Button variant="outline" type="button">
               <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21"><title>MS-SymbolLockup</title><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
                  התחברות עם מייקרוסופט
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
                   onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
            
              <Field>
                <Button className="text-black" type="submit">התחבר</Button>
                <FieldDescription className="text-center">
                  לא מצליכים להיכנס 
                 <>   </>
                 <a href="#">יצירת קשר ?</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        בלחיצה על התחברות, אתם מסכימים ל<a href="#">תנאי השימוש</a>  {" "}
        ול<a href="#">מדיניות הפרטיות שלנו</a>
      </FieldDescription>
    </div>
    </div>
  )
}
