import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"
import { Geist as V0_Font_Geist, Geist_Mono as V0_Font_Geist_Mono, Source_Serif_4 as V0_Font_Source_Serif_4 } from 'next/font/google'

// Initialize fonts
const _geist = V0_Font_Geist({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700","800","900"] })
const _geistMono = V0_Font_Geist_Mono({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700","800","900"] })
const _sourceSerif_4 = V0_Font_Source_Serif_4({ subsets: ['latin'], weight: ["200","300","400","500","600","700","800","900"] })

export const metadata: Metadata = {
  title: {
    default: "EditMySave - Free Online Game Save Editor",
    template: "%s | EditMySave",
  },
  description:
    "Edit your game save files directly in your browser. Free online save editor for Sworn, Megabonk, Cloverpit, and more. No downloads required, works entirely client-side.",
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
  },
  twitter: {
    card: "summary_large_image",
    title: "EditMySave - Free Online Game Save Editor",
    description: "Edit your game save files directly in your browser. Free, secure, and easy to use.",
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
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}
