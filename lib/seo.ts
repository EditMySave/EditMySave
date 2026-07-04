import type { Metadata } from "next"
import { assetUrl } from "@/lib/asset-url"
import gamesData from "@/data/games.json"

const SITE_URL = "https://editmysave.app"

interface GameEntry {
  id: string
  name: string
  description: string
  image: string
  route: string
  status: string
  supportedVersion?: string
}

function getGame(gameId: string): GameEntry {
  const game = (gamesData.games as GameEntry[]).find((g) => g.id === gameId)
  if (!game) {
    throw new Error(`generateGameMetadata: no game found in games.json with id "${gameId}"`)
  }
  return game
}

export function generateGameMetadata(gameId: string): Metadata {
  const game = getGame(gameId)
  const title = `${game.name} Save Editor`
  const description = `Free online ${game.name} save editor. ${game.description} Works entirely in your browser with no downloads required.${
    game.supportedVersion ? ` Supports version ${game.supportedVersion}.` : ""
  }`
  const url = `${SITE_URL}${game.route}`
  // Real cover from games.json (correct extension). assetUrl() resolves it to an
  // absolute Blob URL in prod; a relative /images path in dev is resolved by the
  // root layout's metadataBase.
  const image = assetUrl(game.image)!

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
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
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
  const game = getGame(gameId)
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
    url: `${SITE_URL}${game.route}`,
    browserRequirements: "Requires JavaScript. Works in Chrome, Firefox, Safari, Edge.",
    softwareVersion: game.supportedVersion || "1.0",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5",
      ratingCount: "1",
    },
  }
}
