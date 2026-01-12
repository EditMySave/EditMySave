import type { Metadata } from "next"
import type { ReactNode } from "react"

import gamesData from "@/data/games.json"
import { generateGameMetadata } from "@/lib/seo"

const game = gamesData.games.find((g) => g.id === "ballxpit")

export const metadata: Metadata = generateGameMetadata({
  name: game?.name ?? "BALL x PIT",
  description: game?.description ?? "Edit resources, progression, and buildings in your BALL x PIT save files",
  route: game?.route ?? "/ballxpit",
  supportedVersion: game?.supportedVersion,
  image: game?.image,
})

export default function Layout({ children }: { children: ReactNode }) {
  return children
}

