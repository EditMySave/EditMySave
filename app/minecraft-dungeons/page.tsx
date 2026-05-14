"use client"

import { useMemo, useState } from "react"
import {
  Sword,
  ArrowLeft,
  Coins,
  Package,
  User,
  Code,
  Star,
  Box,
  Trash2,
  Plus,
  Copy,
  ArrowLeftRight,
  Sparkles,
  Trophy,
  Skull,
  Filter,
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
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  type MCDSave,
  type Item,
  type Rarity,
  decodeSaveFromFile,
  encodeSaveToBlob,
  levelFromXp,
  xpFromLevel,
  levelFromPower,
  powerFromLevel,
} from "@/lib/minecraft-dungeons/decoder"
import manifestData from "@/data/minecraft-dungeons/manifest.json"
import {
  type ItemLocation,
  setSkin,
  setXp,
  setLevel,
  maxLevel,
  setCustomized,
  setClone,
  setCurrency,
  maxAllCurrencies,
  setUnlockedDifficulty,
  setUnlockedThreatLevel,
  addItem,
  deleteItem,
  duplicateItem,
  transferItem,
  updateItemPower,
  updateItemLevel,
  updateItemRarity,
  updateItemFlag,
  updateItemEquipmentSlot,
  setEnchantment,
  setNetheriteEnchant,
  addArmorProperty,
  removeArmorProperty,
  updateArmorPropertyId,
  updateArmorPropertyRarity,
  maxAllItems,
  setMobKill,
  setProgressCounter,
  maxAllMobKills,
  maxAllCounters,
} from "./save-mutations"

// ── Manifest types ──────────────────────────────────────────────────────

interface ManifestItem {
  id: string
  type: "melee" | "ranged" | "armor" | "artifact"
  rarity: "common" | "unique"
  displayName: string
  description: string
  icon: string
}

interface ManifestEnchantment {
  id: string
  icon: string
  validOn: { melee: boolean; ranged: boolean; armor: boolean }
  powerful: boolean
}

interface ManifestArmorProperty {
  id: string
  displayName: string
  description: string
  hasIcon: boolean
  icon: string | null
}

const manifest = manifestData as {
  items: Record<"melee" | "ranged" | "armor" | "artifact", ManifestItem[]>
  enchantments: ManifestEnchantment[]
  armorProperties: ManifestArmorProperty[]
}

// Build lookup tables once
const ITEM_LOOKUP = new Map<string, ManifestItem>()
for (const type of ["melee", "ranged", "armor", "artifact"] as const) {
  for (const item of manifest.items[type]) {
    ITEM_LOOKUP.set(item.id, item)
  }
}

const ENCHANTMENT_LOOKUP = new Map<string, ManifestEnchantment>()
for (const e of manifest.enchantments) {
  ENCHANTMENT_LOOKUP.set(e.id, e)
}

const ARMOR_PROPERTY_LOOKUP = new Map<string, ManifestArmorProperty>()
for (const p of manifest.armorProperties) {
  ARMOR_PROPERTY_LOOKUP.set(p.id, p)
}

function getArmorPropertyIcon(id: string): string | null {
  const p = ARMOR_PROPERTY_LOOKUP.get(id)
  return p?.icon ? `/images/minecraft-dungeons/${p.icon}` : null
}

// Localization templates use {0}, {1}, … placeholders the game fills in at
// runtime with per-tier stat values. We don't have those values, so render
// an ellipsis to indicate "value varies" without breaking the sentence.
function formatArmorPropertyDescription(desc: string | undefined): string {
  if (!desc) return ""
  return desc.replace(/\{\d+\}/g, "…")
}

// ── Filter / category helpers ───────────────────────────────────────────

type ItemFilter = "all" | "melee" | "ranged" | "armor" | "artifact" | "enchanted"

function inferItemCategory(typeId: string): "melee" | "ranged" | "armor" | "artifact" | null {
  return ITEM_LOOKUP.get(typeId)?.type ?? null
}

function getItemIcon(typeId: string): string | null {
  const m = ITEM_LOOKUP.get(typeId)
  return m ? `/images/minecraft-dungeons/${m.icon}` : null
}

function getEnchantmentIcon(id: string): string | null {
  const e = ENCHANTMENT_LOOKUP.get(id)
  return e ? `/images/minecraft-dungeons/${e.icon}` : null
}

function humanize(name: string): string {
  return name.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")
}

// ── Rarity inference & coloring ─────────────────────────────────────────
// The save file's `rarity` field is unreliable (most items show "Common" even
// when they're actually unique/legendary). The original editor infers rarity
// from the item ID suffix (e.g. _Unique1, _Spooky, _Year). Our manifest already
// does this inference and stores rarity as "common" or "unique".

type DisplayRarity = "common" | "rare" | "unique"

function getDisplayRarity(item: Item): DisplayRarity {
  const m = ITEM_LOOKUP.get(item.type)
  if (m) return m.rarity as DisplayRarity
  // Fallback: pattern match the ID
  const id = item.type.toLowerCase()
  if (id.includes("unique") || id.includes("spooky") || id.includes("year")) return "unique"
  // Last resort: trust save file
  if (item.rarity === "Unique") return "unique"
  if (item.rarity === "Rare") return "rare"
  return "common"
}

// An item is "Gilded" when it has a Netherite Enchantment. Mirrors the
// gildedImage overlay in ItemControl.xaml — the original editor uses a gold
// plate overlay (Inventory_slot_gilded_plate) to mark gilded items.
function isGilded(item: Item): boolean {
  const ne = item.netheriteEnchant
  return !!ne && ne.id !== "Unset" && ne.id !== ""
}

// Tailwind class for the gilded "gold plate" inset overlay
const GILDED_OVERLAY = "shadow-[inset_0_0_0_2px_rgba(250,204,21,0.8),0_0_8px_rgba(250,204,21,0.4)]"

// Tailwind classes for rarity borders + glow (matches MCD's standard color scheme)
const RARITY_BORDER: Record<DisplayRarity, string> = {
  common: "border-slate-500/40",
  rare: "border-green-500",
  unique: "border-orange-500",
}
const RARITY_GLOW: Record<DisplayRarity, string> = {
  common: "",
  rare: "shadow-[0_0_8px_rgba(34,197,94,0.4)]",
  unique: "shadow-[0_0_12px_rgba(249,115,22,0.55)]",
}
const RARITY_BG: Record<DisplayRarity, string> = {
  common: "bg-slate-900/40",
  rare: "bg-green-950/30",
  unique: "bg-orange-950/30",
}
const RARITY_TEXT: Record<DisplayRarity, string> = {
  common: "text-slate-300",
  rare: "text-green-400",
  unique: "text-orange-400",
}

const RARITY_OPTIONS: Rarity[] = ["Common", "Rare", "Unique"]
const EQUIPMENT_SLOTS = [
  { value: "none", label: "(none)" },
  { value: "MeleeGear", label: "Melee" },
  { value: "ArmorGear", label: "Armor" },
  { value: "RangedGear", label: "Ranged" },
  { value: "HotbarSlot1", label: "Hotbar 1" },
  { value: "HotbarSlot2", label: "Hotbar 2" },
  { value: "HotbarSlot3", label: "Hotbar 3" },
]
const DIFFICULTIES = [
  { value: "Difficulty_1", label: "Default" },
  { value: "Difficulty_2", label: "Adventure" },
  { value: "Difficulty_3", label: "Apocalypse" },
]
const CURRENCY_DEFS = [
  { type: "Emerald", label: "Emeralds", color: "text-emerald-500" },
  { type: "Gold", label: "Gold", color: "text-yellow-500" },
  { type: "EyeOfEnder", label: "Eyes of Ender", color: "text-purple-400" },
]

// ── Component ───────────────────────────────────────────────────────────

export default function MinecraftDungeonsSaveEditor() {
  const [saveData, setSaveData] = useState<MCDSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Selection state
  const [selectedInventoryIdx, setSelectedInventoryIdx] = useState<number | null>(null)
  const [selectedStorageIdx, setSelectedStorageIdx] = useState<number | null>(null)
  const [inventoryFilter, setInventoryFilter] = useState<ItemFilter>("all")
  const [storageFilter, setStorageFilter] = useState<ItemFilter>("all")
  const [addItemCategory, setAddItemCategory] = useState<"melee" | "ranged" | "armor" | "artifact">("melee")
  const [inventorySubTab, setInventorySubTab] = useState<"character" | "equipped">("character")

  const processSaveFile = async (file: File) => {
    setIsProcessing(true)
    try {
      const decoded = await decodeSaveFromFile(file)
      setSaveData(decoded)
      setOriginalFile(file)
      setSelectedInventoryIdx(null)
      setSelectedStorageIdx(null)
      track("file_uploaded", {
        game: "MinecraftDungeons",
        fileSize: file.size,
        fileName: file.name,
      })
    } catch (error) {
      console.error("Error processing save file:", error)
      alert(`Failed to process save file: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = async () => {
    if (!saveData || !originalFile) return
    setIsProcessing(true)
    try {
      const blob = await encodeSaveToBlob(saveData)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = originalFile.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      track("file_downloaded", { game: "MinecraftDungeons", fileName: originalFile.name })
    } catch (error) {
      console.error("Error encoding save:", error)
      alert("Failed to create edited save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const characterLevel = saveData?.xp != null ? levelFromXp(saveData.xp) : 0

  const quickStats = saveData
    ? [
        { label: "Level", value: String(characterLevel), icon: <Star className="w-4 h-4 text-yellow-400" /> },
        {
          label: "Items",
          value: `${saveData.items?.length ?? 0} / ${saveData.storageChestItems?.length ?? 0}`,
          icon: <Box className="w-4 h-4 text-purple-400" />,
        },
        {
          label: "Gear Power",
          value: String(saveData.totalGearPower ?? 0),
          icon: <Sword className="w-4 h-4 text-red-400" />,
        },
      ]
    : []

  const quickActions = saveData
    ? [
        { label: "Max Level", onClick: () => setSaveData(maxLevel(saveData)), icon: <Star className="w-4 h-4 mr-2" /> },
        { label: "Max All Currencies", onClick: () => setSaveData(maxAllCurrencies(saveData)), icon: <Coins className="w-4 h-4 mr-2" /> },
        { label: "Max All Inventory", onClick: () => setSaveData(maxAllItems(saveData, "items")), icon: <Sparkles className="w-4 h-4 mr-2" /> },
        {
          label: "Download JSON",
          onClick: () => {
            const filename = originalFile?.name.replace(/\.[^/.]+$/, "") || "mcd-save"
            downloadJSON(saveData, filename)
            track("json_downloaded", { game: "MinecraftDungeons", fileName: originalFile?.name })
          },
          icon: <Code className="w-4 h-4 mr-2" />,
        },
      ]
    : []

  const gameData = gamesData.games.find((g) => g.id === "minecraft-dungeons")

  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sword className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Minecraft Dungeons</h1>
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
              <h2 className="text-3xl font-bold text-foreground">Minecraft Dungeons Save Editor</h2>
              <p className="text-muted-foreground">
                Edit items, enchantments, currencies, and character progression
              </p>
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
              lastModified={originalFile ? new Date(originalFile.lastModified) : undefined}
              quickStats={quickStats}
              quickActions={quickActions}
            />

            <div className="flex-1 space-y-4">
              <Tabs defaultValue="stats" className="w-full">
                <TabsList className="grid w-full grid-cols-5 bg-card border border-border">
                  <TabsTrigger value="stats" className="data-[state=active]:bg-muted">
                    <User className="w-4 h-4 mr-2" />
                    Stats
                  </TabsTrigger>
                  <TabsTrigger value="inventory" className="data-[state=active]:bg-muted">
                    <Sword className="w-4 h-4 mr-2" />
                    Inventory
                  </TabsTrigger>
                  <TabsTrigger value="storage" className="data-[state=active]:bg-muted">
                    <Box className="w-4 h-4 mr-2" />
                    Storage
                  </TabsTrigger>
                  <TabsTrigger value="progress" className="data-[state=active]:bg-muted">
                    <Trophy className="w-4 h-4 mr-2" />
                    Progress
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="data-[state=active]:bg-muted">
                    <Code className="w-4 h-4 mr-2" />
                    Raw JSON
                  </TabsTrigger>
                </TabsList>

                {/* ── Stats Tab ────────────────────────────────────── */}
                <TabsContent value="stats" className="space-y-4">
                  {/* Character */}
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-foreground">
                        <User className="w-5 h-5 text-blue-500" />
                        Character
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <Label className="text-muted-foreground">Skin</Label>
                        <Input
                          type="text"
                          value={saveData.skin ?? ""}
                          onChange={(e) => setSaveData(setSkin(saveData, e.target.value))}
                          className="bg-muted border-border text-foreground"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <Label className="text-muted-foreground">Level</Label>
                          <Input
                            type="number"
                            value={characterLevel}
                            onChange={(e) => setSaveData(setLevel(saveData, parseInt(e.target.value) || 1))}
                            min="1"
                            className="font-mono bg-muted border-border text-foreground"
                          />
                        </div>
                        <div>
                          <Label className="text-muted-foreground">XP</Label>
                          <Input
                            type="number"
                            value={saveData.xp ?? 0}
                            onChange={(e) => setSaveData(setXp(saveData, parseInt(e.target.value) || 0))}
                            min="0"
                            className="font-mono bg-muted border-border text-foreground"
                          />
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Total Gear Power</Label>
                          <Input
                            type="number"
                            value={saveData.totalGearPower ?? 0}
                            onChange={(e) =>
                              setSaveData({ ...saveData, totalGearPower: parseInt(e.target.value) || 0 })
                            }
                            min="0"
                            className="font-mono bg-muted border-border text-foreground"
                          />
                        </div>
                      </div>
                      <div className="flex gap-4 mt-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="customized"
                            checked={saveData.customized ?? false}
                            onCheckedChange={(checked) => setSaveData(setCustomized(saveData, !!checked))}
                          />
                          <Label htmlFor="customized" className="cursor-pointer">Customized</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="clone"
                            checked={saveData.clone ?? false}
                            onCheckedChange={(checked) => setSaveData(setClone(saveData, !!checked))}
                          />
                          <Label htmlFor="clone" className="cursor-pointer">Clone</Label>
                        </div>
                      </div>
                      {saveData.creationDate && (
                        <p className="text-xs text-muted-foreground mt-3">Created: {saveData.creationDate}</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Currencies */}
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <Coins className="w-5 h-5 text-yellow-500" />
                          Currencies
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                          onClick={() => setSaveData(maxAllCurrencies(saveData))}
                        >
                          Max All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {CURRENCY_DEFS.map(({ type, label, color }) => {
                          const current = saveData.currency?.find((c) => c.type === type)?.count ?? 0
                          return (
                            <div key={type}>
                              <Label className={`flex items-center gap-2 ${color}`}>
                                <Coins className="w-4 h-4" />
                                {label}
                              </Label>
                              <Input
                                type="number"
                                value={current}
                                onChange={(e) =>
                                  setSaveData(setCurrency(saveData, type, parseInt(e.target.value) || 0))
                                }
                                min="0"
                                className="font-mono bg-muted border-border text-foreground mt-1"
                              />
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Difficulty / Threat */}
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-foreground">
                        <Trophy className="w-5 h-5 text-orange-500" />
                        Difficulty &amp; Threat
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">Unlocked Difficulty</Label>
                          <Select
                            value={saveData.difficulties?.unlocked ?? "Difficulty_1"}
                            onValueChange={(val) => setSaveData(setUnlockedDifficulty(saveData, val))}
                          >
                            <SelectTrigger className="bg-muted border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DIFFICULTIES.map((d) => (
                                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Unlocked Threat Level</Label>
                          <Input
                            type="text"
                            value={saveData.threatLevels?.unlocked ?? ""}
                            onChange={(e) => setSaveData(setUnlockedThreatLevel(saveData, e.target.value))}
                            placeholder="e.g. Threat_25"
                            className="bg-muted border-border text-foreground"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── Inventory Tab ────────────────────────────────── */}
                <TabsContent value="inventory" className="space-y-4">
                  <ItemEditorSection
                    save={saveData}
                    setSave={setSaveData}
                    location="items"
                    selectedIdx={selectedInventoryIdx}
                    setSelectedIdx={setSelectedInventoryIdx}
                    filter={inventoryFilter}
                    setFilter={setInventoryFilter}
                    addCategory={addItemCategory}
                    setAddCategory={setAddItemCategory}
                    title="Inventory"
                    titleIcon={<Sword className="w-5 h-5 text-blue-500" />}
                    inventorySubTab={inventorySubTab}
                    setInventorySubTab={setInventorySubTab}
                  />
                </TabsContent>

                {/* ── Storage Tab ──────────────────────────────────── */}
                <TabsContent value="storage" className="space-y-4">
                  <ItemEditorSection
                    save={saveData}
                    setSave={setSaveData}
                    location="storageChestItems"
                    selectedIdx={selectedStorageIdx}
                    setSelectedIdx={setSelectedStorageIdx}
                    filter={storageFilter}
                    setFilter={setStorageFilter}
                    addCategory={addItemCategory}
                    setAddCategory={setAddItemCategory}
                    title="Storage Chest"
                    titleIcon={<Box className="w-5 h-5 text-purple-500" />}
                  />
                </TabsContent>

                {/* ── Progress Tab ─────────────────────────────────── */}
                <TabsContent value="progress" className="space-y-4">
                  {/* Mob Kills */}
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <Skull className="w-5 h-5 text-red-500" />
                          Mob Kills ({Object.keys(saveData.mob_kills ?? {}).length})
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                          onClick={() => setSaveData(maxAllMobKills(saveData))}
                        >
                          Max All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {Object.keys(saveData.mob_kills ?? {}).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No mob kills recorded.</p>
                      ) : (
                        <ScrollArea className="h-[400px] pr-4">
                          <div className="space-y-1">
                            {Object.entries(saveData.mob_kills ?? {}).map(([mobId, count]) => (
                              <div
                                key={mobId}
                                className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50"
                              >
                                <span className="text-sm font-mono">{humanize(mobId)}</span>
                                <Input
                                  type="number"
                                  value={count}
                                  onChange={(e) => setSaveData(setMobKill(saveData, mobId, parseInt(e.target.value) || 0))}
                                  min="0"
                                  className="w-32 font-mono text-sm bg-muted border-border text-foreground"
                                />
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>

                  {/* Progress Counters */}
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <Trophy className="w-5 h-5 text-yellow-500" />
                          Progress Counters ({Object.keys(saveData.progressStatCounters ?? {}).length})
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                          onClick={() => setSaveData(maxAllCounters(saveData))}
                        >
                          Max All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {Object.keys(saveData.progressStatCounters ?? {}).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No progress counters recorded.</p>
                      ) : (
                        <ScrollArea className="h-[400px] pr-4">
                          <div className="space-y-1">
                            {Object.entries(saveData.progressStatCounters ?? {}).map(([id, value]) => (
                              <div
                                key={id}
                                className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50"
                              >
                                <span className="text-sm font-mono">{humanize(id)}</span>
                                <Input
                                  type="number"
                                  value={value}
                                  onChange={(e) =>
                                    setSaveData(setProgressCounter(saveData, id, parseInt(e.target.value) || 0))
                                  }
                                  min="0"
                                  className="w-32 font-mono text-sm bg-muted border-border text-foreground"
                                />
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── Raw JSON Tab ─────────────────────────────────── */}
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
                        data={saveData as Record<string, unknown>}
                        onChange={(updated: Record<string, unknown>) => setSaveData(updated as MCDSave)}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-end p-3 bg-card border border-border rounded-lg text-sm">
                <span className="text-muted-foreground">
                  Level <span className="text-foreground font-medium">{characterLevel}</span> | File:{" "}
                  <span className="text-foreground font-medium">{originalFile?.name}</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

// ── ItemEditorSection (shared between Inventory and Storage tabs) ──────

interface ItemEditorSectionProps {
  save: MCDSave
  setSave: (s: MCDSave) => void
  location: ItemLocation
  selectedIdx: number | null
  setSelectedIdx: (idx: number | null) => void
  filter: ItemFilter
  setFilter: (f: ItemFilter) => void
  addCategory: "melee" | "ranged" | "armor" | "artifact"
  setAddCategory: (c: "melee" | "ranged" | "armor" | "artifact") => void
  title: string
  titleIcon: React.ReactNode
  // When provided, renders Character Inventory / Equipped Items sub-tabs
  // inside the Card body. Used by the Inventory tab only — Storage doesn't
  // have equipped items.
  inventorySubTab?: "character" | "equipped"
  setInventorySubTab?: (v: "character" | "equipped") => void
}

function ItemEditorSection({
  save,
  setSave,
  location,
  selectedIdx,
  setSelectedIdx,
  filter,
  setFilter,
  addCategory,
  setAddCategory,
  title,
  titleIcon,
  inventorySubTab,
  setInventorySubTab,
}: ItemEditorSectionProps) {
  const showSubTabs = inventorySubTab !== undefined && setInventorySubTab !== undefined
  const items = save[location] ?? []
  const otherLocation: ItemLocation = location === "items" ? "storageChestItems" : "items"

  const filteredIndices = useMemo(() => {
    return items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => {
        if (filter === "all") return true
        if (filter === "enchanted") {
          return (item.enchantments ?? []).some((e) => e.id !== "Unset" && e.id !== "" && e.level > 0)
        }
        const cat = inferItemCategory(item.type)
        return cat === filter
      })
      .map(({ idx }) => idx)
  }, [items, filter])

  const selectedItem = selectedIdx != null ? items[selectedIdx] : null

  const filterButtons: { value: ItemFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "melee", label: "Melee" },
    { value: "ranged", label: "Ranged" },
    { value: "armor", label: "Armor" },
    { value: "artifact", label: "Artifacts" },
    { value: "enchanted", label: "Enchanted" },
  ]

  const characterInventoryBody = (
    <>
      {/* Filter buttons */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
            <Filter className="w-3 h-3 text-muted-foreground mr-1" />
            {filterButtons.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={filter === f.value ? "default" : "outline"}
                className={`h-7 text-xs ${filter === f.value ? "" : "bg-transparent"}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
            {/* Item grid (3 per row, MCD-style tiles with rarity frames) */}
            <ScrollArea className="h-[640px] pr-2 border border-border rounded-md">
              <div className="p-3">
                {filteredIndices.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">No items match the filter.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {filteredIndices.map((idx) => {
                      const item = items[idx]
                      const icon = getItemIcon(item.type)
                      const rarity = getDisplayRarity(item)
                      const gilded = isGilded(item)
                      const isSelected = selectedIdx === idx
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedIdx(idx)}
                          title={humanize(item.type) + (gilded ? " (Gilded)" : "")}
                          className={`relative aspect-square rounded-md border-2 transition-all flex items-center justify-center p-1 ${
                            RARITY_BORDER[rarity]
                          } ${RARITY_BG[rarity]} ${RARITY_GLOW[rarity]} ${
                            gilded ? GILDED_OVERLAY : ""
                          } ${
                            isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:scale-105"
                          }`}
                        >
                          {icon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={icon} alt={item.type} className="w-full h-full object-contain" />
                          ) : (
                            <Package className="w-8 h-8 text-muted-foreground" />
                          )}
                          {/* Level badge bottom-right */}
                          <span className="absolute bottom-0.5 right-0.5 text-[10px] font-mono font-bold bg-black/70 text-white px-1 rounded">
                            {levelFromPower(item.power)}
                          </span>
                          {item.markedNew && !gilded && (
                            <span className="absolute top-0.5 right-0.5 text-[8px] font-bold bg-yellow-500 text-black px-1 rounded">
                              NEW
                            </span>
                          )}
                          {/* Equipped indicator top-left */}
                          {item.equipmentSlot && (
                            <span className="absolute top-1.5 left-1.5 text-[7px] font-bold uppercase leading-none bg-emerald-500 text-black px-1 py-0.5 rounded">
                              Equipped
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Item detail editor */}
            <div>
              {selectedItem == null || selectedIdx == null ? (
                <div className="flex items-center justify-center h-[600px] border border-dashed border-border rounded-md text-muted-foreground">
                  Select an item to edit
                </div>
              ) : (
                <ItemDetailEditor
                  save={save}
                  setSave={setSave}
                  location={location}
                  otherLocation={otherLocation}
                  index={selectedIdx}
                  item={selectedItem}
                  onDeleted={() => setSelectedIdx(null)}
                  onTransferred={() => setSelectedIdx(null)}
                />
              )}
            </div>
          </div>
    </>
  )

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-foreground">
              {titleIcon}
              {title} ({items.length})
            </CardTitle>
            <AddItemDialog
              initialCategory={addCategory}
              onCategoryChange={setAddCategory}
              onPick={(itemId) => {
                const picked = ITEM_LOOKUP.get(itemId)
                const rarity: Rarity = picked?.rarity === "unique" ? "Unique" : "Common"
                setSave(addItem(save, location, itemId, rarity))
                setSelectedIdx(items.length)
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {showSubTabs ? (
            <Tabs
              value={inventorySubTab}
              onValueChange={(v) => setInventorySubTab!(v as "character" | "equipped")}
            >
              <TabsList className="grid w-full grid-cols-2 bg-muted/40 border border-border mb-4">
                <TabsTrigger value="character" className="data-[state=active]:bg-muted">
                  <Sword className="w-4 h-4 mr-2" />
                  Character Inventory
                </TabsTrigger>
                <TabsTrigger value="equipped" className="data-[state=active]:bg-muted">
                  <User className="w-4 h-4 mr-2" />
                  Equipped Items
                </TabsTrigger>
              </TabsList>
              <TabsContent value="character" className="mt-0">
                {characterInventoryBody}
              </TabsContent>
              <TabsContent value="equipped" className="mt-0">
                <EquipmentSlotsPanel
                  save={save}
                  location={location}
                  onSelectItem={(idx) => {
                    setSelectedIdx(idx)
                    setInventorySubTab!("character")
                  }}
                />
              </TabsContent>
            </Tabs>
          ) : (
            characterInventoryBody
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Item detail editor ─────────────────────────────────────────────────

interface ItemDetailEditorProps {
  save: MCDSave
  setSave: (s: MCDSave) => void
  location: ItemLocation
  otherLocation: ItemLocation
  index: number
  item: Item
  onDeleted: () => void
  onTransferred: () => void
}

function ItemDetailEditor({
  save,
  setSave,
  location,
  otherLocation,
  index,
  item,
  onDeleted,
  onTransferred,
}: ItemDetailEditorProps) {
  const icon = getItemIcon(item.type)
  const inferredCategory = inferItemCategory(item.type)
  const itemCategoryForEnchantments: "melee" | "ranged" | "armor" | null =
    inferredCategory === "melee" || inferredCategory === "ranged" || inferredCategory === "armor"
      ? inferredCategory
      : null

  // Enchantment options filtered by item category
  const enchantmentOptions = useMemo(() => {
    if (!itemCategoryForEnchantments) {
      return manifest.enchantments
    }
    return manifest.enchantments.filter((e) => e.validOn[itemCategoryForEnchantments])
  }, [itemCategoryForEnchantments])

  const itemLevel = levelFromPower(item.power)
  const displayRarity = getDisplayRarity(item)
  const gilded = isGilded(item)

  const slots = item.enchantments ?? []
  // First 3 slots are the standard enchantment slots in MCD
  const standardSlots = [0, 1, 2]

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Large item icon with rarity frame + gilded overlay, mirroring the original 100x100 tile */}
          <div
            className={`relative w-24 h-24 flex-shrink-0 rounded-md border-2 flex items-center justify-center p-1 ${RARITY_BORDER[displayRarity]} ${RARITY_BG[displayRarity]} ${RARITY_GLOW[displayRarity]} ${
              gilded ? GILDED_OVERLAY : ""
            }`}
          >
            {icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon} alt={item.type} className="w-full h-full object-contain" />
            ) : (
              <Package className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className={`text-base mb-1 ${RARITY_TEXT[displayRarity]}`}>
              {humanize(item.type)}
            </CardTitle>
            <div className="flex items-center gap-1 flex-wrap">
              {inferredCategory && (
                <Badge variant="outline" className="text-xs">{inferredCategory}</Badge>
              )}
              <Badge variant="secondary" className="text-xs">Level {itemLevel}</Badge>
              <Badge
                variant={displayRarity === "unique" ? "default" : "secondary"}
                className={`text-xs ${
                  displayRarity === "unique"
                    ? "bg-orange-500 hover:bg-orange-500 text-black"
                    : displayRarity === "rare"
                      ? "bg-green-500 hover:bg-green-500 text-black"
                      : ""
                }`}
              >
                {displayRarity === "unique" ? "Unique" : displayRarity === "rare" ? "Rare" : "Common"}
              </Badge>
              {gilded && (
                <Badge className="text-xs bg-yellow-500 hover:bg-yellow-500 text-black">★ Gilded</Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Power / Level / Rarity */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-muted-foreground text-xs">Level</Label>
            <Input
              type="number"
              value={itemLevel}
              onChange={(e) => setSave(updateItemLevel(save, location, index, parseInt(e.target.value) || 1))}
              min="1"
              className="font-mono text-sm bg-muted border-border text-foreground"
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Power</Label>
            <Input
              type="number"
              value={item.power.toFixed(2)}
              onChange={(e) => setSave(updateItemPower(save, location, index, parseFloat(e.target.value) || 0))}
              step="0.1"
              className="font-mono text-sm bg-muted border-border text-foreground"
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Rarity</Label>
            <Select
              value={item.rarity}
              onValueChange={(val) => setSave(updateItemRarity(save, location, index, val as Rarity))}
            >
              <SelectTrigger className="bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RARITY_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Equipment Slot */}
        <div>
          <Label className="text-muted-foreground text-xs">Equipment Slot</Label>
          <Select
            value={item.equipmentSlot ?? "none"}
            onValueChange={(val) =>
              setSave(updateItemEquipmentSlot(save, location, index, val === "none" ? undefined : val))
            }
          >
            <SelectTrigger className="bg-muted border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EQUIPMENT_SLOTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Flags */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`new-${index}`}
              checked={item.markedNew ?? false}
              onCheckedChange={(c) => setSave(updateItemFlag(save, location, index, "markedNew", !!c))}
            />
            <Label htmlFor={`new-${index}`} className="text-xs cursor-pointer">New</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`upgraded-${index}`}
              checked={item.upgraded ?? false}
              onCheckedChange={(c) => setSave(updateItemFlag(save, location, index, "upgraded", !!c))}
            />
            <Label htmlFor={`upgraded-${index}`} className="text-xs cursor-pointer">Upgraded</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`gifted-${index}`}
              checked={item.gifted ?? false}
              onCheckedChange={(c) => setSave(updateItemFlag(save, location, index, "gifted", !!c))}
            />
            <Label htmlFor={`gifted-${index}`} className="text-xs cursor-pointer">Gifted</Label>
          </div>
        </div>

        {/* Armor properties — only on armor items, mirrors the original ItemScreen */}
        {inferredCategory === "armor" && (
          <div>
            <Label className="text-muted-foreground text-xs mb-2 block">Armor Properties</Label>
            <div className="space-y-2 bg-muted/30 rounded-md p-2">
              {(item.armorproperties ?? []).length === 0 && (
                <p className="text-[11px] text-muted-foreground italic px-1">No armor properties</p>
              )}
              {(item.armorproperties ?? []).map((prop, propIdx) => {
                const manifestEntry = ARMOR_PROPERTY_LOOKUP.get(prop.id)
                const propIcon = getArmorPropertyIcon(prop.id)
                const displayName = manifestEntry?.displayName ?? humanize(prop.id)
                return (
                  <div key={propIdx} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      {propIcon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={propIcon}
                          alt={displayName}
                          className="w-5 h-5 object-contain flex-shrink-0"
                        />
                      ) : (
                        <span
                          className={`text-sm flex-shrink-0 w-5 text-center ${
                            prop.rarity === "Unique"
                              ? "text-orange-400"
                              : prop.rarity === "Rare"
                                ? "text-green-400"
                                : "text-cyan-400"
                          }`}
                        >
                          ◆
                        </span>
                      )}
                      <Select
                        value={prop.id}
                        onValueChange={(val) =>
                          setSave(updateArmorPropertyId(save, location, index, propIdx, val))
                        }
                      >
                        <SelectTrigger className="flex-1 h-7 text-xs bg-muted border-border">
                          <SelectValue>
                            <span className="text-xs">{displayName}</span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {/* Show the current ID even if it's not in the manifest (legacy/unknown) */}
                          {!manifestEntry && (
                            <SelectItem value={prop.id}>
                              <span className="text-xs italic text-muted-foreground">
                                {humanize(prop.id)} (unknown)
                              </span>
                            </SelectItem>
                          )}
                          {manifest.armorProperties.map((m) => (
                            <SelectItem key={m.id} value={m.id} title={m.description}>
                              <div className="flex items-center gap-2">
                                {m.icon && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={`/images/minecraft-dungeons/${m.icon}`}
                                    alt=""
                                    className="w-4 h-4 object-contain"
                                  />
                                )}
                                <span className="text-xs">{m.displayName}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={prop.rarity}
                        onValueChange={(val) =>
                          setSave(updateArmorPropertyRarity(save, location, index, propIdx, val as Rarity))
                        }
                      >
                        <SelectTrigger className="w-20 h-7 text-xs bg-muted border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RARITY_OPTIONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              <span className="text-xs">{r}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => setSave(removeArmorProperty(save, location, index, propIdx))}
                        title="Remove property"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    {manifestEntry?.description && (
                      <p className="text-[10px] text-muted-foreground italic pl-7 pr-2">
                        {formatArmorPropertyDescription(manifestEntry.description)}
                      </p>
                    )}
                  </div>
                )
              })}
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 mt-2 text-xs bg-transparent"
                onClick={() => setSave(addArmorProperty(save, location, index))}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Property
              </Button>
            </div>
          </div>
        )}

        {/* Enchantment slots — diamond layout matching the in-game UI */}
        {itemCategoryForEnchantments && (
          <div>
            <Label className="text-muted-foreground text-xs mb-2 block">Enchantments</Label>

            {/* Diamond grid: slot 1 top-center, slots 2 and 3 bottom-left/right */}
            <div className="bg-muted/30 rounded-md p-4">
              <div className="grid grid-cols-2 gap-2 max-w-[260px] mx-auto">
                {/* Top center slot (spans both columns) */}
                <div className="col-span-2 flex justify-center">
                  <DiamondSlot
                    icon={getEnchantmentIcon(slots[0]?.id ?? "Unset")}
                    powerful={ENCHANTMENT_LOOKUP.get(slots[0]?.id ?? "")?.powerful ?? false}
                    level={slots[0]?.level ?? 0}
                    active={slots[0]?.id !== "Unset" && slots[0]?.id !== "" && (slots[0]?.level ?? 0) > 0}
                  />
                </div>
                {/* Bottom-left slot */}
                <div className="flex justify-end">
                  <DiamondSlot
                    icon={getEnchantmentIcon(slots[1]?.id ?? "Unset")}
                    powerful={ENCHANTMENT_LOOKUP.get(slots[1]?.id ?? "")?.powerful ?? false}
                    level={slots[1]?.level ?? 0}
                    active={slots[1]?.id !== "Unset" && slots[1]?.id !== "" && (slots[1]?.level ?? 0) > 0}
                  />
                </div>
                {/* Bottom-right slot */}
                <div className="flex justify-start">
                  <DiamondSlot
                    icon={getEnchantmentIcon(slots[2]?.id ?? "Unset")}
                    powerful={ENCHANTMENT_LOOKUP.get(slots[2]?.id ?? "")?.powerful ?? false}
                    level={slots[2]?.level ?? 0}
                    active={slots[2]?.id !== "Unset" && slots[2]?.id !== "" && (slots[2]?.level ?? 0) > 0}
                  />
                </div>
              </div>

              {/* Slot editors below the diamond */}
              <div className="mt-4 space-y-2">
                {standardSlots.map((slotIdx) => {
                  const slot = slots[slotIdx] ?? { id: "Unset", level: 0 }
                  const enchManifest = ENCHANTMENT_LOOKUP.get(slot.id)
                  return (
                    <div key={slotIdx} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground w-4">{slotIdx + 1}.</span>
                      <Select
                        value={slot.id}
                        onValueChange={(val) =>
                          setSave(setEnchantment(save, location, index, slotIdx, val, slot.level || 1))
                        }
                      >
                        <SelectTrigger className="flex-1 h-8 bg-muted border-border">
                          <SelectValue>
                            <span className="text-xs flex items-center gap-1">
                              {slot.id === "Unset" || slot.id === "" ? "(none)" : humanize(slot.id)}
                              {enchManifest?.powerful && (
                                <span className="text-orange-400 text-[10px]">★</span>
                              )}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value="Unset">(none)</SelectItem>
                          {enchantmentOptions.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              <span className="text-xs flex items-center gap-1">
                                {humanize(e.id)}
                                {e.powerful && <span className="text-orange-400 text-[10px]">★</span>}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={slot.level}
                        onChange={(e) =>
                          setSave(setEnchantment(save, location, index, slotIdx, slot.id, parseInt(e.target.value) || 0))
                        }
                        min="0"
                        max="3"
                        className="w-12 h-8 font-mono text-sm bg-muted border-border text-foreground"
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Netherite / Gilded enchant — adding one makes the item "Gilded" */}
            <Label className="text-muted-foreground text-xs mb-2 mt-3 block flex items-center gap-1">
              <span className="text-yellow-400">★</span> Gilded Enchantment
            </Label>
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
              {item.netheriteEnchant?.id ? (
                (() => {
                  const nIcon = getEnchantmentIcon(item.netheriteEnchant.id)
                  return nIcon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={nIcon} alt={item.netheriteEnchant.id} className="w-8 h-8 object-contain flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )
                })()
              ) : (
                <div className="w-8 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <Select
                value={item.netheriteEnchant?.id ?? "Unset"}
                onValueChange={(val) =>
                  setSave(setNetheriteEnchant(save, location, index, val, item.netheriteEnchant?.level ?? 1))
                }
              >
                <SelectTrigger className="flex-1 bg-muted border-border">
                  <SelectValue>
                    <span className="text-xs">
                      {!item.netheriteEnchant || item.netheriteEnchant.id === "Unset"
                        ? "(none)"
                        : humanize(item.netheriteEnchant.id)}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="Unset">(none)</SelectItem>
                  {enchantmentOptions.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="text-xs">{humanize(e.id)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={item.netheriteEnchant?.level ?? 0}
                onChange={(e) =>
                  setSave(
                    setNetheriteEnchant(
                      save,
                      location,
                      index,
                      item.netheriteEnchant?.id ?? "Unset",
                      parseInt(e.target.value) || 0,
                    ),
                  )
                }
                min="0"
                max="3"
                className="w-14 font-mono text-sm bg-muted border-border text-foreground"
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          <Button
            size="sm"
            variant="outline"
            className="text-xs bg-transparent min-w-0"
            onClick={() => setSave(duplicateItem(save, location, index))}
          >
            <Copy className="w-3 h-3 mr-1" />
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs bg-transparent min-w-0"
            onClick={() => {
              setSave(transferItem(save, location, index, otherLocation))
              onTransferred()
            }}
          >
            <ArrowLeftRight className="w-3 h-3 mr-1" />
            {location === "items" ? "→ Storage" : "→ Inventory"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="col-span-2 text-xs text-destructive hover:bg-destructive/10 bg-transparent min-w-0"
            onClick={() => {
              setSave(deleteItem(save, location, index))
              onDeleted()
            }}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── AddItemDialog — rich item picker modal ─────────────────────────────
// Replaces the legacy "category dropdown + Add" pair with a modal that shows
// every item in a category with icon, display name, description, and rarity
// frame, plus a search box to filter by name or description.

interface AddItemDialogProps {
  initialCategory: "melee" | "ranged" | "armor" | "artifact"
  onCategoryChange: (c: "melee" | "ranged" | "armor" | "artifact") => void
  onPick: (itemId: string) => void
}

const ADD_ITEM_CATEGORIES: { value: "melee" | "ranged" | "armor" | "artifact"; label: string }[] = [
  { value: "melee", label: "Melee" },
  { value: "ranged", label: "Ranged" },
  { value: "armor", label: "Armor" },
  { value: "artifact", label: "Artifact" },
]

function AddItemDialog({ initialCategory, onCategoryChange, onPick }: AddItemDialogProps) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState(initialCategory)
  const [search, setSearch] = useState("")

  const visibleItems = useMemo(() => {
    const list = manifest.items[category] ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q),
    )
  }, [category, search])

  function handleCategoryChange(next: "melee" | "ranged" | "armor" | "artifact") {
    setCategory(next)
    onCategoryChange(next)
  }

  function handlePick(id: string) {
    onPick(id)
    setOpen(false)
    setSearch("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Add Item
          </DialogTitle>
          <DialogDescription>
            Browse {visibleItems.length} {category} item{visibleItems.length === 1 ? "" : "s"}.
            Click one to add it to the inventory.
          </DialogDescription>
        </DialogHeader>

        {/* Category tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {ADD_ITEM_CATEGORIES.map((c) => (
            <Button
              key={c.value}
              size="sm"
              variant={category === c.value ? "default" : "outline"}
              className={`h-8 text-xs ${category === c.value ? "" : "bg-transparent"}`}
              onClick={() => handleCategoryChange(c.value)}
            >
              {c.label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <Input
          type="text"
          placeholder="Search by name or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-muted border-border text-foreground"
        />

        {/* Item grid */}
        <ScrollArea className="h-[480px] pr-3 border border-border rounded-md">
          <div className="p-3">
            {visibleItems.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">No items match your search.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {visibleItems.map((m) => {
                  const icon = `/images/minecraft-dungeons/${m.icon}`
                  const rarity = (m.rarity === "unique" ? "unique" : "common") as DisplayRarity
                  return (
                    <button
                      key={m.id}
                      onClick={() => handlePick(m.id)}
                      className={`text-left flex items-start gap-3 p-2 rounded-md border-2 transition-all hover:scale-[1.01] hover:bg-muted/30 ${RARITY_BORDER[rarity]} ${RARITY_BG[rarity]}`}
                    >
                      <div className="relative w-14 h-14 flex-shrink-0 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={icon} alt={m.displayName} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-sm font-medium truncate ${RARITY_TEXT[rarity]}`}>
                            {m.displayName || humanize(m.id)}
                          </span>
                          {rarity === "unique" && (
                            <Badge className="text-[9px] h-4 px-1 bg-orange-500 hover:bg-orange-500 text-black">
                              Unique
                            </Badge>
                          )}
                        </div>
                        {m.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {m.description}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ── EquipmentSlotsPanel — 6-slot equipped items overview ──────────────
// Mirrors the EquipmentScreen layout from the original WPF editor:
//   Row 1: Melee | Armor | Ranged
//   Row 2: Hotbar1 | Hotbar2 | Hotbar3
// Clicking a slot jumps to that item in the inventory grid.

interface EquipmentSlotsPanelProps {
  save: MCDSave
  location: ItemLocation
  onSelectItem: (idx: number) => void
}

const EQUIPMENT_SLOT_LAYOUT: { slot: string; label: string }[] = [
  { slot: "MeleeGear", label: "Melee" },
  { slot: "ArmorGear", label: "Armor" },
  { slot: "RangedGear", label: "Ranged" },
  { slot: "HotbarSlot1", label: "Artifact 1" },
  { slot: "HotbarSlot2", label: "Artifact 2" },
  { slot: "HotbarSlot3", label: "Artifact 3" },
]

function EquipmentSlotsPanel({ save, location, onSelectItem }: EquipmentSlotsPanelProps) {
  const items = save[location] ?? []

  // For each slot, find the item index whose equipmentSlot matches
  function findItemForSlot(slotName: string): { item: Item; index: number } | null {
    for (let i = 0; i < items.length; i++) {
      if (items[i].equipmentSlot === slotName) return { item: items[i], index: i }
    }
    return null
  }

  return (
    <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto py-4">
      {EQUIPMENT_SLOT_LAYOUT.map(({ slot, label }) => {
            const found = findItemForSlot(slot)
            const icon = found ? getItemIcon(found.item.type) : null
            const rarity = found ? getDisplayRarity(found.item) : "common"
            const gilded = found ? isGilded(found.item) : false
            return (
              <button
                key={slot}
                onClick={() => found && onSelectItem(found.index)}
                disabled={!found}
                title={found ? humanize(found.item.type) + (gilded ? " (Gilded)" : "") : `${label} (empty)`}
                className={`relative aspect-square rounded-md border-2 transition-all flex items-center justify-center p-1 ${
                  found
                    ? `${RARITY_BORDER[rarity]} ${RARITY_BG[rarity]} ${RARITY_GLOW[rarity]} ${
                        gilded ? GILDED_OVERLAY : ""
                      } hover:scale-105 cursor-pointer`
                    : "border-dashed border-slate-700 bg-slate-900/20 cursor-default"
                }`}
              >
                {icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={icon} alt={found?.item.type ?? ""} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[10px] text-muted-foreground text-center">{label}</span>
                )}
                {found && (
                  <span className="absolute bottom-0.5 right-0.5 text-[10px] font-mono font-bold bg-black/70 text-white px-1 rounded">
                    {levelFromPower(found.item.power)}
                  </span>
                )}
                {found && (
                  <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground bg-card px-1 rounded">
                    {label}
                  </span>
                )}
              </button>
            )
          })}
    </div>
  )
}

// ── DiamondSlot — visual diamond-shaped enchantment indicator ──────────
// Mirrors the rotated 45° enchantment buttons in the original WPF editor.

interface DiamondSlotProps {
  icon: string | null
  powerful: boolean
  level: number
  active: boolean
}

function DiamondSlot({ icon, powerful, level, active }: DiamondSlotProps) {
  const colorClasses = active
    ? powerful
      ? "border-orange-500 bg-orange-950/40 shadow-[0_0_12px_rgba(249,115,22,0.55)]"
      : "border-cyan-500 bg-cyan-950/40 shadow-[0_0_8px_rgba(34,211,238,0.4)]"
    : "border-slate-600/60 bg-slate-900/40"

  return (
    <div className="relative w-[68px] h-[68px] flex items-center justify-center">
      {/* Rotated square forms the diamond outline */}
      <div
        className={`absolute inset-0 rounded-md border-2 transition-all ${colorClasses}`}
        style={{ transform: "rotate(45deg)" }}
      />
      {/* Inner content stays upright */}
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="relative w-9 h-9 object-contain" />
      ) : (
        <Sparkles className="relative w-5 h-5 text-muted-foreground" />
      )}
      {/* Level pip in the bottom corner */}
      {active && level > 0 && (
        <span className="absolute -bottom-1 -right-1 text-[10px] font-mono font-bold bg-black/80 text-white px-1 rounded z-10">
          {level}
        </span>
      )}
      {/* Powerful star in the top corner */}
      {powerful && active && (
        <span className="absolute -top-1 -left-1 text-orange-400 text-xs z-10">★</span>
      )}
    </div>
  )
}
