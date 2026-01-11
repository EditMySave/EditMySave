import type { Metadata } from "next"
import gamesData from "@/data/games.json"

const BASE_URL = gamesData.site.url

// Type definitions for games.json structure
interface FAQ {
  question: string
  answer: string
}

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
  faq?: FAQ[]
}

interface SiteConfig {
  name: string
  tagline: string
  description: string
  url: string
  keywords: string[]
  faq: FAQ[]
}

// Helper functions to get game data
export function getGameById(id: string): Game | undefined {
  return gamesData.games.find((g) => g.id === id) as Game | undefined
}

export function getGameByRoute(routePath: string): Game | undefined {
  const normalizedRoute = routePath.startsWith("/") ? routePath : `/${routePath}`
  return gamesData.games.find((g) => g.route === normalizedRoute) as Game | undefined
}

export function getAvailableGames(): Game[] {
  return gamesData.games.filter((g) => g.status === "available") as Game[]
}

export function getAllGames(): Game[] {
  return gamesData.games as Game[]
}

export function getSiteConfig(): SiteConfig {
  return gamesData.site as SiteConfig
}

function getAbsoluteImageUrl(imagePath: string): string {
  if (imagePath.startsWith("/placeholder")) {
    return `${BASE_URL}/og-image.png`
  }
  return `${BASE_URL}${imagePath}`
}

export function generateMetadataForRoute(routePath: string): Metadata {
  const game = getGameByRoute(routePath)

  if (!game) {
    return generateHomeMetadata()
  }

  const url = `${BASE_URL}${game.route}`
  const imageUrl = getAbsoluteImageUrl(game.image)

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

// Structured data generators
export function generateGameStructuredData(gameId: string) {
  const game = getGameById(gameId)
  if (!game) return null

  const imageUrl = getAbsoluteImageUrl(game.image)

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

export function generateFAQStructuredData(routePath?: string) {
  let faqItems: FAQ[] = []

  if (routePath) {
    const game = getGameByRoute(routePath)
    if (game?.faq) {
      faqItems = game.faq
    }
  } else {
    faqItems = gamesData.site.faq as FAQ[]
  }

  if (faqItems.length === 0) return null

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }
}

export function generateHowToStructuredData(gameId: string) {
  const game = getGameById(gameId)
  if (!game || game.status !== "available") return null

  const platform = (game as any).platforms?.find((p: any) => p.supported)

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to Edit ${game.name} Save Files`,
    description: `Step-by-step guide to edit your ${game.name} save file using EditMySave's free online editor.`,
    image: getAbsoluteImageUrl(game.image),
    totalTime: "PT5M",
    tool: {
      "@type": "HowToTool",
      name: "Web Browser",
    },
    step: [
      {
        "@type": "HowToStep",
        name: "Locate your save file",
        text: platform?.instructions || `Find your ${game.name} save file on your computer.`,
      },
      {
        "@type": "HowToStep",
        name: "Create a backup",
        text: "Always create a backup copy of your save file before editing.",
      },
      {
        "@type": "HowToStep",
        name: "Upload to EditMySave",
        text: `Drag and drop your save file into the ${game.name} editor on EditMySave.`,
      },
      {
        "@type": "HowToStep",
        name: "Make your edits",
        text: "Use the editor tabs to modify currencies, unlocks, progression, and more.",
      },
      {
        "@type": "HowToStep",
        name: "Download edited save",
        text: "Click the Download button to save your edited file.",
      },
      {
        "@type": "HowToStep",
        name: "Replace original file",
        text: "Move the downloaded file to replace your original save file.",
      },
    ],
  }
}

export function generateBreadcrumbStructuredData(routePath: string) {
  const game = getGameByRoute(routePath)

  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: BASE_URL,
    },
  ]

  if (game) {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: `${game.name} Save Editor`,
      item: `${BASE_URL}${game.route}`,
    })
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  }
}

export function getAllStructuredDataForRoute(routePath: string) {
  const schemas: object[] = [generateOrganizationStructuredData(), generateWebsiteStructuredData()]

  const game = getGameByRoute(routePath)

  if (game && game.status === "available") {
    const gameSchema = generateGameStructuredData(game.id)
    if (gameSchema) schemas.push(gameSchema)

    const howToSchema = generateHowToStructuredData(game.id)
    if (howToSchema) schemas.push(howToSchema)

    const faqSchema = generateFAQStructuredData(routePath)
    if (faqSchema) schemas.push(faqSchema)

    const breadcrumbSchema = generateBreadcrumbStructuredData(routePath)
    schemas.push(breadcrumbSchema)
  } else {
    // Home page FAQ
    const faqSchema = generateFAQStructuredData()
    if (faqSchema) schemas.push(faqSchema)
  }

  return schemas
}

export function generateLLMsContent(): string {
  const site = gamesData.site
  const availableGames = getAvailableGames()

  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.tagline}`,
    "",
    site.description,
    "",
    "## About",
    "",
    "EditMySave is a free, browser-based game save file editor. All processing happens locally in the user's browser - no files are uploaded to servers. The platform supports various save file formats including encrypted, compressed, and binary formats.",
    "",
    "## Available Game Editors",
    "",
  ]

  for (const game of availableGames) {
    lines.push(`### ${game.name}`)
    lines.push("")
    lines.push(`- URL: ${BASE_URL}${game.route}`)
    lines.push(`- Description: ${game.seo.description}`)
    if (game.supportedVersion) {
      lines.push(`- Supported Version: ${game.supportedVersion}`)
    }
    lines.push("")
  }

  lines.push("## Key Features")
  lines.push("")
  lines.push("- 100% client-side processing (privacy-focused)")
  lines.push("- No downloads or installations required")
  lines.push("- Automatic encryption/decryption handling")
  lines.push("- Support for compressed and binary save formats")
  lines.push("- Raw JSON editing for advanced users")
  lines.push("")
  lines.push("## Frequently Asked Questions")
  lines.push("")

  for (const faq of site.faq) {
    lines.push(`**Q: ${faq.question}**`)
    lines.push("")
    lines.push(`A: ${faq.answer}`)
    lines.push("")
  }

  return lines.join("\n")
}

export function generateLLMsFullContent(): string {
  const site = gamesData.site
  const availableGames = getAvailableGames()
  const allGames = getAllGames()

  const lines = [
    `# ${site.name} - Complete Documentation`,
    "",
    `> ${site.tagline}`,
    "",
    "## Overview",
    "",
    site.description,
    "",
    "EditMySave is a web-based platform for editing video game save files directly in the browser. It prioritizes user privacy by performing all file processing client-side using JavaScript and WebCrypto APIs.",
    "",
    "## Technical Architecture",
    "",
    "- **Framework**: Next.js 15 (App Router)",
    "- **Processing**: 100% client-side using Web APIs",
    "- **Encryption**: WebCrypto API for AES, XOR, and custom ciphers",
    "- **Compression**: pako for DEFLATE/zlib formats",
    "- **UI**: React with Tailwind CSS and shadcn/ui components",
    "",
    "## Currently Supported Games",
    "",
  ]

  for (const game of availableGames) {
    lines.push(`### ${game.name}`)
    lines.push("")
    lines.push(`**URL**: ${BASE_URL}${game.route}`)
    lines.push("")
    lines.push(`**Description**: ${game.seo.description}`)
    lines.push("")
    if (game.supportedVersion) {
      lines.push(`**Supported Version**: ${game.supportedVersion}`)
      lines.push("")
    }
    lines.push(`**Keywords**: ${game.seo.keywords.join(", ")}`)
    lines.push("")

    if (game.faq && game.faq.length > 0) {
      lines.push("**FAQ**:")
      lines.push("")
      for (const faq of game.faq) {
        lines.push(`- Q: ${faq.question}`)
        lines.push(`  A: ${faq.answer}`)
      }
      lines.push("")
    }
  }

  lines.push("## Coming Soon")
  lines.push("")

  const comingSoon = allGames.filter((g) => g.status === "coming-soon")
  for (const game of comingSoon) {
    lines.push(`- ${game.name}: ${game.description}`)
  }

  lines.push("")
  lines.push("## Site-Wide FAQ")
  lines.push("")

  for (const faq of site.faq) {
    lines.push(`### ${faq.question}`)
    lines.push("")
    lines.push(faq.answer)
    lines.push("")
  }

  lines.push("## Contact & Support")
  lines.push("")
  lines.push(`Website: ${BASE_URL}`)
  lines.push("")

  return lines.join("\n")
}
