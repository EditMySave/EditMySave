import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Gamepad2 } from "lucide-react"
import gamesData from "@/data/games.json"
import { generateHomeMetadata } from "@/lib/seo"
import { VoteButton } from "@/components/vote-button"
import { getBaseUrl } from "@/lib/get-base-url"

export const metadata = generateHomeMetadata()

async function getVotes() {
  try {
    const response = await fetch(`${getBaseUrl()}/api/votes`, {
      cache: "no-store",
    })
    if (!response.ok) return {}
    return await response.json()
  } catch {
    return {}
  }
}

export default async function HomePage() {
  const votes = await getVotes()
  const availableGames = gamesData.games.filter((game) => game.status === "available")
  const comingSoonGames = gamesData.games.filter((game) => game.status === "coming-soon")

  return (
    <main className="min-h-screen p-6 md:p-12 bg-background">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <Gamepad2 className="w-10 h-10 text-primary" />
            <h1 className="text-5xl font-bold text-balance">Free Online Game Save Editor</h1>
          </div>
          <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
            Edit your game save files directly in your browser. No downloads required, completely free and secure.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Available Editors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableGames.map((game) => (
              <Link key={game.id} href={game.route} className="group">
                <Card className="overflow-hidden hover:border-primary/50 transition-all hover:shadow-lg h-full">
                  <div className="aspect-video w-full overflow-hidden bg-muted relative">
                    <img
                      src={game.image || "/placeholder.svg"}
                      alt={game.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <CardHeader>
                    <div className="space-y-2">
                      <CardTitle className="text-2xl">{game.name}</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        {game.supportedVersion && (
                          <Badge
                            variant="secondary"
                            className="bg-accent/20 text-accent-foreground border-accent/30 hover:bg-accent/30 font-medium"
                          >
                            Supported Version: {game.supportedVersion}
                          </Badge>
                        )}
                        {game.platforms && game.platforms.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {game.platforms
                              .filter((platform) => platform.supported)
                              .map((platform) => (
                                <Badge
                                  key={platform.name}
                                  variant="secondary"
                                  className="border-secondary/30 hover:bg-secondary/30 font-medium bg-chart-3 text-secondary"
                                >
                                  {platform.name}
                                </Badge>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-base">{game.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="secondary">
                      Open Editor
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {comingSoonGames.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Coming Soon</h2>
            <p className="text-sm text-muted-foreground">
              Vote for the games you want to see next! You can vote once per day.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {comingSoonGames.map((game) => (
                <Card key={game.id} className="overflow-hidden h-full opacity-60 hover:opacity-80 transition-opacity">
                  <div className="aspect-video w-full overflow-hidden bg-muted relative">
                    <img
                      src={game.image || "/placeholder.svg"}
                      alt={game.name}
                      className="w-full h-full object-cover grayscale"
                    />
                    <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
                      <Badge variant="secondary" className="text-lg px-4 py-2">
                        Coming Soon
                      </Badge>
                    </div>
                  </div>
                  <CardHeader>
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-2xl">{game.name}</CardTitle>
                        <VoteButton gameId={game.id} initialVotes={votes[game.id] || 0} />
                      </div>
                    </div>
                    <CardDescription className="text-base">{game.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="text-center pt-8">
          <p className="text-sm text-muted-foreground">
            All editors work entirely in your browser. Your save files never leave your device.
          </p>
        </div>
      </div>
    </main>
  )
}
