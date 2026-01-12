import gamesData from "@/data/games.json"
import { generateStructuredData } from "@/lib/seo"

export default function Head() {
  const game = gamesData.games.find((g) => g.id === "drg-survivor")
  const jsonLd = generateStructuredData({
    name: game?.name ?? "Deep Rock Galactic: Survivor",
    description:
      game?.description ??
      "Edit resources, meta upgrades, class progression, and unlocks in your Deep Rock Galactic: Survivor save files",
    route: game?.route ?? "/drg-survivor",
    supportedVersion: game?.supportedVersion,
    image: game?.image,
  })

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
}

