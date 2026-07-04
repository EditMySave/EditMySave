/**
 * Resolve an image path to its hosted URL.
 *
 * Images are hosted on Vercel Blob (see scripts/upload-images-to-blob.mjs). Each
 * file is uploaded under the same relative path it has in public/images, so a
 * path like "/images/minecraft-dungeons/items/melee/Anchor.png" maps 1:1 onto
 * `${NEXT_PUBLIC_ASSET_BASE_URL}/images/minecraft-dungeons/items/melee/Anchor.png`.
 *
 * When NEXT_PUBLIC_ASSET_BASE_URL is unset the path is returned unchanged, so
 * local dev still works against the on-disk copies in public/images.
 */
const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_BASE_URL

export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//.test(path)) return path // already absolute
  if (!ASSET_BASE) return path // local fallback (dev / before cutover)
  // Only /images/* is hosted on Blob. Other local assets (e.g. /placeholder.svg,
  // which lives at public/placeholder.svg) must stay as-is.
  if (!path.startsWith("/images/")) return path
  return `${ASSET_BASE.replace(/\/$/, "")}${path}`
}
