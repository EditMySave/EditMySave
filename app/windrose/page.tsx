"use client"

import { useState, useRef } from "react"
import {
  User,
  Package,
  Anchor,
  Globe,
  Code,
  ArrowLeft,
  Swords,
  Heart,
  Shield,
  Crosshair,
  Sparkles,
  Zap,
  BookOpen,
  Trash2,
  MapPin,
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { downloadJSON } from "@/lib/download-json"
import Link from "next/link"
import { track } from "@vercel/analytics"
import { SaveLocationHelp } from "@/components/save-location-help"
import { SaveFolderUpload } from "@/components/save-folder-upload"
import { EditorSidebar } from "@/components/editor-sidebar"
import gamesData from "@/data/games.json"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JsonTreeEditor } from "@/components/json-tree-editor"
import {
  type WindroseSave,
  type OriginalBytesMap,
  decodeSaveFromFiles,
  encodeSaveToBlob,
} from "@/lib/windrose/decoder"
import {
  setPlayerName,
  setPlayerStat,
  setAllStatsMax,
  setRewardLevel,
  setShipHealth,
  setAllShipsFullHealth,
  setInventoryItemCount,
  setInventoryItem,
  clearInventorySlot,
  setRecipeState,
  unlockAllRecipes,
  finishAllRecipes,
  setItemLevel,
  getStorageBlocks,
  clearAllDroppedItems,
  teleportDropsToPlayer,
  teleportDeathBagsToPlayer,
  getRecipeCategories,
  getRecipeDisplayName,
  getCategoryDisplayName,
} from "./save-mutations"
import { itemCatalog, getItemDisplayName } from "@/lib/windrose/item-catalog"

// --- Helpers ---

const STAT_ICONS = [
  <Swords key="str" className="w-4 h-4" />,
  <Zap key="agi" className="w-4 h-4" />,
  <Crosshair key="pre" className="w-4 h-4" />,
  <Sparkles key="mas" className="w-4 h-4" />,
  <Heart key="vit" className="w-4 h-4" />,
  <Shield key="end" className="w-4 h-4" />,
]

const STAT_NAMES = ["Strength", "Agility", "Precision", "Mastery", "Vitality", "Endurance"]

const MODULE_NAMES: Record<number, string> = {
  0: "Main Bag",
  1: "Ammo",
  2: "Armor",
  3: "Weapons & Tools",
  4: "Accessories",
  5: "Documents",
  6: "Documents 2",
  7: "Quest Items",
  8: "Ship Customizations",
  9: "NPC",
}

const SHIP_MODULE_NAMES: Record<number, string> = {
  0: "Cargo",
  1: "Equipment",
  2: "Supplies",
  3: "Customizations",
}

const LEVELABLE_PREFIXES = [
  "EID_Armor_", "EID_MeleeWeapon_", "EID_RangeWeapon_",
  "EID_Cannon_", "EID_Ship_Hull_", "EID_Ship_Bracing_", "EID_Ship_Boarding_",
  "EID_Tool_",
]

function isLevelableItem(itemParams: string): boolean {
  if (!itemParams) return false
  const fileName = itemParams.split("/").pop()?.split(".")[0] ?? ""
  return LEVELABLE_PREFIXES.some((p) => fileName.includes(p))
}

function getShipDisplayName(shipValue: Record<string, unknown>): string {
  const name = shipValue.ShipName as { Key?: string } | string | undefined
  if (typeof name === "string") return name
  if (name?.Key) {
    return name.Key.replace("Ship_", "").replace("Default_Name", "").replace(/_/g, " ")
  }
  const params = shipValue.ShipParams as string | undefined
  if (params) {
    return params.split("/").pop()?.split(".")[0]?.replace("DA_Ship_", "") ?? "Ship"
  }
  return "Ship"
}

function countFilledSlots(modules: Array<Record<string, unknown>>): number {
  let count = 0
  for (const mod of modules) {
    const slots = (mod.Slots ?? []) as Array<Record<string, unknown>>
    for (const slot of slots) {
      const stack = slot.ItemsStack as Record<string, unknown> | undefined
      const item = stack?.Item as Record<string, unknown> | undefined
      if (item?.ItemId && (item.ItemId as string).length > 0) count++
    }
  }
  return count
}

// --- Item Selector ---

function ItemSelector({
  onSelect,
  onClose,
}: {
  onSelect: (itemParams: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const filtered = search.length < 2
    ? []
    : itemCatalog.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.id.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 50)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-lg max-h-[70vh] flex flex-col">
        <div className="p-4 border-b border-zinc-700 flex items-center gap-2">
          <Search className="w-4 h-4 text-zinc-400" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="overflow-y-auto p-2 flex-1">
          {search.length < 2 ? (
            <p className="text-zinc-500 text-sm p-4 text-center">Type at least 2 characters to search...</p>
          ) : filtered.length === 0 ? (
            <p className="text-zinc-500 text-sm p-4 text-center">No items found</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                className="w-full text-left px-3 py-2 rounded hover:bg-zinc-800 flex flex-col gap-0.5"
                onClick={() => {
                  onSelect(item.itemParams)
                  onClose()
                }}
              >
                <span className="text-sm font-medium text-zinc-200">{item.name}</span>
                <span className="text-xs text-zinc-500">{item.id}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// --- Inventory Module ---

function InventoryModule({
  moduleName,
  slots,
  onChangeCount,
  onSetItem,
  onClear,
  onChangeLevel,
}: {
  moduleName: string
  slots: Array<{
    slotId: number
    itemParams: string
    itemId: string
    count: number
    level: number | null
    maxLevel: number
  }>
  onChangeCount: (slotId: number, count: number) => void
  onSetItem: (slotId: number, itemParams: string, count: number) => void
  onClear: (slotId: number) => void
  onChangeLevel?: (slotId: number, level: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [selectorSlot, setSelectorSlot] = useState<number | null>(null)
  const filledCount = slots.filter((s) => s.itemId).length

  return (
    <div className="border border-zinc-800 rounded-lg">
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/50 rounded-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-medium text-sm">{moduleName}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {filledCount}/{slots.length}
        </Badge>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-1">
          {slots.map((slot) => (
            <div
              key={slot.slotId}
              className="flex items-center gap-2 py-1.5 px-2 rounded bg-zinc-900/50 text-sm"
            >
              <span className="text-zinc-500 w-6 text-right shrink-0">#{slot.slotId}</span>
              {slot.itemId ? (
                <>
                  <span className="flex-1 truncate text-zinc-300" title={slot.itemParams}>
                    {getItemDisplayName(slot.itemParams)}
                  </span>
                  {slot.level !== null && onChangeLevel && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-zinc-500">Lv</span>
                      <Input
                        type="number"
                        value={slot.level}
                        onChange={(e) => onChangeLevel(slot.slotId, parseInt(e.target.value) || 1)}
                        className="w-14 h-7 text-xs"
                        min={1}
                        max={slot.maxLevel}
                      />
                    </div>
                  )}
                  <Input
                    type="number"
                    value={slot.count}
                    onChange={(e) => onChangeCount(slot.slotId, parseInt(e.target.value) || 0)}
                    className="w-20 h-7 text-xs"
                    min={0}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                    onClick={() => onClear(slot.slotId)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-zinc-600 italic">Empty</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectorSlot(slot.slotId)}
                  >
                    Add Item
                  </Button>
                </>
              )}
            </div>
          ))}
          {selectorSlot !== null && (
            <ItemSelector
              onSelect={(itemParams) => onSetItem(selectorSlot, itemParams, 1)}
              onClose={() => setSelectorSlot(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// --- Recipe Category ---

function RecipeCategory({
  category,
  recipes,
  unlockedSet,
  finishedSet,
  onSetState,
}: {
  category: string
  recipes: string[]
  unlockedSet: Set<string>
  finishedSet: Set<string>
  onSetState: (recipe: string, state: "locked" | "unlocked" | "finished") => void
}) {
  const [expanded, setExpanded] = useState(false)
  const finishedCount = recipes.filter((r) => finishedSet.has(r)).length
  const unlockedCount = recipes.filter((r) => unlockedSet.has(r) && !finishedSet.has(r)).length

  return (
    <div className="border border-zinc-800 rounded-lg">
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/50 rounded-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-medium text-sm">{getCategoryDisplayName(category)}</span>
        </div>
        <div className="flex gap-1">
          <Badge variant="secondary" className="text-xs">{finishedCount} done</Badge>
          <Badge variant="outline" className="text-xs">{unlockedCount} avail</Badge>
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-1">
          {recipes.map((recipe) => {
            const isFinished = finishedSet.has(recipe)
            const isUnlocked = unlockedSet.has(recipe)
            const state = isFinished ? "finished" : isUnlocked ? "unlocked" : "locked"
            return (
              <div
                key={recipe}
                className="flex items-center justify-between py-1.5 px-2 rounded bg-zinc-900/50 text-sm"
              >
                <span className="flex-1 truncate text-zinc-300 text-xs" title={recipe}>
                  {getRecipeDisplayName(recipe)}
                </span>
                <select
                  value={state}
                  onChange={(e) => onSetState(recipe, e.target.value as "locked" | "unlocked" | "finished")}
                  className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
                >
                  <option value="locked">Locked</option>
                  <option value="unlocked">Available</option>
                  <option value="finished">Finished</option>
                </select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Main Component ---

export default function WindroseSaveEditor() {
  const [saveData, setSaveData] = useState<WindroseSave | null>(null)
  const originalFilesRef = useRef<FileList | null>(null)
  const originalBytesRef = useRef<{ accounts: OriginalBytesMap; players: OriginalBytesMap; worlds: OriginalBytesMap } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const gameInfo = gamesData.games.find((g) => g.id === "windrose")

  const processSaveFolder = async (files: FileList) => {
    setIsProcessing(true)
    try {
      const decoded = await decodeSaveFromFiles(files)
      setSaveData(decoded.save)
      originalFilesRef.current = files
      originalBytesRef.current = decoded.originalBytes
      track("file_uploaded", {
        game: "Windrose",
        fileSize: Array.from(files).reduce((sum, f) => sum + f.size, 0),
        fileName: decoded.save.meta.folderName,
      })
    } catch (error) {
      console.error("Error processing save folder:", error)
      alert("Failed to process save folder. Please ensure it is a valid Windrose save directory containing a RocksDB folder.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = async () => {
    if (!saveData || !originalFilesRef.current) return
    setIsProcessing(true)
    try {
      const blob = await encodeSaveToBlob(saveData, originalFilesRef.current, originalBytesRef.current ?? undefined)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${saveData.meta.folderName}-edited.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      track("file_downloaded", { game: "Windrose", fileName: `${saveData.meta.folderName}-edited.zip` })
    } catch (error) {
      console.error("Error encoding save:", error)
      alert("Failed to create edited save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  // Extract data from save
  const player = saveData?.databases.players["R5BLPlayer"]?.[0]?.value
  const playerName = (player?.PlayerName as string) ?? ""
  const playerMeta = player?.PlayerMetadata as Record<string, unknown> | undefined
  const progression = playerMeta?.PlayerProgression as Record<string, unknown> | undefined
  const statTree = progression?.StatTree as Record<string, unknown> | undefined
  const statNodes = (statTree?.Nodes ?? []) as Array<Record<string, unknown>>
  const rewardLevel = (progression?.RewardLevel as number) ?? 0
  const ships = saveData?.databases.players["R5BLShip"] ?? []
  const playerInv = player?.Inventory as Record<string, unknown> | undefined
  const playerModules = (playerInv?.Modules ?? []) as Array<Record<string, unknown>>
  const unlockedRecipes = (playerMeta?.UnlockedRecipes ?? []) as Array<{ Recipe: { RecipeData: string } }>
  const finishedRecipes = (playerMeta?.FinishedRecipes ?? []) as Array<{ Recipe: { RecipeData: string } }>
  const unlockedSet = new Set(unlockedRecipes.map((r) => r.Recipe.RecipeData))
  const finishedSet = new Set(finishedRecipes.map((r) => r.Recipe.RecipeData))
  const drops = saveData?.databases.worlds["R5BLActor_Drop"] ?? []
  const deathBags = (saveData?.databases.worlds["R5BLIslandChest"] ?? []).filter(
    (c) => (c.value.ChestClass as string | undefined)?.includes("PosthumousContainer"),
  )
  const storageBlocks = saveData ? getStorageBlocks(saveData) : []

  const totalItems = playerModules.length > 0 ? countFilledSlots(playerModules) : 0

  const quickStats = saveData
    ? [
        { label: "Player", value: playerName || "Unknown", icon: <User className="w-4 h-4 text-blue-400" /> },
        { label: "Version", value: saveData.meta.gameVersion, icon: <Code className="w-4 h-4 text-zinc-400" /> },
        { label: "Ships", value: String(ships.length), icon: <Anchor className="w-4 h-4 text-cyan-400" /> },
        { label: "Items", value: String(totalItems), icon: <Package className="w-4 h-4 text-amber-400" /> },
      ]
    : []

  const quickActions = saveData
    ? [
        {
          label: "Max All Stats",
          onClick: () => setSaveData(setAllStatsMax(saveData)),
          icon: <Sparkles className="w-4 h-4 text-yellow-400" />,
        },
        {
          label: "Full Ship Health",
          onClick: () => setSaveData(setAllShipsFullHealth(saveData)),
          icon: <Heart className="w-4 h-4 text-red-400" />,
        },
        {
          label: "Unlock All Recipes",
          onClick: () => setSaveData(unlockAllRecipes(saveData)),
          icon: <BookOpen className="w-4 h-4 text-purple-400" />,
        },
        {
          label: "Finish All Recipes",
          onClick: () => setSaveData(finishAllRecipes(saveData)),
          icon: <BookOpen className="w-4 h-4 text-green-400" />,
        },
        {
          label: "Teleport Drops to Player",
          onClick: () => setSaveData(teleportDropsToPlayer(saveData)),
          icon: <MapPin className="w-4 h-4 text-blue-400" />,
        },
        {
          label: "Teleport Death Bag to Player",
          onClick: () => setSaveData(teleportDeathBagsToPlayer(saveData)),
          icon: <MapPin className="w-4 h-4 text-rose-400" />,
        },
        {
          label: "Clear All Drops",
          onClick: () => setSaveData(clearAllDroppedItems(saveData)),
          icon: <Trash2 className="w-4 h-4 text-red-400" />,
        },
        {
          label: "Download JSON",
          onClick: () => downloadJSON(saveData.databases, `${saveData.meta.folderName}-decoded.json`),
          icon: <Code className="w-4 h-4 text-zinc-400" />,
        },
      ]
    : []

  return (
    <main className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Anchor className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Windrose</h1>
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
              <h2 className="text-3xl font-bold text-foreground">Windrose Save Editor</h2>
              <p className="text-muted-foreground">Edit player stats, inventory, ships, recipes, and world data</p>
            </div>
            {gameInfo && <SaveLocationHelp platforms={gameInfo.platforms as any} gameName={gameInfo.name} />}
            <SaveFolderUpload onFolderSelect={processSaveFolder} isProcessing={isProcessing} />
          </div>
        ) : (
          <div className="flex gap-6 pt-4">
            {/* Sidebar */}
            <EditorSidebar
              onDownload={handleDownload}
              onLoadNew={() => {
                setSaveData(null)
                originalFilesRef.current = null
                originalBytesRef.current = null
              }}
              isProcessing={isProcessing}
              hasSaveData={!!saveData}
              fileName={saveData.meta.folderName}
              quickStats={quickStats}
              quickActions={quickActions}
            />

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <Tabs defaultValue="player">
                <TabsList className="mb-4">
                  <TabsTrigger value="player" className="gap-1.5">
                    <User className="w-4 h-4" /> Player
                  </TabsTrigger>
                  <TabsTrigger value="inventory" className="gap-1.5">
                    <Package className="w-4 h-4" /> Inventory
                  </TabsTrigger>
                  <TabsTrigger value="ships" className="gap-1.5">
                    <Anchor className="w-4 h-4" /> Ships
                  </TabsTrigger>
                  <TabsTrigger value="world" className="gap-1.5">
                    <Globe className="w-4 h-4" /> World
                  </TabsTrigger>
                  <TabsTrigger value="json" className="gap-1.5">
                    <Code className="w-4 h-4" /> Raw JSON
                  </TabsTrigger>
                </TabsList>

                {/* Player Tab */}
                <TabsContent value="player" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Player Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="playerName">Player Name</Label>
                        <Input
                          id="playerName"
                          value={playerName}
                          onChange={(e) => setSaveData(setPlayerName(saveData, e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rewardLevel">Reward Level</Label>
                        <Input
                          id="rewardLevel"
                          type="number"
                          value={rewardLevel}
                          onChange={(e) => setSaveData(setRewardLevel(saveData, parseInt(e.target.value) || 0))}
                          min={0}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base">Stats</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSaveData(setAllStatsMax(saveData))}
                      >
                        <Sparkles className="w-3 h-3 mr-1" /> Max All
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {statNodes.map((node, i) => {
                        const level = (node.NodeLevel as number) ?? 0
                        const maxLevel = (node.NodeData as Record<string, unknown> | undefined)?.MaxNodeLevel as number ?? 60
                        return (
                          <div key={i} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {STAT_ICONS[i]}
                                <Label className="text-sm">{STAT_NAMES[i] ?? `Stat ${i + 1}`}</Label>
                              </div>
                              <span className="text-sm font-mono text-zinc-400">{level}/{maxLevel}</span>
                            </div>
                            <Slider
                              value={[level]}
                              min={0}
                              max={maxLevel}
                              step={1}
                              onValueChange={([v]) => setSaveData(setPlayerStat(saveData, i, v))}
                            />
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base">Recipes</CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSaveData(unlockAllRecipes(saveData))}
                        >
                          Unlock All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSaveData(finishAllRecipes(saveData))}
                        >
                          Finish All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-zinc-400 mb-3">
                        {unlockedRecipes.length} available, {finishedRecipes.length} finished
                      </p>
                      {Object.entries(getRecipeCategories()).map(([category, recipes]) => (
                        <RecipeCategory
                          key={category}
                          category={category}
                          recipes={recipes}
                          unlockedSet={unlockedSet}
                          finishedSet={finishedSet}
                          onSetState={(recipe, state) =>
                            setSaveData(setRecipeState(saveData, recipe, state))
                          }
                        />
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Inventory Tab */}
                <TabsContent value="inventory" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Player Inventory</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {playerModules.map((mod, moduleIdx) => {
                        const slots = (mod.Slots ?? []) as Array<Record<string, unknown>>
                        const mappedSlots = slots.map((slot) => {
                          const stack = slot.ItemsStack as Record<string, unknown>
                          const item = stack.Item as Record<string, unknown>
                          const attrs = (item.Attributes ?? []) as Array<Record<string, unknown>>
                          const levelAttr = attrs.find(a => (a.Tag as Record<string, unknown>)?.TagName === "Inventory.Item.Attribute.Level")
                          const params = (item.ItemParams as string) ?? ""
                          const levelable = levelAttr || isLevelableItem(params)
                          return {
                            slotId: slot.SlotId as number,
                            itemParams: params,
                            itemId: (item.ItemId as string) ?? "",
                            count: (stack.Count as number) ?? 0,
                            level: levelable ? ((levelAttr?.Value as number) ?? 1) : null,
                            maxLevel: levelAttr ? ((levelAttr.MaxValue as number) ?? 15) : 15,
                          }
                        })
                        if (mappedSlots.length === 0) return null
                        return (
                          <InventoryModule
                            key={moduleIdx}
                            moduleName={MODULE_NAMES[moduleIdx] ?? `Module ${moduleIdx}`}
                            slots={mappedSlots}
                            onChangeCount={(slotId, count) =>
                              setSaveData(setInventoryItemCount(saveData, "player", 0, moduleIdx, slotId, count))
                            }
                            onSetItem={(slotId, itemParams, count) =>
                              setSaveData(setInventoryItem(saveData, "player", 0, moduleIdx, slotId, itemParams, count))
                            }
                            onClear={(slotId) =>
                              setSaveData(clearInventorySlot(saveData, "player", 0, moduleIdx, slotId))
                            }
                            onChangeLevel={(slotId, level) =>
                              setSaveData(setItemLevel(saveData, "player", 0, moduleIdx, slotId, level))
                            }
                          />
                        )
                      })}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Ships Tab */}
                <TabsContent value="ships" className="space-y-4">
                  {ships.map((ship, shipIdx) => {
                    const shipVal = ship.value
                    const attrs = shipVal.Attributes as Record<string, unknown> | undefined
                    const health = (attrs?.HealthPercent as number) ?? 0
                    const shipInv = shipVal.Inventory as Record<string, unknown> | undefined
                    const shipModules = (shipInv?.Modules ?? []) as Array<Record<string, unknown>>

                    return (
                      <Card key={ship.key}>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Anchor className="w-4 h-4" />
                            {getShipDisplayName(shipVal)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm flex items-center gap-2">
                                <Heart className="w-4 h-4 text-red-400" /> Health
                              </Label>
                              <span className="text-sm font-mono text-zinc-400">
                                {(health * 100).toFixed(0)}%
                              </span>
                            </div>
                            <Slider
                              value={[health * 100]}
                              min={0}
                              max={100}
                              step={1}
                              onValueChange={([v]) => setSaveData(setShipHealth(saveData, shipIdx, v / 100))}
                            />
                          </div>

                          {shipModules.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-zinc-800">
                              <h4 className="text-sm font-medium text-zinc-400">Ship Inventory</h4>
                              {shipModules.map((mod, moduleIdx) => {
                                const slots = (mod.Slots ?? []) as Array<Record<string, unknown>>
                                const mappedSlots = slots.map((slot) => {
                                  const stack = slot.ItemsStack as Record<string, unknown>
                                  const item = stack.Item as Record<string, unknown>
                                  const attrs = (item.Attributes ?? []) as Array<Record<string, unknown>>
                                  const levelAttr = attrs.find(a => (a.Tag as Record<string, unknown>)?.TagName === "Inventory.Item.Attribute.Level")
                                  return {
                                    slotId: slot.SlotId as number,
                                    itemParams: (item.ItemParams as string) ?? "",
                                    itemId: (item.ItemId as string) ?? "",
                                    count: (stack.Count as number) ?? 0,
                                    level: levelAttr ? (levelAttr.Value as number) : null,
                                    maxLevel: levelAttr ? ((levelAttr.MaxValue as number) ?? 15) : 15,
                                  }
                                })
                                if (mappedSlots.length === 0) return null
                                return (
                                  <InventoryModule
                                    key={moduleIdx}
                                    moduleName={SHIP_MODULE_NAMES[moduleIdx] ?? `Module ${moduleIdx}`}
                                    slots={mappedSlots}
                                    onChangeCount={(slotId, count) =>
                                      setSaveData(setInventoryItemCount(saveData, "ship", shipIdx, moduleIdx, slotId, count))
                                    }
                                    onSetItem={(slotId, itemParams, count) =>
                                      setSaveData(setInventoryItem(saveData, "ship", shipIdx, moduleIdx, slotId, itemParams, count))
                                    }
                                    onClear={(slotId) =>
                                      setSaveData(clearInventorySlot(saveData, "ship", shipIdx, moduleIdx, slotId))
                                    }
                                    onChangeLevel={(slotId, level) =>
                                      setSaveData(setItemLevel(saveData, "ship", shipIdx, moduleIdx, slotId, level))
                                    }
                                  />
                                )
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </TabsContent>

                {/* World Tab */}
                <TabsContent value="world" className="space-y-4">
                  {/* Dropped Items */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base">Dropped Items ({drops.length})</CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSaveData(teleportDropsToPlayer(saveData))}
                        >
                          <MapPin className="w-3 h-3 mr-1" /> Teleport to Player
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSaveData(clearAllDroppedItems(saveData))}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Clear All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {drops.length === 0 ? (
                        <p className="text-sm text-zinc-500">No dropped items in the world.</p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {drops.slice(0, 100).map((drop, i) => {
                            const stack = drop.value.ItemsStack as Record<string, unknown> | undefined
                            const item = stack?.Item as Record<string, unknown> | undefined
                            const params = (item?.ItemParams as string) ?? ""
                            const count = (stack?.Count as number) ?? 0
                            const loc = drop.value.WorldLocation as { X: number; Y: number; Z: number } | undefined
                            return (
                              <div
                                key={i}
                                className="flex items-center gap-2 py-1.5 px-2 rounded bg-zinc-900/50 text-xs"
                              >
                                <span className="flex-1 truncate text-zinc-300">
                                  {getItemDisplayName(params)}
                                </span>
                                <span className="text-zinc-500">x{count}</span>
                                {loc && (
                                  <span className="text-zinc-600 text-[10px]">
                                    ({loc.X.toFixed(0)}, {loc.Y.toFixed(0)})
                                  </span>
                                )}
                              </div>
                            )
                          })}
                          {drops.length > 100 && (
                            <p className="text-xs text-zinc-600 pt-2">...and {drops.length - 100} more</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Death Bags */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base">Death Bags ({deathBags.length})</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={deathBags.length === 0}
                        onClick={() => setSaveData(teleportDeathBagsToPlayer(saveData))}
                      >
                        <MapPin className="w-3 h-3 mr-1" /> Teleport to Player
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {deathBags.length === 0 ? (
                        <p className="text-sm text-zinc-500">No death bags in the world.</p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {deathBags.map((bag, i) => {
                            const loc = bag.value.WorldLocation as { X: number; Y: number; Z: number } | undefined
                            const inv = bag.value.Inventory as Record<string, unknown> | undefined
                            const modules = (inv?.Modules ?? []) as Array<Record<string, unknown>>
                            const filledCount = modules.reduce((sum, m) => {
                              const slots = (m.Slots ?? []) as Array<Record<string, unknown>>
                              return sum + slots.filter((s) => {
                                const stack = s.ItemsStack as Record<string, unknown> | undefined
                                const item = stack?.Item as Record<string, unknown> | undefined
                                return Boolean(item?.ItemId)
                              }).length
                            }, 0)
                            return (
                              <div
                                key={i}
                                className="flex items-center gap-2 py-1.5 px-2 rounded bg-zinc-900/50 text-xs"
                              >
                                <span className="flex-1 truncate text-zinc-300">Death Bag #{i + 1}</span>
                                <span className="text-zinc-500">{filledCount} item{filledCount === 1 ? "" : "s"}</span>
                                {loc && (
                                  <span className="text-zinc-600 text-[10px]">
                                    ({loc.X.toFixed(0)}, {loc.Y.toFixed(0)})
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Storage Chests */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Storage Chests ({storageBlocks.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {storageBlocks.length === 0 ? (
                        <p className="text-sm text-zinc-500">No storage chests placed.</p>
                      ) : (
                        storageBlocks.map((block, blockIdx) => {
                          const inv = block.value.Inventory as Record<string, unknown> | undefined
                          const modules = (inv?.Modules ?? []) as Array<Record<string, unknown>>
                          const filledCount = modules.reduce((sum, m) => {
                            const slots = (m.Slots ?? []) as Array<Record<string, unknown>>
                            return sum + slots.filter(s => (s.ItemsStack as Record<string, unknown>)?.Item && ((s.ItemsStack as Record<string, unknown>).Item as Record<string, unknown>).ItemId).length
                          }, 0)
                          const totalSlots = modules.reduce((sum, m) => sum + ((m.Slots ?? []) as unknown[]).length, 0)

                          return (
                            <div key={block.key}>
                              {modules.map((mod, moduleIdx) => {
                                const slots = (mod.Slots ?? []) as Array<Record<string, unknown>>
                                const mappedSlots = slots.map((slot) => {
                                  const stack = slot.ItemsStack as Record<string, unknown>
                                  const item = stack.Item as Record<string, unknown>
                                  const attrs = (item.Attributes ?? []) as Array<Record<string, unknown>>
                                  const levelAttr = attrs.find(a => (a.Tag as Record<string, unknown>)?.TagName === "Inventory.Item.Attribute.Level")
                                  return {
                                    slotId: slot.SlotId as number,
                                    itemParams: (item.ItemParams as string) ?? "",
                                    itemId: (item.ItemId as string) ?? "",
                                    count: (stack.Count as number) ?? 0,
                                    level: levelAttr ? (levelAttr.Value as number) : null,
                                    maxLevel: levelAttr ? ((levelAttr.MaxValue as number) ?? 15) : 15,
                                  }
                                })
                                if (mappedSlots.length === 0) return null
                                return (
                                  <InventoryModule
                                    key={moduleIdx}
                                    moduleName={`Storage Chest #${blockIdx + 1} (${filledCount}/${totalSlots})`}
                                    slots={mappedSlots}
                                    onChangeCount={(slotId, count) =>
                                      setSaveData(setInventoryItemCount(saveData, "storage", blockIdx, moduleIdx, slotId, count))
                                    }
                                    onSetItem={(slotId, itemParams, count) =>
                                      setSaveData(setInventoryItem(saveData, "storage", blockIdx, moduleIdx, slotId, itemParams, count))
                                    }
                                    onClear={(slotId) =>
                                      setSaveData(clearInventorySlot(saveData, "storage", blockIdx, moduleIdx, slotId))
                                    }
                                    onChangeLevel={(slotId, level) =>
                                      setSaveData(setItemLevel(saveData, "storage", blockIdx, moduleIdx, slotId, level))
                                    }
                                  />
                                )
                              })}
                            </div>
                          )
                        })
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Raw JSON Tab */}
                <TabsContent value="json">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Raw JSON Editor</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <JsonTreeEditor
                        data={saveData.databases}
                        onChange={(newData) => {
                          setSaveData({
                            ...saveData,
                            databases: newData as WindroseSave["databases"],
                            _modifiedDBs: { accounts: true, players: true, worlds: true },
                          })
                        }}
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
  )
}
