// Balatro save file decoder/encoder
// Format: DEFLATE-compressed Lua table serialization
// Code adapted from https://github.com/WilsontheWolf/balatro-save-loader/

import Pako from "npm:pako@2.1.0";
import pako from "pako";

/**
 * Decoded Balatro save data
 * Structure varies by save type (profile.jkr vs meta.jkr)
 */
export type DecodedSave = Record<string, unknown>;

// Regex patterns for Lua -> JSON conversion
const returnPrefix = /^return /;
const stringKeys = /\["(.*?)"\]=/g;
const numberKeys = /\[(\d+)\]=/g;
const trailingCommas = /,}/g;

// Regex patterns for JSON -> Lua conversion
const numberKey = /"NOSTRING_(\d+)":/g;
const stringKey = /"([^"]*?)":/g;

/**
 * Decompress raw DEFLATE data to string
 */
function decompress(data: Uint8Array): string {
  return Pako.inflateRaw(data, { to: "string" });
}

/**
 * Compress string to raw DEFLATE data
 */
function compress(data: string): Uint8Array {
  return Pako.deflateRaw(data);
}

/**
 * Convert Lua table string to JSON object
 * Handles Lua table syntax: ["key"]=value, [1]=value
 */
function rawToJSON(data: string): unknown {
  return JSON.parse(
    data
      .replace(returnPrefix, "")
      .replace(stringKeys, '"$1":')
      .replace(numberKeys, '"NOSTRING_$1":')
      .replace(trailingCommas, "}"),
  );
}

/**
 * Convert JSON back to Lua table string
 */
function jsonToRaw(data: unknown): string {
  return `return ${
    JSON.stringify(data)
      .replace(numberKey, "[$1]=")
      .replace(stringKey, '["$1"]=')
  }`;
}

/**
 * Fix JSON arrays: Convert Lua 1-indexed arrays to JavaScript 0-indexed arrays
 * Objects with only "NOSTRING_N" keys are converted to arrays
 */
function fixJSONArrays(json: unknown): unknown {
  if (typeof json !== "object" || json === null) {
    return json;
  }

  const keys = Object.keys(json);
  if (keys.length === 0) {
    return json;
  }

  // Check if all keys are NOSTRING_N (Lua array format)
  if (!keys.every((key) => key.startsWith("NOSTRING_"))) {
    // Regular object - recursively process values
    for (const key of keys) {
      (json as Record<string, unknown>)[key] = fixJSONArrays(
        (json as Record<string, unknown>)[key],
      );
    }
    return json;
  }

  // Convert to array (subtract 1 for 0-indexing)
  const array: unknown[] = [];
  for (const key of keys) {
    const index = parseInt(key.slice(9)) - 1; // Remove "NOSTRING_" and convert to 0-based
    array[index] = fixJSONArrays((json as Record<string, unknown>)[key]);
  }
  return array;
}

/**
 * Fix Lua arrays: Convert JavaScript 0-indexed arrays to Lua 1-indexed format
 * Arrays become objects with "NOSTRING_N" keys
 */
function fixLuaArrays(json: unknown): unknown {
  if (Array.isArray(json)) {
    const array: Record<string, unknown> = {};
    for (let i = 0; i < json.length; i++) {
      array[`NOSTRING_${i + 1}`] = fixLuaArrays(json[i]); // Add 1 for 1-indexing
    }
    return array;
  }

  if (typeof json === "object" && json !== null) {
    for (const key in json) {
      (json as Record<string, unknown>)[key] = fixLuaArrays(
        (json as Record<string, unknown>)[key],
      );
    }
  }

  return json;
}

/**
 * Decode a Balatro save file
 * 
 * @param filePath Path to .jkr save file
 * @returns Decoded save data as JavaScript object
 */
export async function decodeSave(filePath: string): Promise<DecodedSave> {
  const buffer = await Deno.readFile(filePath);
  const decompressed = decompress(buffer);
  const json = rawToJSON(decompressed);

  // Fix Lua arrays and special cases
  let decoded = fixJSONArrays(json) as DecodedSave;

  // Special handling: GRAPHICS.shadows is stored as "On"/"Off" string
  if (decoded.GRAPHICS && typeof decoded.GRAPHICS === "object") {
    const graphics = decoded.GRAPHICS as Record<string, unknown>;
    if (graphics.shadows === "On") {
      graphics.shadows = true;
    } else if (graphics.shadows === "Off") {
      graphics.shadows = false;
    }
  }

  return decoded;
}

/**
 * Encode a Balatro save file
 * 
 * @param data Save data to encode
 * @param outputPath Output file path
 */
export async function encodeSave(
  data: DecodedSave,
  outputPath: string,
): Promise<void> {
  // Clone to avoid modifying original
  let encoded = structuredClone(data);

  // Special handling: Convert boolean shadows back to string
  if (encoded.GRAPHICS && typeof encoded.GRAPHICS === "object") {
    const graphics = encoded.GRAPHICS as Record<string, unknown>;
    if (typeof graphics.shadows === "boolean") {
      graphics.shadows = graphics.shadows ? "On" : "Off";
    }
  }

  // Convert arrays and compress
  encoded = fixLuaArrays(encoded) as DecodedSave;
  const luaString = jsonToRaw(encoded);
  const compressed = compress(luaString);

  await Deno.writeFile(outputPath, compressed);
}

/**
 * Decode save to human-editable JSON file
 */
export async function decodeToJSON(
  inputFile: string,
  outputJson: string,
): Promise<void> {
  const decoded = await decodeSave(inputFile);
  await Deno.writeTextFile(outputJson, JSON.stringify(decoded, null, 2));
  const keys = Object.keys(decoded).length;
  console.log(`✓ Decoded save with ${keys} top-level keys to ${outputJson}`);
}

/**
 * Encode JSON file back to save format
 */
export async function encodeFromJSON(
  editedJson: string,
  outputFile: string,
): Promise<void> {
  const jsonText = await Deno.readTextFile(editedJson);
  const data: DecodedSave = JSON.parse(jsonText);
  await encodeSave(data, outputFile);
  const keys = Object.keys(data).length;
  console.log(`✓ Encoded save with ${keys} top-level keys to ${outputFile}`);
}

/**
 * Decode save file from File object (browser)
 */
export async function decodeSaveFromFile(file: File): Promise<DecodedSave> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  const decompressed = decompress(buffer);
  const json = rawToJSON(decompressed);

  // Fix Lua arrays and special cases
  let decoded = fixJSONArrays(json) as DecodedSave;

  // Special handling: GRAPHICS.shadows is stored as "On"/"Off" string
  if (decoded.GRAPHICS && typeof decoded.GRAPHICS === "object") {
    const graphics = decoded.GRAPHICS as Record<string, unknown>;
    if (graphics.shadows === "On") {
      graphics.shadows = true;
    } else if (graphics.shadows === "Off") {
      graphics.shadows = false;
    }
  }

  return decoded;
}

/**
 * Encode save file to Blob (browser)
 */
export async function encodeSaveToBlob(data: DecodedSave, originalFileName: string): Promise<Blob> {
  // Clone to avoid modifying original
  let encoded = structuredClone(data);

  // Special handling: Convert boolean shadows back to string
  if (encoded.GRAPHICS && typeof encoded.GRAPHICS === "object") {
    const graphics = encoded.GRAPHICS as Record<string, unknown>;
    if (typeof graphics.shadows === "boolean") {
      graphics.shadows = graphics.shadows ? "On" : "Off";
    }
  }

  // Convert arrays and compress
  encoded = fixLuaArrays(encoded) as DecodedSave;
  const luaString = jsonToRaw(encoded);
  const compressed = compress(luaString);

  return new Blob([compressed], { type: "application/octet-stream" });
}
