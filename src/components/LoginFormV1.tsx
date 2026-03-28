import { useState } from "react"
import { supabase } from "../lib/supabase"

export default function LoginFormV1() {
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
    <form onSubmit={handleLogin}>
      <input
        className="w-full bg-transparent placeholder:text-slate-400 text-slate-700 text-sm border border-slate-200 rounded-md px-3 py-2 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-300 shadow-sm focus:shadow"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button className="rounded-md bg-slate-800 py-2 px-4 border border-transparent text-center text-sm text-white transition-all shadow-md hover:shadow-lg focus:bg-slate-700 focus:shadow-none active:bg-slate-700 hover:bg-slate-700 active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none ml-2"  type="submit">Send OTP</button>
      {message && <p>{message}</p>}
    </form>
  )
}