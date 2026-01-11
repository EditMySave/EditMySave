import type React from "react"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import { Suspense } from "react"
import "./globals.css"
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google"
import { generateMetadataForRoute, getAllStructuredDataForRoute, getAvailableGames } from "@/lib/seo"
import gamesData from "@/data/games.json"

// Initialize fonts
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const sourceSerif4 = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif-4" })

const availableGames = getAvailableGames()
const gameKeywords = availableGames.flatMap((g) => [
  `${g.name.toLowerCase()} save editor`,
  `edit ${g.name.toLowerCase()} save`,
])

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const pathname = headersList.get("x-pathname") || headersList.get("x-invoke-path") || "/"

  // Extract first route segment (e.g., "/sworn/foo" -> "/sworn")
  const routeSegment = "/" + (pathname.split("/")[1] || "")

  // Try to get game-specific metadata, falls back to home metadata
  const gameMetadata = generateMetadataForRoute(routeSegment)

  // Merge with base site metadata
  return {
    ...gameMetadata,
    metadataBase: new URL(gamesData.site.url),
    authors: [{ name: gamesData.site.name }],
    creator: gamesData.site.name,
    publisher: gamesData.site.name,
    generator: "Next.js",
    applicationName: gamesData.site.name,
    referrer: "origin-when-cross-origin",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    keywords: [...(Array.isArray(gameMetadata.keywords) ? gameMetadata.keywords : []), ...gameKeywords],
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersList = await headers()
  const pathname = headersList.get("x-pathname") || headersList.get("x-invoke-path") || "/"
  const routeSegment = "/" + (pathname.split("/")[1] || "")

  const schemas = getAllStructuredDataForRoute(routeSegment)

  return (
    <html lang="en" className="dark">
      <head>
        {schemas.map((schema, index) => (
          <Script
            key={`schema-${index}`}
            id={`schema-${index}`}
            type="application/ld+json"
            strategy="beforeInteractive"
          >
            {JSON.stringify(schema)}
          </Script>
        ))}
      </head>
      <body className={`font-sans ${geistSans.variable} ${geistMono.variable} ${sourceSerif4.variable}`}>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}
