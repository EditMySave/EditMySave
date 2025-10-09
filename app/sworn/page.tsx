"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Sparkles, ArrowLeft, Coins, Save, Code } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { decodeSaveFromFile, encodeSaveToBlob, type DecodedSave } from "@/lib/sworn/decoder"
import Link from "next/link"
import { track } from "@vercel/analytics"
import { SaveFileUpload } from "@/components/save-file-upload"
import { SaveLocationHelp } from "@/components/save-location-help"
import { EditorSidebar } from "@/components/editor-sidebar"
import gamesData from "@/data/games.json"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JsonTreeEditor } from "@/components/json-tree-editor"

interface CurrencyValues {
  fairyEmbers: number
  silk: number
  moonstone: number
  grailWater: number
  crystalShards: number
}

const CURRENCY_IDENTIFIERS = {
  crystalShards: "medaocebbencincbicdalchabd", // index 231
  fairyEmbers: "medaocebbencinfaibiembeb", // index 234
  grailWater: "medaocebbencincingbailgadeb", // index 236
  moonstone: "medaocebbencinmooncdone", // index 238
  silk: "medaocebbencincilk", // index 240
}

export default function SwornSaveEditor() {
  const [isDragging, setIsDragging] = useState(false)
  const [saveData, setSaveData] = useState<DecodedSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [currencies, setCurrencies] = useState<CurrencyValues>({
    fairyEmbers: 0,
    silk: 0,
    moonstone: 0,
    grailWater: 0,
    crystalShards: 0,
  })
  const [isProcessing, setIsProcessing] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const processSaveFile = async (file: File) => {
    setIsProcessing(true)
    try {
      const decoded = await decodeSaveFromFile(file)
      setSaveData(decoded)
      setOriginalFile(file)

      const newCurrencies = { ...currencies }

      decoded.segments.forEach((segment, index) => {
        if (segment.category === "medal" && segment.value !== null) {
          // Match by segment identifier
          if (segment.text === CURRENCY_IDENTIFIERS.crystalShards) {
            newCurrencies.crystalShards = segment.value
          } else if (segment.text === CURRENCY_IDENTIFIERS.fairyEmbers) {
            newCurrencies.fairyEmbers = segment.value
          } else if (segment.text === CURRENCY_IDENTIFIERS.grailWater) {
            newCurrencies.grailWater = segment.value
          } else if (segment.text === CURRENCY_IDENTIFIERS.moonstone) {
            newCurrencies.moonstone = segment.value
          } else if (segment.text === CURRENCY_IDENTIFIERS.silk) {
            newCurrencies.silk = segment.value
          }
        }
      })

      setCurrencies(newCurrencies)
      track("file_uploaded", {
        game: "Sworn",
        fileSize: file.size,
        fileName: file.name,
      })
    } catch (error) {
      console.error("Error processing save file:", error)
      alert("Failed to process save file. Please ensure it is a valid Sworn save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      await processSaveFile(files[0])
    }
  }, [])

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await processSaveFile(files[0])
    }
  }

  const handleCurrencyChange = (key: keyof CurrencyValues, value: string) => {
    const numValue = Number.parseInt(value) || 0
    setCurrencies((prev) => ({ ...prev, [key]: numValue }))
  }

  const handleDownload = async () => {
    if (!saveData || !originalFile) return

    setIsProcessing(true)
    try {
      const updatedSave = { ...saveData }
      updatedSave.segments = updatedSave.segments.map((segment, index) => {
        if (segment.category === "medal") {
          if (segment.text === CURRENCY_IDENTIFIERS.crystalShards) {
            return { ...segment, value: currencies.crystalShards }
          } else if (segment.text === CURRENCY_IDENTIFIERS.fairyEmbers) {
            return { ...segment, value: currencies.fairyEmbers }
          } else if (segment.text === CURRENCY_IDENTIFIERS.grailWater) {
            return { ...segment, value: currencies.grailWater }
          } else if (segment.text === CURRENCY_IDENTIFIERS.moonstone) {
            return { ...segment, value: currencies.moonstone }
          } else if (segment.text === CURRENCY_IDENTIFIERS.silk) {
            return { ...segment, value: currencies.silk }
          }
        }
        return segment
      })

      const blob = await encodeSaveToBlob(updatedSave, originalFile)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${originalFile.name.replace(/\.[^/.]+$/, "")}.dat`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      track("file_downloaded", {
        game: "Sworn",
        fileName: originalFile.name,
        editedFileName: `${originalFile.name.replace(/\.[^/.]+$/, "")}.dat`,
      })
    } catch (error) {
      console.error("Error encoding save file:", error)
      alert("Failed to create edited save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const gameData = gamesData.games.find((game) => game.id === "sworn")

  const quickStats = []

  const quickActions = saveData
    ? [
        {
          label: "Max All Currencies",
          onClick: () => {
            setCurrencies({
              fairyEmbers: 999999,
              silk: 999999,
              moonstone: 999999,
              grailWater: 999999,
              crystalShards: 999999,
            })
          },
          icon: <Sparkles className="w-4 h-4 mr-2" />,
        },
      ]
    : []

  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Sworn</h1>
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
              <h2 className="text-3xl font-bold text-foreground">Sworn Save Editor</h2>
              <p className="text-muted-foreground">Edit your game currencies safely and easily</p>
            </div>

            {gameData && <SaveLocationHelp platforms={gameData.platforms} gameName={gameData.name} />}

            <SaveFileUpload onFileSelect={processSaveFile} acceptedFileTypes=".dat" isProcessing={isProcessing} />
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
              <Tabs defaultValue="currencies" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-card border border-border">
                  <TabsTrigger value="currencies" className="data-[state=active]:bg-muted">
                    <Coins className="w-4 h-4 mr-2" />
                    Currencies
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="data-[state=active]:bg-muted">
                    <Code className="w-4 h-4 mr-2" />
                    Raw JSON
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="currencies" className="space-y-4 mt-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-foreground">Currencies</CardTitle>
                        <Button
                          onClick={() => {
                            setCurrencies({
                              fairyEmbers: 999999,
                              silk: 999999,
                              moonstone: 999999,
                              grailWater: 999999,
                              crystalShards: 999999,
                            })
                          }}
                          variant="outline"
                          size="sm"
                          className="text-primary border-primary/30 hover:bg-primary/10"
                        >
                          Max All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-3 p-4 bg-muted rounded-lg border border-border">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 flex items-center justify-center">
                              <img
                                src="/images/fairyembers.png"
                                alt="Fairy Embers"
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="text-center">
                              <Label htmlFor="fairy-embers" className="text-sm font-medium text-card-foreground">
                                Fairy Embers
                              </Label>
                              <p className="text-xs text-muted-foreground">Max: 999,999</p>
                            </div>
                          </div>
                          <Input
                            id="fairy-embers"
                            type="number"
                            value={currencies.fairyEmbers}
                            onChange={(e) => handleCurrencyChange("fairyEmbers", e.target.value)}
                            min="0"
                            className="font-mono text-lg bg-input border-border text-foreground"
                          />
                        </div>

                        <div className="space-y-3 p-4 bg-muted rounded-lg border border-border">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 flex items-center justify-center">
                              <img src="/images/silk.png" alt="Silk" className="w-full h-full object-contain" />
                            </div>
                            <div className="text-center">
                              <Label htmlFor="silk" className="text-sm font-medium text-card-foreground">
                                Silk
                              </Label>
                              <p className="text-xs text-muted-foreground">Max: 999,999</p>
                            </div>
                          </div>
                          <Input
                            id="silk"
                            type="number"
                            value={currencies.silk}
                            onChange={(e) => handleCurrencyChange("silk", e.target.value)}
                            min="0"
                            className="font-mono text-lg bg-input border-border text-foreground"
                          />
                        </div>

                        <div className="space-y-3 p-4 bg-muted rounded-lg border border-border">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 flex items-center justify-center">
                              <img
                                src="/images/moonstone.png"
                                alt="Moonstone"
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="text-center">
                              <Label htmlFor="moonstone" className="text-sm font-medium text-card-foreground">
                                Moonstone
                              </Label>
                              <p className="text-xs text-muted-foreground">Max: 999,999</p>
                            </div>
                          </div>
                          <Input
                            id="moonstone"
                            type="number"
                            value={currencies.moonstone}
                            onChange={(e) => handleCurrencyChange("moonstone", e.target.value)}
                            min="0"
                            className="font-mono text-lg bg-input border-border text-foreground"
                          />
                        </div>

                        <div className="space-y-3 p-4 bg-muted rounded-lg border border-border">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 flex items-center justify-center">
                              <img
                                src="/images/grailwater.png"
                                alt="Grail Water"
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="text-center">
                              <Label htmlFor="grail-water" className="text-sm font-medium text-card-foreground">
                                Grail Water
                              </Label>
                              <p className="text-xs text-muted-foreground">Max: 999,999</p>
                            </div>
                          </div>
                          <Input
                            id="grail-water"
                            type="number"
                            value={currencies.grailWater}
                            onChange={(e) => handleCurrencyChange("grailWater", e.target.value)}
                            min="0"
                            className="font-mono text-lg bg-input border-border text-foreground"
                          />
                        </div>

                        <div className="space-y-3 p-4 bg-muted rounded-lg border border-border">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 flex items-center justify-center">
                              <img
                                src="/images/crystalshards.png"
                                alt="Crystal Shards"
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="text-center">
                              <Label htmlFor="crystal-shards" className="text-sm font-medium text-card-foreground">
                                Crystal Shards
                              </Label>
                              <p className="text-xs text-muted-foreground">Max: 999,999</p>
                            </div>
                          </div>
                          <Input
                            id="crystal-shards"
                            type="number"
                            value={currencies.crystalShards}
                            onChange={(e) => handleCurrencyChange("crystalShards", e.target.value)}
                            min="0"
                            className="font-mono text-lg bg-input border-border text-foreground"
                          />
                        </div>
                      </div>
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

function formatDate(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  return date.toLocaleDateString()
}
