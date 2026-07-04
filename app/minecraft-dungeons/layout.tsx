import type { ReactNode } from "react"
import { generateGameMetadata, generateStructuredData } from "@/lib/seo"

export const metadata = generateGameMetadata("minecraft-dungeons")

export default function Layout({ children }: { children: ReactNode }) {
  const jsonLd = generateStructuredData("minecraft-dungeons")
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  )
}
