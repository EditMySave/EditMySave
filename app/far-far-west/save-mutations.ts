import type { FFWSave } from "@/lib/far-far-west/decoder"
import { reprojectFriendly } from "@/lib/far-far-west/decoder"
import * as raw from "@/lib/far-far-west/raw_ops"
import upgradeCapsData from "@/data/far-far-west/upgrade-caps.json"

export const INT32_MAX = 2_147_483_647
export const MAX_DIFFICULTY = 4
export const MAX_MONEY = 999_999_999
export const MAX_MATERIAL = 99_999
export const MAX_ITEM_LEVEL = 100
export const MAX_STACK = 99_999
export const TWEAK_FALLBACK_CAP = 16

const UPGRADE_CAPS = upgradeCapsData.caps as Record<string, Record<string, number>>

const CRAFTING_MATERIALS = ["itemAcid", "itemFire", "itemElec", "itemVoodoo", "itemCactus"]
const CURRENCY_KEYS = ["moneyGold", "moneySoul", "moneyTicket"]
const KNOWN_LOADOUT_FIELDS = [
  "selectedPlayerSkin",
  "selectedMountSkin",
  "selectedEmoteA",
  "selectedEmoteB",
  "selectedEmoteC",
  "selectedEmoteD",
  "selectedItemA",
  "selectedItemB",
  "selectedItemUtility",
  "selectedSpellA",
  "spellB",
  "spellC",
  "specialWeaponElement",
  "fragmentTrackedWeaponName",
  "title",
] as const

type Inventory = Record<string, number>
type Challenges = Record<string, number>

type PlayerProgress = {
  selectedPlayerSkin?: string
  selectedEmoteB?: string
  selectedItemUtility?: string
  spellB?: string
  spellC?: string
  fragmentTrackedWeaponName?: string
  title?: string
  unlockedDifficulties?: number
  runtimeInventory?: Inventory
  challenges?: Challenges
  itemsUpgrades?: Record<string, { tweaks?: Record<string, number> }>
  itemJokers?: Record<string, {
    jokerA?: string
    jokerB?: string
    jokerC?: string
    jokerD?: string
    jokers?: string[]
  }>
  [k: string]: unknown
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

export function clampInt32(value: number, min = 0): number {
  if (!Number.isFinite(value)) return min
  const n = Math.floor(value)
  if (n < min) return min
  if (n > INT32_MAX) return INT32_MAX
  return n
}

/** level = ceil(amount / 1000), clamped to >= 1. */
export function levelFromAmount(amount: number): number {
  return Math.max(1, Math.floor((Math.max(amount, 0) + 999) / 1000))
}

/** Reverse of levelFromAmount, preserving the existing progress-into-level. */
export function amountForLevel(level: number, currentAmount: number): number {
  let progress = Math.max(currentAmount, 0) % 1000
  if (progress === 0 && currentAmount > 0) progress = 1000
  return Math.max(level - 1, 0) * 1000 + progress
}

/** Upgrade cap for a (weapon, tweak) pair. Falls back to max(current, 16). */
export function upgradeCapFor(weapon: string, tweak: string, currentValue: number): number {
  const explicit = UPGRADE_CAPS[weapon]?.[tweak]
  if (typeof explicit === "number") return explicit
  return Math.max(currentValue, TWEAK_FALLBACK_CAP)
}

function clone(save: FFWSave): FFWSave {
  return {
    ...save,
    friendly: { ...save.friendly, playerProgress: { ...(save.friendly.playerProgress ?? {}) } },
  }
}

function progress(save: FFWSave): PlayerProgress {
  return save.friendly.playerProgress as PlayerProgress
}

// ---------------------------------------------------------------------------
// Inventory ↔ challenge-level sync
// ---------------------------------------------------------------------------

function levelKeyFor(itemKey: string): string {
  return `${itemKey}Lvl`
}

/**
 * Set a runtimeInventory key. Clamps to [0, INT32_MAX]. Adds the key if
 * it isn't already in the save (via raw scaffold; clones an existing
 * inventory entry as template). If the save has a matching
 * `challenges.<key>Lvl`, that level is recomputed from the new amount
 * (game keeps these in lockstep) — and added too if missing.
 */
export function setInventoryAmount(save: FFWSave, key: string, amount: number): FFWSave {
  const clamped = clampInt32(amount)
  const inv: Inventory = progress(save).runtimeInventory ?? {}

  if (Object.prototype.hasOwnProperty.call(inv, key)) {
    // Value-only path — friendly update; graft patches raw at encode.
    const next = clone(save)
    const nextInv: Inventory = { ...inv, [key]: clamped }
    ;(progress(next) as PlayerProgress).runtimeInventory = nextInv

    const lvl = levelKeyFor(key)
    const challenges: Challenges = progress(next).challenges ?? {}
    if (Object.prototype.hasOwnProperty.call(challenges, lvl)) {
      progress(next).challenges = { ...challenges, [lvl]: levelFromAmount(clamped) }
    }
    return next
  }

  // Structural path — insert the entry into raw, then reproject friendly.
  const r = raw.insertInventoryEntry(save.raw, key, clamped)
  if (r === "no-template") {
    console.warn(`setInventoryAmount: cannot insert "${key}" — runtimeInventory has no template entry`)
    return save
  }

  // Pair the level stat. Add it to the challenges map if it isn't there.
  const lvl = levelKeyFor(key)
  const challenges = progress(save).challenges ?? {}
  if (Object.prototype.hasOwnProperty.call(challenges, lvl)) {
    // existing: graft will sync from friendly — update via reproject after.
  } else {
    raw.insertMapEntry(save.raw, "playerProgress.challenges", lvl, levelFromAmount(clamped))
  }
  // After both raw inserts, re-derive friendly so the UI catches up.
  const projected = reprojectFriendly(save)
  if (Object.prototype.hasOwnProperty.call(challenges, lvl)) {
    progress(projected).challenges = {
      ...(progress(projected).challenges ?? {}),
      [lvl]: levelFromAmount(clamped),
    }
  }
  return projected
}

/**
 * Set a challenge stat. Adds the key if it isn't in the save (via raw).
 * For <itemX>Lvl keys with a paired runtimeInventory entry, also
 * recomputes the inventory amount preserving progress-into-level.
 */
export function setChallengeStat(save: FFWSave, key: string, value: number): FFWSave {
  const clamped = clampInt32(value)
  const challenges: Challenges = progress(save).challenges ?? {}

  if (!Object.prototype.hasOwnProperty.call(challenges, key)) {
    const r = raw.insertMapEntry(save.raw, "playerProgress.challenges", key, clamped)
    if (r === "no-template") {
      console.warn(`setChallengeStat: cannot insert "${key}" — challenges map has no template entry`)
      return save
    }
    return reprojectFriendly(save)
  }

  const next = clone(save)
  progress(next).challenges = { ...challenges, [key]: clamped }

  if (key.startsWith("item") && key.endsWith("Lvl")) {
    const itemKey = key.slice(0, -"Lvl".length)
    const inv: Inventory = progress(next).runtimeInventory ?? {}
    if (Object.prototype.hasOwnProperty.call(inv, itemKey)) {
      const current = inv[itemKey] ?? 0
      const nextAmount = clampInt32(amountForLevel(clamped, current))
      progress(next).runtimeInventory = { ...inv, [itemKey]: nextAmount }
    }
  }
  return next
}

// ---------------------------------------------------------------------------
// Loadout
// ---------------------------------------------------------------------------

export function setLoadoutField(
  save: FFWSave,
  field: (typeof KNOWN_LOADOUT_FIELDS)[number],
  value: string,
): FFWSave {
  if (Object.prototype.hasOwnProperty.call(progress(save), field)) {
    const next = clone(save)
    ;(progress(next) as Record<string, unknown>)[field] = value
    return next
  }

  // Add a brand-new scalar property onto playerProgress via the raw scaffold.
  // Clones a sibling string/name property as the envelope template.
  const r = raw.setScalarProperty(save.raw, "playerProgress", field, value)
  if (r === "no-template") {
    console.warn(`setLoadoutField: cannot insert "${field}" — no template scalar property in playerProgress`)
    return save
  }
  return reprojectFriendly(save)
}

export function setSelectedSkin(save: FFWSave, id: string): FFWSave {
  return setLoadoutField(save, "selectedPlayerSkin", id)
}

export function setSpell(save: FFWSave, slot: "B" | "C", id: string): FFWSave {
  return setLoadoutField(save, slot === "B" ? "spellB" : "spellC", id)
}

export function setSelectedEmote(save: FFWSave, id: string): FFWSave {
  return setLoadoutField(save, "selectedEmoteB", id)
}

export function setSelectedUtility(save: FFWSave, id: string): FFWSave {
  return setLoadoutField(save, "selectedItemUtility", id)
}

export function setFragmentTrackedWeapon(save: FFWSave, id: string): FFWSave {
  return setLoadoutField(save, "fragmentTrackedWeaponName", id)
}

// ---------------------------------------------------------------------------
// Weapon tweaks (clamped by UPGRADE_CAPS)
// ---------------------------------------------------------------------------

export function setWeaponTweak(
  save: FFWSave,
  weapon: string,
  tweak: string,
  value: number,
): FFWSave {
  const upgrades = progress(save).itemsUpgrades ?? {}
  const current = upgrades[weapon]
  const tweaks = current?.tweaks ?? {}
  const cap = upgradeCapFor(weapon, tweak, tweaks[tweak] ?? 0)
  const clamped = Math.min(clampInt32(value), cap)

  if (current && Object.prototype.hasOwnProperty.call(tweaks, tweak)) {
    const next = clone(save)
    const nextUpgrades = { ...upgrades }
    nextUpgrades[weapon] = { ...current, tweaks: { ...tweaks, [tweak]: clamped } }
    progress(next).itemsUpgrades = nextUpgrades
    return next
  }

  // Structural path — bootstraps `itemsUpgrades[weapon]` if absent and
  // inserts the tweak map entry.
  const r = raw.setWeaponTweak(save.raw, weapon, tweak, clamped)
  if (r === "no-template") {
    console.warn(`setWeaponTweak: cannot insert "${weapon}.${tweak}" — no template weapon/tweak in save`)
    return save
  }
  return reprojectFriendly(save)
}

export function setEquippedJoker(
  save: FFWSave,
  weapon: string,
  slot: "A" | "B" | "C" | "D",
  jokerId: string,
): FFWSave {
  const jokers = progress(save).itemJokers ?? {}
  const current = jokers[weapon]
  if (current) {
    const next = clone(save)
    const nextJokers = { ...jokers, [weapon]: { ...current, [`joker${slot}`]: jokerId } }
    progress(next).itemJokers = nextJokers
    return next
  }

  // Structural path — bootstraps `itemJokers[weapon]` if absent.
  const r = raw.setEquippedJokerSlot(save.raw, weapon, slot, jokerId)
  if (r === "no-template") {
    console.warn(`setEquippedJoker: cannot insert "${weapon}.${slot}" — no template joker entry in save`)
    return save
  }
  return reprojectFriendly(save)
}

// Add a joker to a weapon's owned-pool (`itemJokers[weapon].jokers[]`).
// Bootstraps the weapon entry if it isn't in the save.
export function addJokerToWeaponPool(save: FFWSave, weapon: string, jokerId: string): FFWSave {
  const r = raw.addJokerToWeaponPool(save.raw, weapon, jokerId)
  if (r === "no-template") {
    console.warn(`addJokerToWeaponPool: cannot add "${jokerId}" to "${weapon}" pool — no template`)
    return save
  }
  if (r === "duplicate") return save
  return reprojectFriendly(save)
}

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------

export function setUnlockedDifficulties(save: FFWSave, n: number): FFWSave {
  const next = clone(save)
  const clamped = Math.max(1, Math.min(MAX_DIFFICULTY, Math.floor(n || 1)))
  progress(next).unlockedDifficulties = clamped
  return next
}

export function unlockAllDifficulties(save: FFWSave): FFWSave {
  return setUnlockedDifficulties(save, MAX_DIFFICULTY)
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export function maxCurrencies(save: FFWSave): FFWSave {
  let out = save
  for (const k of CURRENCY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(progress(out).runtimeInventory ?? {}, k)) {
      out = setInventoryAmount(out, k, MAX_MONEY)
    }
  }
  return out
}

export function maxCraftingMaterials(save: FFWSave): FFWSave {
  let out = save
  for (const k of CRAFTING_MATERIALS) {
    if (Object.prototype.hasOwnProperty.call(progress(out).runtimeInventory ?? {}, k)) {
      out = setInventoryAmount(out, k, MAX_MATERIAL)
    }
  }
  return out
}

/** Bumps every `item*Lvl` challenge to MAX_ITEM_LEVEL (100), resyncing inventory. */
export function maxItemLevels(save: FFWSave): FFWSave {
  const challenges = progress(save).challenges ?? {}
  let out = save
  for (const key of Object.keys(challenges)) {
    if (key.startsWith("item") && key.endsWith("Lvl")) {
      out = setChallengeStat(out, key, MAX_ITEM_LEVEL)
    }
  }
  return out
}

/** Apply UPGRADE_CAPS to every existing tweak. Unknown tweaks → max(current, 16). */
export function maxWeaponUpgrades(save: FFWSave): FFWSave {
  const upgrades = progress(save).itemsUpgrades ?? {}
  let out = save
  for (const [weapon, entry] of Object.entries(upgrades)) {
    for (const [tweak, value] of Object.entries(entry.tweaks ?? {})) {
      const cap = upgradeCapFor(weapon, tweak, value ?? 0)
      out = setWeaponTweak(out, weapon, tweak, cap)
    }
  }
  return out
}

/**
 * Stack every `item*` runtimeInventory key to MAX_STACK, except fragments,
 * prestige unlocks, and the `upgradeSlot*` family. Mirrors `preset_stack_items`.
 */
export function stackAllItems(save: FFWSave): FFWSave {
  const inv = progress(save).runtimeInventory ?? {}
  let out = save
  for (const key of Object.keys(inv)) {
    if (!key.startsWith("item")) continue
    if (key.endsWith("Fragment") || key.endsWith("Prestige")) continue
    if (key.startsWith("upgradeSlot")) continue
    out = setInventoryAmount(out, key, MAX_STACK)
  }
  return out
}

function bumpOwnedByPrefix(save: FFWSave, prefix: string): FFWSave {
  const inv = progress(save).runtimeInventory ?? {}
  let out = save
  for (const key of Object.keys(inv)) {
    if (key.startsWith(prefix) && (inv[key] ?? 0) < 1) {
      out = setInventoryAmount(out, key, 1)
    }
  }
  return out
}

export function unlockOwnedSkins(save: FFWSave): FFWSave {
  // Set every owned-or-placeholder skin entry to ≥1.
  const inv = progress(save).runtimeInventory ?? {}
  let out = save
  for (const key of Object.keys(inv)) {
    if (key.startsWith("skin")) out = setInventoryAmount(out, key, Math.max(inv[key], 1))
  }
  return out
}

export function unlockOwnedMounts(save: FFWSave): FFWSave {
  return bumpOwnedByPrefix(save, "mount")
}

export function unlockOwnedEmotes(save: FFWSave): FFWSave {
  return bumpOwnedByPrefix(save, "emote")
}

export function unlockOwnedMaps(save: FFWSave): FFWSave {
  return bumpOwnedByPrefix(save, "map")
}

export function unlockOwnedTitles(save: FFWSave): FFWSave {
  return bumpOwnedByPrefix(save, "title")
}

export function unlockOwnedJokers(save: FFWSave): FFWSave {
  const inv = progress(save).runtimeInventory ?? {}
  let out = save
  for (const key of Object.keys(inv)) {
    if (key.startsWith("joker") && (inv[key] ?? 0) < 1) {
      out = setInventoryAmount(out, key, 1)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Exports for the UI
// ---------------------------------------------------------------------------

export { UPGRADE_CAPS, KNOWN_LOADOUT_FIELDS }
