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
            setSaveData({ ...saveData, gold: 999999, silver: 999999 })
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
    <main className="min-h-screen bg-slate-950 pb-20">
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl font-bold text-slate-100">Megabonk</h1>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-slate-100">
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
              <h2 className="text-3xl font-bold text-slate-100">Megabonk Save Editor</h2>
              <p className="text-slate-400">Edit currencies, characters, achievements, shop items, and purchases</p>
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
                <TabsList className="grid w-full grid-cols-7 bg-slate-900/50 border border-slate-800">
                  <TabsTrigger value="currencies" className="data-[state=active]:bg-slate-800">
                    <Coins className="w-4 h-4 mr-2" />
                    Currencies
                  </TabsTrigger>
                  <TabsTrigger value="shop" className="data-[state=active]:bg-slate-800">
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Shop Items
                  </TabsTrigger>
                  <TabsTrigger value="characters" className="data-[state=active]:bg-slate-800">
                    <Users className="w-4 h-4 mr-2" />
                    Characters
                  </TabsTrigger>
                  <TabsTrigger value="achievements" className="data-[state=active]:bg-slate-800">
                    <Trophy className="w-4 h-4 mr-2" />
                    Achievements
                  </TabsTrigger>
                  <TabsTrigger value="purchases" className="data-[state=active]:bg-slate-800">
                    <Package className="w-4 h-4 mr-2" />
                    Purchases
                  </TabsTrigger>
                  <TabsTrigger value="maps" className="data-[state=active]:bg-slate-800">
                    <Map className="w-4 h-4 mr-2" />
                    Maps
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="data-[state=active]:bg-slate-800">
                    <Code className="w-4 h-4 mr-2" />
                    Raw JSON
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="currencies" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-slate-900/50 border-slate-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-slate-100">
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
                          className="font-mono text-lg bg-slate-900/50 border-slate-700 text-slate-100"
                        />
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-900/50 border-slate-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-slate-100">
                          <Coins className="w-5 h-5 text-slate-400" />
                          Silver
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Input
                          type="number"
                          value={saveData.silver}
                          onChange={(e) => updateCurrency("silver", e.target.value)}
                          min="0"
                          className="font-mono text-lg bg-slate-900/50 border-slate-700 text-slate-100"
                        />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="shop" className="space-y-4">
                  <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="border-b border-slate-800">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-slate-100">Shop Items</CardTitle>
                        <Button
                          onClick={maxAllShopItems}
                          variant="outline"
                          size="sm"
                          className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10 bg-transparent"
                        >
                          Max All (999)
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ScrollArea className="h-[500px] pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {Object.entries(saveData.shopItems).map(([item, quantity]) => (
                            <div
                              key={item}
                              className="space-y-2 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50"
                            >
                              <Label className="text-sm font-medium text-slate-300">{item}</Label>
                              <Input
                                type="number"
                                value={quantity}
                                onChange={(e) => updateShopItem(item, e.target.value)}
                                min="0"
                                className="font-mono bg-slate-900/50 border-slate-700 text-slate-100"
                              />
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="characters" className="space-y-4">
                  <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="border-b border-slate-800">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-slate-100">Characters</CardTitle>
                        <div className="flex gap-2">
                          <Button
                            onClick={unlockAllCharacters}
                            variant="outline"
                            size="sm"
                            className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10 bg-transparent"
                          >
                            Unlock All
                          </Button>
                          <Button
                            onClick={maxAllCharacters}
                            variant="outline"
                            size="sm"
                            className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10 bg-transparent"
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
                              <div
                                key={character}
                                className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-slate-100">{character}</span>
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
                                      className="gap-1 text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
                                    >
                                      <Lock className="w-3 h-3" />
                                      Unlock
                                    </Button>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <div className="space-y-1.5">
                                    <Label htmlFor={`${character}-xp`} className="text-xs text-slate-400">
                                      XP
                                    </Label>
                                    <Input
                                      id={`${character}-xp`}
                                      type="number"
                                      value={data.xp}
                                      onChange={(e) => updateCharacterXP(character, e.target.value)}
                                      min="0"
                                      className="font-mono bg-slate-900/50 border-slate-700 text-slate-100"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label htmlFor={`${character}-runs`} className="text-xs text-slate-400">
                                      Number of Runs
                                    </Label>
                                    <Input
                                      id={`${character}-runs`}
                                      type="number"
                                      value={data.numRuns}
                                      onChange={(e) => updateCharacterRuns(character, e.target.value)}
                                      min="0"
                                      className="font-mono bg-slate-900/50 border-slate-700 text-slate-100"
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
                  <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="border-b border-slate-800">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-slate-100">Achievement Progress</CardTitle>
                        <Button
                          onClick={unlockAllAchievements}
                          variant="outline"
                          size="sm"
                          className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10 bg-transparent"
                        >
                          Unlock All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                        <div>
                          <p className="text-2xl font-bold text-slate-100">
                            {saveData.claimedAchievements.length} / {availableAchievements.length}
                          </p>
                          <p className="text-sm text-slate-400">Achievements Unlocked</p>
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
                                className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:bg-slate-800/50 transition-colors"
                              >
                                <span className="font-mono text-sm text-slate-300">{achievement}</span>
                                <div className="flex gap-2">
                                  {!isInSave ? (
                                    <Button
                                      onClick={() => addAchievement(achievement)}
                                      size="sm"
                                      variant="outline"
                                      className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
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
                                          className="bg-blue-600 hover:bg-blue-700"
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
                                        className="text-slate-400 hover:text-slate-100"
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
                  <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="border-b border-slate-800">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-slate-100">Purchases</CardTitle>
                        <Button
                          onClick={unlockAllPurchases}
                          variant="outline"
                          size="sm"
                          className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10 bg-transparent"
                        >
                          Unlock All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                        <div>
                          <p className="text-2xl font-bold text-slate-100">
                            {saveData.purchases.length} / {availablePurchases.length}
                          </p>
                          <p className="text-sm text-slate-400">Items Purchased</p>
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
                                className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:bg-slate-800/50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-sm text-slate-300">{purchase}</span>
                                  <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                                    {category}
                                  </Badge>
                                </div>
                                {isPurchased ? (
                                  <Button
                                    onClick={() => togglePurchase(purchase, false)}
                                    size="sm"
                                    variant="ghost"
                                    className="text-slate-400 hover:text-slate-100"
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Remove
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() => togglePurchase(purchase, true)}
                                    size="sm"
                                    variant="outline"
                                    className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
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
                  <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="border-b border-slate-800">
                      <CardTitle className="text-slate-100">Map Unlocks</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {availableMaps.map((map) => {
                          const isUnlocked = !!saveData.menuMeta.mapsProgress[map.name]
                          return (
                            <div
                              key={map.name}
                              className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:bg-slate-800/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Map className="w-5 h-5 text-slate-400" />
                                <div>
                                  <p className="font-medium text-slate-100">{map.name}</p>
                                  <p className="text-xs text-slate-500">{isUnlocked ? "Unlocked" : "Locked"}</p>
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
                                  className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
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

                  <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="border-b border-slate-800">
                      <CardTitle className="text-slate-100">Map Progression</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <Tabs
                        defaultValue={Object.keys(saveData.menuMeta.mapsProgress).filter((m) => m !== "None")[0]}
                        className="w-full"
                      >
                        <TabsList className="grid w-full grid-cols-5 bg-slate-800/50 border border-slate-700">
                          {Object.keys(saveData.menuMeta.mapsProgress)
                            .filter((mapName) => mapName !== "None")
                            .map((mapName) => (
                              <TabsTrigger key={mapName} value={mapName} className="data-[state=active]:bg-slate-700">
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
                                              className="border-slate-700 bg-slate-800/30 rounded-lg mb-2 px-4"
                                            >
                                              <AccordionTrigger className="hover:no-underline text-slate-100">
                                                <div className="flex items-center justify-between w-full pr-4">
                                                  <span className="font-semibold">Tier {displayTier}</span>
                                                  <Button
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      removeTierFromMap(mapName, tier)
                                                    }}
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100"
                                                  >
                                                    <Trash2 className="w-4 h-4" />
                                                  </Button>
                                                </div>
                                              </AccordionTrigger>
                                              <AccordionContent className="space-y-3 pt-3">
                                                <div className="space-y-2">
                                                  <Label className="text-xs text-slate-400">
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
                                                              ? "bg-blue-600 hover:bg-blue-700"
                                                              : "border-slate-600 text-slate-400 hover:bg-slate-800"
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
                                                      className="text-xs text-slate-400"
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
                                                      className="font-mono h-9 bg-slate-900/50 border-slate-700 text-slate-100"
                                                    />
                                                  </div>
                                                  <div className="space-y-1.5">
                                                    <Label
                                                      htmlFor={`${mapName}-${tier}-highscore`}
                                                      className="text-xs text-slate-400"
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
                                                      className="font-mono h-9 bg-slate-900/50 border-slate-700 text-slate-100"
                                                    />
                                                  </div>
                                                  <div className="space-y-1.5">
                                                    <Label
                                                      htmlFor={`${mapName}-${tier}-time`}
                                                      className="text-xs text-slate-400"
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
                                                      className="font-mono h-9 bg-slate-900/50 border-slate-700 text-slate-100"
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
                                  className="w-full text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
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
                  <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="border-b border-slate-800">
                      <CardTitle className="text-slate-100 flex items-center gap-2">
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

              <div className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-800 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span>{originalFile?.name} loaded</span>
                </div>
                <span className="text-slate-500">Last modified: {originalFile && formatDate(new Date())}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {saveData && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 z-50">
          <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-end">
            <Button
              onClick={handleDownload}
              disabled={isProcessing}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
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
