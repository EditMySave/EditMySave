/**
 * Downloads archived saves (see lib/save-archive.ts) from private Vercel Blob
 * storage into ./saves-archive/, keeping their pathnames:
 *   saves-archive/saves/<game-id>/<YYYY-MM-DD>/<session-id>/original-<file>
 *                                                          /edited-<file>
 *
 * Usage:
 *   vercel env pull .env.local          # fetches BLOB_READ_WRITE_TOKEN
 *   node --env-file=.env.local scripts/download-saves.mjs [game-id] [--since YYYY-MM-DD]
 *
 * Examples:
 *   node --env-file=.env.local scripts/download-saves.mjs
 *   node --env-file=.env.local scripts/download-saves.mjs minecraft-dungeons-2 --since 2026-10-01
 *
 * Files already downloaded are skipped, so re-running only fetches new saves.
 */
import { mkdir, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Readable } from "node:stream"
import { get, list } from "@vercel/blob"

const OUT_DIR = fileURLToPath(new URL("../saves-archive", import.meta.url))

const token = process.env.BLOB_SAVES_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN
if (!token) {
  console.error(
    "BLOB_READ_WRITE_TOKEN is not set. Run `vercel env pull .env.local` first, then\n" +
      "`node --env-file=.env.local scripts/download-saves.mjs`.",
  )
  process.exit(1)
}

const args = process.argv.slice(2)
const sinceIndex = args.indexOf("--since")
const since = sinceIndex >= 0 ? args[sinceIndex + 1] : undefined
const game = args.find((a, i) => !a.startsWith("--") && (sinceIndex < 0 || i !== sinceIndex + 1))
if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
  console.error("--since must be a date like 2026-10-01")
  process.exit(1)
}

const prefix = game ? `saves/${game}/` : "saves/"

/** saves/<game>/<YYYY-MM-DD>/… → the date segment. */
const dateOf = (pathname) => pathname.split("/")[2] ?? ""

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  console.log(`Listing ${prefix}${since ? ` since ${since}` : ""}...`)
  let cursor
  let downloaded = 0
  let skipped = 0
  let bytes = 0

  do {
    const page = await list({ prefix, cursor, token })
    cursor = page.cursor

    for (const blob of page.blobs) {
      if (since && dateOf(blob.pathname) < since) continue
      const target = join(OUT_DIR, blob.pathname)
      if (await exists(target)) {
        skipped += 1
        continue
      }
      const result = await get(blob.pathname, { access: "private", token })
      if (!result?.stream) {
        console.warn(`  ! could not read ${blob.pathname}`)
        continue
      }
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, Readable.fromWeb(result.stream))
      downloaded += 1
      bytes += blob.size
      console.log(`  ${blob.pathname}`)
    }
  } while (cursor)

  console.log(
    `\nDone. Downloaded ${downloaded} file(s) (${(bytes / 1024 / 1024).toFixed(1)} MB), ` +
      `${skipped} already present → ${OUT_DIR}`,
  )
}

main().catch((err) => {
  console.error("Download failed:", err)
  process.exit(1)
})
