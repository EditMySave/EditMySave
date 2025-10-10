import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Gamepad2 } from "lucide-react"
import gamesData from "@/data/games.json"
import { generateHomeMetadata } from "@/lib/seo"

export const metadata = generateHomeMetadata()

export default function HomePage() {
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gamesData.games.map((game) => (
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

        <div className="text-center pt-8">
          <p className="text-sm text-muted-foreground">
            More games coming soon. All editors work entirely in your browser.
          </p>
        </div>
      </div>
    </main>
  )
}
