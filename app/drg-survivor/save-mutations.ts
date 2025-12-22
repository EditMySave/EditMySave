// Deep Rock Galactic: Survivor save mutation functions

export interface DRGSurvivorSave {
  Version: number
  Timestamp: number
  Challenges: any[]
  WeaponSaveData: any[]
  BiomeSaveData: any[]
  MutatorSaveData: any[]
  ClassModSaveData: any[]
  MetaStatUpgrades: MetaStatUpgrade[]
  MileStoneStates: MilestoneState[]
  UnlockedChallengeSetIds: string[]
  UnlockedWeaponIds: string[]
  UnlockedArtifactIds: string[]
  UnlockedClassArtifactIds: string[]
  OverclockUnlockedWeaponIds: string[]
  UnlockedClassIds: string[]
  DailyScore: number | null
  DailyEndlessScore: number | null
  WeeklyScore: number | null
  WeeklyEndlessScore: number | null
  BiomeScore: BiomeScore[]
  BiomeScoreEscort: any[]
  BiomeEndlessScore: any[]
  ChallengeScore: any[]
  ChallengeEndlessScore: any[]
  GearSaveData: any[]
  EquippedGear: any[]
  EliminationRoad: any
  EscortRoad: any
  MaxHazIndex: number
  LastCompletedDaily: any
  LastCompletedWeekly: any
  CompletedDailyCount: number
  CompletedWeeklyCount: number
  ClaimedPowerCores: any[]
  BiomeGoalPoints: number
  MissionGoalPoints: number
  Credits: number
  Bismor: number
  Croppa: number
  EnorPearl: number
  Jadiz: number
  Magnite: number
  Umanite: number
  PowerCore: number
  GearCollected: number
  GearLevelBonus: number
  ActiveLoadout: number
  ClassRanks: ClassRank[]
  PlayerRank: number
  TotalClassLevels: number
  NumDivesTotal: number
  SecondaryObjectivesUnlocked: boolean
  IsRelease: boolean
}

export interface MetaStatUpgrade {
  Id: string
  Level: number
}

export interface MilestoneState {
  Guid: string
  Progress: number
  IsCompleted: boolean
}

export interface BiomeScore {
  GUID: string
  Score: number
}

export interface ClassRank {
  ClassType: number
  Xp: number
  Rank: number
}

// Meta stat upgrade IDs and their display names
export const META_STAT_UPGRADES: Record<string, { name: string; maxLevel: number }> = {
  msu_damageMod: { name: "Damage", maxLevel: 12 },
  msu_armor: { name: "Armor", maxLevel: 12 },
  msu_xpGain: { name: "XP Gain", maxLevel: 12 },
  msu_critChance: { name: "Critical Chance", maxLevel: 12 },
  msu_stausEffectDamage: { name: "Status Effect Damage", maxLevel: 12 },
  msu_moveSpeed: { name: "Movement Speed", maxLevel: 12 },
  msu_reloadSpeed: { name: "Reload Speed", maxLevel: 12 },
  msu_miningSpeed: { name: "Mining Speed", maxLevel: 12 },
  msu_pickupRadius: { name: "Pickup Radius", maxLevel: 12 },
  msu_critDamage: { name: "Critical Damage", maxLevel: 12 },
  msu_lifeRegen: { name: "Life Regeneration", maxLevel: 12 },
  msu_luck: { name: "Luck", maxLevel: 12 },
  msu_fireRate: { name: "Fire Rate", maxLevel: 12 },
  msu_maxHp: { name: "Max HP", maxLevel: 12 },
  msu_potency: { name: "Potency", maxLevel: 12 },
  msu_startingNitra: { name: "Starting Nitra", maxLevel: 12 },
  msu_startingGold: { name: "Starting Gold", maxLevel: 12 },
  msu_artifactReroll: { name: "Artifact Reroll", maxLevel: 12 },
}

// Class types mapping
export const CLASS_TYPES: Record<number, string> = {
  0: "Scout",
  1: "Driller",
  2: "Engineer",
  3: "Gunner",
}

export const CLASS_IDS: Record<string, string> = {
  SCOUT: "Scout",
  DRILLER: "Driller",
  ENGINEER: "Engineer",
  GUNNER: "Gunner",
}

/**
 * Update a specific resource value
 */
export function updateResource(
  saveData: DRGSurvivorSave,
  resource: keyof Pick<
    DRGSurvivorSave,
    "Credits" | "Bismor" | "Croppa" | "EnorPearl" | "Jadiz" | "Magnite" | "Umanite" | "PowerCore"
  >,
  value: number,
): DRGSurvivorSave {
  return {
    ...saveData,
    [resource]: Math.max(0, value),
  }
}

/**
 * Max all resources to a specified value
 */
export function maxAllResources(saveData: DRGSurvivorSave, maxValue = 999999): DRGSurvivorSave {
  return {
    ...saveData,
    Credits: maxValue,
    Bismor: maxValue,
    Croppa: maxValue,
    EnorPearl: maxValue,
    Jadiz: maxValue,
    Magnite: maxValue,
    Umanite: maxValue,
    PowerCore: maxValue,
  }
}

/**
 * Update a specific meta stat upgrade level
 */
export function updateMetaStatLevel(saveData: DRGSurvivorSave, upgradeId: string, level: number): DRGSurvivorSave {
  const maxLevel = META_STAT_UPGRADES[upgradeId]?.maxLevel ?? 12
  const clampedLevel = Math.max(0, Math.min(level, maxLevel))

  const existingIndex = saveData.MetaStatUpgrades.findIndex((u) => u.Id === upgradeId)

  if (existingIndex >= 0) {
    const updatedUpgrades = [...saveData.MetaStatUpgrades]
    updatedUpgrades[existingIndex] = { ...updatedUpgrades[existingIndex], Level: clampedLevel }
    return { ...saveData, MetaStatUpgrades: updatedUpgrades }
  } else {
    return {
      ...saveData,
      MetaStatUpgrades: [...saveData.MetaStatUpgrades, { Id: upgradeId, Level: clampedLevel }],
    }
  }
}

/**
 * Max all meta stat upgrades to their maximum levels
 */
export function maxAllMetaStats(saveData: DRGSurvivorSave): DRGSurvivorSave {
  const maxedUpgrades: MetaStatUpgrade[] = Object.entries(META_STAT_UPGRADES).map(([id, info]) => ({
    Id: id,
    Level: info.maxLevel,
  }))

  return {
    ...saveData,
    MetaStatUpgrades: maxedUpgrades,
  }
}

/**
 * Update class rank and XP
 */
export function updateClassRank(
  saveData: DRGSurvivorSave,
  classType: number,
  rank: number,
  xp: number,
): DRGSurvivorSave {
  const updatedRanks = saveData.ClassRanks.map((cr) => {
    if (cr.ClassType === classType) {
      return { ...cr, Rank: Math.max(1, rank), Xp: Math.max(0, xp) }
    }
    return cr
  })

  // Calculate total class levels
  const totalLevels = updatedRanks.reduce((sum, cr) => sum + cr.Rank, 0)

  return {
    ...saveData,
    ClassRanks: updatedRanks,
    TotalClassLevels: totalLevels,
  }
}

/**
 * Max all class ranks
 */
export function maxAllClassRanks(saveData: DRGSurvivorSave, maxRank = 50): DRGSurvivorSave {
  const updatedRanks = saveData.ClassRanks.map((cr) => ({
    ...cr,
    Rank: maxRank,
    Xp: 0,
  }))

  const totalLevels = updatedRanks.reduce((sum, cr) => sum + cr.Rank, 0)

  return {
    ...saveData,
    ClassRanks: updatedRanks,
    TotalClassLevels: totalLevels,
  }
}

/**
 * Unlock a class
 */
export function unlockClass(saveData: DRGSurvivorSave, classId: string): DRGSurvivorSave {
  if (saveData.UnlockedClassIds.includes(classId)) {
    return saveData
  }

  return {
    ...saveData,
    UnlockedClassIds: [...saveData.UnlockedClassIds, classId],
  }
}

/**
 * Unlock all classes
 */
export function unlockAllClasses(saveData: DRGSurvivorSave): DRGSurvivorSave {
  const allClassIds = Object.keys(CLASS_IDS)
  return {
    ...saveData,
    UnlockedClassIds: allClassIds,
  }
}

/**
 * Update player rank
 */
export function updatePlayerRank(saveData: DRGSurvivorSave, rank: number): DRGSurvivorSave {
  return {
    ...saveData,
    PlayerRank: Math.max(1, rank),
  }
}

/**
 * Update max hazard index
 */
export function updateMaxHazIndex(saveData: DRGSurvivorSave, hazIndex: number): DRGSurvivorSave {
  return {
    ...saveData,
    MaxHazIndex: Math.max(0, hazIndex),
  }
}

/**
 * Update number of total dives
 */
export function updateNumDives(saveData: DRGSurvivorSave, numDives: number): DRGSurvivorSave {
  return {
    ...saveData,
    NumDivesTotal: Math.max(0, numDives),
  }
}
