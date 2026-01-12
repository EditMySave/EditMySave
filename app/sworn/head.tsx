import gamesData from "@/data/games.json"
import { generateStructuredData } from "@/lib/seo"

export default function Head() {
  const game = gamesData.games.find((g) => g.id === "sworn")
  const jsonLd = generateStructuredData({
    name: game?.name ?? "Sworn",
    description: game?.description ?? "Edit currencies and resources for your Sworn save files",
    route: game?.route ?? "/sworn",
    supportedVersion: game?.supportedVersion,
    image: game?.image,
  })

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
}

