/**
 * One-time (re-runnable) uploader: mirrors the local public/images tree into
 * Vercel Blob so the app can serve imagery by URL instead of committing it.
 *
 * Each file is uploaded under the pathname `images/<relative-path>` with
 * addRandomSuffix:false, so the resulting URL is deterministic:
 *   https://<storeId>.public.blob.vercel-storage.com/images/<relative-path>
 * That matches the `/images/...` paths the app already computes, so lib/asset-url.ts
 * only has to prepend the store base URL. See .claude/plans for the full plan.
 *
 * Usage:
 *   vercel env pull .env.local          # fetches BLOB_READ_WRITE_TOKEN
 *   node --env-file=.env.local scripts/upload-images-to-blob.mjs
 *
 * Idempotent: allowOverwrite:true means re-running just refreshes changed files.
 * After it finishes it prints NEXT_PUBLIC_ASSET_BASE_URL to copy into your env.
 */
import { readdir, readFile } from "node:fs/promises"
import { join, relative, sep, posix } from "node:path"
import { fileURLToPath } from "node:url"
import { put } from "@vercel/blob"

const IMAGES_DIR = fileURLToPath(new URL("../public/images", import.meta.url))

const token = process.env.BLOB_READ_WRITE_TOKEN
if (!token) {
  console.error(
    "BLOB_READ_WRITE_TOKEN is not set. Run `vercel env pull .env.local` first, then\n" +
      "`node --env-file=.env.local scripts/upload-images-to-blob.mjs`.",
  )
  process.exit(1)
}

/** Convert an OS-specific relative path to a forward-slash blob pathname. */
function toPathname(relPath) {
  return `images/${relPath.split(sep).join(posix.sep)}`
}

async function main() {
  let entries
  try {
    entries = await readdir(IMAGES_DIR, { recursive: true, withFileTypes: true })
  } catch (err) {
    console.error(`Could not read ${IMAGES_DIR}:`, err.message)
    process.exit(1)
  }

  const files = entries.filter((e) => e.isFile())
  if (files.length === 0) {
    console.error(`No files found under ${IMAGES_DIR}. Nothing to upload.`)
    process.exit(1)
  }

  console.log(`Uploading ${files.length} file(s) from public/images to Vercel Blob...`)

  let storeBaseUrl = null
  let done = 0

  for (const entry of files) {
    // entry.parentPath (Node 20.12+) / entry.path point at the containing dir.
    const dir = entry.parentPath ?? entry.path
    const absPath = join(dir, entry.name)
    const relPath = relative(IMAGES_DIR, absPath)
    const pathname = toPathname(relPath)

    const body = await readFile(absPath)
    const { url } = await put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
    })

    if (!storeBaseUrl) {
      // Derive the store origin by stripping the pathname off the returned URL.
      storeBaseUrl = url.slice(0, url.length - `/${pathname}`.length)
    }

    done += 1
    if (done % 25 === 0 || done === files.length) {
      console.log(`  ${done}/${files.length}`)
    }
  }

  console.log(`\nDone. Uploaded ${done} file(s).`)
  console.log(`\nSet this in .env.local and in your Vercel project env (all environments):`)
  console.log(`\n  NEXT_PUBLIC_ASSET_BASE_URL=${storeBaseUrl}\n`)
}

main().catch((err) => {
  console.error("Upload failed:", err)
  process.exit(1)
})
