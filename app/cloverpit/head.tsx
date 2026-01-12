import gamesData from "@/data/games.json"
import { generateStructuredData } from "@/lib/seo"

export default function Head() {
  const game = gamesData.games.find((g) => g.id === "cloverpit")
  const jsonLd = generateStructuredData({
    name: game?.name ?? "Cloverpit",
    description:
      game?.description ??
      "Comprehensive editor for Cloverpit save files with full control over economy, spins, RNG, powerups, and more",
    route: game?.route ?? "/cloverpit",
    supportedVersion: game?.supportedVersion,
    image: game?.image,
  })

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
}

