import type { Metadata } from "next"
import gamesData from "@/data/games.json"

const BASE_URL = "https://editmysave.app"

interface GameSEOData {
  name: string
  description: string
  route: string
  supportedVersion?: string
  image?: string
  id?: string
}

export function getGameById(id: string): GameSEOData | undefined {
  const game = gamesData.games.find((g) => g.id === id)
  if (!game) return undefined
  return {
    name: game.name,
    description: game.description,
    route: game.route,
    supportedVersion: "supportedVersion" in game ? game.supportedVersion : undefined,
    image: game.image,
    id: game.id,
  }
}

export function getAvailableGames(): GameSEOData[] {
  return gamesData.games
    .filter((g) => g.status === "available")
    .map((g) => ({
      name: g.name,
      description: g.description,
      route: g.route,
      supportedVersion: "supportedVersion" in g ? g.supportedVersion : undefined,
      image: g.image,
      id: g.id,
    }))
}

export function generateGameMetadata(game: GameSEOData): Metadata {
  const title = `${game.name} Save Editor - Edit Your ${game.name} Save Files`
  const description = `Free online ${game.name} save editor. ${game.description} Works entirely in your browser with no downloads required.${game.supportedVersion ? ` Supports version ${game.supportedVersion}.` : ""}`
  const url = `${BASE_URL}${game.route}`

  // Generate image URL based on game ID or fallback
  const imageUrl = game.image
    ? `${BASE_URL}${game.image}`
    : `${BASE_URL}/images/${game.id || game.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}/cover.png`

  // Generate comprehensive keywords
  const gameLower = game.name.toLowerCase()
  const gameSlug = gameLower.replace(/[^a-z0-9]/g, " ").trim()

  return {
    title,
    description,
    keywords: [
      `${gameSlug} save editor`,
      `${gameSlug} save file editor`,
      `edit ${gameSlug} save`,
      `${gameSlug} save modifier`,
      `${gameSlug} save game editor`,
      `${gameSlug} save file modifier`,
      `${gameSlug} cheat`,
      `${gameSlug} editor`,
      `modify ${gameSlug} save`,
      `${gameSlug} save hack`,
      `free ${gameSlug} save editor`,
      `online ${gameSlug} save editor`,
      "save editor",
      "game save editor",
      "online save editor",
      "free save editor",
      "browser save editor",
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
          width: 1200,
          height: 630,
          alt: `${game.name} Save Editor - EditMySave`,
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
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  }
}

export function generateHomeMetadata(): Metadata {
  const availableGames = getAvailableGames()
  const gameNames = availableGames.map((g) => g.name).join(", ")
  const gameKeywords = availableGames.flatMap((g) => [
    `${g.name.toLowerCase()} save editor`,
    `edit ${g.name.toLowerCase()} save`,
  ])

  const title = "EditMySave - Free Online Game Save Editor"
  const description = `Edit your game save files directly in your browser. Free online save editor for ${gameNames}, and more. No downloads required, works entirely client-side.`

  return {
    title,
    description,
    keywords: [
      "save editor",
      "game save editor",
      "online save editor",
      "save file editor",
      "free save editor",
      "browser save editor",
      "game save modifier",
      "save file modifier",
      "edit game save",
      "modify save file",
      ...gameKeywords,
    ],
    openGraph: {
      title,
      description,
      url: BASE_URL,
      siteName: "EditMySave",
      type: "website",
      images: [
        {
          url: `${BASE_URL}/og-image.png`,
          width: 1200,
          height: 630,
          alt: "EditMySave - Free Online Game Save Editor",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${BASE_URL}/og-image.png`],
    },
    alternates: {
      canonical: BASE_URL,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  }
}

export function generateGameStructuredData(game: GameSEOData) {
  const imageUrl = game.image
    ? `${BASE_URL}${game.image}`
    : `${BASE_URL}/images/${game.id || game.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}/cover.png`

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${game.name} Save Editor`,
    applicationCategory: "UtilitiesApplication",
    applicationSubCategory: "Game Utilities",
    operatingSystem: "Web Browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: `Free online ${game.name} save editor. ${game.description}`,
    url: `${BASE_URL}${game.route}`,
    browserRequirements: "Requires JavaScript. Works in Chrome, Firefox, Safari, Edge.",
    softwareVersion: game.supportedVersion || "1.0",
    image: imageUrl,
    screenshot: imageUrl,
    featureList: [
      "Edit save files directly in browser",
      "No downloads required",
      "Client-side processing (your data stays private)",
      "Free to use",
      game.supportedVersion ? `Supports ${game.supportedVersion}` : null,
    ].filter(Boolean),
  }
}

export function generateOrganizationStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "EditMySave",
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: "Free online game save editor platform. Edit your game save files directly in your browser.",
    sameAs: [],
  }
}

export function generateWebsiteStructuredData() {
  const availableGames = getAvailableGames()

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "EditMySave",
    url: BASE_URL,
    description: "Free online game save editor platform",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    about: availableGames.map((g) => ({
      "@type": "SoftwareApplication",
      name: `${g.name} Save Editor`,
      url: `${BASE_URL}${g.route}`,
    })),
  }
}
