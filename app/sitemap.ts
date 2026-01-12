import type { MetadataRoute } from "next"
import gamesData from "@/data/games.json"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://editmysave.app"
  const lastModified = new Date()

  const gameRoutes = gamesData.games
    .filter((g) => g.status === "available")
    .map((g) => g.route)
    .filter((route): route is string => typeof route === "string" && route.startsWith("/"))

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...gameRoutes.map((route) => ({
      url: `${baseUrl}${route}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ]
}
