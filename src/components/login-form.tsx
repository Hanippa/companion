"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Logo from "../../public/Logo.svg"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-6 font-fredoka", className)} {...props}>
      <form>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-8 items-center justify-center rounded-md">
                <img className="size-8" src={Logo} alt="" />
              </div>
              <span className="sr-only">Acme Inc.</span>
            </a>
            <h1 className="text-3xl font-bold">  ברוכים הבאים 👋</h1>
            <FieldDescription>                  לא מצליכים להיכנס ?
                 <>   </>
                 <a href="#">יצירת קשר </a>
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="email">אימייל</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
            />
          </Field>
          <Field>
            <Button className="text-black" type="submit">Login</Button>
          </Field>
          <FieldSeparator>או</FieldSeparator>
          <Field className="flex justify-center">
            <Button variant="outline" type="button">
               <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21"><title>MS-SymbolLockup</title><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
                  התחברות עם מייקרוסופט
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        בלחיצה על התחברות, אתם מסכימים ל<a href="#">תנאי השימוש</a>  {" "}
        ול<a href="#">מדיניות הפרטיות שלנו</a>
      </FieldDescription>
    </div>
  )
}
