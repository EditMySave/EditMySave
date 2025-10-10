"use client"

import { useState } from "react"
import { Sparkles, ArrowLeft, Coins, Zap, Save, Code } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SaveFileUpload } from "@/components/save-file-upload"
import { SaveLocationHelp } from "@/components/save-location-help"
import { EditorSidebar } from "@/components/editor-sidebar"
import { JsonTreeEditor } from "@/components/json-tree-editor"
import { decryptSave, encryptSave, getByte, setByte, type CloverpitJsonSave } from "@/lib/cloverpit/decoder"
import {
  maxAllCurrencies,
  maxSpins,
  unlockAllPowerups,
  unlockAllDrawers,
  maxLuck,
  transformPhoneToHoly,
  clearEquippedPowerups,
  clearStorePowerups,
  clearDrawerPowerups,
  addAllRunModifiers,
} from "./save-mutations"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import Link from "next/link"
import { track } from "@vercel/analytics"
import gamesData from "@/data/games.json"

function formatDate(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  return date.toLocaleDateString()
}

export default function CloverpitEditor() {
  const [saveData, setSaveData] = useState<CloverpitJsonSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const decrypted = decryptSave(new Uint8Array(arrayBuffer))
      setSaveData(decrypted)
      setOriginalFile(file)

      track("file_uploaded", {
        game: "Cloverpit",
        fileSize: file.size,
        fileName: file.name,
      })
    } catch (error) {
      console.error("Failed to decrypt save:", error)
      alert("Failed to decrypt save file. Make sure this is a valid GameDataFull.json file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = async () => {
    if (!saveData || !originalFile) return

    setIsProcessing(true)
    try {
      const encrypted = encryptSave(saveData)
      const blob = new Blob([encrypted], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = originalFile.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      track("file_downloaded", {
        game: "Cloverpit",
        fileName: originalFile.name,
        editedFileName: originalFile.name,
      })
    } catch (error) {
      console.error("Failed to encrypt save:", error)
      alert("Failed to encrypt save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleLoadNew = () => {
    setSaveData(null)
    setOriginalFile(null)
  }

  const gameData = gamesData.games.find((game) => game.id === "cloverpit")

  const quickStats = saveData
    ? [
        {
          label: "Coins",
          value: getByte(saveData.gameplayData, "coins_ByteArray"),
          icon: <Coins className="w-4 h-4 text-yellow-500" />,
        },
        {
          label: "Spins Left",
          value: saveData.gameplayData.spinsLeft || 0,
          icon: <Zap className="w-4 h-4 text-blue-500" />,
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
          label: "Max Spins",
          onClick: () => setSaveData(maxSpins(saveData)),
          icon: <Zap className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Powerups",
          onClick: () => setSaveData(unlockAllPowerups(saveData)),
          icon: <Sparkles className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Drawers",
          onClick: () => setSaveData(unlockAllDrawers(saveData)),
          icon: <Sparkles className="w-4 h-4 mr-2" />,
        },
        {
          label: "Max Luck",
          onClick: () => setSaveData(maxLuck(saveData)),
          icon: <Sparkles className="w-4 h-4 mr-2" />,
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
              <h1 className="text-xl font-bold text-foreground">Cloverpit</h1>
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
              <h2 className="text-3xl font-bold text-foreground">Cloverpit Save Editor</h2>
              <p className="text-muted-foreground">Edit currencies, powerups, symbols, patterns, and more</p>
            </div>

            {gameData && <SaveLocationHelp platforms={gameData.platforms} gameName={gameData.name} />}

            <SaveFileUpload onFileSelect={handleFileUpload} acceptedFileTypes=".json" isProcessing={isProcessing} />
          </div>
        </div>
      </main>
    )
  }

  const gd = saveData.gameplayData

  // Get all powerup names for dropdowns
  const powerupNames =
    gd.powerupsData
      ?.map((p) => p.powerupIdentifierAsString)
      .filter((n) => n && n !== "undefined")
      .sort() || []
  const powerupOptions = ["none", "undefined", ...powerupNames]

  // Get all symbol names
  const symbols = ["lemon", "cherry", "clover", "bell", "diamond", "coins", "seven"]

  // Get all pattern names
  const patterns = [
    "jackpot",
    "horizontal2",
    "horizontal3",
    "horizontal4",
    "horizontal5",
    "vertical2",
    "vertical3",
    "diagonal2",
    "diagonal3",
    "pyramid",
    "pyramidInverted",
    "triangle",
    "triangleInverted",
    "snakeUpDown",
    "snakeDownUp",
    "eye",
  ]

  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Cloverpit</h1>
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
            <Tabs defaultValue="economy" className="w-full">
              <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10 bg-card border border-border">
                <TabsTrigger value="economy" className="data-[state=active]:bg-muted">
                  <Coins className="w-4 h-4 mr-2" />
                  Economy
                </TabsTrigger>
                <TabsTrigger value="spins" className="data-[state=active]:bg-muted">
                  <Zap className="w-4 h-4 mr-2" />
                  Spins
                </TabsTrigger>
                <TabsTrigger value="symbols" className="data-[state=active]:bg-muted">
                  Symbols
                </TabsTrigger>
                <TabsTrigger value="patterns" className="data-[state=active]:bg-muted">
                  Patterns
                </TabsTrigger>
                <TabsTrigger value="powerups" className="data-[state=active]:bg-muted">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Powerups
                </TabsTrigger>
                <TabsTrigger value="luck" className="data-[state=active]:bg-muted">
                  Luck
                </TabsTrigger>
                <TabsTrigger value="666" className="data-[state=active]:bg-muted">
                  666
                </TabsTrigger>
                <TabsTrigger value="phone" className="data-[state=active]:bg-muted">
                  Phone
                </TabsTrigger>
                <TabsTrigger value="modifiers" className="data-[state=active]:bg-muted">
                  Modifiers
                </TabsTrigger>
                <TabsTrigger value="advanced" className="data-[state=active]:bg-muted">
                  <Code className="w-4 h-4 mr-2" />
                  Raw JSON
                </TabsTrigger>
              </TabsList>

              {/* Economy Tab */}
              <TabsContent value="economy" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Currency & Money</CardTitle>
                    <CardDescription>Edit your coins, deposits, and interest rates</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="coins">Coins</Label>
                        <Input
                          id="coins"
                          type="number"
                          value={getByte(gd, "coins_ByteArray")}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            setByte(updated.gameplayData, "coins_ByteArray", Number.parseInt(e.target.value) || 0)
                            setSaveData(updated)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deposited">Deposited Coins</Label>
                        <Input
                          id="deposited"
                          type="number"
                          value={getByte(gd, "depositedCoins_ByteArray")}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            setByte(
                              updated.gameplayData,
                              "depositedCoins_ByteArray",
                              Number.parseInt(e.target.value) || 0,
                            )
                            setSaveData(updated)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tickets">Clover Tickets</Label>
                        <Input
                          id="tickets"
                          type="number"
                          value={gd.cloverTickets || 0}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            updated.gameplayData.cloverTickets = Number.parseInt(e.target.value) || 0
                            setSaveData(updated)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="interest">Interest Rate %</Label>
                        <Input
                          id="interest"
                          type="number"
                          step="0.01"
                          value={gd.interestRate || 0}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            updated.gameplayData.interestRate = Number.parseFloat(e.target.value) || 0
                            setSaveData(updated)
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Spins Tab */}
              <TabsContent value="spins" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Spins & Rounds</CardTitle>
                    <CardDescription>Manage your spins and round settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="spinsLeft">Spins Left</Label>
                        <Input
                          id="spinsLeft"
                          type="number"
                          value={gd.spinsLeft || 0}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            updated.gameplayData.spinsLeft = Number.parseInt(e.target.value) || 0
                            setSaveData(updated)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxSpins">Max Spins</Label>
                        <Input
                          id="maxSpins"
                          type="number"
                          value={gd.maxSpins || 0}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            updated.gameplayData.maxSpins = Number.parseInt(e.target.value) || 0
                            setSaveData(updated)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="extraSpins">Extra Spins</Label>
                        <Input
                          id="extraSpins"
                          type="number"
                          value={gd.extraSpins || 0}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            updated.gameplayData.extraSpins = Number.parseInt(e.target.value) || 0
                            setSaveData(updated)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="roundDeadline">Round Deadline</Label>
                        <Input
                          id="roundDeadline"
                          type="number"
                          value={gd.roundOfDeadline || 0}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            updated.gameplayData.roundOfDeadline = Number.parseInt(e.target.value) || 0
                            setSaveData(updated)
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Symbols Tab */}
              <TabsContent value="symbols" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Symbols</CardTitle>
                    <CardDescription>Edit symbol values and spawn chances</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="allSymbolsMult">All Symbols Multiplier</Label>
                      <Input
                        id="allSymbolsMult"
                        type="number"
                        value={getByte(gd, "allSymbolsMultiplier_ByteArray")}
                        onChange={(e) => {
                          const updated = { ...saveData }
                          setByte(
                            updated.gameplayData,
                            "allSymbolsMultiplier_ByteArray",
                            Number.parseInt(e.target.value) || 1,
                          )
                          setSaveData(updated)
                        }}
                      />
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold">Individual Symbols</h3>
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-4 pr-4">
                          {symbols.map((symbol) => {
                            const symbolData = gd.symbolsData?.find((s) => s.symbolKindAsString === symbol)
                            if (!symbolData) return null

                            return (
                              <Card key={symbol}>
                                <CardHeader>
                                  <CardTitle className="text-lg capitalize">{symbol}</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Extra Value</Label>
                                    <Input
                                      type="number"
                                      value={getByte(symbolData, "extraValue_ByteArray")}
                                      onChange={(e) => {
                                        const updated = { ...saveData }
                                        const sd = updated.gameplayData.symbolsData?.find(
                                          (s) => s.symbolKindAsString === symbol,
                                        )
                                        if (sd) {
                                          setByte(sd, "extraValue_ByteArray", Number.parseInt(e.target.value) || 0)
                                          setSaveData(updated)
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Spawn Chance</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={symbolData.spawnChance || 0}
                                      onChange={(e) => {
                                        const updated = { ...saveData }
                                        const sd = updated.gameplayData.symbolsData?.find(
                                          (s) => s.symbolKindAsString === symbol,
                                        )
                                        if (sd) {
                                          sd.spawnChance = Number.parseFloat(e.target.value) || 0
                                          setSaveData(updated)
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Golden %</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={symbolData.modifierChance01_Golden || 0}
                                      onChange={(e) => {
                                        const updated = { ...saveData }
                                        const sd = updated.gameplayData.symbolsData?.find(
                                          (s) => s.symbolKindAsString === symbol,
                                        )
                                        if (sd) {
                                          sd.modifierChance01_Golden = Number.parseFloat(e.target.value) || 0
                                          setSaveData(updated)
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Instant Reward %</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={symbolData.modifierChance01_InstantReward || 0}
                                      onChange={(e) => {
                                        const updated = { ...saveData }
                                        const sd = updated.gameplayData.symbolsData?.find(
                                          (s) => s.symbolKindAsString === symbol,
                                        )
                                        if (sd) {
                                          sd.modifierChance01_InstantReward = Number.parseFloat(e.target.value) || 0
                                          setSaveData(updated)
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Clover Ticket %</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={symbolData.modifierChance01_CloverTicket || 0}
                                      onChange={(e) => {
                                        const updated = { ...saveData }
                                        const sd = updated.gameplayData.symbolsData?.find(
                                          (s) => s.symbolKindAsString === symbol,
                                        )
                                        if (sd) {
                                          sd.modifierChance01_CloverTicket = Number.parseFloat(e.target.value) || 0
                                          setSaveData(updated)
                                        }
                                      }}
                                    />
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Patterns Tab */}
              <TabsContent value="patterns" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Patterns</CardTitle>
                    <CardDescription>Enable/disable patterns and edit their values</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="allPatternsMult">All Patterns Multiplier</Label>
                      <Input
                        id="allPatternsMult"
                        type="number"
                        value={getByte(gd, "allPatternsMultiplier_ByteArray")}
                        onChange={(e) => {
                          const updated = { ...saveData }
                          setByte(
                            updated.gameplayData,
                            "allPatternsMultiplier_ByteArray",
                            Number.parseInt(e.target.value) || 1,
                          )
                          setSaveData(updated)
                        }}
                      />
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold">Pattern Availability</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {patterns.map((pattern) => {
                          const isAvailable = gd.patternsAvailable_AsString?.includes(pattern) || false
                          return (
                            <div key={pattern} className="flex items-center space-x-2">
                              <Checkbox
                                id={`pattern-${pattern}`}
                                checked={isAvailable}
                                onCheckedChange={(checked) => {
                                  const updated = { ...saveData }
                                  const available = updated.gameplayData.patternsAvailable_AsString || []
                                  if (checked) {
                                    if (!available.includes(pattern)) {
                                      updated.gameplayData.patternsAvailable_AsString = [...available, pattern]
                                    }
                                  } else {
                                    updated.gameplayData.patternsAvailable_AsString = available.filter(
                                      (p) => p !== pattern,
                                    )
                                  }
                                  setSaveData(updated)
                                }}
                              />
                              <Label htmlFor={`pattern-${pattern}`} className="text-sm cursor-pointer">
                                {pattern}
                              </Label>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold">Pattern Values</h3>
                      <ScrollArea className="h-[300px]">
                        <div className="grid grid-cols-2 gap-4 pr-4">
                          {patterns.map((pattern) => {
                            const patternData = gd.patternsData?.find((p) => p.patternKindAsString === pattern)
                            if (!patternData) return null

                            return (
                              <div key={pattern} className="space-y-2">
                                <Label className="capitalize">{pattern}</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={patternData.extraValue || 0}
                                  onChange={(e) => {
                                    const updated = { ...saveData }
                                    const pd = updated.gameplayData.patternsData?.find(
                                      (p) => p.patternKindAsString === pattern,
                                    )
                                    if (pd) {
                                      pd.extraValue = Number.parseFloat(e.target.value) || 0
                                      setSaveData(updated)
                                    }
                                  }}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Powerups Tab */}
              <TabsContent value="powerups" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Powerups & Equipment</CardTitle>
                    <CardDescription>Manage equipped powerups, store, drawers, and skeleton</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Equipment Settings */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="maxEquippable">Max Equippable Powerups</Label>
                        <Select
                          value={String(gd.maxEquippablePowerups || 8)}
                          onValueChange={(value) => {
                            const updated = { ...saveData }
                            updated.gameplayData.maxEquippablePowerups = Number.parseInt(value)
                            setSaveData(updated)
                          }}
                        >
                          <SelectTrigger id="maxEquippable">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => (
                              <SelectItem key={num} value={String(num)}>
                                {num}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="redButtonMult">Red Button Multiplier</Label>
                        <Input
                          id="redButtonMult"
                          type="number"
                          value={gd._redButtonActivationsMultiplier || 1}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            updated.gameplayData._redButtonActivationsMultiplier = Number.parseInt(e.target.value) || 1
                            setSaveData(updated)
                          }}
                        />
                      </div>
                    </div>

                    {/* Equipped Powerups */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Equipped Powerups (30 slots)</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSaveData(clearEquippedPowerups(saveData))}
                        >
                          Clear All
                        </Button>
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pr-4">
                          {Array.from({ length: 30 }, (_, i) => {
                            const equipped = gd.equippedPowerups || []
                            const currentValue = equipped[i] || "none"
                            return (
                              <Select
                                key={i}
                                value={currentValue === "" ? "none" : currentValue}
                                onValueChange={(value) => {
                                  const updated = { ...saveData }
                                  const newEquipped = [
                                    ...(updated.gameplayData.equippedPowerups || Array(30).fill("undefined")),
                                  ]
                                  newEquipped[i] = value === "none" ? "" : value
                                  updated.gameplayData.equippedPowerups = newEquipped
                                  setSaveData(updated)
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={`Slot ${i + 1}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {powerupOptions.map((name) => (
                                    <SelectItem key={name} value={name}>
                                      {name === "none" ? "(empty)" : name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )
                          })}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Store Powerups */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Store Powerups (4 slots)</Label>
                        <Button size="sm" variant="outline" onClick={() => setSaveData(clearStorePowerups(saveData))}>
                          Clear
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Array.from({ length: 4 }, (_, i) => {
                          const store = gd.storePowerups || []
                          const currentValue = store[i] || "none"
                          return (
                            <Select
                              key={i}
                              value={currentValue === "" ? "none" : currentValue}
                              onValueChange={(value) => {
                                const updated = { ...saveData }
                                const newStore = [...(updated.gameplayData.storePowerups || Array(4).fill("undefined"))]
                                newStore[i] = value === "none" ? "" : value
                                updated.gameplayData.storePowerups = newStore
                                setSaveData(updated)
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={`Store ${i + 1}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {powerupOptions.map((name) => (
                                  <SelectItem key={name} value={name}>
                                    {name === "none" ? "(empty)" : name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )
                        })}
                      </div>
                    </div>

                    {/* Drawer Powerups */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Drawer Powerups (4 slots)</Label>
                        <Button size="sm" variant="outline" onClick={() => setSaveData(clearDrawerPowerups(saveData))}>
                          Clear
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Array.from({ length: 4 }, (_, i) => {
                          const drawer = gd.drawerPowerups || []
                          const currentValue = drawer[i] || "none"
                          return (
                            <Select
                              key={i}
                              value={currentValue === "" ? "none" : currentValue}
                              onValueChange={(value) => {
                                const updated = { ...saveData }
                                const newDrawer = [
                                  ...(updated.gameplayData.drawerPowerups || Array(4).fill("undefined")),
                                ]
                                newDrawer[i] = value === "none" ? "" : value
                                updated.gameplayData.drawerPowerups = newDrawer
                                setSaveData(updated)
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={`Drawer ${i + 1}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {powerupOptions.map((name) => (
                                  <SelectItem key={name} value={name}>
                                    {name === "none" ? "(empty)" : name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )
                        })}
                      </div>
                    </div>

                    {/* Skeleton Powerups */}
                    <div className="space-y-2">
                      <Label>Skeleton Powerups (5 slots)</Label>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {Array.from({ length: 5 }, (_, i) => {
                          const skeleton = gd.equippedPowerups_Skeleton || []
                          const currentValue = skeleton[i] || "none"
                          return (
                            <Select
                              key={i}
                              value={currentValue === "" ? "none" : currentValue}
                              onValueChange={(value) => {
                                const updated = { ...saveData }
                                const newSkeleton = [
                                  ...(updated.gameplayData.equippedPowerups_Skeleton || Array(5).fill("undefined")),
                                ]
                                newSkeleton[i] = value === "none" ? "" : value
                                updated.gameplayData.equippedPowerups_Skeleton = newSkeleton
                                setSaveData(updated)
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={`Skeleton ${i + 1}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {powerupOptions.map((name) => (
                                  <SelectItem key={name} value={name}>
                                    {name === "none" ? "(empty)" : name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Luck Tab */}
              <TabsContent value="luck" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Luck Modifiers</CardTitle>
                    <CardDescription>Adjust luck values for powerups, activations, and store</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="powerupLuck">Powerup Luck</Label>
                        <Input
                          id="powerupLuck"
                          type="number"
                          step="0.1"
                          value={gd.powerupLuck || 1}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            updated.gameplayData.powerupLuck = Number.parseFloat(e.target.value) || 1
                            setSaveData(updated)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="activationLuck">Activation Luck</Label>
                        <Input
                          id="activationLuck"
                          type="number"
                          step="0.1"
                          value={gd.activationLuck || 1}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            updated.gameplayData.activationLuck = Number.parseFloat(e.target.value) || 1
                            setSaveData(updated)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="storeLuck">Store Luck</Label>
                        <Input
                          id="storeLuck"
                          type="number"
                          step="0.1"
                          value={gd.storeLuck || 1}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            updated.gameplayData.storeLuck = Number.parseFloat(e.target.value) || 1
                            setSaveData(updated)
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 666 Events Tab */}
              <TabsContent value="666" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>666 Events</CardTitle>
                    <CardDescription>Control the evil 666 event system</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="evilChance">666 Chance</Label>
                        <Input
                          id="evilChance"
                          type="number"
                          step="0.01"
                          value={gd._666Chance || 0}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            updated.gameplayData._666Chance = Number.parseFloat(e.target.value) || 0
                            setSaveData(updated)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="evilMaxChance">666 Max Chance</Label>
                        <Input
                          id="evilMaxChance"
                          type="number"
                          step="0.01"
                          value={gd._666ChanceMaxAbsolute || 0}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            updated.gameplayData._666ChanceMaxAbsolute = Number.parseFloat(e.target.value) || 0
                            setSaveData(updated)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="evilSuppressed">Suppressed Spins</Label>
                        <Input
                          id="evilSuppressed"
                          type="number"
                          value={gd._666SuppressedSpinsLeft || 0}
                          onChange={(e) => {
                            const updated = { ...saveData }
                            updated.gameplayData._666SuppressedSpinsLeft = Number.parseInt(e.target.value) || 0
                            setSaveData(updated)
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Phone Tab */}
              <TabsContent value="phone" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Phone Settings</CardTitle>
                    <CardDescription>Manage phone transformation and abilities</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Phone Status</Label>
                      <div className="text-sm text-muted-foreground">
                        {gd._phoneAlreadyTransformed
                          ? "Phone has been transformed to Holy (999)"
                          : "Phone is in normal state"}
                      </div>
                    </div>
                    <Button onClick={() => setSaveData(transformPhoneToHoly(saveData))}>
                      Transform Phone to Holy (999)
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      This will transform the phone from possessed (666) to holy (999) mode, replacing evil abilities
                      with holy ones.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Run Modifiers Tab */}
              <TabsContent value="modifiers" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Run Modifiers</CardTitle>
                    <CardDescription>Manage run modifier statistics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button onClick={() => setSaveData(addAllRunModifiers(saveData))}>Add All Run Modifiers</Button>
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-4 pr-4">
                        {(saveData._runModSavingList || []).map((modifier, idx) => (
                          <Card key={idx}>
                            <CardHeader>
                              <CardTitle className="text-sm">{modifier.runModifierIdentifierAsString}</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-5 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Owned</Label>
                                <Input
                                  type="number"
                                  value={modifier.ownedCount || 0}
                                  onChange={(e) => {
                                    const updated = { ...saveData }
                                    if (updated._runModSavingList) {
                                      updated._runModSavingList[idx].ownedCount = Number.parseInt(e.target.value) || 0
                                      setSaveData(updated)
                                    }
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Unlocked</Label>
                                <Input
                                  type="number"
                                  value={modifier.unlockedTimes || 0}
                                  onChange={(e) => {
                                    const updated = { ...saveData }
                                    if (updated._runModSavingList) {
                                      updated._runModSavingList[idx].unlockedTimes =
                                        Number.parseInt(e.target.value) || 0
                                      setSaveData(updated)
                                    }
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Played</Label>
                                <Input
                                  type="number"
                                  value={modifier.playedTimes || 0}
                                  onChange={(e) => {
                                    const updated = { ...saveData }
                                    if (updated._runModSavingList) {
                                      updated._runModSavingList[idx].playedTimes = Number.parseInt(e.target.value) || 0
                                      setSaveData(updated)
                                    }
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Won</Label>
                                <Input
                                  type="number"
                                  value={modifier.wonTimes || 0}
                                  onChange={(e) => {
                                    const updated = { ...saveData }
                                    if (updated._runModSavingList) {
                                      updated._runModSavingList[idx].wonTimes = Number.parseInt(e.target.value) || 0
                                      setSaveData(updated)
                                    }
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Foil Level</Label>
                                <Input
                                  type="number"
                                  value={modifier.foilLevel || 0}
                                  onChange={(e) => {
                                    const updated = { ...saveData }
                                    if (updated._runModSavingList) {
                                      updated._runModSavingList[idx].foilLevel = Number.parseInt(e.target.value) || 0
                                      setSaveData(updated)
                                    }
                                  }}
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

              {/* Advanced Tab */}
              <TabsContent value="advanced" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Raw JSON Editor</CardTitle>
                    <CardDescription>Advanced editing of the save file structure</CardDescription>
                  </CardHeader>
                  <CardContent>
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
