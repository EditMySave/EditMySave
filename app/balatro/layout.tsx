import type { Metadata } from "next"
import type { ReactNode } from "react"

import gamesData from "@/data/games.json"
import { generateGameMetadata } from "@/lib/seo"

const game = gamesData.games.find((g) => g.id === "balatro")

export const metadata: Metadata = generateGameMetadata({
  name: game?.name ?? "Balatro",
  description: game?.description ?? "Edit money, chips, unlocks, and progression in your Balatro save files",
  route: game?.route ?? "/balatro",
  supportedVersion: game?.supportedVersion,
  image: game?.image,
})

export default function Layout({ children }: { children: ReactNode }) {
  return children
}

