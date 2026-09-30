/**
 * Minecraft Dungeons 2 game data, extracted from the full datamine by
 * scripts/build-minecraft-dungeons-2-catalog.mjs into data/minecraft-dungeons-2/editor-catalog.json.
 * Icons are hosted on Vercel Blob under /images/minecraft-dungeons-2 (see lib/asset-url.ts).
 *
 * Every lookup falls back gracefully for tags the catalog doesn't know
 * (e.g. items added in a newer game version), so saves never fail to render.
 */
import catalogData from "@/data/minecraft-dungeons-2/editor-catalog.json"
import editorData from "@/data/minecraft-dungeons-2/editor_data.json"
import { assetUrl } from "@/lib/asset-url"
import { humanizeTag, NO_SLOT } from "./decoder"

export type ItemCategory =
  | "melee"
  | "ranged"
  | "armor"
  | "artifact"
  | "talisman"
  | "enchantmentBook"
  | "cape"
  | "pet"
  | "throwable"
  | "other"

export interface CatalogItem {
  tag: string
  name: string
  description?: string
  category: ItemCategory
  armorPiece?: "Boots" | "Chest" | "Helmet" | "Leggings"
  unique?: boolean
  /** Tag of this item's unique variant. */
  uniqueOf?: string
  /** For unique items: the base item(s) they're a variant of. */
  baseOf?: string[]
  /** DLC gate, e.g. "SW.Product.DeluxeEdition". */
  product?: string
  /** Relative to /images/minecraft-dungeons-2, e.g. "icons/SW.Item.Sword.png". */
  icon?: string
  /** Rolled-effect template groups this item accepts ("Weapon", "Armor", …). */
  effectGroups?: string[]
}

export interface CatalogRarity {
  tag: string
  name: string
  weight: number
  powerOffset: number
  effects: number
}

export interface CatalogAchievement {
  name: string
  quest?: string
  target?: number
  collection?: string[]
  maxEnchantLevel?: number
}

export interface CatalogEnchantment {
  tag: string
  name: string
  /** Uses {0} as the value placeholder. */
  description?: string
  category?: string
  icon?: string
  tiers: { tier: string; tag: string; value: number; minPower?: number }[]
}

interface Catalog {
  game: string
  generatedAt: string
  items: CatalogItem[]
  equipSlots: string[]
  rarities: CatalogRarity[]
  skins: { tag: string; name: string; product?: string; icon?: string }[]
  areas: Record<string, string>
  achievements: Record<string, CatalogAchievement>
  questNames: Record<string, string>
  minecartStations: string[]
  enchantments: CatalogEnchantment[]
  effects: {
    template: string
    effect: string
    name: string
    groups: string[]
    tiers: { tier: string; tag: string; value: number; minPower?: number }[]
  }[]
  enchantCosts: Record<string, { points: number; pointsPerLevel: number }>
  rerollableEffectCounts: Record<string, number>
}

export const catalog = catalogData as Catalog

export const CATEGORY_ORDER: ItemCategory[] = [
  "melee",
  "ranged",
  "armor",
  "artifact",
  "talisman",
  "enchantmentBook",
  "throwable",
  "cape",
  "pet",
  "other",
]

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  melee: "Melee Weapons",
  ranged: "Ranged Weapons",
  armor: "Armor",
  artifact: "Artifacts",
  talisman: "Talismans",
  enchantmentBook: "Enchantment Books",
  throwable: "Throwables",
  cape: "Capes",
  pet: "Pets",
  other: "Other",
}

// ── Items ───────────────────────────────────────────────────────────────

const ITEMS = new Map(catalog.items.map((i) => [i.tag, i]))

export function itemInfo(tag: string): CatalogItem | undefined {
  return ITEMS.get(tag)
}

const IMAGE_BASE = "/images/minecraft-dungeons-2"

/** Hosted icon URL for an item or skin tag, if the game ships one. */
export function iconUrl(tag: string): string | undefined {
  const icon = ITEMS.get(tag)?.icon ?? catalog.skins.find((s) => s.tag === tag)?.icon
  return icon ? assetUrl(`${IMAGE_BASE}/${icon}`) : undefined
}

export function itemName(tag: string): string {
  return ITEMS.get(tag)?.name ?? humanizeTag(tag)
}

/** Category from the catalog, else inferred from the tag for unknown items. */
export function itemCategory(tag: string): ItemCategory {
  const known = ITEMS.get(tag)?.category
  if (known) return known
  if (tag.includes(".Cosmetic.Cape.")) return "cape"
  if (tag.includes(".Cosmetic.Pet.")) return "pet"
  if (tag.includes(".Artifact.")) return "artifact"
  if (tag.includes(".EnchantmentBook.")) return "enchantmentBook"
  if (tag.includes(".Talisman.")) return "talisman"
  return "other"
}

/** Categories with no item power (the game stores -1 for these). */
export function hasItemPower(category: ItemCategory): boolean {
  return !["cape", "pet", "enchantmentBook", "talisman"].includes(category)
}

/** Catalog items that can replace this one (same category, same armor piece). */
export function interchangeableItems(tag: string): CatalogItem[] {
  const info = ITEMS.get(tag)
  const category = itemCategory(tag)
  return catalog.items.filter(
    (i) => i.category === category && (category !== "armor" || !info?.armorPiece || i.armorPiece === info.armorPiece),
  )
}

// ── Rarities ────────────────────────────────────────────────────────────

const RARITY_NAMES = new Map(catalog.rarities.map((r) => [r.tag, r.name]))
const UNIQUE_RARITY = "SW.Rarity.Unique"
const COMMON_RARITY = "SW.Rarity.Common"
/** Talismans have no rarity. */
const NONE_RARITY = "SW.Rarity.None"

export function rarityName(tag: string): string {
  return RARITY_NAMES.get(tag) ?? humanizeTag(tag)
}

/**
 * Uniques are their own item types and only come as Unique; cosmetics and
 * books are always Common; other gear rolls Common / Rare / Special.
 */
export function raritiesFor(tag: string): string[] {
  const info = ITEMS.get(tag)
  if (info?.unique) return [UNIQUE_RARITY]
  const category = itemCategory(tag)
  if (category === "talisman") return [NONE_RARITY]
  if (!hasItemPower(category) || category === "throwable") return [COMMON_RARITY]
  return catalog.rarities.map((r) => r.tag).filter((r) => r !== UNIQUE_RARITY)
}

export function defaultRarity(tag: string): string {
  if (itemCategory(tag) === "talisman") return NONE_RARITY
  return ITEMS.get(tag)?.unique ? UNIQUE_RARITY : COMMON_RARITY
}

export { UNIQUE_RARITY }

// ── Slots ───────────────────────────────────────────────────────────────

const SLOT_PREFIX: Partial<Record<ItemCategory, string>> = {
  melee: "SW.ItemSlot.Equipment.MeleeWeapon",
  ranged: "SW.ItemSlot.Equipment.RangedWeapon",
  artifact: "SW.ItemSlot.Equipment.Artifact.",
  talisman: "SW.ItemSlot.Equipment.Talisman.",
  cape: "SW.ItemSlot.Equipment.Cosmetic.Capes",
  pet: "SW.ItemSlot.Equipment.Cosmetic.Pets",
}

/** Equipment slots this item may occupy. */
export function equipSlotsFor(tag: string): string[] {
  const category = itemCategory(tag)
  if (category === "armor") {
    const piece = ITEMS.get(tag)?.armorPiece
    return catalog.equipSlots.filter((s) =>
      piece ? s === `SW.ItemSlot.Equipment.Armor.${piece}` : s.startsWith("SW.ItemSlot.Equipment.Armor."),
    )
  }
  const prefix = SLOT_PREFIX[category]
  return prefix ? catalog.equipSlots.filter((s) => s.startsWith(prefix)) : []
}

/** CollectionsStats list an item of this category/rarity is recorded in. */
export function collectionKey(tag: string, rarity: string): string | undefined {
  const group = { melee: "Weapons", ranged: "Weapons", armor: "Armor", artifact: "Artifacts" }[
    itemCategory(tag) as string
  ]
  if (group) return `Collected${group}${rarityName(rarity)}`
  if (itemCategory(tag) === "talisman") return "CollectedTalismans"
  return undefined
}

// ── Cosmetics, places, quests, achievements ─────────────────────────────

export function productLabel(product?: string): string | undefined {
  return product ? humanizeTag(product).replace(/Edition$/, " Edition") : undefined
}

const ENCHANTMENTS = new Map(catalog.enchantments.map((e) => [e.tag, e]))

export function enchantmentInfo(tag: string): CatalogEnchantment | undefined {
  return ENCHANTMENTS.get(tag)
}

export function areaName(tag?: string): string | undefined {
  return tag ? catalog.areas[tag] : undefined
}

export function questName(id: string): string | undefined {
  return (editorData as { quests: { names: Record<string, string> } }).quests.names[id] ?? catalog.questNames[id]
}

export function achievementInfo(tag: string): CatalogAchievement | undefined {
  return catalog.achievements[tag]
}

/** "SW.MinecartStation.PlainsA1.Barn" → "Plains A1 · Barn". */
export function stationName(tag: string): string {
  return tag
    .replace(/^SW\.MinecartStation\./, "")
    .split(".")
    .map((p) => humanizeTag(p))
    .join(" · ")
}

/** Friendly label for any tag in an achievement collection. */
export function collectionTagName(tag: string): string {
  if (tag.startsWith("SW.Item.")) return itemName(tag)
  if (tag.startsWith("SW.MinecartStation.")) return stationName(tag)
  if (tag.startsWith("SW.ItemSlot.")) return equipSlotName(tag)
  return humanizeTag(tag)
}

export function equipSlotName(slot: string): string {
  if (slot === NO_SLOT) return "Not equipped"
  return slot
    .replace("SW.ItemSlot.Equipment.", "")
    .replace("Cosmetic.", "")
    .split(".")
    .map((p) => humanizeTag(p).replace(/([A-Za-z])([0-9])/g, "$1 $2"))
    .join(" ")
}

/** Achievement counters and collections at their catalog targets. */
export function achievementTargets(): { counts: Record<string, number>; collections: Record<string, string[]> } {
  const counts: Record<string, number> = {}
  const collections: Record<string, string[]> = {}
  for (const [tag, a] of Object.entries(catalog.achievements)) {
    if (a.target !== undefined) counts[tag] = a.target
    if (a.collection) collections[tag] = a.collection
  }
  return { counts, collections }
}

// ── Game data (data/minecraft-dungeons-2/editor_data.json) ──────────────
// Effect display formatting, enchantment rules, talisman levels, the player XP
// curve and quest text, extracted from the game's tables and localisation.

interface EffectFormatting {
  IsPercentage?: boolean
  Offset: number
  Multiplier: number
  MaxFractionalDigits?: number
}

interface GameEffect {
  tag: string
  displayName?: string
  description?: string
  formatting?: EffectFormatting
}

interface GameEnchantment {
  tag: string
  displayName?: string
  description?: string
  /** "melee", "ranged", "armor.boots", … */
  appliesTo: string[]
  tiers: { tier: string; tag: string; values: Record<string, number> }[]
}

interface TalismanLevel {
  level: number
  levelTag: string
  grantedTag: string
  xpForNext: number
}

interface TalismanTemplate {
  tag: string
  effect: string
  fixedValue: number
}

interface XpRuleSet {
  levelUpXPCostBase: number
  levelUpXPCostIncreaseFactor: number
  levelUpXPCostLimit: number
  factorConstants: { LimitValue: number; SpreadFactor: number; LowestPossibleScaling: number }
  factorConstantsArmor: { LimitValue: number; SpreadFactor: number; LowestPossibleScaling: number }
  rolledEffects: { min: number; max: number }
}

interface EditorData {
  enchantmentEconomy: { maxEnchantmentsPerItem: number; enchantmentTiers: string[] }
  enchantments: Record<string, GameEnchantment>
  effects: Record<string, GameEffect>
  talismans: Record<string, { tag: string; levels: TalismanLevel[] }>
  talismanEffectTemplates: TalismanTemplate[]
  gameBalance: { playerXpCurve: { ruleSets: Record<string, XpRuleSet> } }
  slotCounts: Record<string, number>
  quests: { names: Record<string, string>; objectives: Record<string, string>; descriptions: Record<string, string> }
}

const gameData = editorData as unknown as EditorData

/**
 * The live rule set. SecondPass matches real saves (a level-1 save with 1432 XP
 * fits its 2000-XP first level; the "Active" row's 1000 doesn't).
 */
export const RULES = gameData.gameBalance.playerXpCurve.ruleSets["SW.GameplayRuleSet.SecondPass"]

export const MAX_ENCHANTMENTS_PER_ITEM = gameData.enchantmentEconomy.maxEnchantmentsPerItem

/** XP needed to go from `level` to `level + 1`: min(Base × (1+Factor)^(level−1), Base × Limit). */
export function xpForNextLevel(level: number): number {
  const { levelUpXPCostBase: base, levelUpXPCostIncreaseFactor: factor, levelUpXPCostLimit: limit } = RULES
  return Math.round(Math.min(base * (1 + factor) ** (Math.max(1, level) - 1), base * limit))
}

// Effects are keyed by row name in the data; index them by tag (case-insensitive,
// the game data has a few tag casing slips).
const GAME_EFFECTS = new Map(Object.values(gameData.effects).map((e) => [e.tag.toLowerCase(), e]))

export function gameEffect(tag: string): GameEffect | undefined {
  return GAME_EFFECTS.get(tag.toLowerCase())
}

/** Displayed value of an effect, exactly as the game formats it: (raw + Offset) × Multiplier. */
export function effectDisplayValue(tag: string, raw: number): { value: number; percent: boolean } | undefined {
  const f = gameEffect(tag)?.formatting
  if (!f) return undefined
  const scaled = (raw + f.Offset) * f.Multiplier
  return { value: f.IsPercentage ? scaled * 100 : scaled, percent: !!f.IsPercentage }
}

export function formatEffectValue(tag: string, raw: number): string | undefined {
  const d = effectDisplayValue(tag, raw)
  if (!d) return undefined
  const digits = gameEffect(tag)?.formatting?.MaxFractionalDigits ?? 2
  const n = Math.round(d.value * 10 ** digits) / 10 ** digits
  return d.percent ? `${n}%` : `${n}`
}

/** Effect/enchantment description with its placeholders filled in where possible. */
export function describeEffect(tag: string, raw?: number): string | undefined {
  const text = gameEffect(tag)?.description ?? gameEnchantment(tag)?.description
  if (!text) return undefined
  const value = raw !== undefined ? formatEffectValue(tag, raw) : undefined
  return text.replace("{0}", value ?? "X").replace(/\{\d\}/g, "X")
}

// ── Enchantments ────────────────────────────────────────────────────────

export function gameEnchantment(tag: string): GameEnchantment | undefined {
  return gameData.enchantments[tag]
}

/** The "appliesTo" key for an item: melee, ranged, or armor.<piece>. */
function enchantTarget(itemTag: string): string | undefined {
  const category = itemCategory(itemTag)
  if (category === "melee" || category === "ranged") return category
  const piece = ITEMS.get(itemTag)?.armorPiece
  return category === "armor" && piece ? `armor.${piece.toLowerCase()}` : undefined
}

export interface EnchantmentOption {
  tag: string
  name: string
  description?: string
  icon?: string
  /** Tier → template tag and the value stored as Intensity. */
  tiers: { tier: string; tag: string; value: number }[]
}

/** Enchantments the Enchantsmith can apply to this item. */
export function enchantmentsFor(itemTag: string): EnchantmentOption[] {
  const target = enchantTarget(itemTag)
  if (!target) return []
  return catalog.enchantments
    .filter((e) => gameData.enchantments[e.tag]?.appliesTo.includes(target))
    .map((e) => ({ tag: e.tag, name: e.name, description: e.description, icon: e.icon, tiers: e.tiers }))
}

/**
 * Enchantment points invested to reach a tier (1-based). Cost per level is
 * base + (level − 1) × perLevel for the item's rarity, e.g. Common 1 / 3 / 6.
 */
export function enchantPoints(rarity: string, level: number): number {
  const cost = catalog.enchantCosts[rarity] ?? catalog.enchantCosts["SW.Rarity.Common"]
  let total = 0
  for (let l = 1; l <= level; l++) total += cost.points + (l - 1) * cost.pointsPerLevel
  return total
}

// ── Rolled effects ──────────────────────────────────────────────────────

export interface RolledEffectOption {
  template: string
  effect: string
  name: string
  tiers: { tier: string; tag: string; value: number; minPower?: number }[]
}

/** Rolled effects the game can put on this item (matched on its effect template groups). */
export function rolledEffectsFor(itemTag: string): RolledEffectOption[] {
  const groups = new Set(ITEMS.get(itemTag)?.effectGroups ?? [])
  if (groups.size === 0) return []
  return catalog.effects
    .filter((e) => e.groups.some((g) => groups.has(g)))
    .map((e) => ({ template: e.template, effect: e.effect, name: e.name, tiers: e.tiers }))
}

/** How many rolled effects an item of this rarity gets (capped by the global max). */
export function rolledEffectCount(rarity: string): number {
  return Math.min(catalog.rerollableEffectCounts[rarity] ?? 0, RULES.rolledEffects.max)
}

// ── Talismans ───────────────────────────────────────────────────────────

export interface TalismanInfo {
  levels: TalismanLevel[]
  /** Effect template per level (I, II, III) for stat talismans; empty for companions. */
  templates: TalismanTemplate[]
}

const TALISMANS = new Map(Object.values(gameData.talismans).map((t) => [t.tag.toLowerCase(), t]))

export function talismanInfo(tag: string): TalismanInfo | undefined {
  const t = TALISMANS.get(tag.toLowerCase())
  if (!t) return undefined
  const name = tag.split(".").pop()!
  const templates = ["I", "II", "III"]
    .map((tier) => gameData.talismanEffectTemplates.find((x) => x.tag === `SW.EffectTemplate.${name}.${tier}`))
    .filter((x): x is TalismanTemplate => !!x)
  return { levels: t.levels, templates }
}

// ── Quests & inventory ──────────────────────────────────────────────────

export function objectiveName(taskName: string): string | undefined {
  return gameData.quests.objectives[taskName]
}

/** Quest description with the game's rich-text markup removed. */
export function questDescription(id: string): string | undefined {
  const text = gameData.quests.descriptions[id]
  if (!text || text === "ERROR") return undefined
  return text.replace(/<[^>]*>/g, "")
}

/** How many items an inventory slot holds (e.g. 80 melee weapons). */
export function slotCapacity(slot: string): number | undefined {
  return gameData.slotCounts[slot]
}
