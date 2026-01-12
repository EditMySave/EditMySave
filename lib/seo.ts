import type { Metadata } from "next"

interface GameSEOData {
  name: string
  description: string
  route: string
  supportedVersion?: string
  image?: string
}

const SITE_URL = "https://editmysave.app"

export function generateGameMetadata(game: GameSEOData): Metadata {
  const title = `${game.name} Save Editor - Edit Your ${game.name} Save Files`
  const description = `Free online ${game.name} save editor. ${game.description} Works entirely in your browser with no downloads required. ${game.supportedVersion ? `Supports version ${game.supportedVersion}.` : ""}`
  const url = new URL(game.route, SITE_URL).toString()
  const imageUrl = game.image ? new URL(game.image, SITE_URL).toString() : new URL("/placeholder.jpg", SITE_URL).toString()

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
          url: imageUrl,
          alt: `${game.name} Save Editor`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
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
  const url = SITE_URL
  const imageUrl = new URL("/placeholder.jpg", SITE_URL).toString()

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
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    alternates: {
      canonical: url,
    },
  }
}

export function generateStructuredData(game: GameSEOData) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${game.name} Save Editor`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web Browser",
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: game.description,
    url: new URL(game.route, SITE_URL).toString(),
    browserRequirements: "Requires JavaScript. Works in Chrome, Firefox, Safari, Edge.",
    softwareVersion: game.supportedVersion || "1.0",
    ...(game.image ? { image: new URL(game.image, SITE_URL).toString() } : {}),
  }
}
