"use client"

import type React from "react"
import { useState } from "react"
import { Sparkles, ArrowLeft, Coins, Save, Code, Layers, Unlock, Trophy, Target, Zap } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { decodeSaveFromFile, encodeSaveToBlob, type DecodedSave } from "@/lib/balatro/decoder"
import { downloadJSON } from "@/lib/download-json"
import Link from "next/link"
import { track } from "@vercel/analytics"
import { SaveFileUpload } from "@/components/save-file-upload"
import { SaveLocationHelp } from "@/components/save-location-help"
import { EditorSidebar } from "@/components/editor-sidebar"
import gamesData from "@/data/games.json"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JsonTreeEditor } from "@/components/json-tree-editor"
import {
  maxCurrency,
  unlockAll,
  unlockAllJokers,
  unlockAllCards,
  unlockAllDecks,
  unlockAllVouchers,
  completeAllChallenges,
} from "./save-mutations"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

function formatDate(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  return date.toLocaleDateString()
}

export default function BalatroSaveEditor() {
  const [saveData, setSaveData] = useState<DecodedSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const processSaveFile = async (file: File) => {
    setIsProcessing(true)
    try {
      const decoded = await decodeSaveFromFile(file)
      setSaveData(decoded)
      setOriginalFile(file)

      track("file_uploaded", {
        game: "Balatro",
        fileSize: file.size,
        fileName: file.name,
      })
    } catch (error) {
      console.error("Error processing save file:", error)
      alert("Failed to process save file. Please ensure it is a valid Balatro save file (.jkr)")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = async () => {
    if (!saveData || !originalFile) return

    setIsProcessing(true)
    try {
      const blob = await encodeSaveToBlob(saveData, originalFile.name)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = originalFile.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      track("file_downloaded", {
        game: "Balatro",
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

  const updateGameValue = (field: string, value: string | number) => {
    if (!saveData) return
    const numValue = typeof value === "string" ? Number.parseInt(value) || 0 : value
    setSaveData({
      ...saveData,
      GAME: {
        ...(saveData.GAME as Record<string, unknown>),
        [field]: numValue,
      },
    })
  }

  const gameData = gamesData.games.find((game) => game.id === "balatro")

  // Extract game stats
  const game = saveData?.GAME as Record<string, unknown> | undefined
  const discovered = saveData?.DISCOVERED as Record<string, unknown> | undefined

  // Count unlocks
  const jokersUnlocked = discovered
    ? Object.keys(discovered).filter((k) => k.startsWith("j_") && discovered[k] === true).length
    : 0
  const decksUnlocked = discovered
    ? Object.keys(discovered).filter((k) => k.startsWith("b_") && discovered[k] === true).length
    : 0
  const vouchersUnlocked = discovered
    ? Object.keys(discovered).filter((k) => k.startsWith("v_") && discovered[k] === true).length
    : 0

  const quickStats = saveData
    ? [
        {
          label: "Money",
          value: (game?.dollars as number) || 0,
          icon: <Coins className="w-4 h-4 text-yellow-500" />,
        },
        {
          label: "Jokers Unlocked",
          value: jokersUnlocked,
          icon: <Sparkles className="w-4 h-4 text-primary" />,
        },
        {
          label: "Decks Unlocked",
          value: decksUnlocked,
          icon: <Layers className="w-4 h-4 text-chart-2" />,
        },
      ]
    : []

  const quickActions = saveData
    ? [
        {
          label: "Max Money & Chips",
          onClick: () => {
            setSaveData(maxCurrency(saveData))
          },
          icon: <Coins className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Jokers",
          onClick: () => {
            setSaveData(unlockAllJokers(saveData))
          },
          icon: <Sparkles className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Decks",
          onClick: () => {
            setSaveData(unlockAllDecks(saveData))
          },
          icon: <Layers className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Cards",
          onClick: () => {
            setSaveData(unlockAllCards(saveData))
          },
          icon: <Unlock className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Vouchers",
          onClick: () => {
            setSaveData(unlockAllVouchers(saveData))
          },
          icon: <Trophy className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock Everything",
          onClick: () => {
            setSaveData(unlockAll(saveData))
          },
          icon: <Unlock className="w-4 h-4 mr-2" />,
        },
        {
          label: "Download JSON",
          onClick: () => {
            const filename = originalFile?.name.replace(/\.[^/.]+$/, "") || "balatro-save"
            downloadJSON(saveData, filename)
            track("json_downloaded", {
              game: "Balatro",
              fileName: originalFile?.name,
            })
          },
          icon: <Code className="w-4 h-4 mr-2" />,
        },
      ]
    : []

  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Balatro</h1>
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
              <h2 className="text-3xl font-bold text-foreground">Balatro Save Editor</h2>
              <p className="text-muted-foreground">Edit money, chips, unlocks, and more in your Balatro save files</p>
            </div>

            {gameData && <SaveLocationHelp platforms={gameData.platforms} gameName={gameData.name} />}

            <SaveFileUpload onFileSelect={processSaveFile} acceptedFileTypes=".jkr" isProcessing={isProcessing} />
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
              lastModified={originalFile ? new Date() : undefined}
              quickStats={quickStats}
              quickActions={quickActions}
            />

            <div className="flex-1 space-y-4">
              <Tabs defaultValue="gameplay" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-card border border-border">
                  <TabsTrigger value="gameplay" className="data-[state=active]:bg-muted">
                    <Target className="w-4 h-4 mr-2" />
                    Gameplay
                  </TabsTrigger>
                  <TabsTrigger value="currency" className="data-[state=active]:bg-muted">
                    <Coins className="w-4 h-4 mr-2" />
                    Currency
                  </TabsTrigger>
                  <TabsTrigger value="unlocks" className="data-[state=active]:bg-muted">
                    <Unlock className="w-4 h-4 mr-2" />
                    Unlocks
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="data-[state=active]:bg-muted">
                    <Code className="w-4 h-4 mr-2" />
                    Raw JSON
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="gameplay" className="space-y-4 mt-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <CardTitle className="text-foreground">Game Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="hand-size" className="text-sm font-medium text-card-foreground">
                            Hand Size
                          </Label>
                          <Input
                            id="hand-size"
                            type="number"
                            value={(game?.hand_size as number) || 8}
                            onChange={(e) => updateGameValue("hand_size", e.target.value)}
                            min="1"
                            max="20"
                            className="font-mono text-lg bg-muted border-border text-foreground"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="joker-slots" className="text-sm font-medium text-card-foreground">
                            Joker Slots
                          </Label>
                          <Input
                            id="joker-slots"
                            type="number"
                            value={(game?.joker_slots as number) || 5}
                            onChange={(e) => updateGameValue("joker_slots", e.target.value)}
                            min="1"
                            max="20"
                            className="font-mono text-lg bg-muted border-border text-foreground"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="hands" className="text-sm font-medium text-card-foreground">
                            Hands Remaining
                          </Label>
                          <Input
                            id="hands"
                            type="number"
                            value={(game?.hands as number) || 4}
                            onChange={(e) => updateGameValue("hands", e.target.value)}
                            min="0"
                            max="99"
                            className="font-mono text-lg bg-muted border-border text-foreground"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="discards" className="text-sm font-medium text-card-foreground">
                            Discards Remaining
                          </Label>
                          <Input
                            id="discards"
                            type="number"
                            value={(game?.discards as number) || 3}
                            onChange={(e) => updateGameValue("discards", e.target.value)}
                            min="0"
                            max="99"
                            className="font-mono text-lg bg-muted border-border text-foreground"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="currency" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3 border-b border-border">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <Coins className="w-5 h-5 text-yellow-500" />
                          Money
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <Input
                          type="number"
                          value={(game?.dollars as number) || 0}
                          onChange={(e) => updateGameValue("dollars", e.target.value)}
                          min="0"
                          className="font-mono text-2xl bg-muted border-border text-foreground"
                        />
                      </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3 border-b border-border">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <Zap className="w-5 h-5 text-chart-1" />
                          Chips
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <Input
                          type="number"
                          value={(game?.chips as number) || 0}
                          onChange={(e) => updateGameValue("chips", e.target.value)}
                          min="0"
                          className="font-mono text-2xl bg-muted border-border text-foreground"
                        />
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-foreground">Quick Actions</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <Button
                        onClick={() => {
                          setSaveData(maxCurrency(saveData))
                        }}
                        className="w-full bg-primary hover:bg-primary/90"
                      >
                        <Coins className="w-4 h-4 mr-2" />
                        Max Money & Chips (999,999,999)
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="unlocks" className="space-y-4 mt-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <CardTitle className="text-foreground">Unlock Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-muted rounded-lg border border-border space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-card-foreground">Jokers</span>
                            <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                              {jokersUnlocked} / {Object.keys(discovered || {}).filter((k) => k.startsWith("j_")).length}
                            </Badge>
                          </div>
                          <Button
                            onClick={() => setSaveData(unlockAllJokers(saveData))}
                            variant="outline"
                            size="sm"
                            className="w-full text-primary border-primary/30 hover:bg-primary/10"
                          >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Unlock All Jokers
                          </Button>
                        </div>

                        <div className="p-4 bg-muted rounded-lg border border-border space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-card-foreground">Decks</span>
                            <Badge variant="secondary" className="bg-chart-2/20 text-chart-2 border-chart-2/30">
                              {decksUnlocked} / {Object.keys(discovered || {}).filter((k) => k.startsWith("b_")).length}
                            </Badge>
                          </div>
                          <Button
                            onClick={() => setSaveData(unlockAllDecks(saveData))}
                            variant="outline"
                            size="sm"
                            className="w-full text-primary border-primary/30 hover:bg-primary/10"
                          >
                            <Layers className="w-4 h-4 mr-2" />
                            Unlock All Decks
                          </Button>
                        </div>

                        <div className="p-4 bg-muted rounded-lg border border-border space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-card-foreground">Vouchers</span>
                            <Badge variant="secondary" className="bg-chart-3/20 text-chart-3 border-chart-3/30">
                              {vouchersUnlocked} / {Object.keys(discovered || {}).filter((k) => k.startsWith("v_")).length}
                            </Badge>
                          </div>
                          <Button
                            onClick={() => setSaveData(unlockAllVouchers(saveData))}
                            variant="outline"
                            size="sm"
                            className="w-full text-primary border-primary/30 hover:bg-primary/10"
                          >
                            <Trophy className="w-4 h-4 mr-2" />
                            Unlock All Vouchers
                          </Button>
                        </div>

                        <div className="p-4 bg-muted rounded-lg border border-border space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-card-foreground">Card Types</span>
                            <Badge variant="secondary" className="bg-chart-4/20 text-chart-4 border-chart-4/30">
                              {
                                Object.keys(discovered || {}).filter(
                                  (k) => (k.startsWith("c_") || k.startsWith("e_") || k.startsWith("m_")) && discovered?.[k] === true,
                                ).length
                              }{" "}
                              /{" "}
                              {
                                Object.keys(discovered || {}).filter(
                                  (k) => k.startsWith("c_") || k.startsWith("e_") || k.startsWith("m_"),
                                ).length
                              }
                            </Badge>
                          </div>
                          <Button
                            onClick={() => setSaveData(unlockAllCards(saveData))}
                            variant="outline"
                            size="sm"
                            className="w-full text-primary border-primary/30 hover:bg-primary/10"
                          >
                            <Unlock className="w-4 h-4 mr-2" />
                            Unlock All Cards
                          </Button>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border">
                        <Button
                          onClick={() => setSaveData(unlockAll(saveData))}
                          className="w-full bg-primary hover:bg-primary/90"
                          size="lg"
                        >
                          <Unlock className="w-5 h-5 mr-2" />
                          Unlock Everything
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <CardTitle className="text-foreground">Discovered Items</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-2">
                          {discovered &&
                            Object.entries(discovered)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([key, value]) => (
                                <div
                                  key={key}
                                  className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors"
                                >
                                  <span className="font-mono text-sm text-card-foreground">{key}</span>
                                  <Badge
                                    variant={value ? "default" : "outline"}
                                    className={
                                      value
                                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                                        : "border-border text-muted-foreground"
                                    }
                                  >
                                    {value ? "Unlocked" : "Locked"}
                                  </Badge>
                                </div>
                              ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="raw" className="space-y-4 mt-4">
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
        <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50">
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
