import type { MetadataRoute } from "next"
import gamesData from "@/data/games.json"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://editmysave.app"
  const currentDate = new Date()

  // Homepage
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 1,
    },
  ]

  // Add all available games dynamically
  const availableGames = gamesData.games.filter((game) => game.status === "available")
  
  for (const game of availableGames) {
    routes.push({
      url: `${baseUrl}${game.route}`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.8,
    })
  }

  return routes
}
