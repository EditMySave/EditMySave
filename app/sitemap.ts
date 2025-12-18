import type { MetadataRoute } from "next"
import gamesData from "@/data/games.json"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://editmysave.app"

  const gamePages = gamesData.games
    .filter((game) => game.status === "available")
    .map((game) => ({
      url: `${baseUrl}${game.route}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...gamePages,
  ]
}
