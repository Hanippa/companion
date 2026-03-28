import { cn } from "@/lib/utils"
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
    <div className={cn("flex flex-col gap-6 font-fredoka")}>
      
      <div className="flex items-center justify-center">
        
        <h1 className="text-2xl flex items-center gap-2 self-center font-medium">companion</h1>
        <div className="flex  items-center gap-2 size-6">
        <svg width="792" height="792" viewBox="0 0 792 792" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M727 395.879C727 460.83 707.905 524.347 672.091 578.524C636.277 632.701 585.327 675.144 525.581 700.571C465.836 725.999 399.934 733.287 336.079 721.529C272.225 709.771 213.237 679.486 166.458 634.443C119.679 589.401 87.1758 531.591 72.9933 468.208C58.8108 404.825 63.5757 338.669 86.6948 277.975C109.814 217.281 150.266 164.729 203.017 126.86C255.767 88.9919 318.486 67.4791 383.366 65" stroke="#CBFF4D" stroke-width="130" stroke-linecap="round"/>
<circle cx="581.5" cy="198.5" r="145" fill="#sCBFF4D" stroke="#CBFF4D"/>
</svg>
</div>
      </div>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="font-fredoka text-3xl"> 👋 ברוכים הבאים </CardTitle>
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
                <Button type="submit">התחבר</Button>
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
        בלחיצה על המשך, אתם מסכימים ל<a href="#">תנאי השימוש</a>  {" "}
        ול<a href="#">מדיניות הפרטיות שלנו</a>
      </FieldDescription>
    </div>
  )
}
