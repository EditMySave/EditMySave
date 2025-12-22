"use client"

import { useState } from "react"
import { Pickaxe, ArrowLeft, Coins, Save, Code, TrendingUp, Users, Zap, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { downloadJSON } from "@/lib/download-json"
import Link from "next/link"
import { track } from "@vercel/analytics"
import { SaveFileUpload } from "@/components/save-file-upload"
import { SaveLocationHelp } from "@/components/save-location-help"
import { EditorSidebar } from "@/components/editor-sidebar"
import gamesData from "@/data/games.json"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JsonTreeEditor } from "@/components/json-tree-editor"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import {
  type DRGSurvivorSave,
  META_STAT_UPGRADES,
  CLASS_TYPES,
  CLASS_IDS,
  updateResource,
  maxAllResources,
  updateMetaStatLevel,
  maxAllMetaStats,
  updateClassRank,
  maxAllClassRanks,
  unlockAllClasses,
  updatePlayerRank,
  updateMaxHazIndex,
  updateNumDives,
} from "./save-mutations"
import Head from "next/head"

// Resource definitions with icons and colors
const RESOURCES = [
  { key: "Credits" as const, name: "Credits", color: "text-yellow-500", max: 9999999 },
  { key: "Bismor" as const, name: "Bismor", color: "text-cyan-400", max: 999999 },
  { key: "Croppa" as const, name: "Croppa", color: "text-green-400", max: 999999 },
  { key: "EnorPearl" as const, name: "Enor Pearl", color: "text-pink-400", max: 999999 },
  { key: "Jadiz" as const, name: "Jadiz", color: "text-emerald-400", max: 999999 },
  { key: "Magnite" as const, name: "Magnite", color: "text-red-400", max: 999999 },
  { key: "Umanite" as const, name: "Umanite", color: "text-purple-400", max: 999999 },
  { key: "PowerCore" as const, name: "Power Core", color: "text-orange-400", max: 999999 },
]

function formatDate(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  return date.toLocaleDateString()
}

export default function DRGSurvivorSaveEditor() {
  const [saveData, setSaveData] = useState<DRGSurvivorSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const processSaveFile = async (file: File) => {
    setIsProcessing(true)
    try {
      const text = await file.text()
      const decoded = JSON.parse(text) as DRGSurvivorSave
      setSaveData(decoded)
      setOriginalFile(file)

      track("file_uploaded", {
        game: "DRG-Survivor",
        fileSize: file.size,
        fileName: file.name,
      })
    } catch (error) {
      console.error("Error processing save file:", error)
      alert(
        "Failed to process save file. Please ensure it is a valid Deep Rock Galactic: Survivor save file (.dat with JSON format).",
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = async () => {
    if (!saveData || !originalFile) return

    setIsProcessing(true)
    try {
      const jsonString = JSON.stringify(saveData, null, 4)
      const blob = new Blob([jsonString], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = originalFile.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      track("file_downloaded", {
        game: "DRG-Survivor",
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

  const handleResourceChange = (
    resource: keyof Pick<
      DRGSurvivorSave,
      "Credits" | "Bismor" | "Croppa" | "EnorPearl" | "Jadiz" | "Magnite" | "Umanite" | "PowerCore"
    >,
    value: string,
  ) => {
    if (!saveData) return
    const numValue = Number.parseInt(value) || 0
    setSaveData(updateResource(saveData, resource, numValue))
  }

  const handleMetaStatChange = (upgradeId: string, level: number) => {
    if (!saveData) return
    setSaveData(updateMetaStatLevel(saveData, upgradeId, level))
  }

  const handleClassRankChange = (classType: number, rank: number, xp: number) => {
    if (!saveData) return
    setSaveData(updateClassRank(saveData, classType, rank, xp))
  }

  const gameData = gamesData.games.find((game) => game.id === "drg-survivor")

  const getMetaStatLevel = (upgradeId: string): number => {
    if (!saveData) return 0
    const upgrade = saveData.MetaStatUpgrades.find((u) => u.Id === upgradeId)
    return upgrade?.Level ?? 0
  }

  const getClassRank = (classType: number) => {
    if (!saveData) return { Rank: 1, Xp: 0 }
    const classRank = saveData.ClassRanks.find((cr) => cr.ClassType === classType)
    return classRank ?? { Rank: 1, Xp: 0 }
  }

  const isClassUnlocked = (classId: string) => {
    if (!saveData) return false
    return saveData.UnlockedClassIds.includes(classId)
  }

  const quickStats = saveData
    ? [
        { label: "Credits", value: saveData.Credits, icon: <Coins className="w-4 h-4 text-yellow-500" /> },
        { label: "Player Rank", value: saveData.PlayerRank, icon: <TrendingUp className="w-4 h-4 text-primary" /> },
        { label: "Total Dives", value: saveData.NumDivesTotal, icon: <Target className="w-4 h-4 text-blue-400" /> },
      ]
    : []

  const quickActions = saveData
    ? [
        {
          label: "Max All Resources",
          onClick: () => setSaveData(maxAllResources(saveData)),
          icon: <Coins className="w-4 h-4 mr-2" />,
        },
        {
          label: "Max All Meta Stats",
          onClick: () => setSaveData(maxAllMetaStats(saveData)),
          icon: <TrendingUp className="w-4 h-4 mr-2" />,
        },
        {
          label: "Max All Class Ranks",
          onClick: () => setSaveData(maxAllClassRanks(saveData)),
          icon: <Users className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Classes",
          onClick: () => setSaveData(unlockAllClasses(saveData)),
          icon: <Zap className="w-4 h-4 mr-2" />,
        },
        {
          label: "Download JSON",
          onClick: () => {
            const filename = originalFile?.name.replace(/\.[^/.]+$/, "") || "drg-survivor-save"
            downloadJSON(saveData, filename)
            track("json_downloaded", {
              game: "DRG-Survivor",
              fileName: originalFile?.name,
            })
          },
          icon: <Code className="w-4 h-4 mr-2" />,
        },
      ]
    : []

  return (
    <>
      <Head>
        <title>Deep Rock Galactic: Survivor Save Editor | EditMySave</title>
        <meta
          name="description"
          content="Free online Deep Rock Galactic: Survivor save editor. Edit resources, meta upgrades, class progression, and unlocks. Works entirely in your browser with no downloads required."
        />
      </Head>
      <main className="min-h-screen bg-background pb-20">
        <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
          <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Pickaxe className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Deep Rock Galactic: Survivor</h1>
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
                <h2 className="text-3xl font-bold text-foreground">Deep Rock Galactic: Survivor Save Editor</h2>
                <p className="text-muted-foreground">Edit resources, meta upgrades, class progression, and more</p>
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
                <Tabs defaultValue="resources" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 bg-card border border-border">
                    <TabsTrigger value="resources" className="data-[state=active]:bg-muted">
                      <Coins className="w-4 h-4 mr-2" />
                      Resources
                    </TabsTrigger>
                    <TabsTrigger value="meta" className="data-[state=active]:bg-muted">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Meta Upgrades
                    </TabsTrigger>
                    <TabsTrigger value="classes" className="data-[state=active]:bg-muted">
                      <Users className="w-4 h-4 mr-2" />
                      Classes
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="data-[state=active]:bg-muted">
                      <Code className="w-4 h-4 mr-2" />
                      Raw JSON
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="resources" className="space-y-4 mt-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-foreground">Resources</CardTitle>
                          <Button
                            onClick={() => setSaveData(maxAllResources(saveData))}
                            variant="outline"
                            size="sm"
                            className="text-primary border-primary/30 hover:bg-primary/10"
                          >
                            Max All
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {RESOURCES.map((resource) => (
                            <div key={resource.key} className="space-y-2 p-4 bg-muted rounded-lg border border-border">
                              <Label htmlFor={resource.key} className={`text-sm font-medium ${resource.color}`}>
                                {resource.name}
                              </Label>
                              <Input
                                id={resource.key}
                                type="number"
                                value={saveData[resource.key]}
                                onChange={(e) => handleResourceChange(resource.key, e.target.value)}
                                min="0"
                                max={resource.max}
                                className="font-mono bg-input border-border text-foreground"
                              />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <CardTitle className="text-foreground">Progression Stats</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2 p-4 bg-muted rounded-lg border border-border">
                            <Label htmlFor="playerRank" className="text-sm font-medium text-foreground">
                              Player Rank
                            </Label>
                            <Input
                              id="playerRank"
                              type="number"
                              value={saveData.PlayerRank}
                              onChange={(e) =>
                                setSaveData(updatePlayerRank(saveData, Number.parseInt(e.target.value) || 1))
                              }
                              min="1"
                              className="font-mono bg-input border-border text-foreground"
                            />
                          </div>
                          <div className="space-y-2 p-4 bg-muted rounded-lg border border-border">
                            <Label htmlFor="maxHazIndex" className="text-sm font-medium text-foreground">
                              Max Hazard Index
                            </Label>
                            <Input
                              id="maxHazIndex"
                              type="number"
                              value={saveData.MaxHazIndex}
                              onChange={(e) =>
                                setSaveData(updateMaxHazIndex(saveData, Number.parseInt(e.target.value) || 0))
                              }
                              min="0"
                              className="font-mono bg-input border-border text-foreground"
                            />
                          </div>
                          <div className="space-y-2 p-4 bg-muted rounded-lg border border-border">
                            <Label htmlFor="numDives" className="text-sm font-medium text-foreground">
                              Total Dives
                            </Label>
                            <Input
                              id="numDives"
                              type="number"
                              value={saveData.NumDivesTotal}
                              onChange={(e) =>
                                setSaveData(updateNumDives(saveData, Number.parseInt(e.target.value) || 0))
                              }
                              min="0"
                              className="font-mono bg-input border-border text-foreground"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="meta" className="space-y-4 mt-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-foreground">Meta Stat Upgrades</CardTitle>
                          <Button
                            onClick={() => setSaveData(maxAllMetaStats(saveData))}
                            variant="outline"
                            size="sm"
                            className="text-primary border-primary/30 hover:bg-primary/10"
                          >
                            Max All
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries(META_STAT_UPGRADES).map(([id, info]) => {
                            const currentLevel = getMetaStatLevel(id)
                            return (
                              <div key={id} className="p-4 bg-muted rounded-lg border border-border space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-medium text-foreground">{info.name}</Label>
                                  <Badge variant="secondary" className="font-mono">
                                    {currentLevel} / {info.maxLevel}
                                  </Badge>
                                </div>
                                <Slider
                                  value={[currentLevel]}
                                  onValueChange={(value) => handleMetaStatChange(id, value[0])}
                                  max={info.maxLevel}
                                  min={0}
                                  step={1}
                                  className="w-full"
                                />
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="classes" className="space-y-4 mt-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-foreground">Class Progression</CardTitle>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setSaveData(unlockAllClasses(saveData))}
                              variant="outline"
                              size="sm"
                              className="text-primary border-primary/30 hover:bg-primary/10"
                            >
                              Unlock All
                            </Button>
                            <Button
                              onClick={() => setSaveData(maxAllClassRanks(saveData))}
                              variant="outline"
                              size="sm"
                              className="text-primary border-primary/30 hover:bg-primary/10"
                            >
                              Max All Ranks
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries(CLASS_TYPES).map(([typeNum, className]) => {
                            const classType = Number.parseInt(typeNum)
                            const classRank = getClassRank(classType)
                            const classId = Object.entries(CLASS_IDS).find(([_, name]) => name === className)?.[0] || ""
                            const unlocked = isClassUnlocked(classId)

                            return (
                              <div key={classType} className="p-4 bg-muted rounded-lg border border-border space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-semibold text-foreground">{className}</h3>
                                    {unlocked ? (
                                      <Badge variant="default" className="bg-green-600">
                                        Unlocked
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary">Locked</Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-sm text-muted-foreground">Rank</Label>
                                    <Input
                                      type="number"
                                      value={classRank.Rank}
                                      onChange={(e) =>
                                        handleClassRankChange(
                                          classType,
                                          Number.parseInt(e.target.value) || 1,
                                          classRank.Xp,
                                        )
                                      }
                                      min="1"
                                      className="font-mono bg-input border-border text-foreground"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm text-muted-foreground">XP</Label>
                                    <Input
                                      type="number"
                                      value={classRank.Xp}
                                      onChange={(e) =>
                                        handleClassRankChange(
                                          classType,
                                          classRank.Rank,
                                          Number.parseInt(e.target.value) || 0,
                                        )
                                      }
                                      min="0"
                                      className="font-mono bg-input border-border text-foreground"
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <CardTitle className="text-foreground">Unlocked Classes</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="flex flex-wrap gap-2">
                          {saveData.UnlockedClassIds.map((classId) => (
                            <Badge key={classId} variant="secondary" className="text-sm">
                              {CLASS_IDS[classId] || classId}
                            </Badge>
                          ))}
                          {saveData.UnlockedClassIds.length === 0 && (
                            <p className="text-muted-foreground text-sm">No classes unlocked yet</p>
                          )}
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
                  <span className="text-muted-foreground">Last modified: {formatDate(new Date())}</span>
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
    </>
  )
}
