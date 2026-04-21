/**
 * Windrose Save Editor - browser-compatible decode/encode.
 *
 * Reads all 3 RocksDB databases (Accounts, Players, Worlds) from a
 * folder upload (FileList), decodes BSON values, and outputs structured JSON.
 * Encodes modifications back by writing WAL files into a ZIP archive.
 */

import { BSON } from "bson";
import JSZip from "jszip";
import { openDatabaseFromFiles, getEntries, type RocksDBDatabase } from "./rocksdb/rocksdb";
import { replayManifest, type DatabaseState } from "./rocksdb/manifest";
import { serializeWriteBatch, createWalFile, type WriteBatchEntry } from "./rocksdb/wal-writer";
import { readWalRecords } from "./rocksdb/wal";

// --- Types ---

/** JSON-safe version of DatabaseState (no Maps or bigints) */
export interface ManifestInfo {
  columnFamilies: Record<string, { id: number; name: string; dropped: boolean }>;
  lastSequence: number;
  maxSequence: number;
  nextFileNumber: number;
}

export interface WindroseSave {
  meta: {
    accountId: string;
    gameVersion: string;
    folderName: string;
  };
  databases: {
    accounts: DatabaseDump;
    players: DatabaseDump;
    worlds: DatabaseDump;
  };
  _manifestStates: {
    accounts: ManifestInfo;
    players: ManifestInfo;
    worlds: ManifestInfo;
  };
  _dbPrefixes: {
    accounts: string;
    players: string;
    worlds: string;
  };
  _modifiedDBs: Record<string, boolean>;
}

function toManifestInfo(state: DatabaseState, maxSequence: bigint): ManifestInfo {
  const cfs: Record<string, { id: number; name: string; dropped: boolean }> = {};
  for (const [id, info] of state.columnFamilies) {
    cfs[String(id)] = { id: info.id, name: info.name, dropped: info.dropped };
  }
  return {
    columnFamilies: cfs,
    lastSequence: Number(state.lastSequence),
    maxSequence: Number(maxSequence),
    nextFileNumber: state.nextFileNumber,
  };
}

export interface DatabaseDump {
  [columnFamily: string]: CFEntry[];
}

export interface CFEntry {
  key: string;
  value: Record<string, unknown>;
  valueSize: number;
}

// --- Original bytes map (kept outside WindroseSave to avoid cloneSave corruption) ---

export interface OriginalEntryBytes {
  bsonBytes: Uint8Array;
  jsonFingerprint: string;
}

/** Maps "cfName/entryKey" -> original BSON bytes + JSON fingerprint */
export type OriginalBytesMap = Map<string, OriginalEntryBytes>;

function entryMapKey(cfName: string, entryKey: string): string {
  return `${cfName}/${entryKey}`;
}

// --- Decode ---

function decodeBsonValue(data: Uint8Array): Record<string, unknown> {
  try {
    return BSON.deserialize(data, { promoteValues: true }) as Record<string, unknown>;
  } catch {
    return { _raw_hex: Array.from(data).map(b => b.toString(16).padStart(2, "0")).join(""), _size: data.length };
  }
}

function dumpDatabase(
  db: RocksDBDatabase,
  originalBytes: OriginalBytesMap,
): DatabaseDump {
  const result: DatabaseDump = {};
  for (const [cfName, cf] of db.columnFamilies) {
    const entries: CFEntry[] = [];
    for (const entry of cf.entries.values()) {
      const keyStr = new TextDecoder().decode(entry.key);
      const decoded = decodeBsonValue(entry.value);
      entries.push({
        key: keyStr,
        value: decoded,
        valueSize: entry.value.length,
      });
      // Store original bytes + fingerprint for round-trip preservation
      if (decoded._raw_hex === undefined) {
        originalBytes.set(entryMapKey(cfName, keyStr), {
          bsonBytes: entry.value,
          jsonFingerprint: JSON.stringify(decoded),
        });
      }
    }
    if (entries.length > 0) {
      entries.sort((a, b) => a.key.localeCompare(b.key));
      result[cfName] = entries;
    }
  }
  return result;
}

/**
 * Build a map from relative file paths to File objects.
 * Strips the root folder name from webkitRelativePath.
 */
function buildFileMap(files: FileList): Map<string, File> {
  const map = new Map<string, File>();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = file.webkitRelativePath || file.name;
    // Strip the root folder name (first path segment)
    const parts = path.split("/");
    const relativePath = parts.slice(1).join("/");
    if (relativePath && !file.name.startsWith(".")) {
      map.set(relativePath, file);
    }
  }
  return map;
}

/**
 * Discover the 3 database subdirectories within the file map.
 * Expected structure: RocksDB/{version}/{Accounts,Players,Worlds}/{GUID}/
 */
function discoverDatabases(fileMap: Map<string, File>): {
  accounts: string;
  players: string;
  worlds: string;
} {
  const result: Record<string, string> = {};

  for (const path of fileMap.keys()) {
    const match = path.match(/^RocksDB\/([^/]+)\/(Accounts|Players|Worlds)\/([^/]+)\//);
    if (match) {
      const dbType = match[2].toLowerCase();
      if (!result[dbType]) {
        result[dbType] = `RocksDB/${match[1]}/${match[2]}/${match[3]}`;
      }
    }
  }

  if (!result.accounts || !result.players || !result.worlds) {
    throw new Error(
      `Could not find all 3 database directories. Found: ${Object.keys(result).join(", ")}. ` +
      `Expected: RocksDB/{version}/{Accounts,Players,Worlds}/{GUID}/`
    );
  }

  return result as { accounts: string; players: string; worlds: string };
}

/**
 * Filter the file map to only include files within a given prefix.
 * Returns a new map with just the filenames (no prefix).
 */
function filterFiles(fileMap: Map<string, File>, prefix: string): Map<string, File> {
  const filtered = new Map<string, File>();
  const prefixWithSlash = prefix.endsWith("/") ? prefix : prefix + "/";
  for (const [path, file] of fileMap) {
    if (path.startsWith(prefixWithSlash)) {
      const filename = path.slice(prefixWithSlash.length);
      // Only include direct files (not in subdirectories)
      if (!filename.includes("/")) {
        filtered.set(filename, file);
      }
    }
  }
  return filtered;
}

export interface DecodeResult {
  save: WindroseSave;
  originalBytes: {
    accounts: OriginalBytesMap;
    players: OriginalBytesMap;
    worlds: OriginalBytesMap;
  };
}

export async function decodeSaveFromFiles(files: FileList): Promise<DecodeResult> {
  const fileMap = buildFileMap(files);
  const dbPrefixes = discoverDatabases(fileMap);

  const accountsDb = await openDatabaseFromFiles(filterFiles(fileMap, dbPrefixes.accounts));
  const playersDb = await openDatabaseFromFiles(filterFiles(fileMap, dbPrefixes.players));
  const worldsDb = await openDatabaseFromFiles(filterFiles(fileMap, dbPrefixes.worlds));

  // Extract metadata
  const accountEntries = getEntries(accountsDb, "R5BLAccount");
  const accountId = accountEntries.length > 0
    ? new TextDecoder().decode(accountEntries[0].key)
    : "unknown";

  let gameVersion = "unknown";
  if (accountEntries.length > 0) {
    try {
      const doc = BSON.deserialize(accountEntries[0].value, { promoteValues: true }) as Record<string, unknown>;
      gameVersion = (doc._version as string) ?? "unknown";
    } catch { /* ignore */ }
  }

  // Get the root folder name from the first file
  let folderName = "windrose-save";
  if (files.length > 0) {
    const firstPath = files[0].webkitRelativePath || files[0].name;
    const rootFolder = firstPath.split("/")[0];
    if (rootFolder) folderName = rootFolder;
  }

  const origAccounts: OriginalBytesMap = new Map();
  const origPlayers: OriginalBytesMap = new Map();
  const origWorlds: OriginalBytesMap = new Map();

  return {
    save: {
      meta: {
        accountId,
        gameVersion,
        folderName,
      },
      databases: {
        accounts: dumpDatabase(accountsDb, origAccounts),
        players: dumpDatabase(playersDb, origPlayers),
        worlds: dumpDatabase(worldsDb, origWorlds),
      },
      _manifestStates: {
        accounts: toManifestInfo(accountsDb.manifestState, accountsDb.maxSequence),
        players: toManifestInfo(playersDb.manifestState, playersDb.maxSequence),
        worlds: toManifestInfo(worldsDb.manifestState, worldsDb.maxSequence),
      },
      _dbPrefixes: dbPrefixes,
      _modifiedDBs: {},
    },
    originalBytes: {
      accounts: origAccounts,
      players: origPlayers,
      worlds: origWorlds,
    },
  };
}

// --- Encode ---

export async function encodeSaveToBlob(
  save: WindroseSave,
  originalFiles: FileList,
  originalBytes?: { accounts: OriginalBytesMap; players: OriginalBytesMap; worlds: OriginalBytesMap },
): Promise<Blob> {
  const zip = new JSZip();
  const fileMap = buildFileMap(originalFiles);

  // Copy all original files into the zip
  for (const [relativePath, file] of fileMap) {
    const buffer = await file.arrayBuffer();
    zip.file(relativePath, buffer);
  }

  // For each database, write a new WAL with all entries
  const dbNames = ["accounts", "players", "worlds"] as const;

  for (const dbName of dbNames) {
    // Skip databases that haven't been modified - their original
    // SST/WAL files are already copied and remain authoritative
    if (!save._modifiedDBs[dbName]) continue;

    const dbDump = save.databases[dbName];
    const manifestState = save._manifestStates[dbName];
    const dbPrefix = save._dbPrefixes[dbName];

    // Get CF name -> id mapping from manifest state
    const cfNameToId = new Map<string, number>();
    for (const info of Object.values(manifestState.columnFamilies)) {
      if (!info.dropped) cfNameToId.set(info.name, info.id);
    }

    // Sequence number must be higher than ALL existing entries (SST + WAL)
    const highestSeq = Math.max(manifestState.lastSequence, manifestState.maxSequence);
    const nextSequence = BigInt(highestSeq) + 1000n;

    // Build WriteBatch entries
    const batchEntries: WriteBatchEntry[] = [];
    for (const [cfName, entries] of Object.entries(dbDump)) {
      const cfId = cfNameToId.get(cfName);
      if (cfId === undefined) continue;

      const dbOrigBytes = originalBytes?.[dbName];

      for (const entry of entries) {
        // Skip entries that failed BSON deserialization - their original
        // data is preserved in the copied SST/WAL files
        if (entry.value._raw_hex !== undefined) continue;

        const key = new TextEncoder().encode(entry.key);

        // Use original BSON bytes if the entry hasn't changed,
        // to avoid BSON type corruption from JSON round-tripping
        let valueBytes: Uint8Array;
        const origEntry = dbOrigBytes?.get(entryMapKey(cfName, entry.key));
        if (origEntry && JSON.stringify(entry.value) === origEntry.jsonFingerprint) {
          valueBytes = origEntry.bsonBytes;
        } else {
          const serialized = BSON.serialize(entry.value);
          valueBytes = new Uint8Array(serialized.buffer, serialized.byteOffset, serialized.byteLength);
        }

        batchEntries.push({
          type: "put",
          columnFamilyId: cfId,
          key,
          value: valueBytes,
        });
      }
    }

    if (batchEntries.length === 0) continue;

    // Serialize as a WriteBatch
    const batchData = serializeWriteBatch(nextSequence, batchEntries);

    // Wrap in a WAL file
    const walData = createWalFile([batchData]);

    // Find the next available log file number
    const nextFileNum = manifestState.nextFileNumber;
    const logFileName = String(nextFileNum).padStart(6, "0") + ".log";

    // Write the WAL file into the zip
    zip.file(`${dbPrefix}/${logFileName}`, walData);
  }

  return await zip.generateAsync({ type: "blob" });
}
