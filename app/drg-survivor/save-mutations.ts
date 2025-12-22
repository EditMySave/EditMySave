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

// All weapon IDs from the maxed save file
export const ALL_WEAPON_IDS = [
  "2d35d22b-50f2-42e4-bd0d-b246a8fc1c1a",
  "6ad964a2-f17a-4ed2-943b-f184da3d1c7a",
  "948cc5f6-fbb4-40a3-bfed-f97162721040",
  "67e123ca-612d-48ef-8ee6-b7456d489b01",
  "e4b6139b-2abc-4cfa-a1a5-24b79f484511",
  "3f2291e8-3d1a-4a6c-ae16-23b4a022a972",
  "724bf734-38cf-4fb3-a369-e050dbeb835a",
  "58893b54-dda5-42a1-9f5d-faa197970981",
  "2d22070b-0ebc-43ff-a4ec-db864f30f899",
  "5a91ac2c-9751-4917-99cd-207351fabd4c",
  "7bdddaa8-2eb8-4270-9304-8f8cf43157a8",
  "60007f2b-64e3-4025-b281-eac6bc2b8526",
  "ea134bab-6bc7-430e-87e0-8372a109802b",
  "29d64624-86a7-4c99-a10f-d95d40206db5",
  "0a23e96c-3230-4bfe-9d3b-a18a74ffb5e4",
  "666aa743-63b3-4dc8-8385-566efcfdca1b",
  "8a868db0-7f1c-474b-a7b7-3dc2463c0362",
  "ecec62d9-9fe6-4852-aefa-e821acc7eecf",
  "3f3f1232-4b77-481d-b6cc-4c2f52442cfa",
  "7cd587dc-81a2-4cb2-aac8-3c958338ef8a",
  "c9a72abb-b0d8-490c-abf7-7180bc0a9979",
  "a8f5c205-ff59-42e8-85a7-ae6fd712b967",
  "cd3aa60a-e994-40f0-a213-179c1fedf15c",
  "8ed23a22-534e-4cc4-8786-bdd28f220b1c",
  "7dfc9e7d-5e63-4aa5-b57b-84dc6199206b",
  "9cd8f5e4-49a2-4dd2-88a2-84fbd589ffe2",
  "ae32c0e1-467e-4ea2-ae9d-f7f20a2e7b07",
  "e2cb84d9-abcf-461d-8cc4-296b633a9acb",
  "8e4fd562-9ad6-418d-9863-b11f100884fd",
  "b4fbef58-09ad-443d-bc78-1b540e1f1ea1",
  "539a0e86-fe2e-457b-8860-c07a1c79975f",
  "3a48e3b8-3520-4ff6-9b5b-bbb96314a445",
  "b6980e26-e39e-41d8-a887-9537f3315d25",
  "c3b7809a-9e67-45db-b028-ff4fc1a67c08",
  "126de2c9-a957-4cd3-a146-19eed78565c6",
  "6c633217-8ac1-4d89-8cff-a073c05fcf03",
  "450cad09-bacb-4b84-84ae-97b46b0e2adc",
  "28c976d4-e8ae-4db3-b9b6-0030e9b7824e",
  "b6626375-92f6-41b4-ae14-17339f654a72",
  "287ebb1a-59a3-49fd-a627-94a04d06ff94",
  "973a9b4f-b9fa-4ee2-84bb-263ccbb169d7",
  "69103cd3-b0d1-4c45-be77-94a13e9d735b",
]

// All artifact IDs from the maxed save file
export const ALL_ARTIFACT_IDS = [
  "38baad2d-36af-4771-bed9-72049715f568",
  "2be1a59e-8036-4558-83de-9f98e9091425",
  "598ad538-5d1e-4c5e-8e54-8ab2f679d7d1",
  "bbf6f015-764f-4dc5-a34e-17e9bac1e6a1",
  "85b03605-4755-4530-be1f-8cb0a5fb7a01",
  "447a211b-c786-4cf8-a26c-3a575fa9f96c",
  "7b371c9c-b193-4192-b02a-3799c6118f09",
  "8b35da7a-9b9c-44ba-93c0-18e7ef2a6e8b",
  "efe4dbfe-a879-4ca9-a1db-46aa2b44f8e1",
  "c3d63827-27bb-4bbf-abff-373d31d4dfe2",
  "a6480108-960c-4eb0-87c7-59c0ebef3511",
  "fac78e31-783e-4b95-ae90-a55b4e0ae514",
  "6270fd4a-009f-4992-aef7-4796eefbc1da",
  "439f6505-b68e-41c8-90bb-039a010e6a8c",
  "00c9c09f-37d0-4af2-8853-fc754710ec79",
  "bfbf2169-fc75-415d-86d7-f6a2e7a4d0c8",
  "4ba1e17b-af0b-4517-8fb9-f1acfcba2bf6",
  "30036879-1775-4099-bc01-924f6612bd0d",
]

// All class artifact IDs from the maxed save file
export const ALL_CLASS_ARTIFACT_IDS = [
  "fdf79de1-a00e-41b1-a752-5717a8c2fb60",
  "9e515194-6325-4d2c-8053-ca61415ea0fe",
  "43ac1262-94bf-43a9-956c-2c42b67034fd",
  "9b09b0c0-2618-4840-b961-42a416f3940a",
  "ce29ce82-bda9-4307-b877-d3f430ed5ec3",
  "7d383065-ca05-4de8-a7e5-8281e1bcb32f",
  "93c2b272-16fd-495d-918b-e18ede618edb",
  "fc6bcbc9-af3f-484c-a387-e10da805e70c",
  "f8d79e8f-b005-44dc-801b-3240c8192c1f",
  "56685d71-e01c-4fe1-bf91-ac757a94b425",
  "0326121b-2305-470d-b6ff-10b077201633",
  "c6eba1a7-250f-4142-8212-606d403dfac2",
]

// All overclock weapon IDs from the maxed save file
export const ALL_OVERCLOCK_WEAPON_IDS = [
  "2d35d22b-50f2-42e4-bd0d-b246a8fc1c1a",
  "e4b6139b-2abc-4cfa-a1a5-24b79f484511",
  "724bf734-38cf-4fb3-a369-e050dbeb835a",
  "ecec62d9-9fe6-4852-aefa-e821acc7eecf",
  "666aa743-63b3-4dc8-8385-566efcfdca1b",
  "8a868db0-7f1c-474b-a7b7-3dc2463c0362",
  "3f3f1232-4b77-481d-b6cc-4c2f52442cfa",
  "7cd587dc-81a2-4cb2-aac8-3c958338ef8a",
  "948cc5f6-fbb4-40a3-bfed-f97162721040",
  "7dfc9e7d-5e63-4aa5-b57b-84dc6199206b",
  "2d22070b-0ebc-43ff-a4ec-db864f30f899",
  "5a91ac2c-9751-4917-99cd-207351fabd4c",
  "ea134bab-6bc7-430e-87e0-8372a109802b",
  "29d64624-86a7-4c99-a10f-d95d40206db5",
  "0a23e96c-3230-4bfe-9d3b-a18a74ffb5e4",
  "60007f2b-64e3-4025-b281-eac6bc2b8526",
  "67e123ca-612d-48ef-8ee6-b7456d489b01",
  "28c976d4-e8ae-4db3-b9b6-0030e9b7824e",
  "b6626375-92f6-41b4-ae14-17339f654a72",
  "287ebb1a-59a3-49fd-a627-94a04d06ff94",
  "973a9b4f-b9fa-4ee2-84bb-263ccbb169d7",
  "69103cd3-b0d1-4c45-be77-94a13e9d735b",
]

export const WEAPON_NAMES: Record<string, string> = {
  "2d35d22b-50f2-42e4-bd0d-b246a8fc1c1a": "Weapon 1",
  "6ad964a2-f17a-4ed2-943b-f184da3d1c7a": "Weapon 2",
  "948cc5f6-fbb4-40a3-bfed-f97162721040": "Weapon 3",
  "67e123ca-612d-48ef-8ee6-b7456d489b01": "Weapon 4",
  "e4b6139b-2abc-4cfa-a1a5-24b79f484511": "Weapon 5",
  "3f2291e8-3d1a-4a6c-ae16-23b4a022a972": "Weapon 6",
  "724bf734-38cf-4fb3-a369-e050dbeb835a": "Weapon 7",
  "58893b54-dda5-42a1-9f5d-faa197970981": "Weapon 8",
  "2d22070b-0ebc-43ff-a4ec-db864f30f899": "Weapon 9",
  "5a91ac2c-9751-4917-99cd-207351fabd4c": "Weapon 10",
  "7bdddaa8-2eb8-4270-9304-8f8cf43157a8": "Weapon 11",
  "60007f2b-64e3-4025-b281-eac6bc2b8526": "Weapon 12",
  "ea134bab-6bc7-430e-87e0-8372a109802b": "Weapon 13",
  "29d64624-86a7-4c99-a10f-d95d40206db5": "Weapon 14",
  "0a23e96c-3230-4bfe-9d3b-a18a74ffb5e4": "Weapon 15",
  "666aa743-63b3-4dc8-8385-566efcfdca1b": "Weapon 16",
  "8a868db0-7f1c-474b-a7b7-3dc2463c0362": "Weapon 17",
  "ecec62d9-9fe6-4852-aefa-e821acc7eecf": "Weapon 18",
  "3f3f1232-4b77-481d-b6cc-4c2f52442cfa": "Weapon 19",
  "7cd587dc-81a2-4cb2-aac8-3c958338ef8a": "Weapon 20",
  "c9a72abb-b0d8-490c-abf7-7180bc0a9979": "Weapon 21",
  "a8f5c205-ff59-42e8-85a7-ae6fd712b967": "Weapon 22",
  "cd3aa60a-e994-40f0-a213-179c1fedf15c": "Weapon 23",
  "8ed23a22-534e-4cc4-8786-bdd28f220b1c": "Weapon 24",
  "7dfc9e7d-5e63-4aa5-b57b-84dc6199206b": "Weapon 25",
  "9cd8f5e4-49a2-4dd2-88a2-84fbd589ffe2": "Weapon 26",
  "ae32c0e1-467e-4ea2-ae9d-f7f20a2e7b07": "Weapon 27",
  "e2cb84d9-abcf-461d-8cc4-296b633a9acb": "Weapon 28",
  "8e4fd562-9ad6-418d-9863-b11f100884fd": "Weapon 29",
  "b4fbef58-09ad-443d-bc78-1b540e1f1ea1": "Weapon 30",
  "539a0e86-fe2e-457b-8860-c07a1c79975f": "Weapon 31",
  "3a48e3b8-3520-4ff6-9b5b-bbb96314a445": "Weapon 32",
  "b6980e26-e39e-41d8-a887-9537f3315d25": "Weapon 33",
  "c3b7809a-9e67-45db-b028-ff4fc1a67c08": "Weapon 34",
  "126de2c9-a957-4cd3-a146-19eed78565c6": "Weapon 35",
  "6c633217-8ac1-4d89-8cff-a073c05fcf03": "Weapon 36",
  "450cad09-bacb-4b84-84ae-97b46b0e2adc": "Weapon 37",
  "28c976d4-e8ae-4db3-b9b6-0030e9b7824e": "Weapon 38",
  "b6626375-92f6-41b4-ae14-17339f654a72": "Weapon 39",
  "287ebb1a-59a3-49fd-a627-94a04d06ff94": "Weapon 40",
  "973a9b4f-b9fa-4ee2-84bb-263ccbb169d7": "Weapon 41",
  "69103cd3-b0d1-4c45-be77-94a13e9d735b": "Weapon 42",
}

export const ARTIFACT_NAMES: Record<string, string> = {
  "38baad2d-36af-4771-bed9-72049715f568": "Artifact 1",
  "2be1a59e-8036-4558-83de-9f98e9091425": "Artifact 2",
  "598ad538-5d1e-4c5e-8e54-8ab2f679d7d1": "Artifact 3",
  "bbf6f015-764f-4dc5-a34e-17e9bac1e6a1": "Artifact 4",
  "85b03605-4755-4530-be1f-8cb0a5fb7a01": "Artifact 5",
  "447a211b-c786-4cf8-a26c-3a575fa9f96c": "Artifact 6",
  "7b371c9c-b193-4192-b02a-3799c6118f09": "Artifact 7",
  "8b35da7a-9b9c-44ba-93c0-18e7ef2a6e8b": "Artifact 8",
  "efe4dbfe-a879-4ca9-a1db-46aa2b44f8e1": "Artifact 9",
  "c3d63827-27bb-4bbf-abff-373d31d4dfe2": "Artifact 10",
  "a6480108-960c-4eb0-87c7-59c0ebef3511": "Artifact 11",
  "fac78e31-783e-4b95-ae90-a55b4e0ae514": "Artifact 12",
  "6270fd4a-009f-4992-aef7-4796eefbc1da": "Artifact 13",
  "439f6505-b68e-41c8-90bb-039a010e6a8c": "Artifact 14",
  "00c9c09f-37d0-4af2-8853-fc754710ec79": "Artifact 15",
  "bfbf2169-fc75-415d-86d7-f6a2e7a4d0c8": "Artifact 16",
  "4ba1e17b-af0b-4517-8fb9-f1acfcba2bf6": "Artifact 17",
  "30036879-1775-4099-bc01-924f6612bd0d": "Artifact 18",
}

export const CLASS_ARTIFACT_NAMES: Record<string, string> = {
  "fdf79de1-a00e-41b1-a752-5717a8c2fb60": "Class Artifact 1",
  "9e515194-6325-4d2c-8053-ca61415ea0fe": "Class Artifact 2",
  "43ac1262-94bf-43a9-956c-2c42b67034fd": "Class Artifact 3",
  "9b09b0c0-2618-4840-b961-42a416f3940a": "Class Artifact 4",
  "ce29ce82-bda9-4307-b877-d3f430ed5ec3": "Class Artifact 5",
  "7d383065-ca05-4de8-a7e5-8281e1bcb32f": "Class Artifact 6",
  "93c2b272-16fd-495d-918b-e18ede618edb": "Class Artifact 7",
  "fc6bcbc9-af3f-484c-a387-e10da805e70c": "Class Artifact 8",
  "f8d79e8f-b005-44dc-801b-3240c8192c1f": "Class Artifact 9",
  "56685d71-e01c-4fe1-bf91-ac757a94b425": "Class Artifact 10",
  "0326121b-2305-470d-b6ff-10b077201633": "Class Artifact 11",
  "c6eba1a7-250f-4142-8212-606d403dfac2": "Class Artifact 12",
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

/**
 * Toggle weapon unlock status
 */
export function toggleWeaponUnlock(saveData: DRGSurvivorSave, weaponId: string): DRGSurvivorSave {
  const isUnlocked = saveData.UnlockedWeaponIds.includes(weaponId)
  if (isUnlocked) {
    return {
      ...saveData,
      UnlockedWeaponIds: saveData.UnlockedWeaponIds.filter((id) => id !== weaponId),
    }
  } else {
    return {
      ...saveData,
      UnlockedWeaponIds: [...saveData.UnlockedWeaponIds, weaponId],
    }
  }
}

/**
 * Unlock all weapons
 */
export function unlockAllWeapons(saveData: DRGSurvivorSave): DRGSurvivorSave {
  return {
    ...saveData,
    UnlockedWeaponIds: [...ALL_WEAPON_IDS],
  }
}

/**
 * Toggle overclock unlock status
 */
export function toggleOverclockUnlock(saveData: DRGSurvivorSave, weaponId: string): DRGSurvivorSave {
  const isUnlocked = saveData.OverclockUnlockedWeaponIds.includes(weaponId)
  if (isUnlocked) {
    return {
      ...saveData,
      OverclockUnlockedWeaponIds: saveData.OverclockUnlockedWeaponIds.filter((id) => id !== weaponId),
    }
  } else {
    return {
      ...saveData,
      OverclockUnlockedWeaponIds: [...saveData.OverclockUnlockedWeaponIds, weaponId],
    }
  }
}

/**
 * Unlock all overclocks
 */
export function unlockAllOverclocks(saveData: DRGSurvivorSave): DRGSurvivorSave {
  return {
    ...saveData,
    OverclockUnlockedWeaponIds: [...ALL_OVERCLOCK_WEAPON_IDS],
  }
}

/**
 * Toggle artifact unlock status
 */
export function toggleArtifactUnlock(saveData: DRGSurvivorSave, artifactId: string): DRGSurvivorSave {
  const isUnlocked = saveData.UnlockedArtifactIds.includes(artifactId)
  if (isUnlocked) {
    return {
      ...saveData,
      UnlockedArtifactIds: saveData.UnlockedArtifactIds.filter((id) => id !== artifactId),
    }
  } else {
    return {
      ...saveData,
      UnlockedArtifactIds: [...saveData.UnlockedArtifactIds, artifactId],
    }
  }
}

/**
 * Unlock all artifacts
 */
export function unlockAllArtifacts(saveData: DRGSurvivorSave): DRGSurvivorSave {
  return {
    ...saveData,
    UnlockedArtifactIds: [...ALL_ARTIFACT_IDS],
  }
}

/**
 * Toggle class artifact unlock status
 */
export function toggleClassArtifactUnlock(saveData: DRGSurvivorSave, artifactId: string): DRGSurvivorSave {
  const isUnlocked = saveData.UnlockedClassArtifactIds.includes(artifactId)
  if (isUnlocked) {
    return {
      ...saveData,
      UnlockedClassArtifactIds: saveData.UnlockedClassArtifactIds.filter((id) => id !== artifactId),
    }
  } else {
    return {
      ...saveData,
      UnlockedClassArtifactIds: [...saveData.UnlockedClassArtifactIds, artifactId],
    }
  }
}

/**
 * Unlock all class artifacts
 */
export function unlockAllClassArtifacts(saveData: DRGSurvivorSave): DRGSurvivorSave {
  return {
    ...saveData,
    UnlockedClassArtifactIds: [...ALL_CLASS_ARTIFACT_IDS],
  }
}

/**
 * Unlock everything in the game
 */
export function unlockEverything(saveData: DRGSurvivorSave): DRGSurvivorSave {
  return {
    ...saveData,
    UnlockedClassIds: Object.keys(CLASS_IDS),
    UnlockedWeaponIds: [...ALL_WEAPON_IDS],
    UnlockedArtifactIds: [...ALL_ARTIFACT_IDS],
    UnlockedClassArtifactIds: [...ALL_CLASS_ARTIFACT_IDS],
    OverclockUnlockedWeaponIds: [...ALL_OVERCLOCK_WEAPON_IDS],
  }
}
