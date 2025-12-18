import { generateGameMetadata } from "@/lib/seo"
import SwornSaveEditorClient from "./SwornSaveEditorClient"

export const metadata = generateGameMetadata("sworn")

export default function SwornSaveEditorPage() {
  return <SwornSaveEditorClient />
}
