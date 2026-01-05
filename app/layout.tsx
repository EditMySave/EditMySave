import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import { Suspense } from "react"
import "./globals.css"
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google"
import { generateOrganizationStructuredData, generateWebsiteStructuredData, getAvailableGames } from "@/lib/seo"
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

export const metadata: Metadata = {
  title: {
    default: `${gamesData.site.name} - ${gamesData.site.tagline}`,
    template: `%s | ${gamesData.site.name}`,
  },
  description: gamesData.site.description,
  keywords: [...gamesData.site.keywords, ...gameKeywords],
  authors: [{ name: gamesData.site.name }],
  creator: gamesData.site.name,
  publisher: gamesData.site.name,
  metadataBase: new URL(gamesData.site.url),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: gamesData.site.url,
    siteName: gamesData.site.name,
    title: `${gamesData.site.name} - ${gamesData.site.tagline}`,
    description: gamesData.site.description,
    images: [
      {
        url: "/og-image.png",
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
    images: ["/og-image.png"],
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
  generator: "v0.app",
  verification: {
    google: "", // Add your Google Search Console verification code here
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const organizationSchema = generateOrganizationStructuredData()
  const websiteSchema = generateWebsiteStructuredData()

  return (
    <html lang="en" className="dark">
      <head>
        <Script id="organization-schema" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(organizationSchema)}
        </Script>
        <Script id="website-schema" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(websiteSchema)}
        </Script>
      </head>
      <body className={`font-sans ${geistSans.variable} ${geistMono.variable} ${sourceSerif4.variable}`}>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}
