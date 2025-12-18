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
  }
}

export function generateGameMetadata(gameId: string): Metadata {
  const game = gamesData.games.find((g) => g.id === gameId)

  if (!game || !game.seo) {
    throw new Error(`Game with id "${gameId}" not found or missing SEO data`)
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
  const game = gamesData.games.find((g) => g.id === gameId)

  if (!game) {
    throw new Error(`Game with id "${gameId}" not found`)
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
