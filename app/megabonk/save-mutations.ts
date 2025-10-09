import type { MegabonkSave } from "@/lib/megabonk/decoder"

/**
 * Sets gold and silver to maximum values (999999)
 */
export function maxAllCurrencies(saveData: MegabonkSave): MegabonkSave {
  return {
    ...saveData,
    gold: 999999,
    silver: 999999,
  }
}

/**
 * Sets all shop items to maximum quantity (999)
 */
export function maxAllShopItems(saveData: MegabonkSave): MegabonkSave {
  const maxedShopItems: Record<string, number> = {}
  Object.keys(saveData.shopItems).forEach((item) => {
    maxedShopItems[item] = 999
  })
  return {
    ...saveData,
    shopItems: maxedShopItems,
  }
}

/**
 * Sets all characters to maximum XP (999999) and runs (100)
 */
export function maxAllCharacters(saveData: MegabonkSave): MegabonkSave {
  const maxedCharacters: Record<string, { xp: number; numRuns: number }> = {}
  Object.keys(saveData.characterProgression).forEach((character) => {
    maxedCharacters[character] = { xp: 999999, numRuns: 100 }
  })
  return {
    ...saveData,
    characterProgression: maxedCharacters,
  }
}

/**
 * Unlocks all characters with minimal values (XP: 100, Runs: 1)
 */
export function unlockAllCharacters(saveData: MegabonkSave): MegabonkSave {
  const unlockedCharacters: Record<string, { xp: number; numRuns: number }> = {}
  Object.keys(saveData.characterProgression).forEach((character) => {
    unlockedCharacters[character] = { xp: 100, numRuns: 1 }
  })
  return {
    ...saveData,
    characterProgression: unlockedCharacters,
  }
}

/**
 * Claims all achievements that are in the achievements array
 */
export function unlockAllAchievements(saveData: MegabonkSave): MegabonkSave {
  return {
    ...saveData,
    claimedAchievements: [...saveData.achievements],
  }
}

/**
 * Adds all available purchases to the save data
 */
export function unlockAllPurchases(saveData: MegabonkSave, availablePurchases: string[]): MegabonkSave {
  return {
    ...saveData,
    purchases: [...availablePurchases],
  }
}

/**
 * Unlocks a specific map by adding it to mapsProgress
 */
export function unlockMap(saveData: MegabonkSave, mapName: string): MegabonkSave {
  if (saveData.menuMeta.mapsProgress[mapName]) {
    return saveData // Already unlocked
  }

  return {
    ...saveData,
    menuMeta: {
      ...saveData.menuMeta,
      mapsProgress: {
        ...saveData.menuMeta.mapsProgress,
        [mapName]: {
          tierNotifications: [],
          tierChallengeNotifications: [],
          newMapNotification: true,
          lastSelectTier: 0,
          completedTiers: [],
          tierCompletionsWithCharacters: { "0": [] },
          numRunsByTier: {},
          tierHighscores: {},
          tierFastestTimes: {},
        },
      },
    },
  }
}

/**
 * Updates character completions for a specific map tier
 */
export function updateMapTierCompletions(
  saveData: MegabonkSave,
  mapName: string,
  tier: string,
  characters: string[],
): MegabonkSave {
  if (!saveData.menuMeta.mapsProgress[mapName]) return saveData

  return {
    ...saveData,
    menuMeta: {
      ...saveData.menuMeta,
      mapsProgress: {
        ...saveData.menuMeta.mapsProgress,
        [mapName]: {
          ...saveData.menuMeta.mapsProgress[mapName],
          tierCompletionsWithCharacters: {
            ...saveData.menuMeta.mapsProgress[mapName].tierCompletionsWithCharacters,
            [tier]: characters,
          },
        },
      },
    },
  }
}

/**
 * Updates number of runs for a specific map tier
 */
export function updateMapTierRuns(saveData: MegabonkSave, mapName: string, tier: string, runs: number): MegabonkSave {
  if (!saveData.menuMeta.mapsProgress[mapName]) return saveData

  return {
    ...saveData,
    menuMeta: {
      ...saveData.menuMeta,
      mapsProgress: {
        ...saveData.menuMeta.mapsProgress,
        [mapName]: {
          ...saveData.menuMeta.mapsProgress[mapName],
          numRunsByTier: {
            ...saveData.menuMeta.mapsProgress[mapName].numRunsByTier,
            [tier]: runs,
          },
        },
      },
    },
  }
}

/**
 * Updates highscore for a specific map tier
 */
export function updateMapTierHighscore(
  saveData: MegabonkSave,
  mapName: string,
  tier: string,
  score: number,
): MegabonkSave {
  if (!saveData.menuMeta.mapsProgress[mapName]) return saveData

  return {
    ...saveData,
    menuMeta: {
      ...saveData.menuMeta,
      mapsProgress: {
        ...saveData.menuMeta.mapsProgress,
        [mapName]: {
          ...saveData.menuMeta.mapsProgress[mapName],
          tierHighscores: {
            ...saveData.menuMeta.mapsProgress[mapName].tierHighscores,
            [tier]: score,
          },
        },
      },
    },
  }
}

/**
 * Updates fastest time for a specific map tier
 */
export function updateMapTierFastestTime(
  saveData: MegabonkSave,
  mapName: string,
  tier: string,
  time: number,
): MegabonkSave {
  if (!saveData.menuMeta.mapsProgress[mapName]) return saveData

  return {
    ...saveData,
    menuMeta: {
      ...saveData.menuMeta,
      mapsProgress: {
        ...saveData.menuMeta.mapsProgress,
        [mapName]: {
          ...saveData.menuMeta.mapsProgress[mapName],
          tierFastestTimes: {
            ...saveData.menuMeta.mapsProgress[mapName].tierFastestTimes,
            [tier]: time,
          },
        },
      },
    },
  }
}

/**
 * Adds a new tier to a specific map
 */
export function addTierToMap(saveData: MegabonkSave, mapName: string, tier: string): MegabonkSave {
  if (!saveData.menuMeta.mapsProgress[mapName]) return saveData

  const mapProgress = saveData.menuMeta.mapsProgress[mapName]

  return {
    ...saveData,
    menuMeta: {
      ...saveData.menuMeta,
      mapsProgress: {
        ...saveData.menuMeta.mapsProgress,
        [mapName]: {
          ...mapProgress,
          tierCompletionsWithCharacters: {
            ...mapProgress.tierCompletionsWithCharacters,
            [tier]: [],
          },
          numRunsByTier: {
            ...mapProgress.numRunsByTier,
            [tier]: 0,
          },
          tierHighscores: {
            ...mapProgress.tierHighscores,
            [tier]: 0,
          },
          tierFastestTimes: {
            ...mapProgress.tierFastestTimes,
            [tier]: 0,
          },
        },
      },
    },
  }
}

/**
 * Removes a tier from a specific map
 */
export function removeTierFromMap(saveData: MegabonkSave, mapName: string, tier: string): MegabonkSave {
  if (!saveData.menuMeta.mapsProgress[mapName]) return saveData

  const mapProgress = saveData.menuMeta.mapsProgress[mapName]

  const newTierCompletions = { ...mapProgress.tierCompletionsWithCharacters }
  const newNumRuns = { ...mapProgress.numRunsByTier }
  const newHighscores = { ...mapProgress.tierHighscores }
  const newFastestTimes = { ...mapProgress.tierFastestTimes }

  delete newTierCompletions[tier]
  delete newNumRuns[tier]
  delete newHighscores[tier]
  delete newFastestTimes[tier]

  return {
    ...saveData,
    menuMeta: {
      ...saveData.menuMeta,
      mapsProgress: {
        ...saveData.menuMeta.mapsProgress,
        [mapName]: {
          ...mapProgress,
          tierCompletionsWithCharacters: newTierCompletions,
          numRunsByTier: newNumRuns,
          tierHighscores: newHighscores,
          tierFastestTimes: newFastestTimes,
        },
      },
    },
  }
}

/**
 * Toggles a character's completion status in a specific map tier
 */
export function toggleCharacterInTier(
  saveData: MegabonkSave,
  mapName: string,
  tier: string,
  character: string,
): MegabonkSave {
  if (!saveData.menuMeta.mapsProgress[mapName]) return saveData

  const currentCharacters = saveData.menuMeta.mapsProgress[mapName].tierCompletionsWithCharacters[tier] || []
  const newCharacters = currentCharacters.includes(character)
    ? currentCharacters.filter((c) => c !== character)
    : [...currentCharacters, character]

  return updateMapTierCompletions(saveData, mapName, tier, newCharacters)
}
