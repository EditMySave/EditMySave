/**
 * BALL x PIT Save File Decoder
 *
 * Format: Custom .NET serialization (Unity BinaryFormatter variant)
 * Browser-compatible version
 */

export interface BuildingInstance {
  id: number
  type?: number
  rotation?: number
  upgradeLvl?: number
  curTaskSecs?: number
}

export interface DecodedSave {
  CurDay: number
  VersionNum: number
  LastChar: number
  LastLevel: number
  LastLevelNGPlus: number
  ElevatorLvl: number
  IsGameTutSeen: boolean[]
  IsBaseTutSeen: boolean[]
  Coins: number
  Wheat: number
  Wood: number
  Stone: number
  TotalCoins: number
  TotalWheat: number
  TotalWood: number
  TotalStone: number
  Meta: Record<string, number>
  Buildings: BuildingInstance[]
  _raw: Uint8Array
  _offsets: Map<string, { offset: number; length: number }>
}

class BinaryReader {
  public data: Uint8Array
  public view: DataView
  public pos = 0

  constructor(data: Uint8Array) {
    this.data = data
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  }

  readInt32(offset?: number): number {
    const pos = offset ?? this.pos
    if (offset === undefined) this.pos += 4
    return this.view.getInt32(pos, true)
  }

  readInt64(offset?: number): bigint {
    const pos = offset ?? this.pos
    if (offset === undefined) this.pos += 8
    return this.view.getBigInt64(pos, true)
  }
}

const RESOURCE_ORDER = ["Coins", "Wheat", "Wood", "Stone"] as const

function findStringUTF16(data: Uint8Array, searchStr: string): number {
  const searchBytes = new Uint8Array(searchStr.length * 2)
  for (let i = 0; i < searchStr.length; i++) {
    const code = searchStr.charCodeAt(i)
    searchBytes[i * 2] = code & 0xff
    searchBytes[i * 2 + 1] = (code >> 8) & 0xff
  }

  outer: for (let i = 0; i < data.length - searchBytes.length; i++) {
    for (let j = 0; j < searchBytes.length; j++) {
      if (data[i + j] !== searchBytes[j]) continue outer
    }
    return i
  }
  return -1
}

export async function decodeSave(file: File): Promise<DecodedSave> {
  const arrayBuffer = await file.arrayBuffer()
  const data = new Uint8Array(arrayBuffer)
  const reader = new BinaryReader(data)
  const offsets = new Map<string, { offset: number; length: number }>()

  // Find resource arrays
  const findResourceArray = (name: string, isTotal: boolean): number[] => {
    const nameOffset = findStringUTF16(data, name)
    if (nameOffset === -1) return [0, 0, 0, 0]

    const afterName = nameOffset + name.length * 2
    for (let offset = 0; offset < 300 && afterName + offset + 20 < data.length; offset++) {
      const pos = afterName + offset
      if (data[pos] === 0x08 && reader.readInt32(pos + 1) === 0x04) {
        const arrayLength = reader.readInt32(pos + 5)
        if (arrayLength === 4) {
          const valueStart = pos + 9
          const values: number[] = []
          for (let i = 0; i < 4; i++) {
            values.push(reader.readInt32(valueStart + i * 4))
          }
          offsets.set(name, { offset: valueStart, length: 16 })
          return values
        }
      }
    }
    return [0, 0, 0, 0]
  }

  const findInt32 = (name: string, min: number, max: number): number => {
    const nameOffset = findStringUTF16(data, name)
    if (nameOffset === -1) return 0

    const afterName = nameOffset + name.length * 2
    for (let offset = 0; offset < 120 && afterName + offset + 4 < data.length; offset++) {
      const val = reader.readInt32(afterName + offset)
      if (val >= min && val <= max) {
        offsets.set(name, { offset: afterName + offset, length: 4 })
        return val
      }
    }
    return 0
  }

  const findInt64 = (name: string, min: number, max: number): number => {
    const nameOffset = findStringUTF16(data, name)
    if (nameOffset === -1) return 0

    const afterName = nameOffset + name.length * 2
    for (let offset = 0; offset < 120 && afterName + offset + 8 < data.length; offset++) {
      const val = Number(reader.readInt64(afterName + offset))
      if (val >= min && val <= max) {
        offsets.set(name, { offset: afterName + offset, length: 8 })
        return val
      }
    }
    return 0
  }

  const findBoolArray = (name: string): boolean[] => {
    const nameOffset = findStringUTF16(data, name)
    if (nameOffset === -1) return [false]

    const afterName = nameOffset + name.length * 2
    for (let offset = 0; offset < 200 && afterName + offset + 10 < data.length; offset++) {
      const pos = afterName + offset
      if (data[pos] === 0x08 && reader.readInt32(pos + 1) === 0x01) {
        const arrayLength = reader.readInt32(pos + 5)
        if (arrayLength >= 1 && arrayLength <= 10) {
          const valueStart = pos + 9
          const values: boolean[] = []
          for (let i = 0; i < arrayLength; i++) {
            values.push(data[valueStart + i] === 1)
          }
          offsets.set(name, { offset: valueStart, length: arrayLength })
          return values
        }
      }
    }
    return [false]
  }

  const numResources = findResourceArray("NumResources", false)
  const totalResources = findResourceArray("TotalResources", true)

  // Parse buildings
  const buildings: BuildingInstance[] = []
  const buildingsOffset = findStringUTF16(data, "Buildings")
  if (buildingsOffset !== -1) {
    // Parse building instances (simplified - just look for id/type/rotation/upgradeLvl patterns)
    let pos = buildingsOffset + 100
    while (pos < data.length - 32 && buildings.length < 50) {
      // Look for building id pattern
      const id = reader.readInt32(pos)
      if (id >= 0 && id < 100) {
        const building: BuildingInstance = { id }

        // Try to find type (int64), rotation, upgradeLvl, curTaskSecs nearby
        if (pos + 8 < data.length) {
          const type = Number(reader.readInt64(pos + 4))
          if (type >= 0 && type < 200) building.type = type
        }
        if (pos + 16 < data.length) {
          const rotation = reader.readInt32(pos + 12)
          if (rotation >= 0 && rotation < 4) building.rotation = rotation
        }
        if (pos + 20 < data.length) {
          const upgradeLvl = reader.readInt32(pos + 16)
          if (upgradeLvl >= 0 && upgradeLvl < 10) building.upgradeLvl = upgradeLvl
        }
        if (pos + 24 < data.length) {
          const curTaskSecs = reader.readInt32(pos + 20)
          if (curTaskSecs >= 0 && curTaskSecs < 100) building.curTaskSecs = curTaskSecs
        }

        buildings.push(building)
        pos += 24
      } else {
        pos += 4
      }
    }
  }

  return {
    CurDay: findInt32("CurDay", 1, 1000000),
    VersionNum: findInt32("VersionNum", 1, 10000),
    LastChar: findInt64("LastChar", 0, 10000),
    LastLevel: findInt64("LastLevel", 0, 10000),
    LastLevelNGPlus: findInt32("LastLevelNGPlus", 0, 10000),
    ElevatorLvl: findInt32("ElevatorLvl", 0, 10000),
    IsGameTutSeen: findBoolArray("IsGameTutSeen"),
    IsBaseTutSeen: findBoolArray("IsBaseTutSeen"),
    Coins: numResources[0],
    Wheat: numResources[1],
    Wood: numResources[2],
    Stone: numResources[3],
    TotalCoins: totalResources[0],
    TotalWheat: totalResources[1],
    TotalWood: totalResources[2],
    TotalStone: totalResources[3],
    Meta: {
      NumBuildingsBuilt: findInt32("NumBuildingsBuilt", 0, 1000),
      LastHarvestWorldTime: findInt32("LastHarvestWorldTime", 0, 10000000),
      WarRoomLevel: findInt32("WarRoomLevel", 0, 100),
      NumMasseuseToday: findInt32("NumMasseuseToday", 0, 100),
      Seed: findInt32("Seed", 0, 2147483647),
      NumBattlesPlayed: findInt32("NumBattlesPlayed", 0, 100000),
      NumHarvests: findInt32("NumHarvests", 0, 100000),
      NumBuildingsConstructed: findInt32("NumBuildingsConstructed", 0, 1000),
      NumResourcesConstructed: findInt32("NumResourcesConstructed", 0, 1000),
      NumBuildingsUpgraded: findInt32("NumBuildingsUpgraded", 0, 1000),
      NumResourcesUpgraded: findInt32("NumResourcesUpgraded", 0, 1000),
      WorldTime: findInt32("WorldTime", 0, 10000000),
      NumBossWavesCompleted: findInt32("NumBossWavesCompleted", 0, 100000),
      NumKills: findInt32("NumKills", 0, 10000000),
      SecondsSince2040: findInt32("SecondsSince2040", 0, 2147483647),
    },
    Buildings: buildings,
    _raw: data,
    _offsets: offsets,
  }
}

export function encodeSave(decoded: DecodedSave): Uint8Array {
  const output = new Uint8Array(decoded._raw)
  const view = new DataView(output.buffer)

  // Write resources
  const writeResourceArray = (name: string, values: number[]) => {
    const info = decoded._offsets.get(name)
    if (info) {
      for (let i = 0; i < values.length; i++) {
        view.setInt32(info.offset + i * 4, values[i], true)
      }
    }
  }

  const writeInt32 = (name: string, value: number) => {
    const info = decoded._offsets.get(name)
    if (info) view.setInt32(info.offset, value, true)
  }

  const writeInt64 = (name: string, value: number) => {
    const info = decoded._offsets.get(name)
    if (info) view.setBigInt64(info.offset, BigInt(value), true)
  }

  writeResourceArray("NumResources", [decoded.Coins, decoded.Wheat, decoded.Wood, decoded.Stone])
  writeResourceArray("TotalResources", [decoded.TotalCoins, decoded.TotalWheat, decoded.TotalWood, decoded.TotalStone])

  writeInt32("CurDay", decoded.CurDay)
  writeInt32("VersionNum", decoded.VersionNum)
  writeInt64("LastChar", decoded.LastChar)
  writeInt64("LastLevel", decoded.LastLevel)
  writeInt32("LastLevelNGPlus", decoded.LastLevelNGPlus)
  writeInt32("ElevatorLvl", decoded.ElevatorLvl)

  // Write meta stats
  for (const [key, value] of Object.entries(decoded.Meta)) {
    writeInt32(key, value)
  }

  return output
}
