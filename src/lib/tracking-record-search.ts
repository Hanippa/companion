import { supabase } from "@/lib/supabase"

type SearchPrimitive = string | number | boolean | null | undefined

type BuildTrackingRecordSearchTextParams = {
  trackName?: string | null
  refId?: number | string | null
  status?: string | null
  notes?: string | null
  pointName?: string | null
  trackTypeName?: string | null
  currentStepKey?: string | null
  currentNodeTitle?: string | null
  data?: Record<string, unknown> | null
}

type UpsertTrackingRecordSearchParams = {
  trackingRecordId: number
  organizationId: number
  pointId: number | null
  searchText: string
}

const normalizeText = (value: SearchPrimitive) => {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

const collectSearchTokens = (value: unknown, tokens: string[]) => {
  if (value === null || value === undefined) return

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const normalized = normalizeText(value)
    if (normalized) tokens.push(normalized)
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectSearchTokens(item, tokens))
    return
  }

  if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      collectSearchTokens(item, tokens)
    )
  }
}

export const buildTrackingRecordSearchText = ({
  trackName,
  refId,
  status,
  notes,
  pointName,
  trackTypeName,
  currentStepKey,
  currentNodeTitle,
  data,
}: BuildTrackingRecordSearchTextParams) => {
  const tokens: string[] = []

  ;[
    trackName,
    refId,
    status,
    notes,
    pointName,
    trackTypeName,
    currentStepKey,
    currentNodeTitle,
  ].forEach((value) => {
    const normalized = normalizeText(value)
    if (normalized) tokens.push(normalized)
  })

  if (data) {
    collectSearchTokens(data, tokens)
  }

  return Array.from(new Set(tokens.map((token) => token.trim()).filter(Boolean))).join(" ")
}

export const upsertTrackingRecordSearch = async ({
  trackingRecordId,
  organizationId,
  pointId,
  searchText,
}: UpsertTrackingRecordSearchParams) => {
  const { error } = await supabase.from("tracking_record_search").upsert(
    {
      tracking_record_id: trackingRecordId,
      organization_id: organizationId,
      point_id: pointId,
      search_text: searchText,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "tracking_record_id",
    }
  )

  if (error) {
    throw error
  }
}
