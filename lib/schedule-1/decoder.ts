/**
 * Schedule 1 Save File Codec (Browser-compatible)
 *
 * Format: Plain JSON files in a directory tree (no encryption).
 * Uses webkitdirectory FileList for input and JSZip for output.
 *
 * Save structure (v0.4.5+):
 *   - 19 top-level JSON files
 *   - Properties/ — one JSON per property
 *   - Businesses/ — one JSON per business
 *   - Players/ — subdirectory per player with up to 5 JSON files
 */

import JSZip from "jszip"

// ── Types ───────────────────────────────────────────────────────────────

export interface Schedule1Save {
  game: Record<string, unknown>
  metadata: Record<string, unknown>
  money: MoneyData
  rank: RankData
  time: Record<string, unknown>
  law: Record<string, unknown>
  products: Record<string, unknown>
  cartel: Record<string, unknown>
  sewer: Record<string, unknown>
  graffiti: Record<string, unknown>
  npcs: Record<string, unknown>
  quests: Record<string, unknown>
  variables: Record<string, unknown>
  deliveries: Record<string, unknown>
  ownedVehicles: Record<string, unknown>
  shops: Record<string, unknown>
  trash: Record<string, unknown>
  genericSaveables: Record<string, unknown>
  worldStorageEntities: Record<string, unknown>
  properties: Record<string, Record<string, unknown>>
  businesses: Record<string, Record<string, unknown>>
  players: Record<string, PlayerEntry>
  /** Original folder name for ZIP output */
  _folderName: string
}

export interface MoneyData {
  DataType: string
  DataVersion: number
  GameVersion: string
  OnlineBalance: number
  Networth: number
  LifetimeEarnings: number
  WeeklyDepositSum: number
  [key: string]: unknown
}

export interface RankData {
  DataType: string
  DataVersion: number
  GameVersion: string
  Rank: number
  Tier: number
  XP: number
  TotalXP: number
  UnlockedRegions: number[]
  [key: string]: unknown
}

export interface PlayerEntry {
  player: Record<string, unknown>
  appearance?: Record<string, unknown>
  inventory?: Record<string, unknown>
  clothing?: Record<string, unknown>
  variables?: Record<string, unknown>
}

// ── File mapping ────────────────────────────────────────────────────────

const TOP_LEVEL_FILES: Record<string, keyof Schedule1Save> = {
  "Game.json": "game",
  "Metadata.json": "metadata",
  "Money.json": "money",
  "Rank.json": "rank",
  "Time.json": "time",
  "Law.json": "law",
  "Products.json": "products",
  "Cartel.json": "cartel",
  "Sewer.json": "sewer",
  "Graffiti.json": "graffiti",
  "NPCs.json": "npcs",
  "Quests.json": "quests",
  "Variables.json": "variables",
  "Deliveries.json": "deliveries",
  "OwnedVehicles.json": "ownedVehicles",
  "Shops.json": "shops",
  "Trash.json": "trash",
  "GenericSaveables.json": "genericSaveables",
  "WorldStorageEntities.json": "worldStorageEntities",
}

const PLAYER_FILES = ["Player.json", "Appearance.json", "Inventory.json", "Clothing.json", "Variables.json"]
const PLAYER_KEYS: (keyof PlayerEntry)[] = ["player", "appearance", "inventory", "clothing", "variables"]

// Files stored single-line (no indent) in the original save
const SINGLE_LINE_FILES = new Set(["Trash.json", "Graffiti.json", "OwnedVehicles.json"])

// ── Decode ──────────────────────────────────────────────────────────────

export async function decodeSaveFromFiles(files: FileList): Promise<Schedule1Save> {
  // Build a map of relative paths to File objects
  const fileMap = new Map<string, File>()
  let rootPrefix = ""

  for (const file of Array.from(files)) {
    const relPath = file.webkitRelativePath || file.name
    if (!rootPrefix && relPath.includes("/")) {
      rootPrefix = relPath.split("/")[0] + "/"
    }
    // Strip root folder prefix to get the save-relative path
    const savePath = relPath.startsWith(rootPrefix) ? relPath.slice(rootPrefix.length) : relPath
    fileMap.set(savePath, file)
  }

  const folderName = rootPrefix.replace(/\/$/, "") || "SaveGame"

  async function readJson(path: string): Promise<Record<string, unknown>> {
    const file = fileMap.get(path)
    if (!file) return {}
    const text = await file.text()
    return JSON.parse(text)
  }

  // Read all 19 top-level files
  const topLevel: Partial<Schedule1Save> = {}
  await Promise.all(
    Object.entries(TOP_LEVEL_FILES).map(async ([filename, key]) => {
      const data = await readJson(filename)
      ;(topLevel as Record<string, unknown>)[key] = data
    }),
  )

  // Read Properties/ and Businesses/ directories
  const properties: Record<string, Record<string, unknown>> = {}
  const businesses: Record<string, Record<string, unknown>> = {}

  const readPromises: Promise<void>[] = []

  for (const [path, file] of fileMap) {
    if (path.startsWith("Properties/") && path.endsWith(".json")) {
      const name = path.slice("Properties/".length).replace(/\.json$/, "")
      readPromises.push(
        file.text().then((text) => {
          properties[name] = JSON.parse(text)
        }),
      )
    } else if (path.startsWith("Businesses/") && path.endsWith(".json")) {
      const name = path.slice("Businesses/".length).replace(/\.json$/, "")
      readPromises.push(
        file.text().then((text) => {
          businesses[name] = JSON.parse(text)
        }),
      )
    }
  }

  await Promise.all(readPromises)

  // Read Players/ subdirectories
  const players: Record<string, PlayerEntry> = {}
  const playerDirs = new Set<string>()

  for (const path of fileMap.keys()) {
    if (path.startsWith("Players/")) {
      const parts = path.split("/")
      if (parts.length >= 3) {
        playerDirs.add(parts[1])
      }
    }
  }

  await Promise.all(
    Array.from(playerDirs).map(async (playerName) => {
      const playerData = await readJson(`Players/${playerName}/Player.json`)
      if (!playerData || Object.keys(playerData).length === 0) return

      const entry: PlayerEntry = { player: playerData }
      await Promise.all(
        PLAYER_FILES.slice(1).map(async (filename, idx) => {
          const data = await readJson(`Players/${playerName}/${filename}`)
          if (Object.keys(data).length > 0) {
            ;(entry as Record<string, unknown>)[PLAYER_KEYS[idx + 1]] = data
          }
        }),
      )
      players[playerName] = entry
    }),
  )

  return {
    ...(topLevel as Omit<Schedule1Save, "properties" | "businesses" | "players" | "_folderName">),
    properties,
    businesses,
    players,
    _folderName: folderName,
  } as Schedule1Save
}

// ── Encode ──────────────────────────────────────────────────────────────

export async function encodeSaveToBlob(save: Schedule1Save): Promise<Blob> {
  const zip = new JSZip()
  const root = zip.folder(save._folderName)!

  function addJson(folder: JSZip, filename: string, data: unknown) {
    const indent = SINGLE_LINE_FILES.has(filename) ? undefined : 4
    folder.file(filename, JSON.stringify(data, null, indent))
  }

  // Top-level files
  for (const [filename, key] of Object.entries(TOP_LEVEL_FILES)) {
    addJson(root, filename, save[key])
  }

  // Properties/
  const propsFolder = root.folder("Properties")!
  for (const [name, data] of Object.entries(save.properties)) {
    addJson(propsFolder, `${name}.json`, data)
  }

  // Businesses/
  const bizFolder = root.folder("Businesses")!
  for (const [name, data] of Object.entries(save.businesses)) {
    addJson(bizFolder, `${name}.json`, data)
  }

  // Players/
  const playersFolder = root.folder("Players")!
  for (const [name, entry] of Object.entries(save.players)) {
    const playerDir = playersFolder.folder(name)!
    addJson(playerDir, "Player.json", entry.player)
    if (entry.appearance) addJson(playerDir, "Appearance.json", entry.appearance)
    if (entry.inventory) addJson(playerDir, "Inventory.json", entry.inventory)
    if (entry.clothing) addJson(playerDir, "Clothing.json", entry.clothing)
    if (entry.variables) addJson(playerDir, "Variables.json", entry.variables)
  }

  return await zip.generateAsync({ type: "blob" })
}
