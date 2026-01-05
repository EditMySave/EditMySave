import type React from "react"
import type { Metadata } from "next"
import { generateGameMetadata, generateGameStructuredData, getGameById } from "@/lib/seo"

const game = getGameById("ballxpit")

export const metadata: Metadata = game
  ? generateGameMetadata(game)
  : {
      title: "BALL x PIT Save Editor",
      description: "Edit your BALL x PIT save files",
    }

export default function BallxpitLayout({ children }: { children: React.ReactNode }) {
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
