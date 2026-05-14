"use client"

import { useState } from "react"
import {
  Sparkles,
  ArrowLeft,
  Coins,
  Package,
  Sword,
  Trophy,
  Code,
  FlaskConical,
  Layers,
  Wrench,
  Crown,
  Smile,
  Mountain,
  Map as MapIcon,
} from "lucide-react"
import Link from "next/link"
import Head from "next/head"
import { track } from "@vercel/analytics"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"

import { SaveFileUpload } from "@/components/save-file-upload"
import { SaveLocationHelp } from "@/components/save-location-help"
import { EditorSidebar } from "@/components/editor-sidebar"
import { JsonTreeEditor } from "@/components/json-tree-editor"

import { decodeSaveFromFile, encodeSaveToBlob, type FFWSave } from "@/lib/far-far-west/decoder"
import { EnumSelect } from "@/components/save-fields/EnumSelect"
import {
  setInventoryAmount,
  maxCurrencies,
  maxCraftingMaterials,
  unlockAllDifficulties,
  setUnlockedDifficulties,
  setSelectedSkin,
  setSpell,
  setSelectedEmote,
  setSelectedUtility,
  setFragmentTrackedWeapon,
  setWeaponTweak,
  setEquippedJoker,
  setChallengeStat,
  setLoadoutField,
  unlockOwnedSkins,
  unlockOwnedJokers,
  unlockOwnedMounts,
  unlockOwnedEmotes,
  unlockOwnedMaps,
  unlockOwnedTitles,
  maxItemLevels,
  maxWeaponUpgrades,
  stackAllItems,
  upgradeCapFor,
  INT32_MAX,
  KNOWN_LOADOUT_FIELDS,
} from "./save-mutations"

import gamesData from "@/data/games.json"
import itemsCatalog from "@/data/far-far-west/items.json"
import challengesCatalog from "@/data/far-far-west/challenges.json"
import enemiesCatalog from "@/data/far-far-west/enemies.json"

const CATEGORIES = itemsCatalog.categories as Record<string, string[]>
const ITEM_LABELS = itemsCatalog.labels as Record<string, string>
const ITEM_DESCRIPTIONS = (itemsCatalog as { descriptions?: Record<string, string> }).descriptions ?? {}
const CHALLENGE_LABELS = challengesCatalog.labels as Record<string, string>
const CHALLENGE_DESCRIPTIONS = (challengesCatalog as { descriptions?: Record<string, string> }).descriptions ?? {}
const ENEMY_LABELS = (enemiesCatalog as { labels?: Record<string, string> }).labels ?? {}

interface ItemAttrs {
  element?: string | null
  iconPath?: string | null
  bpPath?: string | null
  longName?: string | null
  rarity?: string | null
  unlockedVia?: string | null
  type?: string | null
  class?: string | null
}
const ITEM_ATTRS = ((itemsCatalog as { attributes?: Record<string, ItemAttrs> }).attributes ?? {})
const ENEMY_ATTRS = ((enemiesCatalog as { attributes?: Record<string, ItemAttrs> }).attributes ?? {})

function splitCamel(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b./g, (c) => c.toUpperCase())
}

function labelFor(id: string, overrides: Record<string, string> = ITEM_LABELS): string {
  return overrides[id] ?? splitCamel(id)
}

// Per-element tint used by the small dot badge next to spell / joker /
// material entries. Matches the in-game element palette.
const ELEMENT_TINT: Record<string, { dot: string; ring: string }> = {
  Acid:   { dot: "bg-green-500",   ring: "ring-green-500/40" },
  Cactus: { dot: "bg-emerald-500", ring: "ring-emerald-500/40" },
  Elec:   { dot: "bg-yellow-400",  ring: "ring-yellow-400/40" },
  Fire:   { dot: "bg-red-500",     ring: "ring-red-500/40" },
  Voodoo: { dot: "bg-purple-500",  ring: "ring-purple-500/40" },
}

// Tiny element indicator dot. Hover text gives the element name.
function ElementDot({ element }: { element?: string | null }) {
  if (!element) return null
  const tint = ELEMENT_TINT[element]?.dot ?? "bg-gray-400"
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${tint}`}
      aria-label={element}
      title={element}
    />
  )
}

// Rarity placeholder. Always renders nothing for now because rarity is
// usmap-locked for Far Far West (every value is null). Kept in the JSX so
// the layout is wired for when the data lands.
function RarityBadge({ rarity }: { rarity?: string | null }) {
  if (!rarity) return null
  return <Badge variant="outline" className="text-[10px] uppercase">{rarity}</Badge>
}

// Render an icon for an item. We have the in-game asset *path* but no
// PNG bundle yet — show a minimal placeholder rendered from the asset
// name so the grid layout already has the slot.
function ItemIcon({ id, attrs, size = 16 }: { id: string; attrs?: ItemAttrs | null; size?: number }) {
  const path = attrs?.iconPath
  const initial = (attrs?.longName ?? ITEM_LABELS[id] ?? id).replace(/^[a-z]+/, "").charAt(0).toUpperCase() || "?"
  return (
    <span
      className="inline-flex items-center justify-center rounded bg-muted text-muted-foreground text-[10px] font-semibold shrink-0"
      style={{ width: size, height: size }}
      title={path ?? undefined}
      aria-label={attrs?.longName ?? labelFor(id)}
    >
      {initial}
    </span>
  )
}

// Composed label: icon + display name + element dot + rarity. Wraps the
// existing `labelFor` in a hoverable span carrying the description as a
// native browser tooltip — falls through silently when no description
// exists. Used everywhere the page currently renders bare `labelFor(id)`.
function ItemLabel({
  id,
  className = "",
  showIcon = true,
  descriptions = ITEM_DESCRIPTIONS,
  attrs = ITEM_ATTRS,
}: {
  id: string
  className?: string
  showIcon?: boolean
  descriptions?: Record<string, string>
  attrs?: Record<string, ItemAttrs>
}) {
  const a = attrs[id]
  const desc = descriptions[id]
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={desc ?? undefined}>
      {showIcon && <ItemIcon id={id} attrs={a} />}
      <span>{a?.longName ?? labelFor(id, ITEM_LABELS)}</span>
      <ElementDot element={a?.element} />
      <RarityBadge rarity={a?.rarity} />
    </span>
  )
}

// Small "from challenge X" chip when the catalog back-linked an unlock.
function UnlockedViaChip({ id }: { id: string }) {
  const via = ITEM_ATTRS[id]?.unlockedVia
  if (!via) return null
  return (
    <Badge variant="secondary" className="text-[10px] gap-1" title={`Unlocked via ${via}`}>
      <span className="opacity-60">via</span>{CHALLENGE_LABELS[via] ?? labelFor(via, CHALLENGE_LABELS)}
    </Badge>
  )
}

type Progress = {
  selectedPlayerSkin?: string
  selectedMountSkin?: string
  selectedEmoteA?: string
  selectedEmoteB?: string
  selectedEmoteC?: string
  selectedEmoteD?: string
  selectedItemA?: string
  selectedItemB?: string
  selectedItemUtility?: string
  selectedSpellA?: string
  spellB?: string
  spellC?: string
  specialWeaponElement?: string
  fragmentTrackedWeaponName?: string
  title?: string
  unlockedDifficulties?: number
  runtimeInventory?: Record<string, number>
  challenges?: Record<string, number>
  itemsUpgrades?: Record<string, { tweaks?: Record<string, number> }>
  itemJokers?: Record<string, {
    jokerA?: string
    jokerB?: string
    jokerC?: string
    jokerD?: string
    jokers?: string[]
  }>
  rewardedChallenges?: string[]
}

export default function FarFarWestSaveEditor() {
  const [saveData, setSaveData] = useState<FFWSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const gameData = gamesData.games.find((g) => g.id === "far-far-west")
  const progress = (saveData?.friendly.playerProgress ?? {}) as Progress
  const inventory: Record<string, number> = progress.runtimeInventory ?? {}
  const ownedKeys = new Set(Object.keys(inventory))

  const processSaveFile = async (file: File) => {
    setIsProcessing(true)
    try {
      const decoded = await decodeSaveFromFile(file)
      setSaveData(decoded)
      setOriginalFile(file)
      track("file_uploaded", { game: "Far Far West", fileSize: file.size, fileName: file.name })
    } catch (err) {
      console.error("Error processing save file:", err)
      alert(
        "Failed to process save file. Make sure the filename starts with your Steam ID (e.g. 76561198034513767.save).",
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
      track("file_downloaded", { game: "Far Far West", fileName: originalFile.name })
    } catch (err) {
      console.error("Error encoding save file:", err)
      alert("Failed to create edited save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const updateInventory = (key: string, value: string) => {
    if (!saveData) return
    const n = Number.parseInt(value)
    setSaveData(setInventoryAmount(saveData, key, Number.isFinite(n) ? n : 0))
  }

  const updateChallenge = (key: string, value: string) => {
    if (!saveData) return
    const n = Number.parseInt(value)
    setSaveData(setChallengeStat(saveData, key, Number.isFinite(n) ? n : 0))
  }

  const updateTweak = (weapon: string, tweak: string, value: string) => {
    if (!saveData) return
    const n = Number.parseInt(value)
    setSaveData(setWeaponTweak(saveData, weapon, tweak, Number.isFinite(n) ? n : 0))
  }

  const updateDifficulty = (value: string) => {
    if (!saveData) return
    const n = Number.parseInt(value)
    setSaveData(setUnlockedDifficulties(saveData, Number.isFinite(n) ? n : 1))
  }

  const updateEquippedJoker = (weapon: string, slot: "A" | "B" | "C" | "D", id: string) => {
    if (!saveData) return
    setSaveData(setEquippedJoker(saveData, weapon, slot, id))
  }

  const quickStats = saveData
    ? [
        {
          label: "Gold",
          value: (inventory.moneyGold ?? 0).toLocaleString(),
          icon: <Coins className="w-4 h-4 text-yellow-500" />,
        },
        {
          label: "Souls",
          value: (inventory.moneySoul ?? 0).toLocaleString(),
          icon: <Coins className="w-4 h-4 text-cyan-400" />,
        },
        {
          label: "Difficulty",
          value: String(progress.unlockedDifficulties ?? 1),
          icon: <Trophy className="w-4 h-4 text-amber-500" />,
        },
      ]
    : []

  const quickActions = saveData
    ? [
        {
          label: "Max Money",
          onClick: () => setSaveData(maxCurrencies(saveData)),
          icon: <Coins className="w-4 h-4 mr-2" />,
        },
        {
          label: "Max Crafting Materials",
          onClick: () => setSaveData(maxCraftingMaterials(saveData)),
          icon: <FlaskConical className="w-4 h-4 mr-2" />,
        },
        {
          label: "Max Item Levels",
          onClick: () => setSaveData(maxItemLevels(saveData)),
          icon: <Layers className="w-4 h-4 mr-2" />,
        },
        {
          label: "Max Weapon Upgrades",
          onClick: () => setSaveData(maxWeaponUpgrades(saveData)),
          icon: <Wrench className="w-4 h-4 mr-2" />,
        },
        {
          label: "Stack All Items",
          onClick: () => setSaveData(stackAllItems(saveData)),
          icon: <Package className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Difficulties",
          onClick: () => setSaveData(unlockAllDifficulties(saveData)),
          icon: <Trophy className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock Owned Skins",
          onClick: () => setSaveData(unlockOwnedSkins(saveData)),
          icon: <Package className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock Owned Mounts",
          onClick: () => setSaveData(unlockOwnedMounts(saveData)),
          icon: <Mountain className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock Owned Emotes",
          onClick: () => setSaveData(unlockOwnedEmotes(saveData)),
          icon: <Smile className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock Owned Maps",
          onClick: () => setSaveData(unlockOwnedMaps(saveData)),
          icon: <MapIcon className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock Owned Titles",
          onClick: () => setSaveData(unlockOwnedTitles(saveData)),
          icon: <Crown className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock Owned Jokers",
          onClick: () => setSaveData(unlockOwnedJokers(saveData)),
          icon: <Sparkles className="w-4 h-4 mr-2" />,
        },
      ]
    : []

  // Build groups for the inventory tab. A key belongs to a category if it's
  // listed in the catalog; everything else falls into "other".
  const inventoryGroups: Record<string, string[]> = {}
  const knownToCategory: Record<string, string> = {}
  for (const [cat, keys] of Object.entries(CATEGORIES)) {
    for (const k of keys) knownToCategory[k] = cat
  }
  for (const k of Object.keys(inventory)) {
    const cat = knownToCategory[k] ?? "other"
    ;(inventoryGroups[cat] ??= []).push(k)
  }
  const groupOrder = [
    "currency",
    "materials",
    "weapons",
    "utilities",
    "fragments",
    "skins",
    "emotes",
    "mounts",
    "jokers",
    "quests",
    "maps",
    "music",
    "stats",
    "other",
  ]
  const groupLabels: Record<string, string> = {
    currency: "Currency",
    materials: "Crafting Materials",
    weapons: "Weapons",
    utilities: "Utilities",
    fragments: "Fragments",
    skins: "Skins",
    emotes: "Emotes",
    mounts: "Mounts",
    jokers: "Jokers",
    quests: "Quest Items",
    maps: "Maps",
    music: "Music Discs",
    stats: "Run Stats",
    other: "Other",
  }

  // Loadout dropdowns used to be gated to owned items only (workaround for
  // the silent-ignore on structural inserts). The mutations layer now adds
  // missing entries via the raw scaffold, so dropdowns just source the
  // full catalog directly.

  const weaponKeys = Object.keys(progress.itemsUpgrades ?? {})
  const weaponJokerKeys = Object.keys(progress.itemJokers ?? {})

  // Challenge stats: split into "kill counts" and "everything else"
  const challenges = progress.challenges ?? {}
  const challengeKeys = Object.keys(challenges)
  const killKeys = challengeKeys.filter((k) => k.toLowerCase().startsWith("kill") || k === "KillBoss" || k === "KillKamikaze")
  const levelKeys = challengeKeys.filter((k) => k.endsWith("Lvl"))
  const otherChallengeKeys = challengeKeys.filter((k) => !killKeys.includes(k) && !levelKeys.includes(k))

  return (
    <>
      <Head>
        <title>Far Far West Save Editor - Edit Your Far Far West Save Files | EditMySave</title>
        <meta
          name="description"
          content="Free online Far Far West save editor. Edit currencies, inventory, loadout, weapon upgrades, and progression for your Far Far West save files. Works entirely in your browser."
        />
      </Head>
      <main className="min-h-screen bg-background pb-20">
        <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
          <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Far Far West</h1>
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
                <h2 className="text-3xl font-bold text-foreground">Far Far West Save Editor</h2>
                <p className="text-muted-foreground">
                  Edit currencies, inventory, loadout, and progression
                </p>
              </div>

              {gameData && <SaveLocationHelp platforms={gameData.platforms} gameName={gameData.name} />}

              <SaveFileUpload
                onFileSelect={processSaveFile}
                acceptedFileTypes=".save"
                isProcessing={isProcessing}
              />
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
                  <TabsList className="grid w-full grid-cols-5 bg-card border border-border">
                    <TabsTrigger value="currencies" className="data-[state=active]:bg-muted">
                      <Coins className="w-4 h-4 mr-2" />
                      Currencies
                    </TabsTrigger>
                    <TabsTrigger value="inventory" className="data-[state=active]:bg-muted">
                      <Package className="w-4 h-4 mr-2" />
                      Inventory
                    </TabsTrigger>
                    <TabsTrigger value="loadout" className="data-[state=active]:bg-muted">
                      <Sword className="w-4 h-4 mr-2" />
                      Loadout
                    </TabsTrigger>
                    <TabsTrigger value="progression" className="data-[state=active]:bg-muted">
                      <Trophy className="w-4 h-4 mr-2" />
                      Progression
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="data-[state=active]:bg-muted">
                      <Code className="w-4 h-4 mr-2" />
                      JSON Tree
                    </TabsTrigger>
                  </TabsList>

                  {/* ---------------- Currencies ---------------- */}
                  <TabsContent value="currencies" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {CATEGORIES.currency.filter((k) => ownedKeys.has(k)).map((k) => (
                        <Card key={k} className="bg-card border-border">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-foreground">
                              <Coins className={k === "moneyGold" ? "w-5 h-5 text-yellow-500" : "w-5 h-5 text-cyan-400"} />
                              <ItemLabel id={k} showIcon={false} />
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Input
                              type="number"
                              value={inventory[k]}
                              onChange={(e) => updateInventory(k, e.target.value)}
                              min={0}
                              max={INT32_MAX}
                              className="font-mono text-lg bg-muted border-border text-foreground"
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-foreground flex items-center gap-2">
                            <FlaskConical className="w-5 h-5 text-fuchsia-400" />
                            Crafting Materials
                          </CardTitle>
                          <Button
                            onClick={() => setSaveData(maxCraftingMaterials(saveData))}
                            variant="outline"
                            size="sm"
                            className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                          >
                            Max All
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {CATEGORIES.materials.filter((k) => ownedKeys.has(k)).map((k) => (
                            <div key={k} className="space-y-2 p-3 bg-muted rounded-lg border border-border">
                              <Label className="text-sm font-medium text-card-foreground"><ItemLabel id={k} /></Label>
                              <Input
                                type="number"
                                value={inventory[k]}
                                onChange={(e) => updateInventory(k, e.target.value)}
                                min={0}
                                max={INT32_MAX}
                                className="font-mono bg-background border-border text-foreground"
                              />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* ---------------- Inventory ---------------- */}
                  <TabsContent value="inventory" className="space-y-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <CardTitle className="text-foreground">Runtime Inventory</CardTitle>
                        <p className="text-xs text-muted-foreground pt-1">
                          Edits modify existing entries only. New items can only be added by playing the game.
                        </p>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <Accordion type="multiple" defaultValue={["weapons", "skins", "jokers"]}>
                          {groupOrder
                            .filter((g) => inventoryGroups[g] && inventoryGroups[g].length > 0)
                            .filter((g) => g !== "currency" && g !== "materials")
                            .map((g) => (
                              <AccordionItem value={g} key={g} className="border-border">
                                <AccordionTrigger className="text-foreground hover:no-underline">
                                  <span className="flex items-center gap-2">
                                    {groupLabels[g] ?? g}
                                    <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                      {inventoryGroups[g].length}
                                    </Badge>
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                                    {inventoryGroups[g].sort().map((k) => {
                                      const hasLvl = Object.prototype.hasOwnProperty.call(challenges, `${k}Lvl`)
                                      return (
                                        <div key={k} className="space-y-2 p-3 bg-muted rounded-lg border border-border">
                                          <Label className="text-sm font-medium text-card-foreground">
                                            <span className="inline-flex items-center gap-1.5 flex-wrap">
                                              <ItemLabel id={k} />
                                              <UnlockedViaChip id={k} />
                                            </span>
                                          </Label>
                                          {ITEM_DESCRIPTIONS[k] && (
                                            <p className="text-[11px] text-muted-foreground italic leading-snug line-clamp-2">
                                              {ITEM_DESCRIPTIONS[k]}
                                            </p>
                                          )}
                                          <Input
                                            type="number"
                                            value={inventory[k]}
                                            onChange={(e) => updateInventory(k, e.target.value)}
                                            min={0}
                                            max={INT32_MAX}
                                            className="font-mono bg-background border-border text-foreground"
                                          />
                                          {hasLvl && (
                                            <p className="text-[10px] text-muted-foreground">
                                              synced to <code>challenges.{k}Lvl</code>
                                            </p>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                        </Accordion>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* ---------------- Loadout ---------------- */}
                  <TabsContent value="loadout" className="space-y-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <CardTitle className="text-foreground">Equipped Loadout</CardTitle>
                        <p className="text-xs text-muted-foreground pt-1">
                          Fields only render when present in your save.
                        </p>
                      </CardHeader>
                      <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Catalog-backed pickers. The save-mutations layer now
                            supports adding fields that aren't yet in the save,
                            so each list is the full catalog (not just owned),
                            and the `in progress` guards from the silent-ignore
                            era are gone. */}
                        <EnumSelect
                          label="Selected Skin"
                          value={progress.selectedPlayerSkin ?? ""}
                          options={CATEGORIES.skins ?? []}
                          labels={ITEM_LABELS}
                          descriptions={ITEM_DESCRIPTIONS}
                          attributes={ITEM_ATTRS}
                          onChange={(v) => setSaveData(setSelectedSkin(saveData, v))}
                        />
                        <EnumSelect
                          label="Selected Mount"
                          value={progress.selectedMountSkin ?? ""}
                          options={CATEGORIES.mounts ?? []}
                          labels={ITEM_LABELS}
                          descriptions={ITEM_DESCRIPTIONS}
                          attributes={ITEM_ATTRS}
                          onChange={(v) => setSaveData(setLoadoutField(saveData, "selectedMountSkin", v))}
                        />
                        <EnumSelect
                          label="Emote A"
                          value={progress.selectedEmoteA ?? ""}
                          options={CATEGORIES.emotes ?? []}
                          labels={ITEM_LABELS}
                          descriptions={ITEM_DESCRIPTIONS}
                          attributes={ITEM_ATTRS}
                          onChange={(v) => setSaveData(setLoadoutField(saveData, "selectedEmoteA", v))}
                        />
                        <EnumSelect
                          label="Emote B"
                          value={progress.selectedEmoteB ?? ""}
                          options={CATEGORIES.emotes ?? []}
                          labels={ITEM_LABELS}
                          descriptions={ITEM_DESCRIPTIONS}
                          attributes={ITEM_ATTRS}
                          onChange={(v) => setSaveData(setSelectedEmote(saveData, v))}
                        />
                        <EnumSelect
                          label="Emote C"
                          value={progress.selectedEmoteC ?? ""}
                          options={CATEGORIES.emotes ?? []}
                          labels={ITEM_LABELS}
                          descriptions={ITEM_DESCRIPTIONS}
                          attributes={ITEM_ATTRS}
                          onChange={(v) => setSaveData(setLoadoutField(saveData, "selectedEmoteC", v))}
                        />
                        <EnumSelect
                          label="Emote D"
                          value={progress.selectedEmoteD ?? ""}
                          options={CATEGORIES.emotes ?? []}
                          labels={ITEM_LABELS}
                          descriptions={ITEM_DESCRIPTIONS}
                          attributes={ITEM_ATTRS}
                          onChange={(v) => setSaveData(setLoadoutField(saveData, "selectedEmoteD", v))}
                        />
                        <EnumSelect
                          label="Item Utility"
                          value={progress.selectedItemUtility ?? ""}
                          options={CATEGORIES.utilities ?? []}
                          labels={ITEM_LABELS}
                          descriptions={ITEM_DESCRIPTIONS}
                          attributes={ITEM_ATTRS}
                          onChange={(v) => setSaveData(setSelectedUtility(saveData, v))}
                        />
                        <EnumSelect
                          label="Spell A"
                          value={progress.selectedSpellA ?? ""}
                          options={CATEGORIES.spells ?? []}
                          labels={ITEM_LABELS}
                          descriptions={ITEM_DESCRIPTIONS}
                          attributes={ITEM_ATTRS}
                          onChange={(v) => setSaveData(setLoadoutField(saveData, "selectedSpellA", v))}
                        />
                        <EnumSelect
                          label="Spell B"
                          value={progress.spellB ?? ""}
                          options={CATEGORIES.spells ?? []}
                          labels={ITEM_LABELS}
                          descriptions={ITEM_DESCRIPTIONS}
                          attributes={ITEM_ATTRS}
                          onChange={(v) => setSaveData(setSpell(saveData, "B", v))}
                        />
                        <EnumSelect
                          label="Spell C"
                          value={progress.spellC ?? ""}
                          options={CATEGORIES.spells ?? []}
                          labels={ITEM_LABELS}
                          descriptions={ITEM_DESCRIPTIONS}
                          attributes={ITEM_ATTRS}
                          onChange={(v) => setSaveData(setSpell(saveData, "C", v))}
                        />
                        <EnumSelect
                          label="Special Weapon Element"
                          value={progress.specialWeaponElement ?? ""}
                          options={["Acid", "Cactus", "Elec", "Fire", "Voodoo"]}
                          labels={{ Acid: "Acid", Cactus: "Cactus", Elec: "Elec", Fire: "Fire", Voodoo: "Voodoo" }}
                          attributes={{
                            Acid:   { element: "Acid" },
                            Cactus: { element: "Cactus" },
                            Elec:   { element: "Elec" },
                            Fire:   { element: "Fire" },
                            Voodoo: { element: "Voodoo" },
                          }}
                          onChange={(v) => setSaveData(setLoadoutField(saveData, "specialWeaponElement", v))}
                        />
                        <EnumSelect
                          label="Fragment-Tracked Weapon"
                          value={progress.fragmentTrackedWeaponName ?? ""}
                          options={CATEGORIES.weapons ?? []}
                          labels={ITEM_LABELS}
                          descriptions={ITEM_DESCRIPTIONS}
                          attributes={ITEM_ATTRS}
                          onChange={(v) => setSaveData(setFragmentTrackedWeapon(saveData, v))}
                        />
                        <EnumSelect
                          label="Title"
                          value={progress.title ?? ""}
                          options={CATEGORIES.titles ?? []}
                          labels={ITEM_LABELS}
                          descriptions={ITEM_DESCRIPTIONS}
                          attributes={ITEM_ATTRS}
                          onChange={(v) => setSaveData(setLoadoutField(saveData, "title", v))}
                        />
                      </CardContent>
                    </Card>

                    {weaponKeys.length > 0 && (
                      <Card className="bg-card border-border">
                        <CardHeader className="border-b border-border">
                          <CardTitle className="text-foreground">Weapon Upgrades</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                          {weaponKeys.map((weapon) => {
                            const tweaks = progress.itemsUpgrades?.[weapon]?.tweaks ?? {}
                            return (
                              <div key={weapon} className="p-4 bg-muted rounded-lg border border-border space-y-3">
                                <div className="flex items-center gap-2">
                                  <Sword className="w-4 h-4 text-amber-500" />
                                  <span className="font-medium text-foreground"><ItemLabel id={weapon} /></span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {Object.entries(tweaks).map(([tweak, value]) => {
                                    const cap = upgradeCapFor(weapon, tweak, value)
                                    return (
                                      <div key={tweak} className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground flex items-center justify-between">
                                          <span>{splitCamel(tweak)}</span>
                                          <span className="text-[10px] opacity-70">max {cap}</span>
                                        </Label>
                                        <Input
                                          type="number"
                                          value={value}
                                          onChange={(e) => updateTweak(weapon, tweak, e.target.value)}
                                          min={0}
                                          max={cap}
                                          className="font-mono bg-background border-border text-foreground"
                                        />
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </CardContent>
                      </Card>
                    )}

                    {weaponJokerKeys.length > 0 && (
                      <Card className="bg-card border-border">
                        <CardHeader className="border-b border-border">
                          <CardTitle className="text-foreground">Equipped Jokers</CardTitle>
                          <p className="text-xs text-muted-foreground pt-1">
                            Set to <code className="px-1 py-0.5 bg-muted rounded">None</code> to clear a slot.
                          </p>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                          {weaponJokerKeys.map((weapon) => {
                            const slots = progress.itemJokers?.[weapon] ?? {}
                            return (
                              <div key={weapon} className="p-4 bg-muted rounded-lg border border-border space-y-3">
                                <div className="flex items-center gap-2">
                                  <Sword className="w-4 h-4 text-amber-500" />
                                  <span className="font-medium text-foreground"><ItemLabel id={weapon} /></span>
                                  {(slots.jokers?.length ?? 0) > 0 && (
                                    <Badge variant="secondary" className="bg-background text-muted-foreground">
                                      {slots.jokers!.length} owned
                                    </Badge>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {(["A", "B", "C", "D"] as const).map((slot) => {
                                    const current = (slots as Record<string, string | undefined>)[`joker${slot}`] ?? "None"
                                    return (
                                      <EnumSelect
                                        key={slot}
                                        label={`Slot ${slot}`}
                                        value={current}
                                        options={CATEGORIES.jokers ?? []}
                                        labels={ITEM_LABELS}
                                        descriptions={ITEM_DESCRIPTIONS}
                                        attributes={ITEM_ATTRS}
                                        allowNone
                                        onChange={(v) => updateEquippedJoker(weapon, slot, v || "None")}
                                      />
                                    )
                                  })}
                                </div>
                                {(slots.jokers?.length ?? 0) > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      Owned ({slots.jokers!.length})
                                    </span>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                      {slots.jokers!.map((j) => (
                                        <div
                                          key={j}
                                          className="text-xs px-2 py-1.5 rounded border border-border bg-background space-y-0.5"
                                        >
                                          <div className="inline-flex items-center gap-1.5 font-medium text-foreground">
                                            <span>{ITEM_LABELS[j] ?? labelFor(j)}</span>
                                            <ElementDot element={ITEM_ATTRS[j]?.element ?? null} />
                                          </div>
                                          {ITEM_DESCRIPTIONS[j] && (
                                            <div className="text-[10px] text-muted-foreground italic leading-snug line-clamp-2">
                                              {ITEM_DESCRIPTIONS[j]}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* ---------------- Progression ---------------- */}
                  <TabsContent value="progression" className="space-y-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <Trophy className="w-5 h-5 text-amber-500" />
                          Difficulty Unlocked
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Input
                          type="number"
                          value={progress.unlockedDifficulties ?? 1}
                          onChange={(e) => updateDifficulty(e.target.value)}
                          min={1}
                          max={4}
                          className="font-mono text-lg bg-muted border-border text-foreground"
                        />
                        <p className="text-xs text-muted-foreground pt-2">1 = Easy, 4 = highest unlocked tier</p>
                      </CardContent>
                    </Card>

                    {levelKeys.length > 0 && (
                      <ChallengeGroup
                        title="Weapon Levels"
                        keys={levelKeys}
                        data={challenges}
                        onChange={updateChallenge}
                      />
                    )}
                    {killKeys.length > 0 && (
                      <ChallengeGroup
                        title="Kill Counts"
                        keys={killKeys}
                        data={challenges}
                        onChange={updateChallenge}
                      />
                    )}
                    {otherChallengeKeys.length > 0 && (
                      <ChallengeGroup
                        title="Other Stats"
                        keys={otherChallengeKeys}
                        data={challenges}
                        onChange={updateChallenge}
                      />
                    )}

                    {(progress.rewardedChallenges?.length ?? 0) > 0 && (
                      <Card className="bg-card border-border">
                        <CardHeader>
                          <CardTitle className="text-foreground">Rewarded Challenges</CardTitle>
                          <p className="text-xs text-muted-foreground pt-1">
                            Read-only here. Use the JSON Tree tab to edit individual entries (entry count is fixed).
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {progress.rewardedChallenges!.map((c) => (
                              <Badge
                                key={c}
                                variant="secondary"
                                className="bg-muted text-muted-foreground"
                                title={CHALLENGE_DESCRIPTIONS[c] ?? undefined}
                              >
                                {CHALLENGE_LABELS[c] ?? splitCamel(c)}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* ---------------- Raw JSON ---------------- */}
                  <TabsContent value="raw" className="space-y-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <CardTitle className="text-foreground">JSON Tree</CardTitle>
                        <p className="text-xs text-muted-foreground pt-1">
                          Full friendly view of the save. Adding or removing inventory keys / array entries is not supported and will be ignored on download.
                        </p>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <JsonTreeEditor
                          data={saveData.friendly}
                          onChange={(next) => setSaveData({ ...saveData, friendly: next })}
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

function ChallengeGroup({
  title,
  keys,
  data,
  onChange,
}: {
  title: string
  keys: string[]
  data: Record<string, number>
  onChange: (key: string, value: string) => void
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <ScrollArea className="h-[420px] pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {keys.sort().map((k) => {
              const isSynced = k.startsWith("item") && k.endsWith("Lvl")
              const challengeDesc = CHALLENGE_DESCRIPTIONS[k]
              const enemyLabel = ENEMY_LABELS[k]
              return (
                <div key={k} className="space-y-1.5 p-3 bg-muted rounded-lg border border-border">
                  <Label
                    className="text-xs text-muted-foreground inline-flex items-center gap-1.5"
                    title={challengeDesc ?? undefined}
                  >
                    <span>{enemyLabel ?? CHALLENGE_LABELS[k] ?? splitCamel(k)}</span>
                    {ENEMY_ATTRS[k]?.class && (
                      <Badge variant="outline" className="text-[10px]">{ENEMY_ATTRS[k]!.class}</Badge>
                    )}
                  </Label>
                  <Input
                    type="number"
                    value={data[k] ?? 0}
                    onChange={(e) => onChange(k, e.target.value)}
                    min={0}
                    max={INT32_MAX}
                    className="font-mono bg-background border-border text-foreground"
                  />
                  {isSynced && (
                    <p className="text-[10px] text-muted-foreground">
                      syncs <code>runtimeInventory.{k.slice(0, -3)}</code>
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
