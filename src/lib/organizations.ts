import { supabase } from "@/lib/supabase"

export type CachedOrganization = {
  id: number
  name: string | null
  notes: string | null
  status: string | null
}

const ORGANIZATIONS_TTL_MS = 60_000

let organizationsCache:
  | {
      expiresAt: number
      data: CachedOrganization[]
    }
  | null = null

let organizationsInFlight: Promise<CachedOrganization[]> | null = null

export async function getOrganizationsCached(): Promise<CachedOrganization[]> {
  const now = Date.now()

  if (organizationsCache && organizationsCache.expiresAt > now) {
    return organizationsCache.data
  }

  if (organizationsInFlight) {
    return organizationsInFlight
  }

  organizationsInFlight = (async () => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, notes, status")
        .order("name", { ascending: true, nullsFirst: false })

      if (error) {
        throw error
      }

      const nextData = (data ?? []) as CachedOrganization[]
      organizationsCache = {
        expiresAt: Date.now() + ORGANIZATIONS_TTL_MS,
        data: nextData,
      }

      return nextData
    } finally {
      organizationsInFlight = null
    }
  })()

  return organizationsInFlight
}

export function clearOrganizationsCache() {
  organizationsCache = null
}
