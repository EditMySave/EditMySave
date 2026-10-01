/**
 * Keeps a private copy of saves people load into the editors, so problem saves
 * can be reviewed later (see scripts/download-saves.mjs).
 *
 * Layout in Blob storage:
 *   saves/<game-id>/<YYYY-MM-DD>/<session-id>/original-<file>
 *   saves/<game-id>/<YYYY-MM-DD>/<session-id>/edited-<file>
 *
 * A session starts when a save is loaded and pairs it with any edited downloads.
 * Archiving is fire-and-forget: it never blocks or breaks an editor, and is off
 * unless NEXT_PUBLIC_SAVE_ARCHIVE=1.
 */
import { upload } from "@vercel/blob/client"
import gamesData from "@/data/games.json"

const ENABLED = process.env.NEXT_PUBLIC_SAVE_ARCHIVE === "1"
const HANDLE_UPLOAD_URL = "/api/save-archive"

interface Session {
  id: string
  date: string
}

/** Current session per game, started by archiveOriginal. */
const sessions = new Map<string, Session>()

/** The editor's game id from the current URL, e.g. "/minecraft-dungeons-2" → "minecraft-dungeons-2". */
export function currentGameId(): string | undefined {
  if (typeof window === "undefined") return undefined
  const route = `/${window.location.pathname.split("/")[1] ?? ""}`
  return gamesData.games.find((g) => g.route === route)?.id
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 200) || "save"
}

function newSession(gameId: string): Session {
  const session = { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10) }
  sessions.set(gameId, session)
  return session
}

async function send(gameId: string, session: Session, kind: "original" | "edited", name: string, body: Blob) {
  await upload(`saves/${gameId}/${session.date}/${session.id}/${kind}-${safeName(name)}`, body, {
    access: "private",
    handleUploadUrl: HANDLE_UPLOAD_URL,
    contentType: name.endsWith(".zip") ? "application/zip" : "application/octet-stream",
  })
}

function report(error: unknown) {
  console.warn("[save-archive] upload skipped:", error instanceof Error ? error.message : error)
}

/** Zip a folder upload, keeping its relative paths. */
async function zipFolder(files: FileList): Promise<{ name: string; blob: Blob }> {
  const { default: JSZip } = await import("jszip")
  const zip = new JSZip()
  for (const file of Array.from(files)) {
    zip.file(file.webkitRelativePath || file.name, file)
  }
  const folder = files[0]?.webkitRelativePath.split("/")[0] || "folder"
  return { name: `${folder}.zip`, blob: await zip.generateAsync({ type: "blob" }) }
}

/** Archive a save (or save folder) as it was loaded. Starts a new session for this game. */
export function archiveOriginal(input: File | FileList, gameId = currentGameId()): void {
  if (!ENABLED || !gameId) return
  const session = newSession(gameId)
  void (async () => {
    if (input instanceof File) {
      await send(gameId, session, "original", input.name, input)
    } else if (input.length > 0) {
      const { name, blob } = await zipFolder(input)
      await send(gameId, session, "original", name, blob)
    }
  })().catch(report)
}

/** Archive an edited save as it was downloaded, alongside its original. */
export function archiveEdited(blob: Blob, fileName: string, gameId = currentGameId()): void {
  if (!ENABLED || !gameId) return
  const session = sessions.get(gameId) ?? newSession(gameId)
  void send(gameId, session, "edited", fileName, blob).catch(report)
}
