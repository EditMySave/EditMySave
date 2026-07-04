import type { ReactNode } from "react"
import { generateGameMetadata, generateStructuredData } from "@/lib/seo"

export const metadata = generateGameMetadata("far-far-west")

export default function Layout({ children }: { children: ReactNode }) {
  const jsonLd = generateStructuredData("far-far-west")
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  )
}
