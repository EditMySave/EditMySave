/**
 * SST (Sorted String Table) / BlockBasedTable reader.
 */

import {
  readUint32LE, readUint64LE,
  decodeVarint, decodeVarint64, decodeVarsignedint64,
  parseInternalKey,
} from "./encoding";

const BLOCK_BASED_TABLE_MAGIC = 0x88e241b785f4cff7n;
const FOOTER_SIZE = 53;
const BLOCK_TRAILER_SIZE = 5;
const EXTENDED_MAGIC = new Uint8Array([0x3e, 0x00, 0x7a, 0x00]);

export interface BlockHandle {
  offset: number;
  size: number;
}

export interface SstFooter {
  metaindexHandle: BlockHandle;
  indexHandle: BlockHandle;
  formatVersion: number;
  checksumType: number;
}

export function decodeBlockHandle(buf: Uint8Array, offset: number): [BlockHandle, number] {
  const [off, offBytes] = decodeVarint64(buf, offset);
  const [sz, szBytes] = decodeVarint64(buf, offset + offBytes);
  return [{ offset: Number(off), size: Number(sz) }, offBytes + szBytes];
}

export function parseFooter(fileData: Uint8Array): SstFooter {
  const size = fileData.length;
  if (size < FOOTER_SIZE) throw new Error("File too small for SST footer");

  const magic = readUint64LE(fileData, size - 8);

  if (magic !== BLOCK_BASED_TABLE_MAGIC) {
    throw new Error(`Unsupported SST magic: 0x${magic.toString(16)}`);
  }

  const footerStart = size - FOOTER_SIZE;
  const formatVersion = readUint32LE(fileData, size - 12);
  const checksumType = fileData[footerStart];

  if (formatVersion >= 6) {
    for (let i = 0; i < 4; i++) {
      if (fileData[footerStart + 1 + i] !== EXTENDED_MAGIC[i]) {
        throw new Error("Bad extended magic in v6 footer");
      }
    }

    const metaindexSize = readUint32LE(fileData, footerStart + 13);
    const metaindexEnd = footerStart - BLOCK_TRAILER_SIZE;
    const metaindexOffset = metaindexEnd - metaindexSize;

    return {
      metaindexHandle: { offset: metaindexOffset, size: metaindexSize },
      indexHandle: { offset: 0, size: 0 },
      formatVersion,
      checksumType,
    };
  }

  const fv15 = readUint32LE(fileData, footerStart + 40);
  const ct15 = fileData[footerStart + 44];
  const [metaindexHandle, mBytes] = decodeBlockHandle(fileData, footerStart);
  const [indexHandle] = decodeBlockHandle(fileData, footerStart + mBytes);
  return { metaindexHandle, indexHandle, formatVersion: fv15, checksumType: ct15 };
}

export function findIndexHandle(fileData: Uint8Array, metaindexHandle: BlockHandle): BlockHandle | null {
  const blockData = fileData.slice(metaindexHandle.offset, metaindexHandle.offset + metaindexHandle.size);
  const decoder = new TextDecoder();

  for (const [key, value] of iterateBlockEntries(blockData)) {
    const keyStr = decoder.decode(key);
    if (keyStr === "rocksdb.index") {
      const [handle] = decodeBlockHandle(value, 0);
      return handle;
    }
  }
  return null;
}

export function readBlock(fileData: Uint8Array, handle: BlockHandle): Uint8Array {
  return fileData.slice(handle.offset, handle.offset + handle.size);
}

export function* iterateBlockEntries(
  blockData: Uint8Array,
  valueDeltaEncoded = false,
): Generator<[key: Uint8Array, value: Uint8Array]> {
  if (blockData.length < 4) return;

  const numRestarts = readUint32LE(blockData, blockData.length - 4);
  if (numRestarts > 100000 || numRestarts * 4 + 4 > blockData.length) return;
  const restartsStart = blockData.length - 4 - numRestarts * 4;
  if (restartsStart < 0) return;

  if (valueDeltaEncoded) {
    let pos = 0;
    let prevKey = new Uint8Array(0);

    while (pos < restartsStart) {
      try {
        const [shared, sharedB] = decodeVarint(blockData, pos); pos += sharedB;
        const [nonShared, nonSharedB] = decodeVarint(blockData, pos); pos += nonSharedB;

        const key = new Uint8Array(shared + nonShared);
        if (shared > 0) key.set(prevKey.slice(0, shared));
        key.set(blockData.slice(pos, pos + nonShared), shared);
        pos += nonShared;

        const valueStart = pos;
        if (shared === 0) {
          const [, offB] = decodeVarint64(blockData, pos); pos += offB;
          const [, szB] = decodeVarint64(blockData, pos); pos += szB;
        } else {
          const [, deltaB] = decodeVarint64(blockData, pos); pos += deltaB;
        }

        const value = blockData.slice(valueStart, pos);
        prevKey = key;
        yield [key, value];
      } catch {
        break;
      }
    }
    return;
  }

  let pos = 0;
  let prevKey = new Uint8Array(0);

  while (pos < restartsStart) {
    const [shared, sharedBytes] = decodeVarint(blockData, pos);
    pos += sharedBytes;
    const [nonShared, nonSharedBytes] = decodeVarint(blockData, pos);
    pos += nonSharedBytes;
    const [valueLen, valueLenBytes] = decodeVarint(blockData, pos);
    pos += valueLenBytes;

    const key = new Uint8Array(shared + nonShared);
    if (shared > 0) key.set(prevKey.slice(0, shared));
    key.set(blockData.slice(pos, pos + nonShared), shared);
    pos += nonShared;

    const value = blockData.slice(pos, pos + valueLen);
    pos += valueLen;

    prevKey = key;
    yield [key, value];
  }
}

export function extractColumnFamilyId(fileData: Uint8Array): number | undefined {
  const needle = new TextEncoder().encode("column.family.id");
  for (let i = 0; i < fileData.length - needle.length - 10; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (fileData[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) {
      const afterKey = i + needle.length;
      const byte = fileData[afterKey];
      if (byte < 128) return byte;
      try {
        const [val] = decodeVarint(fileData, afterKey);
        if (val < 1000) return val;
      } catch { /* continue searching */ }
    }
  }
  return undefined;
}

export function* readSstEntries(
  fileData: Uint8Array
): Generator<{ userKey: Uint8Array; value: Uint8Array; sequence: bigint; type: number }> {
  let footer: SstFooter;
  try {
    footer = parseFooter(fileData);
  } catch {
    yield* readSstEntriesBruteForce(fileData);
    return;
  }

  let indexHandle = footer.indexHandle;
  if (indexHandle.size === 0 && footer.formatVersion >= 6) {
    const found = findIndexHandle(fileData, footer.metaindexHandle);
    if (!found) {
      yield* readSstEntriesBruteForce(fileData);
      return;
    }
    indexHandle = found;
  }

  const indexBlockData = readBlock(fileData, indexHandle);
  const dataBlockHandles: BlockHandle[] = [];
  const isDeltaEncoded = footer.formatVersion >= 4;

  try {
    let prevHandle: BlockHandle | null = null;
    for (const [, value] of iterateBlockEntries(indexBlockData, isDeltaEncoded)) {
      try {
        let handle: BlockHandle;
        const [candidate] = decodeBlockHandle(value, 0);
        if (candidate.offset >= 0 && candidate.size > 0 &&
            candidate.offset + candidate.size <= fileData.length &&
            (prevHandle === null || candidate.offset >= prevHandle.offset)) {
          handle = candidate;
        } else if (prevHandle !== null) {
          const [delta] = decodeVarsignedint64(value, 0);
          handle = {
            offset: prevHandle.offset + prevHandle.size + BLOCK_TRAILER_SIZE,
            size: prevHandle.size + Number(delta),
          };
        } else {
          continue;
        }
        if (handle.offset >= 0 && handle.size > 0 && handle.offset + handle.size <= fileData.length) {
          dataBlockHandles.push(handle);
          prevHandle = handle;
        }
      } catch {
        // Skip malformed handles
      }
    }
  } catch {
    // Index block parsing failed
  }

  if (dataBlockHandles.length > 0) {
    for (const handle of dataBlockHandles) {
      try {
        const blockData = readBlock(fileData, handle);
        for (const [key, value] of iterateBlockEntries(blockData)) {
          try {
            const ik = parseInternalKey(key);
            if (ik.type === 1) {
              yield { userKey: ik.userKey, value, sequence: ik.sequence, type: ik.type };
            }
          } catch { /* skip malformed keys */ }
        }
      } catch { /* skip unreadable blocks */ }
    }
  } else {
    yield* readSstEntriesBruteForce(fileData);
  }
}

function* readSstEntriesBruteForce(
  fileData: Uint8Array
): Generator<{ userKey: Uint8Array; value: Uint8Array; sequence: bigint; type: number }> {
  let pos = 0;
  let prevKey = new Uint8Array(0);

  while (pos < fileData.length - 12) {
    try {
      const [shared, sharedBytes] = decodeVarint(fileData, pos);
      pos += sharedBytes;
      const [nonShared, nonSharedBytes] = decodeVarint(fileData, pos);
      pos += nonSharedBytes;
      const [valueLen, valueLenBytes] = decodeVarint(fileData, pos);
      pos += valueLenBytes;

      if (shared > 1000 || nonShared > 10000 || valueLen > fileData.length) {
        break;
      }
      if (pos + nonShared + valueLen > fileData.length) break;

      const key = new Uint8Array(shared + nonShared);
      if (shared > 0) key.set(prevKey.slice(0, shared));
      key.set(fileData.slice(pos, pos + nonShared), shared);
      pos += nonShared;

      const value = fileData.slice(pos, pos + valueLen);
      pos += valueLen;

      prevKey = key;

      if (key.length >= 8) {
        const ik = parseInternalKey(key);
        if (ik.type === 1) {
          yield { userKey: ik.userKey, value, sequence: ik.sequence, type: ik.type };
        }
      }
    } catch {
      break;
    }
  }
}
