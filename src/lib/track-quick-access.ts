export type TrackQuickAccessItem = {
  id: number
  name: string | null
  url: string
  pointName?: string | null
  trackTypeName?: string | null
  refId?: number | null
  currentStepKey?: string | null
  lastOpenedAt: string
  pinnedAt?: string | null
}

type TrackQuickAccessState = {
  pinned: TrackQuickAccessItem[]
  recent: TrackQuickAccessItem[]
}

const STORAGE_PREFIX = "companion.trackQuickAccess"
export const TRACK_QUICK_ACCESS_EVENT = "companion:track-quick-access-updated"
const MAX_RECENT_TRACKS = 8
const MAX_PINNED_TRACKS = 6

const getStorageKey = (userId: string) => `${STORAGE_PREFIX}.${userId}`

const isBrowser = () => typeof window !== "undefined"

const sanitizeItem = (item: TrackQuickAccessItem): TrackQuickAccessItem => ({
  id: item.id,
  name: item.name ?? null,
  url: item.url,
  pointName: item.pointName ?? null,
  trackTypeName: item.trackTypeName ?? null,
  refId: typeof item.refId === "number" ? item.refId : null,
  currentStepKey: item.currentStepKey ?? null,
  lastOpenedAt: item.lastOpenedAt,
  pinnedAt: item.pinnedAt ?? null,
})

const getEmptyState = (): TrackQuickAccessState => ({
  pinned: [],
  recent: [],
})

export function readTrackQuickAccess(userId?: string | null): TrackQuickAccessState {
  if (!userId || !isBrowser()) return getEmptyState()

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId))
    if (!raw) return getEmptyState()

    const parsed = JSON.parse(raw) as Partial<TrackQuickAccessState>

    return {
      pinned: Array.isArray(parsed.pinned)
        ? parsed.pinned.map((item) => sanitizeItem(item as TrackQuickAccessItem))
        : [],
      recent: Array.isArray(parsed.recent)
        ? parsed.recent.map((item) => sanitizeItem(item as TrackQuickAccessItem))
        : [],
    }
  } catch {
    return getEmptyState()
  }
}

export function writeTrackQuickAccess(userId: string, state: TrackQuickAccessState) {
  if (!isBrowser()) return

  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(state))
  window.dispatchEvent(
    new CustomEvent(TRACK_QUICK_ACCESS_EVENT, {
      detail: { userId },
    })
  )
}

export function addRecentTrack(userId: string, item: Omit<TrackQuickAccessItem, "lastOpenedAt">) {
  const current = readTrackQuickAccess(userId)
  const now = new Date().toISOString()
  const nextItem = sanitizeItem({
    ...item,
    lastOpenedAt: now,
  })

  const pinned = current.pinned.map((existing) =>
    existing.id === nextItem.id
      ? {
          ...existing,
          ...nextItem,
          pinnedAt: existing.pinnedAt ?? now,
        }
      : existing
  )

  const recent = [
    nextItem,
    ...current.recent.filter((existing) => existing.id !== nextItem.id),
  ].slice(0, MAX_RECENT_TRACKS)

  writeTrackQuickAccess(userId, { pinned, recent })
}

export function pinTrack(userId: string, trackId: number) {
  const current = readTrackQuickAccess(userId)
  const sourceItem =
    current.pinned.find((item) => item.id === trackId) ??
    current.recent.find((item) => item.id === trackId)

  if (!sourceItem) return current

  const now = new Date().toISOString()
  const nextPinned = [
    {
      ...sourceItem,
      pinnedAt: sourceItem.pinnedAt ?? now,
    },
    ...current.pinned.filter((item) => item.id !== trackId),
  ].slice(0, MAX_PINNED_TRACKS)

  const nextState = {
    pinned: nextPinned,
    recent: current.recent.filter((item) => item.id !== trackId),
  }

  writeTrackQuickAccess(userId, nextState)
  return nextState
}

export function unpinTrack(userId: string, trackId: number) {
  const current = readTrackQuickAccess(userId)
  const sourceItem = current.pinned.find((item) => item.id === trackId)

  const nextPinned = current.pinned.filter((item) => item.id !== trackId)
  const nextRecent =
    sourceItem && !current.recent.some((item) => item.id === trackId)
      ? [{ ...sourceItem, pinnedAt: null }, ...current.recent].slice(0, MAX_RECENT_TRACKS)
      : current.recent

  const nextState = {
    pinned: nextPinned,
    recent: nextRecent,
  }

  writeTrackQuickAccess(userId, nextState)
  return nextState
}

export function removeRecentTrack(userId: string, trackId: number) {
  const current = readTrackQuickAccess(userId)
  const nextState = {
    ...current,
    recent: current.recent.filter((item) => item.id !== trackId),
  }

  writeTrackQuickAccess(userId, nextState)
  return nextState
}

export function removeTrackQuickAccessItem(userId: string, trackId: number) {
  const current = readTrackQuickAccess(userId)
  const nextState = {
    pinned: current.pinned.filter((item) => item.id !== trackId),
    recent: current.recent.filter((item) => item.id !== trackId),
  }

  writeTrackQuickAccess(userId, nextState)
  return nextState
}
