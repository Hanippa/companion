const STORAGE_PREFIX = "companion.pointQuickAccess"
const MAX_PINNED_POINTS = 12

const isBrowser = () => typeof window !== "undefined"

const getStorageKey = (userId: string) => `${STORAGE_PREFIX}.${userId}`

export function readPinnedPoints(userId?: string | null) {
  if (!userId || !isBrowser()) return [] as number[]

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId))
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is number => typeof item === "number")
  } catch {
    return []
  }
}

function writePinnedPoints(userId: string, pointIds: number[]) {
  if (!isBrowser()) return

  window.localStorage.setItem(
    getStorageKey(userId),
    JSON.stringify(pointIds.slice(0, MAX_PINNED_POINTS))
  )
}

export function pinPoint(userId: string, pointId: number) {
  const current = readPinnedPoints(userId)
  const next = [pointId, ...current.filter((currentPointId) => currentPointId !== pointId)].slice(
    0,
    MAX_PINNED_POINTS
  )

  writePinnedPoints(userId, next)
  return next
}

export function unpinPoint(userId: string, pointId: number) {
  const next = readPinnedPoints(userId).filter((currentPointId) => currentPointId !== pointId)
  writePinnedPoints(userId, next)
  return next
}
