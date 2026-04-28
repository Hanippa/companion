import { readFileSync } from "node:fs"

const [userId, password] = process.argv.slice(2)

if (!userId || !password) {
  console.error("Usage: npm run test:reset-password -- <user-id> <new-password>")
  process.exit(1)
}

const env = loadDotEnv()
const functionUrl =
  process.env.RESET_PASSWORD_FUNCTION_URL ||
  env.RESET_PASSWORD_FUNCTION_URL ||
  getDefaultFunctionUrl(env)
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY

if (!functionUrl) {
  console.error("Missing RESET_PASSWORD_FUNCTION_URL or VITE_SUPABASE_URL in .env")
  process.exit(1)
}

if (!anonKey) {
  console.error("Missing SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY in .env")
  process.exit(1)
}

const response = await fetch(functionUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  },
  body: JSON.stringify({ userId, password }),
})

const text = await response.text()
const body = parseJson(text)

if (!response.ok) {
  console.error(`Reset password request failed (${response.status})`)
  console.error(body ?? text)
  process.exit(1)
}

console.log("Password reset request succeeded")
console.log(body ?? text)

function getDefaultFunctionUrl(env) {
  const localFunctionsUrl = process.env.SUPABASE_FUNCTIONS_URL || env.SUPABASE_FUNCTIONS_URL

  if (localFunctionsUrl) {
    return `${localFunctionsUrl.replace(/\/$/, "")}/reset-password`
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL

  if (!supabaseUrl) {
    return null
  }

  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/reset-password`
}

function loadDotEnv() {
  try {
    const raw = readFileSync(".env", "utf8")

    return Object.fromEntries(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=")
          const key = line.slice(0, index).trim()
          const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "")
          return [key, value]
        })
    )
  } catch {
    return {}
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
