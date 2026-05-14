import type {
  MCDSave,
  Item,
  Enchantment,
  Armorproperty,
  Currency,
  Rarity,
} from "@/lib/minecraft-dungeons/decoder"
import { xpFromLevel, powerFromLevel } from "@/lib/minecraft-dungeons/decoder"

export type ItemLocation = "items" | "storageChestItems"

const MAX_LEVEL = 1_000_000_000
const MAX_ENCH_LEVEL = 3
const ENCH_SLOTS_PER_ITEM = 9
const DEFAULT_ENCH_ID = "Unset"

// ── Player ──────────────────────────────────────────────────────────────

export function setName(save: MCDSave, name: string): MCDSave {
  return { ...save, name }
}

export function setSkin(save: MCDSave, skin: string): MCDSave {
  return { ...save, skin }
}

export function setXp(save: MCDSave, xp: number): MCDSave {
  return { ...save, xp }
}

export function setLevel(save: MCDSave, level: number): MCDSave {
  return { ...save, xp: xpFromLevel(level) }
}

export function maxLevel(save: MCDSave): MCDSave {
  return setLevel(save, MAX_LEVEL)
}

export function setTotalGearPower(save: MCDSave, power: number): MCDSave {
  return { ...save, totalGearPower: power }
}

export function setCustomized(save: MCDSave, value: boolean): MCDSave {
  return { ...save, customized: value }
}

export function setClone(save: MCDSave, value: boolean): MCDSave {
  return { ...save, clone: value }
}

// ── Currencies ──────────────────────────────────────────────────────────

export function setCurrency(save: MCDSave, type: string, count: number): MCDSave {
  const currencies = [...(save.currency ?? [])]
  const idx = currencies.findIndex((c) => c.type === type)
  if (idx >= 0) {
    currencies[idx] = { ...currencies[idx], count }
  } else {
    currencies.push({ type, count })
  }
  return { ...save, currency: currencies }
}

export function maxAllCurrencies(save: MCDSave): MCDSave {
  const types = ["Emerald", "Gold", "EyeOfEnder"]
  let updated = save
  for (const type of types) {
    updated = setCurrency(updated, type, 999999)
  }
  return updated
}

// ── Difficulty / Threat ─────────────────────────────────────────────────

export function setUnlockedDifficulty(save: MCDSave, difficulty: string): MCDSave {
  return {
    ...save,
    difficulties: { ...(save.difficulties ?? {}), unlocked: difficulty },
  }
}

export function setUnlockedThreatLevel(save: MCDSave, threat: string): MCDSave {
  return {
    ...save,
    threatLevels: { ...(save.threatLevels ?? {}), unlocked: threat },
  }
}

// ── Items ───────────────────────────────────────────────────────────────

function updateItem(
  save: MCDSave,
  location: ItemLocation,
  index: number,
  updater: (item: Item) => Item,
): MCDSave {
  const items = [...(save[location] ?? [])]
  if (index < 0 || index >= items.length) return save
  items[index] = updater(items[index])
  return { ...save, [location]: items }
}

function emptyEnchantmentSlots(): Enchantment[] {
  return Array.from({ length: ENCH_SLOTS_PER_ITEM }, () => ({
    id: DEFAULT_ENCH_ID,
    level: 0,
    investedPoints: 0,
  }))
}

export function addItem(
  save: MCDSave,
  location: ItemLocation,
  type: string,
  rarity: Rarity = "Common",
): MCDSave {
  const items = [...(save[location] ?? [])]
  const newItem: Item = {
    type,
    power: 1,
    rarity,
    enchantments: emptyEnchantmentSlots(),
    markedNew: true,
    upgraded: false,
    inventoryIndex: items.length,
  }
  items.push(newItem)
  return { ...save, [location]: items }
}

export function deleteItem(save: MCDSave, location: ItemLocation, index: number): MCDSave {
  const items = [...(save[location] ?? [])]
  if (index < 0 || index >= items.length) return save
  items.splice(index, 1)
  return { ...save, [location]: items }
}

export function duplicateItem(save: MCDSave, location: ItemLocation, index: number): MCDSave {
  const items = [...(save[location] ?? [])]
  if (index < 0 || index >= items.length) return save
  const original = items[index]
  // Deep clone but skip equipmentSlot/inventoryIndex (matches C# Item.Copy)
  const copy: Item = {
    ...original,
    enchantments: original.enchantments?.map((e) => ({ ...e })),
    armorproperties: original.armorproperties?.map((p) => ({ ...p })),
    netheriteEnchant: original.netheriteEnchant ? { ...original.netheriteEnchant } : null,
    equipmentSlot: undefined,
    inventoryIndex: items.length,
    markedNew: true,
  }
  items.push(copy)
  return { ...save, [location]: items }
}

export function transferItem(
  save: MCDSave,
  fromLocation: ItemLocation,
  index: number,
  toLocation: ItemLocation,
): MCDSave {
  if (fromLocation === toLocation) return save
  const fromItems = [...(save[fromLocation] ?? [])]
  if (index < 0 || index >= fromItems.length) return save
  const [item] = fromItems.splice(index, 1)
  const toItems = [...(save[toLocation] ?? [])]
  toItems.push({ ...item, equipmentSlot: undefined, inventoryIndex: toItems.length })
  return { ...save, [fromLocation]: fromItems, [toLocation]: toItems }
}

export function updateItemPower(
  save: MCDSave,
  location: ItemLocation,
  index: number,
  power: number,
): MCDSave {
  return updateItem(save, location, index, (item) => ({ ...item, power }))
}

export function updateItemLevel(
  save: MCDSave,
  location: ItemLocation,
  index: number,
  level: number,
): MCDSave {
  return updateItem(save, location, index, (item) => ({ ...item, power: powerFromLevel(level) }))
}

export function updateItemRarity(
  save: MCDSave,
  location: ItemLocation,
  index: number,
  rarity: Rarity,
): MCDSave {
  return updateItem(save, location, index, (item) => ({ ...item, rarity }))
}

export function updateItemType(
  save: MCDSave,
  location: ItemLocation,
  index: number,
  type: string,
): MCDSave {
  return updateItem(save, location, index, (item) => ({ ...item, type }))
}

export function updateItemFlag(
  save: MCDSave,
  location: ItemLocation,
  index: number,
  flag: "markedNew" | "upgraded" | "gifted",
  value: boolean,
): MCDSave {
  return updateItem(save, location, index, (item) => ({ ...item, [flag]: value }))
}

export function updateItemEquipmentSlot(
  save: MCDSave,
  location: ItemLocation,
  index: number,
  slot: string | undefined,
): MCDSave {
  const items = [...(save[location] ?? [])]
  if (index < 0 || index >= items.length) return save
  // Equipment slots are mutually exclusive: only one item can occupy a given
  // slot at a time. Clear any other item currently holding the new slot
  // before assigning it (matches the in-game behaviour where equipping a new
  // item to a hotbar/weapon slot replaces whatever was there).
  if (slot) {
    for (let i = 0; i < items.length; i++) {
      if (i !== index && items[i].equipmentSlot === slot) {
        items[i] = { ...items[i], equipmentSlot: undefined }
      }
    }
  }
  items[index] = { ...items[index], equipmentSlot: slot }
  return { ...save, [location]: items }
}

// ── Enchantments ────────────────────────────────────────────────────────

export function setEnchantment(
  save: MCDSave,
  location: ItemLocation,
  itemIndex: number,
  slotIndex: number,
  id: string,
  level: number,
): MCDSave {
  return updateItem(save, location, itemIndex, (item) => {
    const slots = [...(item.enchantments ?? emptyEnchantmentSlots())]
    while (slots.length <= slotIndex) {
      slots.push({ id: DEFAULT_ENCH_ID, level: 0 })
    }
    slots[slotIndex] = { id, level }
    return { ...item, enchantments: slots }
  })
}

export function setNetheriteEnchant(
  save: MCDSave,
  location: ItemLocation,
  itemIndex: number,
  id: string,
  level: number,
): MCDSave {
  return updateItem(save, location, itemIndex, (item) => ({
    ...item,
    netheriteEnchant: id === DEFAULT_ENCH_ID || id === "" ? null : { id, level },
  }))
}

// ── Armor properties ────────────────────────────────────────────────────
// Only present on armor items. The C# editor adds new properties with
// id="AllyDamageBoost" rarity="Common" by default.

const DEFAULT_ARMOR_PROPERTY_ID = "AllyDamageBoost"

export function addArmorProperty(
  save: MCDSave,
  location: ItemLocation,
  itemIndex: number,
  id: string = DEFAULT_ARMOR_PROPERTY_ID,
  rarity: Rarity = "Common",
): MCDSave {
  return updateItem(save, location, itemIndex, (item) => {
    const props = [...(item.armorproperties ?? [])]
    props.push({ id, rarity })
    return { ...item, armorproperties: props }
  })
}

export function removeArmorProperty(
  save: MCDSave,
  location: ItemLocation,
  itemIndex: number,
  propertyIndex: number,
): MCDSave {
  return updateItem(save, location, itemIndex, (item) => {
    const props = [...(item.armorproperties ?? [])]
    if (propertyIndex < 0 || propertyIndex >= props.length) return item
    props.splice(propertyIndex, 1)
    return { ...item, armorproperties: props }
  })
}

export function updateArmorPropertyId(
  save: MCDSave,
  location: ItemLocation,
  itemIndex: number,
  propertyIndex: number,
  id: string,
): MCDSave {
  return updateItem(save, location, itemIndex, (item) => {
    const props = [...(item.armorproperties ?? [])]
    if (propertyIndex < 0 || propertyIndex >= props.length) return item
    props[propertyIndex] = { ...props[propertyIndex], id }
    return { ...item, armorproperties: props }
  })
}

export function updateArmorPropertyRarity(
  save: MCDSave,
  location: ItemLocation,
  itemIndex: number,
  propertyIndex: number,
  rarity: Rarity,
): MCDSave {
  return updateItem(save, location, itemIndex, (item) => {
    const props = [...(item.armorproperties ?? [])]
    if (propertyIndex < 0 || propertyIndex >= props.length) return item
    props[propertyIndex] = { ...props[propertyIndex], rarity }
    return { ...item, armorproperties: props }
  })
}

export function maxItemEnchantments(
  save: MCDSave,
  location: ItemLocation,
  index: number,
): MCDSave {
  return updateItem(save, location, index, (item) => {
    const slots = (item.enchantments ?? []).map((e) =>
      e.id !== DEFAULT_ENCH_ID && e.id !== "" ? { ...e, level: MAX_ENCH_LEVEL } : e,
    )
    return { ...item, enchantments: slots }
  })
}

// ── Bulk item operations ────────────────────────────────────────────────

export function maxAllItems(save: MCDSave, location: ItemLocation): MCDSave {
  const items = (save[location] ?? []).map((item) => {
    const slots = (item.enchantments ?? []).map((e) =>
      e.id !== DEFAULT_ENCH_ID && e.id !== "" ? { ...e, level: MAX_ENCH_LEVEL } : e,
    )
    return {
      ...item,
      power: powerFromLevel(MAX_LEVEL),
      enchantments: slots,
    }
  })
  return { ...save, [location]: items }
}

// ── Progress / counters ─────────────────────────────────────────────────

export function setMobKill(save: MCDSave, mobId: string, count: number): MCDSave {
  return {
    ...save,
    mob_kills: { ...(save.mob_kills ?? {}), [mobId]: count },
  }
}

export function setProgressCounter(save: MCDSave, counterId: string, value: number): MCDSave {
  return {
    ...save,
    progressStatCounters: { ...(save.progressStatCounters ?? {}), [counterId]: value },
  }
}

export function maxAllMobKills(save: MCDSave): MCDSave {
  const updated: Record<string, number> = {}
  for (const key of Object.keys(save.mob_kills ?? {})) {
    updated[key] = 999999
  }
  return { ...save, mob_kills: updated }
}

export function maxAllCounters(save: MCDSave): MCDSave {
  const updated: Record<string, number> = {}
  for (const key of Object.keys(save.progressStatCounters ?? {})) {
    updated[key] = 999999
  }
  return { ...save, progressStatCounters: updated }
}
