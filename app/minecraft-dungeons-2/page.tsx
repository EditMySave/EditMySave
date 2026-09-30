"use client"

import type React from "react"
import { useMemo, useState } from "react"
import {
  Swords,
  ArrowLeft,
  Gem,
  TrendingUp,
  Hammer,
  User,
  Backpack,
  ScrollText,
  Code,
  Package,
  Shield,
  Sparkles,
  Shirt,
  PawPrint,
  Box,
  Copy,
  Trash2,
  Plus,
  Store,
  Trophy,
  CheckCircle2,
  Cloud,
  Search,
  Crosshair,
  Hexagon,
  BookOpen,
  Bomb,
  Crown,
  TrainFront,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { downloadJSON } from "@/lib/download-json"
import Link from "next/link"
import { track } from "@vercel/analytics"
import { SaveFileUpload } from "@/components/save-file-upload"
import { SaveLocationHelp } from "@/components/save-location-help"
import { EditorSidebar } from "@/components/editor-sidebar"
import { JsonTreeEditor } from "@/components/json-tree-editor"
import { EnumSelect } from "@/components/save-fields/EnumSelect"
import gamesData from "@/data/games.json"
import {
  type AttributeDef,
  type AttributeGroup,
  type CharacterData,
  type CharacterSave,
  type InventoryEntry,
  ATTRIBUTE_DEFS,
  EFFECT_BATCH,
  NO_SLOT,
  decodeSaveFromFile,
  encodeSaveToBlob,
  findAttribute,
  getAttribute,
  humanizeTag,
  isMerchantStock,
  numberValue,
  parseLossless,
} from "@/lib/minecraft-dungeons-2/decoder"
import {
  type CatalogItem,
  type ItemCategory,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  UNIQUE_RARITY,
  achievementInfo,
  achievementTargets,
  areaName,
  catalog,
  collectionKey,
  collectionTagName,
  MAX_ENCHANTMENTS_PER_ITEM,
  defaultRarity,
  enchantPoints,
  enchantmentInfo,
  enchantmentsFor,
  objectiveName,
  questDescription,
  rolledEffectCount,
  rolledEffectsFor,
  talismanInfo,
  xpForNextLevel,
  equipSlotName,
  equipSlotsFor,
  hasItemPower,
  iconUrl,
  interchangeableItems,
  itemCategory,
  itemInfo,
  itemName,
  productLabel,
  questName,
  rarityName,
  raritiesFor,
  stationName,
} from "@/lib/minecraft-dungeons-2/catalog"
import {
  type ItemEffectInfo,
  GEAR_RULES,
  effectTotals,
  formatCombo,
  formatPercent,
  isAlwaysOn,
  itemEffects,
  maxDropPower,
  meleeStats,
  powerStanding,
  predictMelee,
  predictRanged,
  rangedStats,
  round,
} from "@/lib/minecraft-dungeons-2/stats"
import {
  type BoolAchievementGroup,
  type TalismanLevelSpec,
  MINECART_ACHIEVEMENT,
  removeItemEffect,
  setItemEffect,
  setTalismanProgress,
  addItem,
  claimMerchantItem,
  completeAllAchievements,
  completeQuest,
  deleteItem,
  duplicateItem,
  maxAllCurrencies,
  setAttribute,
  setBoolAchievement,
  setCollectionTag,
  setCountAchievement,
  setEquippedSlot,
  setFocusedQuest,
  setItemPower,
  setItemRarity,
  setItemType,
  setLevel,
  setMerchantSold,
  setMetaFlag,
  setMinecartStation,
  setPowerLevel,
  setQuestState,
  setSkin,
  setStackCount,
  setTaskState,
  unlockAllMinecartStations,
} from "./save-mutations"

const GAME_NAME = "Minecraft Dungeons 2"
const MAX_ITEM_POWER = 999
const QUEST_STATES = ["Unavailable", "Active", "Completed"]
const TASK_STATES = ["NotSet", "Active", "Completed"]

// ── Presentation helpers ────────────────────────────────────────────────

const GROUPS: { id: AttributeGroup; label: string; icon: typeof Gem; color: string }[] = [
  { id: "currency", label: "Currencies", icon: Gem, color: "text-emerald-400" },
  { id: "progression", label: "Progression", icon: TrendingUp, color: "text-blue-400" },
  { id: "upgrades", label: "Hub Upgrades", icon: Hammer, color: "text-orange-400" },
]

const CATEGORY_ICONS: Record<ItemCategory, typeof Swords> = {
  melee: Swords,
  ranged: Crosshair,
  armor: Shield,
  artifact: Sparkles,
  talisman: Hexagon,
  enchantmentBook: BookOpen,
  throwable: Bomb,
  cape: Shirt,
  pet: PawPrint,
  other: Box,
}

function rarityColor(tag: string): string {
  if (tag.endsWith(".Unique")) return "bg-orange-500/20 text-orange-300 border-orange-500/40"
  if (tag.endsWith(".Special")) return "bg-purple-500/20 text-purple-300 border-purple-500/40"
  if (tag.endsWith(".Rare")) return "bg-sky-500/20 text-sky-300 border-sky-500/40"
  return "bg-muted text-muted-foreground border-border"
}

function stateColor(state: string): string {
  if (state === "Completed") return "bg-green-500/20 text-green-300 border-green-500/40"
  if (state === "Active") return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
  return "bg-muted text-muted-foreground border-border"
}

function parseNumber(value: string, max: number, float = false): number {
  const n = float ? Number.parseFloat(value) : Number.parseInt(value)
  return Math.min(Math.max(Number.isFinite(n) ? n : 0, 0), max)
}

/** Level-appropriate default power for newly added gear. */
function defaultPower(save: CharacterSave): number {
  return Math.max(1, getAttribute(save, "Level"), numberValue(save.CharacterSaveV1.MetaData.PowerLevel))
}

type InventoryFilter = "all" | "equipped" | "owned" | "merchant"

// ── Component ───────────────────────────────────────────────────────────

export default function Dungeons2SaveEditor() {
  const [saveData, setSaveData] = useState<CharacterSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedItem, setSelectedItem] = useState<number | null>(null)
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>("all")
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const processSaveFile = async (file: File) => {
    setIsProcessing(true)
    try {
      const decoded = await decodeSaveFromFile(file)
      setSaveData(decoded)
      setOriginalFile(file)
      setSelectedItem(null)

      track("file_uploaded", {
        game: GAME_NAME,
        fileSize: file.size,
        fileName: file.name,
      })
    } catch (error) {
      console.error("Error processing save file:", error)
      alert(
        error instanceof Error
          ? error.message
          : `Failed to process save file. Please ensure it is a valid ${GAME_NAME} Character .sav file.`,
      )
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

      track("file_downloaded", {
        game: GAME_NAME,
        fileName: originalFile.name,
      })
    } catch (error) {
      console.error("Error encoding save file:", error)
      alert("Failed to create edited save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const character = saveData?.CharacterSaveV1
  const entries = character?.Inventory?.Entries ?? []
  const quests = character?.quest?.Quests ?? []
  const completedQuests = quests.filter((q) => q.State === "Completed").length
  const ownedCount = entries.filter((e) => !isMerchantStock(e)).length

  const quickStats = saveData
    ? [
        { label: "Level", value: getAttribute(saveData, "Level"), icon: <TrendingUp className="w-4 h-4 text-blue-400" /> },
        { label: "Emeralds", value: getAttribute(saveData, "Emeralds"), icon: <Gem className="w-4 h-4 text-emerald-400" /> },
        { label: "Items", value: ownedCount, icon: <Backpack className="w-4 h-4 text-orange-400" /> },
        {
          label: "Quests",
          value: `${completedQuests}/${quests.length}`,
          icon: <ScrollText className="w-4 h-4 text-yellow-400" />,
        },
      ]
    : []

  const quickActions = saveData
    ? [
        {
          label: "Max All Currencies",
          onClick: () => setSaveData(maxAllCurrencies(saveData)),
          icon: <Gem className="w-4 h-4 mr-2" />,
        },
        {
          label: "Complete Achievements",
          onClick: () => setSaveData(completeAllAchievements(saveData, achievementTargets())),
          icon: <Trophy className="w-4 h-4 mr-2" />,
        },
        {
          label: "Download JSON",
          onClick: () => {
            const filename = originalFile?.name.replace(/\.[^/.]+$/, "") || "minecraft-dungeons-2-character"
            downloadJSON(saveData, filename)
            track("json_downloaded", {
              game: GAME_NAME,
              fileName: originalFile?.name,
            })
          },
          icon: <Code className="w-4 h-4 mr-2" />,
        },
      ]
    : []

  const gameData = gamesData.games.find((game) => game.id === "minecraft-dungeons-2")

  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Swords className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">{GAME_NAME}</h1>
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
        {!saveData || !character ? (
          <div className="space-y-6">
            <div className="text-center space-y-2 py-8">
              <h2 className="text-3xl font-bold text-foreground">{GAME_NAME} Save Editor</h2>
              <p className="text-muted-foreground">Edit emeralds, level, inventory, quests and achievements</p>
            </div>

            {gameData && <SaveLocationHelp platforms={gameData.platforms} gameName={gameData.name} />}

            <SaveFileUpload onFileSelect={processSaveFile} acceptedFileTypes=".sav" isProcessing={isProcessing} />
          </div>
        ) : (
          <div className="flex gap-6 pt-4">
            <EditorSidebar
              onDownload={handleDownload}
              onLoadNew={() => {
                setSaveData(null)
                setOriginalFile(null)
                setSelectedItem(null)
              }}
              isProcessing={isProcessing}
              hasSaveData={!!saveData}
              fileName={originalFile?.name}
              fileSize={originalFile?.size}
              lastModified={originalFile ? new Date(originalFile.lastModified) : undefined}
              quickStats={quickStats}
              quickActions={quickActions}
            />

            <div className="flex-1 min-w-0 space-y-4">
              <Alert>
                <Cloud className="w-4 h-4" />
                <AlertTitle>Turn off Cloud Save before copying the file back</AlertTitle>
                <AlertDescription>
                  The game may otherwise replace your edited save with its cloud copy. Keep a backup of the original
                  file.
                </AlertDescription>
              </Alert>

              <Tabs defaultValue="stats" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-card border border-border">
                  <TabsTrigger value="stats" className="data-[state=active]:bg-muted">
                    <User className="w-4 h-4 mr-2" />
                    Stats
                  </TabsTrigger>
                  <TabsTrigger value="inventory" className="data-[state=active]:bg-muted">
                    <Backpack className="w-4 h-4 mr-2" />
                    Inventory
                  </TabsTrigger>
                  <TabsTrigger value="quests" className="data-[state=active]:bg-muted">
                    <ScrollText className="w-4 h-4 mr-2" />
                    Quests
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="data-[state=active]:bg-muted">
                    <Code className="w-4 h-4 mr-2" />
                    Raw JSON
                  </TabsTrigger>
                </TabsList>

                {/* ── Stats Tab ───────────────────────────────────── */}
                <TabsContent value="stats" className="space-y-6">
                  {GROUPS.map((group) => (
                    <div key={group.id} className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        {group.label}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ATTRIBUTE_DEFS.filter((d) => d.group === group.id).map((def) => (
                          <AttributeCard
                            key={def.name}
                            def={def}
                            icon={<group.icon className={`w-5 h-5 shrink-0 mt-0.5 ${group.color}`} />}
                            save={saveData}
                            onChange={setSaveData}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  <CharacterCard save={saveData} onChange={setSaveData} />
                  <LoadoutCard save={saveData} />
                </TabsContent>

                {/* ── Inventory Tab ───────────────────────────────── */}
                <TabsContent value="inventory" className="space-y-4">
                  <InventoryPanel
                    save={saveData}
                    onChange={setSaveData}
                    selected={selectedItem}
                    onSelect={setSelectedItem}
                    filter={inventoryFilter}
                    onFilterChange={setInventoryFilter}
                    onOpenAdd={() => setAddDialogOpen(true)}
                  />
                  <AddItemDialog
                    open={addDialogOpen}
                    onOpenChange={setAddDialogOpen}
                    onPick={(item) => {
                      const rarity = defaultRarity(item.tag)
                      setSaveData(
                        addItem(saveData, {
                          tag: item.tag,
                          rarity,
                          power: defaultPower(saveData),
                          hasPower: hasItemPower(item.category),
                          collectionKey: collectionKey(item.tag, rarity),
                          talisman: talismanLevels(item.tag),
                        }),
                      )
                      setSelectedItem(entries.length)
                      setInventoryFilter("all")
                      setAddDialogOpen(false)
                    }}
                  />
                </TabsContent>

                {/* ── Quests Tab ──────────────────────────────────── */}
                <TabsContent value="quests" className="space-y-4">
                  <QuestsPanel save={saveData} onChange={setSaveData} />
                  <AchievementsPanel save={saveData} onChange={setSaveData} />
                  <MinecartPanel save={saveData} onChange={setSaveData} />
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
                        data={JSON.parse(JSON.stringify(character))}
                        onChange={(updated: CharacterData) => {
                          // JsonTreeEditor round-trips through plain JSON.parse, so a raw edit
                          // normalises long numbers (tick timestamps) — harmless for the game.
                          const reparsed = parseLossless(JSON.stringify(updated)) as CharacterData
                          setSaveData({ ...saveData, CharacterSaveV1: reparsed })
                        }}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg text-sm">
                <span className="text-muted-foreground">
                  Character:{" "}
                  <span className="text-foreground font-medium font-mono">{character.MetaData.CharacterId}</span>
                </span>
                <span className="text-muted-foreground">
                  Editing: <span className="text-foreground font-medium">{originalFile?.name}</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

// ── Stats ───────────────────────────────────────────────────────────────

interface SaveProps {
  save: CharacterSave
  onChange: (save: CharacterSave) => void
}

function AttributeCard({ def, icon, save, onChange }: SaveProps & { def: AttributeDef; icon: React.ReactNode }) {
  const stored = !!findAttribute(save, def.name)
  const value = getAttribute(save, def.name)
  const apply = (v: number) => onChange(def.name === "Level" ? setLevel(save, v) : setAttribute(save, def.name, v))

  return (
    <Card className={`bg-card border-border ${stored ? "" : "opacity-70"}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-start justify-between text-foreground gap-2">
          <span className="flex items-start gap-2 min-w-0 flex-1">
            {icon}
            <span className="min-w-0">
              <span className="flex items-center gap-2 flex-wrap">
                <span className="break-words leading-tight">{def.label}</span>
                {!stored && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    not in save
                  </Badge>
                )}
              </span>
              <span className="block text-xs font-mono font-normal text-muted-foreground break-all">{def.name}</span>
            </span>
          </span>
          <Button
            variant="outline"
            size="sm"
            className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent shrink-0"
            onClick={() => apply(def.max)}
          >
            Max
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          type="number"
          value={value}
          onChange={(e) => apply(parseNumber(e.target.value, def.max, def.float))}
          min="0"
          max={def.max}
          step={def.float ? "any" : 1}
          className="font-mono text-lg bg-muted border-border text-foreground"
        />
        {def.name === "XP" && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Progress toward the next level: {xpForNextLevel(getAttribute(save, "Level")).toLocaleString()} XP levels up
            from level {getAttribute(save, "Level")}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// Meanings inferred from field names; not confirmed in-game.
const META_FLAG_INFO: Record<string, { label: string; description: string }> = {
  IsOnline: { label: "Online Character", description: "Character is used for online play (IsOnline)" },
  IsGuest: { label: "Guest Character", description: "Character belongs to a guest profile (IsGuest)" },
}

function CharacterCard({ save, onChange }: SaveProps) {
  const meta = save.CharacterSaveV1.MetaData
  const skin = save.CharacterSaveV1.Cosmetics?.Cosmetics?.["SW.Skin"]?.TypeTag ?? ""
  // Every boolean in MetaData, so flags added by future game versions show up too.
  const metaFlags = Object.keys(meta).filter((key) => typeof meta[key] === "boolean")

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <User className="w-5 h-5 text-blue-400" />
          Character
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EnumSelect
          label="Skin"
          value={skin}
          options={catalog.skins.map((s) => s.tag)}
          labels={Object.fromEntries(catalog.skins.map((s) => [s.tag, s.name]))}
          descriptions={Object.fromEntries(
            catalog.skins.filter((s) => s.product).map((s) => [s.tag, `Requires ${productLabel(s.product)}`]),
          )}
          onChange={(v) => onChange(setSkin(save, v))}
        />
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Power Level</Label>
          <Input
            type="number"
            value={numberValue(meta.PowerLevel)}
            onChange={(e) => onChange(setPowerLevel(save, parseNumber(e.target.value, MAX_ITEM_POWER)))}
            className="font-mono bg-muted border-border text-foreground"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Character ID</Label>
          <p className="font-mono text-sm text-foreground break-all">{meta.CharacterId}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Location</Label>
          <p className="text-sm text-foreground">{areaName(meta.CurrentLocation) ?? meta.CurrentLocation ?? "—"}</p>
          {areaName(meta.CurrentLocation) && (
            <p className="font-mono text-[11px] text-muted-foreground break-all">{meta.CurrentLocation}</p>
          )}
        </div>
        {metaFlags.length > 0 && (
          <div className="md:col-span-2 space-y-1 pt-2 border-t border-border">
            <Label className="text-xs text-muted-foreground">Character Flags</Label>
            {metaFlags.map((key) => (
              <div key={key} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 gap-4">
                <Label className="cursor-pointer flex flex-col items-start gap-0.5" htmlFor={`meta-${key}`}>
                  <span className="text-sm">{META_FLAG_INFO[key]?.label ?? humanizeTag(key)}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {META_FLAG_INFO[key]?.description ?? key}
                  </span>
                </Label>
                <Checkbox
                  id={`meta-${key}`}
                  checked={meta[key] as boolean}
                  onCheckedChange={(checked) => onChange(setMetaFlag(save, key, !!checked))}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Inventory ───────────────────────────────────────────────────────────

const FILTERS: { id: InventoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "equipped", label: "Equipped" },
  { id: "owned", label: "Owned" },
  { id: "merchant", label: "Merchant Stock" },
]

function matchesFilter(entry: InventoryEntry, filter: InventoryFilter): boolean {
  if (filter === "equipped") return entry.EquippedSlot !== NO_SLOT
  if (filter === "owned") return !isMerchantStock(entry)
  if (filter === "merchant") return isMerchantStock(entry)
  return true
}

/** The game's item icon, or the category icon when there isn't one. */
function ItemIcon({ tag, size = "w-10 h-10" }: { tag: string; size?: string }) {
  const [failed, setFailed] = useState(false)
  const src = iconUrl(tag)
  const Fallback = CATEGORY_ICONS[itemCategory(tag)]
  return (
    <span className={`${size} shrink-0 rounded-md bg-muted/60 flex items-center justify-center overflow-hidden`}>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="w-full h-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Fallback className="w-1/2 h-1/2 text-muted-foreground" />
      )}
    </span>
  )
}

function ProductBadge({ product }: { product?: string }) {
  if (!product) return null
  return (
    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-300 border-amber-500/40">
      {productLabel(product)}
    </Badge>
  )
}

interface InventoryPanelProps extends SaveProps {
  selected: number | null
  onSelect: (index: number | null) => void
  filter: InventoryFilter
  onFilterChange: (filter: InventoryFilter) => void
  onOpenAdd: () => void
}

function InventoryPanel({ save, onChange, selected, onSelect, filter, onFilterChange, onOpenAdd }: InventoryPanelProps) {
  const entries = save.CharacterSaveV1.Inventory?.Entries ?? []

  const grouped = useMemo(() => {
    const groups = new Map<ItemCategory, { entry: InventoryEntry; index: number }[]>()
    entries.forEach((entry, index) => {
      if (!matchesFilter(entry, filter)) return
      const cat = itemCategory(entry.ItemData.TypeTag)
      groups.set(cat, [...(groups.get(cat) ?? []), { entry, index }])
    })
    return CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => ({ category: c, items: groups.get(c)! }))
  }, [entries, filter])

  const selectedEntry = selected !== null ? entries[selected] : undefined

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {FILTERS.map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={filter === f.id ? "secondary" : "ghost"}
                onClick={() => onFilterChange(f.id)}
              >
                {f.label}
                <Badge variant="outline" className="ml-2 font-mono text-[10px]">
                  {entries.filter((e) => matchesFilter(e, f.id)).length}
                </Badge>
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
            onClick={onOpenAdd}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>

        {grouped.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="py-8 text-center text-muted-foreground">No items match this filter.</CardContent>
          </Card>
        )}

        {grouped.map(({ category, items }) => {
          const Icon = CATEGORY_ICONS[category]
          return (
            <div key={category} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {CATEGORY_LABELS[category]}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {items.map(({ entry, index }) => (
                  <ItemTile
                    key={index}
                    entry={entry}
                    active={selected === index}
                    onClick={() => onSelect(index)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="lg:sticky lg:top-24">
        {selectedEntry && selected !== null ? (
          <ItemDetail
            save={save}
            onChange={onChange}
            entry={selectedEntry}
            index={selected}
            onSelect={onSelect}
            entryCount={entries.length}
          />
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              <Package className="w-8 h-8 mx-auto mb-3 opacity-50" />
              Select an item to edit it
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function ItemTile({
  entry,
  active,
  onClick,
}: {
  entry: InventoryEntry
  active: boolean
  onClick: () => void
}) {
  const { TypeTag, RarityTag } = entry.ItemData
  const power = numberValue(entry.ItemData.GeneratorData.PowerGeneratorValues.ItemPower)
  const stack = numberValue(entry.StackCount)
  const info = itemInfo(TypeTag)

  return (
    <button
      type="button"
      onClick={onClick}
      title={info?.description}
      className={`text-left p-3 rounded-lg border transition-colors bg-card hover:bg-muted/50 ${
        active ? "border-primary ring-1 ring-primary" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <ItemIcon tag={TypeTag} />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-foreground truncate">{itemName(TypeTag)}</div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <Badge variant="outline" className={`text-[10px] ${rarityColor(RarityTag)}`}>
              {rarityName(RarityTag)}
            </Badge>
            {hasItemPower(itemCategory(TypeTag)) && power >= 0 && (
              <Badge variant="outline" className="text-[10px] font-mono">
                PWR {power}
              </Badge>
            )}
            {stack > 1 && (
              <Badge variant="outline" className="text-[10px] font-mono">
                ×{stack}
              </Badge>
            )}
            {entry.EquippedSlot !== NO_SLOT && (
              <Badge className="text-[10px] bg-primary/20 text-primary border-primary/40" variant="outline">
                Equipped
              </Badge>
            )}
            {isMerchantStock(entry) && (
              <Badge variant="outline" className="text-[10px]">
                <Store className="w-3 h-3 mr-1" />
                Shop
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

interface ItemDetailProps extends SaveProps {
  entry: InventoryEntry
  index: number
  entryCount: number
  onSelect: (index: number | null) => void
}

function ItemDetail({ save, onChange, entry, index, entryCount, onSelect }: ItemDetailProps) {
  const { TypeTag, RarityTag } = entry.ItemData
  const power = entry.ItemData.GeneratorData.PowerGeneratorValues
  const info = itemInfo(TypeTag)
  const category = itemCategory(TypeTag)
  const merchant = isMerchantStock(entry)
  const choices = interchangeableItems(TypeTag)
  const rarities = raritiesFor(TypeTag)
  const slots = equipSlotsFor(TypeTag)
  const uniqueVariant = info?.uniqueOf ? itemInfo(info.uniqueOf) : undefined

  // Switching type keeps the item valid: rarity follows the new item's allowed set.
  const changeType = (tag: string) => {
    let updated = setItemType(save, index, tag)
    if (!raritiesFor(tag).includes(RarityTag)) updated = setItemRarity(updated, index, defaultRarity(tag))
    if (entry.EquippedSlot !== NO_SLOT && !equipSlotsFor(tag).includes(entry.EquippedSlot)) {
      updated = setEquippedSlot(updated, index, NO_SLOT)
    }
    onChange(updated)
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex justify-center py-2">
          <ItemIcon tag={TypeTag} size="w-28 h-28" />
        </div>
        <CardTitle className="text-foreground">
          <span className="flex items-center gap-2 flex-wrap">
            {itemName(TypeTag)}
            {info?.unique && (
              <Badge variant="outline" className={`text-[10px] ${rarityColor(UNIQUE_RARITY)}`}>
                <Crown className="w-3 h-3 mr-1" />
                Unique
              </Badge>
            )}
            <ProductBadge product={info?.product} />
          </span>
          <span className="block text-xs font-mono font-normal text-muted-foreground break-all mt-1">{TypeTag}</span>
        </CardTitle>
        {info?.description && <p className="text-sm text-muted-foreground italic">{info.description}</p>}
        {!info && (
          <p className="text-xs text-amber-400">This item isn&apos;t in the game catalog; editing options are limited.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <EnumSelect
          label={`Item Type (${CATEGORY_LABELS[category]}${info?.armorPiece ? ` · ${info.armorPiece}` : ""})`}
          value={TypeTag}
          options={choices.map((i) => i.tag)}
          labels={Object.fromEntries([...choices.map((i) => [i.tag, i.name]), [TypeTag, itemName(TypeTag)]])}
          descriptions={Object.fromEntries(choices.filter((i) => i.description).map((i) => [i.tag, i.description!]))}
          onChange={changeType}
        />

        {uniqueVariant && (
          <Button
            variant="outline"
            size="sm"
            className={`w-full bg-transparent ${rarityColor(UNIQUE_RARITY)}`}
            onClick={() => onChange(setItemRarity(setItemType(save, index, uniqueVariant.tag), index, UNIQUE_RARITY))}
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to {uniqueVariant.name}
          </Button>
        )}

        <EnumSelect
          label="Rarity"
          value={RarityTag}
          options={rarities}
          labels={Object.fromEntries([...rarities, RarityTag].map((r) => [r, rarityName(r)]))}
          descriptions={Object.fromEntries(
            catalog.rarities.map((r) => [
              r.tag,
              `${r.effects} rerollable effect${r.effects === 1 ? "" : "s"}, power offset ${r.powerOffset}`,
            ]),
          )}
          onChange={(v) => onChange(setItemRarity(save, index, v))}
        />

        {hasItemPower(category) && numberValue(power.ItemPower) >= 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Item Power{" "}
              <span className="opacity-70">
                (rolled {numberValue(power.ItemPowerMin)}–{numberValue(power.ItemPowerMax)})
              </span>
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={numberValue(power.ItemPower)}
                onChange={(e) => onChange(setItemPower(save, index, parseNumber(e.target.value, MAX_ITEM_POWER)))}
                className="font-mono bg-muted border-border text-foreground"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0 bg-transparent"
                title={`Highest power a drop can roll at your level (level + ${GEAR_RULES.dropPowerAboveLevel})`}
                onClick={() => onChange(setItemPower(save, index, maxDropPower(getAttribute(save, "Level"))))}
              >
                Max drop ({maxDropPower(getAttribute(save, "Level"))})
              </Button>
            </div>
            <PowerStandingNote power={numberValue(power.ItemPower)} level={getAttribute(save, "Level")} />
          </div>
        )}

        <PredictedStats save={save} entry={entry} index={index} />
        <EffectsEditor save={save} onChange={onChange} entry={entry} index={index} />

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Stack Count</Label>
          <Input
            type="number"
            value={numberValue(entry.StackCount)}
            min={1}
            onChange={(e) => onChange(setStackCount(save, index, Math.max(1, parseNumber(e.target.value, 9999))))}
            className="font-mono bg-muted border-border text-foreground"
          />
        </div>

        {!merchant && slots.length > 0 && (
          <EnumSelect
            label="Equipped Slot"
            value={entry.EquippedSlot}
            options={slots}
            labels={Object.fromEntries([...slots, entry.EquippedSlot].map((s) => [s, equipSlotName(s)]))}
            allowNone
            onChange={(v) => onChange(setEquippedSlot(save, index, v || NO_SLOT))}
          />
        )}

        {merchant && (
          <div className="space-y-3 p-3 rounded-md bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground">
              This item is on sale at the Village Merchant ({humanizeTag(entry.ItemData.TargetSlotOverride)}).
            </p>
            <div className="flex items-center justify-between">
              <Label htmlFor="merchant-sold" className="text-sm cursor-pointer">
                Marked as sold
              </Label>
              <Checkbox
                id="merchant-sold"
                checked={entry.MerchantItemSold}
                onCheckedChange={(checked) => onChange(setMerchantSold(save, index, !!checked))}
              />
            </div>
            <Button size="sm" className="w-full" onClick={() => onChange(claimMerchantItem(save, index))}>
              <Store className="w-4 h-4 mr-2" />
              Claim for Free
            </Button>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-transparent"
            onClick={() => {
              onChange(duplicateItem(save, index))
              onSelect(entryCount)
            }}
          >
            <Copy className="w-4 h-4 mr-2" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-transparent text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => {
              onChange(deleteItem(save, index))
              onSelect(null)
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AddItemDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (item: CatalogItem) => void
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<ItemCategory | "all">("all")
  const q = query.trim().toLowerCase()
  const categories = CATEGORY_ORDER.filter((c) => catalog.items.some((i) => i.category === c))
  const filtered = catalog.items.filter(
    (i) =>
      (category === "all" || i.category === category) &&
      (!q || i.name.toLowerCase().includes(q) || i.tag.toLowerCase().includes(q)),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Item</DialogTitle>
          <DialogDescription>
            {catalog.items.length} items from the game catalog. New gear gets a power level based on your character
            level; unique items are added as Unique.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            className="pl-9 bg-muted border-border"
            autoFocus
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant={category === "all" ? "secondary" : "ghost"} onClick={() => setCategory("all")}>
            All
          </Button>
          {categories.map((c) => {
            const Icon = CATEGORY_ICONS[c]
            return (
              <Button key={c} size="sm" variant={category === c ? "secondary" : "ghost"} onClick={() => setCategory(c)}>
                <Icon className="w-3.5 h-3.5 mr-1.5" />
                {CATEGORY_LABELS[c]}
              </Button>
            )
          })}
        </div>
        <ScrollArea className="h-96">
          <div className="space-y-1 pr-3">
            {filtered.map((item) => {
              return (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => onPick(item)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-start gap-3"
                >
                  <ItemIcon tag={item.tag} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-foreground">{item.name}</span>
                      {item.unique && (
                        <Badge variant="outline" className={`text-[10px] ${rarityColor(UNIQUE_RARITY)}`}>
                          Unique
                        </Badge>
                      )}
                      {item.armorPiece && (
                        <Badge variant="outline" className="text-[10px]">
                          {item.armorPiece}
                        </Badge>
                      )}
                      <ProductBadge product={item.product} />
                    </span>
                    {item.description && (
                      <span className="block text-xs text-muted-foreground line-clamp-2">{item.description}</span>
                    )}
                  </span>
                </button>
              )
            })}
            {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No matches</p>}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ── Quests & achievements ───────────────────────────────────────────────

function StateSelect({
  value,
  options,
  labels = {},
  onChange,
  className = "w-36",
}: {
  value: string
  options: string[]
  labels?: Record<string, string>
  onChange: (value: string) => void
  className?: string
}) {
  const all = options.includes(value) ? options : [...options, value]
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 bg-background border-border text-foreground text-xs ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {all.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {labels[s] ?? s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function QuestsPanel({ save, onChange }: SaveProps) {
  const questData = save.CharacterSaveV1.quest
  const quests = questData?.Quests ?? []

  if (quests.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8 text-center text-muted-foreground">No quests found in this save.</CardContent>
      </Card>
    )
  }

  const questLabels = Object.fromEntries(
    quests.map((q) => [q.QuestName, questName(q.QuestName) ? `${questName(q.QuestName)} (${q.QuestName})` : q.QuestName]),
  )

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-yellow-400" />
            Quests
          </span>
          <span className="flex items-center gap-2 text-sm font-normal">
            <span className="text-muted-foreground">Tracked quest</span>
            <StateSelect
              value={questData?.FocusedQuestId ?? ""}
              options={quests.map((q) => q.QuestName)}
              labels={questLabels}
              className="w-64"
              onChange={(v) => onChange(setFocusedQuest(save, v))}
            />
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Completing story quests out of order can break progression. Keep a backup of your original save.
        </p>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple">
          {quests.map((quest) => {
            const done = quest.TaskData.filter((t) => t.State === "Completed").length
            const friendly = questName(quest.QuestName)
            return (
              <AccordionItem key={quest.QuestName} value={quest.QuestName}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 flex-wrap text-left">
                    <span className="font-medium">{friendly ?? quest.QuestName}</span>
                    {friendly && <span className="text-xs font-mono text-muted-foreground">{quest.QuestName}</span>}
                    <Badge variant="outline" className={`text-xs ${stateColor(quest.State)}`}>
                      {quest.State}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {done}/{quest.TaskData.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {questDescription(quest.QuestName) && (
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      {questDescription(quest.QuestName)}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Quest state</Label>
                      <StateSelect
                        value={quest.State}
                        options={QUEST_STATES}
                        onChange={(v) => onChange(setQuestState(save, quest.QuestName, v))}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                      onClick={() => onChange(completeQuest(save, quest.QuestName))}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Complete Quest
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {quest.TaskData.map((task) => (
                      <div
                        key={task.TaskName}
                        className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50 gap-2"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm text-foreground">
                            {objectiveName(task.TaskName) ?? task.TaskName}
                          </span>
                          {objectiveName(task.TaskName) && (
                            <span className="block text-[11px] font-mono text-muted-foreground">{task.TaskName}</span>
                          )}
                        </span>
                        <span className="flex items-center gap-2">
                          {numberValue(task.PartialProgress) > 0 && (
                            <span className="text-xs text-muted-foreground font-mono">
                              progress {numberValue(task.PartialProgress)}
                            </span>
                          )}
                          <StateSelect
                            value={task.State}
                            options={TASK_STATES}
                            onChange={(v) => onChange(setTaskState(save, quest.QuestName, task.TaskName, v))}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </CardContent>
    </Card>
  )
}

const BOOL_GROUPS: { id: BoolAchievementGroup; label: string }[] = [
  { id: "QuestAchievements", label: "Quest Achievements" },
  { id: "BoolAchievements", label: "Milestones" },
]

function achievementName(tag: string): string {
  return (
    achievementInfo(tag)?.name ??
    humanizeTag(tag.replace(/^SW\.Achievements\./, "").replace(/^Complete(.+)Quest$/, "$1"))
  )
}

function AchievementsPanel({ save, onChange }: SaveProps) {
  const a = save.CharacterSaveV1.Achievements ?? {}
  const counts = Object.entries(a.CountAchievements ?? {})
  // Minecart stations get their own panel (they're also stored in WorldExploration).
  const collections = Object.entries(a.CollectionAchievements ?? {}).filter(([tag]) => tag !== MINECART_ACHIEVEMENT)

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Achievements
          </span>
          <Button
            variant="outline"
            size="sm"
            className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
            onClick={() => onChange(completeAllAchievements(save, achievementTargets()))}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Complete All
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={["QuestAchievements"]}>
          {BOOL_GROUPS.map((group) => {
            const items = Object.entries(a[group.id] ?? {})
            if (items.length === 0) return null
            const done = items.filter(([, v]) => v.bCompleted).length
            return (
              <AccordionItem key={group.id} value={group.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{group.label}</span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {done}/{items.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1">
                    {items.map(([tag, value]) => {
                      const quest = achievementInfo(tag)?.quest
                      return (
                        <div
                          key={tag}
                          className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50"
                        >
                          <Label className="text-sm cursor-pointer flex items-center gap-2" htmlFor={tag}>
                            {achievementName(tag)}
                            {quest && <span className="text-xs font-mono text-muted-foreground">{quest}</span>}
                          </Label>
                          <Checkbox
                            id={tag}
                            checked={value.bCompleted}
                            onCheckedChange={(checked) => onChange(setBoolAchievement(save, group.id, tag, !!checked))}
                          />
                        </div>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}

          {counts.length > 0 && (
            <AccordionItem value="counts">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="font-medium">Counters</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {counts.filter(([tag, v]) => numberValue(v.Count) >= (achievementInfo(tag)?.target ?? Infinity)).length}/
                    {counts.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                  {counts.map(([tag, value]) => {
                    const target = achievementInfo(tag)?.target
                    return (
                      <div
                        key={tag}
                        className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50 gap-2"
                      >
                        <span className="text-sm">{achievementName(tag)}</span>
                        <span className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={numberValue(value.Count)}
                            onChange={(e) =>
                              onChange(setCountAchievement(save, tag, parseNumber(e.target.value, 999999)))
                            }
                            className="w-24 h-8 font-mono bg-muted border-border text-foreground"
                          />
                          {target !== undefined && (
                            <>
                              <span className="text-xs text-muted-foreground font-mono w-12">/ {target}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-primary"
                                onClick={() => onChange(setCountAchievement(save, tag, target))}
                              >
                                Max
                              </Button>
                            </>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {collections.map(([tag, value]) => {
            const info = achievementInfo(tag)
            const required = info?.collection ?? []
            const collected = new Set(value.CollectedTags)
            const all = [...new Set([...required, ...value.CollectedTags])]
            return (
              <AccordionItem key={tag} value={tag}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{achievementName(tag)}</span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {required.filter((t) => collected.has(t)).length}/{required.length || value.CollectedTags.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {info?.maxEnchantLevel && (
                    <p className="text-xs text-muted-foreground px-3 mb-2">
                      Tracks equipment slots holding level {info.maxEnchantLevel} enchantments.
                    </p>
                  )}
                  <div className="flex justify-end px-3 mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                      onClick={() => onChange(required.reduce((s, t) => setCollectionTag(s, tag, t, true), save))}
                    >
                      Collect All
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    {all.map((t) => (
                      <div key={t} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50">
                        <Label className="text-sm cursor-pointer" htmlFor={`${tag}-${t}`} title={t}>
                          {collectionTagName(t)}
                        </Label>
                        <Checkbox
                          id={`${tag}-${t}`}
                          checked={collected.has(t)}
                          onCheckedChange={(checked) => onChange(setCollectionTag(save, tag, t, !!checked))}
                        />
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </CardContent>
    </Card>
  )
}

function MinecartPanel({ save, onChange }: SaveProps) {
  const discovered = new Set(save.CharacterSaveV1.WorldExploration?.DiscoveredMinecartStationTags ?? [])
  const stations = [...new Set([...catalog.minecartStations, ...discovered])].sort((x, y) =>
    stationName(x).localeCompare(stationName(y)),
  )

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <TrainFront className="w-5 h-5 text-blue-400" />
            Minecart Stations
            <Badge variant="secondary" className="font-mono text-xs">
              {stations.filter((s) => discovered.has(s)).length}/{stations.length}
            </Badge>
          </span>
          <Button
            variant="outline"
            size="sm"
            className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
            onClick={() => onChange(unlockAllMinecartStations(save, catalog.minecartStations))}
          >
            <TrainFront className="w-4 h-4 mr-2" />
            Unlock All
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Discovered stations are available for fast travel. Updates the &quot;Discover All Minecart Stations&quot;
          achievement too.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4">
          {stations.map((station) => (
            <div key={station} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50">
              <Label className="text-sm cursor-pointer" htmlFor={station} title={station}>
                {stationName(station)}
              </Label>
              <Checkbox
                id={station}
                checked={discovered.has(station)}
                onCheckedChange={(checked) => onChange(setMinecartStation(save, station, !!checked))}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Predicted stats ─────────────────────────────────────────────────────

function StatRow({ label, value, base, hint }: { label: string; value: React.ReactNode; base?: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1" title={hint}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-mono text-foreground text-right">
        {value}
        {base !== undefined && base !== value && <span className="ml-2 text-xs text-muted-foreground line-through">{base}</span>}
      </span>
    </div>
  )
}

function PowerStandingNote({ power, level }: { power: number; level: number }) {
  const { ratio, standing } = powerStanding(power, level)
  const color =
    standing === "very-low" ? "text-red-400" : standing === "above" ? "text-green-400" : "text-muted-foreground"
  return (
    <p className={`text-[11px] ${color}`}>
      {Math.round(ratio * 100)}% of your level {level}
      {standing === "very-low" && ` — "Very Low" power (under ${GEAR_RULES.veryLowPowerRatio * 100}%), damage drops hard`}
      {standing === "above" && ` — damage scales up to ${GEAR_RULES.powerMultiplierCap}x against the area`}
    </p>
  )
}

function EffectLine({ effect }: { effect: ItemEffectInfo }) {
  const label =
    effect.kind === "enchantment" ? "Enchantment" : effect.kind === "talisman" ? "Talisman" : "Rolled effect"
  // Enchantments aren't in the gear tables; name them from the game catalog and
  // show the stored value (its display format isn't known).
  const enchant = effect.name ? undefined : enchantmentInfo(effect.tag)
  const name = effect.name ?? enchant?.name ?? humanizeTag(effect.tag)
  const text = effect.text ?? enchant?.description?.replace("{0}", "X")
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-foreground">
          {name}
          {effect.tier && <span className="ml-1.5 text-xs text-muted-foreground">{effect.tier}</span>}
        </span>
        <span className="flex items-center gap-1.5">
          {isAlwaysOn(effect) && (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
              in prediction
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {label}
          </Badge>
          <span className="text-sm font-mono text-foreground">
            {effect.valueLabel ?? (effect.flag ? "✓" : round(effect.raw, 3))}
          </span>
        </span>
      </div>
      {text && <p className="text-[11px] text-muted-foreground">{text}</p>}
    </div>
  )
}

/** Weapon stats: base values from the game's tables, adjusted by this item's always-on effects. */
function PredictedStats({ save, entry, index }: { save: CharacterSave; entry: InventoryEntry; index: number }) {
  const tag = entry.ItemData.TypeTag
  const info = itemInfo(tag)
  const bases = info?.baseOf ?? []
  const effects = itemEffects(entry)
  const melee = meleeStats(tag, bases)
  const ranged = rangedStats(tag, bases)
  const category = itemCategory(tag)

  // Compare against whatever is equipped in this item's slot type.
  const entries = save.CharacterSaveV1.Inventory?.Entries ?? []
  const equippedIndex = entries.findIndex(
    (e, i) => i !== index && e.EquippedSlot !== NO_SLOT && itemCategory(e.ItemData.TypeTag) === category,
  )
  const equipped = equippedIndex >= 0 ? entries[equippedIndex] : undefined

  if (!melee && !ranged && category !== "armor") return null

  const delta = (mine: number, theirs: number) => {
    const d = round(mine - theirs)
    if (d === 0) return <span className="text-muted-foreground">same as equipped</span>
    return (
      <span className={d > 0 ? "text-green-400" : "text-red-400"}>
        {d > 0 ? "+" : ""}
        {d} vs equipped {itemName(equipped!.ItemData.TypeTag)}
      </span>
    )
  }

  return (
    <div className="space-y-3 p-3 rounded-md bg-muted/40 border border-border">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">Predicted Stats</Label>
        <span className="text-[10px] text-muted-foreground">base values · before Item Power scaling</span>
      </div>

      {melee &&
        (() => {
          const p = predictMelee(melee, effects)
          const other = equipped && meleeStats(equipped.ItemData.TypeTag, itemInfo(equipped.ItemData.TypeTag)?.baseOf)
          const otherTotal = other && predictMelee(other, itemEffects(equipped)).total
          return (
            <div>
              <StatRow label="Combo" value={p.combo} base={p.damageBonus ? formatCombo(melee.combo) : undefined} />
              <StatRow label="Combo total" value={p.total} base={p.damageBonus ? melee.total : undefined} />
              <StatRow label="Jump attack" value={p.jump} base={p.damageBonus ? melee.jump : undefined} />
              <StatRow label="Reach" value={melee.reach} />
              <StatRow
                label={`Splash (${Math.round(melee.splash * 100)}% to adjacent)`}
                value={p.splashTotal}
                hint="Damage dealt to enemies next to your target over a full combo"
              />
              <StatRow label="Weight" value={humanizeTag(melee.weight)} />
              {otherTotal !== undefined && <p className="text-[11px] text-right">{delta(p.total, otherTotal)}</p>}
            </div>
          )
        })()}

      {ranged &&
        (() => {
          const p = predictRanged(ranged, effects)
          const other = equipped && rangedStats(equipped.ItemData.TypeTag, itemInfo(equipped.ItemData.TypeTag)?.baseOf)
          const otherDps = other && predictRanged(other, itemEffects(equipped)).dps
          return (
            <div>
              <StatRow
                label="Damage per arrow"
                value={ranged.arrows > 1 ? `${p.damage} × ${ranged.arrows}` : p.damage}
                base={p.damageBonus ? (ranged.arrows > 1 ? `${ranged.damage} × ${ranged.arrows}` : ranged.damage) : undefined}
              />
              <StatRow label="Time between shots" value={`${p.rate}s`} base={p.rate !== ranged.rate ? `${ranged.rate}s` : undefined} />
              <StatRow
                label="Damage per second"
                value={p.dps}
                base={p.dps !== p.baseDps ? p.baseDps : undefined}
                hint="Uncharged: damage × arrows ÷ time between shots"
              />
              {p.charged !== undefined && (
                <StatRow
                  label={`Charged shot (${ranged.chargeTime}s)`}
                  value={p.charged}
                  hint={`x${ranged.chargeMultiplier} damage when fully charged`}
                />
              )}
              <StatRow label="Ammo" value={p.ammo} base={p.ammo !== ranged.ammo ? ranged.ammo : undefined} />
              <StatRow label="Reload" value={`${ranged.reload}s`} />
              {otherDps !== undefined && <p className="text-[11px] text-right">{delta(p.dps, otherDps)}</p>}
            </div>
          )
        })()}

      {category === "armor" && (
        <p className="text-[11px] text-muted-foreground">
          Armor has no health or defence stat: a piece is its Item Power plus its effects. Light, medium and heavy is
          only a label.
        </p>
      )}

    </div>
  )
}

/** Everything currently equipped: average power and stacked effect totals. */
function LoadoutCard({ save }: { save: CharacterSave }) {
  const equipped = (save.CharacterSaveV1.Inventory?.Entries ?? []).filter((e) => e.EquippedSlot !== NO_SLOT)
  const gear = equipped.filter((e) => numberValue(e.ItemData.GeneratorData.PowerGeneratorValues.ItemPower) >= 0)
  if (gear.length === 0) return null
  const avgPower =
    gear.reduce((sum, e) => sum + numberValue(e.ItemData.GeneratorData.PowerGeneratorValues.ItemPower), 0) / gear.length
  const totals = effectTotals(equipped)
  const level = getAttribute(save, "Level")

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Swords className="w-5 h-5 text-orange-400" />
          Equipped Loadout
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-md bg-muted/50">
            <div className="text-xs text-muted-foreground">Average gear power</div>
            <div className="text-xl font-mono text-foreground">{round(avgPower)}</div>
            <PowerStandingNote power={avgPower} level={level} />
          </div>
          <div className="p-3 rounded-md bg-muted/50">
            <div className="text-xs text-muted-foreground">Items equipped</div>
            <div className="text-xl font-mono text-foreground">{equipped.length}</div>
          </div>
          <div className="p-3 rounded-md bg-muted/50">
            <div className="text-xs text-muted-foreground">Max drop power</div>
            <div className="text-xl font-mono text-foreground">{maxDropPower(level)}</div>
            <p className="text-[11px] text-muted-foreground">level + {GEAR_RULES.dropPowerAboveLevel}</p>
          </div>
          <div className="p-3 rounded-md bg-muted/50">
            <div className="text-xs text-muted-foreground">Damage scaling cap</div>
            <div className="text-xl font-mono text-foreground">{GEAR_RULES.powerMultiplierCap}x</div>
            <p className="text-[11px] text-muted-foreground">power vs area level</p>
          </div>
        </div>
        {totals.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">Effect totals across equipped gear</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 mt-1">
              {totals.map((t) => (
                <div key={t.name} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">
                    {t.name}
                    {t.count > 1 && <span className="ml-1 text-xs text-muted-foreground">×{t.count}</span>}
                  </span>
                  <span className="text-sm font-mono">{formatPercent(t.percent)}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Summed per effect; how the game stacks duplicates isn&apos;t confirmed.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Effects editor ──────────────────────────────────────────────────────

/** Talisman levels for a new item, built from the game's level and template tables. */
function talismanLevels(tag: string): TalismanLevelSpec[] | undefined {
  if (itemCategory(tag) !== "talisman") return undefined
  const info = talismanInfo(tag)
  if (!info) return undefined
  return info.levels.map((level, i) => {
    const t = info.templates[i]
    return {
      grantedTag: level.grantedTag || undefined,
      effect: t ? { effect: t.effect, template: t.tag, value: t.fixedValue } : undefined,
    }
  })
}

const TIER_ORDER = ["I", "II", "III", "Unique"]

function batchEffects(entry: InventoryEntry, batchType: string) {
  return entry.ItemData.Effects?.find((b) => b.TypeTag === batchType)?.EffectsInThisBatch ?? []
}

function EffectsEditor({ save, onChange, entry, index }: SaveProps & { entry: InventoryEntry; index: number }) {
  const tag = entry.ItemData.TypeTag
  const rarity = entry.ItemData.RarityTag
  const info = itemInfo(tag)
  const effects = itemEffects(entry)
  const enchantOptions = enchantmentsFor(tag)
  const rolledOptions = rolledEffectsFor(tag)
  const enchants = batchEffects(entry, EFFECT_BATCH.enchantment)
  const rolled = batchEffects(entry, EFFECT_BATCH.rerollable)
  const maxRolled = rolledEffectCount(rarity)
  const talisman = itemCategory(tag) === "talisman" ? talismanInfo(tag) : undefined

  if (!talisman && enchantOptions.length === 0 && rolledOptions.length === 0 && effects.length === 0) return null

  const infoFor = (e: { TypeTag: string; GeneratorData: { GeneratorParentTemplate: string } }) =>
    effects.find((x) => x.tag === e.TypeTag && x.template === e.GeneratorData.GeneratorParentTemplate)

  // ── Enchantment ──
  const setEnchant = (position: number, enchantTag: string, tier: string) => {
    const option = enchantOptions.find((o) => o.tag === enchantTag)
    const t = option?.tiers.find((x) => x.tier === tier) ?? option?.tiers[0]
    if (!option || !t) return
    const level = TIER_ORDER.indexOf(t.tier) + 1
    onChange(
      setItemEffect(save, index, EFFECT_BATCH.enchantment, position, {
        effect: option.tag,
        template: t.tag,
        value: t.value,
        points: enchantPoints(rarity, level),
      }),
    )
  }

  // ── Rolled effects ──
  const rolledTiers = (option: (typeof rolledOptions)[number]) =>
    option.tiers.filter((t) => t.tier !== "Unique" || info?.unique)
  const setRolled = (position: number, template: string, tier: string) => {
    const option = rolledOptions.find((o) => o.template === template)
    const t = option && (rolledTiers(option).find((x) => x.tier === tier) ?? rolledTiers(option)[0])
    if (!option || !t) return
    onChange(setItemEffect(save, index, EFFECT_BATCH.rerollable, position, { effect: option.effect, template: t.tag, value: t.value }))
  }
  const templateOf = (templateTag: string) => templateTag.replace(/\.(I|II|III|Unique)$/, "")
  const tierLabels = Object.fromEntries(TIER_ORDER.map((t) => [t, t === "Unique" ? "Unique" : `Level ${t}`]))

  return (
    <div className="space-y-4 p-3 rounded-md bg-muted/40 border border-border">
      <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">Enchantments &amp; Effects</Label>

      {enchantOptions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Enchantment</span>
            <span className="text-[10px] text-muted-foreground">
              {enchants.length}/{MAX_ENCHANTMENTS_PER_ITEM}
            </span>
          </div>
          {enchants.map((e, position) => {
            const current = enchantOptions.find((o) => o.tag === e.TypeTag)
            const tier = e.GeneratorData.GeneratorParentTemplate.split(".").pop() ?? "I"
            const fx = infoFor(e)
            return (
              <div key={position} className="space-y-2 p-2 rounded bg-background/60 border border-border">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <EnumSelect
                    label="Enchantment"
                    value={e.TypeTag}
                    options={enchantOptions.map((o) => o.tag)}
                    labels={Object.fromEntries(enchantOptions.map((o) => [o.tag, o.name]))}
                    descriptions={Object.fromEntries(
                      enchantOptions.filter((o) => o.description).map((o) => [o.tag, o.description!.replace(/\{\d\}/g, "X")]),
                    )}
                    onChange={(v) => setEnchant(position, v, tier)}
                  />
                  <StateSelect
                    value={tier}
                    options={(current?.tiers ?? []).map((t) => t.tier)}
                    labels={tierLabels}
                    className="w-28"
                    onChange={(v) => setEnchant(position, e.TypeTag, v)}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {numberValue(e.EnchantmentPointsInvested)} enchantment point
                    {numberValue(e.EnchantmentPointsInvested) === 1 ? "" : "s"} invested
                    {fx?.valueLabel && ` · ${fx.valueLabel}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive"
                    onClick={() => onChange(removeItemEffect(save, index, EFFECT_BATCH.enchantment, position))}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            )
          })}
          {enchants.length < MAX_ENCHANTMENTS_PER_ITEM && (
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-transparent"
              onClick={() => setEnchant(enchants.length, enchantOptions[0].tag, "I")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Enchantment
            </Button>
          )}
        </div>
      )}

      {(rolledOptions.length > 0 || rolled.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Rolled effects</span>
            <span className={`text-[10px] ${rolled.length > maxRolled ? "text-amber-400" : "text-muted-foreground"}`}>
              {rolled.length}/{maxRolled} for {rarityName(rarity)}
            </span>
          </div>
          {rolled.map((e, position) => {
            const template = templateOf(e.GeneratorData.GeneratorParentTemplate)
            const option = rolledOptions.find((o) => o.template.toLowerCase() === template.toLowerCase())
            const tier = e.GeneratorData.GeneratorParentTemplate.split(".").pop() ?? "I"
            const fx = infoFor(e)
            return (
              <div key={position} className="space-y-1 p-2 rounded bg-background/60 border border-border">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <EnumSelect
                    label="Effect"
                    value={option?.template ?? template}
                    options={rolledOptions.map((o) => o.template)}
                    labels={Object.fromEntries([
                      ...rolledOptions.map((o) => [o.template, o.name]),
                      [template, fx?.name ?? humanizeTag(template)],
                    ])}
                    onChange={(v) => setRolled(position, v, tier)}
                  />
                  <StateSelect
                    value={tier}
                    options={option ? rolledTiers(option).map((t) => t.tier) : [tier]}
                    labels={tierLabels}
                    className="w-28"
                    onChange={(v) => option && setRolled(position, option.template, v)}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {fx?.text ?? ""}
                    {fx && isAlwaysOn(fx) && " · included in predicted stats"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive shrink-0"
                    onClick={() => onChange(removeItemEffect(save, index, EFFECT_BATCH.rerollable, position))}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
          {rolledOptions.length > 0 && rolled.length < maxRolled && (
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-transparent"
              onClick={() => setRolled(rolled.length, rolledOptions[0].template, "I")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Effect
            </Button>
          )}
          {maxRolled === 0 && rolled.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              {rarityName(rarity)} items don&apos;t roll effects. Raise the rarity to add some.
            </p>
          )}
          {rolled.length > maxRolled && (
            <p className="text-[11px] text-amber-400">
              More effects than a {rarityName(rarity)} item normally rolls.
            </p>
          )}
        </div>
      )}

      {talisman && <TalismanEditor save={save} onChange={onChange} entry={entry} index={index} levels={talisman.levels} />}

      {/* Effects the editor can't manage (unknown to the catalog) are still shown. */}
      {effects
        .filter((e) => e.kind !== "talisman" && !enchantOptions.some((o) => o.tag === e.tag) && !rolledOptions.some((o) => o.effect === e.tag))
        .map((e, i) => (
          <EffectLine key={`other-${i}`} effect={e} />
        ))}
    </div>
  )
}

function TalismanEditor({
  save,
  onChange,
  entry,
  index,
  levels,
}: SaveProps & { entry: InventoryEntry; index: number; levels: { level: number; xpForNext: number }[] }) {
  const progression = entry.ItemData.ItemProgression
  const levelIndex = numberValue(progression.CurrentLevel)
  const xp = numberValue(progression.CurrentXP)
  const needed = levels[levelIndex]?.xpForNext ?? 0
  const current = itemEffects(entry).filter((e) => e.kind === "talisman")

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Talisman level</Label>
          <StateSelect
            value={String(levelIndex)}
            options={levels.map((_, i) => String(i))}
            labels={Object.fromEntries(levels.map((l, i) => [String(i), `Level ${l.level}`]))}
            className="w-full"
            onChange={(v) => onChange(setTalismanProgress(save, index, Number(v), 0))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">XP {needed > 0 ? `(of ${needed.toLocaleString()})` : "(max level)"}</Label>
          <Input
            type="number"
            value={xp}
            min={0}
            max={needed > 0 ? needed - 1 : undefined}
            onChange={(e) =>
              onChange(
                setTalismanProgress(save, index, levelIndex, parseNumber(e.target.value, needed > 0 ? needed - 1 : 0)),
              )
            }
            className="h-8 font-mono bg-muted border-border text-foreground"
          />
        </div>
      </div>
      {current.map((e, i) => (
        <EffectLine key={i} effect={e} />
      ))}
      {current.length === 0 && (
        <p className="text-[11px] text-muted-foreground">This talisman grants a companion ability rather than a stat.</p>
      )}
    </div>
  )
}
