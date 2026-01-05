import type React from "react"
import type { Metadata } from "next"
import { generateGameMetadata, generateGameStructuredData, getGameById } from "@/lib/seo"

const game = getGameById("sworn")

export const metadata: Metadata = game
  ? generateGameMetadata(game)
  : {
      title: "Sworn Save Editor",
      description: "Edit your Sworn save files",
    }

export default function SwornLayout({ children }: { children: React.ReactNode }) {
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
