import { Metadata } from "next"
import { generateGameMetadata, generateStructuredData, generateBreadcrumbStructuredData } from "@/lib/seo"
import gamesData from "@/data/games.json"

const game = gamesData.games.find((g) => g.id === "sworn")!

export const metadata: Metadata = generateGameMetadata(game)

export default function SwornLayout({ children }: { children: React.ReactNode }) {
  const structuredData = generateStructuredData(game)
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "Home", url: "https://editmysave.app" },
    { name: game.name, url: `https://editmysave.app${game.route}` },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      {children}
    </>
  )
}
