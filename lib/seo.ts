import type { Metadata } from "next"

interface GameSEOData {
  name: string
  description: string
  route: string
  supportedVersion?: string
}

export function generateGameMetadata(game: GameSEOData): Metadata {
  const title = `${game.name} Save Editor - Edit Your ${game.name} Save Files`
  const description = `Free online ${game.name} save editor. ${game.description} Works entirely in your browser with no downloads required. ${game.supportedVersion ? `Supports version ${game.supportedVersion}.` : ""}`
  const url = `https://editmysave.app${game.route}`

  return {
    title,
    description,
    keywords: [
      `${game.name.toLowerCase()} save editor`,
      `${game.name.toLowerCase()} save file editor`,
      `edit ${game.name.toLowerCase()} save`,
      `${game.name.toLowerCase()} save modifier`,
      `${game.name.toLowerCase()} save game editor`,
      "save editor",
      "game save editor",
      "online save editor",
    ],
    openGraph: {
      title,
      description,
      url,
      siteName: "EditMySave",
      type: "website",
      images: [
        {
          url: `https://editmysave.app/images/${game.name.toLowerCase()}/cover.png`,
          width: 1200,
          height: 630,
          alt: `${game.name} Save Editor`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`https://editmysave.app/images/${game.name.toLowerCase()}/cover.png`],
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

export function generateStructuredData(game: GameSEOData) {
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
