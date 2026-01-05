import type React from "react"
import type { Metadata } from "next"
import Script from "next/script"
import { generateGameMetadata, generateGameStructuredData } from "@/lib/seo"

const GAME_ID = "sworn"

export const metadata: Metadata = generateGameMetadata(GAME_ID)

export default function SwornLayout({ children }: { children: React.ReactNode }) {
  const structuredData = generateGameStructuredData(GAME_ID)

  return (
    <>
      {structuredData && (
        <Script id={`${GAME_ID}-schema`} type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(structuredData)}
        </Script>
      )}
      {children}
    </>
  )
}
