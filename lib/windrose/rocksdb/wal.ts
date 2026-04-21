/**
 * WAL (Write-Ahead Log) / Journal reader.
 * Format: 32KB blocks containing records with 7-byte headers.
 * Also used for MANIFEST files (same record format).
 */

import { readUint16LE, readUint32LE, crc32c, unmaskCrc } from "./encoding";

const BLOCK_SIZE = 32768; // 32KB
const HEADER_SIZE = 7;    // checksum(4) + length(2) + type(1)

// Record types
const RECORD_FULL = 1;
const RECORD_FIRST = 2;
const RECORD_MIDDLE = 3;
const RECORD_LAST = 4;

export interface WalRecord {
  data: Uint8Array;
}

/**
 * Read all logical records from a WAL/journal file.
 * Handles record fragmentation across 32KB block boundaries.
 */
export function* readWalRecords(fileData: Uint8Array, skipChecksums = true): Generator<WalRecord> {
  let pos = 0;
  let fragments: Uint8Array[] = [];

  while (pos < fileData.length) {
    const blockOffset = pos % BLOCK_SIZE;
    const blockRemaining = BLOCK_SIZE - blockOffset;

    if (blockRemaining < HEADER_SIZE) {
      pos += blockRemaining;
      continue;
    }

    const checksum = readUint32LE(fileData, pos);
    const length = readUint16LE(fileData, pos + 4);
    const type = fileData[pos + 6];

    if (pos + HEADER_SIZE + length > fileData.length) break;

    const payload = fileData.slice(pos + HEADER_SIZE, pos + HEADER_SIZE + length);

    if (!skipChecksums) {
      const checksumData = new Uint8Array(1 + length);
      checksumData[0] = type;
      checksumData.set(payload, 1);
      const expected = unmaskCrc(checksum);
      const actual = crc32c(checksumData);
      if (expected !== actual) {
        pos += HEADER_SIZE + length;
        fragments = [];
        continue;
      }
    }

    pos += HEADER_SIZE + length;

    switch (type) {
      case RECORD_FULL:
        fragments = [];
        yield { data: payload };
        break;

      case RECORD_FIRST:
        fragments = [payload];
        break;

      case RECORD_MIDDLE:
        if (fragments.length > 0) {
          fragments.push(payload);
        }
        break;

      case RECORD_LAST:
        if (fragments.length > 0) {
          fragments.push(payload);
          const totalLen = fragments.reduce((s, f) => s + f.length, 0);
          const assembled = new Uint8Array(totalLen);
          let offset = 0;
          for (const f of fragments) {
            assembled.set(f, offset);
            offset += f.length;
          }
          fragments = [];
          yield { data: assembled };
        }
        break;

      default:
        fragments = [];
        break;
    }
  }
}
