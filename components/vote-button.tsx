"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ThumbsUp } from "lucide-react"
import { track } from "@vercel/analytics"

const COOLDOWN_HOURS = 24
const STORAGE_KEY = "game_votes"

function canVote(gameId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    const votes = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
    const lastVote = votes[gameId]
    if (!lastVote) return true
    return Date.now() - lastVote > COOLDOWN_HOURS * 60 * 60 * 1000
  } catch {
    return true
  }
}

function recordVote(gameId: string) {
  if (typeof window === "undefined") return
  try {
    const votes = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
    votes[gameId] = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(votes))
  } catch {}
}

export function VoteButton({ gameId, initialVotes }: { gameId: string; initialVotes: number }) {
  const [votes, setVotes] = useState(initialVotes)
  const [canVoteNow, setCanVoteNow] = useState(true)
  const [isVoting, setIsVoting] = useState(false)

  useEffect(() => {
    setCanVoteNow(canVote(gameId))
  }, [gameId])

  const handleVote = async () => {
    if (!canVoteNow || isVoting) return

    setIsVoting(true)
    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      })

      if (response.ok) {
        const data = await response.json()
        setVotes(data.votes)
        recordVote(gameId)
        setCanVoteNow(false)
        track("vote_cast", { gameId })
      }
    } catch (error) {
      console.error("Vote failed:", error)
    } finally {
      setIsVoting(false)
    }
  }

  return (
    <Button
      onClick={handleVote}
      disabled={!canVoteNow || isVoting}
      variant="outline"
      size="sm"
      className="gap-2 bg-transparent"
      title={canVoteNow ? "Vote for this game" : "Already voted (24h cooldown)"}
    >
      <ThumbsUp className="w-4 h-4" />
      <span>{votes}</span>
    </Button>
  )
}
