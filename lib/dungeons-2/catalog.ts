/**
 * Minecraft Dungeons 2 game data, extracted from the full datamine by
 * scripts/build-dungeons-2-catalog.mjs into data/minecraft-dungeons-2/editor-catalog.json.
 * Icons are hosted on Vercel Blob under /images/minecraft-dungeons-2 (see lib/asset-url.ts).
 *
 * Every lookup falls back gracefully for tags the catalog doesn't know
 * (e.g. items added in a newer game version), so saves never fail to render.
 */
import catalogData from "@/data/minecraft-dungeons-2/editor-catalog.json"
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
  return !["cape", "pet", "enchantmentBook"].includes(category)
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
  if (!hasItemPower(category) || category === "throwable") return [COMMON_RARITY]
  return catalog.rarities.map((r) => r.tag).filter((r) => r !== UNIQUE_RARITY)
}

export function defaultRarity(tag: string): string {
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

export function areaName(tag?: string): string | undefined {
  return tag ? catalog.areas[tag] : undefined
}

export function questName(id: string): string | undefined {
  return catalog.questNames[id]
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
