/**
 * Get the base URL for the current environment
 * Uses NEXT_PUBLIC_SITE_URL environment variable if set,
 * otherwise falls back to VERCEL_URL or localhost
 */
export function getBaseUrl(): string {
  // Use custom site URL if provided (set in Vercel environment variables)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  // Development fallback
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000"
  }

  // Fallback to VERCEL_URL for deployments
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  }

  // Final fallback
  return "http://localhost:3000"
}
