import type { Metadata } from "next"
import type { ReactNode } from "react"

import gamesData from "@/data/games.json"
import { generateGameMetadata } from "@/lib/seo"

const game = gamesData.games.find((g) => g.id === "cloverpit")

export const metadata: Metadata = generateGameMetadata({
  name: game?.name ?? "Cloverpit",
  description:
    game?.description ??
    "Comprehensive editor for Cloverpit save files with full control over economy, spins, RNG, powerups, and more",
  route: game?.route ?? "/cloverpit",
  supportedVersion: game?.supportedVersion,
  image: game?.image,
})

export default function Layout({ children }: { children: ReactNode }) {
  return children
}

