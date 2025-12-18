"use client"

import { useState } from "react"
import { Sparkles, ArrowLeft, Coins, Save, Home, TrendingUp, Building, Code } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SaveFileUpload } from "@/components/save-file-upload"
import { SaveLocationHelp } from "@/components/save-location-help"
import { EditorSidebar } from "@/components/editor-sidebar"
import { JsonTreeEditor } from "@/components/json-tree-editor"
import { decodeSave, encodeSave, type DecodedSave } from "@/lib/ballxpit/decoder"
import { maxResources, maxTotalResources, maxElevator, resetTutorials } from "./save-mutations"
import Link from "next/link"
import { track } from "@vercel/analytics"
import gamesData from "@/data/games.json"

const gameData = gamesData.games.find((g) => g.id === "ballxpit")

export default function BallxpitSaveEditor() {
  const [saveData, setSaveData] = useState<DecodedSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true)
    try {
      const decoded = await decodeSave(file)
      setSaveData(decoded)
      setOriginalFile(file)
      track("ballxpit_file_uploaded", { fileName: file.name })
    } catch (error) {
      console.error("Failed to decode save file:", error)
      alert("Failed to decode save file. Please make sure it's a valid BALL x PIT save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!saveData) return

    setIsProcessing(true)
    try {
      const encoded = encodeSave(saveData)
      const blob = new Blob([encoded], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = originalFile?.name || "save.dat"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      track("ballxpit_file_downloaded")
    } catch (error) {
      console.error("Failed to encode save file:", error)
      alert("Failed to encode save file. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleLoadNew = () => {
    setSaveData(null)
    setOriginalFile(null)
  }

  const quickStats = saveData
    ? [
        {
          label: "Current Day",
          value: saveData.CurDay.toString(),
          icon: <Sparkles className="w-4 h-4 text-primary" />,
        },
        {
          label: "Coins",
          value: saveData.Coins.toLocaleString(),
          icon: <Coins className="w-4 h-4 text-yellow-500" />,
        },
        {
          label: "Elevator Level",
          value: saveData.ElevatorLvl.toString(),
          icon: <TrendingUp className="w-4 h-4 text-blue-500" />,
        },
        {
          label: "Buildings",
          value: saveData.Buildings.length.toString(),
          icon: <Building className="w-4 h-4 text-green-500" />,
        },
      ]
    : []

  const quickActions = saveData
    ? [
        {
          label: "Max Resources",
          onClick: () => setSaveData(maxResources(saveData)),
          icon: <Coins className="w-4 h-4 mr-2" />,
        },
        {
          label: "Max Totals",
          onClick: () => setSaveData(maxTotalResources(saveData)),
          icon: <TrendingUp className="w-4 h-4 mr-2" />,
        },
        {
          label: "Max Elevator",
          onClick: () => setSaveData(maxElevator(saveData)),
          icon: <Building className="w-4 h-4 mr-2" />,
        },
        {
          label: "Reset Tutorials",
          onClick: () => setSaveData(resetTutorials(saveData)),
          icon: <Sparkles className="w-4 h-4 mr-2" />,
        },
      ]
    : []

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date)
  }

  if (!saveData) {
    return (
      <main className="min-h-screen bg-background pb-20">
        <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
          <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">BALL x PIT</h1>
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
              <h2 className="text-3xl font-bold text-foreground">BALL x PIT Save Editor</h2>
              <p className="text-muted-foreground">
                Edit resources, progression, and buildings in your BALL x PIT save file
              </p>
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
            <h1 className="text-xl font-bold text-foreground">BALL x PIT</h1>
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
            <Tabs defaultValue="resources" className="w-full">
              <TabsList className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 h-auto bg-card border border-border p-2">
                <TabsTrigger value="resources" className="w-full data-[state=active]:bg-muted">
                  <Coins className="w-4 h-4 mr-2" />
                  Resources
                </TabsTrigger>
                <TabsTrigger value="progression" className="w-full data-[state=active]:bg-muted">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Progression
                </TabsTrigger>
                <TabsTrigger value="buildings" className="w-full data-[state=active]:bg-muted">
                  <Building className="w-4 h-4 mr-2" />
                  Buildings
                </TabsTrigger>
                <TabsTrigger value="stats" className="w-full data-[state=active]:bg-muted">
                  <Home className="w-4 h-4 mr-2" />
                  Meta Stats
                </TabsTrigger>
                <TabsTrigger value="advanced" className="w-full data-[state=active]:bg-muted">
                  <Code className="w-4 h-4 mr-2" />
                  Raw JSON
                </TabsTrigger>
              </TabsList>

              {/* Resources Tab */}
              <TabsContent value="resources" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Current Resources</CardTitle>
                    <CardDescription>Edit your available resources</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="coins">Coins</Label>
                        <Input
                          id="coins"
                          type="number"
                          value={saveData.Coins}
                          onChange={(e) => setSaveData({ ...saveData, Coins: Number.parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="wheat">Wheat</Label>
                        <Input
                          id="wheat"
                          type="number"
                          value={saveData.Wheat}
                          onChange={(e) => setSaveData({ ...saveData, Wheat: Number.parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="wood">Wood</Label>
                        <Input
                          id="wood"
                          type="number"
                          value={saveData.Wood}
                          onChange={(e) => setSaveData({ ...saveData, Wood: Number.parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="stone">Stone</Label>
                        <Input
                          id="stone"
                          type="number"
                          value={saveData.Stone}
                          onChange={(e) => setSaveData({ ...saveData, Stone: Number.parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Total Resources Earned</CardTitle>
                    <CardDescription>Lifetime resource statistics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="totalCoins">Total Coins</Label>
                        <Input
                          id="totalCoins"
                          type="number"
                          value={saveData.TotalCoins}
                          onChange={(e) =>
                            setSaveData({ ...saveData, TotalCoins: Number.parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="totalWheat">Total Wheat</Label>
                        <Input
                          id="totalWheat"
                          type="number"
                          value={saveData.TotalWheat}
                          onChange={(e) =>
                            setSaveData({ ...saveData, TotalWheat: Number.parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="totalWood">Total Wood</Label>
                        <Input
                          id="totalWood"
                          type="number"
                          value={saveData.TotalWood}
                          onChange={(e) =>
                            setSaveData({ ...saveData, TotalWood: Number.parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="totalStone">Total Stone</Label>
                        <Input
                          id="totalStone"
                          type="number"
                          value={saveData.TotalStone}
                          onChange={(e) =>
                            setSaveData({ ...saveData, TotalStone: Number.parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Progression Tab */}
              <TabsContent value="progression" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Game Progression</CardTitle>
                    <CardDescription>Edit your progression and last run stats</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="curDay">Current Day</Label>
                        <Input
                          id="curDay"
                          type="number"
                          value={saveData.CurDay}
                          onChange={(e) => setSaveData({ ...saveData, CurDay: Number.parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="elevatorLvl">Elevator Level</Label>
                        <Input
                          id="elevatorLvl"
                          type="number"
                          value={saveData.ElevatorLvl}
                          onChange={(e) =>
                            setSaveData({ ...saveData, ElevatorLvl: Number.parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastChar">Last Character</Label>
                        <Input
                          id="lastChar"
                          type="number"
                          value={saveData.LastChar}
                          onChange={(e) => setSaveData({ ...saveData, LastChar: Number.parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastLevel">Last Level</Label>
                        <Input
                          id="lastLevel"
                          type="number"
                          value={saveData.LastLevel}
                          onChange={(e) =>
                            setSaveData({ ...saveData, LastLevel: Number.parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastLevelNGPlus">Last Level NG+</Label>
                        <Input
                          id="lastLevelNGPlus"
                          type="number"
                          value={saveData.LastLevelNGPlus}
                          onChange={(e) =>
                            setSaveData({ ...saveData, LastLevelNGPlus: Number.parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="versionNum">Version Number</Label>
                        <Input
                          id="versionNum"
                          type="number"
                          value={saveData.VersionNum}
                          onChange={(e) =>
                            setSaveData({ ...saveData, VersionNum: Number.parseInt(e.target.value) || 1 })
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Buildings Tab */}
              <TabsContent value="buildings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Buildings</CardTitle>
                    <CardDescription>View and edit your buildings ({saveData.Buildings.length} total)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {saveData.Buildings.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No buildings found</p>
                      ) : (
                        saveData.Buildings.map((building, index) => (
                          <Card key={index} className="bg-muted/50">
                            <CardContent className="pt-4">
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">ID</Label>
                                  <Input
                                    type="number"
                                    value={building.id}
                                    onChange={(e) => {
                                      const updated = [...saveData.Buildings]
                                      updated[index] = { ...building, id: Number.parseInt(e.target.value) || 0 }
                                      setSaveData({ ...saveData, Buildings: updated })
                                    }}
                                    className="h-8"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Type</Label>
                                  <Input
                                    type="number"
                                    value={building.type ?? 0}
                                    onChange={(e) => {
                                      const updated = [...saveData.Buildings]
                                      updated[index] = { ...building, type: Number.parseInt(e.target.value) || 0 }
                                      setSaveData({ ...saveData, Buildings: updated })
                                    }}
                                    className="h-8"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Rotation</Label>
                                  <Input
                                    type="number"
                                    value={building.rotation ?? 0}
                                    onChange={(e) => {
                                      const updated = [...saveData.Buildings]
                                      updated[index] = {
                                        ...building,
                                        rotation: Number.parseInt(e.target.value) || 0,
                                      }
                                      setSaveData({ ...saveData, Buildings: updated })
                                    }}
                                    className="h-8"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Upgrade Lvl</Label>
                                  <Input
                                    type="number"
                                    value={building.upgradeLvl ?? 0}
                                    onChange={(e) => {
                                      const updated = [...saveData.Buildings]
                                      updated[index] = {
                                        ...building,
                                        upgradeLvl: Number.parseInt(e.target.value) || 0,
                                      }
                                      setSaveData({ ...saveData, Buildings: updated })
                                    }}
                                    className="h-8"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Task Secs</Label>
                                  <Input
                                    type="number"
                                    value={building.curTaskSecs ?? 0}
                                    onChange={(e) => {
                                      const updated = [...saveData.Buildings]
                                      updated[index] = {
                                        ...building,
                                        curTaskSecs: Number.parseInt(e.target.value) || 0,
                                      }
                                      setSaveData({ ...saveData, Buildings: updated })
                                    }}
                                    className="h-8"
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Meta Stats Tab */}
              <TabsContent value="stats" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Meta Statistics</CardTitle>
                    <CardDescription>View and edit career statistics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(saveData.Meta).map(([key, value]) => (
                        <div key={key} className="space-y-2">
                          <Label htmlFor={key} className="text-sm">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </Label>
                          <Input
                            id={key}
                            type="number"
                            value={value}
                            onChange={(e) =>
                              setSaveData({
                                ...saveData,
                                Meta: { ...saveData.Meta, [key]: Number.parseInt(e.target.value) || 0 },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
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
                  <CardContent className="overflow-x-auto max-w-full">
                    <div className="min-w-0">
                      <JsonTreeEditor data={saveData} onChange={setSaveData} />
                    </div>
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
