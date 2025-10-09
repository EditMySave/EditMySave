"use client"

import { useState } from "react"
import {
  Sparkles,
  ArrowLeft,
  Coins,
  ShoppingBag,
  Trophy,
  Users,
  Map,
  Plus,
  Trash2,
  Package,
  Unlock,
  Lock,
  Save,
  Code,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { decodeSaveFromFile, encodeSaveToBlob, type MegabonkSave } from "@/lib/megabonk/decoder"
import Link from "next/link"
import { track } from "@vercel/analytics"
import { SaveFileUpload } from "@/components/save-file-upload"
import { SaveLocationHelp } from "@/components/save-location-help"
import { EditorSidebar } from "@/components/editor-sidebar"
import gamesData from "@/data/games.json"
import achievementsData from "@/data/megabonk/achievements.json"
import mapsData from "@/data/megabonk/maps.json"
import purchasesData from "@/data/megabonk/purchases.json"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { JsonTreeEditor } from "@/components/json-tree-editor"
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

function formatDate(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  return date.toLocaleDateString()
}

export default function MegabonkSaveEditor() {
  const [saveData, setSaveData] = useState<MegabonkSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
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
      alert("Failed to process save file. Please ensure it is a valid Megabonk save file.")
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
        editedFileName: originalFile.name,
      })
    } catch (error) {
      console.error("Error encoding save file:", error)
      alert("Failed to create edited save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const updateCurrency = (field: "gold" | "silver", value: string) => {
    if (!saveData) return
    const numValue = Number.parseInt(value) || 0
    setSaveData({ ...saveData, [field]: numValue })
  }

  const updateShopItem = (item: string, value: string) => {
    if (!saveData) return
    const numValue = Number.parseInt(value) || 0
    setSaveData({
      ...saveData,
      shopItems: { ...saveData.shopItems, [item]: numValue },
    })
  }

  const updateCharacterXP = (character: string, value: string) => {
    if (!saveData) return
    const numValue = Number.parseInt(value) || 0
    setSaveData({
      ...saveData,
      characterProgression: {
        ...saveData.characterProgression,
        [character]: {
          ...saveData.characterProgression[character],
          xp: numValue,
        },
      },
    })
  }

  const updateCharacterRuns = (character: string, value: string) => {
    if (!saveData) return
    const numValue = Number.parseInt(value) || 0
    setSaveData({
      ...saveData,
      characterProgression: {
        ...saveData.characterProgression,
        [character]: {
          ...saveData.characterProgression[character],
          numRuns: numValue,
        },
      },
    })
  }

  const toggleCharacterUnlock = (character: string, isUnlocked: boolean) => {
    if (!saveData) return
    setSaveData({
      ...saveData,
      characterProgression: {
        ...saveData.characterProgression,
        [character]: {
          xp: isUnlocked ? 100 : 0,
          numRuns: isUnlocked ? 1 : 0,
        },
      },
    })
  }

  const addAchievement = (achievement: string) => {
    if (!saveData) return
    setSaveData({
      ...saveData,
      achievements: [...saveData.achievements, achievement],
    })
  }

  const claimAchievement = (achievement: string) => {
    if (!saveData) return
    setSaveData({
      ...saveData,
      claimedAchievements: [...saveData.claimedAchievements, achievement],
    })
  }

  const removeAchievement = (achievement: string) => {
    if (!saveData) return
    setSaveData({
      ...saveData,
      achievements: saveData.achievements.filter((a) => a !== achievement),
      claimedAchievements: saveData.claimedAchievements.filter((a) => a !== achievement),
    })
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
    setSaveData(unlockAchievements(saveData))
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

  const quickStats = saveData
    ? [
        { label: "Gold", value: saveData.gold.toLocaleString(), icon: <Coins className="w-4 h-4 text-yellow-500" /> },
        {
          label: "Silver",
          value: saveData.silver.toLocaleString(),
          icon: <Coins className="w-4 h-4 text-slate-400" />,
        },
      ]
    : []

  const quickActions = saveData
    ? [
        {
          label: "Max All Currencies",
          onClick: () => {
            setSaveData(maxCurrencies(saveData))
          },
          icon: <Coins className="w-4 h-4 mr-2" />,
        },
        {
          label: "Max All Shop Items",
          onClick: maxAllShopItems,
          icon: <ShoppingBag className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Characters",
          onClick: unlockAllCharacters,
          icon: <Users className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Achievements",
          onClick: unlockAllAchievements,
          icon: <Trophy className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Purchases",
          onClick: unlockAllPurchases,
          icon: <Package className="w-4 h-4 mr-2" />,
        },
      ]
    : []

  const gameData = gamesData.games.find((game) => game.id === "megabonk")

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
        {!saveData ? (
          <div className="space-y-6">
            <div className="text-center space-y-2 py-8">
              <h2 className="text-3xl font-bold text-foreground">Megabonk Save Editor</h2>
              <p className="text-muted-foreground">
                Edit currencies, characters, achievements, shop items, and purchases
              </p>
            </div>

            {gameData && <SaveLocationHelp platforms={gameData.platforms} gameName={gameData.name} />}

            <SaveFileUpload onFileSelect={processSaveFile} acceptedFileTypes=".txt" isProcessing={isProcessing} />
          </div>
        ) : (
          <div className="flex gap-6 pt-4">
            <EditorSidebar
              onDownload={handleDownload}
              onLoadNew={() => {
                setSaveData(null)
                setOriginalFile(null)
              }}
              isProcessing={isProcessing}
              hasSaveData={!!saveData}
              fileName={originalFile?.name}
              fileSize={originalFile?.size}
              lastModified={originalFile ? new Date() : undefined} // Placeholder, ideally should be from file metadata
              quickStats={quickStats}
              quickActions={quickActions}
            />

            <div className="flex-1 space-y-4">
              <Tabs defaultValue="currencies" className="w-full">
                <TabsList className="grid w-full grid-cols-7 bg-card border border-border">
                  <TabsTrigger value="currencies" className="data-[state=active]:bg-muted">
                    <Coins className="w-4 h-4 mr-2" />
                    Currencies
                  </TabsTrigger>
                  <TabsTrigger value="shop" className="data-[state=active]:bg-muted">
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Shop Items
                  </TabsTrigger>
                  <TabsTrigger value="characters" className="data-[state=active]:bg-muted">
                    <Users className="w-4 h-4 mr-2" />
                    Characters
                  </TabsTrigger>
                  <TabsTrigger value="achievements" className="data-[state=active]:bg-muted">
                    <Trophy className="w-4 h-4 mr-2" />
                    Achievements
                  </TabsTrigger>
                  <TabsTrigger value="purchases" className="data-[state=active]:bg-muted">
                    <Package className="w-4 h-4 mr-2" />
                    Purchases
                  </TabsTrigger>
                  <TabsTrigger value="maps" className="data-[state=active]:bg-muted">
                    <Map className="w-4 h-4 mr-2" />
                    Maps
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="data-[state=active]:bg-muted">
                    <Code className="w-4 h-4 mr-2" />
                    Raw JSON
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="currencies" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <Coins className="w-5 h-5 text-yellow-500" />
                          Gold
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Input
                          type="number"
                          value={saveData.gold}
                          onChange={(e) => updateCurrency("gold", e.target.value)}
                          min="0"
                          className="font-mono text-lg bg-muted border-border text-foreground"
                        />
                      </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <Coins className="w-5 h-5 text-muted-foreground" />
                          Silver
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Input
                          type="number"
                          value={saveData.silver}
                          onChange={(e) => updateCurrency("silver", e.target.value)}
                          min="0"
                          className="font-mono text-lg bg-muted border-border text-foreground"
                        />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="shop" className="space-y-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-foreground">Shop Items</CardTitle>
                        <Button
                          onClick={maxAllShopItems}
                          variant="outline"
                          size="sm"
                          className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                        >
                          Max All (999)
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ScrollArea className="h-[500px] pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {Object.entries(saveData.shopItems).map(([item, quantity]) => (
                            <div key={item} className="space-y-2 p-3 bg-muted rounded-lg border border-border">
                              <Label className="text-sm font-medium text-card-foreground">{item}</Label>
                              <Input
                                type="number"
                                value={quantity}
                                onChange={(e) => updateShopItem(item, e.target.value)}
                                min="0"
                                className="font-mono bg-background border-border text-foreground"
                              />
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="characters" className="space-y-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-foreground">Characters</CardTitle>
                        <div className="flex gap-2">
                          <Button
                            onClick={unlockAllCharacters}
                            variant="outline"
                            size="sm"
                            className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                          >
                            Unlock All
                          </Button>
                          <Button
                            onClick={maxAllCharacters}
                            variant="outline"
                            size="sm"
                            className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                          >
                            Max All
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ScrollArea className="h-[500px] pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries(saveData.characterProgression).map(([character, data]) => {
                            const isUnlocked = data.xp > 0 || data.numRuns > 0
                            return (
                              <div key={character} className="space-y-3 p-4 bg-muted rounded-lg border border-border">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-foreground">{character}</span>
                                  {isUnlocked ? (
                                    <Badge
                                      variant="secondary"
                                      className="gap-1 bg-green-500/20 text-green-400 border-green-500/30"
                                    >
                                      <Unlock className="w-3 h-3" />
                                      Unlocked
                                    </Badge>
                                  ) : (
                                    <Button
                                      onClick={() => toggleCharacterUnlock(character, true)}
                                      size="sm"
                                      variant="outline"
                                      className="gap-1 text-primary border-primary/30 hover:bg-primary/10"
                                    >
                                      <Lock className="w-3 h-3" />
                                      Unlock
                                    </Button>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <div className="space-y-1.5">
                                    <Label htmlFor={`${character}-xp`} className="text-xs text-muted-foreground">
                                      XP
                                    </Label>
                                    <Input
                                      id={`${character}-xp`}
                                      type="number"
                                      value={data.xp}
                                      onChange={(e) => updateCharacterXP(character, e.target.value)}
                                      min="0"
                                      className="font-mono bg-background border-border text-foreground"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label htmlFor={`${character}-runs`} className="text-xs text-muted-foreground">
                                      Number of Runs
                                    </Label>
                                    <Input
                                      id={`${character}-runs`}
                                      type="number"
                                      value={data.numRuns}
                                      onChange={(e) => updateCharacterRuns(character, e.target.value)}
                                      min="0"
                                      className="font-mono bg-background border-border text-foreground"
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="achievements" className="space-y-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-foreground">Achievement Progress</CardTitle>
                        <Button
                          onClick={unlockAllAchievements}
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
                            {saveData.claimedAchievements.length} / {availableAchievements.length}
                          </p>
                          <p className="text-sm text-muted-foreground">Achievements Unlocked</p>
                        </div>
                      </div>

                      <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-2">
                          {availableAchievements.map((achievement) => {
                            const isInSave = saveData.achievements.includes(achievement)
                            const isClaimed = saveData.claimedAchievements.includes(achievement)

                            return (
                              <div
                                key={achievement}
                                className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors"
                              >
                                <span className="font-mono text-sm text-card-foreground">{achievement}</span>
                                <div className="flex gap-2">
                                  {!isInSave ? (
                                    <Button
                                      onClick={() => addAchievement(achievement)}
                                      size="sm"
                                      variant="outline"
                                      className="text-primary border-primary/30 hover:bg-primary/10"
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      Add
                                    </Button>
                                  ) : (
                                    <>
                                      {!isClaimed && (
                                        <Button
                                          onClick={() => claimAchievement(achievement)}
                                          size="sm"
                                          className="bg-primary hover:bg-primary/90"
                                        >
                                          <Trophy className="w-3 h-3 mr-1" />
                                          Claim
                                        </Button>
                                      )}
                                      {isClaimed && (
                                        <Badge
                                          variant="secondary"
                                          className="text-xs bg-green-500/20 text-green-400 border-green-500/30"
                                        >
                                          Claimed
                                        </Badge>
                                      )}
                                      <Button
                                        onClick={() => removeAchievement(achievement)}
                                        size="sm"
                                        variant="ghost"
                                        className="text-muted-foreground hover:text-foreground"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

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

                <TabsContent value="maps" className="space-y-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <CardTitle className="text-foreground">Map Unlocks</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
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
                                  <p className="text-xs text-muted-foreground">{isUnlocked ? "Unlocked" : "Locked"}</p>
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
                                    const existingTiers = Object.keys(mapData.tierCompletionsWithCharacters).map(Number)
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

                <TabsContent value="raw" className="space-y-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Code className="w-5 h-5" />
                        Raw JSON Editor
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <JsonTreeEditor data={saveData} onChange={setSaveData} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg text-sm">
                <div className="flex items-center gap-2 text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span>{originalFile?.name} loaded</span>
                </div>
                <span className="text-muted-foreground">Last modified: {originalFile && formatDate(new Date())}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {saveData && (
        <div className="fixed bottom-0 left-0 right-0 bg-card backdrop-blur-sm border-t border-border z-50">
          <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-end">
            <Button
              onClick={handleDownload}
              disabled={isProcessing}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
            >
              <Save className="w-5 h-5 mr-2" />
              {isProcessing ? "Processing..." : "Download Edited Save"}
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
