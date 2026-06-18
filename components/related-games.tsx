import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import gamesData from "@/data/games.json"

interface RelatedGamesProps {
  currentGameId: string
  maxGames?: number
}

export function RelatedGames({ currentGameId, maxGames = 3 }: RelatedGamesProps) {
  const availableGames = gamesData.games
    .filter((game) => game.status === "available" && game.id !== currentGameId)
    .slice(0, maxGames)

  if (availableGames.length === 0) {
    return null
  }

  return (
    <div className="mt-12 space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Try Other Save Editors</h2>
        <p className="text-sm text-muted-foreground">
          Explore more free online save editors for your favorite games
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {availableGames.map((game) => (
          <Link key={game.id} href={game.route} className="group">
            <Card className="overflow-hidden hover:border-primary/50 transition-all hover:shadow-lg h-full">
              <div className="aspect-video w-full overflow-hidden bg-muted relative">
                <img
                  src={game.image || "/placeholder.svg"}
                  alt={`${game.name} Save Editor`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardHeader>
                <div className="space-y-2">
                  <CardTitle className="text-xl">{game.name}</CardTitle>
                  {game.supportedVersion && (
                    <Badge
                      variant="secondary"
                      className="bg-accent/20 text-accent-foreground border-accent/30 hover:bg-accent/30 font-medium"
                    >
                      {game.supportedVersion}
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-sm line-clamp-2">{game.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="secondary" size="sm">
                  Open Editor
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
