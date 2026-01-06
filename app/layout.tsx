import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google"
import { generateOrganizationStructuredData, generateWebsiteStructuredData } from "@/lib/seo"
import { Footer } from "@/components/footer"

// Initialize fonts
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const sourceSerif4 = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif-4" })

export const metadata: Metadata = {
  title: {
    default: "EditMySave - Free Online Game Save Editor",
    template: "%s | EditMySave",
  },
  description:
    "Edit your game save files directly in your browser. Free online save editor for Sworn, Megabonk, Cloverpit, Balatro, and more. No downloads required, works entirely client-side.",
  keywords: [
    "save editor",
    "game save editor",
    "online save editor",
    "save file editor",
    "sworn save editor",
    "megabonk save editor",
    "cloverpit save editor",
    "balatro save editor",
    "drg survivor save editor",
    "free save editor",
    "browser save editor",
    "client-side save editor",
    "secure save editor",
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
  verification: {
    google: "",
    yandex: "",
    other: {
      "msvalidate.01": "",
    },
  },
  category: "technology",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const organizationData = generateOrganizationStructuredData()
  const websiteData = generateWebsiteStructuredData()

  return (
    <html lang="en" className="dark">
      <body className={`font-sans ${geistSans.variable} ${geistMono.variable} ${sourceSerif4.variable} flex flex-col min-h-screen`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteData) }}
        />
        <Suspense fallback={null}>{children}</Suspense>
        <Footer />
        <Analytics />
      </body>
    </html>
  )
}
