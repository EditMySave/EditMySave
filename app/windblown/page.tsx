"use client"

import { useState } from "react"
import {
  Wind,
  ArrowLeft,
  Coins,
  Gem,
  Sparkles,
  Unlock,
  Lock,
  Code,
  User,
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  type WindblownSave,
  type Currencies,
  decodeSaveFromFile,
  encodeSaveToBlob,
  META_FLAG_NAMES,
} from "@/lib/windblown/decoder"
import {
  updateCurrency,
  maxAllCurrencies,
  toggleMetaFlag,
  unlockAllFlags,
  unlockCategoryFlags,
  lockCategoryFlags,
} from "./save-mutations"

// ── Currency definitions ────────────────────────────────────────────────

const CURRENCY_DEFS: { key: keyof Currencies; name: string; icon: typeof Coins; color: string }[] = [
  { key: "cogs", name: "Cogs", icon: Coins, color: "text-yellow-500" },
  { key: "memoniteDust", name: "Memonite Dust", icon: Gem, color: "text-blue-400" },
  { key: "memoniteShard", name: "Memonite Shard", icon: Gem, color: "text-purple-400" },
  { key: "memoniteFragment", name: "Memonite Fragment", icon: Gem, color: "text-emerald-400" },
  { key: "obsidianMemonite", name: "Obsidian Memonite", icon: Gem, color: "text-red-400" },
]

const MAX_CURRENCY = 99999

// ── Meta flag categories ────────────────────────────────────────────────

interface FlagCategory {
  id: string
  label: string
  description: string
  flags: string[]
}

const FLAG_CATEGORIES: FlagCategory[] = [
  {
    id: "progression",
    label: "Progression",
    description: "Core gameplay milestones",
    flags: [
      "UnlockedAWeapon", "SawAMiniBossOrBoss", "UnlockedSelectSpecies",
      "FoundABlueprint", "KilledAMiniBossOrBoss", "VisitedAShop",
      "KilledABoss", "SawABoss", "StartedARun", "DidEatFood",
      "ReachedPathChoice", "ReachedArena", "ReachedPath3Choices",
      "DiedAfterFirstMemoryGiver", "ReachedMamaChildReward",
      "FoundAGearBlueprint", "FoundAMemoryBlueprint",
    ],
  },
  {
    id: "npc-tutorial",
    label: "NPCs & Tutorials",
    description: "NPC interactions and tutorial completions",
    flags: [
      "TalkedToAmi", "AmiCanDecryptMemories", "GotAmiUnlockingChip",
      "TalkedToCuprik", "RescuedSigourney", "TalkedToSigourney",
      "GotTeleportToTeamTutorial", "GotEmoteTutorial", "UsedHealer",
    ],
  },
  {
    id: "hub-access",
    label: "Hub & Access",
    description: "Hub area and multiplayer access",
    flags: [
      "CanAccessHub", "AccessedHub", "CanPublicMultiplayer",
      "CanAccessSecrets", "UnlockedCogGates",
    ],
  },
  {
    id: "feature-unlocks",
    label: "Feature Unlocks",
    description: "Major game feature unlocks",
    flags: [
      "UnlockedTrialChest", "UnlockedAPermanentUpgrade", "UnlockedHealFlask",
      "UnlockedStartGiver", "UnlockedChallenge", "UnlockedOptionalElite",
      "UnlockedWeaponTraining", "UnlockedATeamMove", "UnlockedBangerPulsor",
      "UnlockedHexGiver", "HexGiverCanAppear", "UnlockedNewGamePlus",
      "UnlockedEndlessMode", "UnlockedShopForge", "UnlockedTrinketTraining",
      "UnlockedGiftTraining", "UnlockedMetaCurrencyExchange",
      "UnlockedPlayerRemains", "UnlockedBiomeIncentivization",
    ],
  },
  {
    id: "leveled-upgrades",
    label: "Leveled Upgrades",
    description: "Multi-level permanent upgrades",
    flags: [
      "SyncAttackLvl1", "SyncAttackLvl2",
      "ExtraHealerEffectLvl1", "ExtraHealerEffectLvl2", "ExtraHealerEffectLvl3",
      "UnawareDMGIncreaseLvl1", "UnawareDMGIncreaseLvl2", "UnawareDMGIncreaseLvl3",
      "RunCurrencyReserveLvl1", "RunCurrencyReserveLvl2", "RunCurrencyReserveLvl3",
      "HealFlaskEffectLvl1", "HealFlaskEffectLvl2",
      "FoodHealthEffectLvl1", "FoodHealthEffectLvl2",
      "FoodCookingEffectLvl1", "FoodCookingEffectLvl2",
      "HealFlaskChargeLvl1", "HealFlaskChargeLvl2", "HealFlaskChargeLvl3",
      "UnlockedStartWeaponLvl1", "UnlockedStartWeaponLvl2",
      "UnlockedStartTrinketLvl1", "UnlockedStartTrinketLvl2",
      "UnlockedRecyclingLvl1", "UnlockedRecyclingLvl2",
      "UnlockedGiftSlotLvl1", "UnlockedGiftSlotLvl2",
      "UnlockedEnemyVariantsLv1", "UnlockedEnemyVariantsLv2",
      "PlentierShopLvl1", "PlentierShopLvl2",
      "UnlockedPaidEquippedBoonLvl1", "UnlockedPaidEquippedBoonLvl2",
      "UnlockedRarityLvl1", "UnlockedRarityLvl2", "UnlockedRarityLvl3",
      "UnlockedBackpackLvl1",
      "UnlockedPulsorSlotLvl1", "UnlockedPulsorSlotLvl2",
      "UnlockedPulsorStoneUpgradeLvl1", "UnlockedPulsorStoneUpgradeLvl2",
      "UnlockedStoneCheaperUpgradeLvl1", "UnlockedStoneCheaperUpgradeLvl2",
      "UnlockedRareAffixesLvl1", "UnlockedRareAffixesLvl2",
    ],
  },
  {
    id: "pulsor-system",
    label: "Pulsor System",
    description: "Pulsor feeding and effects",
    flags: [
      "UnlockedPulsorStoneFeeding", "UnlockedPulsorDustFeeding",
      "UnlockedPulsorShardFeeding", "UnlockedPulsorFragmentFeeding",
      "UnlockedPulsorEffects",
    ],
  },
  {
    id: "misc",
    label: "Miscellaneous",
    description: "Other upgrades and abilities",
    flags: [
      "BetterJars", "GiverReroll", "MobJuiceSkillRefill", "AlterattackLvl1",
      "GotHubSecretMetaCurrency", "HasPermBackstabBonus", "BuyableBoosts",
      "BoonDeckLvl1", "UnlockedFullBoonDeckPulsorSlot",
      "UnlockedTeamMoveAlterattackEffect", "FinishedRarity",
    ],
  },
  {
    id: "player-flags",
    label: "Player Flags",
    description: "Account-level perpetual flags",
    flags: [
      "PerpetualFlagAlphaPlayer", "PerpetualFlagDemoPlayer",
      "PerpetualFlagSuperEarlyAccessPlayer",
    ],
  },
]

// ── Helpers ─────────────────────────────────────────────────────────────

function humanize(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/Lvl(\d)/g, "Level $1")
    .replace(/Lv(\d)/g, "Level $1")
    .replace(/DMG/g, "DMG")
    .replace(/^ /, "")
    .trim()
}

function countEnabled(flags: Record<string, boolean>, names: string[]): number {
  return names.filter((n) => flags[n]).length
}

// ── Component ───────────────────────────────────────────────────────────

export default function WindblownSaveEditor() {
  const [saveData, setSaveData] = useState<WindblownSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const processSaveFile = async (file: File) => {
    setIsProcessing(true)
    try {
      const decoded = await decodeSaveFromFile(file)
      setSaveData(decoded)
      setOriginalFile(file)

      track("file_uploaded", {
        game: "Windblown",
        fileSize: file.size,
        fileName: file.name,
      })
    } catch (error) {
      console.error("Error processing save file:", error)
      alert("Failed to process save file. Please ensure it is a valid Windblown .sav file.")
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
        game: "Windblown",
        fileName: originalFile.name,
      })
    } catch (error) {
      console.error("Error encoding save file:", error)
      alert("Failed to create edited save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCurrencyChange = (key: keyof Currencies, value: string) => {
    if (!saveData) return
    const numValue = Math.min(Math.max(Number.parseInt(value) || 0, 0), MAX_CURRENCY)
    setSaveData(updateCurrency(saveData, key, numValue))
  }

  const totalEnabledFlags = saveData ? countEnabled(saveData.metaFlags, META_FLAG_NAMES) : 0

  const quickStats = saveData
    ? [
        { label: "Player", value: saveData.metadata.PlayerName, icon: <User className="w-4 h-4 text-blue-400" /> },
        {
          label: "Unlocks",
          value: `${totalEnabledFlags}/${META_FLAG_NAMES.length}`,
          icon: <Unlock className="w-4 h-4 text-green-400" />,
        },
      ]
    : []

  const quickActions = saveData
    ? [
        {
          label: "Max All Currencies",
          onClick: () => setSaveData(maxAllCurrencies(saveData)),
          icon: <Coins className="w-4 h-4 mr-2" />,
        },
        {
          label: "Unlock All Flags",
          onClick: () => setSaveData(unlockAllFlags(saveData)),
          icon: <Unlock className="w-4 h-4 mr-2" />,
        },
        {
          label: "Download JSON",
          onClick: () => {
            const filename = originalFile?.name.replace(/\.[^/.]+$/, "") || "windblown-save"
            downloadJSON(
              {
                playerName: saveData.metadata.PlayerName,
                currencies: saveData.currencies,
                metaFlags: saveData.metaFlags,
              },
              filename,
            )
            track("json_downloaded", {
              game: "Windblown",
              fileName: originalFile?.name,
            })
          },
          icon: <Code className="w-4 h-4 mr-2" />,
        },
      ]
    : []

  const gameData = gamesData.games.find((game) => game.id === "windblown")

  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wind className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Windblown</h1>
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
              <h2 className="text-3xl font-bold text-foreground">Windblown Save Editor</h2>
              <p className="text-muted-foreground">Edit currencies, unlocks, and meta progression</p>
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
              <Tabs defaultValue="currencies" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-card border border-border">
                  <TabsTrigger value="currencies" className="data-[state=active]:bg-muted">
                    <Coins className="w-4 h-4 mr-2" />
                    Currencies
                  </TabsTrigger>
                  <TabsTrigger value="unlocks" className="data-[state=active]:bg-muted">
                    <Unlock className="w-4 h-4 mr-2" />
                    Unlocks
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="data-[state=active]:bg-muted">
                    <Code className="w-4 h-4 mr-2" />
                    Raw JSON
                  </TabsTrigger>
                </TabsList>

                {/* ── Currencies Tab ──────────────────────────────── */}
                <TabsContent value="currencies" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {CURRENCY_DEFS.map(({ key, name, icon: Icon, color }) => (
                      <Card key={key} className="bg-card border-border">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center justify-between text-foreground">
                            <span className="flex items-center gap-2">
                              <Icon className={`w-5 h-5 ${color}`} />
                              {name}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                              onClick={() => setSaveData(updateCurrency(saveData, key, MAX_CURRENCY))}
                            >
                              Max
                            </Button>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Input
                            type="number"
                            value={saveData.currencies[key]}
                            onChange={(e) => handleCurrencyChange(key, e.target.value)}
                            min="0"
                            max={MAX_CURRENCY}
                            className="font-mono text-lg bg-muted border-border text-foreground"
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* ── Unlocks Tab ─────────────────────────────────── */}
                <TabsContent value="unlocks" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {totalEnabledFlags} of {META_FLAG_NAMES.length} flags enabled
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                        onClick={() => setSaveData(unlockAllFlags(saveData))}
                      >
                        <Unlock className="w-4 h-4 mr-2" />
                        Unlock All
                      </Button>
                    </div>
                  </div>

                  <Accordion type="multiple" defaultValue={["progression", "feature-unlocks"]}>
                    {FLAG_CATEGORIES.map((category) => {
                      const enabled = countEnabled(saveData.metaFlags, category.flags)
                      const total = category.flags.length

                      return (
                        <AccordionItem key={category.id} value={category.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3">
                              <span className="font-medium">{category.label}</span>
                              <Badge variant="secondary" className="font-mono text-xs">
                                {enabled}/{total}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-1">
                              <div className="flex justify-end gap-2 mb-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                                  onClick={() => setSaveData(unlockCategoryFlags(saveData, category.flags))}
                                >
                                  <Unlock className="w-3 h-3 mr-1" />
                                  Unlock All
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground"
                                  onClick={() => setSaveData(lockCategoryFlags(saveData, category.flags))}
                                >
                                  <Lock className="w-3 h-3 mr-1" />
                                  Lock All
                                </Button>
                              </div>

                              {category.flags.map((flagName) => (
                                <div
                                  key={flagName}
                                  className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50"
                                >
                                  <Label className="text-sm cursor-pointer" htmlFor={flagName}>
                                    {humanize(flagName)}
                                  </Label>
                                  <Checkbox
                                    id={flagName}
                                    checked={saveData.metaFlags[flagName] ?? false}
                                    onCheckedChange={(checked) =>
                                      setSaveData(toggleMetaFlag(saveData, flagName, !!checked))
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>
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
                          playerName: saveData.metadata.PlayerName,
                          currencies: saveData.currencies,
                          metaFlags: saveData.metaFlags,
                        }}
                        onChange={(updated: { playerName: string; currencies: Currencies; metaFlags: Record<string, boolean> }) => {
                          setSaveData({
                            ...saveData,
                            currencies: updated.currencies,
                            metaFlags: updated.metaFlags,
                          })
                        }}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg text-sm">
                <span className="text-muted-foreground">
                  Player: <span className="text-foreground font-medium">{saveData.metadata.PlayerName}</span>
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
