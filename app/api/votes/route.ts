import { put, head } from "@vercel/blob"
import { NextResponse } from "next/server"

const VOTES_BLOB_PATH = "votes.json"

interface VotesData {
  [gameId: string]: number
}

async function getVotes(): Promise<VotesData> {
  try {
    console.log("[v0] Checking for votes blob:", VOTES_BLOB_PATH)

    const blobMetadata = await head(VOTES_BLOB_PATH)

    console.log("[v0] Votes blob found, fetching from URL:", blobMetadata.url)
    const response = await fetch(blobMetadata.url)

    if (!response.ok) {
      console.log("[v0] Failed to fetch blob content, status:", response.status)
      return {}
    }

    const data = await response.json()
    console.log("[v0] Votes data loaded:", data)
    return data
  } catch (error: any) {
    if (error?.message?.includes("not found") || error?.message?.includes("404")) {
      console.log("[v0] Votes blob doesn't exist yet, returning empty votes")
      return {}
    }
    console.log("[v0] Error fetching votes:", error?.message || error)
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
    console.error("[v0] Error in GET handler:", error)
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
    return NextResponse.json({ error: "Failed to save vote" }, { status: 500 })
  }
}
