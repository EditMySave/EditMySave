/**
 * Minecraft Dungeons save file codec (browser-compatible)
 *
 * Format (ported from MCDSaveEdit / DungeonTools C# reference):
 *   [8-byte magic: 44 30 30 31 00 00 00 00] [AES-256-ECB ciphertext]
 *
 * Plaintext is UTF-8 JSON, padded with 0x00 bytes to a 16-byte boundary
 * (PaddingMode.Zeros). The hardcoded AES key lives in the game binaries
 * and is the same for every save on every platform.
 *
 * Browser Web Crypto does not support AES-ECB, so we synthesize ECB on
 * top of AES-CBC with a zero IV (see aesEcbEncryptBlock / aesEcbDecryptBlock).
 */

/** 8-byte file magic identifying an encrypted MCD save. */
const MAGIC = new Uint8Array([0x44, 0x30, 0x30, 0x31, 0x00, 0x00, 0x00, 0x00])

/** AES-256 key extracted from the Minecraft Dungeons binaries. */
const KEY = new Uint8Array([
  0x5c, 0xeb, 0x9d, 0x0a, 0xeb, 0xb9, 0x5a, 0xc0, 0x27, 0x0b, 0x0a, 0xf6, 0x75, 0x3d, 0xfc, 0x0e,
  0xe3, 0xe6, 0x8b, 0xb6, 0x94, 0x79, 0x02, 0x0f, 0x24, 0x30, 0xe2, 0xea, 0x00, 0x2b, 0xd4, 0xc9,
])

const BLOCK_SIZE = 16
const ZERO_IV = new Uint8Array(BLOCK_SIZE)
const PKCS7_FULL_BLOCK = new Uint8Array(BLOCK_SIZE).fill(BLOCK_SIZE) // 0x10 × 16

// ── Type definitions (mirror C# ProfileSaveFile) ────────────────────────

export type Rarity = "Common" | "Rare" | "Unique"

export interface Enchantment {
  id: string
  level: number
  investedPoints?: number
}

export interface Armorproperty {
  id: string
  rarity: Rarity
}

export interface Item {
  type: string
  power: number
  rarity: Rarity
  enchantments?: Enchantment[]
  armorproperties?: Armorproperty[]
  netheriteEnchant?: Enchantment | null
  equipmentSlot?: string
  inventoryIndex?: number
  markedNew?: boolean
  upgraded?: boolean
  gifted?: boolean
  cloned?: boolean
  modified?: boolean
  timesmodified?: number
  [key: string]: unknown
}

export interface Currency {
  type: string
  count: number
}

export interface Cosmetic {
  id: string
  type: string
}

export interface Difficulties {
  unlocked?: string
  selected?: string | null
  announced?: string | null
}

export interface ThreatLevels {
  unlocked?: string | null
}

export interface Progress {
  completedDifficulty?: string
  completedEndlessStruggle?: number
  completedThreatLevel?: string
}

export interface MCDSave {
  name?: string
  playerId?: string
  uniqueSaveId?: string
  skin?: string
  xp?: number
  totalGearPower?: number
  customized?: boolean
  clone?: boolean
  items?: Item[]
  storageChestItems?: Item[]
  currency?: Currency[]
  cosmetics?: Cosmetic[]
  cosmeticsEverEquipped?: string[]
  difficulties?: Difficulties | null
  threatLevels?: ThreatLevels | null
  progress?: Record<string, Progress> | null
  progressStatCounters?: Record<string, number>
  mob_kills?: Record<string, number> | null
  creationDate?: string
  timestamp?: number
  version?: number
  legendaryStatus?: number | null
  bonusPrerequisites?: string[]
  itemsFound?: string[]
  currenciesFound?: string[]
  progressionKeys?: string[]
  videosPlayed?: string[]
  finishedObjectiveTags?: Record<string, number>
  /** Index signature so unknown fields round-trip cleanly. */
  [key: string]: unknown
}

// ── AES-256-ECB shim built on top of Web Crypto AES-CBC ────────────────────

async function importAesKey(raw: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  return await crypto.subtle.importKey("raw", raw, { name: "AES-CBC" }, false, [usage])
}

/** Encrypt a single 16-byte block under AES-ECB by abusing CBC with IV=0. */
async function aesEcbEncryptBlock(block: Uint8Array, encryptKey: CryptoKey): Promise<Uint8Array> {
  // CBC with IV=0 on a 16-byte input produces:
  //   out[0..16]  = AES_K(block ⊕ 0)        ← exactly the ECB encryption
  //   out[16..32] = AES_K(0x10×16 ⊕ out[0..16])  (PKCS7 padding tail we discard)
  const out = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-CBC", iv: ZERO_IV }, encryptKey, block),
  )
  return out.slice(0, BLOCK_SIZE)
}

/** Decrypt a single 16-byte block under AES-ECB by abusing CBC with IV=0. */
async function aesEcbDecryptBlock(
  block: Uint8Array,
  encryptKey: CryptoKey,
  decryptKey: CryptoKey,
): Promise<Uint8Array> {
  // We want P = AES_K⁻¹(block).
  // CBC decrypt validates PKCS7 padding, so build a synthetic 32-byte input
  //   [block || X]
  // such that the second decrypted plaintext block looks like 0x10×16:
  //   D(X) ⊕ block == 0x10×16  ⇒  X = E_K(block ⊕ 0x10×16)
  // Then with IV=0 the first decrypted block is D(block) = ECB decryption.
  const xPlain = new Uint8Array(BLOCK_SIZE)
  for (let i = 0; i < BLOCK_SIZE; i++) xPlain[i] = block[i] ^ PKCS7_FULL_BLOCK[i]
  const X = await aesEcbEncryptBlock(xPlain, encryptKey)

  const input = new Uint8Array(BLOCK_SIZE * 2)
  input.set(block, 0)
  input.set(X, BLOCK_SIZE)

  const out = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-CBC", iv: ZERO_IV }, decryptKey, input),
  )
  // CBC strips the padding block, leaving exactly 16 bytes — the ECB decryption.
  return out
}

/** ECB-encrypt arbitrary plaintext (length must already be a multiple of 16). */
async function aesEcbEncrypt(plaintext: Uint8Array, rawKey: Uint8Array): Promise<Uint8Array> {
  if (plaintext.length % BLOCK_SIZE !== 0) {
    throw new Error(`aesEcbEncrypt: length ${plaintext.length} not multiple of ${BLOCK_SIZE}`)
  }
  const encryptKey = await importAesKey(rawKey, "encrypt")
  const out = new Uint8Array(plaintext.length)
  for (let off = 0; off < plaintext.length; off += BLOCK_SIZE) {
    const ct = await aesEcbEncryptBlock(plaintext.subarray(off, off + BLOCK_SIZE), encryptKey)
    out.set(ct, off)
  }
  return out
}

/** ECB-decrypt arbitrary ciphertext (length must be a multiple of 16). */
async function aesEcbDecrypt(ciphertext: Uint8Array, rawKey: Uint8Array): Promise<Uint8Array> {
  if (ciphertext.length % BLOCK_SIZE !== 0) {
    throw new Error(`aesEcbDecrypt: length ${ciphertext.length} not multiple of ${BLOCK_SIZE}`)
  }
  const encryptKey = await importAesKey(rawKey, "encrypt")
  const decryptKey = await importAesKey(rawKey, "decrypt")
  const out = new Uint8Array(ciphertext.length)
  for (let off = 0; off < ciphertext.length; off += BLOCK_SIZE) {
    const pt = await aesEcbDecryptBlock(
      ciphertext.subarray(off, off + BLOCK_SIZE),
      encryptKey,
      decryptKey,
    )
    out.set(pt, off)
  }
  return out
}

// ── Codec ───────────────────────────────────────────────────────────────

function hasMagic(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC.length) return false
  for (let i = 0; i < MAGIC.length; i++) if (bytes[i] !== MAGIC[i]) return false
  return true
}

/**
 * Extract the first complete JSON object from a string. Mirrors
 * ProfileParser.Read in the C# reference: walks character-by-character,
 * skips control characters, tracks brace depth, stops at the first matching
 * close brace. This handles PS4/Switch saves that contain duplicated trailing
 * data after the cipher's zero padding.
 */
function extractFirstJsonObject(text: string): string {
  const out: string[] = []
  let depth = 0
  let started = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const code = text.charCodeAt(i)
    // Skip ASCII control characters (0x00–0x1F and 0x7F).
    if (code < 0x20 || code === 0x7f) continue

    if (c === "{") {
      depth++
      started = true
    } else if (c === "}") {
      depth--
      if (started && depth === 0) {
        out.push(c)
        break
      }
    }
    out.push(c)
  }
  return out.join("")
}

/** Decode an encrypted MCD save file from a browser File object. */
export async function decodeSaveFromFile(file: File): Promise<MCDSave> {
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  if (!hasMagic(bytes)) {
    throw new Error("Not an encrypted Minecraft Dungeons save (missing D001 magic)")
  }

  const ciphertext = bytes.subarray(MAGIC.length)
  if (ciphertext.length === 0 || ciphertext.length % BLOCK_SIZE !== 0) {
    throw new Error(
      `Ciphertext length ${ciphertext.length} is not a positive multiple of ${BLOCK_SIZE}`,
    )
  }

  const plain = await aesEcbDecrypt(ciphertext, KEY)

  // PaddingMode.Zeros: truncate at the first 0x00 byte. JSON itself contains
  // no zero bytes, so this safely strips both the zero pad and any post-pad
  // junk that the cipher emitted from random uninitialized memory on console.
  let end = plain.length
  for (let i = 0; i < plain.length; i++) {
    if (plain[i] === 0x00) {
      end = i
      break
    }
  }

  const text = new TextDecoder("utf-8").decode(plain.subarray(0, end))
  const jsonText = extractFirstJsonObject(text)
  if (!jsonText) {
    throw new Error("Decryption produced no JSON content (wrong key?)")
  }

  try {
    return JSON.parse(jsonText) as MCDSave
  } catch (e) {
    throw new Error(`Failed to parse decrypted JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** Encode a save object back to an encrypted MCD save Blob. */
export async function encodeSaveToBlob(save: MCDSave): Promise<Blob> {
  const jsonText = JSON.stringify(save)
  const jsonBytes = new TextEncoder().encode(jsonText)

  // Right-pad with 0x00 to next 16-byte boundary. PaddingMode.Zeros adds no
  // padding when input is already aligned — match that behavior.
  const padLen = (BLOCK_SIZE - (jsonBytes.length % BLOCK_SIZE)) % BLOCK_SIZE
  const padded = new Uint8Array(jsonBytes.length + padLen)
  padded.set(jsonBytes, 0)
  // (Tail bytes are already 0 from Uint8Array construction.)

  const ciphertext = await aesEcbEncrypt(padded, KEY)

  const out = new Uint8Array(MAGIC.length + ciphertext.length)
  out.set(MAGIC, 0)
  out.set(ciphertext, MAGIC.length)

  return new Blob([out], { type: "application/octet-stream" })
}

// ── Helpers (XP ↔ level, power ↔ level) ────────────────────────────────
// Ported from MCDSaveEdit/Logic/GameCalculator.cs

export function levelFromXp(xp: number): number {
  if (xp <= 0) return 1
  const result = (1 / 30) * (Math.sqrt(3 * xp + 100) + 20)
  return Math.floor(result)
}

export function xpFromLevel(level: number): number {
  if (level <= 1) return 0
  return 100 * (level - 1) * (3 * level - 1)
}

export function levelFromPower(power: number): number {
  if (power <= 0) return 0
  return Math.floor((Math.max(1, power) - 1 + 0.00001) * 10) + 1
}

export function powerFromLevel(level: number): number {
  if (level <= 0) return 0
  return (Math.max(1, level) - 1) / 10 + 1 + 0.00001
}
