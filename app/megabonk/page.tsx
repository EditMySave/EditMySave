"use client"
import type React from "react"
import { useState } from "react"
import {
  Sparkles,
  ArrowLeft,
  Code,
  Coins,
  Users,
  Trophy,
  ShoppingCart,
  Map,
  Plus,
  Trash2,
  Package,
  BarChart3,
  Download,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  decodeSaveFromFile,
  encodeSaveToBlob,
  decryptSave,
  encryptSave,
  type MegabonkSave,
} from "@/lib/megabonk/decoder"
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
import mapsData from "@/data/megabonk/maps.json"
import {
  maxAllCurrencies as maxCurrencies,
  maxAllShopItems as maxShopItems,
  maxAllCharacters as maxCharacters,
  unlockAllCharacters as unlockCharacters,
  unlockAllAchievements as unlockAchievements,
  unlockAllPurchases as unlockPurchases,
  unlockMap as unlockMapMutation,
  updateMapTierCompletions as updateTierCompletions,
  updateMapTierRuns as updateTierRuns,
  updateMapTierHighscore as updateTierHighscore,
  updateMapTierFastestTime as updateTierFastestTime,
  addTierToMap as addTier,
  removeTierFromMap as removeTier,
  toggleCharacterInTier as toggleCharacter,
} from "./save-mutations"

export default function MegabonkSaveEditor() {
  const [saveData, setSaveData] = useState<MegabonkSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currencySearch, setCurrencySearch] = useState("")
  const [characterSearch, setCharacterSearch] = useState("")
  const [achievementSearch, setAchievementSearch] = useState("")
  const [statsData, setStatsData] = useState<any | null>(null)
  const [statsFileName, setStatsFileName] = useState<string | null>(null)
  const [isDraggingStats, setIsDraggingStats] = useState(false)

  const availableAchievements = achievementsData.achievements
  const availableMaps = mapsData.maps
  const availablePurchases = purchasesData.purchases

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

  const unlockMap = (mapName: string) => {
    if (!saveData) return
    setSaveData(unlockMapMutation(saveData, mapName))
  }

  const updateMapTierCompletions = (mapName: string, tier: string, characters: string[]) => {
    if (!saveData) return
    setSaveData(updateTierCompletions(saveData, mapName, tier, characters))
  }

  const updateMapTierRuns = (mapName: string, tier: string, runs: number) => {
    if (!saveData) return
    setSaveData(updateTierRuns(saveData, mapName, tier, runs))
  }

  const updateMapTierHighscore = (mapName: string, tier: string, score: number) => {
    if (!saveData) return
    setSaveData(updateTierHighscore(saveData, mapName, tier, score))
  }

  const updateMapTierFastestTime = (mapName: string, tier: string, time: number) => {
    if (!saveData) return
    setSaveData(updateTierFastestTime(saveData, mapName, tier, time))
  }

  const addTierToMap = (mapName: string, tier: string) => {
    if (!saveData) return
    setSaveData(addTier(saveData, mapName, tier))
  }

  const removeTierFromMap = (mapName: string, tier: string) => {
    if (!saveData) return
    setSaveData(removeTier(saveData, mapName, tier))
  }

  const toggleCharacterInTier = (mapName: string, tier: string, character: string) => {
    if (!saveData) return
    setSaveData(toggleCharacter(saveData, mapName, tier, character))
  }

  const unlockAllAchievements = () => {
    if (!saveData) return
    setSaveData(unlockAchievements(saveData, availableAchievements))
  }

  const maxAllShopItems = () => {
    if (!saveData) return
    setSaveData(maxShopItems(saveData))
  }

  const maxAllCharacters = () => {
    if (!saveData) return
    setSaveData(maxCharacters(saveData))
  }

  const unlockAllCharacters = () => {
    if (!saveData) return
    setSaveData(unlockCharacters(saveData))
  }

  const togglePurchase = (purchase: string, isPurchased: boolean) => {
    if (!saveData) return
    const newPurchases = isPurchased
      ? [...saveData.purchases, purchase]
      : saveData.purchases.filter((p) => p !== purchase)
    setSaveData({
      ...saveData,
      purchases: newPurchases,
    })
  }

  const unlockAllPurchases = () => {
    if (!saveData) return
    setSaveData(unlockPurchases(saveData, availablePurchases))
  }

  const handleStatsFileUpload = async (file: File) => {
    try {
      const encryptedText = await file.text()
      const decrypted = await decryptSave(encryptedText)
      const json = JSON.parse(decrypted)
      setStatsData(json)
      setStatsFileName(file.name)
      track("stats_file_uploaded", {
        game: "Megabonk",
        fileSize: file.size,
        fileName: file.name,
      })
    } catch (error) {
      console.error("Error parsing stats file:", error)
      alert("Failed to decrypt and parse stats.json file. Please ensure it is a valid encrypted Megabonk stats file.")
    }
  }

  const handleStatsFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleStatsFileUpload(files[0])
    }
  }

  const handleStatsDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingStats(true)
  }

  const handleStatsDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingStats(false)
  }

  const handleStatsDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingStats(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleStatsFileUpload(files[0])
    }
  }

  const handleDownloadStats = async () => {
    if (!statsData || !statsFileName) return

    try {
      const jsonString = JSON.stringify(statsData)
      const encrypted = await encryptSave(jsonString)
      const blob = new Blob([encrypted], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = statsFileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      track("stats_file_downloaded", {
        game: "Megabonk",
        fileName: statsFileName,
      })
    } catch (error) {
      console.error("Error encrypting stats file:", error)
      alert("Failed to encrypt stats file for download.")
    }
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
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2 h-auto bg-card border border-border p-2">
                <TabsTrigger value="currencies" className="w-full data-[state=active]:bg-muted">
                  <Coins className="w-4 h-4 mr-2" />
                  Currencies
                </TabsTrigger>
                <TabsTrigger value="shop" className="w-full data-[state=active]:bg-muted">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Shop
                </TabsTrigger>
                <TabsTrigger value="characters" className="w-full data-[state=active]:bg-muted">
                  <Users className="w-4 h-4 mr-2" />
                  Characters
                </TabsTrigger>
                <TabsTrigger value="achievements" className="w-full data-[state=active]:bg-muted">
                  <Trophy className="w-4 h-4 mr-2" />
                  Achievements
                </TabsTrigger>
                <TabsTrigger value="purchases" className="w-full data-[state=active]:bg-muted">
                  <Package className="w-4 h-4 mr-2" />
                  Purchases
                </TabsTrigger>
                <TabsTrigger value="maps" className="w-full data-[state=active]:bg-muted">
                  <Map className="w-4 h-4 mr-2" />
                  Maps
                </TabsTrigger>
                <TabsTrigger value="stats" className="w-full data-[state=active]:bg-muted">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Stats
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

              {/* Purchases Tab */}
              <TabsContent value="purchases" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader className="border-b border-border">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-foreground">Purchases</CardTitle>
                      <Button
                        onClick={unlockAllPurchases}
                        variant="outline"
                        size="sm"
                        className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                      >
                        Unlock All
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border">
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {saveData.purchases.length} / {availablePurchases.length}
                        </p>
                        <p className="text-sm text-muted-foreground">Items Purchased</p>
                      </div>
                    </div>

                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-2">
                        {availablePurchases.map((purchase) => {
                          const isPurchased = saveData.purchases.includes(purchase)
                          let category = "Item"
                          if (purchase.startsWith("w_")) category = "Weapon"
                          else if (purchase.startsWith("c_")) category = "Character"
                          else if (purchase.startsWith("i_")) category = "Item"

                          return (
                            <div
                              key={purchase}
                              className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-sm text-card-foreground">{purchase}</span>
                                <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                                  {category}
                                </Badge>
                              </div>
                              {isPurchased ? (
                                <Button
                                  onClick={() => togglePurchase(purchase, false)}
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Remove
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => togglePurchase(purchase, true)}
                                  size="sm"
                                  variant="outline"
                                  className="text-primary border-primary/30 hover:bg-primary/10"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add
                                </Button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Maps Tab */}
              <TabsContent value="maps" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="text-foreground">Map Unlocks</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {availableMaps.map((map) => {
                        const isUnlocked = !!saveData.menuMeta.mapsProgress[map.name]
                        return (
                          <div
                            key={map.name}
                            className="flex items-center justify-between p-4 bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Map className="w-5 h-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-foreground">{map.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {isUnlocked ? "Unlocked" : "Locked"}
                                </p>
                              </div>
                            </div>
                            {isUnlocked ? (
                              <Badge
                                variant="secondary"
                                className="bg-green-500/20 text-green-400 border-green-500/30"
                              >
                                Unlocked
                              </Badge>
                            ) : (
                              <Button
                                onClick={() => unlockMap(map.name)}
                                size="sm"
                                variant="outline"
                                className="text-primary border-primary/30 hover:bg-primary/10"
                              >
                                Unlock
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="text-foreground">Map Progression</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Tabs
                      defaultValue={Object.keys(saveData.menuMeta.mapsProgress).filter((m) => m !== "None")[0]}
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-5 bg-muted border border-border">
                        {Object.keys(saveData.menuMeta.mapsProgress)
                          .filter((mapName) => mapName !== "None")
                          .map((mapName) => (
                            <TabsTrigger key={mapName} value={mapName} className="data-[state=active]:bg-card">
                              {mapName}
                            </TabsTrigger>
                          ))}
                      </TabsList>

                      {Object.entries(saveData.menuMeta.mapsProgress)
                        .filter(([mapName]) => mapName !== "None")
                        .map(([mapName, mapData]) => {
                          const mapConfig = availableMaps.find((m) => m.name === mapName)
                          const maxTiers = mapConfig?.maxTiers || 3

                          return (
                            <TabsContent key={mapName} value={mapName} className="space-y-4">
                              <ScrollArea className="h-[400px] pr-4">
                                <div className="space-y-3">
                                  <Accordion type="single" collapsible className="w-full">
                                    {Object.keys(mapData.tierCompletionsWithCharacters)
                                      .sort((a, b) => Number.parseInt(a) - Number.parseInt(b))
                                      .map((tier) => {
                                        const displayTier = Number.parseInt(tier) + 1
                                        return (
                                          <AccordionItem
                                            key={tier}
                                            value={tier}
                                            className="border-border bg-muted rounded-lg mb-2 px-4"
                                          >
                                            <AccordionTrigger className="hover:no-underline text-foreground">
                                              <div className="flex items-center justify-between w-full pr-4">
                                                <span className="font-semibold">Tier {displayTier}</span>
                                                <Button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    removeTierFromMap(mapName, tier)
                                                  }}
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </Button>
                                              </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="space-y-3 pt-3">
                                              <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">
                                                  Characters Completed With:
                                                </Label>
                                                <div className="flex flex-wrap gap-2">
                                                  {Object.keys(saveData.characterProgression).map((character) => {
                                                    const isCompleted =
                                                      mapData.tierCompletionsWithCharacters[tier]?.includes(
                                                        character,
                                                      ) || false
                                                    return (
                                                      <Badge
                                                        key={character}
                                                        variant={isCompleted ? "default" : "outline"}
                                                        className={`cursor-pointer ${
                                                          isCompleted
                                                            ? "bg-primary hover:bg-primary/90"
                                                            : "border-border text-muted-foreground hover:bg-muted"
                                                        }`}
                                                        onClick={() =>
                                                          toggleCharacterInTier(mapName, tier, character)
                                                        }
                                                      >
                                                        {character}
                                                      </Badge>
                                                    )
                                                  })}
                                                </div>
                                              </div>

                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div className="space-y-1.5">
                                                  <Label
                                                    htmlFor={`${mapName}-${tier}-runs`}
                                                    className="text-xs text-muted-foreground"
                                                  >
                                                    Number of Runs
                                                  </Label>
                                                  <Input
                                                    id={`${mapName}-${tier}-runs`}
                                                    type="number"
                                                    value={mapData.numRunsByTier[tier] || 0}
                                                    onChange={(e) =>
                                                      updateMapTierRuns(
                                                        mapName,
                                                        tier,
                                                        Number.parseInt(e.target.value) || 0,
                                                      )
                                                    }
                                                    min="0"
                                                    className="font-mono h-9 bg-background border-border text-foreground"
                                                  />
                                                </div>
                                                <div className="space-y-1.5">
                                                  <Label
                                                    htmlFor={`${mapName}-${tier}-highscore`}
                                                    className="text-xs text-muted-foreground"
                                                  >
                                                    Highscore
                                                  </Label>
                                                  <Input
                                                    id={`${mapName}-${tier}-highscore`}
                                                    type="number"
                                                    value={mapData.tierHighscores[tier] || 0}
                                                    onChange={(e) =>
                                                      updateMapTierHighscore(
                                                        mapName,
                                                        tier,
                                                        Number.parseInt(e.target.value) || 0,
                                                      )
                                                    }
                                                    min="0"
                                                    className="font-mono h-9 bg-background border-border text-foreground"
                                                  />
                                                </div>
                                                <div className="space-y-1.5">
                                                  <Label
                                                    htmlFor={`${mapName}-${tier}-time`}
                                                    className="text-xs text-muted-foreground"
                                                  >
                                                    Fastest Time (s)
                                                  </Label>
                                                  <Input
                                                    id={`${mapName}-${tier}-time`}
                                                    type="number"
                                                    step="0.01"
                                                    value={mapData.tierFastestTimes[tier] || 0}
                                                    onChange={(e) =>
                                                      updateMapTierFastestTime(
                                                        mapName,
                                                        tier,
                                                        Number.parseFloat(e.target.value) || 0,
                                                      )
                                                    }
                                                    min="0"
                                                    className="font-mono h-9 bg-background border-border text-foreground"
                                                  />
                                                </div>
                                              </div>
                                            </AccordionContent>
                                          </AccordionItem>
                                        )
                                      })}
                                  </Accordion>
                                </div>
                              </ScrollArea>

                              <Button
                                onClick={() => {
                                  const existingTiers = Object.keys(mapData.tierCompletionsWithCharacters).map(
                                    Number,
                                  )
                                  const nextTier = existingTiers.length > 0 ? Math.max(...existingTiers) + 1 : 0
                                  if (nextTier < maxTiers) {
                                    addTierToMap(mapName, nextTier.toString())
                                  }
                                }}
                                variant="outline"
                                size="sm"
                                className="w-full text-primary border-primary/30 hover:bg-primary/10"
                                disabled={Object.keys(mapData.tierCompletionsWithCharacters).length >= maxTiers}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add New Tier{" "}
                                {Object.keys(mapData.tierCompletionsWithCharacters).length >= maxTiers &&
                                  "(Max Reached)"}
                              </Button>
                            </TabsContent>
                          )
                        })}
                    </Tabs>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Stats Tab */}
              <TabsContent value="stats" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Stats JSON Editor
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {!statsData ? (
                      <div
                        onDragOver={handleStatsDragOver}
                        onDragLeave={handleStatsDragLeave}
                        onDrop={handleStatsDrop}
                        className={`flex flex-col items-center justify-center gap-4 p-12 rounded-lg border-2 border-dashed transition-colors ${
                          isDraggingStats ? "bg-accent border-primary" : "bg-muted border-border"
                        }`}
                      >
                        <Upload className="w-12 h-12 text-muted-foreground" />
                        <div className="text-center space-y-2">
                          <p className="text-lg font-medium text-foreground">Drop your stats.json file here</p>
                          <p className="text-sm text-muted-foreground">or click to browse</p>
                        </div>
                        <input
                          type="file"
                          id="stats-file-input"
                          className="hidden"
                          onChange={handleStatsFileInput}
                          accept=".json"
                        />
                        <Button asChild variant="secondary">
                          <label htmlFor="stats-file-input" className="cursor-pointer">
                            Browse Files
                          </label>
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                          <div className="flex items-center gap-2 text-green-400">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            <span className="text-sm">{statsFileName} loaded</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleDownloadStats}
                              variant="outline"
                              size="sm"
                              className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                            <Button
                              onClick={() => {
                                setStatsData(null)
                                setStatsFileName(null)
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Clear
                            </Button>
                          </div>
                        </div>
                        <JsonTreeEditor data={statsData} onChange={setStatsData} />
                      </div>
                    )}
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
