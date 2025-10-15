import { NextResponse } from "next/server"
import { getVotes, saveVotes } from "@/lib/votes"

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
