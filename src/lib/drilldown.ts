export type OrganizationRecord = {
  id: number
  name: string | null
}

export type PointRecord = {
  id: number
  name: string | null
}

export type TrackRecord = {
  id: number
  name: string | null
}

function slugifySegment(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")

  return slug
}

function buildSegment(id: number, name: string | null, fallbackPrefix: string) {
  const slug = slugifySegment(name?.trim() || "")
  return slug ? `${id}-${slug}` : `${id}-${fallbackPrefix}`
}

export function getOrganizationSegment(organization: OrganizationRecord) {
  return buildSegment(organization.id, organization.name, "organization")
}

export function getPointSegment(point: PointRecord) {
  return buildSegment(point.id, point.name, "point")
}

export function getTrackSegment(track: TrackRecord) {
  return buildSegment(track.id, track.name, "track")
}

export function getRecordIdFromSegment(segment?: string) {
  if (!segment) {
    return null
  }

  const [idPart] = segment.split("-", 1)
  const parsedId = Number(idPart)

  return Number.isInteger(parsedId) ? parsedId : null
}
