import { NextResponse } from "next/server"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import gamesData from "@/data/games.json"

// Issues client-upload tokens for lib/save-archive.ts. Files go from the browser
// straight to Blob (no 4.5 MB function body limit); this route only checks that
// each upload is a save for a real editor and fits the size cap.

const MAX_BYTES = 50 * 1024 * 1024 // folder zips (Windrose, Schedule 1) are the largest
const CONTENT_TYPES = ["application/octet-stream", "application/zip", "application/json", "text/plain"]

const GAME_IDS = new Set(gamesData.games.filter((g) => g.status === "available").map((g) => g.id))

/** saves/<game-id>/<YYYY-MM-DD>/<session-uuid>/(original|edited)-<file name> */
const PATHNAME = /^saves\/([a-z0-9-]+)\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\/(original|edited)-[^/]{1,200}$/

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody

  try {
    const result = await handleUpload({
      body,
      request,
      // A separate private store can be used by setting this token; otherwise the main one.
      token: process.env.BLOB_SAVES_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname) => {
        const match = pathname.match(PATHNAME)
        if (!match || !GAME_IDS.has(match[1])) {
          throw new Error("Invalid save archive path")
        }
        return {
          allowedContentTypes: CONTENT_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        }
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload rejected" }, { status: 400 })
  }
}
