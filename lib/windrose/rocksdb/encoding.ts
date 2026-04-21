/** Binary encoding primitives for LevelDB/RocksDB format parsing. */

// --- Varint (LEB128) ---

export function decodeVarint(buf: Uint8Array, offset: number): [value: number, bytesRead: number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const b = buf[pos];
    result |= (b & 0x7f) << shift;
    pos++;
    if ((b & 0x80) === 0) return [result >>> 0, pos - offset];
    shift += 7;
    if (shift >= 35) throw new Error(`Varint too long at offset ${offset}`);
  }
  throw new Error(`Truncated varint at offset ${offset}`);
}

export function decodeVarint64(buf: Uint8Array, offset: number): [value: bigint, bytesRead: number] {
  let result = 0n;
  let shift = 0n;
  let pos = offset;
  while (pos < buf.length) {
    const b = buf[pos];
    result |= BigInt(b & 0x7f) << shift;
    pos++;
    if ((b & 0x80) === 0) return [result, pos - offset];
    shift += 7n;
    if (shift >= 70n) throw new Error(`Varint64 too long at offset ${offset}`);
  }
  throw new Error(`Truncated varint64 at offset ${offset}`);
}

export function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  let v = value >>> 0;
  while (v >= 0x80) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v);
  return new Uint8Array(bytes);
}

export function encodeVarint64(value: bigint): Uint8Array {
  const bytes: number[] = [];
  let v = value;
  while (v >= 0x80n) {
    bytes.push(Number(v & 0x7fn) | 0x80);
    v >>= 7n;
  }
  bytes.push(Number(v));
  return new Uint8Array(bytes);
}

// --- Varsigned int64 (zigzag + varint, used in delta-encoded BlockHandles) ---

export function decodeVarsignedint64(buf: Uint8Array, offset: number): [value: bigint, bytesRead: number] {
  const [raw, bytesRead] = decodeVarint64(buf, offset);
  const value = (raw >> 1n) ^ -(raw & 1n);
  return [value, bytesRead];
}

// --- Fixed-width integers (little-endian) ---

export function readUint32LE(buf: Uint8Array, offset: number): number {
  return (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0;
}

export function readUint64LE(buf: Uint8Array, offset: number): bigint {
  const lo = BigInt(readUint32LE(buf, offset));
  const hi = BigInt(readUint32LE(buf, offset + 4));
  return (hi << 32n) | lo;
}

export function readUint16LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}

export function writeUint32LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

export function writeUint64LE(buf: Uint8Array, offset: number, value: bigint): void {
  writeUint32LE(buf, offset, Number(value & 0xffffffffn));
  writeUint32LE(buf, offset + 4, Number((value >> 32n) & 0xffffffffn));
}

export function writeUint16LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

// --- Internal key codec ---

export const KEY_TYPE_DELETION = 0;
export const KEY_TYPE_VALUE = 1;

export interface InternalKey {
  userKey: Uint8Array;
  sequence: bigint;
  type: number;
}

export function parseInternalKey(key: Uint8Array): InternalKey {
  if (key.length < 8) throw new Error(`Internal key too short: ${key.length} bytes`);
  const seqType = readUint64LE(key, key.length - 8);
  return {
    userKey: key.slice(0, key.length - 8),
    sequence: seqType >> 8n,
    type: Number(seqType & 0xffn),
  };
}

export function makeInternalKey(userKey: Uint8Array, sequence: bigint, type: number): Uint8Array {
  const result = new Uint8Array(userKey.length + 8);
  result.set(userKey);
  writeUint64LE(result, userKey.length, (sequence << 8n) | BigInt(type));
  return result;
}

// --- Length-prefixed string (varint length + bytes) ---

export function decodeLenPrefixedBytes(buf: Uint8Array, offset: number): [data: Uint8Array, bytesRead: number] {
  const [len, lenBytes] = decodeVarint(buf, offset);
  const data = buf.slice(offset + lenBytes, offset + lenBytes + len);
  return [data, lenBytes + len];
}

// --- CRC32C (Castagnoli) ---

const CRC32C_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (0x82F63B78 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[i] = crc;
  }
  return table;
})();

export function crc32c(data: Uint8Array, initial = 0): number {
  let crc = initial ^ 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32C_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function maskCrc(crc: number): number {
  return (((crc >>> 15) | (crc << 17)) + 0xa282ead8) >>> 0;
}

export function unmaskCrc(masked: number): number {
  const rot = (masked - 0xa282ead8) >>> 0;
  return ((rot << 15) | (rot >>> 17)) >>> 0;
}

// --- Helpers ---

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function bytesToHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
