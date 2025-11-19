"use client"

import type React from "react"
import { useState } from "react"
import { Sparkles, ArrowLeft, Code, Save } from 'lucide-react'
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split('.')
  let current: unknown = obj
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  
  return current
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.')
  const newObj = structuredClone(obj)
  let current: Record<string, unknown> = newObj
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }
  
  current[keys[keys.length - 1]] = value
  return newObj
}

export default function BalatroSaveEditor() {
  const [saveData, setSaveData] = useState<DecodedSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const processSaveFile = async (file: File) => {
    setIsProcessing(true)
    try {
      const decoded = await decodeSaveFromFile(file)
      console.log("[v0] Decoded save data:", decoded)
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

  const updateValue = (path: string, value: string | number) => {
    if (!saveData) return
    const numValue = typeof value === "string" ? Number.parseInt(value) || 0 : value
    setSaveData(setNestedValue(saveData as Record<string, unknown>, path, numValue) as DecodedSave)
  }

  const gameData = gamesData.games.find((game) => game.id === "balatro")

  const isProfileFile = originalFile?.name.toLowerCase().includes('profile') ?? false
  const isMetaFile = originalFile?.name.toLowerCase().includes('meta') ?? false

  const profileName = getNestedValue(saveData, 'name') as string | undefined
  const highScores = getNestedValue(saveData, 'high_scores') as Record<string, unknown> | undefined
  const careerStats = getNestedValue(saveData, 'career_stats') as Record<string, unknown> | undefined
  const progress = getNestedValue(saveData, 'progress') as Record<string, unknown> | undefined

  const discovered = getNestedValue(saveData, 'discovered') as Record<string, boolean> | undefined
  const unlocked = getNestedValue(saveData, 'unlocked') as Record<string, boolean> | undefined

  const quickStats = saveData
    ? isProfileFile
      ? [
          {
            label: "Profile Name",
            value: profileName || "Unknown",
            icon: <Sparkles className="w-4 h-4 text-primary" />,
          },
          {
            label: "Total Wins",
            value: (careerStats?.c_wins as number) || 0,
            icon: <Sparkles className="w-4 h-4 text-primary" />,
          },
        ]
      : isMetaFile
      ? [
          {
            label: "Discovered Items",
            value: discovered ? Object.values(discovered).filter(v => v === true).length : 0,
            icon: <Sparkles className="w-4 h-4 text-primary" />,
          },
        ]
      : []
    : []

  const quickActions = saveData
    ? [
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
        ...(isMetaFile
          ? [
              {
                label: "Unlock Everything",
                onClick: () => {
                  if (!discovered || !unlocked) return
                  const newData = structuredClone(saveData) as Record<string, unknown>
                  const newDiscovered = { ...discovered }
                  const newUnlocked = { ...unlocked }
                  
                  Object.keys(newDiscovered).forEach(key => {
                    newDiscovered[key] = true
                    newUnlocked[key] = true
                  })
                  
                  newData.discovered = newDiscovered
                  newData.unlocked = newUnlocked
                  setSaveData(newData as DecodedSave)
                },
                icon: <Sparkles className="w-4 h-4 mr-2" />,
              },
            ]
          : []),
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
              <p className="text-muted-foreground">Edit your Balatro profile and meta save files</p>
              <p className="text-sm text-muted-foreground">Supports both profile.jkr and meta.jkr files</p>
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
              <Tabs defaultValue={isProfileFile ? "profile" : isMetaFile ? "meta" : "raw"} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-card border border-border">
                  {isProfileFile && (
                    <TabsTrigger value="profile" className="data-[state=active]:bg-muted">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Profile
                    </TabsTrigger>
                  )}
                  {isMetaFile && (
                    <TabsTrigger value="meta" className="data-[state=active]:bg-muted">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Unlocks
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="raw" className="data-[state=active]:bg-muted">
                    <Code className="w-4 h-4 mr-2" />
                    Raw JSON
                  </TabsTrigger>
                </TabsList>

                {isProfileFile && (
                  <TabsContent value="profile" className="space-y-4 mt-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <CardTitle className="text-foreground">Profile Info</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="profile-name" className="text-sm font-medium text-card-foreground">
                            Profile Name
                          </Label>
                          <Input
                            id="profile-name"
                            type="text"
                            value={profileName || ''}
                            onChange={(e) => {
                              if (!saveData) return
                              const newData = structuredClone(saveData) as Record<string, unknown>
                              newData.name = e.target.value
                              setSaveData(newData as DecodedSave)
                            }}
                            className="font-mono bg-muted border-border text-foreground"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {highScores && (
                      <Card className="bg-card border-border">
                        <CardHeader className="border-b border-border">
                          <CardTitle className="text-foreground">High Scores</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <ScrollArea className="h-[300px] pr-4">
                            <div className="space-y-3">
                              {Object.entries(highScores)
                                .filter(([key]) => key !== 'collection' && key !== 'current_streak')
                                .map(([key, value]) => {
                                  const scoreData = value as Record<string, unknown>
                                  return (
                                    <div key={key} className="space-y-2">
                                      <Label className="text-sm font-medium text-card-foreground">
                                        {(scoreData.label as string) || key}
                                      </Label>
                                      <Input
                                        type="number"
                                        value={(scoreData.amt as number) || 0}
                                        onChange={(e) => updateValue(`high_scores.${key}.amt`, e.target.value)}
                                        className="font-mono bg-muted border-border text-foreground"
                                      />
                                    </div>
                                  )
                                })}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {careerStats && (
                      <Card className="bg-card border-border">
                        <CardHeader className="border-b border-border">
                          <CardTitle className="text-foreground">Career Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <ScrollArea className="h-[400px] pr-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Cards Discarded</Label>
                                <Input
                                  type="number"
                                  value={(careerStats.c_cards_discarded as number) || 0}
                                  onChange={(e) => updateValue('career_stats.c_cards_discarded', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Hands Played</Label>
                                <Input
                                  type="number"
                                  value={(careerStats.c_hands_played as number) || 0}
                                  onChange={(e) => updateValue('career_stats.c_hands_played', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Dollars Earned</Label>
                                <Input
                                  type="number"
                                  value={(careerStats.c_dollars_earned as number) || 0}
                                  onChange={(e) => updateValue('career_stats.c_dollars_earned', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Wins</Label>
                                <Input
                                  type="number"
                                  value={(careerStats.c_wins as number) || 0}
                                  onChange={(e) => updateValue('career_stats.c_wins', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Losses</Label>
                                <Input
                                  type="number"
                                  value={(careerStats.c_losses as number) || 0}
                                  onChange={(e) => updateValue('career_stats.c_losses', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Rounds</Label>
                                <Input
                                  type="number"
                                  value={(careerStats.c_rounds as number) || 0}
                                  onChange={(e) => updateValue('career_stats.c_rounds', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {progress && (
                      <Card className="bg-card border-border">
                        <CardHeader className="border-b border-border">
                          <CardTitle className="text-foreground">Progress</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-card-foreground">Overall Tally</Label>
                              <Input
                                type="number"
                                value={(progress.overall_tally as number) || 0}
                                onChange={(e) => updateValue('progress.overall_tally', e.target.value)}
                                className="font-mono bg-muted border-border text-foreground"
                              />
                            </div>
                            {progress.challenges && typeof progress.challenges === 'object' && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Challenges</Label>
                                <Input
                                  type="number"
                                  value={((progress.challenges as Record<string, unknown>).tally as number) || 0}
                                  onChange={(e) => updateValue('progress.challenges.tally', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                            )}
                            {progress.deck_stakes && typeof progress.deck_stakes === 'object' && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Deck Stakes</Label>
                                <Input
                                  type="number"
                                  value={((progress.deck_stakes as Record<string, unknown>).tally as number) || 0}
                                  onChange={(e) => updateValue('progress.deck_stakes.tally', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                            )}
                            {progress.discovered && typeof progress.discovered === 'object' && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Discovered</Label>
                                <Input
                                  type="number"
                                  value={((progress.discovered as Record<string, unknown>).tally as number) || 0}
                                  onChange={(e) => updateValue('progress.discovered.tally', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                            )}
                            {progress.joker_stickers && typeof progress.joker_stickers === 'object' && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Joker Stickers</Label>
                                <Input
                                  type="number"
                                  value={((progress.joker_stickers as Record<string, unknown>).tally as number) || 0}
                                  onChange={(e) => updateValue('progress.joker_stickers.tally', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                )}

                {isMetaFile && discovered && unlocked && (
                  <TabsContent value="meta" className="space-y-4 mt-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-foreground">Discovered/Unlocked Items</CardTitle>
                          <Button
                            onClick={() => {
                              const newData = structuredClone(saveData) as Record<string, unknown>
                              const newDiscovered = { ...discovered }
                              const newUnlocked = { ...unlocked }
                              
                              Object.keys(newDiscovered).forEach(key => {
                                newDiscovered[key] = true
                                newUnlocked[key] = true
                              })
                              
                              newData.discovered = newDiscovered
                              newData.unlocked = newUnlocked
                              setSaveData(newData as DecodedSave)
                            }}
                            size="sm"
                            className="bg-primary hover:bg-primary/90"
                          >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Unlock Everything
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h3 className="text-sm font-semibold mb-3 text-card-foreground">
                              Locked/Undiscovered ({Object.entries(discovered).filter(([_, v]) => !v).length})
                            </h3>
                            <ScrollArea className="h-[600px] pr-4">
                              <div className="space-y-2">
                                {Object.entries(discovered)
                                  .filter(([_, value]) => !value)
                                  .sort(([a], [b]) => a.localeCompare(b))
                                  .map(([key]) => (
                                    <button
                                      key={key}
                                      onClick={() => {
                                        const newData = structuredClone(saveData) as Record<string, unknown>
                                        const newDiscovered = { ...discovered, [key]: true }
                                        const newUnlocked = { ...unlocked, [key]: true }
                                        newData.discovered = newDiscovered
                                        newData.unlocked = newUnlocked
                                        setSaveData(newData as DecodedSave)
                                      }}
                                      className="w-full flex items-center justify-between p-3 bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors text-left"
                                    >
                                      <span className="font-mono text-sm text-card-foreground">{key}</span>
                                      <Badge variant="outline" className="border-border text-muted-foreground">
                                        Locked
                                      </Badge>
                                    </button>
                                  ))}
                              </div>
                            </ScrollArea>
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold mb-3 text-card-foreground">
                              Unlocked/Discovered ({Object.entries(discovered).filter(([_, v]) => v).length})
                            </h3>
                            <ScrollArea className="h-[600px] pr-4">
                              <div className="space-y-2">
                                {Object.entries(discovered)
                                  .filter(([_, value]) => value === true)
                                  .sort(([a], [b]) => a.localeCompare(b))
                                  .map(([key]) => (
                                    <button
                                      key={key}
                                      onClick={() => {
                                        const newData = structuredClone(saveData) as Record<string, unknown>
                                        const newDiscovered = { ...discovered, [key]: false }
                                        const newUnlocked = { ...unlocked, [key]: false }
                                        newData.discovered = newDiscovered
                                        newData.unlocked = newUnlocked
                                        setSaveData(newData as DecodedSave)
                                      }}
                                      className="w-full flex items-center justify-between p-3 bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors text-left"
                                    >
                                      <span className="font-mono text-sm text-card-foreground">{key}</span>
                                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                        Unlocked
                                      </Badge>
                                    </button>
                                  ))}
                              </div>
                            </ScrollArea>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                )}

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
