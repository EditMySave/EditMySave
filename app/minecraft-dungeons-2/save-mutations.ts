import type { CharacterData, CharacterSave, EffectBatch, InventoryEntry, ItemEffect, Quest } from "@/lib/minecraft-dungeons-2/decoder"
import { CURRENCY_ATTRIBUTES, EFFECT_BATCH, NO_SLOT, getAttribute, numberValue } from "@/lib/minecraft-dungeons-2/decoder"

const MAX_CURRENCY = 999999
const COMPLETED = "Completed"

// Each mutation clones only along the edited path so untouched raw-JSON
// numbers (17-digit doubles, int64 ticks) are written back verbatim.

function updateChar(save: CharacterSave, fn: (c: CharacterData) => CharacterData): CharacterSave {
  return { ...save, CharacterSaveV1: fn(save.CharacterSaveV1) }
}

// ── Stats ───────────────────────────────────────────────────────────────

export function setAttribute(save: CharacterSave, name: string, value: number): CharacterSave {
  return updateChar(save, (c) => {
    const attrs = [...c.Ability.Attributes]
    const idx = attrs.findIndex((a) => a.AttributeName === name)
    if (idx >= 0) {
      attrs[idx] = { ...attrs[idx], CurrentValue: value }
    } else {
      attrs.push({ AttributeName: name, CurrentValue: value })
    }
    return { ...c, Ability: { ...c.Ability, Attributes: attrs } }
  })
}

/** Level is stored twice: as an attribute and in MetaData (shown on the character select). */
export function setLevel(save: CharacterSave, level: number): CharacterSave {
  const updated = setAttribute(save, "Level", level)
  return updateChar(updated, (c) => ({ ...c, MetaData: { ...c.MetaData, Level: level } }))
}

export function setPowerLevel(save: CharacterSave, power: number): CharacterSave {
  return updateChar(save, (c) => ({ ...c, MetaData: { ...c.MetaData, PowerLevel: power } }))
}

/** Boolean MetaData flags such as IsOnline / IsGuest. */
export function setMetaFlag(save: CharacterSave, key: string, value: boolean): CharacterSave {
  return updateChar(save, (c) => ({ ...c, MetaData: { ...c.MetaData, [key]: value } }))
}

export function maxAllCurrencies(save: CharacterSave): CharacterSave {
  let updated = save
  for (const name of CURRENCY_ATTRIBUTES) {
    updated = setAttribute(updated, name, MAX_CURRENCY)
  }
  return updated
}

export function setSkin(save: CharacterSave, tag: string): CharacterSave {
  return updateChar(save, (c) => {
    const cosmetics = c.Cosmetics?.Cosmetics ?? {}
    return {
      ...c,
      Cosmetics: {
        ...c.Cosmetics,
        Cosmetics: { ...cosmetics, "SW.Skin": { ...cosmetics["SW.Skin"], TypeTag: tag } },
      },
    }
  })
}

// ── Inventory ───────────────────────────────────────────────────────────

function entries(save: CharacterSave): InventoryEntry[] {
  return save.CharacterSaveV1.Inventory?.Entries ?? []
}

function withEntries(save: CharacterSave, list: InventoryEntry[]): CharacterSave {
  return updateChar(save, (c) => ({ ...c, Inventory: { ...c.Inventory, Entries: list } }))
}

function updateEntry(
  save: CharacterSave,
  index: number,
  fn: (entry: InventoryEntry) => InventoryEntry,
): CharacterSave {
  const list = [...entries(save)]
  if (index < 0 || index >= list.length) return save
  list[index] = fn(list[index])
  return withEntries(save, list)
}

function updateItemData(
  save: CharacterSave,
  index: number,
  fn: (data: InventoryEntry["ItemData"]) => InventoryEntry["ItemData"],
): CharacterSave {
  return updateEntry(save, index, (e) => ({ ...e, ItemData: fn(e.ItemData) }))
}

export function setItemType(save: CharacterSave, index: number, tag: string): CharacterSave {
  return updateItemData(save, index, (d) => ({ ...d, TypeTag: tag }))
}

export function setItemRarity(save: CharacterSave, index: number, rarity: string): CharacterSave {
  return updateItemData(save, index, (d) => ({ ...d, RarityTag: rarity }))
}

/** Writes both current and original power; ItemPowerMax is left as generated. */
export function setItemPower(save: CharacterSave, index: number, power: number): CharacterSave {
  return updateItemData(save, index, (d) => ({
    ...d,
    GeneratorData: {
      ...d.GeneratorData,
      PowerGeneratorValues: { ...d.GeneratorData.PowerGeneratorValues, ItemPower: power, ItemPowerOriginal: power },
    },
  }))
}

// ── Item effects ─────────────────────────────────────────────────────────

export interface ItemEffectSpec {
  /** SW.Enchantment.* or SW.Effect.* */
  effect: string
  /** Tier template, e.g. SW.Enchantment.Channeling.II or SW.EffectTemplate.BeastBoss.I */
  template: string
  /** The tier's fixed value (stored as Intensity). */
  value: number
  /** Enchantment points spent on this effect (enchantments only). */
  points?: number
}

function makeEffect(spec: ItemEffectSpec, previous?: ItemEffect): ItemEffect {
  return {
    TypeTag: spec.effect,
    Intensity: spec.value,
    Quality: previous?.Quality ?? 0,
    EnchantmentPointsInvested: spec.points ?? previous?.EnchantmentPointsInvested ?? 0,
    GeneratorData: {
      ...previous?.GeneratorData,
      GeneratorParentTemplate: spec.template,
      Locked: previous?.GeneratorData.Locked ?? false,
    },
  }
}

/** Batches in the order the game writes them. */
const BATCH_ORDER: string[] = [EFFECT_BATCH.upgradable, EFFECT_BATCH.rerollable, EFFECT_BATCH.enchantment]

function batchRank(batchType: string): number {
  const i = BATCH_ORDER.indexOf(batchType)
  return i < 0 ? BATCH_ORDER.length : i
}

/** Update one batch; an emptied batch is dropped, a new one is inserted in game order. */
function updateBatch(
  save: CharacterSave,
  index: number,
  batchType: string,
  fn: (effects: ItemEffect[]) => ItemEffect[],
): CharacterSave {
  return updateItemData(save, index, (d) => {
    const batches = d.Effects ?? []
    const existing = batches.find((b) => b.TypeTag === batchType)
    const effects = fn(existing?.EffectsInThisBatch ?? [])
    let next: EffectBatch[]
    if (effects.length === 0) {
      next = batches.filter((b) => b !== existing)
    } else if (existing) {
      next = batches.map((b) => (b === existing ? { ...b, EffectsInThisBatch: effects } : b))
    } else {
      next = [...batches, { TypeTag: batchType, EffectsInThisBatch: effects }].sort(
        (a, b) => batchRank(a.TypeTag) - batchRank(b.TypeTag),
      )
    }
    return { ...d, Effects: next }
  })
}

/**
 * Set the effect at `position` in a batch (appends when position is past the end).
 * Fields the editor doesn't manage (Quality, Locked) are kept from the replaced effect.
 */
export function setItemEffect(
  save: CharacterSave,
  index: number,
  batchType: string,
  position: number,
  spec: ItemEffectSpec,
): CharacterSave {
  return updateBatch(save, index, batchType, (effects) => {
    const next = [...effects]
    const at = Math.min(position, next.length)
    next[at] = makeEffect(spec, effects[at])
    return next
  })
}

export function removeItemEffect(save: CharacterSave, index: number, batchType: string, position: number): CharacterSave {
  return updateBatch(save, index, batchType, (effects) => effects.filter((_, i) => i !== position))
}

// ── Talismans ───────────────────────────────────────────────────────────
// A talisman stores every level up front in ItemProgression.ItemLevels, and its
// Upgradable effect batch holds the current level's effects (kept even when
// empty, e.g. companion talismans that grant a tag instead of an effect).

export interface TalismanLevelSpec {
  /** Stat talismans: this level's effect. */
  effect?: ItemEffectSpec
  /** Companion talismans: the tag granted at this level. */
  grantedTag?: string
}

function itemLevels(levels: TalismanLevelSpec[]) {
  return levels.map((l) => ({
    LevelEffects: l.effect ? [makeEffect(l.effect)] : [],
    LevelTags: l.grantedTag ? [l.grantedTag] : [],
  }))
}

function upgradableBatch(levels: TalismanLevelSpec[], levelIndex: number): EffectBatch {
  const effect = levels[levelIndex]?.effect
  return { TypeTag: EFFECT_BATCH.upgradable, EffectsInThisBatch: effect ? [makeEffect(effect)] : [] }
}

interface ItemLevelEntry {
  LevelEffects?: ItemEffect[]
  [key: string]: unknown
}

/**
 * Set a talisman's level (0-based CurrentLevel) and XP. The active effects are
 * copied from that level's stored ItemLevels entry so they always agree.
 */
export function setTalismanProgress(save: CharacterSave, index: number, levelIndex: number, xp: number): CharacterSave {
  return updateItemData(save, index, (d) => {
    const levels = (d.ItemProgression.ItemLevels ?? []) as ItemLevelEntry[]
    const clamped = Math.max(0, Math.min(levelIndex, Math.max(levels.length - 1, 0)))
    const effects = levels[clamped]?.LevelEffects ?? []
    const batches = d.Effects ?? []
    const hasBatch = batches.some((b) => b.TypeTag === EFFECT_BATCH.upgradable)
    return {
      ...d,
      ItemProgression: { ...d.ItemProgression, CurrentLevel: clamped, CurrentXP: Math.max(0, xp) },
      Effects: hasBatch
        ? batches.map((b) => (b.TypeTag === EFFECT_BATCH.upgradable ? { ...b, EffectsInThisBatch: [...effects] } : b))
        : [{ TypeTag: EFFECT_BATCH.upgradable, EffectsInThisBatch: [...effects] }, ...batches],
    }
  })
}

export function setStackCount(save: CharacterSave, index: number, count: number): CharacterSave {
  return updateEntry(save, index, (e) => ({ ...e, StackCount: count }))
}

export function setMerchantSold(save: CharacterSave, index: number, sold: boolean): CharacterSave {
  return updateEntry(save, index, (e) => ({ ...e, MerchantItemSold: sold }))
}

/** Equipment slots are exclusive: equipping clears whichever item held the slot. */
export function setEquippedSlot(save: CharacterSave, index: number, slot: string): CharacterSave {
  const list = [...entries(save)]
  if (index < 0 || index >= list.length) return save
  if (slot !== NO_SLOT) {
    for (let i = 0; i < list.length; i++) {
      if (i !== index && list[i].EquippedSlot === slot) {
        list[i] = { ...list[i], EquippedSlot: NO_SLOT }
      }
    }
  }
  list[index] = { ...list[index], EquippedSlot: slot }
  return withEntries(save, list)
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * Copy owned by the player: fresh seed, unequipped, not merchant stock.
 * Shallow spreads are enough since every mutation is immutable; structuredClone
 * would turn raw-JSON numbers into {"rawJSON": ...} objects.
 */
function cloneAsOwned(entry: InventoryEntry): InventoryEntry {
  return {
    ...entry,
    ItemData: {
      ...entry.ItemData,
      GeneratorData: { ...entry.ItemData.GeneratorData, GenesisRandomSeed: randomSeed() },
      DynamicPropertyTags: [],
      TargetSlotOverride: NO_SLOT,
      PickupTimestamp: nowSeconds(),
    },
    EquippedSlot: NO_SLOT,
    MerchantItemSold: false,
    MerchantDiscount: 0,
  }
}

export function duplicateItem(save: CharacterSave, index: number): CharacterSave {
  const list = entries(save)
  if (index < 0 || index >= list.length) return save
  return withEntries(save, [...list, cloneAsOwned(list[index])])
}

export function deleteItem(save: CharacterSave, index: number): CharacterSave {
  const list = [...entries(save)]
  if (index < 0 || index >= list.length) return save
  list.splice(index, 1)
  return withEntries(save, list)
}

export interface NewItemSpec {
  tag: string
  rarity: string
  /** Item power; ignored when hasPower is false (capes, pets, books store -1). */
  power: number
  hasPower: boolean
  /** CollectionsStats list to record the item in, e.g. "CollectedWeaponsCommon". */
  collectionKey?: string
  /** Talismans: the per-level effects/tags (see talismanLevels). */
  talisman?: TalismanLevelSpec[]
}

/** Record a tag in a string-list field if it isn't there already. */
function addTag(list: string[] | undefined, tag: string): string[] {
  const current = list ?? []
  return current.includes(tag) ? current : [...current, tag]
}

/**
 * Add a brand-new item built from scratch, with the same field layout the game
 * writes for picked-up loot. It's also marked discovered and collected.
 */
export function addItem(save: CharacterSave, spec: NewItemSpec): CharacterSave {
  const power = spec.hasPower ? Math.max(1, spec.power) : -1
  const item: InventoryEntry = {
    ItemData: {
      TypeTag: spec.tag,
      RarityTag: spec.rarity,
      Effects: spec.talisman ? [upgradableBatch(spec.talisman, 0)] : [],
      ItemProgression: { CurrentLevel: 0, CurrentXP: 0, ItemLevels: spec.talisman ? itemLevels(spec.talisman) : [] },
      GeneratorData: {
        GenesisRandomSeed: randomSeed(),
        PowerGeneratorValues: {
          PlayerLevel: Math.max(1, getAttribute(save, "Level")),
          AreaThreatLevel: 1,
          RecommendedThreatLevel: 1,
          ThreatSliderOffset: 0,
          ItemPowerMin: spec.hasPower ? power : 1,
          ItemPowerMax: spec.hasPower ? power : 11,
          RNGRoll: 0,
          ItemPower: power,
          ItemPowerOriginal: spec.hasPower ? power : 0,
        },
      },
      DynamicPropertyTags: ["SW.Item.Property.Dynamic.Unseen"],
      TargetSlotOverride: NO_SLOT,
      PickupTimestamp: nowSeconds(),
      EffectRerolls: 0,
    },
    StackCount: 1,
    EquippedSlot: NO_SLOT,
    MerchantItemSold: false,
    MerchantDiscount: 0,
  }
  const updated = withEntries(save, [...entries(save), item])
  return updateChar(updated, (c) => {
    const stats = c.CollectionsStats ?? {}
    const key = spec.collectionKey
    return {
      ...c,
      LootProgression: { ...c.LootProgression, DiscoveredLoot: addTag(c.LootProgression?.DiscoveredLoot, spec.tag) },
      CollectionsStats:
        key && Array.isArray(stats[key]) ? { ...stats, [key]: addTag(stats[key] as string[], spec.tag) } : stats,
    }
  })
}

/** Move a village-merchant listing into the player's inventory for free. */
export function claimMerchantItem(save: CharacterSave, index: number): CharacterSave {
  return updateEntry(save, index, (e) => ({
    ...e,
    ItemData: { ...e.ItemData, TargetSlotOverride: NO_SLOT, PickupTimestamp: nowSeconds() },
    MerchantItemSold: false,
    MerchantDiscount: 0,
  }))
}

export function maxAllItemPower(save: CharacterSave, power: number): CharacterSave {
  let updated = save
  entries(save).forEach((e, i) => {
    // Capes, pets and books store -1 (no power).
    if (numberValue(e.ItemData.GeneratorData.PowerGeneratorValues.ItemPower) >= 0) {
      updated = setItemPower(updated, i, power)
    }
  })
  return updated
}

// ── Quests ──────────────────────────────────────────────────────────────

function updateQuest(save: CharacterSave, name: string, fn: (q: Quest) => Quest): CharacterSave {
  return updateChar(save, (c) => {
    if (!c.quest) return c
    return { ...c, quest: { ...c.quest, Quests: c.quest.Quests.map((q) => (q.QuestName === name ? fn(q) : q)) } }
  })
}

export function setQuestState(save: CharacterSave, name: string, state: string): CharacterSave {
  return updateQuest(save, name, (q) => ({ ...q, State: state }))
}

export function setTaskState(save: CharacterSave, quest: string, task: string, state: string): CharacterSave {
  return updateQuest(save, quest, (q) => ({
    ...q,
    TaskData: q.TaskData.map((t) => (t.TaskName === task ? { ...t, State: state } : t)),
  }))
}

export function completeQuest(save: CharacterSave, name: string): CharacterSave {
  return updateQuest(save, name, (q) => ({
    ...q,
    State: COMPLETED,
    TaskData: q.TaskData.map((t) => ({ ...t, State: COMPLETED })),
  }))
}

export function setFocusedQuest(save: CharacterSave, name: string): CharacterSave {
  return updateChar(save, (c) => (c.quest ? { ...c, quest: { ...c.quest, FocusedQuestId: name } } : c))
}

// ── Achievements ────────────────────────────────────────────────────────

export type BoolAchievementGroup = "QuestAchievements" | "BoolAchievements"

export function setBoolAchievement(
  save: CharacterSave,
  group: BoolAchievementGroup,
  tag: string,
  completed: boolean,
): CharacterSave {
  return updateChar(save, (c) => {
    const a = c.Achievements ?? {}
    return {
      ...c,
      Achievements: { ...a, [group]: { ...a[group], [tag]: { ...a[group]?.[tag], bCompleted: completed } } },
    }
  })
}

export function setCountAchievement(save: CharacterSave, tag: string, count: number): CharacterSave {
  return updateChar(save, (c) => {
    const a = c.Achievements ?? {}
    return {
      ...c,
      Achievements: {
        ...a,
        CountAchievements: { ...a.CountAchievements, [tag]: { ...a.CountAchievements?.[tag], Count: count } },
      },
    }
  })
}

export function setCollectionTag(save: CharacterSave, achievement: string, tag: string, on: boolean): CharacterSave {
  return updateChar(save, (c) => {
    const a = c.Achievements ?? {}
    const current = a.CollectionAchievements?.[achievement]?.CollectedTags ?? []
    const next = on ? addTag(current, tag) : current.filter((t) => t !== tag)
    return {
      ...c,
      Achievements: {
        ...a,
        CollectionAchievements: {
          ...a.CollectionAchievements,
          [achievement]: { ...a.CollectionAchievements?.[achievement], CollectedTags: next },
        },
      },
    }
  })
}

export const MINECART_ACHIEVEMENT = "SW.Achievements.DiscoverAllMinecartStations"

/**
 * Discovered stations are stored twice: in WorldExploration (what the map
 * uses) and in the minecart collection achievement. Keep both in sync.
 */
export function setMinecartStation(save: CharacterSave, station: string, on: boolean): CharacterSave {
  const updated = updateChar(save, (c) => {
    const current = c.WorldExploration?.DiscoveredMinecartStationTags ?? []
    const next = on ? addTag(current, station) : current.filter((t) => t !== station)
    return { ...c, WorldExploration: { ...c.WorldExploration, DiscoveredMinecartStationTags: next } }
  })
  return setCollectionTag(updated, MINECART_ACHIEVEMENT, station, on)
}

export function unlockAllMinecartStations(save: CharacterSave, stations: string[]): CharacterSave {
  return stations.reduce((s, station) => setMinecartStation(s, station, true), save)
}

export interface AchievementTargets {
  /** Counter achievement → its MaxAmount. */
  counts: Record<string, number>
  /** Collection achievement → every tag it needs. */
  collections: Record<string, string[]>
}

/** Completes bool achievements, raises counters to their target and fills collections. */
export function completeAllAchievements(save: CharacterSave, targets?: AchievementTargets): CharacterSave {
  let updated = save
  const a = save.CharacterSaveV1.Achievements ?? {}
  for (const group of ["QuestAchievements", "BoolAchievements"] as const) {
    for (const tag of Object.keys(a[group] ?? {})) {
      updated = setBoolAchievement(updated, group, tag, true)
    }
  }
  if (!targets) return updated
  for (const tag of Object.keys(a.CountAchievements ?? {})) {
    const target = targets.counts[tag]
    if (target !== undefined && numberValue(a.CountAchievements![tag].Count) < target) {
      updated = setCountAchievement(updated, tag, target)
    }
  }
  for (const tag of Object.keys(a.CollectionAchievements ?? {})) {
    for (const item of targets.collections[tag] ?? []) {
      updated =
        tag === MINECART_ACHIEVEMENT ? setMinecartStation(updated, item, true) : setCollectionTag(updated, tag, item, true)
    }
  }
  return updated
}
