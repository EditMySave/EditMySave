import type { CloverpitJsonSave } from "@/lib/cloverpit/decoder"
import { setByte } from "@/lib/cloverpit/decoder"

export function maxAllCurrencies(save: CloverpitJsonSave): CloverpitJsonSave {
  const updated = { ...save }
  const gd = updated.gameplayData

  setByte(gd, "coins_ByteArray", 255)
  setByte(gd, "depositedCoins_ByteArray", 255)
  gd.cloverTickets = 999999

  return updated
}

export function maxSpins(save: CloverpitJsonSave): CloverpitJsonSave {
  const updated = { ...save }
  updated.gameplayData.spinsLeft = 999
  updated.gameplayData.maxSpins = 999
  updated.gameplayData.extraSpins = 999
  return updated
}

export function unlockAllPowerups(save: CloverpitJsonSave): CloverpitJsonSave {
  const updated = { ...save }
  const gd = updated.gameplayData

  if (Array.isArray(gd.powerupsData)) {
    gd.powerupsData.forEach((p) => {
      p.boughtTimes = Math.max(1, p.boughtTimes)
    })
  }

  updated.hasEverUnlockedAPowerup = true
  updated._allCardsUnlocked = true

  return updated
}

export function unlockAllDrawers(save: CloverpitJsonSave): CloverpitJsonSave {
  const updated = { ...save }
  updated.drawersUnlocked = [true, true, true, true]
  return updated
}

export function maxLuck(save: CloverpitJsonSave): CloverpitJsonSave {
  const updated = { ...save }
  const gd = updated.gameplayData

  gd.powerupLuck = 10
  gd.activationLuck = 10
  gd.storeLuck = 10

  return updated
}

export function disable666(save: CloverpitJsonSave): CloverpitJsonSave {
  const updated = { ...save }
  const gd = updated.gameplayData

  gd._666Chance = 0
  gd._666BookedSpin = -1
  gd._666SuppressedSpinsLeft = 999

  return updated
}

export function force666(save: CloverpitJsonSave): CloverpitJsonSave {
  const updated = { ...save }
  const gd = updated.gameplayData

  gd._666Chance = 1
  gd._666BookedSpin = 1

  return updated
}

export function transformPhoneToHoly(save: CloverpitJsonSave): CloverpitJsonSave {
  const updated = { ...save }
  const gd = updated.gameplayData

  gd._phoneAlreadyTransformed = true
  gd._phone_bookSpecialCall = true
  gd._phone_EvilCallsIgnored_Counter = 3
  gd.phoneEasyCounter_SkippedCalls_Evil = 3
  gd._phone_SpecialCalls_Counter = Math.max(gd._phone_SpecialCalls_Counter || 0, 1)
  gd._phone_AbilitiesToPick_String =
    "holyGeneric_SpawnSacredCharm,holyPatternsValue_3LessElements,holyGeneric_MultiplierSymbols_1,holyGeneric_ReduceChargesNeeded_ForRedButtonCharms"
  gd._phone_lastAbilityCategory = 2

  return updated
}

export function clearEquippedPowerups(save: CloverpitJsonSave): CloverpitJsonSave {
  const updated = { ...save }
  updated.gameplayData.equippedPowerups = Array(30).fill("undefined")
  return updated
}

export function clearStorePowerups(save: CloverpitJsonSave): CloverpitJsonSave {
  const updated = { ...save }
  updated.gameplayData.storePowerups = Array(4).fill("undefined")
  return updated
}

export function clearDrawerPowerups(save: CloverpitJsonSave): CloverpitJsonSave {
  const updated = { ...save }
  updated.gameplayData.drawerPowerups = Array(4).fill("undefined")
  return updated
}

export function addAllRunModifiers(save: CloverpitJsonSave): CloverpitJsonSave {
  const updated = { ...save }

  const standardModifiers = [
    "defaultModifier",
    "phoneEnhancer",
    "redButtonOverload",
    "smallerStore",
    "smallItemPool",
    "interestsGrow",
    "lessSpaceMoreDiscount",
    "smallRoundsMoreRounds",
    "oneRoundPerDeadline",
    "headStart",
    "extraPacks",
    "_666BigBetDouble_SmallBetNoone",
    "_666DoubleChances_JackpotRecovers",
    "_666LastRoundGuaranteed",
    "drawerTableModifications",
    "drawerModGamble",
    "halven2SymbolsChances",
    "charmsRecycling",
    "allCharmsStoreModded",
    "bigDebt",
  ]

  const existingModifiers = updated._runModSavingList || []
  const existingNames = new Set(existingModifiers.map((m) => m.runModifierIdentifierAsString))

  standardModifiers.forEach((modName) => {
    if (!existingNames.has(modName)) {
      existingModifiers.push({
        runModifierIdentifierAsString: modName,
        ownedCount: 0,
        unlockedTimes: 0,
        playedTimes: 0,
        wonTimes: 0,
        foilLevel: 0,
      })
    }
  })

  updated._runModSavingList = existingModifiers
  return updated
}
