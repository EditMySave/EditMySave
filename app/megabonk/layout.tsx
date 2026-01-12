import type { Metadata } from "next"
import type { ReactNode } from "react"

import gamesData from "@/data/games.json"
import { generateGameMetadata } from "@/lib/seo"

const game = gamesData.games.find((g) => g.id === "megabonk")

export const metadata: Metadata = generateGameMetadata({
  name: game?.name ?? "Megabonk",
  description:
    game?.description ??
    "Edit currencies, characters, achievements, and shop items for your Megabonk save files",
  route: game?.route ?? "/megabonk",
  supportedVersion: game?.supportedVersion,
  image: game?.image,
})

export default function Layout({ children }: { children: ReactNode }) {
  return children
}

