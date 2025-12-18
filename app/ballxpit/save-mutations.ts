import type { DecodedSave } from "@/lib/ballxpit/decoder"

export function maxResources(saveData: DecodedSave): DecodedSave {
  return {
    ...saveData,
    Coins: 999999,
    Wheat: 999999,
    Wood: 999999,
    Stone: 999999,
  }
}

export function maxTotalResources(saveData: DecodedSave): DecodedSave {
  return {
    ...saveData,
    TotalCoins: 999999,
    TotalWheat: 999999,
    TotalWood: 999999,
    TotalStone: 999999,
  }
}

export function maxElevator(saveData: DecodedSave): DecodedSave {
  return {
    ...saveData,
    ElevatorLvl: 999,
  }
}

export function resetTutorials(saveData: DecodedSave): DecodedSave {
  return {
    ...saveData,
    IsGameTutSeen: [false],
    IsBaseTutSeen: [false],
  }
}
