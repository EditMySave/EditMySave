/**
 * WAL (Write-Ahead Log) writer.
 * Creates a .log file containing WriteBatch records that RocksDB
 * will replay on the next database open.
 */

import {
  writeUint32LE, writeUint16LE, writeUint64LE,
  encodeVarint, concatBytes, crc32c, maskCrc,
} from "./encoding";

const BLOCK_SIZE = 32768; // 32KB
const HEADER_SIZE = 7;    // checksum(4) + length(2) + type(1)

const kFullType = 1;
const kFirstType = 2;
const kMiddleType = 3;
const kLastType = 4;

const kTypeValue = 0x01;
const kTypeColumnFamilyValue = 0x05;
const kTypeDeletion = 0x00;
const kTypeColumnFamilyDeletion = 0x04;

export interface WriteBatchEntry {
  type: "put" | "delete";
  columnFamilyId: number;
  key: Uint8Array;
  value?: Uint8Array;
}

export function serializeWriteBatch(
  sequence: bigint,
  entries: WriteBatchEntry[],
): Uint8Array {
  const parts: Uint8Array[] = [];

  const header = new Uint8Array(12);
  writeUint64LE(header, 0, sequence);
  writeUint32LE(header, 8, entries.length);
  parts.push(header);

  for (const entry of entries) {
    if (entry.type === "put") {
      if (entry.columnFamilyId === 0) {
        parts.push(new Uint8Array([kTypeValue]));
      } else {
        parts.push(new Uint8Array([kTypeColumnFamilyValue]));
        parts.push(encodeVarint(entry.columnFamilyId));
      }
      parts.push(encodeVarint(entry.key.length));
      parts.push(entry.key);
      const value = entry.value ?? new Uint8Array(0);
      parts.push(encodeVarint(value.length));
      parts.push(value);
    } else if (entry.type === "delete") {
      if (entry.columnFamilyId === 0) {
        parts.push(new Uint8Array([kTypeDeletion]));
      } else {
        parts.push(new Uint8Array([kTypeColumnFamilyDeletion]));
        parts.push(encodeVarint(entry.columnFamilyId));
      }
      parts.push(encodeVarint(entry.key.length));
      parts.push(entry.key);
    }
  }

  return concatBytes(...parts);
}

function emitPhysicalRecord(type: number, data: Uint8Array): Uint8Array {
  const record = new Uint8Array(HEADER_SIZE + data.length);

  writeUint16LE(record, 4, data.length);
  record[6] = type;

  const crcInput = new Uint8Array(1 + data.length);
  crcInput[0] = type;
  crcInput.set(data, 1);
  const checksum = maskCrc(crc32c(crcInput));
  writeUint32LE(record, 0, checksum);

  record.set(data, HEADER_SIZE);

  return record;
}

export function createWalFile(batches: Uint8Array[]): Uint8Array {
  const output: Uint8Array[] = [];
  let blockOffset = 0;

  for (const batch of batches) {
    let ptr = 0;
    let left = batch.length;
    let begin = true;

    while (left > 0 || begin) {
      const leftover = BLOCK_SIZE - blockOffset;

      if (leftover < HEADER_SIZE) {
        if (leftover > 0) {
          output.push(new Uint8Array(leftover));
        }
        blockOffset = 0;
      }

      const avail = BLOCK_SIZE - blockOffset - HEADER_SIZE;
      const fragmentLength = Math.min(left, avail);

      const end = (left === fragmentLength);
      let type: number;
      if (begin && end) {
        type = kFullType;
      } else if (begin) {
        type = kFirstType;
      } else if (end) {
        type = kLastType;
      } else {
        type = kMiddleType;
      }

      const fragment = batch.slice(ptr, ptr + fragmentLength);
      output.push(emitPhysicalRecord(type, fragment));
      blockOffset += HEADER_SIZE + fragmentLength;

      ptr += fragmentLength;
      left -= fragmentLength;
      begin = false;
    }
  }

  return concatBytes(...output);
}
