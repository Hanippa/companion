import { createContext, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react" 
import { supabase } from "../lib/supabase"
import type { Session } from "@supabase/supabase-js"
interface AuthContextProps {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthContextProps>({ session: null , loading:true})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get the session on mount
    const getSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setLoading(false)
    }
    getSession()

    // Listen for changes (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={{ session , loading }}>{children}</AuthContext.Provider>
}

// Custom hook for easier access
export const useAuth = () => useContext(AuthContext)