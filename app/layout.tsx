import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google"
import { generateOrganizationStructuredData, generateWebsiteStructuredData, getAvailableGames } from "@/lib/seo"

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
    default: "EditMySave - Free Online Game Save Editor",
    template: "%s | EditMySave",
  },
  description:
    "Edit your game save files directly in your browser. Free online save editor for Sworn, Megabonk, Cloverpit, Balatro, BALL x PIT, DRG Survivor, and more. No downloads required, works entirely client-side.",
  keywords: [
    "save editor",
    "game save editor",
    "online save editor",
    "save file editor",
    "free save editor",
    "browser save editor",
    "game save modifier",
    "edit game save",
    ...gameKeywords,
  ],
  authors: [{ name: "EditMySave" }],
  creator: "EditMySave",
  publisher: "EditMySave",
  metadataBase: new URL("https://editmysave.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://editmysave.app",
    siteName: "EditMySave",
    title: "EditMySave - Free Online Game Save Editor",
    description:
      "Edit your game save files directly in your browser. Free online save editor for multiple games. No downloads required.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "EditMySave - Free Online Game Save Editor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EditMySave - Free Online Game Save Editor",
    description: "Edit your game save files directly in your browser. Free, secure, and easy to use.",
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      </head>
      <body className={`font-sans ${geistSans.variable} ${geistMono.variable} ${sourceSerif4.variable}`}>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}
