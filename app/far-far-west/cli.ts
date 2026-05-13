/**
 * Far Far West Save Editor CLI
 *
 * Commands:
 *   decode       - Decrypt + parse a save to a human-friendly JSON.
 *                  Reads the latest encoded output if one exists (so you can
 *                  verify edits), otherwise the immutable baseline in saves/.
 *   encode       - Re-encrypt: re-parses the baseline save for scaffolding,
 *                  grafts your friendly-JSON value edits onto it, writes to
 *                  experiments/. Cannot add/remove inventory entries, map
 *                  keys, or array items — use the raw commands for that.
 *   decode-raw   - Dump the full GVAS scaffold (type tags, _meta_raw, FName
 *                  suffixes, etc.) for byte-identical structural edits.
 *   encode-raw   - Re-serialize the raw scaffold JSON back to a save.
 *   roundtrip    - Sanity check: decrypt + parse + serialize is byte-identical.
 *   reset        - Delete the encoded output + decoded JSONs so the next
 *                  decode starts from the baseline save again.
 */

import {
  decodeToFriendlyJSON,
  decodeToRawJSON,
  encodeFromFriendlyJSON,
  encodeFromRawJSON,
  roundtripCheck,
} from "./save_io.ts";

const SAVE_FILE        = "/Users/reisscashmore/Development/SaveEditor/saves/far-far-west/76561198034513767.save";
const DECODED_JSON     = "/Users/reisscashmore/Development/SaveEditor/experiments/far-far-west/decoded.json";
const DECODED_RAW_JSON = "/Users/reisscashmore/Development/SaveEditor/experiments/far-far-west/decoded.raw.json";
const OUTPUT_FILE      = "/Users/reisscashmore/Development/SaveEditor/experiments/far-far-west/76561198034513767.save";

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * The save we should decode FROM:
 *   - if there's an encoded output from a previous edit, use that
 *     (so `encode -> decode` reflects your edits)
 *   - otherwise the immutable baseline in saves/.
 */
async function decodeSource(): Promise<{ path: string; isOutput: boolean }> {
  if (await exists(OUTPUT_FILE)) return { path: OUTPUT_FILE, isOutput: true };
  return { path: SAVE_FILE, isOutput: false };
}

async function tryRemove(path: string): Promise<boolean> {
  try {
    await Deno.remove(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const command = Deno.args[0];

  if (command === "decode") {
    const src = await decodeSource();
    console.log(`🔓 Decoding Far Far West save (friendly) from ${src.isOutput ? "encoded output" : "baseline"}...`);
    console.log(`   source: ${src.path}\n`);
    await decodeToFriendlyJSON(src.path, DECODED_JSON);
    console.log(`📁 Output: ${DECODED_JSON}`);
    console.log("\nEdit the JSON, then run 'deno task far-far-west:encode' to apply.");
    if (src.isOutput) {
      console.log("(Run 'deno task far-far-west:reset' to start fresh from the baseline save.)");
    }
    console.log();
    return;
  }

  if (command === "encode") {
    console.log("🔐 Grafting edits + encrypting Far Far West save...\n");
    // Always graft onto the immutable baseline so edits never compound from
    // a corrupted intermediate; the friendly JSON contains the full state.
    await encodeFromFriendlyJSON(DECODED_JSON, OUTPUT_FILE, SAVE_FILE);
    console.log(`📁 Output: ${OUTPUT_FILE}`);
    console.log("\nRun 'deno task far-far-west:decode' to verify (it will read the encoded output).\n");
    return;
  }

  if (command === "decode-raw") {
    const src = await decodeSource();
    console.log(`🔓 Decoding Far Far West save (raw GVAS scaffold) from ${src.isOutput ? "encoded output" : "baseline"}...\n`);
    await decodeToRawJSON(src.path, DECODED_RAW_JSON);
    console.log(`📁 Output: ${DECODED_RAW_JSON}\n`);
    return;
  }

  if (command === "encode-raw") {
    console.log("🔐 Re-serializing raw scaffold + encrypting...\n");
    await encodeFromRawJSON(DECODED_RAW_JSON, OUTPUT_FILE, SAVE_FILE);
    console.log(`📁 Output: ${OUTPUT_FILE}\n`);
    return;
  }

  if (command === "roundtrip") {
    console.log("🔁 Round-trip integrity check (baseline save)...\n");
    const r = await roundtripCheck(SAVE_FILE);
    if (r.ok) {
      console.log("✅ OK: decrypt → parse → serialize is byte-identical.");
      return;
    }
    if (r.size) {
      console.error(`❌ size differs: orig=${r.size.orig} rebuilt=${r.size.rebuilt}`);
    } else {
      console.error(`❌ first byte diff at offset ${r.firstDiff}`);
    }
    Deno.exit(1);
  }

  if (command === "reset") {
    let n = 0;
    for (const p of [OUTPUT_FILE, DECODED_JSON, DECODED_RAW_JSON]) {
      if (await tryRemove(p)) { console.log(`🗑  removed ${p}`); n++; }
    }
    if (n === 0) console.log("(nothing to remove)");
    console.log("\nNext decode will read from the baseline save.\n");
    return;
  }

  console.error("Usage: cli.ts <decode|encode|decode-raw|encode-raw|roundtrip|reset>");
  Deno.exit(1);
}

if (import.meta.main) {
  try {
    await main();
  } catch (e) {
    console.error(`❌ Error: ${e instanceof Error ? e.message : String(e)}`);
    Deno.exit(1);
  }
}
