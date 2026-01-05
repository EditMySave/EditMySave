import type { Metadata } from "next"
import gamesData from "@/data/games.json"

const BASE_URL = gamesData.site.url

// Type definitions for games.json structure
interface GameSEO {
  title: string
  description: string
  keywords: string[]
}

interface Game {
  id: string
  name: string
  description: string
  image: string
  route: string
  status: "available" | "coming-soon"
  supportedVersion?: string
  seo: GameSEO
}

// Helper functions to get game data
export function getGameById(id: string): Game | undefined {
  return gamesData.games.find((g) => g.id === id) as Game | undefined
}

export function getGameByRoute(routePath: string): Game | undefined {
  // Normalize the route (handle both "/sworn" and "sworn")
  const normalizedRoute = routePath.startsWith("/") ? routePath : `/${routePath}`
  return gamesData.games.find((g) => g.route === normalizedRoute) as Game | undefined
}

export function getAvailableGames(): Game[] {
  return gamesData.games.filter((g) => g.status === "available") as Game[]
}

export function getAllGames(): Game[] {
  return gamesData.games as Game[]
}

export function generateMetadataForRoute(routePath: string): Metadata {
  const game = getGameByRoute(routePath)

  // If no game found for route, return site defaults
  if (!game) {
    return generateHomeMetadata()
  }

  const url = `${BASE_URL}${game.route}`
  const imageUrl = game.image.startsWith("/placeholder") ? `${BASE_URL}/og-image.png` : `${BASE_URL}${game.image}`

  return {
    title: game.seo.title,
    description: game.seo.description,
    keywords: [...game.seo.keywords, ...gamesData.site.keywords.slice(0, 5)],
    openGraph: {
      title: game.seo.title,
      description: game.seo.description,
      url,
      siteName: gamesData.site.name,
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${game.name} Save Editor - ${gamesData.site.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: game.seo.title,
      description: game.seo.description,
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

// Generate metadata for the home page
export function generateHomeMetadata(): Metadata {
  const availableGames = getAvailableGames()
  const gameNames = availableGames.map((g) => g.name).join(", ")

  return {
    title: `${gamesData.site.name} - ${gamesData.site.tagline}`,
    description: `${gamesData.site.description} Currently supporting: ${gameNames}.`,
    keywords: gamesData.site.keywords,
    openGraph: {
      title: `${gamesData.site.name} - ${gamesData.site.tagline}`,
      description: gamesData.site.description,
      url: BASE_URL,
      siteName: gamesData.site.name,
      type: "website",
      images: [
        {
          url: `${BASE_URL}/og-image.png`,
          width: 1200,
          height: 630,
          alt: `${gamesData.site.name} - ${gamesData.site.tagline}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${gamesData.site.name} - ${gamesData.site.tagline}`,
      description: gamesData.site.description,
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

export function generateGameMetadata(gameId: string): Metadata {
  const game = getGameById(gameId)
  if (!game) {
    return {
      title: "Game Not Found",
      description: "The requested game editor was not found.",
    }
  }
  return generateMetadataForRoute(game.route)
}

// Structured data generators - return objects for JSON-LD
export function generateGameStructuredData(gameId: string) {
  const game = getGameById(gameId)
  if (!game) return null

  const imageUrl = game.image.startsWith("/placeholder") ? `${BASE_URL}/og-image.png` : `${BASE_URL}${game.image}`

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
    description: game.seo.description,
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

export function generateStructuredDataForRoute(routePath: string) {
  const game = getGameByRoute(routePath)
  if (!game) return null
  return generateGameStructuredData(game.id)
}

export function generateOrganizationStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: gamesData.site.name,
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: gamesData.site.description,
  }
}

export function generateWebsiteStructuredData() {
  const availableGames = getAvailableGames()

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: gamesData.site.name,
    url: BASE_URL,
    description: gamesData.site.description,
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
