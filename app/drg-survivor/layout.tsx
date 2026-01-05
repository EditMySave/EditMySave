import type React from "react"
import type { Metadata } from "next"
import { generateGameMetadata, generateGameStructuredData, getGameById } from "@/lib/seo"

const game = getGameById("drg-survivor")

export const metadata: Metadata = game
  ? generateGameMetadata(game)
  : {
      title: "DRG Survivor Save Editor",
      description: "Edit your Deep Rock Galactic: Survivor save files",
    }

export default function DRGSurvivorLayout({ children }: { children: React.ReactNode }) {
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
