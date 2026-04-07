"use client"

import { useState } from "react"
import {
  DollarSign,
  ArrowLeft,
  TrendingUp,
  Users,
  Building2,
  ShoppingBag,
  Code,
  User,
  Star,
  MapPin,
  Shield,
  Unlock,
  Package,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { downloadJSON } from "@/lib/download-json"
import Link from "next/link"
import { track } from "@vercel/analytics"
import { SaveLocationHelp } from "@/components/save-location-help"
import { SaveFolderUpload } from "@/components/save-folder-upload"
import { EditorSidebar } from "@/components/editor-sidebar"
import gamesData from "@/data/games.json"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JsonTreeEditor } from "@/components/json-tree-editor"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  type Schedule1Save,
  decodeSaveFromFiles,
  encodeSaveToBlob,
} from "@/lib/schedule-1/decoder"
import {
  setMoney,
  maxMoney,
  updateMoneyField,
  maxRank,
  updateRankField,
  unlockAllRegions,
  setAllOwned,
  togglePropertyOwned,
  toggleBusinessOwned,
  setPlayerCash,
  setAllRelationships,
  unlockAllProducts,
  unlockSewer,
  setLawIntensity,
} from "./save-mutations"

// ── Helpers ─────────────────────────────────────────────────────────────

function humanize(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function getPlayerCash(entry: { inventory?: Record<string, unknown> }): number | null {
  if (!entry.inventory) return null
  const inv = entry.inventory as { Items: string[] }
  for (const itemStr of inv.Items) {
    const item = JSON.parse(itemStr)
    if (item.DataType === "CashData") return item.CashBalance ?? 0
  }
  return null
}

function getPlayerItems(entry: { inventory?: Record<string, unknown> }): { id: string; qty: number; type: string }[] {
  if (!entry.inventory) return []
  const inv = entry.inventory as { Items: string[] }
  return inv.Items.map((s) => JSON.parse(s))
    .filter((i: { ID: string }) => i.ID !== "")
    .map((i: { ID: string; Quantity: number; DataType: string }) => ({ id: i.ID, qty: i.Quantity, type: i.DataType }))
}

function getNPCList(save: Schedule1Save): { id: string; relationship: number; unlocked: boolean }[] {
  const npcsObj = save.npcs as { NPCs?: Array<{ BaseData: string; AdditionalDatas: Array<{ Name: string; Contents: string }> }> }
  if (!npcsObj.NPCs) return []
  return npcsObj.NPCs.map((npc) => {
    const base = JSON.parse(npc.BaseData)
    const rel = npc.AdditionalDatas.find((d) => d.Name === "Relationship")
    let relationship = 0
    let unlocked = false
    if (rel) {
      const data = JSON.parse(rel.Contents)
      relationship = data.RelationDelta ?? 0
      unlocked = data.Unlocked ?? false
    }
    return { id: base.ID ?? "", relationship, unlocked }
  })
}

const REGION_NAMES: Record<number, string> = {
  0: "Northtown",
  1: "Suburbia",
  2: "Docks",
  3: "Westville",
  4: "Downtown",
  5: "Uptown",
}

// ── Component ───────────────────────────────────────────────────────────

export default function Schedule1SaveEditor() {
  const [saveData, setSaveData] = useState<Schedule1Save | null>(null)
  const [folderName, setFolderName] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const processSaveFolder = async (files: FileList) => {
    setIsProcessing(true)
    try {
      const decoded = await decodeSaveFromFiles(files)
      setSaveData(decoded)
      setFolderName(decoded._folderName)

      track("file_uploaded", {
        game: "Schedule1",
        fileSize: Array.from(files).reduce((sum, f) => sum + f.size, 0),
        fileName: decoded._folderName,
      })
    } catch (error) {
      console.error("Error processing save folder:", error)
      alert("Failed to process save folder. Please ensure it is a valid Schedule I save directory.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = async () => {
    if (!saveData) return

    setIsProcessing(true)
    try {
      const blob = await encodeSaveToBlob(saveData)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${saveData._folderName}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      track("file_downloaded", {
        game: "Schedule1",
        fileName: `${saveData._folderName}.zip`,
      })
    } catch (error) {
      console.error("Error encoding save:", error)
      alert("Failed to create edited save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const orgName = (saveData?.game as Record<string, unknown>)?.OrganisationName as string | undefined
  const gameVersion = (saveData?.game as Record<string, unknown>)?.GameVersion as string | undefined
  const sewerUnlocked = (saveData?.sewer as Record<string, unknown>)?.IsSewerUnlocked as boolean | undefined
  const discoveredProducts = ((saveData?.products as Record<string, unknown>)?.DiscoveredProducts as string[]) ?? []
  const playerCount = saveData ? Object.keys(saveData.players).length : 0
  const npcList = saveData ? getNPCList(saveData) : []

  const quickStats = saveData
    ? [
        { label: "Organisation", value: orgName ?? "Unknown", icon: <Building2 className="w-4 h-4 text-blue-400" /> },
        {
          label: "Balance",
          value: `$${saveData.money.OnlineBalance?.toLocaleString()}`,
          icon: <DollarSign className="w-4 h-4 text-green-400" />,
        },
        {
          label: "Rank",
          value: `${saveData.rank.Rank} / Tier ${saveData.rank.Tier}`,
          icon: <Star className="w-4 h-4 text-yellow-400" />,
        },
      ]
    : []

  const quickActions = saveData
    ? [
        {
          label: "Max Money",
          onClick: () => setSaveData(maxMoney(saveData)),
          icon: <DollarSign className="w-4 h-4 mr-2" />,
        },
        {
          label: "Max Rank",
          onClick: () => setSaveData(maxRank(saveData)),
          icon: <TrendingUp className="w-4 h-4 mr-2" />,
        },
        {
          label: "Own All Properties",
          onClick: () => setSaveData(setAllOwned(saveData)),
          icon: <Building2 className="w-4 h-4 mr-2" />,
        },
        {
          label: "Download JSON",
          onClick: () => {
            const filename = folderName || "schedule1-save"
            downloadJSON(saveData, filename)
            track("json_downloaded", { game: "Schedule1", fileName: filename })
          },
          icon: <Code className="w-4 h-4 mr-2" />,
        },
      ]
    : []

  const gameData = gamesData.games.find((game) => game.id === "schedule-1")

  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Schedule I</h1>
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
              <h2 className="text-3xl font-bold text-foreground">Schedule I Save Editor</h2>
              <p className="text-muted-foreground">
                Edit money, rank, properties, businesses, NPCs, and products
              </p>
            </div>

            {gameData && <SaveLocationHelp platforms={gameData.platforms} gameName={gameData.name} />}

            <SaveFolderUpload onFolderSelect={processSaveFolder} isProcessing={isProcessing} />
          </div>
        ) : (
          <div className="flex gap-6 pt-4">
            <EditorSidebar
              onDownload={handleDownload}
              onLoadNew={() => {
                setSaveData(null)
                setFolderName(null)
              }}
              isProcessing={isProcessing}
              hasSaveData={!!saveData}
              fileName={folderName ?? undefined}
              fileSize={undefined}
              lastModified={undefined}
              quickStats={quickStats}
              quickActions={quickActions}
            />

            <div className="flex-1 space-y-4">
              <Tabs defaultValue="economy" className="w-full">
                <TabsList className="grid w-full grid-cols-5 bg-card border border-border">
                  <TabsTrigger value="economy" className="data-[state=active]:bg-muted">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Economy
                  </TabsTrigger>
                  <TabsTrigger value="players" className="data-[state=active]:bg-muted">
                    <User className="w-4 h-4 mr-2" />
                    Players
                  </TabsTrigger>
                  <TabsTrigger value="world" className="data-[state=active]:bg-muted">
                    <Building2 className="w-4 h-4 mr-2" />
                    World
                  </TabsTrigger>
                  <TabsTrigger value="products" className="data-[state=active]:bg-muted">
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Products
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="data-[state=active]:bg-muted">
                    <Code className="w-4 h-4 mr-2" />
                    Raw JSON
                  </TabsTrigger>
                </TabsList>

                {/* ── Economy Tab ─────────────────────────────────── */}
                <TabsContent value="economy" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Money */}
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-foreground">
                          <span className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-green-500" />
                            Online Balance
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                            onClick={() => setSaveData(setMoney(saveData, 9999999))}
                          >
                            Max
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Input
                          type="number"
                          value={saveData.money.OnlineBalance}
                          onChange={(e) =>
                            setSaveData(updateMoneyField(saveData, "OnlineBalance", parseFloat(e.target.value) || 0))
                          }
                          step="0.01"
                          className="font-mono text-lg bg-muted border-border text-foreground"
                        />
                      </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <TrendingUp className="w-5 h-5 text-blue-500" />
                          Networth
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Input
                          type="number"
                          value={saveData.money.Networth}
                          onChange={(e) =>
                            setSaveData(updateMoneyField(saveData, "Networth", parseFloat(e.target.value) || 0))
                          }
                          step="0.01"
                          className="font-mono text-lg bg-muted border-border text-foreground"
                        />
                      </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <DollarSign className="w-5 h-5 text-yellow-500" />
                          Lifetime Earnings
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Input
                          type="number"
                          value={saveData.money.LifetimeEarnings}
                          onChange={(e) =>
                            setSaveData(updateMoneyField(saveData, "LifetimeEarnings", parseFloat(e.target.value) || 0))
                          }
                          step="0.01"
                          className="font-mono text-lg bg-muted border-border text-foreground"
                        />
                      </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <DollarSign className="w-5 h-5 text-muted-foreground" />
                          Weekly Deposit Sum
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Input
                          type="number"
                          value={saveData.money.WeeklyDepositSum}
                          onChange={(e) =>
                            setSaveData(updateMoneyField(saveData, "WeeklyDepositSum", parseFloat(e.target.value) || 0))
                          }
                          step="0.01"
                          className="font-mono text-lg bg-muted border-border text-foreground"
                        />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Rank */}
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <Star className="w-5 h-5 text-yellow-500" />
                          Rank & Progression
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                          onClick={() => setSaveData(maxRank(saveData))}
                        >
                          Max Rank
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-muted-foreground">Rank</Label>
                          <Input
                            type="number"
                            value={saveData.rank.Rank}
                            onChange={(e) =>
                              setSaveData(updateRankField(saveData, "Rank", parseInt(e.target.value) || 0))
                            }
                            min="0"
                            className="font-mono bg-muted border-border text-foreground"
                          />
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Tier</Label>
                          <Input
                            type="number"
                            value={saveData.rank.Tier}
                            onChange={(e) =>
                              setSaveData(updateRankField(saveData, "Tier", parseInt(e.target.value) || 0))
                            }
                            min="0"
                            className="font-mono bg-muted border-border text-foreground"
                          />
                        </div>
                        <div>
                          <Label className="text-muted-foreground">XP</Label>
                          <Input
                            type="number"
                            value={saveData.rank.XP}
                            onChange={(e) =>
                              setSaveData(updateRankField(saveData, "XP", parseInt(e.target.value) || 0))
                            }
                            min="0"
                            className="font-mono bg-muted border-border text-foreground"
                          />
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Total XP</Label>
                          <Input
                            type="number"
                            value={saveData.rank.TotalXP}
                            onChange={(e) =>
                              setSaveData(updateRankField(saveData, "TotalXP", parseInt(e.target.value) || 0))
                            }
                            min="0"
                            className="font-mono bg-muted border-border text-foreground"
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-muted-foreground">Unlocked Regions</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                            onClick={() => setSaveData(unlockAllRegions(saveData))}
                          >
                            <MapPin className="w-3 h-3 mr-1" />
                            Unlock All
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(REGION_NAMES).map(([id, name]) => {
                            const regionId = parseInt(id)
                            const unlocked = saveData.rank.UnlockedRegions.includes(regionId)
                            return (
                              <div key={id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                                <Checkbox
                                  id={`region-${id}`}
                                  checked={unlocked}
                                  onCheckedChange={(checked) => {
                                    const regions = checked
                                      ? [...saveData.rank.UnlockedRegions, regionId]
                                      : saveData.rank.UnlockedRegions.filter((r) => r !== regionId)
                                    setSaveData(updateRankField(saveData, "UnlockedRegions", regions))
                                  }}
                                />
                                <Label htmlFor={`region-${id}`} className="text-sm cursor-pointer">
                                  {name}
                                </Label>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── Players Tab ─────────────────────────────────── */}
                <TabsContent value="players" className="space-y-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <User className="w-5 h-5 text-blue-500" />
                          Players ({playerCount})
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                          onClick={() => setSaveData(setPlayerCash(saveData, 99999))}
                        >
                          Max All Cash
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      {Object.entries(saveData.players).map(([name, entry]) => {
                        const cash = getPlayerCash(entry)
                        const items = getPlayerItems(entry)
                        const playerCode = (entry.player as Record<string, unknown>).PlayerCode as string

                        return (
                          <Card key={name} className="bg-muted/30 border-border">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                                <User className="w-4 h-4" />
                                {name === "Player_0" ? "Host" : name}
                                {playerCode && (
                                  <Badge variant="secondary" className="font-mono text-xs">
                                    {playerCode}
                                  </Badge>
                                )}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {cash !== null && (
                                <div>
                                  <Label className="text-muted-foreground text-xs">Pocket Cash</Label>
                                  <div className="text-lg font-mono text-green-400">${cash.toLocaleString()}</div>
                                </div>
                              )}
                              {items.length > 0 && (
                                <div>
                                  <Label className="text-muted-foreground text-xs">Inventory</Label>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {items.map((item, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {humanize(item.id)} x{item.qty}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── World Tab ───────────────────────────────────── */}
                <TabsContent value="world" className="space-y-4">
                  {/* Properties */}
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <Building2 className="w-5 h-5 text-purple-500" />
                          Properties
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                          onClick={() => setSaveData(setAllOwned(saveData))}
                        >
                          Own All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        {Object.entries(saveData.properties).map(([name, data]) => {
                          const isOwned = (data as Record<string, unknown>).IsOwned as boolean
                          return (
                            <div key={name} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
                              <Label className="text-sm cursor-pointer" htmlFor={`prop-${name}`}>
                                {name}
                              </Label>
                              <div className="flex items-center gap-2">
                                <Badge variant={isOwned ? "default" : "secondary"} className="text-xs">
                                  {isOwned ? "Owned" : "Not Owned"}
                                </Badge>
                                <Checkbox
                                  id={`prop-${name}`}
                                  checked={isOwned}
                                  onCheckedChange={(checked) =>
                                    setSaveData(togglePropertyOwned(saveData, name, !!checked))
                                  }
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Businesses */}
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <CardTitle className="flex items-center gap-2 text-foreground">
                        <ShoppingBag className="w-5 h-5 text-orange-500" />
                        Businesses
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        {Object.entries(saveData.businesses).map(([name, data]) => {
                          const isOwned = (data as Record<string, unknown>).IsOwned as boolean
                          return (
                            <div key={name} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
                              <Label className="text-sm cursor-pointer" htmlFor={`biz-${name}`}>
                                {name}
                              </Label>
                              <div className="flex items-center gap-2">
                                <Badge variant={isOwned ? "default" : "secondary"} className="text-xs">
                                  {isOwned ? "Owned" : "Not Owned"}
                                </Badge>
                                <Checkbox
                                  id={`biz-${name}`}
                                  checked={isOwned}
                                  onCheckedChange={(checked) =>
                                    setSaveData(toggleBusinessOwned(saveData, name, !!checked))
                                  }
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* NPCs */}
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <Users className="w-5 h-5 text-cyan-500" />
                          NPCs ({npcList.length})
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                          onClick={() => setSaveData(setAllRelationships(saveData, 100))}
                        >
                          Max All Relationships
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {npcList.map((npc) => (
                          <div key={npc.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30">
                            <span className="text-sm">{humanize(npc.id)}</span>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={npc.unlocked ? "default" : "secondary"}
                                className="text-xs font-mono"
                              >
                                {npc.relationship.toFixed(1)}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sewer & Law */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-foreground">
                          <span className="flex items-center gap-2">
                            <Unlock className="w-5 h-5 text-green-500" />
                            Sewer
                          </span>
                          {!sewerUnlocked && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                              onClick={() => setSaveData(unlockSewer(saveData))}
                            >
                              Unlock
                            </Button>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Badge variant={sewerUnlocked ? "default" : "secondary"}>
                          {sewerUnlocked ? "Unlocked" : "Locked"}
                        </Badge>
                      </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <Shield className="w-5 h-5 text-red-500" />
                          Law Intensity
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Input
                          type="number"
                          value={(saveData.law as Record<string, unknown>).InternalLawIntensity as number ?? 0}
                          onChange={(e) =>
                            setSaveData(setLawIntensity(saveData, parseFloat(e.target.value) || 0))
                          }
                          step="0.1"
                          min="0"
                          className="font-mono bg-muted border-border text-foreground"
                        />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* ── Products Tab ────────────────────────────────── */}
                <TabsContent value="products" className="space-y-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <ShoppingBag className="w-5 h-5 text-green-500" />
                          Discovered Products
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                          onClick={() => setSaveData(unlockAllProducts(saveData))}
                        >
                          Unlock All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="flex flex-wrap gap-2">
                        {discoveredProducts.map((product) => (
                          <Badge key={product} variant="default" className="text-sm">
                            {humanize(product)}
                          </Badge>
                        ))}
                        {discoveredProducts.length === 0 && (
                          <p className="text-sm text-muted-foreground">No products discovered yet</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Product Prices */}
                  {(() => {
                    const prices = (saveData.products as Record<string, unknown>).ProductPrices as
                      | Array<{ String: string; Int: number }>
                      | undefined
                    if (!prices || prices.length === 0) return null
                    return (
                      <Card className="bg-card border-border">
                        <CardHeader className="border-b border-border">
                          <CardTitle className="flex items-center gap-2 text-foreground">
                            <DollarSign className="w-5 h-5 text-yellow-500" />
                            Product Prices
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {prices.map((price) => (
                              <div key={price.String} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30">
                                <span className="text-sm">{humanize(price.String)}</span>
                                <Badge variant="outline" className="font-mono text-xs">
                                  ${price.Int}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })()}

                  {/* Quests summary */}
                  {(() => {
                    const questsObj = saveData.quests as { Quests?: Array<{ Title: string; State: number }> }
                    if (!questsObj.Quests || questsObj.Quests.length === 0) return null
                    return (
                      <Card className="bg-card border-border">
                        <CardHeader className="border-b border-border">
                          <CardTitle className="flex items-center gap-2 text-foreground">
                            <Star className="w-5 h-5 text-purple-500" />
                            Quests ({questsObj.Quests.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="space-y-1">
                            {questsObj.Quests.map((quest, idx) => (
                              <div key={idx} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50">
                                <span className="text-sm">{quest.Title || `Quest ${idx + 1}`}</span>
                                <Badge variant={quest.State === 2 ? "default" : "secondary"} className="text-xs">
                                  {quest.State === 0 ? "Inactive" : quest.State === 1 ? "Active" : quest.State === 2 ? "Complete" : `State ${quest.State}`}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })()}
                </TabsContent>

                {/* ── Raw JSON Tab ────────────────────────────────── */}
                <TabsContent value="raw" className="space-y-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Code className="w-5 h-5" />
                        Raw JSON Editor
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <JsonTreeEditor
                        data={{
                          money: saveData.money,
                          rank: saveData.rank,
                          game: saveData.game,
                          time: saveData.time,
                          law: saveData.law,
                          sewer: saveData.sewer,
                          products: saveData.products,
                          properties: saveData.properties,
                          businesses: saveData.businesses,
                          players: saveData.players,
                          npcs: saveData.npcs,
                          quests: saveData.quests,
                          cartel: saveData.cartel,
                          variables: saveData.variables,
                        }}
                        onChange={(updated: Record<string, unknown>) => {
                          setSaveData({
                            ...saveData,
                            ...updated,
                          } as Schedule1Save)
                        }}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg text-sm">
                <span className="text-muted-foreground">
                  Organisation: <span className="text-foreground font-medium">{orgName ?? "Unknown"}</span>
                </span>
                <span className="text-muted-foreground">
                  Version: <span className="text-foreground font-medium">{gameVersion ?? "?"}</span>
                  {" | "}
                  Folder: <span className="text-foreground font-medium">{folderName}</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
