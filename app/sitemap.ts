import type { MetadataRoute } from "next"
import gamesData from "@/data/games.json"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://editmysave.app"

  const availableGames = gamesData.games.filter((g) => g.status === "available")
  const comingSoonGames = gamesData.games.filter((g) => g.status === "coming-soon")

  const gameEntries: MetadataRoute.Sitemap = availableGames.map((game) => ({
    url: `${baseUrl}${game.route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  // Include coming-soon games with lower priority (they have landing pages)
  const comingSoonEntries: MetadataRoute.Sitemap = comingSoonGames
    .filter((game) => game.route !== "#") // Only include games with actual routes
    .map((game) => ({
      url: `${baseUrl}${game.route}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...gameEntries,
    ...comingSoonEntries,
  ]
}
