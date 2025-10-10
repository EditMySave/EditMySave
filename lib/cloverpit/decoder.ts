// Cloverpit GameDataFull.json decoder/encoder
// This handles the encrypted JSON save format (different from the binary .dat format)

const DEFAULT_PASSWORD = "uoiyiuh_+=-5216gh;lj??!/345"

export interface GameplayData {
  // Economy
  coins_ByteArray: number[]
  depositedCoins_ByteArray: number[]
  interestRate: number
  cloverTickets: number
  cloverTickets_BonusFor_LittleBet: number
  cloverTickets_BonusFor_BigBet: number
  cloverTickets_BonusFor_RoundsLeft: number
  interestEarned_ByteArray: number[]

  // Deadlines
  roundOfDeadline: number
  debtIndex_ByteArray: number[]
  debtOutOfRangeMult_ByteArray: number[]
  roundsReallyPlayed: number
  roundDeadlineTrail: number
  roundDeadlineTrail_AtDeadlineBegin: number
  atmDeadline_RewardPickupMemo_MessageShown: boolean
  victoryDeathConditionMet: boolean

  // Spins
  spinsLeft: number
  maxSpins: number
  extraSpins: number
  spinsDoneInARun: number
  powerupLuck: number
  activationLuck: number
  storeLuck: number
  extraLuckEntries: Array<{ tag: string; luck: number; luckMax: number; spinsLeft: number; spinsLeftMax: number }>

  // Bet counters
  _smallBetsPickedCounter: number
  _bigBetsPickedCounter: number
  spinsWithoutReward: number
  spinsWithout5PlusPatterns: number
  _jackpotsScoredCounter: number
  _spinsWithAtleast1Jackpot: number
  lastBetIsSmall: boolean

  // RNG engines
  rngRunMod: RNGState
  rngSymbolsMod: RNGState
  rngPowerupsMod: RNGState
  rngSymbolsChance: RNGState
  rngCards: RNGState
  rngPowerupsAll: RNGState
  rngAbilities: RNGState
  rngDrawers: RNGState
  rngStore: RNGState
  rngStoreChains: RNGState
  rngPhone: RNGState
  rngSlotMachineLuck: RNGState
  rng666: RNGState
  rngGarbage: RNGState

  // Phone
  _phoneAbilitiesNumber: number
  _phoneRerollCost: number
  _phoneRerollCostIncrease: number
  _phonePickMultiplier: number
  _phone_abilityAlreadyPickedUp: boolean
  _phone_pickedUpOnceLastDeadline: boolean
  _phoneAlreadyTransformed: boolean
  _phone_lastAbilityCategory: number
  _phone_AbilitiesToPick_String: string
  _phone_PickupWithAbilities_OverallCounter: number
  _phone_bookSpecialCall: boolean
  _phoneRerollsPerformed: number
  phoneEasyCounter_SkippedCalls_Total: number
  phoneEasyCounter_SkippedCalls_Normal: number
  phoneEasyCounter_SkippedCalls_Evil: number
  phoneEasyCounter_SkippedCalls_Good: number

  // 666 and 999
  _666Chance: number
  _666ChanceMaxAbsolute: number
  _666BookedSpin: number
  _666SuppressedSpinsLeft: number
  _lastRoundHadA666: boolean
  nineNineNine_TotalRewardEarned_ByteArray: number[]
  sixSixSixSeen: number

  // Store
  temporaryDiscount: number
  _storeFreeRestocks: number
  storeLastRandomIndex: number
  storeChainIndex_Array: number
  storeChainIndex_PowerupIdentifier: number
  _storeRestockExtraCost_ByteArray: number[]
  temporaryDiscountPerSlot: number[]
  storePowerups: string[]

  // Symbols
  allSymbolsMultiplier_ByteArray: number[]
  allPatternsMultiplier_ByteArray: number[]
  symbolsData: SymbolData[]
  patternsData: PatternData[]
  patternsAvailable_AsString: string[]

  // Powerups
  equippedPowerups: string[]
  equippedPowerups_Skeleton: string[]
  drawerPowerups: string[]
  maxEquippablePowerups: number
  powerupsData: PowerupData[]

  // Stats
  stats_DeadlinesCompleted: number
  stats_PlayTime_Seconds: number
  stats_CoinsEarned_ByteArray: number[]
  stats_TicketsEarned: number

  [key: string]: any
}

export interface RNGState {
  seed: number
  stateIndex: number
  randomNumber: number
}

export interface SymbolData {
  symbolKindAsString: string
  extraValue_ByteArray: number[]
  spawnChance: number
  modifierChance01_InstantReward: number
  modifierChance01_CloverTicket: number
  modifierChance01_Golden: number
  modifierChance01_Repetition: number
  modifierChance01_Battery: number
  modifierChance01_Chain: number
}

export interface PatternData {
  patternKindAsString: string
  extraValue: number
}

export interface PowerupData {
  powerupIdentifierAsString: string
  boughtTimes: number
  modifier: number
  buttonChargesCounter: number
  buttonChargesMax: number
  buttonBurnOutCounter: number
  resellBonus: number
  charmSpecificRng: RNGState
}

export interface RunModifier {
  runModifierIdentifierAsString: string
  ownedCount: number
  unlockedTimes: number
  playedTimes: number
  wonTimes: number
  foilLevel: number
}

export interface CloverpitJsonSave {
  gameplayData: GameplayData
  runsDone: number
  deathsDone: number
  drawersUnlocked: boolean[]
  tutorialQuestionEnabled: boolean
  doorOpenedCounter: number
  badEndingCounter: number
  goodEndingCounter: number
  _unlockedPowerupsString: string
  hasEverUnlockedAPowerup: boolean
  _allCardsUnlocked: boolean
  _allCardsHolographic: boolean
  creditsSeenOnce: boolean
  modSymbolTriggersCounter_Sevens: number
  persistentStat_666SeenTimes: number
  _runModSavingList: RunModifier[]
  [key: string]: any
}

function cryptoShiftsNumber(password: string): number {
  let num = 8
  for (let i = 0; i < password.length; i++) {
    num += password.charCodeAt(i)
  }
  while (num > 16 || num < 8) {
    if (num > 16) num -= 16
    if (num < 8) num += 8
  }
  return num
}

function encryptCustom(data: string, password: string): string {
  if (!data || !password) return ""
  const length = data.length
  const numIterations = cryptoShiftsNumber(password)
  const passwordArray = password.split("")
  const array2 = new Array(passwordArray.length)

  for (let iteration = 0; iteration < numIterations; iteration++) {
    for (let j = 0; j < passwordArray.length; j++) {
      const num2 = Math.abs(passwordArray[j].charCodeAt(0) % passwordArray.length)
      const num3 = Math.floor((j + num2) % passwordArray.length)
      array2[j] = passwordArray[num3]
      array2[j] = String.fromCharCode(array2[j].charCodeAt(0) ^ passwordArray[j].charCodeAt(0))
    }
  }

  const result: string[] = []
  for (let k = 0; k < length; k++) {
    const charValue = data.charCodeAt(k)
    const keyChar = array2[k % array2.length].charCodeAt(0)
    result.push(String.fromCharCode(charValue ^ keyChar))
  }
  return result.join("")
}

function arrayBufferToLatin1(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let result = ""
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i])
  }
  return result
}

function latin1ToArrayBuffer(str: string): ArrayBuffer {
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff
  }
  return bytes.buffer
}

export async function decodeJsonSaveFromFile(file: File, password?: string): Promise<CloverpitJsonSave> {
  const arrayBuffer = await file.arrayBuffer()
  const encryptedStr = arrayBufferToLatin1(arrayBuffer)
  const decryptedStr = encryptCustom(encryptedStr, password || DEFAULT_PASSWORD)
  return JSON.parse(decryptedStr)
}

export async function encodeJsonSaveToBlob(save: CloverpitJsonSave, password?: string): Promise<Blob> {
  const jsonStr = JSON.stringify(save, null, 0)
  const encryptedStr = encryptCustom(jsonStr, password || DEFAULT_PASSWORD)
  const encryptedBuffer = latin1ToArrayBuffer(encryptedStr)
  return new Blob([encryptedBuffer], { type: "application/octet-stream" })
}

// Helper functions for ByteArray access
export function getByte(obj: any, key: string, defaultValue = 0): number {
  const arr = obj?.[key]
  if (Array.isArray(arr) && arr.length > 0 && Number.isFinite(arr[0])) {
    return arr[0]
  }
  return defaultValue
}

export function setByte(obj: any, key: string, value: number): void {
  const v = Number.isFinite(+value) ? +value : 0
  if (!Array.isArray(obj[key])) {
    obj[key] = [v]
  } else {
    obj[key][0] = v
  }
}

export function decryptSave(encryptedData: Uint8Array, password?: string): CloverpitJsonSave {
  const encryptedStr = arrayBufferToLatin1(encryptedData.buffer)
  const decryptedStr = encryptCustom(encryptedStr, password || DEFAULT_PASSWORD)
  return JSON.parse(decryptedStr)
}

export function encryptSave(save: CloverpitJsonSave, password?: string): Uint8Array {
  const jsonStr = JSON.stringify(save, null, 0)
  const encryptedStr = encryptCustom(jsonStr, password || DEFAULT_PASSWORD)
  const encryptedBuffer = latin1ToArrayBuffer(encryptedStr)
  return new Uint8Array(encryptedBuffer)
}
