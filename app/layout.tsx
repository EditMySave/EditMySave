import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google"

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
  applicationName: "EditMySave",
  category: "Utilities",
  metadataBase: new URL("https://editmysave.app"),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-dark-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://editmysave.app",
    siteName: "EditMySave",
    title: "EditMySave - Free Online Game Save Editor",
    description:
      "Edit your game save files directly in your browser. Free online save editor for multiple games. No downloads required.",
    images: [{ url: "/placeholder.jpg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "EditMySave - Free Online Game Save Editor",
    description: "Edit your game save files directly in your browser. Free, secure, and easy to use.",
    images: ["/placeholder.jpg"],
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
      <body className={`font-sans ${geistSans.variable} ${geistMono.variable} ${sourceSerif4.variable}`}>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}
