import type { ReactNode } from "react"
import { generateGameMetadata, generateStructuredData } from "@/lib/seo"

export const metadata = generateGameMetadata("megabonk")

export default function Layout({ children }: { children: ReactNode }) {
  const jsonLd = generateStructuredData("megabonk")
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  )
}
