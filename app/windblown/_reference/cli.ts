/**
 * Windblown Save File CLI
 *
 * Usage:
 *   deno task windblown:decode [save_path]
 *   deno task windblown:encode [save_path]
 */

import {
  decodeSave,
  encodeSave,
  toEditableJSON,
  applyEdits,
  type EditableJSON,
} from "./save_io.ts";

const DEFAULT_SAVE = "saves/windblown/second-save/671ab6c4a259a71f2b5a46c9.sav";
const DECODED_JSON = "experiments/windblown/decoded.json";
const OUTPUT_FILE = "experiments/windblown/modified.sav";

async function main() {
  const command = Deno.args[0];
  const savePath = Deno.args[1] || DEFAULT_SAVE;

  if (command === "decode") {
    console.log(`Decoding: ${savePath}`);
    const decoded = await decodeSave(savePath);
    const json = toEditableJSON(decoded);

    await Deno.writeTextFile(DECODED_JSON, JSON.stringify(json, null, 2));

    console.log(`Player: ${json.playerName}`);
    console.log(`Currencies:`);
    console.log(`  Cogs:              ${json.currencies.cogs}`);
    console.log(`  Memonite Dust:     ${json.currencies.memoniteDust}`);
    console.log(`  Memonite Shard:    ${json.currencies.memoniteShard}`);
    console.log(`  Memonite Fragment: ${json.currencies.memoniteFragment}`);
    console.log(`  Obsidian Memonite: ${json.currencies.obsidianMemonite}`);

    const setFlags = Object.entries(json.metaFlags).filter(([, v]) => v);
    const totalFlags = Object.keys(json.metaFlags).length;
    console.log(`\nUnlocks (${setFlags.length}/${totalFlags}):`);
    for (const [name, isSet] of Object.entries(json.metaFlags)) {
      if (isSet) console.log(`  + ${name}`);
    }

    console.log(`\nWritten to: ${DECODED_JSON}`);
  } else if (command === "encode") {
    console.log(`Encoding from: ${DECODED_JSON}`);
    console.log(`Original save: ${savePath}`);

    const decoded = await decodeSave(savePath);
    const edits: EditableJSON = JSON.parse(await Deno.readTextFile(DECODED_JSON));
    applyEdits(decoded, edits);
    await encodeSave(decoded, OUTPUT_FILE);

    console.log(`\nModified currencies:`);
    console.log(`  Cogs:              ${edits.currencies.cogs}`);
    console.log(`  Memonite Dust:     ${edits.currencies.memoniteDust}`);
    console.log(`  Memonite Shard:    ${edits.currencies.memoniteShard}`);
    console.log(`  Memonite Fragment: ${edits.currencies.memoniteFragment}`);
    console.log(`  Obsidian Memonite: ${edits.currencies.obsidianMemonite}`);
    console.log(`\nWritten to: ${OUTPUT_FILE}`);
  } else {
    console.log("Usage: windblown:decode [save_path] | windblown:encode [save_path]");
    Deno.exit(1);
  }
}

if (import.meta.main) await main();
