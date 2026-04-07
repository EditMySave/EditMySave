/**
 * Schedule 1 Save File Codec (v0.4.5+)
 *
 * Format: Plain JSON files in a directory tree.
 * Save structure (v0.4.5f1):
 *   - 19 top-level JSON files (Game, Metadata, Money, Rank, Time, Law, Products,
 *     Cartel, Sewer, Graffiti, NPCs, Quests, Variables, Deliveries, OwnedVehicles,
 *     Shops, Trash, GenericSaveables, WorldStorageEntities)
 *   - Properties/ — one JSON per property (PropertyData or ManorData)
 *   - Businesses/ — one JSON per business (BusinessData)
 *   - Players/ — subdirectory per player with Player.json, Appearance.json,
 *     Inventory.json, Clothing.json, Variables.json
 *
 * Key quirk: Heavy use of nested JSON strings (JSON-within-JSON up to 3 levels deep).
 * NPC AdditionalDatas.Contents are JSON strings. Inventory Items are JSON strings.
 * The codec preserves these as-is for round-trip safety. Edit helpers parse/re-stringify
 * only the specific fields they modify.
 */

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

// ── Types ────────────────────────────────────────────────────────────

export interface DecodedSave {
  // 19 top-level JSON files
  game: Record<string, unknown>;
  metadata: Record<string, unknown>;
  money: MoneyData;
  rank: RankData;
  time: Record<string, unknown>;
  law: Record<string, unknown>;
  products: Record<string, unknown>;
  cartel: Record<string, unknown>;
  sewer: Record<string, unknown>;
  graffiti: Record<string, unknown>;
  npcs: Record<string, unknown>;
  quests: Record<string, unknown>;
  variables: Record<string, unknown>;
  deliveries: Record<string, unknown>;
  ownedVehicles: Record<string, unknown>;
  shops: Record<string, unknown>;
  trash: Record<string, unknown>;
  genericSaveables: Record<string, unknown>;
  worldStorageEntities: Record<string, unknown>;
  // Directory-based
  properties: Record<string, Record<string, unknown>>;
  businesses: Record<string, Record<string, unknown>>;
  players: Record<string, PlayerEntry>;
}

export interface MoneyData {
  DataType: string;
  DataVersion: number;
  GameVersion: string;
  OnlineBalance: number;
  Networth: number;
  LifetimeEarnings: number;
  WeeklyDepositSum: number;
  [key: string]: unknown;
}

export interface RankData {
  DataType: string;
  DataVersion: number;
  GameVersion: string;
  Rank: number;
  Tier: number;
  XP: number;
  TotalXP: number;
  UnlockedRegions: number[];
  [key: string]: unknown;
}

export interface PlayerEntry {
  player: Record<string, unknown>;
  appearance?: Record<string, unknown>;
  inventory?: Record<string, unknown>;
  clothing?: Record<string, unknown>;
  variables?: Record<string, unknown>;
}

// ── File I/O Helpers ─────────────────────────────────────────────────

async function readJsonFile(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const text = await Deno.readTextFile(path);
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function readJsonDir(dirPath: string): Promise<Record<string, Record<string, unknown>>> {
  const result: Record<string, Record<string, unknown>> = {};
  try {
    for await (const entry of Deno.readDir(dirPath)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        const data = await readJsonFile(join(dirPath, entry.name));
        if (data) {
          const stem = entry.name.replace(/\.json$/, "");
          result[stem] = data;
        }
      }
    }
  } catch {
    // directory doesn't exist
  }
  return result;
}

async function readSubdirs(dirPath: string): Promise<string[]> {
  const names: string[] = [];
  try {
    for await (const entry of Deno.readDir(dirPath)) {
      if (entry.isDirectory) names.push(entry.name);
    }
  } catch {
    // directory doesn't exist
  }
  return names.sort();
}

function writeJsonFile(path: string, data: unknown, indent?: number): Promise<void> {
  return Deno.writeTextFile(path, JSON.stringify(data, null, indent));
}

async function ensureDir(path: string): Promise<void> {
  await Deno.mkdir(path, { recursive: true });
}

// Files that are stored single-line (no indent) in the original save
const SINGLE_LINE_FILES = new Set(["Trash.json", "Graffiti.json", "OwnedVehicles.json"]);

// ── Decode ───────────────────────────────────────────────────────────

export async function decodeSave(saveDirPath: string): Promise<DecodedSave> {
  // Read all 19 top-level JSON files in parallel
  const [
    game, metadata, money, rank, time, law, products,
    cartel, sewer, graffiti, npcs, quests, variables,
    deliveries, ownedVehicles, shops, trash,
    genericSaveables, worldStorageEntities,
  ] = await Promise.all([
    readJsonFile(join(saveDirPath, "Game.json")),
    readJsonFile(join(saveDirPath, "Metadata.json")),
    readJsonFile(join(saveDirPath, "Money.json")),
    readJsonFile(join(saveDirPath, "Rank.json")),
    readJsonFile(join(saveDirPath, "Time.json")),
    readJsonFile(join(saveDirPath, "Law.json")),
    readJsonFile(join(saveDirPath, "Products.json")),
    readJsonFile(join(saveDirPath, "Cartel.json")),
    readJsonFile(join(saveDirPath, "Sewer.json")),
    readJsonFile(join(saveDirPath, "Graffiti.json")),
    readJsonFile(join(saveDirPath, "NPCs.json")),
    readJsonFile(join(saveDirPath, "Quests.json")),
    readJsonFile(join(saveDirPath, "Variables.json")),
    readJsonFile(join(saveDirPath, "Deliveries.json")),
    readJsonFile(join(saveDirPath, "OwnedVehicles.json")),
    readJsonFile(join(saveDirPath, "Shops.json")),
    readJsonFile(join(saveDirPath, "Trash.json")),
    readJsonFile(join(saveDirPath, "GenericSaveables.json")),
    readJsonFile(join(saveDirPath, "WorldStorageEntities.json")),
  ]);

  // Read Properties/ and Businesses/ directories
  const [properties, businesses] = await Promise.all([
    readJsonDir(join(saveDirPath, "Properties")),
    readJsonDir(join(saveDirPath, "Businesses")),
  ]);

  // Read Players/ subdirectories
  const playerNames = await readSubdirs(join(saveDirPath, "Players"));
  const players: Record<string, PlayerEntry> = {};
  await Promise.all(playerNames.map(async (name) => {
    const dir = join(saveDirPath, "Players", name);
    const player = await readJsonFile(join(dir, "Player.json"));
    if (!player) return;
    const entry: PlayerEntry = { player };
    const [appearance, inventory, clothing, vars] = await Promise.all([
      readJsonFile(join(dir, "Appearance.json")),
      readJsonFile(join(dir, "Inventory.json")),
      readJsonFile(join(dir, "Clothing.json")),
      readJsonFile(join(dir, "Variables.json")),
    ]);
    if (appearance) entry.appearance = appearance;
    if (inventory) entry.inventory = inventory;
    if (clothing) entry.clothing = clothing;
    if (vars) entry.variables = vars;
    players[name] = entry;
  }));

  return {
    game: game ?? {},
    metadata: metadata ?? {},
    money: money as unknown as MoneyData,
    rank: rank as unknown as RankData,
    time: time ?? {},
    law: law ?? {},
    products: products ?? {},
    cartel: cartel ?? {},
    sewer: sewer ?? {},
    graffiti: graffiti ?? {},
    npcs: npcs ?? {},
    quests: quests ?? {},
    variables: variables ?? {},
    deliveries: deliveries ?? {},
    ownedVehicles: ownedVehicles ?? {},
    shops: shops ?? {},
    trash: trash ?? {},
    genericSaveables: genericSaveables ?? {},
    worldStorageEntities: worldStorageEntities ?? {},
    properties,
    businesses,
    players,
  };
}

// ── Encode ───────────────────────────────────────────────────────────

export async function encodeSave(save: DecodedSave, outputDirPath: string): Promise<void> {
  await ensureDir(outputDirPath);

  // Top-level files — most with 4-space indent, some single-line
  const topLevelFiles: [string, unknown, number | undefined][] = [
    ["Game.json", save.game, 4],
    ["Metadata.json", save.metadata, 4],
    ["Money.json", save.money, 4],
    ["Rank.json", save.rank, 4],
    ["Time.json", save.time, 4],
    ["Law.json", save.law, 4],
    ["Products.json", save.products, 4],
    ["Cartel.json", save.cartel, 4],
    ["Sewer.json", save.sewer, 4],
    ["Graffiti.json", save.graffiti, SINGLE_LINE_FILES.has("Graffiti.json") ? undefined : 4],
    ["NPCs.json", save.npcs, 4],
    ["Quests.json", save.quests, 4],
    ["Variables.json", save.variables, 4],
    ["Deliveries.json", save.deliveries, 4],
    ["OwnedVehicles.json", save.ownedVehicles, SINGLE_LINE_FILES.has("OwnedVehicles.json") ? undefined : 4],
    ["Shops.json", save.shops, 4],
    ["Trash.json", save.trash, SINGLE_LINE_FILES.has("Trash.json") ? undefined : 4],
    ["GenericSaveables.json", save.genericSaveables, 4],
    ["WorldStorageEntities.json", save.worldStorageEntities, 4],
  ];

  await Promise.all(topLevelFiles.map(([name, data, indent]) =>
    writeJsonFile(join(outputDirPath, name as string), data, indent as number | undefined)
  ));

  // Properties/
  const propsDir = join(outputDirPath, "Properties");
  await ensureDir(propsDir);
  await Promise.all(Object.entries(save.properties).map(([name, data]) =>
    writeJsonFile(join(propsDir, `${name}.json`), data, 4)
  ));

  // Businesses/
  const bizDir = join(outputDirPath, "Businesses");
  await ensureDir(bizDir);
  await Promise.all(Object.entries(save.businesses).map(([name, data]) =>
    writeJsonFile(join(bizDir, `${name}.json`), data, 4)
  ));

  // Players/
  for (const [name, entry] of Object.entries(save.players)) {
    const dir = join(outputDirPath, "Players", name);
    await ensureDir(dir);
    const writes: Promise<void>[] = [
      writeJsonFile(join(dir, "Player.json"), entry.player, 4),
    ];
    if (entry.appearance) writes.push(writeJsonFile(join(dir, "Appearance.json"), entry.appearance, 4));
    if (entry.inventory) writes.push(writeJsonFile(join(dir, "Inventory.json"), entry.inventory, 4));
    if (entry.clothing) writes.push(writeJsonFile(join(dir, "Clothing.json"), entry.clothing, 4));
    if (entry.variables) writes.push(writeJsonFile(join(dir, "Variables.json"), entry.variables, 4));
    await Promise.all(writes);
  }
}

// ── Inventory Helpers ────────────────────────────────────────────────

interface InventoryItem {
  DataType: string;
  ID: string;
  Quantity: number;
  CashBalance?: number;
  [key: string]: unknown;
}

function parseInventoryItem(jsonStr: string): InventoryItem {
  return JSON.parse(jsonStr);
}

function serializeInventoryItem(item: InventoryItem): string {
  return JSON.stringify(item);
}

// ── NPC Helpers ──────────────────────────────────────────────────────

interface NPCData {
  DataType: string;
  BaseData: string;
  AdditionalDatas: Array<{ Name: string; Contents: string }>;
  [key: string]: unknown;
}

function getNPCs(save: DecodedSave): NPCData[] {
  return (save.npcs as { NPCs: NPCData[] }).NPCs ?? [];
}

function getNPCId(npc: NPCData): string {
  const base = JSON.parse(npc.BaseData);
  return base.ID ?? "";
}

function getAdditionalData(npc: NPCData, name: string): { Name: string; Contents: string } | undefined {
  return npc.AdditionalDatas.find(d => d.Name === name);
}

// ── Edit Helpers ─────────────────────────────────────────────────────

export function setMoney(save: DecodedSave, balance: number): void {
  save.money.OnlineBalance = balance;
  if (balance > save.money.Networth) {
    save.money.Networth = balance;
  }
}

export function setRank(save: DecodedSave, rank: number, tier: number, xp?: number): void {
  save.rank.Rank = rank;
  save.rank.Tier = tier;
  if (xp !== undefined) {
    save.rank.XP = xp;
    save.rank.TotalXP = xp;
  }
}

export function unlockAllRegions(save: DecodedSave): void {
  save.rank.UnlockedRegions = [0, 1, 2, 3, 4, 5];
}

export function setPlayerCash(save: DecodedSave, amount: number): void {
  for (const entry of Object.values(save.players)) {
    if (!entry.inventory) continue;
    const inv = entry.inventory as { Items: string[]; SlotFilters?: unknown[] };
    for (let i = 0; i < inv.Items.length; i++) {
      const parsed = parseInventoryItem(inv.Items[i]);
      if (parsed.DataType === "CashData") {
        parsed.CashBalance = amount;
        inv.Items[i] = serializeInventoryItem(parsed);
        break;
      }
    }
  }
}

export function addInventoryItem(save: DecodedSave, itemId: string, quantity: number): void {
  const gameVersion = (save.game.GameVersion as string) ?? "0.4.5f1";
  for (const entry of Object.values(save.players)) {
    if (!entry.inventory) continue;
    const inv = entry.inventory as { Items: string[]; SlotFilters?: unknown[] };
    // Check if item already exists
    let found = false;
    for (let i = 0; i < inv.Items.length; i++) {
      const parsed = parseInventoryItem(inv.Items[i]);
      if (parsed.ID === itemId) {
        parsed.Quantity += quantity;
        inv.Items[i] = serializeInventoryItem(parsed);
        found = true;
        break;
      }
    }
    if (found) continue;
    // Find first empty slot
    for (let i = 0; i < inv.Items.length; i++) {
      const parsed = parseInventoryItem(inv.Items[i]);
      if (parsed.ID === "" && parsed.Quantity === 0) {
        inv.Items[i] = serializeInventoryItem({
          DataType: "ItemData",
          DataVersion: 0,
          GameVersion: gameVersion,
          ID: itemId,
          Quantity: quantity,
        });
        break;
      }
    }
  }
}

export function setAllRelationships(save: DecodedSave, delta: number): void {
  for (const npc of getNPCs(save)) {
    const rel = getAdditionalData(npc, "Relationship");
    if (rel) {
      const data = JSON.parse(rel.Contents);
      data.RelationDelta = delta;
      data.Unlocked = true;
      rel.Contents = JSON.stringify(data, null, 4);
    }
  }
}

export function setNPCDependence(save: DecodedSave, npcId: string, dependence: number): void {
  for (const npc of getNPCs(save)) {
    if (getNPCId(npc) !== npcId) continue;
    const cd = getAdditionalData(npc, "CustomerData");
    if (cd) {
      const data = JSON.parse(cd.Contents);
      data.Dependence = dependence;
      cd.Contents = JSON.stringify(data, null, 4);
    }
    break;
  }
}

export function setAllOwned(save: DecodedSave): void {
  for (const prop of Object.values(save.properties)) {
    prop.IsOwned = true;
  }
  for (const biz of Object.values(save.businesses)) {
    biz.IsOwned = true;
  }
}

export function unlockAllProducts(save: DecodedSave): void {
  const products = save.products as Record<string, unknown>;
  const known = [
    "ogkush", "sourdiesel", "greencrack", "granddaddypurple",
    "meth", "cocaine", "shroom",
  ];
  const discovered = (products.DiscoveredProducts as string[]) ?? [];
  for (const p of known) {
    if (!discovered.includes(p)) discovered.push(p);
  }
  products.DiscoveredProducts = discovered;
}

export function setCartelInfluence(save: DecodedSave, influence: number): void {
  const cartel = save.cartel as Record<string, unknown>;
  const regions = cartel.RegionInfluence as Array<{ Region: number; Influence: number }>;
  if (regions) {
    for (const r of regions) {
      r.Influence = influence;
    }
  }
}

export function unlockSewer(save: DecodedSave): void {
  const sewer = save.sewer as Record<string, unknown>;
  sewer.IsSewerUnlocked = true;
}
