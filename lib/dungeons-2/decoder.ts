/**
 * Minecraft Dungeons 2 save file codec (browser-compatible)
 *
 * Save folder: %LOCALAPPDATA%\Dungeons\Saved\SaveGames\
 *
 * Character<uuid>.sav — one per character, plain compact UTF-8 JSON:
 *   {"SerializeMeta":{..., "HardFormat":"FCharacterSaveV1", "FormatHash":N},
 *    "CharacterSaveV1":{MetaData, Ability, Achievements, CollectionsStats,
 *                       Cosmetics, Inventory, LootProgression, quest,
 *                       WorldExploration}}
 *   Currency / XP / level live in Ability.Attributes as
 *   {"AttributeName":"Emeralds","CurrentValue":46}. FormatHash is a schema
 *   hash, not a content checksum. Written locally even with cloud save on,
 *   so the cloud copy may override local edits.
 *
 * GlobalSaveDataDefault.sav — settings: UTF-8 JSON with every byte stored as
 *   (byte − 1) mod 256. Detected (for a helpful error) but not edited here.
 *
 * Other files in SaveGames/ are NOT editable off-machine (Windows DPAPI blobs
 * and an encrypted OnlineDataTables.sav).
 *
 * Numbers: the game writes doubles with 17 significant digits
 * (38.791999816894531) and int64 FDateTime ticks beyond 2^53
 * (GameDataUpdated). Parsing keeps any number whose JS form would differ
 * from the source text as JSON.rawJSON, so every file round-trips byte-exact.
 * Browsers without JSON.rawJSON fall back to a plain parse, which rewrites
 * those numbers in normalised (still valid) form.
 *
 * Item names, slots, rarities etc. come from ./catalog.ts (game datamine).
 *
 * Ported from the Deno reference CLI (experiments/dungeons-2/cli/save_io.ts).
 */

/** Byte offset applied to every plaintext byte of the global save. */
const BYTE_SHIFT = 1
const BYTE_MASK = 0xff

const GVAS_MAGIC = [0x47, 0x56, 0x41, 0x53] // "GVAS"
/** Windows DPAPI provider GUID df9d8cd0-1501-11d1-8c7a-00c04fc297eb (LE bytes). */
const DPAPI_PROVIDER = [
  0xd0, 0x8c, 0x9d, 0xdf, 0x01, 0x15, 0xd1, 0x11, 0x8c, 0x7a, 0x00, 0xc0, 0x4f, 0xc2, 0x97, 0xeb,
]
const OPEN_BRACE = 0x7b // "{"

// ── Type definitions ────────────────────────────────────────────────────

/** A number kept verbatim by parseLossless. */
export type RawNumber = { rawJSON: string }
export type Num = number | RawNumber

export interface CharacterAttribute {
  AttributeName: string
  CurrentValue: Num
  [key: string]: unknown
}

export interface PowerGeneratorValues {
  ItemPower: Num
  ItemPowerOriginal: Num
  ItemPowerMin: Num
  ItemPowerMax: Num
  [key: string]: unknown
}

export interface ItemData {
  TypeTag: string
  RarityTag: string
  Effects: unknown[]
  ItemProgression: { CurrentLevel: Num; CurrentXP: Num; ItemLevels: unknown[]; [key: string]: unknown }
  GeneratorData: {
    GenesisRandomSeed: Num
    PowerGeneratorValues: PowerGeneratorValues
    [key: string]: unknown
  }
  DynamicPropertyTags: string[]
  TargetSlotOverride: string
  PickupTimestamp: Num
  [key: string]: unknown
}

export interface InventoryEntry {
  ItemData: ItemData
  StackCount: Num
  EquippedSlot: string
  MerchantItemSold: boolean
  MerchantDiscount: Num
  [key: string]: unknown
}

export interface QuestTask {
  TaskName: string
  State: string
  PartialProgress: Num
  [key: string]: unknown
}

export interface Quest {
  QuestName: string
  State: string
  TaskData: QuestTask[]
  [key: string]: unknown
}

export interface Achievements {
  QuestAchievements?: Record<string, { bCompleted: boolean }>
  BoolAchievements?: Record<string, { bCompleted: boolean }>
  CollectionAchievements?: Record<string, { CollectedTags: string[] }>
  CountAchievements?: Record<string, { Count: Num }>
  [key: string]: unknown
}

export interface CharacterData {
  MetaData: {
    CharacterId: string
    Level: Num
    PowerLevel: Num
    CurrentLocation?: string
    CurrentDifficulty?: string
    [key: string]: unknown
  }
  Ability: { Attributes: CharacterAttribute[]; [key: string]: unknown }
  Achievements?: Achievements
  CollectionsStats?: Record<string, unknown>
  Cosmetics?: { Cosmetics?: Record<string, { TypeTag: string }>; [key: string]: unknown }
  Inventory?: { Entries: InventoryEntry[]; [key: string]: unknown }
  LootProgression?: { DiscoveredLoot: string[]; [key: string]: unknown }
  quest?: { Quests: Quest[]; FocusedQuestId?: string; [key: string]: unknown }
  WorldExploration?: { DiscoveredMinecartStationTags?: string[]; [key: string]: unknown }
  [key: string]: unknown
}

export interface CharacterSave {
  SerializeMeta: { HardFormat: string; [key: string]: unknown }
  CharacterSaveV1: CharacterData
}

export type FileKind = "global" | "character" | "gvas-dpapi" | "dpapi" | "encrypted"

export const KIND_DESCRIPTIONS: Record<FileKind, string> = {
  global: "the settings file (GlobalSaveDataDefault.sav)",
  character: "a character save",
  "gvas-dpapi": "an account token file protected by Windows (DPAPI)",
  dpapi: "a Windows-protected (DPAPI) file",
  encrypted: "an encrypted or unrecognised file",
}

// ── Lossless JSON ───────────────────────────────────────────────────────

/** ES2025 JSON.rawJSON / parse-with-source, not yet in TypeScript's lib. */
const LosslessJSON = JSON as unknown as {
  parse(text: string, reviver: (key: string, value: unknown, context?: { source: string }) => unknown): unknown
  rawJSON?: (text: string) => unknown
  isRawJSON?: (value: unknown) => value is RawNumber
}

const HAS_RAW_JSON = typeof LosslessJSON.rawJSON === "function"

/** True for a number kept verbatim by parseLossless. */
export function isRawNumber(value: unknown): value is RawNumber {
  return HAS_RAW_JSON && LosslessJSON.isRawJSON!(value)
}

/** JSON.parse that keeps numbers JS can't reproduce verbatim as raw JSON. */
export function parseLossless(text: string): unknown {
  if (!HAS_RAW_JSON) {
    console.warn("[dungeons-2] JSON.rawJSON unavailable; long numbers will be normalised on save")
    return JSON.parse(text)
  }
  return LosslessJSON.parse(text, (_key, value, context) => {
    if (typeof value === "number" && context && String(value) !== context.source) {
      return LosslessJSON.rawJSON!(context.source)
    }
    return value
  })
}

/** Read a numeric field that may be a raw-JSON number from parseLossless. */
export function numberValue(value: unknown): number {
  if (typeof value === "number") return value
  if (isRawNumber(value)) return Number(value.rawJSON)
  return 0
}

// ── Detection ───────────────────────────────────────────────────────────

function startsWith(data: Uint8Array, prefix: number[], offset = 0): boolean {
  return prefix.every((b, i) => data[offset + i] === b)
}

function decodeShifted(data: Uint8Array): string {
  const plain = data.map((b) => (b + BYTE_SHIFT) & BYTE_MASK)
  return new TextDecoder("utf-8", { fatal: true }).decode(plain)
}

function isCharacter(value: unknown): value is CharacterSave {
  const v = value as CharacterSave
  return typeof v?.SerializeMeta?.HardFormat === "string" && typeof v.CharacterSaveV1 === "object"
}

/** Classify a Dungeons 2 .sav file by content. */
export function detectKind(data: Uint8Array): FileKind {
  if (startsWith(data, GVAS_MAGIC)) return "gvas-dpapi"
  // DPAPI blob: dwVersion (u32 = 1) followed by the provider GUID.
  if (data[0] === 0x01 && startsWith(data, DPAPI_PROVIDER, 4)) return "dpapi"
  try {
    if (data[0] === OPEN_BRACE && isCharacter(JSON.parse(new TextDecoder().decode(data)))) {
      return "character"
    }
    if (
      data[0] === ((OPEN_BRACE - BYTE_SHIFT) & BYTE_MASK) &&
      Array.isArray((JSON.parse(decodeShifted(data)) as { blobs?: unknown }).blobs)
    ) {
      return "global"
    }
  } catch {
    /* not JSON */
  }
  return "encrypted"
}

// ── Encode / decode ─────────────────────────────────────────────────────

/** Decode raw .sav bytes of a character save. */
export function decodeCharacterBytes(bytes: Uint8Array): CharacterSave {
  const kind = detectKind(bytes)
  if (kind !== "character") {
    throw new Error(
      `This is ${KIND_DESCRIPTIONS[kind]}, not a character save. Load a Character<id>.sav file instead.`,
    )
  }
  return parseLossless(new TextDecoder().decode(bytes)) as CharacterSave
}

/** Encode a character save back to .sav bytes, exactly as the game writes them. */
export function encodeCharacterBytes(save: CharacterSave): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(save))
}

export async function decodeSaveFromFile(file: File): Promise<CharacterSave> {
  return decodeCharacterBytes(new Uint8Array(await file.arrayBuffer()))
}

export async function encodeSaveToBlob(save: CharacterSave): Promise<Blob> {
  return new Blob([encodeCharacterBytes(save)], { type: "application/octet-stream" })
}

// ── Attributes ──────────────────────────────────────────────────────────

export type AttributeGroup = "currency" | "progression" | "upgrades"

export interface AttributeDef {
  name: string
  label: string
  group: AttributeGroup
  max: number
  /** Allows fractional values (XP is stored as a float). */
  float?: boolean
}

export const ATTRIBUTE_DEFS: AttributeDef[] = [
  { name: "Emeralds", label: "Emeralds", group: "currency", max: 999999 },
  { name: "SpringStone", label: "Spring Stone", group: "currency", max: 999999 },
  { name: "EnchantmentPoints", label: "Enchantment Points", group: "currency", max: 9999 },
  { name: "Level", label: "Level", group: "progression", max: 100 },
  { name: "XP", label: "XP", group: "progression", max: 99999999, float: true },
  { name: "VillageMerchantRefreshCharges", label: "Merchant Refresh Charges", group: "upgrades", max: 99 },
  { name: "VillageMerchantUpgradeLevel", label: "Village Merchant Level", group: "upgrades", max: 10 },
  { name: "EnchantsmithUpgradeLevel", label: "Enchantsmith Level", group: "upgrades", max: 10 },
  { name: "OldBlacksmithUpgradeLevel", label: "Old Blacksmith Level", group: "upgrades", max: 10 },
]

export const CURRENCY_ATTRIBUTES = ATTRIBUTE_DEFS.filter((d) => d.group === "currency").map((d) => d.name)

export function findAttribute(save: CharacterSave, name: string): CharacterAttribute | undefined {
  return save.CharacterSaveV1.Ability.Attributes.find((a) => a.AttributeName === name)
}

export function getAttribute(save: CharacterSave, name: string): number {
  return numberValue(findAttribute(save, name)?.CurrentValue)
}

// ── Tags & items ────────────────────────────────────────────────────────

/** "SW.Item.Artifact.LightningRod" → "Lightning Rod". */
export function humanizeTag(tag: string): string {
  const last = tag.split(".").pop() ?? tag
  return last
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim()
}

export function isCosmetic(tag: string): boolean {
  return tag.includes(".Cosmetic.")
}

const MERCHANT_SLOT_PREFIX = "SW.ItemSlot.Inventory.VillageMerchant"

/** Village merchant stock lives in the inventory list but isn't owned yet. */
export function isMerchantStock(entry: InventoryEntry): boolean {
  return entry.ItemData.TargetSlotOverride.startsWith(MERCHANT_SLOT_PREFIX)
}

export const NO_SLOT = "None"
