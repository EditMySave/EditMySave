/**
 * Schedule 1 Save Editor CLI (v0.4.5+)
 *
 * Usage:
 *   deno task schedule-1:decode              - Decode save to JSON
 *   deno task schedule-1:encode              - Encode JSON back to save directory
 *   deno task schedule-1:info                - Print save summary
 *   deno task schedule-1:set-money 999999    - Set online balance
 *   deno task schedule-1:set-rank 5 10 0     - Set rank, tier, XP
 *   deno task schedule-1:set-cash 50000      - Set player pocket cash (all players)
 *   deno task schedule-1:max-relations       - Max all NPC relationships
 *   deno task schedule-1:own-all             - Own all properties and businesses
 *   deno task schedule-1:unlock-all          - Unlock all products, regions, sewer
 */

import {
  decodeSave,
  encodeSave,
  setMoney,
  setRank,
  setPlayerCash,
  setAllRelationships,
  setAllOwned,
  unlockAllProducts,
  unlockAllRegions,
  unlockSewer,
  setCartelInfluence,
  addInventoryItem,
  type DecodedSave,
} from "./save_io.ts";

const SAVE_DIR = "saves/schedule-1/SaveGame_2";
const DECODED_JSON = "experiments/schedule-1/decoded.json";
const OUTPUT_DIR = "experiments/schedule-1/SaveGame_2";

function printSummary(save: DecodedSave) {
  console.log("\n── Save Summary ──────────────────────────");
  console.log(`  Organisation: ${save.game.OrganisationName ?? "?"}`);
  console.log(`  Game Version: ${save.game.GameVersion ?? "?"}`);
  console.log(`  Balance:      $${save.money.OnlineBalance?.toFixed(2)}`);
  console.log(`  Networth:     $${save.money.Networth?.toFixed(2)}`);
  console.log(`  Rank ${save.rank.Rank} / Tier ${save.rank.Tier}  (${save.rank.TotalXP} XP)`);
  console.log(`  Regions:      ${JSON.stringify(save.rank.UnlockedRegions)}`);

  const time = save.time as Record<string, unknown>;
  const tod = time.TimeOfDay as number;
  console.log(`  Day ${time.ElapsedDays}, ${Math.floor(tod / 60)}:${String(tod % 60).padStart(2, "0")}  (${time.Playtime} min played)`);

  const npcs = (save.npcs as { NPCs: unknown[] }).NPCs ?? [];
  console.log(`  NPCs:         ${npcs.length}`);
  console.log(`  Properties:   ${Object.keys(save.properties).length} (${Object.entries(save.properties).filter(([_, p]) => (p as Record<string, unknown>).IsOwned).map(([n]) => n).join(", ") || "none owned"})`);
  console.log(`  Businesses:   ${Object.keys(save.businesses).length} (${Object.entries(save.businesses).filter(([_, b]) => (b as Record<string, unknown>).IsOwned).map(([n]) => n).join(", ") || "none owned"})`);

  const sewer = save.sewer as Record<string, unknown>;
  console.log(`  Sewer:        ${sewer.IsSewerUnlocked ? "unlocked" : "locked"}`);

  // Player inventories
  for (const [name, entry] of Object.entries(save.players)) {
    if (!entry.inventory) continue;
    const inv = (entry.inventory as { Items: string[] }).Items;
    const items = inv
      .map(s => JSON.parse(s) as { DataType: string; ID: string; Quantity: number; CashBalance?: number })
      .filter(i => i.ID !== "");
    const desc = items.map(i =>
      i.DataType === "CashData" ? `$${i.CashBalance?.toFixed(2)}` : `${i.ID} x${i.Quantity}`
    ).join(", ");
    console.log(`  ${name}: ${desc || "(empty)"}`);
  }
  console.log("───────────────────────────────────────────\n");
}

async function cmdDecode() {
  console.log(`Reading save from ${SAVE_DIR}...`);
  const save = await decodeSave(SAVE_DIR);
  await Deno.writeTextFile(DECODED_JSON, JSON.stringify(save, null, 2));
  console.log(`Decoded to ${DECODED_JSON}`);
  printSummary(save);
}

async function cmdEncode() {
  console.log(`Reading ${DECODED_JSON}...`);
  const text = await Deno.readTextFile(DECODED_JSON);
  const save: DecodedSave = JSON.parse(text);
  console.log(`Writing save to ${OUTPUT_DIR}...`);
  await encodeSave(save, OUTPUT_DIR);
  console.log("Done.");
}

async function cmdInfo() {
  const save = await decodeSave(SAVE_DIR);
  printSummary(save);
}

async function cmdSetMoney() {
  const amount = parseFloat(Deno.args[1]);
  if (isNaN(amount)) { console.error("Usage: set-money <amount>"); Deno.exit(1); }
  const save = await decodeSave(SAVE_DIR);
  setMoney(save, amount);
  await encodeSave(save, OUTPUT_DIR);
  console.log(`Set OnlineBalance to $${amount.toFixed(2)} -> ${OUTPUT_DIR}`);
}

async function cmdSetRank() {
  const rank = parseInt(Deno.args[1]);
  const tier = parseInt(Deno.args[2]);
  const xp = Deno.args[3] ? parseInt(Deno.args[3]) : undefined;
  if (isNaN(rank) || isNaN(tier)) { console.error("Usage: set-rank <rank> <tier> [xp]"); Deno.exit(1); }
  const save = await decodeSave(SAVE_DIR);
  setRank(save, rank, tier, xp);
  await encodeSave(save, OUTPUT_DIR);
  console.log(`Set Rank ${rank}, Tier ${tier}${xp !== undefined ? `, XP ${xp}` : ""} -> ${OUTPUT_DIR}`);
}

async function cmdSetCash() {
  const amount = parseFloat(Deno.args[1]);
  if (isNaN(amount)) { console.error("Usage: set-cash <amount>"); Deno.exit(1); }
  const save = await decodeSave(SAVE_DIR);
  setPlayerCash(save, amount);
  await encodeSave(save, OUTPUT_DIR);
  console.log(`Set cash to $${amount.toFixed(2)} for all players -> ${OUTPUT_DIR}`);
}

async function cmdMaxRelations() {
  const save = await decodeSave(SAVE_DIR);
  setAllRelationships(save, 100);
  await encodeSave(save, OUTPUT_DIR);
  console.log(`Maxed all NPC relationships -> ${OUTPUT_DIR}`);
}

async function cmdOwnAll() {
  const save = await decodeSave(SAVE_DIR);
  setAllOwned(save);
  await encodeSave(save, OUTPUT_DIR);
  console.log(`Set all properties and businesses to owned -> ${OUTPUT_DIR}`);
}

async function cmdUnlockAll() {
  const save = await decodeSave(SAVE_DIR);
  unlockAllProducts(save);
  unlockAllRegions(save);
  unlockSewer(save);
  setCartelInfluence(save, 0);
  await encodeSave(save, OUTPUT_DIR);
  console.log(`Unlocked all products, regions, sewer -> ${OUTPUT_DIR}`);
}

async function cmdAddItem() {
  const itemId = Deno.args[1];
  const qty = parseInt(Deno.args[2] ?? "1");
  if (!itemId) { console.error("Usage: add-item <itemId> [quantity]"); Deno.exit(1); }
  const save = await decodeSave(SAVE_DIR);
  addInventoryItem(save, itemId, qty);
  await encodeSave(save, OUTPUT_DIR);
  console.log(`Added ${itemId} x${qty} to all players -> ${OUTPUT_DIR}`);
}

async function main() {
  const command = Deno.args[0];

  switch (command) {
    case "decode": return cmdDecode();
    case "encode": return cmdEncode();
    case "info": return cmdInfo();
    case "set-money": return cmdSetMoney();
    case "set-rank": return cmdSetRank();
    case "set-cash": return cmdSetCash();
    case "max-relations": return cmdMaxRelations();
    case "own-all": return cmdOwnAll();
    case "unlock-all": return cmdUnlockAll();
    case "add-item": return cmdAddItem();
    default:
      console.log(`Schedule 1 Save Editor (v0.4.5+)

Commands:
  decode                  Read save directory -> decoded.json
  encode                  Write decoded.json -> save directory
  info                    Print save summary
  set-money <n>           Set online balance
  set-rank <r> <t> [xp]  Set rank, tier, optional XP
  set-cash <n>            Set player pocket cash (all players)
  max-relations           Max all NPC relationships
  own-all                 Own all properties and businesses
  unlock-all              Unlock all products, regions, sewer
  add-item <id> [n]       Add item to all players`);
  }
}

if (import.meta.main) await main();
