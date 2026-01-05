"use client"
import { useState } from "react"
import { Sparkles, ArrowLeft, Code, Coins, Users, Trophy, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { decodeSaveFromFile, encodeSaveToBlob, type MegabonkSave } from "@/lib/megabonk/decoder"
import { downloadJSON } from "@/lib/download-json"
import Link from "next/link"
import { track } from "@vercel/analytics"
import { SaveFileUpload } from "@/components/save-file-upload"
import { SaveLocationHelp } from "@/components/save-location-help"
import { EditorSidebar } from "@/components/editor-sidebar"
import { JsonTreeEditor } from "@/components/json-tree-editor"
import gamesData from "@/data/games.json"
import achievementsData from "@/data/megabonk/achievements.json"
import purchasesData from "@/data/megabonk/purchases.json"
import {
  maxAllCurrencies,
  maxAllShopItems,
  maxAllCharacters,
  unlockAllCharacters,
  unlockAllAchievements,
  unlockAllPurchases,
} from "./save-mutations"

export default function MegabonkSaveEditor() {
  const [saveData, setSaveData] = useState<MegabonkSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currencySearch, setCurrencySearch] = useState("")
  const [characterSearch, setCharacterSearch] = useState("")
  const [achievementSearch, setAchievementSearch] = useState("")

  const processSaveFile = async (file: File) => {
    setIsProcessing(true)
    try {
      const decoded = await decodeSaveFromFile(file)
      setSaveData(decoded)
      setOriginalFile(file)

      track("file_uploaded", {
        game: "Megabonk",
        fileSize: file.size,
        fileName: file.name,
      })
    } catch (error) {
      console.error("Error processing save file:", error)
      alert("Failed to process save file. Please ensure it is a valid Megabonk progression.json file")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = async () => {
    if (!saveData || !originalFile) return

    setIsProcessing(true)
    try {
      const blob = await encodeSaveToBlob(saveData)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = originalFile.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      track("file_downloaded", {
        game: "Megabonk",
        fileName: originalFile.name,
      })
    } catch (error) {
      console.error("Error encoding save file:", error)
      alert("Failed to create edited save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleLoadNew = () => {
    setSaveData(null)
    setOriginalFile(null)
  }

  const gameData = gamesData.games.find((game) => game.id === "megabonk")

  const quickStats = saveData
    ? [
        {
          label: "Gold",
          value: saveData.gold,
          icon: <Coins className="w-4 h-4 text-yellow-500" />,
        },
        {
          label: "Silver",
          value: saveData.silver,
          icon: <Coins className="w-4 h-4 text-gray-400" />,
        },
        {
          label: "Achievements",
          value: saveData.achievements.length,
          icon: <Trophy className="w-4 h-4 text-orange-500" />,
        },
        {
          label: "Characters",
          value: Object.keys(saveData.characterProgression).length,
          icon: <Users className="w-4 h-4 text-purple-500" />,
        },
      ]
    : []

  const quickActions = saveData
    ? [
        {
          label: "Max All Currencies",
          onClick: () => setSaveData(maxAllCurrencies(saveData)),
          icon: <Coins className="w-4 h-4 mr-2" />,
        },
        {
          label: "Max All Shop Items",
          onClick: () => setSaveData(maxAllShopItems(saveData)),
          icon: <ShoppingCart className="w-4 h-4 mr-2" />,
        },
        {
          label: "Max All Characters",
          onClick: () => setSaveData(maxAllCharacters(saveData)),
          icon: <Users className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Characters",
          onClick: () => setSaveData(unlockAllCharacters(saveData)),
          icon: <Sparkles className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Achievements",
          onClick: () => setSaveData(unlockAllAchievements(saveData, achievementsData.achievements)),
          icon: <Trophy className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Purchases",
          onClick: () => setSaveData(unlockAllPurchases(saveData, purchasesData.purchases)),
          icon: <Sparkles className="w-4 h-4 mr-2" />,
        },
        {
          label: "Download JSON",
          onClick: () => {
            const filename = originalFile?.name.replace(/\.[^/.]+$/, "") || "megabonk-save"
            downloadJSON(saveData, filename)
            track("json_downloaded", {
              game: "Megabonk",
              fileName: originalFile?.name,
            })
          },
          icon: <Code className="w-4 h-4 mr-2" />,
        },
      ]
    : []

  if (!saveData) {
    return (
      <main className="min-h-screen bg-background pb-20">
        <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
          <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Megabonk</h1>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link href="/" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Games
              </Link>
            </Button>
          </div>
        </div>

        <div className="w-full max-w-7xl mx-auto p-6">
          <div className="space-y-6">
            <div className="text-center space-y-2 py-8">
              <h2 className="text-3xl font-bold text-foreground">Megabonk Save Editor</h2>
              <p className="text-muted-foreground">Edit currencies, characters, achievements, and shop items</p>
            </div>

            {gameData && <SaveLocationHelp platforms={gameData.platforms} gameName={gameData.name} />}

            <SaveFileUpload onFileSelect={processSaveFile} acceptedFileTypes=".json" isProcessing={isProcessing} />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Megabonk</h1>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link href="/" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Games
            </Link>
          </Button>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto p-6">
        <div className="flex gap-6 pt-4">
          <EditorSidebar
            onDownload={handleDownload}
            onLoadNew={handleLoadNew}
            isProcessing={isProcessing}
            hasSaveData={!!saveData}
            fileName={originalFile?.name}
            fileSize={originalFile?.size}
            lastModified={originalFile ? new Date() : undefined}
            quickStats={quickStats}
            quickActions={quickActions}
          />

          <div className="flex-1 space-y-4">
            <Tabs defaultValue="currencies" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 h-auto bg-card border border-border p-2">
                <TabsTrigger value="currencies" className="w-full data-[state=active]:bg-muted">
                  <Coins className="w-4 h-4 mr-2" />
                  Currencies
                </TabsTrigger>
                <TabsTrigger value="characters" className="w-full data-[state=active]:bg-muted">
                  <Users className="w-4 h-4 mr-2" />
                  Characters
                </TabsTrigger>
                <TabsTrigger value="achievements" className="w-full data-[state=active]:bg-muted">
                  <Trophy className="w-4 h-4 mr-2" />
                  Achievements
                </TabsTrigger>
                <TabsTrigger value="shop" className="w-full data-[state=active]:bg-muted">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Shop
                </TabsTrigger>
                <TabsTrigger value="raw" className="w-full data-[state=active]:bg-muted">
                  <Code className="w-4 h-4 mr-2" />
                  Raw JSON
                </TabsTrigger>
              </TabsList>

              {/* Currencies Tab */}
              <TabsContent value="currencies" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="text-foreground">Currencies</CardTitle>
                    <CardDescription>Edit your gold and silver</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="gold" className="text-sm font-medium text-card-foreground">
                          Gold
                        </Label>
                        <Input
                          id="gold"
                          type="number"
                          value={saveData.gold}
                          onChange={(e) =>
                            setSaveData({
                              ...saveData,
                              gold: Number.parseInt(e.target.value) || 0,
                            })
                          }
                          className="font-mono bg-muted border-border text-foreground"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="silver" className="text-sm font-medium text-card-foreground">
                          Silver
                        </Label>
                        <Input
                          id="silver"
                          type="number"
                          value={saveData.silver}
                          onChange={(e) =>
                            setSaveData({
                              ...saveData,
                              silver: Number.parseInt(e.target.value) || 0,
                            })
                          }
                          className="font-mono bg-muted border-border text-foreground"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Characters Tab */}
              <TabsContent value="characters" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="text-foreground">Characters</CardTitle>
                    <CardDescription>Manage character progression</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-2 mb-4">
                      <Label htmlFor="char-search" className="text-sm font-medium text-card-foreground">
                        Search Characters
                      </Label>
                      <Input
                        id="char-search"
                        placeholder="Filter characters..."
                        value={characterSearch}
                        onChange={(e) => setCharacterSearch(e.target.value)}
                        className="font-mono bg-muted border-border text-foreground"
                      />
                    </div>

                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-4">
                        {Object.entries(saveData.characterProgression)
                          .filter(([name]) => name.toLowerCase().includes(characterSearch.toLowerCase()))
                          .map(([characterName, progression]) => (
                            <Card key={characterName} className="bg-muted border-border">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base text-foreground">{characterName}</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium text-card-foreground">XP</Label>
                                    <Input
                                      type="number"
                                      value={progression.xp}
                                      onChange={(e) => {
                                        const updated = { ...saveData }
                                        updated.characterProgression[characterName].xp =
                                          Number.parseInt(e.target.value) || 0
                                        setSaveData(updated)
                                      }}
                                      className="font-mono bg-background border-border text-foreground text-sm"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium text-card-foreground">Runs</Label>
                                    <Input
                                      type="number"
                                      value={progression.numRuns}
                                      onChange={(e) => {
                                        const updated = { ...saveData }
                                        updated.characterProgression[characterName].numRuns =
                                          Number.parseInt(e.target.value) || 0
                                        setSaveData(updated)
                                      }}
                                      className="font-mono bg-background border-border text-foreground text-sm"
                                    />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Achievements Tab */}
              <TabsContent value="achievements" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="text-foreground">Achievements</CardTitle>
                    <CardDescription>
                      {saveData.achievements.length} of {achievementsData.achievements.length} unlocked
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-2 mb-4">
                      <Label htmlFor="ach-search" className="text-sm font-medium text-card-foreground">
                        Search Achievements
                      </Label>
                      <Input
                        id="ach-search"
                        placeholder="Filter achievements..."
                        value={achievementSearch}
                        onChange={(e) => setAchievementSearch(e.target.value)}
                        className="font-mono bg-muted border-border text-foreground"
                      />
                    </div>

                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-2">
                        {achievementsData.achievements
                          .filter((id) => id.toLowerCase().includes(achievementSearch.toLowerCase()))
                          .map((achievementId) => (
                            <div key={achievementId} className="flex items-center space-x-2">
                              <Checkbox
                                id={achievementId}
                                checked={saveData.achievements.includes(achievementId)}
                                onCheckedChange={(checked) => {
                                  const updated = { ...saveData }
                                  if (checked) {
                                    if (!updated.achievements.includes(achievementId)) {
                                      updated.achievements.push(achievementId)
                                    }
                                  } else {
                                    updated.achievements = updated.achievements.filter((id) => id !== achievementId)
                                  }
                                  setSaveData(updated)
                                }}
                                className="border-border"
                              />
                              <Label
                                htmlFor={achievementId}
                                className="text-sm cursor-pointer text-foreground font-normal"
                              >
                                {achievementId}
                              </Label>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Shop Items Tab */}
              <TabsContent value="shop" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="text-foreground">Shop Items</CardTitle>
                    <CardDescription>Edit shop item quantities</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-2 mb-4">
                      <Label htmlFor="shop-search" className="text-sm font-medium text-card-foreground">
                        Search Shop Items
                      </Label>
                      <Input
                        id="shop-search"
                        placeholder="Filter items..."
                        value={currencySearch}
                        onChange={(e) => setCurrencySearch(e.target.value)}
                        className="font-mono bg-muted border-border text-foreground"
                      />
                    </div>

                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-3">
                        {Object.entries(saveData.shopItems)
                          .filter(([name]) => name.toLowerCase().includes(currencySearch.toLowerCase()))
                          .map(([itemName, quantity]) => (
                            <Card key={itemName} className="bg-muted border-border">
                              <CardContent className="pt-4">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <Label className="text-sm font-medium text-card-foreground">{itemName}</Label>
                                  </div>
                                  <Input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => {
                                      const updated = { ...saveData }
                                      updated.shopItems[itemName] = Number.parseInt(e.target.value) || 0
                                      setSaveData(updated)
                                    }}
                                    className="w-24 font-mono bg-background border-border text-foreground text-sm"
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Raw JSON Tab */}
              <TabsContent value="raw" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="text-foreground">Raw JSON</CardTitle>
                    <CardDescription>View and edit raw save data</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <JsonTreeEditor data={saveData} onChange={setSaveData} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </main>
  )
}
