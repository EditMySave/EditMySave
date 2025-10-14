"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ThumbsUp } from "lucide-react"
import { canVote, recordVote, getTimeUntilNextVote } from "@/lib/vote-storage"
import { track } from "@vercel/analytics"

interface VoteButtonProps {
  gameId: string
  initialVotes: number
}

export function VoteButton({ gameId, initialVotes }: VoteButtonProps) {
  const [votes, setVotes] = useState(initialVotes)
  const [canVoteNow, setCanVoteNow] = useState(true)
  const [isVoting, setIsVoting] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)

  useEffect(() => {
    setCanVoteNow(canVote(gameId))
    setTimeRemaining(getTimeUntilNextVote(gameId))
  }, [gameId])

  useEffect(() => {
    if (timeRemaining > 0) {
      const interval = setInterval(() => {
        const remaining = getTimeUntilNextVote(gameId)
        setTimeRemaining(remaining)
        if (remaining === 0) {
          setCanVoteNow(true)
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [timeRemaining, gameId])

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
        setTimeRemaining(getTimeUntilNextVote(gameId))
        track("vote_cast", { gameId })
      }
    } catch (error) {
      console.error("[v0] Error voting:", error)
    } finally {
      setIsVoting(false)
    }
  }

  const formatTimeRemaining = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  return (
    <Button
      onClick={handleVote}
      disabled={!canVoteNow || isVoting}
      variant="outline"
      size="sm"
      className="gap-2 bg-transparent"
      title={!canVoteNow ? `Vote again in ${formatTimeRemaining(timeRemaining)}` : "Vote for this game"}
    >
      <ThumbsUp className="w-4 h-4" />
      <span>{votes}</span>
    </Button>
  )
}
