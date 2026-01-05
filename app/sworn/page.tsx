"use client"

import { useState } from "react"
import { Sparkles, ArrowLeft, Coins, Code, Gem, Droplet, Wand2, Zap } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SaveFileUpload } from "@/components/save-file-upload"
import { SaveLocationHelp } from "@/components/save-location-help"
import { EditorSidebar } from "@/components/editor-sidebar"
import { JsonTreeEditor } from "@/components/json-tree-editor"
import { decodeSaveFromFile, encodeSaveToBlob, type SwornSave } from "@/lib/sworn/decoder"
import { downloadJSON } from "@/lib/download-json"
import { maxAllCurrencies, updateCurrencies } from "./save-mutations"
import Link from "next/link"
import { track } from "@vercel/analytics"
import gamesData from "@/data/games.json"
import Image from "next/image"

interface CurrencyValues {
  fairyEmbers: number
  silk: number
  moonstone: number
  grailWater: number
  crystalShards: number
}

const CURRENCY_IDENTIFIERS = {
  crystalShards: "medaocebbencincbicdalchabd",
  fairyEmbers: "medaocebbencinfaibiembeb",
  grailWater: "medaocebbencincingbailgadeb",
  moonstone: "medaocebbencinmooncdone",
  silk: "medaocebbencincilk",
}

function getCurrencyValues(saveData: SwornSave): CurrencyValues {
  const currencies: CurrencyValues = {
    fairyEmbers: 0,
    silk: 0,
    moonstone: 0,
    grailWater: 0,
    crystalShards: 0,
  }

  for (const segment of saveData.segments) {
    if (segment.category === "medal" && segment.value !== null) {
      if (segment.text === CURRENCY_IDENTIFIERS.crystalShards) {
        currencies.crystalShards = segment.value
      } else if (segment.text === CURRENCY_IDENTIFIERS.fairyEmbers) {
        currencies.fairyEmbers = segment.value
      } else if (segment.text === CURRENCY_IDENTIFIERS.grailWater) {
        currencies.grailWater = segment.value
      } else if (segment.text === CURRENCY_IDENTIFIERS.moonstone) {
        currencies.moonstone = segment.value
      } else if (segment.text === CURRENCY_IDENTIFIERS.silk) {
        currencies.silk = segment.value
      }
    }
  }

  return currencies
}

export default function SwornSaveEditor() {
  const [saveData, setSaveData] = useState<SwornSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true)
    try {
      const decoded = await decodeSaveFromFile(file)
      setSaveData(decoded)
      setOriginalFile(file)

      track("file_uploaded", {
        game: "Sworn",
        fileSize: file.size,
        fileName: file.name,
      })
    } catch (error) {
      console.error("Failed to decode save file:", error)
      alert("Failed to decode save file. Please ensure it is a valid Sworn save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = async () => {
    if (!saveData || !originalFile) return

    setIsProcessing(true)
    try {
      const blob = await encodeSaveToBlob(saveData, originalFile)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = originalFile.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      track("file_downloaded", {
        game: "Sworn",
        fileName: originalFile.name,
      })
    } catch (error) {
      console.error("Failed to encode save file:", error)
      alert("Failed to create edited save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleLoadNew = () => {
    setSaveData(null)
    setOriginalFile(null)
  }

  const gameData = gamesData.games.find((game) => game.id === "sworn")

  const currencyValues = saveData ? getCurrencyValues(saveData) : null

  const quickStats = saveData
    ? [
        {
          label: "Fairy Embers",
          value: currencyValues?.fairyEmbers || 0,
          icon: <Zap className="w-4 h-4 text-orange-500" />,
        },
        {
          label: "Silk",
          value: currencyValues?.silk || 0,
          icon: <Wand2 className="w-4 h-4 text-purple-500" />,
        },
        {
          label: "Moonstone",
          value: currencyValues?.moonstone || 0,
          icon: <Gem className="w-4 h-4 text-blue-500" />,
        },
        {
          label: "Grail Water",
          value: currencyValues?.grailWater || 0,
          icon: <Droplet className="w-4 h-4 text-cyan-500" />,
        },
      ]
    : []

  const quickActions = saveData
    ? [
        {
          label: "Max All Currencies",
          onClick: () => setSaveData(maxAllCurrencies(saveData)),
          icon: <Sparkles className="w-4 h-4 mr-2" />,
        },
        {
          label: "Download JSON",
          onClick: () => {
            const filename = originalFile?.name.replace(/\.[^/.]+$/, "") || "sworn-save"
            downloadJSON(saveData, filename)
            track("json_downloaded", {
              game: "Sworn",
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
          <div className="space-y-6">
            <div className="text-center space-y-2 py-8">
              <h2 className="text-3xl font-bold text-foreground">Sworn Save Editor</h2>
              <p className="text-muted-foreground">Edit currencies, achievements, and more in your Sworn save file</p>
            </div>

            {gameData && <SaveLocationHelp platforms={gameData.platforms} gameName={gameData.name} />}

            <SaveFileUpload onFileSelect={handleFileUpload} acceptedFileTypes=".dat" isProcessing={isProcessing} />
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
              <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 h-auto bg-card border border-border p-2">
                <TabsTrigger value="currencies" className="w-full data-[state=active]:bg-muted">
                  <Coins className="w-4 h-4 mr-2" />
                  Currencies
                </TabsTrigger>
                <TabsTrigger value="achievements" className="w-full data-[state=active]:bg-muted">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Achievements
                </TabsTrigger>
                <TabsTrigger value="segments" className="w-full data-[state=active]:bg-muted">
                  <Code className="w-4 h-4 mr-2" />
                  All Data
                </TabsTrigger>
                <TabsTrigger value="advanced" className="w-full data-[state=active]:bg-muted">
                  <Code className="w-4 h-4 mr-2" />
                  Raw JSON
                </TabsTrigger>
              </TabsList>

              {/* Currencies Tab */}
              <TabsContent value="currencies" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Currencies</CardTitle>
                    <CardDescription>Edit your in-game currencies</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Fairy Embers */}
                      <div className="space-y-2">
                        <Label htmlFor="fairyEmbers" className="flex items-center gap-2">
                          <div className="relative w-5 h-5">
                            <Image
                              src="/images/sworn/fairyembers.png"
                              alt="Fairy Embers"
                              fill
                              className="object-contain"
                            />
                          </div>
                          Fairy Embers
                        </Label>
                        <Input
                          id="fairyEmbers"
                          type="number"
                          value={currencyValues?.fairyEmbers || 0}
                          onChange={(e) => {
                            const newValues = { ...currencyValues! }
                            newValues.fairyEmbers = Number.parseInt(e.target.value) || 0
                            setSaveData(updateCurrencies(saveData, newValues))
                          }}
                          className="font-mono bg-muted border-border text-foreground"
                        />
                      </div>

                      {/* Silk */}
                      <div className="space-y-2">
                        <Label htmlFor="silk" className="flex items-center gap-2">
                          <div className="relative w-5 h-5">
                            <Image src="/images/sworn/silk.png" alt="Silk" fill className="object-contain" />
                          </div>
                          Silk
                        </Label>
                        <Input
                          id="silk"
                          type="number"
                          value={currencyValues?.silk || 0}
                          onChange={(e) => {
                            const newValues = { ...currencyValues! }
                            newValues.silk = Number.parseInt(e.target.value) || 0
                            setSaveData(updateCurrencies(saveData, newValues))
                          }}
                          className="font-mono bg-muted border-border text-foreground"
                        />
                      </div>

                      {/* Moonstone */}
                      <div className="space-y-2">
                        <Label htmlFor="moonstone" className="flex items-center gap-2">
                          <div className="relative w-5 h-5">
                            <Image src="/images/sworn/moonstone.png" alt="Moonstone" fill className="object-contain" />
                          </div>
                          Moonstone
                        </Label>
                        <Input
                          id="moonstone"
                          type="number"
                          value={currencyValues?.moonstone || 0}
                          onChange={(e) => {
                            const newValues = { ...currencyValues! }
                            newValues.moonstone = Number.parseInt(e.target.value) || 0
                            setSaveData(updateCurrencies(saveData, newValues))
                          }}
                          className="font-mono bg-muted border-border text-foreground"
                        />
                      </div>

                      {/* Grail Water */}
                      <div className="space-y-2">
                        <Label htmlFor="grailWater" className="flex items-center gap-2">
                          <div className="relative w-5 h-5">
                            <Image
                              src="/images/sworn/grailwater.png"
                              alt="Grail Water"
                              fill
                              className="object-contain"
                            />
                          </div>
                          Grail Water
                        </Label>
                        <Input
                          id="grailWater"
                          type="number"
                          value={currencyValues?.grailWater || 0}
                          onChange={(e) => {
                            const newValues = { ...currencyValues! }
                            newValues.grailWater = Number.parseInt(e.target.value) || 0
                            setSaveData(updateCurrencies(saveData, newValues))
                          }}
                          className="font-mono bg-muted border-border text-foreground"
                        />
                      </div>

                      {/* Crystal Shards */}
                      <div className="space-y-2">
                        <Label htmlFor="crystalShards" className="flex items-center gap-2">
                          <div className="relative w-5 h-5">
                            <Image
                              src="/images/sworn/crystalshards.png"
                              alt="Crystal Shards"
                              fill
                              className="object-contain"
                            />
                          </div>
                          Crystal Shards
                        </Label>
                        <Input
                          id="crystalShards"
                          type="number"
                          value={currencyValues?.crystalShards || 0}
                          onChange={(e) => {
                            const newValues = { ...currencyValues! }
                            newValues.crystalShards = Number.parseInt(e.target.value) || 0
                            setSaveData(updateCurrencies(saveData, newValues))
                          }}
                          className="font-mono bg-muted border-border text-foreground"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Achievements Tab */}
              <TabsContent value="achievements" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Achievements</CardTitle>
                    <CardDescription>View unlocked achievements and accolades</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {saveData.segments
                        .filter((seg) => seg.category === "achievement")
                        .map((seg) => (
                          <div key={seg.index} className="flex items-center justify-between p-3 bg-muted rounded">
                            <span className="font-mono text-sm">{seg.text || `Achievement #${seg.index}`}</span>
                            <Sparkles className="w-4 h-4 text-yellow-500" />
                          </div>
                        ))}
                      {saveData.segments.filter((seg) => seg.category === "achievement").length === 0 && (
                        <p className="text-muted-foreground text-center py-8">No achievements unlocked</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Segments Tab */}
              <TabsContent value="segments" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>All Data Segments</CardTitle>
                    <CardDescription>View all decoded save file segments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {saveData.segments.map((seg) => (
                        <div key={seg.index} className="grid grid-cols-4 gap-2 p-2 bg-muted rounded text-sm font-mono">
                          <div>#{seg.index}</div>
                          <div className="text-purple-500">{seg.category}</div>
                          <div className="text-blue-500 col-span-2 truncate">{seg.text}</div>
                          {seg.value !== null && <div className="text-green-500">{seg.value}</div>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Raw JSON Tab */}
              <TabsContent value="advanced" className="space-y-4">
                <JsonTreeEditor data={saveData} onChange={setSaveData} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </main>
  )
}
