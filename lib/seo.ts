import type { Metadata } from "next"
import gamesData from "@/data/games.json"

interface GameSEOData {
  name: string
  description: string
  route: string
  supportedVersion?: string
  seo?: {
    title: string
    description: string
    keywords: string[]
    ogImage: string
    longDescription?: string
    features?: string[]
    faq?: { question: string; answer: string }[]
  }
}

export function generateGameMetadata(gameId: string): Metadata {
  // Defensive check to ensure gameId is a string
  if (typeof gameId !== "string") {
    console.error("[SEO] Invalid gameId type:", typeof gameId, gameId)
    throw new Error(`Game ID must be a string, received ${typeof gameId}`)
  }

  const game = gamesData.games.find((g) => g.id === gameId) as GameSEOData | undefined

  if (!game) {
    console.error(
      "[SEO] Available game IDs:",
      gamesData.games.map((g) => g.id),
    )
    throw new Error(`Game with id "${gameId}" not found in games.json`)
  }

  if (!game.seo) {
    console.error("[SEO] Game found but missing SEO data:", game.name)
    throw new Error(`Game "${game.name}" (id: ${gameId}) is missing SEO data in games.json`)
  }

  const url = `https://editmysave.app${game.route}`

  return {
    title: game.seo.title,
    description: game.seo.description,
    keywords: game.seo.keywords,
    openGraph: {
      title: game.seo.title,
      description: game.seo.description,
      url,
      siteName: "EditMySave",
      type: "website",
      images: [
        {
          url: `https://editmysave.app${game.seo.ogImage}`,
          width: 1200,
          height: 630,
          alt: `${game.name} Save Editor`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: game.seo.title,
      description: game.seo.description,
      images: [`https://editmysave.app${game.seo.ogImage}`],
    },
    alternates: {
      canonical: url,
    },
  }
}

export function generateHomeMetadata(): Metadata {
  const title = "EditMySave - Free Online Game Save Editor"
  const description =
    "Edit your game save files directly in your browser. Free online save editor for Sworn, Megabonk, Cloverpit, and more. No downloads required, works entirely client-side."
  const url = "https://editmysave.com"

  return {
    title,
    description,
    keywords: [
      "save editor",
      "game save editor",
      "online save editor",
      "save file editor",
      "sworn save editor",
      "megabonk save editor",
      "cloverpit save editor",
      "free save editor",
      "browser save editor",
    ],
    openGraph: {
      title,
      description,
      url,
      siteName: "EditMySave",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: url,
    },
  }
}

export function generateStructuredData(gameId: string) {
  if (typeof gameId !== "string") {
    console.error("[SEO] Invalid gameId type for structured data:", typeof gameId, gameId)
    throw new Error(`Game ID must be a string, received ${typeof gameId}`)
  }

  const game = gamesData.games.find((g) => g.id === gameId) as GameSEOData | undefined

  if (!game) {
    console.error(
      "[SEO] Available game IDs:",
      gamesData.games.map((g) => g.id),
    )
    throw new Error(`Game with id "${gameId}" not found in games.json`)
  }

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${game.name} Save Editor`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web Browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: game.description,
    url: `https://editmysave.app${game.route}`,
    browserRequirements: "Requires JavaScript. Works in Chrome, Firefox, Safari, Edge.",
    softwareVersion: game.supportedVersion || "1.0",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5",
      ratingCount: "1",
    },
  }
}

export function getGameSEOData(gameId: string) {
  const game = gamesData.games.find((g) => g.id === gameId)

  if (!game || !game.seo) {
    return null
  }

  return {
    name: game.name,
    longDescription: game.seo.longDescription,
    features: game.seo.features,
    faq: game.seo.faq,
  }
}
