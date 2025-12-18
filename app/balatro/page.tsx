import { generateGameMetadata } from "@/lib/seo"
import BalatroSaveEditorClient from "./BalatroSaveEditorClient"

export const metadata = generateGameMetadata("balatro")

export default function BalatroSaveEditorPage() {
  return <BalatroSaveEditorClient />
}
