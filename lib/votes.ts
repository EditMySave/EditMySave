import { put, head } from "@vercel/blob"

const VOTES_BLOB_PATH = "votes.json"

export interface VotesData {
  [gameId: string]: number
}

export async function getVotes(): Promise<VotesData> {
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

export async function saveVotes(votes: VotesData): Promise<void> {
  console.log("[v0] Saving votes to blob:", votes)
  await put(VOTES_BLOB_PATH, JSON.stringify(votes), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  console.log("[v0] Votes saved successfully")
}
