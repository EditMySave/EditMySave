/**
 * High-level RocksDB database reader - browser-compatible.
 *
 * Opens a RocksDB database from a Map<filename, File> and provides access
 * to KV pairs organized by column family. Reads CURRENT -> MANIFEST -> SST + WAL.
 */

import { replayManifest, type DatabaseState } from "./manifest";
import { readWalRecords } from "./wal";
import { parseWriteBatch } from "./writebatch";
import { readSstEntries, extractColumnFamilyId } from "./sst";
import { parseInternalKey, bytesToHex } from "./encoding";

export interface KVEntry {
  key: Uint8Array;
  value: Uint8Array;
  sequence: bigint;
}

export interface ColumnFamily {
  id: number;
  name: string;
  entries: Map<string, KVEntry>;
}

export interface RocksDBDatabase {
  columnFamilies: Map<string, ColumnFamily>;
  manifestState: DatabaseState;
  maxSequence: bigint;
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

async function readFileText(file: File): Promise<string> {
  const bytes = await readFileBytes(file);
  return new TextDecoder().decode(bytes);
}

/**
 * Open a RocksDB database from a map of filename -> File.
 * The keys in the map should be just filenames (no path prefix).
 */
export async function openDatabaseFromFiles(
  files: Map<string, File>
): Promise<RocksDBDatabase> {
  // 1. Read CURRENT -> MANIFEST
  const currentFile = files.get("CURRENT");
  if (!currentFile) throw new Error("Missing CURRENT file in database directory");
  const current = (await readFileText(currentFile)).trim();

  const manifestFile = files.get(current);
  if (!manifestFile) throw new Error(`Missing MANIFEST file: ${current}`);
  const manifestData = await readFileBytes(manifestFile);
  const state = replayManifest(manifestData);

  // Build CF map
  const cfById = new Map<number, ColumnFamily>();
  const cfByName = new Map<string, ColumnFamily>();
  for (const [id, info] of state.columnFamilies) {
    if (info.dropped) continue;
    const cf: ColumnFamily = { id, name: info.name, entries: new Map() };
    cfById.set(id, cf);
    cfByName.set(info.name, cf);
  }

  let maxSequence = state.lastSequence;

  // 2. Read all SST files
  const sstFiles: string[] = [];
  for (const name of files.keys()) {
    if (name.endsWith(".sst")) sstFiles.push(name);
  }
  sstFiles.sort();

  for (const sstFile of sstFiles) {
    const file = files.get(sstFile)!;
    const data = await readFileBytes(file);

    const cfId = extractColumnFamilyId(data) ?? 0;
    const cf = cfById.get(cfId);
    if (!cf) continue;

    for (const entry of readSstEntries(data)) {
      if (entry.userKey.length > 10000 || entry.value.length > 100_000_000) continue;
      const hexKey = bytesToHex(entry.userKey);
      const existing = cf.entries.get(hexKey);
      if (entry.sequence > maxSequence) maxSequence = entry.sequence;
      if (!existing || entry.sequence > existing.sequence) {
        cf.entries.set(hexKey, {
          key: entry.userKey,
          value: entry.value,
          sequence: entry.sequence,
        });
      }
    }
  }

  // 3. Read WAL .log files (unflushed data takes precedence)
  const logFiles: string[] = [];
  for (const name of files.keys()) {
    if (name.endsWith(".log")) logFiles.push(name);
  }
  logFiles.sort();

  for (const logFile of logFiles) {
    const file = files.get(logFile)!;
    const data = await readFileBytes(file);

    for (const record of readWalRecords(data)) {
      try {
        const batch = parseWriteBatch(record.data);
        const batchMaxSeq = batch.sequence + BigInt(batch.ops.length);
        if (batchMaxSeq > maxSequence) maxSequence = batchMaxSeq;
        for (const op of batch.ops) {
          const cf = cfById.get(op.columnFamilyId);
          if (!cf) continue;

          const hexKey = bytesToHex(op.key);

          if (op.type === "put" && op.value) {
            const existing = cf.entries.get(hexKey);
            if (!existing || batch.sequence > existing.sequence) {
              cf.entries.set(hexKey, {
                key: op.key,
                value: op.value,
                sequence: batch.sequence,
              });
            }
          } else if (op.type === "delete") {
            cf.entries.delete(hexKey);
          }
        }
      } catch {
        // Skip malformed WAL records
      }
    }
  }

  return { columnFamilies: cfByName, manifestState: state, maxSequence };
}

/** Get all entries from a column family as an array. */
export function getEntries(db: RocksDBDatabase, cfName: string): KVEntry[] {
  const cf = db.columnFamilies.get(cfName);
  if (!cf) return [];
  return [...cf.entries.values()];
}
