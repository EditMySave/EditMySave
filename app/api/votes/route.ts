import { NextResponse } from "next/server"
import { put, head } from "@vercel/blob"

const VOTES_FILE = "votes.json"

async function getVotes() {
  try {
    const blob = await head(VOTES_FILE)
    const response = await fetch(blob.url, { cache: "no-store" })
    return await response.json()
  } catch {
    return {}
  }
}

async function saveVotes(votes: Record<string, number>) {
  await put(VOTES_FILE, JSON.stringify(votes), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

export async function GET() {
  const votes = await getVotes()
  return NextResponse.json(votes)
}

export async function POST(request: Request) {
  try {
    const { gameId } = await request.json()
    if (!gameId) return NextResponse.json({ error: "Invalid game ID" }, { status: 400 })

    const votes = await getVotes()
    votes[gameId] = (votes[gameId] || 0) + 1
    await saveVotes(votes)

    return NextResponse.json({ votes: votes[gameId] })
  } catch (error) {
    return NextResponse.json({ error: "Failed to save vote" }, { status: 500 })
  }
}
