import { supabase } from "@/lib/supabase"

const supportedAvatarMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const
const STANDARD_AVATAR_EXTENSION = "webp"
const STANDARD_AVATAR_MIME_TYPE = "image/webp"
const STANDARD_AVATAR_SIZE = 512
const SIGNED_AVATAR_URL_TTL_MS = 50 * 60 * 1000

const signedAvatarUrlCache = new Map<string, { expiresAt: number; value: string }>()
const signedAvatarUrlInflight = new Map<string, Promise<string | null>>()

async function createSignedAvatarUrl(path: string) {
  const now = Date.now()
  const cached = signedAvatarUrlCache.get(path)

  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const inflight = signedAvatarUrlInflight.get(path)
  if (inflight) {
    return inflight
  }

  const request = supabase.storage
    .from("avatars")
    .createSignedUrl(path, 3600)
    .then(({ data, error }) => {
      if (error || !data?.signedUrl) {
        return null
      }

      signedAvatarUrlCache.set(path, {
        expiresAt: Date.now() + SIGNED_AVATAR_URL_TTL_MS,
        value: data.signedUrl,
      })

      return data.signedUrl
    })
    .finally(() => {
      signedAvatarUrlInflight.delete(path)
    })

  signedAvatarUrlInflight.set(path, request)

  return request
}

export async function resolveAvatarUrl(avatarPath?: string | null) {
  if (!avatarPath) {
    return undefined
  }

  if (/^https?:\/\//i.test(avatarPath)) {
    return avatarPath
  }

  const signedUrl = await createSignedAvatarUrl(avatarPath)
  if (signedUrl) {
    return signedUrl
  }

  console.error("Error creating signed avatar URL:", avatarPath)
  return undefined
}

export function getAvatarInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "U"
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

export function isSupportedAvatarFile(file: File) {
  return supportedAvatarMimeTypes.includes(
    file.type as (typeof supportedAvatarMimeTypes)[number]
  )
}

export function getAvatarStoragePath(userId: string) {
  return `${userId}/avatar.${STANDARD_AVATAR_EXTENSION}`
}

export async function normalizeAvatarFile(file: File) {
  if (!isSupportedAvatarFile(file)) {
    throw new Error("Unsupported avatar file type")
  }

  const sourceUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(sourceUrl)
    const canvas = document.createElement("canvas")
    canvas.width = STANDARD_AVATAR_SIZE
    canvas.height = STANDARD_AVATAR_SIZE

    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Canvas is not supported in this browser")
    }

    context.clearRect(0, 0, canvas.width, canvas.height)

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight)
    const sourceX = (image.naturalWidth - sourceSize) / 2
    const sourceY = (image.naturalHeight - sourceSize) / 2

    // Center-crop to a square, then scale down to a stable avatar size.
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      STANDARD_AVATAR_SIZE,
      STANDARD_AVATAR_SIZE
    )

    const blob = await canvasToBlob(canvas, STANDARD_AVATAR_MIME_TYPE, 0.82)
    return new File([blob], "avatar.webp", { type: STANDARD_AVATAR_MIME_TYPE })
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Failed to load avatar image"))
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to export avatar image"))
        return
      }

      resolve(blob)
    }, type, quality)
  })
}
