import type { Metadata } from "next"
import type { ReactNode } from "react"

import gamesData from "@/data/games.json"
import { generateGameMetadata } from "@/lib/seo"

const game = gamesData.games.find((g) => g.id === "sworn")

export const metadata: Metadata = generateGameMetadata({
  name: game?.name ?? "Sworn",
  description: game?.description ?? "Edit currencies and resources for your Sworn save files",
  route: game?.route ?? "/sworn",
  supportedVersion: game?.supportedVersion,
  image: game?.image,
})

export default function Layout({ children }: { children: ReactNode }) {
  return children
}

