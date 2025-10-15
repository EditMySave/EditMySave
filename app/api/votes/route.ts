import { put, list } from "@vercel/blob"
import { NextResponse } from "next/server"

const VOTES_BLOB_PATH = "votes.json"

interface VotesData {
  [gameId: string]: number
}

async function getVotes(): Promise<VotesData> {
  try {
    console.log("[v0] Attempting to list blobs to find:", VOTES_BLOB_PATH)

    let blobs
    try {
      const result = await list()
      blobs = result.blobs
    } catch (listError: any) {
      // If we get a 401 or any auth error, the blob probably doesn't exist yet
      // or the token isn't configured - return empty votes
      console.log("[v0] Error listing blobs (might not exist yet):", listError.message)
      return {}
    }

    const votesBlob = blobs.find((blob) => blob.pathname === VOTES_BLOB_PATH)

    if (!votesBlob) {
      console.log("[v0] Votes blob not found, returning empty votes")
      return {}
    }

    console.log("[v0] Votes blob found, URL:", votesBlob.url)
    const response = await fetch(votesBlob.url)
    console.log("[v0] Blob fetch response status:", response.status)

    if (!response.ok) {
      console.log("[v0] Blob fetch failed")
      return {}
    }

    const data = await response.json()
    console.log("[v0] Votes data from blob:", data)
    return data
  } catch (error) {
    console.log("[v0] Error fetching votes:", error)
    return {}
  }
}

async function saveVotes(votes: VotesData): Promise<void> {
  console.log("[v0] Saving votes to blob:", votes)
  await put(VOTES_BLOB_PATH, JSON.stringify(votes), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  console.log("[v0] Votes saved successfully")
}

export async function GET() {
  try {
    console.log("[v0] GET /api/votes called")
    const votes = await getVotes()
    console.log("[v0] Returning votes:", votes)
    return NextResponse.json(votes)
  } catch (error) {
    console.error("[v0] Error fetching votes:", error)
    return NextResponse.json({}, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    console.log("[v0] POST /api/votes called")
    const { gameId } = await request.json()

    if (!gameId || typeof gameId !== "string") {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 })
    }

    // Get current votes
    const votes = await getVotes()

    // Increment vote count
    votes[gameId] = (votes[gameId] || 0) + 1
    console.log("[v0] Incremented vote for", gameId, "to", votes[gameId])

    // Save updated votes
    await saveVotes(votes)

    return NextResponse.json({ success: true, votes: votes[gameId] })
  } catch (error) {
    console.error("[v0] Error saving vote:", error)
    return NextResponse.json({ error: "Failed to save vote" + JSON.stringify(error) }, { status: 500 })
  }
}
