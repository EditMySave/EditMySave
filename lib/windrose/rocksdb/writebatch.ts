/**
 * WriteBatch parser for RocksDB WAL records.
 */

import { readUint64LE, readUint32LE, decodeVarint, decodeLenPrefixedBytes } from "./encoding";

export interface WriteBatchOp {
  type: "put" | "delete" | "merge";
  columnFamilyId: number;
  key: Uint8Array;
  value?: Uint8Array;
}

export interface WriteBatch {
  sequence: bigint;
  count: number;
  ops: WriteBatchOp[];
}

export function parseWriteBatch(data: Uint8Array): WriteBatch {
  if (data.length < 12) throw new Error(`WriteBatch too short: ${data.length}`);

  const sequence = readUint64LE(data, 0);
  const count = readUint32LE(data, 8);
  const ops: WriteBatchOp[] = [];

  let pos = 12;
  while (pos < data.length && ops.length < count) {
    const typeByte = data[pos++];
    let cfId = 0;
    let opType: "put" | "delete" | "merge";

    switch (typeByte) {
      case 0: // kTypeDeletion
        opType = "delete";
        break;
      case 1: // kTypeValue (Put)
        opType = "put";
        break;
      case 2: // kTypeMerge
        opType = "merge";
        break;
      case 3:
      case 4: // kTypeColumnFamilyDeletion
        opType = "delete";
        {
          const [cf, cfBytes] = decodeVarint(data, pos);
          cfId = cf;
          pos += cfBytes;
        }
        break;
      case 5: // kTypeColumnFamilyValue
        opType = "put";
        {
          const [cf, cfBytes] = decodeVarint(data, pos);
          cfId = cf;
          pos += cfBytes;
        }
        break;
      case 6: // kTypeColumnFamilyMerge
        opType = "merge";
        {
          const [cf, cfBytes] = decodeVarint(data, pos);
          cfId = cf;
          pos += cfBytes;
        }
        break;
      default:
        if (typeByte >= 7) {
          console.warn(`Unknown WriteBatch op type: ${typeByte} at offset ${pos - 1}`);
          return { sequence, count, ops };
        }
        opType = "put";
    }

    const [key, keyBytes] = decodeLenPrefixedBytes(data, pos);
    pos += keyBytes;

    let value: Uint8Array | undefined;
    if (opType === "put" || opType === "merge") {
      const [val, valBytes] = decodeLenPrefixedBytes(data, pos);
      value = val;
      pos += valBytes;
    }

    ops.push({ type: opType, columnFamilyId: cfId, key, value });
  }

  return { sequence, count, ops };
}
