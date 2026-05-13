import type { FFWSave } from "@/lib/far-far-west/decoder"

const MAX_DIFFICULTY = 4
const MAX_MONEY = 999_999_999
const MAX_MATERIAL = 99_999

const CRAFTING_MATERIALS = ["itemAcid", "itemFire", "itemElec", "itemVoodoo", "itemCactus"]
const CURRENCY_KEYS = ["moneyGold", "moneySoul"]

type Inventory = Record<string, number>
type PlayerProgress = {
  selectedPlayerSkin?: string
  selectedEmoteB?: string
  selectedItemUtility?: string
  spellB?: string
  spellC?: string
  fragmentTrackedWeaponName?: string
  unlockedDifficulties?: number
  runtimeInventory?: Inventory
  challenges?: Record<string, number>
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

function clone(save: FFWSave): FFWSave {
  return {
    ...save,
    friendly: { ...save.friendly, playerProgress: { ...(save.friendly.playerProgress ?? {}) } },
  }
}

function progress(save: FFWSave): PlayerProgress {
  return save.friendly.playerProgress as PlayerProgress
}

/** Set an existing runtimeInventory key. Refuses to add new keys (graft would skip them anyway). */
export function setInventoryAmount(save: FFWSave, key: string, amount: number): FFWSave {
  const next = clone(save)
  const inv: Inventory = { ...(progress(next).runtimeInventory ?? {}) }
  if (!Object.prototype.hasOwnProperty.call(inv, key)) {
    console.warn(`setInventoryAmount: "${key}" not in save — ignored (cannot add new inventory keys)`)
    return save
  }
  inv[key] = Math.max(0, Math.floor(amount))
  ;(progress(next) as PlayerProgress).runtimeInventory = inv
  return next
}

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

export function unlockAllDifficulties(save: FFWSave): FFWSave {
  const next = clone(save)
  progress(next).unlockedDifficulties = MAX_DIFFICULTY
  return next
}

export function setUnlockedDifficulties(save: FFWSave, n: number): FFWSave {
  const next = clone(save)
  progress(next).unlockedDifficulties = Math.max(1, Math.min(MAX_DIFFICULTY, Math.floor(n)))
  return next
}

export function setSelectedSkin(save: FFWSave, id: string): FFWSave {
  const next = clone(save)
  progress(next).selectedPlayerSkin = id
  return next
}

export function setSpell(save: FFWSave, slot: "B" | "C", id: string): FFWSave {
  const next = clone(save)
  if (slot === "B") progress(next).spellB = id
  else progress(next).spellC = id
  return next
}

export function setSelectedEmote(save: FFWSave, id: string): FFWSave {
  const next = clone(save)
  progress(next).selectedEmoteB = id
  return next
}

export function setSelectedUtility(save: FFWSave, id: string): FFWSave {
  const next = clone(save)
  progress(next).selectedItemUtility = id
  return next
}

export function setFragmentTrackedWeapon(save: FFWSave, id: string): FFWSave {
  const next = clone(save)
  progress(next).fragmentTrackedWeaponName = id
  return next
}

export function setWeaponTweak(
  save: FFWSave,
  weapon: string,
  tweak: string,
  value: number,
): FFWSave {
  const next = clone(save)
  const upgrades = { ...(progress(next).itemsUpgrades ?? {}) }
  const current = upgrades[weapon] ?? { tweaks: {} }
  const tweaks = { ...(current.tweaks ?? {}) }
  if (!Object.prototype.hasOwnProperty.call(tweaks, tweak)) {
    console.warn(`setWeaponTweak: "${weapon}.${tweak}" not in save — ignored`)
    return save
  }
  tweaks[tweak] = Math.max(0, Math.floor(value))
  upgrades[weapon] = { ...current, tweaks }
  progress(next).itemsUpgrades = upgrades
  return next
}

export function setEquippedJoker(
  save: FFWSave,
  weapon: string,
  slot: "A" | "B" | "C" | "D",
  jokerId: string,
): FFWSave {
  const next = clone(save)
  const jokers = { ...(progress(next).itemJokers ?? {}) }
  const current = jokers[weapon]
  if (!current) {
    console.warn(`setEquippedJoker: weapon "${weapon}" not in save — ignored`)
    return save
  }
  jokers[weapon] = { ...current, [`joker${slot}`]: jokerId }
  progress(next).itemJokers = jokers
  return next
}

export function setChallengeStat(save: FFWSave, key: string, value: number): FFWSave {
  const next = clone(save)
  const challenges = { ...(progress(next).challenges ?? {}) }
  if (!Object.prototype.hasOwnProperty.call(challenges, key)) {
    console.warn(`setChallengeStat: "${key}" not in save — ignored`)
    return save
  }
  challenges[key] = Math.max(0, Math.floor(value))
  progress(next).challenges = challenges
  return next
}

/** Set every existing skin entry in runtimeInventory to 1 (owned). */
export function unlockOwnedSkins(save: FFWSave): FFWSave {
  let out = save
  const inv = progress(out).runtimeInventory ?? {}
  for (const k of Object.keys(inv)) {
    if (k.startsWith("skin")) out = setInventoryAmount(out, k, 1)
  }
  return out
}

/** Set every existing joker entry in runtimeInventory to at least 1. */
export function unlockOwnedJokers(save: FFWSave): FFWSave {
  let out = save
  const inv = progress(out).runtimeInventory ?? {}
  for (const k of Object.keys(inv)) {
    if (k.startsWith("joker") && (inv[k] ?? 0) < 1) {
      out = setInventoryAmount(out, k, 1)
    }
  }
  return out
}
