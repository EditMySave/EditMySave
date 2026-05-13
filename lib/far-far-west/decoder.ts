// Far Far West save file decoder — browser port of app/far-far-west/save_io.ts.
//
// Format:
//   File:        [16-byte IV][AES-256-CBC ciphertext]   (no PKCS#7 padding;
//                                                       plaintext zero-padded
//                                                       to a 16-byte multiple)
//   Key:         SHA-256(<SteamID digits from filename> + PARTY_SUFFIX)
//   Plaintext:   Unreal GVAS save (UE5.7), FarFarWest property-tag variant
//
// The GVAS variant differs from the stock UE layout: each property tag is
//   fstring name, fstring type, type-descriptor, i32 value_size, u8 0, value
// rather than the usual (name, type, i64 size, i32 array_index, type-header,
// value). We preserve the raw descriptor and any value trailing bytes so a
// parse -> serialize round trip is byte-identical.

import aesjs from "aes-js"

// deno-lint-ignore no-explicit-any
type Any = any

// ---------------------------------------------------------------------------
// Crypto
// ---------------------------------------------------------------------------

export const PARTY_SUFFIX = "NicoArnoEvilRaptorFireshineRobbo"

export function steamIdFromFileName(name: string): string {
  const stem = name.replace(/\.save$/i, "")
  const m = stem.match(/^(\d+)/)
  if (!m) throw new Error(`save filename must start with a SteamID: ${stem}`)
  return m[1]
}

async function deriveKey(seed: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(seed)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return new Uint8Array(digest)
}

function decryptSave(data: Uint8Array, key: Uint8Array): Uint8Array {
  if (data.length < 32 || (data.length - 16) % 16 !== 0) {
    throw new Error(`bad save size ${data.length}`)
  }
  const iv = data.subarray(0, 16)
  const ct = data.subarray(16)
  const cbc = new aesjs.ModeOfOperation.cbc(key, iv)
  const pt = cbc.decrypt(ct)
  if (pt[0] !== 0x47 || pt[1] !== 0x56 || pt[2] !== 0x41 || pt[3] !== 0x53) {
    throw new Error("decrypt produced non-GVAS magic; wrong SteamID or wrong file")
  }
  return pt
}

function encryptSave(plaintext: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  if (plaintext[0] !== 0x47 || plaintext[1] !== 0x56 || plaintext[2] !== 0x41 || plaintext[3] !== 0x53) {
    throw new Error("plaintext must start with GVAS")
  }
  let pt = plaintext
  if (pt.length % 16 !== 0) {
    const padded = new Uint8Array(pt.length + (16 - (pt.length % 16)))
    padded.set(pt)
    pt = padded
  }
  if (iv.length !== 16) throw new Error("iv must be 16 bytes")
  const cbc = new aesjs.ModeOfOperation.cbc(key, iv)
  const ct = cbc.encrypt(pt)
  const out = new Uint8Array(16 + ct.length)
  out.set(iv, 0)
  out.set(ct, 16)
  return out
}

// ---------------------------------------------------------------------------
// Byte helpers
// ---------------------------------------------------------------------------

function bytesToBase64(b: Uint8Array): string {
  let s = ""
  const CHUNK = 0x8000
  for (let i = 0; i < b.length; i += CHUNK) {
    s += String.fromCharCode(...b.subarray(i, i + CHUNK))
  }
  return btoa(s)
}

function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s.trim())
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
}

function hexToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2)
  for (let i = 0; i < s.length; i += 2) out[i / 2] = parseInt(s.substring(i, i + 2), 16)
  return out
}

// ---------------------------------------------------------------------------
// Reader / Writer (little-endian)
// ---------------------------------------------------------------------------

class Reader {
  readonly view: DataView
  p = 0
  constructor(public readonly buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  }
  get length() { return this.buf.length }

  read(n: number): Uint8Array {
    if (n < 0) throw new Error(`negative read length ${n}`)
    if (this.p + n > this.buf.length) {
      throw new Error(`read past end (need ${n}, have ${this.buf.length - this.p})`)
    }
    const out = this.buf.subarray(this.p, this.p + n)
    this.p += n
    return out
  }
  i8():  number { const v = this.view.getInt8(this.p);    this.p += 1; return v }
  u8():  number { const v = this.view.getUint8(this.p);   this.p += 1; return v }
  i16(): number { const v = this.view.getInt16(this.p, true);  this.p += 2; return v }
  u16(): number { const v = this.view.getUint16(this.p, true); this.p += 2; return v }
  i32(): number { const v = this.view.getInt32(this.p, true);  this.p += 4; return v }
  u32(): number { const v = this.view.getUint32(this.p, true); this.p += 4; return v }
  i64(): bigint { const v = this.view.getBigInt64(this.p, true);  this.p += 8; return v }
  u64(): bigint { const v = this.view.getBigUint64(this.p, true); this.p += 8; return v }
  f32(): number { const v = this.view.getFloat32(this.p, true); this.p += 4; return v }
  f64(): number { const v = this.view.getFloat64(this.p, true); this.p += 8; return v }

  guid(): string { return bytesToHex(this.read(16)) }

  fstring(): string {
    const n = this.i32()
    if (n === 0) return ""
    if (n > 0) {
      let data = this.read(n)
      if (data.length && data[data.length - 1] === 0) data = data.subarray(0, -1)
      return new TextDecoder("utf-8").decode(data)
    }
    const units = -n
    let data = this.read(units * 2)
    if (data.length >= 2 && data[data.length - 2] === 0 && data[data.length - 1] === 0) {
      data = data.subarray(0, -2)
    }
    return new TextDecoder("utf-16le").decode(data)
  }

  plausibleFstringAt(pos: number): boolean {
    if (pos < 0 || pos + 4 > this.buf.length) return false
    if (this.buf[pos] === 0) return false
    const n = new DataView(this.buf.buffer, this.buf.byteOffset + pos, 4).getInt32(0, true)
    if (n === 0) return true
    if (n > 0) {
      if (n > 4096 || pos + 4 + n > this.buf.length) return false
      return this.buf[pos + 4 + n - 1] === 0
    }
    const units = -n
    return units <= 4096 && pos + 4 + units * 2 <= this.buf.length
  }
}

class Writer {
  private parts: Uint8Array[] = []
  private len = 0

  getValue(): Uint8Array {
    const out = new Uint8Array(this.len)
    let off = 0
    for (const p of this.parts) { out.set(p, off); off += p.length }
    return out
  }

  write(b: Uint8Array) { this.parts.push(b); this.len += b.length }
  private push(byteLen: number, fn: (v: DataView) => void) {
    const buf = new Uint8Array(byteLen)
    fn(new DataView(buf.buffer))
    this.write(buf)
  }
  i8(v: number)  { this.push(1, (d) => d.setInt8(0, v)) }
  u8(v: number)  { this.push(1, (d) => d.setUint8(0, v)) }
  i16(v: number) { this.push(2, (d) => d.setInt16(0, v, true)) }
  u16(v: number) { this.push(2, (d) => d.setUint16(0, v, true)) }
  i32(v: number) { this.push(4, (d) => d.setInt32(0, v, true)) }
  u32(v: number) { this.push(4, (d) => d.setUint32(0, v, true)) }
  i64(v: bigint) { this.push(8, (d) => d.setBigInt64(0, v, true)) }
  u64(v: bigint) { this.push(8, (d) => d.setBigUint64(0, v, true)) }
  f32(v: number) { this.push(4, (d) => d.setFloat32(0, v, true)) }
  f64(v: number) { this.push(8, (d) => d.setFloat64(0, v, true)) }

  guid(hex32: string) {
    if (hex32.length !== 32) throw new Error("guid must be 32 hex chars")
    this.write(hexToBytes(hex32))
  }

  fstring(s: string) {
    if (s === "") { this.i32(0); return }
    let isAscii = true
    for (let i = 0; i < s.length; i++) {
      if (s.charCodeAt(i) > 0x7f) { isAscii = false; break }
    }
    if (isAscii) {
      const data = new Uint8Array(s.length + 1)
      for (let i = 0; i < s.length; i++) data[i] = s.charCodeAt(i)
      data[s.length] = 0
      this.i32(data.length)
      this.write(data)
    } else {
      const units = s.length
      const data = new Uint8Array((units + 1) * 2)
      const dv = new DataView(data.buffer)
      for (let i = 0; i < units; i++) dv.setUint16(i * 2, s.charCodeAt(i), true)
      dv.setUint16(units * 2, 0, true)
      this.i32(-(units + 1))
      this.write(data)
    }
  }
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export interface CustomVersion {
  guid: string
  version: number
}

export interface GvasHeader {
  save_game_file_version: number
  package_file_ue4_version: number
  package_file_ue5_version: number | null
  engine_version_major: number
  engine_version_minor: number
  engine_version_patch: number
  engine_version_changelist: number
  engine_version_branch: string
  custom_versions_format: number
  custom_versions: CustomVersion[]
  save_game_class_name: string
}

function readHeader(r: Reader): GvasHeader {
  const magic = r.read(4)
  if (magic[0] !== 0x47 || magic[1] !== 0x56 || magic[2] !== 0x41 || magic[3] !== 0x53) {
    throw new Error(`bad magic ${bytesToHex(magic)}`)
  }
  const sgfv = r.i32()
  const pkg_ue4 = r.i32()
  const pkg_ue5 = sgfv >= 3 ? r.i32() : null
  const major = r.i16()
  const minor = r.i16()
  const patch = r.i16()
  const changelist = r.i32()
  const branch = r.fstring()
  const cv_fmt = r.i32()
  const n = r.i32()
  const cvs: CustomVersion[] = []
  for (let i = 0; i < n; i++) cvs.push({ guid: r.guid(), version: r.i32() })
  const sgcn = r.fstring()
  return {
    save_game_file_version: sgfv,
    package_file_ue4_version: pkg_ue4,
    package_file_ue5_version: pkg_ue5,
    engine_version_major: major,
    engine_version_minor: minor,
    engine_version_patch: patch,
    engine_version_changelist: changelist,
    engine_version_branch: branch,
    custom_versions_format: cv_fmt,
    custom_versions: cvs,
    save_game_class_name: sgcn,
  }
}

function writeHeader(w: Writer, h: GvasHeader): void {
  w.write(new Uint8Array([0x47, 0x56, 0x41, 0x53]))
  w.i32(h.save_game_file_version)
  w.i32(h.package_file_ue4_version)
  if (h.save_game_file_version >= 3) w.i32(h.package_file_ue5_version ?? 0)
  w.i16(h.engine_version_major)
  w.i16(h.engine_version_minor)
  w.i16(h.engine_version_patch)
  w.i32(h.engine_version_changelist)
  w.fstring(h.engine_version_branch)
  w.i32(h.custom_versions_format)
  w.i32(h.custom_versions.length)
  for (const cv of h.custom_versions) { w.guid(cv.guid); w.i32(cv.version) }
  w.fstring(h.save_game_class_name)
}

// ---------------------------------------------------------------------------
// Property descriptors and values
// ---------------------------------------------------------------------------

interface TypeMeta {
  kind: number
  struct_type?: string
  struct_path_flag?: number
  struct_path?: string
  struct_unknown?: number
  struct_guid?: string
  struct_tail?: number
  enum_type?: string
  enum_path_flag?: number
  enum_path?: string
  enum_tail?: number
  inner_type?: string
  inner_meta?: TypeMeta
  key_type?: string
  key_meta?: TypeMeta
  value_type?: string
  value_meta?: TypeMeta
}

function readTypeMeta(r: Reader, type_: string): TypeMeta {
  const meta: TypeMeta = { kind: r.i32() }
  if (type_ === "StructProperty") {
    meta.struct_type = r.fstring()
    meta.struct_path_flag = r.i32()
    meta.struct_path = r.fstring()
    meta.struct_unknown = r.i32()
    meta.struct_guid = r.fstring()
    meta.struct_tail = r.i32()
    return meta
  }
  if (type_ === "ByteProperty") {
    meta.enum_type = r.fstring()
    meta.enum_path_flag = r.i32()
    meta.enum_path = r.fstring()
    meta.enum_tail = r.i32()
    return meta
  }
  if (type_ === "ArrayProperty" || type_ === "SetProperty") {
    meta.inner_type = r.fstring()
    meta.inner_meta = readTypeMeta(r, meta.inner_type)
    return meta
  }
  if (type_ === "MapProperty") {
    meta.key_type = r.fstring()
    meta.key_meta = readTypeMeta(r, meta.key_type)
    meta.value_type = r.fstring()
    meta.value_meta = readTypeMeta(r, meta.value_type)
    return meta
  }
  return meta
}

function readProperty(r: Reader, name: string): Any {
  const type_ = r.fstring()
  const metaStart = r.p
  const meta = readTypeMeta(r, type_)
  const metaRaw = r.buf.subarray(metaStart, r.p)
  const size = r.i32()
  const terminator = r.u8()
  if (terminator !== 0) {
    throw new Error(`expected 0 terminator for ${name}, got ${terminator}`)
  }
  const valueStart = r.p
  const valueEnd = valueStart + size
  if (valueEnd > r.length) {
    throw new Error(`property ${name} value overruns file (need ${size}, have ${r.length - r.p})`)
  }

  const p: Any = {
    _name: name,
    _type: type_,
    _format: "ffw",
    _size: size,
    _meta: meta,
    _meta_raw: bytesToBase64(metaRaw),
  }
  flattenMeta(p, meta)

  try {
    p.value = readValue(r, type_, meta, size)
  } catch (exc) {
    r.p = valueStart
    p._raw = bytesToBase64(r.read(size))
    p._parse_error = exc instanceof Error ? exc.message : String(exc)
    return p
  }

  if (r.p < valueEnd) {
    p._value_trailing = bytesToBase64(r.read(valueEnd - r.p))
  } else if (r.p > valueEnd) {
    throw new Error(`property ${name} consumed past declared size`)
  }
  return p
}

function flattenMeta(p: Any, meta: TypeMeta) {
  if (meta.struct_type !== undefined) {
    p.struct_type = meta.struct_type
    p.struct_path = meta.struct_path
    p.struct_guid = meta.struct_guid
  }
  if (meta.enum_type !== undefined) {
    p.enum = meta.enum_type
    p.enum_path = meta.enum_path
  }
  if (meta.inner_type !== undefined) p.inner_type = meta.inner_type
  if (meta.key_type !== undefined) {
    p.key_type = meta.key_type
    p.value_type = meta.value_type
  }
}

function readValue(r: Reader, type_: string, meta: TypeMeta, size: number): Any {
  switch (type_) {
    case "BoolProperty": return r.u8() !== 0
    case "ByteProperty": return size === 1 ? r.u8() : r.fstring()
    case "EnumProperty": return r.fstring()
    case "StructProperty": return readStructValue(r, meta.struct_type ?? "", size)
    case "ArrayProperty": return readArrayValue(r, meta.inner_type!, meta.inner_meta!)
    case "MapProperty":   return readMapValue(r, meta.key_type!, meta.key_meta!, meta.value_type!, meta.value_meta!)
    case "SetProperty": {
      const removed = r.i32()
      const n = r.i32()
      const items: Any[] = []
      for (let i = 0; i < n; i++) items.push(readInlineValue(r, meta.inner_type!, meta.inner_meta!))
      return { num_keys_to_remove: removed, items }
    }
    case "IntProperty":    return r.i32()
    case "Int64Property":  return r.i64().toString()
    case "UInt32Property": return r.u32()
    case "UInt64Property": return r.u64().toString()
    case "FloatProperty":  return r.f32()
    case "DoubleProperty": return r.f64()
    case "StrProperty":
    case "NameProperty":
    case "ObjectProperty": return r.fstring()
    case "SoftObjectProperty": return { asset: r.fstring(), sub_path: r.fstring() }
    default: return { _raw: bytesToBase64(r.read(size)) }
  }
}

function readStructValue(r: Reader, structType: string, size: number): Any {
  switch (structType) {
    case "Vector":
    case "Vector3f":
      return size === 12
        ? { x: r.f32(), y: r.f32(), z: r.f32() }
        : { x: r.f64(), y: r.f64(), z: r.f64() }
    case "Rotator":
    case "Rotator3f":
      return size === 12
        ? { pitch: r.f32(), yaw: r.f32(), roll: r.f32() }
        : { pitch: r.f64(), yaw: r.f64(), roll: r.f64() }
    case "Quat":
    case "Quat4f":
      return size === 16
        ? { x: r.f32(), y: r.f32(), z: r.f32(), w: r.f32() }
        : { x: r.f64(), y: r.f64(), z: r.f64(), w: r.f64() }
    case "Color":       return { b: r.u8(), g: r.u8(), r: r.u8(), a: r.u8() }
    case "LinearColor": return { r: r.f32(), g: r.f32(), b: r.f32(), a: r.f32() }
    case "Guid":        return r.guid()
    case "DateTime":
    case "Timespan":    return r.i64().toString()
    case "IntPoint":    return { x: r.i32(), y: r.i32() }
    default:            return readProperties(r)
  }
}

function readArrayValue(r: Reader, innerType: string, innerMeta: TypeMeta): Any[] {
  const n = r.i32()
  const out: Any[] = []
  for (let i = 0; i < n; i++) out.push(readInlineValue(r, innerType, innerMeta))
  return out
}

function readMapValue(
  r: Reader,
  keyType: string,
  keyMeta: TypeMeta,
  valueType: string,
  valueMeta: TypeMeta,
): Any {
  const removed = r.i32()
  const n = r.i32()
  const items: Any[] = []
  for (let i = 0; i < n; i++) {
    items.push({
      key:   readInlineValue(r, keyType,   keyMeta),
      value: readInlineValue(r, valueType, valueMeta),
    })
  }
  return { num_keys_to_remove: removed, items }
}

function readInlineValue(r: Reader, type_: string, meta: TypeMeta): Any {
  switch (type_) {
    case "BoolProperty":   return r.u8() !== 0
    case "ByteProperty":   return r.u8()
    case "IntProperty":    return r.i32()
    case "Int64Property":  return r.i64().toString()
    case "UInt32Property": return r.u32()
    case "UInt64Property": return r.u64().toString()
    case "FloatProperty":  return r.f32()
    case "DoubleProperty": return r.f64()
    case "StrProperty":
    case "NameProperty":
    case "EnumProperty":
    case "ObjectProperty": return r.fstring()
    case "SoftObjectProperty": return { asset: r.fstring(), sub_path: r.fstring() }
    case "StructProperty": return readStructValue(r, meta.struct_type ?? "", 0)
    default: throw new Error(`inline read for ${type_}`)
  }
}

function readProperties(r: Reader): Any[] {
  const out: Any[] = []
  while (true) {
    const name = r.fstring()
    if (name === "None") break
    out.push(readProperty(r, name))
  }
  return out
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

function writeProperties(w: Writer, props: Any[]): void {
  for (const p of props) {
    w.fstring(p._name)
    writeProperty(w, p)
  }
  w.fstring("None")
}

function writeProperty(w: Writer, p: Any): void {
  const type_ = p._type as string
  w.fstring(type_)
  const value = writeValueBytes(p)
  w.write(base64ToBytes(p._meta_raw))
  w.i32(value.length)
  w.u8(0)
  w.write(value)
}

function writeValueBytes(p: Any): Uint8Array {
  if (p._raw !== undefined) return base64ToBytes(p._raw)
  const w = new Writer()
  writeValue(w, p._type, p._meta ?? {}, p.value)
  if (p._value_trailing !== undefined) w.write(base64ToBytes(p._value_trailing))
  return w.getValue()
}

function writeValue(w: Writer, type_: string, meta: TypeMeta, value: Any): void {
  switch (type_) {
    case "BoolProperty": w.u8(value ? 1 : 0); return
    case "ByteProperty":
      if (typeof value === "number") w.u8(value)
      else w.fstring(value)
      return
    case "EnumProperty": w.fstring(value); return
    case "StructProperty": writeStructValue(w, meta.struct_type ?? "", value); return
    case "ArrayProperty": {
      w.i32(value.length)
      for (const item of value) writeInlineValue(w, meta.inner_type!, meta.inner_meta!, item)
      return
    }
    case "MapProperty": {
      w.i32(value.num_keys_to_remove ?? 0)
      w.i32(value.items.length)
      for (const item of value.items) {
        writeInlineValue(w, meta.key_type!,   meta.key_meta!,   item.key)
        writeInlineValue(w, meta.value_type!, meta.value_meta!, item.value)
      }
      return
    }
    case "SetProperty": {
      w.i32(value.num_keys_to_remove ?? 0)
      w.i32(value.items.length)
      for (const item of value.items) writeInlineValue(w, meta.inner_type!, meta.inner_meta!, item)
      return
    }
    case "IntProperty":    w.i32(Number(value)); return
    case "Int64Property":  w.i64(toBigInt(value)); return
    case "UInt32Property": w.u32(Number(value)); return
    case "UInt64Property": w.u64(toBigInt(value)); return
    case "FloatProperty":  w.f32(Number(value)); return
    case "DoubleProperty": w.f64(Number(value)); return
    case "StrProperty":
    case "NameProperty":
    case "ObjectProperty": w.fstring(value); return
    case "SoftObjectProperty":
      w.fstring(value.asset)
      w.fstring(value.sub_path ?? "")
      return
  }
  if (value && typeof value === "object" && value._raw !== undefined) {
    w.write(base64ToBytes(value._raw))
    return
  }
  throw new Error(`write ${type_}`)
}

function writeStructValue(w: Writer, structType: string, value: Any): void {
  switch (structType) {
    case "Vector":
    case "Vector3f": {
      w.f32(value.x); w.f32(value.y); w.f32(value.z); return
    }
    case "Rotator":
    case "Rotator3f":
      w.f32(value.pitch); w.f32(value.yaw); w.f32(value.roll); return
    case "Quat":
    case "Quat4f":
      w.f32(value.x); w.f32(value.y); w.f32(value.z); w.f32(value.w); return
    case "Color":
      w.u8(value.b); w.u8(value.g); w.u8(value.r); w.u8(value.a); return
    case "LinearColor":
      w.f32(value.r); w.f32(value.g); w.f32(value.b); w.f32(value.a); return
    case "Guid":
      w.guid(value); return
    case "DateTime":
    case "Timespan":
      w.i64(toBigInt(value)); return
    case "IntPoint":
      w.i32(value.x); w.i32(value.y); return
    default:
      writeProperties(w, value); return
  }
}

function writeInlineValue(w: Writer, type_: string, meta: TypeMeta, value: Any): void {
  switch (type_) {
    case "BoolProperty":   w.u8(value ? 1 : 0); return
    case "ByteProperty":   w.u8(Number(value)); return
    case "IntProperty":    w.i32(Number(value)); return
    case "Int64Property":  w.i64(toBigInt(value)); return
    case "UInt32Property": w.u32(Number(value)); return
    case "UInt64Property": w.u64(toBigInt(value)); return
    case "FloatProperty":  w.f32(Number(value)); return
    case "DoubleProperty": w.f64(Number(value)); return
    case "StrProperty":
    case "NameProperty":
    case "EnumProperty":
    case "ObjectProperty": w.fstring(value); return
    case "SoftObjectProperty":
      w.fstring(value.asset); w.fstring(value.sub_path ?? ""); return
    case "StructProperty":
      writeStructValue(w, meta.struct_type ?? "", value); return
    default:
      throw new Error(`inline write for ${type_}`)
  }
}

function toBigInt(v: Any): bigint {
  if (typeof v === "bigint") return v
  if (typeof v === "string") return BigInt(v)
  return BigInt(v)
}

// ---------------------------------------------------------------------------
// GVAS file
// ---------------------------------------------------------------------------

export interface GvasFile {
  header: GvasHeader
  pre_properties: Uint8Array
  properties: Any[]
  trailing: Uint8Array
}

function parseGvas(data: Uint8Array): GvasFile {
  const r = new Reader(data)
  const header = readHeader(r)
  let pre = new Uint8Array(0)
  if (
    !r.plausibleFstringAt(r.p) &&
    r.p < r.length &&
    r.buf[r.p] === 0 &&
    r.plausibleFstringAt(r.p + 1)
  ) {
    pre = r.read(1)
  }
  const props = readProperties(r)
  const trailing = r.buf.subarray(r.p)
  return { header, pre_properties: pre, properties: props, trailing }
}

function serializeGvas(g: GvasFile): Uint8Array {
  const w = new Writer()
  writeHeader(w, g.header)
  w.write(g.pre_properties)
  writeProperties(w, g.properties)
  w.write(g.trailing)
  return w.getValue()
}

// ---------------------------------------------------------------------------
// Friendly view
// ---------------------------------------------------------------------------

const FNAME_SUFFIX_RE = /_\d+_[0-9A-Fa-f]{32}$/

export function stripFNameSuffix(name: string): string {
  return name.replace(FNAME_SUFFIX_RE, "")
}

function isPropertyList(v: Any): boolean {
  return Array.isArray(v) && v.every((p) => p && typeof p === "object" && typeof p._name === "string" && typeof p._type === "string")
}

function isInventoryEntry(entry: Any): boolean {
  if (!isPropertyList(entry) || entry.length !== 2) return false
  const byName: Record<string, Any> = {}
  for (const p of entry) byName[stripFNameSuffix(p._name)] = p
  return (
    byName.name && byName.name._type === "NameProperty" &&
    byName.amount && byName.amount._type === "IntProperty"
  )
}

function toFriendly(gvas: GvasFile): { tree: Any; unparsed: Record<string, string> } {
  const unparsed: Record<string, string> = {}
  const tree = friendlyFromProperties(gvas.properties, "", unparsed)
  return { tree, unparsed }
}

function friendlyFromProperties(props: Any[], path: string, unparsed: Record<string, string>): Any {
  const out: Record<string, Any> = {}
  for (const p of props) {
    const name = stripFNameSuffix(p._name)
    const here = path ? `${path}.${name}` : name
    if (p._parse_error) {
      unparsed[here] = p._parse_error
      continue
    }
    out[name] = friendlyValue(p._type, p._meta ?? {}, p.value, here, unparsed)
  }
  return out
}

function friendlyValue(type_: string, meta: TypeMeta, value: Any, path: string, unparsed: Record<string, string>): Any {
  switch (type_) {
    case "StructProperty":
      return friendlyStruct(meta.struct_type ?? "", value, path, unparsed)
    case "ArrayProperty":
      return friendlyArray(value, meta, path, unparsed)
    case "MapProperty":
      return friendlyMap(value, meta, path, unparsed)
    case "SetProperty":
      return {
        items: (value.items as Any[]).map((it, i) =>
          friendlyInline(meta.inner_type!, meta.inner_meta!, it, `${path}[${i}]`, unparsed)
        ),
      }
    default:
      return value
  }
}

function friendlyStruct(_structType: string, value: Any, path: string, unparsed: Record<string, string>): Any {
  if (isPropertyList(value)) return friendlyFromProperties(value, path, unparsed)
  return value
}

function friendlyArray(value: Any[], meta: TypeMeta, path: string, unparsed: Record<string, string>): Any {
  if (
    meta.inner_type === "StructProperty" &&
    value.length > 0 &&
    value.every(isInventoryEntry)
  ) {
    const flat: Record<string, Any> = {}
    for (const entry of value) {
      const byName: Record<string, Any> = {}
      for (const p of entry as Any[]) byName[stripFNameSuffix(p._name)] = p
      flat[byName.name.value as string] = byName.amount.value
    }
    return flat
  }
  return value.map((v, i) =>
    meta.inner_type === "StructProperty"
      ? friendlyStruct(meta.inner_meta?.struct_type ?? "", v, `${path}[${i}]`, unparsed)
      : v
  )
}

function friendlyMap(value: Any, meta: TypeMeta, path: string, unparsed: Record<string, string>): Any {
  const items = value.items as Any[]
  const scalarKeys = items.every((it) => {
    const t = typeof it.key
    return t === "string" || t === "number" || t === "boolean"
  })
  if (scalarKeys) {
    const flat: Record<string, Any> = {}
    if (value.num_keys_to_remove) flat._num_keys_to_remove = value.num_keys_to_remove
    for (const it of items) {
      const v = friendlyInline(meta.value_type!, meta.value_meta!, it.value, `${path}[${it.key}]`, unparsed)
      flat[String(it.key)] = v
    }
    return flat
  }
  return {
    num_keys_to_remove: value.num_keys_to_remove ?? 0,
    items: items.map((it, i) => ({
      key: it.key,
      value: friendlyInline(meta.value_type!, meta.value_meta!, it.value, `${path}[${i}]`, unparsed),
    })),
  }
}

function friendlyInline(type_: string, meta: TypeMeta, value: Any, path: string, unparsed: Record<string, string>): Any {
  if (type_ === "StructProperty") return friendlyStruct(meta.struct_type ?? "", value, path, unparsed)
  return value
}

// ---------------------------------------------------------------------------
// Graft (apply friendly value edits to the raw scaffold in-place)
// ---------------------------------------------------------------------------

function graftProperties(props: Any[], friendly: Any, path: string): void {
  if (!friendly || typeof friendly !== "object") return
  const byName: Record<string, Any> = {}
  for (const p of props) byName[stripFNameSuffix(p._name)] = p
  for (const [name, v] of Object.entries(friendly)) {
    if (name === "_unparsed" || name === "_num_keys_to_remove") continue
    const p = byName[name]
    if (!p) {
      console.warn(`graft: unknown property "${path ? path + "." : ""}${name}" — skipping`)
      continue
    }
    if (p._parse_error) continue
    graftValue(p, v, path ? `${path}.${name}` : name)
  }
}

function graftValue(p: Any, friendly: Any, path: string): void {
  const type_ = p._type as string
  const meta = (p._meta ?? {}) as TypeMeta
  switch (type_) {
    case "StructProperty": {
      if (isPropertyList(p.value)) graftProperties(p.value, friendly, path)
      else p.value = friendly
      return
    }
    case "ArrayProperty": {
      graftArray(p, meta, friendly, path)
      return
    }
    case "MapProperty": {
      graftMap(p, meta, friendly, path)
      return
    }
    case "SetProperty": {
      if (friendly && Array.isArray(friendly.items)) {
        const existing = p.value.items as Any[]
        if (friendly.items.length !== existing.length) {
          throw new Error(`set length mismatch at ${path}: cannot add/remove items`)
        }
        for (let i = 0; i < existing.length; i++) {
          existing[i] = graftInline(meta.inner_type!, meta.inner_meta!, existing[i], friendly.items[i], `${path}.items[${i}]`)
        }
      }
      return
    }
    default:
      p.value = friendly
  }
}

function graftArray(p: Any, meta: TypeMeta, friendly: Any, path: string): void {
  const value = p.value as Any[]
  if (
    meta.inner_type === "StructProperty" &&
    value.length > 0 &&
    value.every(isInventoryEntry) &&
    friendly && typeof friendly === "object" && !Array.isArray(friendly)
  ) {
    const seen = new Set<string>()
    for (const entry of value) {
      const props: Any[] = entry
      const nameProp = props.find((q) => stripFNameSuffix(q._name) === "name")!
      const amountProp = props.find((q) => stripFNameSuffix(q._name) === "amount")!
      const key = nameProp.value as string
      if (Object.prototype.hasOwnProperty.call(friendly, key)) {
        amountProp.value = Number(friendly[key])
        seen.add(key)
      }
    }
    for (const key of Object.keys(friendly)) {
      if (!seen.has(key)) {
        console.warn(`graft: inventory key "${key}" at ${path} not present in original save — skipping`)
      }
    }
    return
  }
  if (!Array.isArray(friendly)) {
    throw new Error(`array shape mismatch at ${path}: friendly value is not an array`)
  }
  if (friendly.length !== value.length) {
    throw new Error(`array length mismatch at ${path}: cannot add/remove items (have ${value.length}, want ${friendly.length})`)
  }
  for (let i = 0; i < value.length; i++) {
    value[i] = graftInline(meta.inner_type!, meta.inner_meta!, value[i], friendly[i], `${path}[${i}]`)
  }
}

function graftMap(p: Any, meta: TypeMeta, friendly: Any, path: string): void {
  const items = p.value.items as Any[]
  if (friendly && typeof friendly === "object" && !Array.isArray(friendly) && !Array.isArray(friendly.items)) {
    const seen = new Set<string>()
    for (const it of items) {
      const k = String(it.key)
      if (Object.prototype.hasOwnProperty.call(friendly, k)) {
        it.value = graftInline(meta.value_type!, meta.value_meta!, it.value, friendly[k], `${path}[${k}]`)
        seen.add(k)
      }
    }
    for (const k of Object.keys(friendly)) {
      if (k === "_num_keys_to_remove" || k === "_unparsed") continue
      if (!seen.has(k)) {
        console.warn(`graft: map key "${k}" at ${path} not present in original save — skipping`)
      }
    }
    if (typeof friendly._num_keys_to_remove === "number") {
      p.value.num_keys_to_remove = friendly._num_keys_to_remove
    }
    return
  }
  if (friendly && Array.isArray(friendly.items)) {
    if (friendly.items.length !== items.length) {
      throw new Error(`map length mismatch at ${path}: cannot add/remove keys`)
    }
    for (let i = 0; i < items.length; i++) {
      items[i].value = graftInline(meta.value_type!, meta.value_meta!, items[i].value, friendly.items[i].value, `${path}[${i}]`)
    }
    if (typeof friendly.num_keys_to_remove === "number") {
      p.value.num_keys_to_remove = friendly.num_keys_to_remove
    }
  }
}

function graftInline(type_: string, _meta: TypeMeta, original: Any, friendly: Any, path: string): Any {
  if (type_ === "StructProperty") {
    if (isPropertyList(original)) {
      graftProperties(original, friendly, path)
      return original
    }
    return friendly
  }
  return friendly
}

// ---------------------------------------------------------------------------
// Public browser API
// ---------------------------------------------------------------------------

export interface FFWSave {
  fileName: string
  steamId: string
  iv: Uint8Array
  raw: GvasFile
  friendly: Record<string, Any>
  unparsed: Record<string, string>
}

export async function decodeSaveFromFile(file: File): Promise<FFWSave> {
  const steamId = steamIdFromFileName(file.name)
  const key = await deriveKey(steamId + PARTY_SUFFIX)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const iv = bytes.slice(0, 16)
  const plaintext = decryptSave(bytes, key)
  const raw = parseGvas(plaintext)
  const { tree, unparsed } = toFriendly(raw)
  return {
    fileName: file.name,
    steamId,
    iv,
    raw,
    friendly: tree,
    unparsed,
  }
}

export async function encodeSaveToBlob(save: FFWSave): Promise<Blob> {
  const key = await deriveKey(save.steamId + PARTY_SUFFIX)
  // Graft current friendly tree onto the preserved raw scaffold.
  graftProperties(save.raw.properties, save.friendly, "")
  const plaintext = serializeGvas(save.raw)
  const out = encryptSave(plaintext, key, save.iv)
  return new Blob([out as BlobPart], { type: "application/octet-stream" })
}
