"use client"

import { useState, useCallback } from "react"
import {
  Pickaxe,
  ArrowLeft,
  Coins,
  Code,
  TrendingUp,
  Users,
  Target,
  Sword,
  Gem,
  Sparkles,
  Shield,
  Star,
  Trash2,
  Plus,
} from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  type DRGSurvivorSave,
  type GearItem,
  META_STAT_UPGRADES,
  CLASS_TYPES,
  CLASS_IDS,
  ALL_WEAPON_IDS,
  ALL_ARTIFACT_IDS,
  ALL_CLASS_ARTIFACT_IDS,
  ALL_OVERCLOCK_WEAPON_IDS,
  WEAPON_NAMES,
  ARTIFACT_NAMES,
  CLASS_ARTIFACT_NAMES,
  GEAR_TYPES,
  GEAR_STATS,
  GEAR_RARITIES,
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
  toggleWeaponUnlock,
  unlockAllWeapons,
  toggleOverclockUnlock,
  unlockAllOverclocks,
  toggleArtifactUnlock,
  unlockAllArtifacts,
  toggleClassArtifactUnlock,
  unlockAllClassArtifacts,
  unlockEverything,
  updateGearItem,
  deleteGearItem,
  createPerfectGear,
  maxAllGear,
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

  const [selectedGearIndex, setSelectedGearIndex] = useState<number | null>(null)
  const [newGearType, setNewGearType] = useState<string>("")

  const processSaveFile = async (file: File) => {
    setIsProcessing(true)
    try {
      const text = await file.text()
      const decoded = JSON.parse(text) as DRGSurvivorSave
      setSaveData(decoded)
      setOriginalFile(file)

      track("file_uploaded", {
        game: "drg-survivor",
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
        game: "drg-survivor",
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

  const isWeaponUnlocked = (weaponId: string) => {
    if (!saveData) return false
    return saveData.UnlockedWeaponIds.includes(weaponId)
  }

  const isOverclockUnlocked = (weaponId: string) => {
    if (!saveData) return false
    return saveData.OverclockUnlockedWeaponIds.includes(weaponId)
  }

  const isArtifactUnlocked = (artifactId: string) => {
    if (!saveData) return false
    return saveData.UnlockedArtifactIds.includes(artifactId)
  }

  const isClassArtifactUnlocked = (artifactId: string) => {
    if (!saveData) return false
    return saveData.UnlockedClassArtifactIds.includes(artifactId)
  }

  const getGearName = useCallback((gearId: string) => {
    return GEAR_TYPES[gearId]?.name || gearId
  }, [])

  const getGearCategory = useCallback((gearId: string) => {
    return GEAR_TYPES[gearId]?.category || "Unknown"
  }, [])

  const gearByCategory = saveData?.GearSaveData?.reduce(
    (acc: Record<string, { gear: GearItem; index: number }[]>, gear: GearItem, index: number) => {
      const category = getGearCategory(gear.ID)
      if (!acc[category]) acc[category] = []
      acc[category].push({ gear, index })
      return acc
    },
    {},
  )

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
          label: "Unlock Everything",
          onClick: () => setSaveData(unlockEverything(saveData)),
          icon: <Sparkles className="w-4 h-4 mr-2" />,
        },
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
        // Add gear action
        {
          label: "Max All Gear",
          icon: <Shield className="w-4 h-4 mr-2" />,
          onClick: () => setSaveData(maxAllGear(saveData)),
          variant: "outline" as const,
        },
        {
          label: "Download JSON",
          onClick: () => {
            const filename = originalFile?.name.replace(/\.[^/.]+$/, "") || "drg-survivor-save"
            downloadJSON(saveData, filename)
            track("json_downloaded", {
              game: "drg-survivor",
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
                  <TabsList className="grid w-full grid-cols-7 bg-card border border-border">
                    <TabsTrigger value="resources" className="data-[state=active]:bg-muted">
                      <Coins className="w-4 h-4 mr-2" />
                      Resources
                    </TabsTrigger>
                    <TabsTrigger value="meta" className="data-[state=active]:bg-muted">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Meta
                    </TabsTrigger>
                    <TabsTrigger value="classes" className="data-[state=active]:bg-muted">
                      <Users className="w-4 h-4 mr-2" />
                      Classes
                    </TabsTrigger>
                    <TabsTrigger value="gear" className="data-[state=active]:bg-muted">
                      <Shield className="w-4 h-4 mr-2" />
                      Gear
                    </TabsTrigger>
                    <TabsTrigger value="weapons" className="data-[state=active]:bg-muted">
                      <Sword className="w-4 h-4 mr-2" />
                      Weapons
                    </TabsTrigger>
                    <TabsTrigger value="artifacts" className="data-[state=active]:bg-muted">
                      <Gem className="w-4 h-4 mr-2" />
                      Artifacts
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
                                    <Users className="w-5 h-5 text-primary" />
                                    <span className="font-medium text-foreground">{className}</span>
                                  </div>
                                  <Badge variant={unlocked ? "default" : "secondary"}>
                                    {unlocked ? "Unlocked" : "Locked"}
                                  </Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Rank</Label>
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
                                      max="50"
                                      className="font-mono bg-input border-border text-foreground"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">XP</Label>
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
                  </TabsContent>

                  <TabsContent value="gear" className="space-y-4 mt-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-foreground">Gear Inventory</CardTitle>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setSaveData(maxAllGear(saveData))}
                              variant="outline"
                              size="sm"
                              className="text-primary border-primary/30 hover:bg-primary/10"
                            >
                              <Star className="w-4 h-4 mr-2" />
                              Max All Gear
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground mb-4">
                          Total gear items: {saveData.GearSaveData?.length || 0}
                        </p>

                        {/* Gear by category */}
                        {gearByCategory &&
                          Object.entries(gearByCategory).map(([category, items]) => (
                            <div key={category} className="mb-6 last:mb-0">
                              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                {category} ({(items as { gear: GearItem; index: number }[]).length})
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {(items as { gear: GearItem; index: number }[]).map(({ gear, index }) => (
                                  <div
                                    key={index}
                                    className={`p-3 bg-muted rounded-lg border border-border cursor-pointer transition-colors hover:border-primary/50 ${
                                      selectedGearIndex === index ? "border-primary" : ""
                                    }`}
                                    onClick={() => setSelectedGearIndex(selectedGearIndex === index ? null : index)}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className={`font-medium ${GEAR_RARITIES[gear.R]?.color || ""}`}>
                                        {getGearName(gear.ID)}
                                      </span>
                                      <Badge variant="outline" className={GEAR_RARITIES[gear.R]?.color}>
                                        {GEAR_RARITIES[gear.R]?.name || "Unknown"}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-1">
                                      <div className="flex justify-between">
                                        <span>Level: {gear.L}</span>
                                        <span>Upgrade: +{gear.U}</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {gear.S?.map((statId, i) => (
                                          <Badge
                                            key={i}
                                            variant="secondary"
                                            className={`text-xs ${gear.SG?.[i] === 1 ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}
                                          >
                                            {GEAR_STATS[statId] || `Stat ${statId}`}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}

                        {(!saveData.GearSaveData || saveData.GearSaveData.length === 0) && (
                          <p className="text-muted-foreground text-center py-8">No gear items found in save file.</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Gear Editor Panel */}
                    {selectedGearIndex !== null && saveData.GearSaveData?.[selectedGearIndex] && (
                      <Card className="bg-card border-border">
                        <CardHeader className="border-b border-border">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-foreground">
                              Edit: {getGearName(saveData.GearSaveData[selectedGearIndex].ID)}
                            </CardTitle>
                            <Button
                              onClick={() => {
                                setSaveData(deleteGearItem(saveData, selectedGearIndex))
                                setSelectedGearIndex(null)
                              }}
                              variant="destructive"
                              size="sm"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Rarity */}
                            <div className="space-y-2">
                              <Label>Rarity</Label>
                              <Select
                                value={saveData.GearSaveData[selectedGearIndex].R.toString()}
                                onValueChange={(v) =>
                                  setSaveData(updateGearItem(saveData, selectedGearIndex, { R: Number.parseInt(v) }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(GEAR_RARITIES).map(([value, { name }]) => (
                                    <SelectItem key={value} value={value}>
                                      {name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Level */}
                            <div className="space-y-2">
                              <Label>Level</Label>
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                value={saveData.GearSaveData[selectedGearIndex].L}
                                onChange={(e) =>
                                  setSaveData(
                                    updateGearItem(saveData, selectedGearIndex, {
                                      L: Number.parseInt(e.target.value) || 1,
                                    }),
                                  )
                                }
                              />
                            </div>

                            {/* Upgrade */}
                            <div className="space-y-2">
                              <Label>Upgrade Level</Label>
                              <Select
                                value={saveData.GearSaveData[selectedGearIndex].U.toString()}
                                onValueChange={(v) =>
                                  setSaveData(updateGearItem(saveData, selectedGearIndex, { U: Number.parseInt(v) }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">+0</SelectItem>
                                  <SelectItem value="1">+1</SelectItem>
                                  <SelectItem value="2">+2</SelectItem>
                                  <SelectItem value="3">+3</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Favorite */}
                            <div className="space-y-2">
                              <Label>Favorite</Label>
                              <div className="flex items-center gap-2 h-10">
                                <Checkbox
                                  checked={saveData.GearSaveData[selectedGearIndex].F === 1}
                                  onCheckedChange={(checked) =>
                                    setSaveData(updateGearItem(saveData, selectedGearIndex, { F: checked ? 1 : 0 }))
                                  }
                                />
                                <span className="text-sm text-muted-foreground">Mark as favorite</span>
                              </div>
                            </div>
                          </div>

                          {/* Stats Editor */}
                          <div className="space-y-2">
                            <Label>Stats</Label>
                            <div className="space-y-2">
                              {saveData.GearSaveData[selectedGearIndex].S?.map((statId: number, i: number) => (
                                <div key={i} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                                  <Select
                                    value={statId.toString()}
                                    onValueChange={(v) => {
                                      const newStats = [...saveData.GearSaveData[selectedGearIndex].S]
                                      newStats[i] = Number.parseInt(v)
                                      setSaveData(updateGearItem(saveData, selectedGearIndex, { S: newStats }))
                                    }}
                                  >
                                    <SelectTrigger className="flex-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(GEAR_STATS).map(([id, name]) => (
                                        <SelectItem key={id} value={id}>
                                          {name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  <Select
                                    value={saveData.GearSaveData[selectedGearIndex].SG?.[i]?.toString() || "1"}
                                    onValueChange={(v) => {
                                      const newSG = [...(saveData.GearSaveData[selectedGearIndex].SG || [])]
                                      newSG[i] = Number.parseInt(v)
                                      setSaveData(updateGearItem(saveData, selectedGearIndex, { SG: newSG }))
                                    }}
                                  >
                                    <SelectTrigger className="w-24">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="1">Gold</SelectItem>
                                      <SelectItem value="-1">Blue</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <Select
                                    value={saveData.GearSaveData[selectedGearIndex].ST?.[i]?.toString() || "0"}
                                    onValueChange={(v) => {
                                      const newST = [...(saveData.GearSaveData[selectedGearIndex].ST || [])]
                                      newST[i] = Number.parseInt(v)
                                      setSaveData(updateGearItem(saveData, selectedGearIndex, { ST: newST }))
                                    }}
                                  >
                                    <SelectTrigger className="w-24">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="0">Best</SelectItem>
                                      <SelectItem value="1">Mid</SelectItem>
                                      <SelectItem value="2">Low</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Quick Actions for this gear */}
                          <div className="flex gap-2 pt-2">
                            <Button
                              onClick={() => {
                                const gear = saveData.GearSaveData[selectedGearIndex]
                                setSaveData(
                                  updateGearItem(saveData, selectedGearIndex, {
                                    R: 4,
                                    L: 100,
                                    U: 3,
                                    SG: gear.S.map(() => 1),
                                    ST: gear.S.map((_: number, i: number) => Math.min(i, 2)),
                                  }),
                                )
                              }}
                              variant="outline"
                              size="sm"
                              className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                            >
                              <Star className="w-4 h-4 mr-2" />
                              Make Perfect
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Add New Gear */}
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <CardTitle className="text-foreground">Add New Gear</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="flex gap-3">
                          <Select value={newGearType} onValueChange={setNewGearType}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select gear type..." />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(GEAR_TYPES).map(([id, { name, category }]) => (
                                <SelectItem key={id} value={id}>
                                  [{category}] {name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => {
                              if (newGearType) {
                                setSaveData(createPerfectGear(saveData, newGearType))
                                setNewGearType("")
                              }
                            }}
                            disabled={!newGearType}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Legendary
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="weapons" className="space-y-4 mt-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-foreground">Weapons</CardTitle>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setSaveData(unlockAllWeapons(saveData))}
                              variant="outline"
                              size="sm"
                              className="text-primary border-primary/30 hover:bg-primary/10"
                            >
                              Unlock All Weapons
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {ALL_WEAPON_IDS.map((weaponId) => {
                            const unlocked = isWeaponUnlocked(weaponId)
                            return (
                              <div
                                key={weaponId}
                                className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border"
                              >
                                <Checkbox
                                  id={`weapon-${weaponId}`}
                                  checked={unlocked}
                                  onCheckedChange={() => setSaveData(toggleWeaponUnlock(saveData, weaponId))}
                                />
                                <Label
                                  htmlFor={`weapon-${weaponId}`}
                                  className="text-sm text-foreground cursor-pointer flex-1"
                                >
                                  {WEAPON_NAMES[weaponId] || weaponId}
                                </Label>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-foreground">Weapon Overclocks</CardTitle>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setSaveData(unlockAllOverclocks(saveData))}
                              variant="outline"
                              size="sm"
                              className="text-primary border-primary/30 hover:bg-primary/10"
                            >
                              Unlock All Overclocks
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {ALL_OVERCLOCK_WEAPON_IDS.map((weaponId) => {
                            const unlocked = isOverclockUnlocked(weaponId)
                            return (
                              <div
                                key={`overclock-${weaponId}`}
                                className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border"
                              >
                                <Checkbox
                                  id={`overclock-${weaponId}`}
                                  checked={unlocked}
                                  onCheckedChange={() => setSaveData(toggleOverclockUnlock(saveData, weaponId))}
                                />
                                <Label
                                  htmlFor={`overclock-${weaponId}`}
                                  className="text-sm text-foreground cursor-pointer flex-1"
                                >
                                  {WEAPON_NAMES[weaponId] || weaponId} Overclock
                                </Label>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="artifacts" className="space-y-4 mt-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-foreground">Artifacts</CardTitle>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setSaveData(unlockAllArtifacts(saveData))}
                              variant="outline"
                              size="sm"
                              className="text-primary border-primary/30 hover:bg-primary/10"
                            >
                              Unlock All
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {ALL_ARTIFACT_IDS.map((artifactId) => {
                            const unlocked = isArtifactUnlocked(artifactId)
                            return (
                              <div
                                key={artifactId}
                                className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border"
                              >
                                <Checkbox
                                  id={`artifact-${artifactId}`}
                                  checked={unlocked}
                                  onCheckedChange={() => setSaveData(toggleArtifactUnlock(saveData, artifactId))}
                                />
                                <Label
                                  htmlFor={`artifact-${artifactId}`}
                                  className="text-sm text-foreground cursor-pointer flex-1"
                                >
                                  {ARTIFACT_NAMES[artifactId] || artifactId}
                                </Label>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-foreground">Class Artifacts</CardTitle>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setSaveData(unlockAllClassArtifacts(saveData))}
                              variant="outline"
                              size="sm"
                              className="text-primary border-primary/30 hover:bg-primary/10"
                            >
                              Unlock All
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {/* Group class artifacts by class */}
                        {["Scout", "Driller", "Engineer", "Gunner"].map((className) => {
                          const classArtifacts = ALL_CLASS_ARTIFACT_IDS.filter((id) => id.startsWith(className + "_"))
                          return (
                            <div key={className} className="mb-6 last:mb-0">
                              <h4 className="text-sm font-medium text-muted-foreground mb-3">{className}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {classArtifacts.map((artifactId) => {
                                  const unlocked = isClassArtifactUnlocked(artifactId)
                                  return (
                                    <div
                                      key={artifactId}
                                      className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border"
                                    >
                                      <Checkbox
                                        id={`class-artifact-${artifactId}`}
                                        checked={unlocked}
                                        onCheckedChange={() =>
                                          setSaveData(toggleClassArtifactUnlock(saveData, artifactId))
                                        }
                                      />
                                      <Label
                                        htmlFor={`class-artifact-${artifactId}`}
                                        className="text-sm text-foreground cursor-pointer flex-1"
                                      >
                                        {CLASS_ARTIFACT_NAMES[artifactId]?.replace(`${className}: `, "") || artifactId}
                                      </Label>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="raw" className="space-y-4 mt-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <CardTitle className="text-foreground">Raw JSON Editor</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <JsonTreeEditor
                          data={saveData}
                          onChange={(newData) => setSaveData(newData as DRGSurvivorSave)}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
