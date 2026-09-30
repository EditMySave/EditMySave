import type { CharacterData, CharacterSave, InventoryEntry, Quest } from "@/lib/dungeons-2/decoder"
import { CURRENCY_ATTRIBUTES, NO_SLOT, getAttribute, numberValue } from "@/lib/dungeons-2/decoder"

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
      Effects: [],
      ItemProgression: { CurrentLevel: 0, CurrentXP: 0, ItemLevels: [] },
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
