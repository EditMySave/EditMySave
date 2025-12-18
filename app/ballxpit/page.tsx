import { generateGameMetadata } from "@/lib/seo"
import { BallxpitSaveEditorClient } from "./client"

export const metadata = generateGameMetadata("ballxpit")

export default function BallxpitSaveEditorPage() {
  return <BallxpitSaveEditorClient />
}
