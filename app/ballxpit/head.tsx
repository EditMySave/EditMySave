import gamesData from "@/data/games.json"
import { generateStructuredData } from "@/lib/seo"

export default function Head() {
  const game = gamesData.games.find((g) => g.id === "ballxpit")
  const jsonLd = generateStructuredData({
    name: game?.name ?? "BALL x PIT",
    description: game?.description ?? "Edit resources, progression, and buildings in your BALL x PIT save files",
    route: game?.route ?? "/ballxpit",
    supportedVersion: game?.supportedVersion,
    image: game?.image,
  })

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
}

