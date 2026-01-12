import type { Metadata } from "next"
import type { ReactNode } from "react"

import gamesData from "@/data/games.json"
import { generateGameMetadata } from "@/lib/seo"

const game = gamesData.games.find((g) => g.id === "drg-survivor")

export const metadata: Metadata = generateGameMetadata({
  name: game?.name ?? "Deep Rock Galactic: Survivor",
  description:
    game?.description ??
    "Edit resources, meta upgrades, class progression, and unlocks in your Deep Rock Galactic: Survivor save files",
  route: game?.route ?? "/drg-survivor",
  supportedVersion: game?.supportedVersion,
  image: game?.image,
})

export default function Layout({ children }: { children: ReactNode }) {
  return children
}

