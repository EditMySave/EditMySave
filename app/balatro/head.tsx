import gamesData from "@/data/games.json"
import { generateStructuredData } from "@/lib/seo"

export default function Head() {
  const game = gamesData.games.find((g) => g.id === "balatro")
  const jsonLd = generateStructuredData({
    name: game?.name ?? "Balatro",
    description: game?.description ?? "Edit money, chips, unlocks, and progression in your Balatro save files",
    route: game?.route ?? "/balatro",
    supportedVersion: game?.supportedVersion,
    image: game?.image,
  })

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
}

