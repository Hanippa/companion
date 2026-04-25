import { resolveAvatarUrl } from "@/lib/avatar"
import { supabase } from "@/lib/supabase"

export type CachedProfileSummary = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

const profileCache = new Map<string, CachedProfileSummary>()
const profileInflight = new Map<string, Promise<CachedProfileSummary | null>>()
const PROFILE_FETCH_CHUNK_SIZE = 100

const chunkArray = <T>(items: T[], chunkSize: number) => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }
  return chunks
}

export async function getProfilesByIdsCached(
  userIds: string[]
): Promise<Record<string, CachedProfileSummary>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))

  if (uniqueIds.length === 0) {
    return {}
  }

  const missingIds = uniqueIds.filter((userId) => !profileCache.has(userId))

  if (missingIds.length > 0) {
    const idsToFetch = missingIds.filter((userId) => !profileInflight.has(userId))

    if (idsToFetch.length > 0) {
      const fetchPromise = (async () => {
        try {
          const profileChunks = chunkArray(idsToFetch, PROFILE_FETCH_CHUNK_SIZE)
          const chunkResults = await Promise.all(
            profileChunks.map(async (chunk) => {
              const { data, error } = await supabase
                .from("profiles")
                .select("id, display_name, avatar_url")
                .in("id", chunk)

              if (error) {
                throw error
              }

              return data ?? []
            })
          )

          const rows = chunkResults.flat()
          const rowMap = new Map(rows.map((row) => [row.id, row] as const))

          await Promise.all(
            idsToFetch.map(async (userId) => {
              const row = rowMap.get(userId)
              if (!row) {
                profileCache.set(userId, {
                  id: userId,
                  display_name: null,
                  avatar_url: null,
                })
                return
              }

              profileCache.set(userId, {
                id: row.id,
                display_name: row.display_name ?? null,
                avatar_url: (await resolveAvatarUrl(row.avatar_url)) ?? null,
              })
            })
          )
        } finally {
          idsToFetch.forEach((userId) => {
            profileInflight.delete(userId)
          })
        }
      })()

      idsToFetch.forEach((userId) => {
        profileInflight.set(
          userId,
          fetchPromise.then(() => profileCache.get(userId) ?? null)
        )
      })
    }

    await Promise.all(
      missingIds.map((userId) => profileInflight.get(userId)).filter(Boolean)
    )
  }

  return Object.fromEntries(
    uniqueIds.map((userId) => [userId, profileCache.get(userId)]).filter((entry) => entry[1])
  ) as Record<string, CachedProfileSummary>
}
