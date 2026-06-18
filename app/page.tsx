import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Gamepad2 } from "lucide-react"
import gamesData from "@/data/games.json"
import { generateHomeMetadata } from "@/lib/seo"
import { generateFAQStructuredData, generateItemListStructuredData } from "@/lib/seo-faq"
import { VoteButton } from "@/components/vote-button"
import { head } from "@vercel/blob"

async function getVotes() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log("[v0] Blob token not configured, skipping votes")
    return {}
  }

  try {
    const blob = await head("votes.json", {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    const response = await fetch(blob.url, { cache: "no-store" })
    const data = await response.json()
    return data
  } catch (error) {
    console.log("[v0] Could not load votes (blob may not exist yet):", error)
    return {}
  }
}

export const metadata = generateHomeMetadata()

export default async function HomePage() {
  const votes = await getVotes()
  const availableGames = gamesData.games.filter((game) => game.status === "available")
  const comingSoonGames = gamesData.games.filter((game) => game.status === "coming-soon")

  const faqData = generateFAQStructuredData()
  const itemListData = generateItemListStructuredData(availableGames)

  return (
    <main className="min-h-screen p-6 md:p-12 bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData) }}
      />
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
                      alt={`${game.name} Save Editor - Edit ${game.name} save files`}
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
                      alt={`${game.name} - Coming Soon`}
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

        <div className="space-y-6 pt-8">
          <div className="text-center space-y-4 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold">Free Online Game Save Editor</h2>
            <div className="text-muted-foreground space-y-3 text-sm md:text-base">
              <p>
                EditMySave is a free, open-source platform that allows you to edit game save files directly in your
                web browser. No downloads, no installations, and no registration required. All processing happens
                entirely on your device, ensuring your save files remain private and secure.
              </p>
              <p>
                We support popular games including Sworn, Megabonk, Cloverpit, Balatro, BALL x PIT, and Deep Rock
                Galactic: Survivor. Each editor is specifically designed for its game, providing intuitive controls
                to modify currencies, resources, unlocks, and progression. Simply drag and drop your save file,
                make your edits, and download the modified version.
              </p>
              <p>
                Our save editors work on all modern browsers and platforms including Windows, Mac, and Linux. Whether
                you play on Steam, Epic Games Store, or other platforms, you can safely edit your game saves with
                our browser-based tools. Always remember to backup your original save files before making any changes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center space-y-2">
              <h3 className="font-semibold">100% Free</h3>
              <p className="text-sm text-muted-foreground">
                All save editors are completely free to use with no hidden fees or premium features.
              </p>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-semibold">Private & Secure</h3>
              <p className="text-sm text-muted-foreground">
                Your save files are processed entirely in your browser and never uploaded to any server.
              </p>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-semibold">Easy to Use</h3>
              <p className="text-sm text-muted-foreground">
                Simple drag-and-drop interface with no technical knowledge required.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center pt-8">
          <p className="text-sm text-muted-foreground">
            All editors work entirely in your browser. Your save files never leave your device.
          </p>
        </div>
      </div>
    </main>
  )
}
