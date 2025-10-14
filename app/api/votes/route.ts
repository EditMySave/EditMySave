import { put, head } from "@vercel/blob"
import { NextResponse } from "next/server"

const VOTES_BLOB_PATH = "votes.json"

interface VotesData {
  [gameId: string]: number
}

async function getVotes(): Promise<VotesData> {
  try {
    // Check if blob exists
    await head(VOTES_BLOB_PATH)

    // Fetch existing votes
    const response = await fetch(`${process.env.BLOB_READ_WRITE_TOKEN}/${VOTES_BLOB_PATH}`)
    return await response.json()
  } catch {
    // If blob doesn't exist, return empty object
    return {}
  }
}

async function saveVotes(votes: VotesData): Promise<void> {
  await put(VOTES_BLOB_PATH, JSON.stringify(votes), {
    access: "public",
    contentType: "application/json",
  })
}

export async function GET() {
  try {
    const votes = await getVotes()
    return NextResponse.json(votes)
  } catch (error) {
    console.error("[v0] Error fetching votes:", error)
    return NextResponse.json({}, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { gameId } = await request.json()

    if (!gameId || typeof gameId !== "string") {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 })
    }

    // Get current votes
    const votes = await getVotes()

    // Increment vote count
    votes[gameId] = (votes[gameId] || 0) + 1

    // Save updated votes
    await saveVotes(votes)

    return NextResponse.json({ success: true, votes: votes[gameId] })
  } catch (error) {
    console.error("[v0] Error saving vote:", error)
    return NextResponse.json({ error: "Failed to save vote" }, { status: 500 })
  }
}
