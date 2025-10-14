"use client"

const VOTE_STORAGE_KEY = "game_votes"
const VOTE_COOLDOWN_MS = 96 * 60 * 60 * 1000 // 24 hours

interface VoteRecord {
  [gameId: string]: number // timestamp of last vote
}

export function canVote(gameId: string): boolean {
  if (typeof window === "undefined") return false

  try {
    const stored = localStorage.getItem(VOTE_STORAGE_KEY)
    if (!stored) return true

    const votes: VoteRecord = JSON.parse(stored)
    const lastVote = votes[gameId]

    if (!lastVote) return true

    const timeSinceVote = Date.now() - lastVote
    return timeSinceVote >= VOTE_COOLDOWN_MS
  } catch {
    return true
  }
}

export function recordVote(gameId: string): void {
  if (typeof window === "undefined") return

  try {
    const stored = localStorage.getItem(VOTE_STORAGE_KEY)
    const votes: VoteRecord = stored ? JSON.parse(stored) : {}

    votes[gameId] = Date.now()
    localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(votes))
  } catch (error) {
    console.error("[v0] Error recording vote:", error)
  }
}

export function getTimeUntilNextVote(gameId: string): number {
  if (typeof window === "undefined") return 0

  try {
    const stored = localStorage.getItem(VOTE_STORAGE_KEY)
    if (!stored) return 0

    const votes: VoteRecord = JSON.parse(stored)
    const lastVote = votes[gameId]

    if (!lastVote) return 0

    const timeSinceVote = Date.now() - lastVote
    const timeRemaining = VOTE_COOLDOWN_MS - timeSinceVote

    return timeRemaining > 0 ? timeRemaining : 0
  } catch {
    return 0
  }
}
