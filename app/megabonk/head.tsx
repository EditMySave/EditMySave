import gamesData from "@/data/games.json"
import { generateStructuredData } from "@/lib/seo"

export default function Head() {
  const game = gamesData.games.find((g) => g.id === "megabonk")
  const jsonLd = generateStructuredData({
    name: game?.name ?? "Megabonk",
    description:
      game?.description ??
      "Edit currencies, characters, achievements, and shop items for your Megabonk save files",
    route: game?.route ?? "/megabonk",
    supportedVersion: game?.supportedVersion,
    image: game?.image,
  })

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
}

