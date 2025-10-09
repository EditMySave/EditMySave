"use client"

import { useState } from "react"
import {
  Download,
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
import gamesData from "@/data/games.json"
import achievementsData from "@/data/megabonk/achievements.json"
import mapsData from "@/data/megabonk/maps.json"
import purchasesData from "@/data/megabonk/purchases.json"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

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
    if (saveData.menuMeta.mapsProgress[mapName]) return // Already unlocked

    setSaveData({
      ...saveData,
      menuMeta: {
        ...saveData.menuMeta,
        mapsProgress: {
          ...saveData.menuMeta.mapsProgress,
          [mapName]: {
            tierNotifications: [],
            tierChallengeNotifications: [],
            newMapNotification: true,
            lastSelectTier: 0,
            completedTiers: [],
            tierCompletionsWithCharacters: { "0": [] },
            numRunsByTier: {},
            tierHighscores: {},
            tierFastestTimes: {},
          },
        },
      },
    })
  }

  const updateMapTierCompletions = (mapName: string, tier: string, characters: string[]) => {
    if (!saveData || !saveData.menuMeta.mapsProgress[mapName]) return
    setSaveData({
      ...saveData,
      menuMeta: {
        ...saveData.menuMeta,
        mapsProgress: {
          ...saveData.menuMeta.mapsProgress,
          [mapName]: {
            ...saveData.menuMeta.mapsProgress[mapName],
            tierCompletionsWithCharacters: {
              ...saveData.menuMeta.mapsProgress[mapName].tierCompletionsWithCharacters,
              [tier]: characters,
            },
          },
        },
      },
    })
  }

  const updateMapTierRuns = (mapName: string, tier: string, runs: number) => {
    if (!saveData || !saveData.menuMeta.mapsProgress[mapName]) return
    setSaveData({
      ...saveData,
      menuMeta: {
        ...saveData.menuMeta,
        mapsProgress: {
          ...saveData.menuMeta.mapsProgress,
          [mapName]: {
            ...saveData.menuMeta.mapsProgress[mapName],
            numRunsByTier: {
              ...saveData.menuMeta.mapsProgress[mapName].numRunsByTier,
              [tier]: runs,
            },
          },
        },
      },
    })
  }

  const updateMapTierHighscore = (mapName: string, tier: string, score: number) => {
    if (!saveData || !saveData.menuMeta.mapsProgress[mapName]) return
    setSaveData({
      ...saveData,
      menuMeta: {
        ...saveData.menuMeta,
        mapsProgress: {
          ...saveData.menuMeta.mapsProgress,
          [mapName]: {
            ...saveData.menuMeta.mapsProgress[mapName],
            tierHighscores: {
              ...saveData.menuMeta.mapsProgress[mapName].tierHighscores,
              [tier]: score,
            },
          },
        },
      },
    })
  }

  const updateMapTierFastestTime = (mapName: string, tier: string, time: number) => {
    if (!saveData || !saveData.menuMeta.mapsProgress[mapName]) return
    setSaveData({
      ...saveData,
      menuMeta: {
        ...saveData.menuMeta,
        mapsProgress: {
          ...saveData.menuMeta.mapsProgress,
          [mapName]: {
            ...saveData.menuMeta.mapsProgress[mapName],
            tierFastestTimes: {
              ...saveData.menuMeta.mapsProgress[mapName].tierFastestTimes,
              [tier]: time,
            },
          },
        },
      },
    })
  }

  const addTierToMap = (mapName: string, tier: string) => {
    if (!saveData || !saveData.menuMeta.mapsProgress[mapName]) return
    const mapProgress = saveData.menuMeta.mapsProgress[mapName]

    setSaveData({
      ...saveData,
      menuMeta: {
        ...saveData.menuMeta,
        mapsProgress: {
          ...saveData.menuMeta.mapsProgress,
          [mapName]: {
            ...mapProgress,
            tierCompletionsWithCharacters: {
              ...mapProgress.tierCompletionsWithCharacters,
              [tier]: [],
            },
            numRunsByTier: {
              ...mapProgress.numRunsByTier,
              [tier]: 0,
            },
            tierHighscores: {
              ...mapProgress.tierHighscores,
              [tier]: 0,
            },
            tierFastestTimes: {
              ...mapProgress.tierFastestTimes,
              [tier]: 0,
            },
          },
        },
      },
    })
  }

  const removeTierFromMap = (mapName: string, tier: string) => {
    if (!saveData || !saveData.menuMeta.mapsProgress[mapName]) return
    const mapProgress = saveData.menuMeta.mapsProgress[mapName]

    const newTierCompletions = { ...mapProgress.tierCompletionsWithCharacters }
    const newNumRuns = { ...mapProgress.numRunsByTier }
    const newHighscores = { ...mapProgress.tierHighscores }
    const newFastestTimes = { ...mapProgress.tierFastestTimes }

    delete newTierCompletions[tier]
    delete newNumRuns[tier]
    delete newHighscores[tier]
    delete newFastestTimes[tier]

    setSaveData({
      ...saveData,
      menuMeta: {
        ...saveData.menuMeta,
        mapsProgress: {
          ...saveData.menuMeta.mapsProgress,
          [mapName]: {
            ...mapProgress,
            tierCompletionsWithCharacters: newTierCompletions,
            numRunsByTier: newNumRuns,
            tierHighscores: newHighscores,
            tierFastestTimes: newFastestTimes,
          },
        },
      },
    })
  }

  const toggleCharacterInTier = (mapName: string, tier: string, character: string) => {
    if (!saveData || !saveData.menuMeta.mapsProgress[mapName]) return
    const currentCharacters = saveData.menuMeta.mapsProgress[mapName].tierCompletionsWithCharacters[tier] || []
    const newCharacters = currentCharacters.includes(character)
      ? currentCharacters.filter((c) => c !== character)
      : [...currentCharacters, character]

    updateMapTierCompletions(mapName, tier, newCharacters)
  }

  const unlockAllAchievements = () => {
    if (!saveData) return
    setSaveData({
      ...saveData,
      claimedAchievements: [...saveData.achievements],
    })
  }

  const maxAllShopItems = () => {
    if (!saveData) return
    const maxedShopItems: Record<string, number> = {}
    Object.keys(saveData.shopItems).forEach((item) => {
      maxedShopItems[item] = 999
    })
    setSaveData({
      ...saveData,
      shopItems: maxedShopItems,
    })
  }

  const maxAllCharacters = () => {
    if (!saveData) return
    const maxedCharacters: Record<string, { xp: number; numRuns: number }> = {}
    Object.keys(saveData.characterProgression).forEach((character) => {
      maxedCharacters[character] = { xp: 999999, numRuns: 100 }
    })
    setSaveData({
      ...saveData,
      characterProgression: maxedCharacters,
    })
  }

  const unlockAllCharacters = () => {
    if (!saveData) return
    const unlockedCharacters: Record<string, { xp: number; numRuns: number }> = {}
    Object.keys(saveData.characterProgression).forEach((character) => {
      unlockedCharacters[character] = { xp: 100, numRuns: 1 }
    })
    setSaveData({
      ...saveData,
      characterProgression: unlockedCharacters,
    })
  }

  // Updated Purchases tab with Add/Remove buttons
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
    setSaveData({
      ...saveData,
      purchases: [...availablePurchases],
    })
  }

  const gameData = gamesData.games.find((game) => game.id === "megabonk")

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-6xl space-y-6">
        <div className="flex justify-start">
          <Button asChild variant="ghost" size="sm">
            <Link href="/" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Games
            </Link>
          </Button>
        </div>

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold text-balance">Megabonk Save Editor</h1>
          </div>
          <p className="text-muted-foreground text-pretty">
            Edit currencies, characters, achievements, shop items, and purchases
          </p>
        </div>

        {!saveData ? (
          <>
            {gameData && <SaveLocationHelp platforms={gameData.platforms} gameName={gameData.name} />}

            <SaveFileUpload onFileSelect={processSaveFile} acceptedFileTypes=".txt" isProcessing={isProcessing} />
          </>
        ) : (
          <div className="space-y-4">
            <Tabs defaultValue="currencies" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="currencies">
                  <Coins className="w-4 h-4 mr-2" />
                  Currencies
                </TabsTrigger>
                <TabsTrigger value="shop">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Shop Items
                </TabsTrigger>
                <TabsTrigger value="characters">
                  <Users className="w-4 h-4 mr-2" />
                  Characters
                </TabsTrigger>
                <TabsTrigger value="achievements">
                  <Trophy className="w-4 h-4 mr-2" />
                  Achievements
                </TabsTrigger>
                <TabsTrigger value="purchases">
                  <Package className="w-4 h-4 mr-2" />
                  Purchases
                </TabsTrigger>
                <TabsTrigger value="maps">
                  <Map className="w-4 h-4 mr-2" />
                  Maps
                </TabsTrigger>
              </TabsList>

              <TabsContent value="currencies" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
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
                        className="font-mono text-lg"
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-gray-400" />
                        Silver
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Input
                        type="number"
                        value={saveData.silver}
                        onChange={(e) => updateCurrency("silver", e.target.value)}
                        min="0"
                        className="font-mono text-lg"
                      />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="shop" className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={maxAllShopItems} variant="outline" size="sm">
                    Max All Shop Items (999)
                  </Button>
                </div>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(saveData.shopItems).map(([item, quantity]) => (
                      <Card key={item}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">{item}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Input
                            type="number"
                            value={quantity}
                            onChange={(e) => updateShopItem(item, e.target.value)}
                            min="0"
                            className="font-mono"
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="characters" className="space-y-4">
                <div className="flex justify-end gap-2">
                  <Button onClick={unlockAllCharacters} variant="outline" size="sm">
                    Unlock All Characters
                  </Button>
                  <Button onClick={maxAllCharacters} variant="outline" size="sm">
                    Max All Characters
                  </Button>
                </div>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(saveData.characterProgression).map(([character, data]) => {
                      const isUnlocked = data.xp > 0 || data.numRuns > 0
                      return (
                        <Card key={character}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">{character}</CardTitle>
                              {isUnlocked ? (
                                <Badge variant="secondary" className="gap-1">
                                  <Unlock className="w-3 h-3" />
                                  Unlocked
                                </Badge>
                              ) : (
                                <Button
                                  onClick={() => toggleCharacterUnlock(character, true)}
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                >
                                  <Lock className="w-3 h-3" />
                                  Unlock
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="space-y-1.5">
                              <Label htmlFor={`${character}-xp`} className="text-sm">
                                XP
                              </Label>
                              <Input
                                id={`${character}-xp`}
                                type="number"
                                value={data.xp}
                                onChange={(e) => updateCharacterXP(character, e.target.value)}
                                min="0"
                                className="font-mono"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`${character}-runs`} className="text-sm">
                                Number of Runs
                              </Label>
                              <Input
                                id={`${character}-runs`}
                                type="number"
                                value={data.numRuns}
                                onChange={(e) => updateCharacterRuns(character, e.target.value)}
                                min="0"
                                className="font-mono"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="achievements" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Achievement Progress</CardTitle>
                      <Button onClick={unlockAllAchievements} variant="outline" size="sm">
                        Unlock All Achievements
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <p className="text-2xl font-bold">
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
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-sm">{achievement}</span>
                              </div>
                              <div className="flex gap-2">
                                {!isInSave ? (
                                  <Button onClick={() => addAchievement(achievement)} size="sm" variant="outline">
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add
                                  </Button>
                                ) : (
                                  <>
                                    {!isClaimed && (
                                      <Button onClick={() => claimAchievement(achievement)} size="sm" variant="default">
                                        <Trophy className="w-3 h-3 mr-1" />
                                        Claim
                                      </Button>
                                    )}
                                    {isClaimed && (
                                      <Badge variant="secondary" className="text-xs">
                                        Claimed
                                      </Badge>
                                    )}
                                    <Button onClick={() => removeAchievement(achievement)} size="sm" variant="ghost">
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
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Purchases</CardTitle>
                      <Button onClick={unlockAllPurchases} variant="outline" size="sm">
                        Unlock All Purchases
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <p className="text-2xl font-bold">
                          {saveData.purchases.length} / {availablePurchases.length}
                        </p>
                        <p className="text-sm text-muted-foreground">Items Purchased</p>
                      </div>
                    </div>

                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-2">
                        {availablePurchases.map((purchase) => {
                          const isPurchased = saveData.purchases.includes(purchase)
                          // Determine category based on prefix
                          let category = "Item"
                          if (purchase.startsWith("w_")) category = "Weapon"
                          else if (purchase.startsWith("c_")) category = "Character"
                          else if (purchase.startsWith("i_")) category = "Item"

                          return (
                            <div
                              key={purchase}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-sm">{purchase}</span>
                                <Badge variant="outline" className="text-xs">
                                  {category}
                                </Badge>
                              </div>
                              <div className="flex gap-2">
                                {isPurchased ? (
                                  <Button onClick={() => togglePurchase(purchase, false)} size="sm" variant="ghost">
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Remove
                                  </Button>
                                ) : (
                                  <Button onClick={() => togglePurchase(purchase, true)} size="sm" variant="outline">
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add
                                  </Button>
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

              <TabsContent value="maps" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Map Unlocks</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {availableMaps.map((map) => {
                        const isUnlocked = !!saveData.menuMeta.mapsProgress[map.name]
                        return (
                          <div
                            key={map.name}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Map className="w-5 h-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{map.name}</p>
                                <p className="text-xs text-muted-foreground">{isUnlocked ? "Unlocked" : "Locked"}</p>
                              </div>
                            </div>
                            {isUnlocked ? (
                              <Badge variant="secondary">Unlocked</Badge>
                            ) : (
                              <Button onClick={() => unlockMap(map.name)} size="sm" variant="outline">
                                Unlock
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Map Progression</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs
                      defaultValue={Object.keys(saveData.menuMeta.mapsProgress).filter((m) => m !== "None")[0]}
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-5">
                        {Object.keys(saveData.menuMeta.mapsProgress)
                          .filter((mapName) => mapName !== "None")
                          .map((mapName) => (
                            <TabsTrigger key={mapName} value={mapName}>
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
                                          <AccordionItem key={tier} value={tier}>
                                            <AccordionTrigger className="hover:no-underline">
                                              <div className="flex items-center justify-between w-full pr-4">
                                                <span className="font-semibold">Tier {displayTier}</span>
                                                <Button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    removeTierFromMap(mapName, tier)
                                                  }}
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-8 w-8 p-0"
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
                                                        className="cursor-pointer"
                                                        onClick={() => toggleCharacterInTier(mapName, tier, character)}
                                                      >
                                                        {character}
                                                      </Badge>
                                                    )
                                                  })}
                                                </div>
                                              </div>

                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div className="space-y-1.5">
                                                  <Label htmlFor={`${mapName}-${tier}-runs`} className="text-xs">
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
                                                    className="font-mono h-9"
                                                  />
                                                </div>
                                                <div className="space-y-1.5">
                                                  <Label htmlFor={`${mapName}-${tier}-highscore`} className="text-xs">
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
                                                    className="font-mono h-9"
                                                  />
                                                </div>
                                                <div className="space-y-1.5">
                                                  <Label htmlFor={`${mapName}-${tier}-time`} className="text-xs">
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
                                                    className="font-mono h-9"
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
                                className="w-full"
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
            </Tabs>

            <div className="flex gap-3">
              <Button onClick={handleDownload} disabled={isProcessing} className="flex-1" size="lg">
                <Download className="w-4 h-4 mr-2" />
                {isProcessing ? "Processing..." : "Download Edited Save"}
              </Button>
              <Button
                onClick={() => {
                  setSaveData(null)
                  setOriginalFile(null)
                }}
                variant="outline"
                size="lg"
              >
                Load New File
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              All processing happens locally in your browser. Your save file is never uploaded to any server.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
