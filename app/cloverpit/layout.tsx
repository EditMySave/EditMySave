import type React from "react"
import type { Metadata } from "next"
import { generateGameMetadata, generateGameStructuredData, getGameById } from "@/lib/seo"

const game = getGameById("cloverpit")

export const metadata: Metadata = game
  ? generateGameMetadata(game)
  : {
      title: "Cloverpit Save Editor",
      description: "Edit your Cloverpit save files",
    }

export default function CloverpitLayout({ children }: { children: React.ReactNode }) {
  const structuredData = game ? generateGameStructuredData(game) : null

  return (
    <>
      {structuredData && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      )}
      {children}
    </>
  )
}
