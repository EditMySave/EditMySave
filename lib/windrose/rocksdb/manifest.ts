/**
 * MANIFEST parser for RocksDB.
 * Replays VersionEdit records to reconstruct database state.
 */

import { readWalRecords } from "./wal";
import {
  decodeVarint, decodeVarint64, decodeLenPrefixedBytes,
} from "./encoding";

const kComparator = 1;
const kLogNumber = 2;
const kNextFileNumber = 3;
const kLastSequence = 4;
const kCompactPointer = 5;
const kDeletedFile = 6;
const kNewFile = 7;
const kPrevLogNumber = 9;
const kNewFile2 = 100;
const kNewFile3 = 102;
const kNewFile4 = 103;
const kColumnFamily = 200;
const kColumnFamilyAdd = 201;
const kColumnFamilyDrop = 202;
const kMaxColumnFamily = 203;
const kMinLogNumberToKeep = 204;
const kInAtomicGroup = 300;
const kBlobFileAddition = 400;
const kBlobFileGarbage = 401;

export interface SstFileInfo {
  fileNumber: number;
  fileSize: number;
  level: number;
  columnFamilyId: number;
  smallestKey?: Uint8Array;
  largestKey?: Uint8Array;
}

export interface ColumnFamilyInfo {
  id: number;
  name: string;
  dropped: boolean;
}

export interface DatabaseState {
  columnFamilies: Map<number, ColumnFamilyInfo>;
  activeFiles: Map<number, SstFileInfo>;
  lastSequence: bigint;
  logNumber: number;
  nextFileNumber: number;
}

interface VersionEdit {
  columnFamilyId?: number;
  columnFamilyAdd?: string;
  columnFamilyDrop?: boolean;
  logNumber?: number;
  nextFileNumber?: number;
  lastSequence?: bigint;
  prevLogNumber?: number;
  newFiles: Array<{
    level: number;
    fileNumber: number;
    fileSize: number;
    smallestKey?: Uint8Array;
    largestKey?: Uint8Array;
  }>;
  deletedFiles: Array<{ level: number; fileNumber: number }>;
}

const KNOWN_TAGS = new Set([
  kComparator, kLogNumber, kNextFileNumber, kLastSequence, kCompactPointer,
  kDeletedFile, kNewFile, kPrevLogNumber, kNewFile2, kNewFile3, kNewFile4,
  kColumnFamily, kColumnFamilyAdd, kColumnFamilyDrop, kMaxColumnFamily,
  kMinLogNumberToKeep, kInAtomicGroup, kBlobFileAddition, kBlobFileGarbage,
]);

function skipNewFileTrailingFields(data: Uint8Array, pos: number, fileTag: number): number {
  const savedPos = pos;
  try {
    const [, ssB] = decodeVarint64(data, pos); pos += ssB;
    const [, lsB] = decodeVarint64(data, pos); pos += lsB;

    if (fileTag >= kNewFile3) {
      const [, ncB] = decodeVarint(data, pos); pos += ncB;
    }

    if (fileTag >= kNewFile4) {
      const [, obB] = decodeVarint64(data, pos); pos += obB;
      const [, oaB] = decodeVarint64(data, pos); pos += oaB;
      const [, fctB] = decodeVarint64(data, pos); pos += fctB;
      const [, enB] = decodeVarint64(data, pos); pos += enB;
      const [, csB] = decodeLenPrefixedBytes(data, pos); pos += csB;
      const [, cfB] = decodeLenPrefixedBytes(data, pos); pos += cfB;
      const [, u1B] = decodeVarint64(data, pos); pos += u1B;
      const [, u2B] = decodeVarint64(data, pos); pos += u2B;
      const [, crdB] = decodeVarint64(data, pos); pos += crdB;
      const [, tsB] = decodeVarint64(data, pos); pos += tsB;
      const [, udtpB] = decodeVarint(data, pos); pos += udtpB;
    }

    if (pos < data.length) {
      const [nextTag] = decodeVarint(data, pos);
      if (KNOWN_TAGS.has(nextTag)) return pos;
    } else {
      return pos;
    }
  } catch {
    // Fall through to scanning approach
  }

  pos = savedPos;
  while (pos < data.length) {
    try {
      const [candidate] = decodeVarint(data, pos);
      if (KNOWN_TAGS.has(candidate)) {
        return pos;
      }
    } catch {
      // continue scanning
    }
    pos++;
  }
  return pos;
}

function parseVersionEdit(data: Uint8Array): VersionEdit {
  const edit: VersionEdit = {
    newFiles: [],
    deletedFiles: [],
  };

  let pos = 0;
  while (pos < data.length) {
    const [tag, tagBytes] = decodeVarint(data, pos);
    pos += tagBytes;

    switch (tag) {
      case kComparator: {
        const [, nameBytes] = decodeLenPrefixedBytes(data, pos);
        pos += nameBytes;
        break;
      }
      case kLogNumber: {
        const [val, valBytes] = decodeVarint64(data, pos);
        edit.logNumber = Number(val);
        pos += valBytes;
        break;
      }
      case kNextFileNumber: {
        const [val, valBytes] = decodeVarint64(data, pos);
        edit.nextFileNumber = Number(val);
        pos += valBytes;
        break;
      }
      case kLastSequence: {
        const [val, valBytes] = decodeVarint64(data, pos);
        edit.lastSequence = val;
        pos += valBytes;
        break;
      }
      case kCompactPointer: {
        const [, levelBytes] = decodeVarint(data, pos);
        pos += levelBytes;
        const [, keyBytes] = decodeLenPrefixedBytes(data, pos);
        pos += keyBytes;
        break;
      }
      case kDeletedFile: {
        const [level, levelBytes] = decodeVarint(data, pos);
        pos += levelBytes;
        const [fileNum, fileBytes] = decodeVarint64(data, pos);
        pos += fileBytes;
        edit.deletedFiles.push({ level, fileNumber: Number(fileNum) });
        break;
      }
      case kNewFile: {
        const [level, levelBytes] = decodeVarint(data, pos);
        pos += levelBytes;
        const [fileNum, fileBytes] = decodeVarint64(data, pos);
        pos += fileBytes;
        const [fileSize, sizeBytes] = decodeVarint64(data, pos);
        pos += sizeBytes;
        const [smallestKey, skBytes] = decodeLenPrefixedBytes(data, pos);
        pos += skBytes;
        const [largestKey, lkBytes] = decodeLenPrefixedBytes(data, pos);
        pos += lkBytes;
        edit.newFiles.push({
          level,
          fileNumber: Number(fileNum),
          fileSize: Number(fileSize),
          smallestKey,
          largestKey,
        });
        break;
      }
      case kNewFile2:
      case kNewFile3:
      case kNewFile4: {
        const [level, levelBytes] = decodeVarint(data, pos);
        pos += levelBytes;
        const [fileNum, fileBytes] = decodeVarint64(data, pos);
        pos += fileBytes;
        const [fileSize, sizeBytes] = decodeVarint64(data, pos);
        pos += sizeBytes;
        const [smallestKey, skBytes] = decodeLenPrefixedBytes(data, pos);
        pos += skBytes;
        const [largestKey, lkBytes] = decodeLenPrefixedBytes(data, pos);
        pos += lkBytes;

        edit.newFiles.push({
          level,
          fileNumber: Number(fileNum),
          fileSize: Number(fileSize),
          smallestKey,
          largestKey,
        });

        pos = skipNewFileTrailingFields(data, pos, tag);
        break;
      }
      case kPrevLogNumber: {
        const [val, valBytes] = decodeVarint64(data, pos);
        edit.prevLogNumber = Number(val);
        pos += valBytes;
        break;
      }
      case kColumnFamily: {
        const [val, valBytes] = decodeVarint(data, pos);
        edit.columnFamilyId = val;
        pos += valBytes;
        break;
      }
      case kColumnFamilyAdd: {
        const [name, nameBytes] = decodeLenPrefixedBytes(data, pos);
        pos += nameBytes;
        edit.columnFamilyAdd = new TextDecoder().decode(name);
        break;
      }
      case kColumnFamilyDrop: {
        edit.columnFamilyDrop = true;
        break;
      }
      case kMaxColumnFamily: {
        const [, valBytes] = decodeVarint(data, pos);
        pos += valBytes;
        break;
      }
      case kMinLogNumberToKeep: {
        const [, valBytes] = decodeVarint64(data, pos);
        pos += valBytes;
        break;
      }
      case kInAtomicGroup: {
        const [, valBytes] = decodeVarint(data, pos);
        pos += valBytes;
        break;
      }
      case kBlobFileAddition:
      case kBlobFileGarbage: {
        const [, bfBytes] = decodeVarint64(data, pos);
        pos += bfBytes;
        if (tag === kBlobFileAddition) {
          const [, tbcBytes] = decodeVarint64(data, pos);
          pos += tbcBytes;
          const [, tbbBytes] = decodeVarint64(data, pos);
          pos += tbbBytes;
          const [, cmBytes] = decodeLenPrefixedBytes(data, pos);
          pos += cmBytes;
          const [, cvBytes] = decodeLenPrefixedBytes(data, pos);
          pos += cvBytes;
        } else {
          const [, gbcBytes] = decodeVarint64(data, pos);
          pos += gbcBytes;
          const [, gbbBytes] = decodeVarint64(data, pos);
          pos += gbbBytes;
        }
        break;
      }
      default: {
        return edit;
      }
    }
  }

  return edit;
}

export function replayManifest(manifestData: Uint8Array): DatabaseState {
  const state: DatabaseState = {
    columnFamilies: new Map(),
    activeFiles: new Map(),
    lastSequence: 0n,
    logNumber: 0,
    nextFileNumber: 0,
  };

  state.columnFamilies.set(0, { id: 0, name: "default", dropped: false });

  let currentCfId = 0;

  for (const record of readWalRecords(manifestData)) {
    let edit: VersionEdit;
    try {
      edit = parseVersionEdit(record.data);
    } catch {
      continue;
    }

    const cfId = edit.columnFamilyId ?? currentCfId;

    if (edit.columnFamilyAdd !== undefined) {
      state.columnFamilies.set(cfId, {
        id: cfId,
        name: edit.columnFamilyAdd,
        dropped: false,
      });
    }

    if (edit.columnFamilyDrop) {
      const cf = state.columnFamilies.get(cfId);
      if (cf) cf.dropped = true;
    }

    if (edit.logNumber !== undefined) state.logNumber = edit.logNumber;
    if (edit.nextFileNumber !== undefined) state.nextFileNumber = edit.nextFileNumber;
    if (edit.lastSequence !== undefined) state.lastSequence = edit.lastSequence;

    for (const deleted of edit.deletedFiles) {
      state.activeFiles.delete(deleted.fileNumber);
    }

    for (const newFile of edit.newFiles) {
      state.activeFiles.set(newFile.fileNumber, {
        fileNumber: newFile.fileNumber,
        fileSize: newFile.fileSize,
        level: newFile.level,
        columnFamilyId: cfId,
        smallestKey: newFile.smallestKey,
        largestKey: newFile.largestKey,
      });
    }
  }

  return state;
}
