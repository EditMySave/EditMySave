/**
 * Windblown Save File Codec (Browser-compatible)
 *
 * Format: MTWB header + GZIP(JSON metadata) + gap + GZIP(binary game state)
 *
 * Ported from the Deno-based save_io.ts to use browser APIs:
 * - pako for GZIP compression/decompression
 * - crypto.subtle for SHA-1 hashing
 * - File API for input, Blob for output
 */

import pako from "pako"

// ── Constants ───────────────────────────────────────────────────────────

const MTWB_MAGIC = new Uint8Array([0x4d, 0x54, 0x57, 0x42]) // "MTWB"
const GZIP_MAGIC = new Uint8Array([0x1f, 0x8b, 0x08])
const CURRENCY_ANCHOR = new Uint8Array([0x00, 0x00, 0x00, 0x68])
const CURRENCY_SHIFT = 12
const CURRENCY_COUNT = 5
const BITSET_SIZE = 16 // BitSet128 = 16 bytes
const FLAG_ENUM_BASE = 9 // First flag enum value
const FLAG_BIT_OFFSET = 1 // Enum N stored at bit N+1
const GZIP_HEADER_SIZE = 10
const SHA1_SIZE = 20

// ── Meta flag name mapping (bit_position → name) ───────────────────────
// Extracted from global-metadata.dat. Enum values start at 9.
// Bit position = enum_value + 1.

export const META_FLAG_NAMES: string[] = [
  /* enum  9, bit 10 */ "UnlockedAWeapon",
  /* enum 10, bit 11 */ "SawAMiniBossOrBoss",
  /* enum 11, bit 12 */ "UnlockedSelectSpecies",
  /* enum 12, bit 13 */ "FoundABlueprint",
  /* enum 13, bit 14 */ "KilledAMiniBossOrBoss",
  /* enum 14, bit 15 */ "VisitedAShop",
  /* enum 15, bit 16 */ "UnlockedTrialChest",
  /* enum 16, bit 17 */ "CanAccessHub",
  /* enum 17, bit 18 */ "AccessedHub",
  /* enum 18, bit 19 */ "KilledABoss",
  /* enum 19, bit 20 */ "SyncAttackLvl1",
  /* enum 20, bit 21 */ "ExtraHealerEffectLvl1",
  /* enum 21, bit 22 */ "ExtraHealerEffectLvl2",
  /* enum 22, bit 23 */ "ExtraHealerEffectLvl3",
  /* enum 23, bit 24 */ "UnawareDMGIncreaseLvl1",
  /* enum 24, bit 25 */ "UnawareDMGIncreaseLvl2",
  /* enum 25, bit 26 */ "UnawareDMGIncreaseLvl3",
  /* enum 26, bit 27 */ "RunCurrencyReserveLvl1",
  /* enum 27, bit 28 */ "RunCurrencyReserveLvl2",
  /* enum 28, bit 29 */ "RunCurrencyReserveLvl3",
  /* enum 29, bit 30 */ "GiverReroll",
  /* enum 30, bit 31 */ "HealFlaskEffectLvl1",
  /* enum 31, bit 32 */ "HealFlaskEffectLvl2",
  /* enum 32, bit 33 */ "FoodHealthEffectLvl1",
  /* enum 33, bit 34 */ "FoodHealthEffectLvl2",
  /* enum 34, bit 35 */ "FoodCookingEffectLvl1",
  /* enum 35, bit 36 */ "FoodCookingEffectLvl2",
  /* enum 36, bit 37 */ "BetterJars",
  /* enum 37, bit 38 */ "CanPublicMultiplayer",
  /* enum 38, bit 39 */ "TalkedToAmi",
  /* enum 39, bit 40 */ "AmiCanDecryptMemories",
  /* enum 40, bit 41 */ "SawABoss",
  /* enum 41, bit 42 */ "StartedARun",
  /* enum 42, bit 43 */ "UnlockedAPermanentUpgrade",
  /* enum 43, bit 44 */ "DidEatFood",
  /* enum 44, bit 45 */ "UnlockedHealFlask",
  /* enum 45, bit 46 */ "UnlockedStartGiver",
  /* enum 46, bit 47 */ "UsedHealer",
  /* enum 47, bit 48 */ "FoundAGearBlueprint",
  /* enum 48, bit 49 */ "MobJuiceSkillRefill",
  /* enum 49, bit 50 */ "UnlockedChallenge",
  /* enum 50, bit 51 */ "UnlockedRecyclingLvl1",
  /* enum 51, bit 52 */ "HealFlaskChargeLvl1",
  /* enum 52, bit 53 */ "HealFlaskChargeLvl2",
  /* enum 53, bit 54 */ "HealFlaskChargeLvl3",
  /* enum 54, bit 55 */ "UnlockedOptionalElite",
  /* enum 55, bit 56 */ "UnlockedStartWeaponLvl1",
  /* enum 56, bit 57 */ "UnlockedStartTrinketLvl1",
  /* enum 57, bit 58 */ "UnlockedStartTrinketLvl2",
  /* enum 58, bit 59 */ "CanAccessSecrets",
  /* enum 59, bit 60 */ "AlterattackLvl1",
  /* enum 60, bit 61 */ "UnlockedWeaponTraining",
  /* enum 61, bit 62 */ "UnlockedStartWeaponLvl2",
  /* enum 62, bit 63 */ "UnlockedRecyclingLvl2",
  /* enum 63, bit 64 */ "GotHubSecretMetaCurrency",
  /* enum 64, bit 65 */ "FoundAMemoryBlueprint",
  /* enum 65, bit 66 */ "UnlockedGiftSlotLvl1",
  /* enum 66, bit 67 */ "UnlockedGiftSlotLvl2",
  /* enum 67, bit 68 */ "UnlockedEnemyVariantsLv1",
  /* enum 68, bit 69 */ "UnlockedEnemyVariantsLv2",
  /* enum 69, bit 70 */ "UnlockedCogGates",
  /* enum 70, bit 71 */ "ReachedPathChoice",
  /* enum 71, bit 72 */ "ReachedArena",
  /* enum 72, bit 73 */ "ReachedPath3Choices",
  /* enum 73, bit 74 */ "HasPermBackstabBonus",
  /* enum 74, bit 75 */ "DiedAfterFirstMemoryGiver",
  /* enum 75, bit 76 */ "UnlockedATeamMove",
  /* enum 76, bit 77 */ "GotAmiUnlockingChip",
  /* enum 77, bit 78 */ "TalkedToCuprik",
  /* enum 78, bit 79 */ "SyncAttackLvl2",
  /* enum 79, bit 80 */ "UnlockedBangerPulsor",
  /* enum 80, bit 81 */ "UnlockedHexGiver",
  /* enum 81, bit 82 */ "RescuedSigourney",
  /* enum 82, bit 83 */ "TalkedToSigourney",
  /* enum 83, bit 84 */ "PerpetualFlagAlphaPlayer",
  /* enum 84, bit 85 */ "PerpetualFlagDemoPlayer",
  /* enum 85, bit 86 */ "PerpetualFlagSuperEarlyAccessPlayer",
  /* enum 86, bit 87 */ "UnlockedNewGamePlus",
  /* enum 87, bit 88 */ "GotTeleportToTeamTutorial",
  /* enum 88, bit 89 */ "UnlockedEndlessMode",
  /* enum 89, bit 90 */ "UnlockedShopForge",
  /* enum 90, bit 91 */ "PlentierShopLvl1",
  /* enum 91, bit 92 */ "PlentierShopLvl2",
  /* enum 92, bit 93 */ "BuyableBoosts",
  /* enum 93, bit 94 */ "UnlockedTrinketTraining",
  /* enum 94, bit 95 */ "UnlockedGiftTraining",
  /* enum 95, bit 96 */ "GotEmoteTutorial",
  /* enum 96, bit 97 */ "UnlockedPaidEquippedBoonLvl1",
  /* enum 97, bit 98 */ "BoonDeckLvl1",
  /* enum 98, bit 99 */ "UnlockedFullBoonDeckPulsorSlot",
  /* enum 99, bit100 */ "UnlockedMetaCurrencyExchange",
  /* enum100, bit101 */ "UnlockedRarityLvl1",
  /* enum101, bit102 */ "HexGiverCanAppear",
  /* enum102, bit103 */ "ReachedMamaChildReward",
  /* enum103, bit104 */ "UnlockedBackpackLvl1",
  /* enum104, bit105 */ "UnlockedPlayerRemains",
  /* enum105, bit106 */ "UnlockedPulsorSlotLvl1",
  /* enum106, bit107 */ "UnlockedPulsorSlotLvl2",
  /* enum107, bit108 */ "UnlockedPulsorStoneFeeding",
  /* enum108, bit109 */ "UnlockedPulsorDustFeeding",
  /* enum109, bit110 */ "UnlockedPulsorShardFeeding",
  /* enum110, bit111 */ "UnlockedPulsorFragmentFeeding",
  /* enum111, bit112 */ "UnlockedPulsorStoneUpgradeLvl1",
  /* enum112, bit113 */ "UnlockedPulsorStoneUpgradeLvl2",
  /* enum113, bit114 */ "UnlockedStoneCheaperUpgradeLvl1",
  /* enum114, bit115 */ "UnlockedStoneCheaperUpgradeLvl2",
  /* enum115, bit116 */ "UnlockedRareAffixesLvl1",
  /* enum116, bit117 */ "UnlockedTeamMoveAlterattackEffect",
  /* enum117, bit118 */ "UnlockedPulsorEffects",
  /* enum118, bit119 */ "UnlockedPaidEquippedBoonLvl2",
  /* enum119, bit120 */ "UnlockedBiomeIncentivization",
  /* enum120, bit121 */ "UnlockedRarityLvl2",
  /* enum121, bit122 */ "UnlockedRarityLvl3",
  /* enum122, bit123 */ "UnlockedRareAffixesLvl2",
  /* enum123, bit124 */ "FinishedRarity",
]

// ── Interfaces ──────────────────────────────────────────────────────────

export interface PlayerMeta {
  PlayerName: string
  LocalIndex: number | null
  PlayerId: string
  Uid: string | null
  UserId: string
  BackDevice: string
  BackHash: string
  Serial: number
  LastUpdate: string
  MetaUpdate: string
  FileName: string
}

export interface Currencies {
  cogs: number
  memoniteDust: number
  memoniteShard: number
  memoniteFragment: number
  obsidianMemonite: number
}

export type MetaFlags = Record<string, boolean>

export interface WindblownSave {
  metadata: PlayerMeta
  currencies: Currencies
  metaFlags: MetaFlags
  _raw: Uint8Array
  _block2Decompressed: Uint8Array
  _block1GzipOffset: number
  _block2GzipOffset: number
  _gapStaticBytes: Uint8Array
  _currencyOffset: number
  _metaFlagsOffset: number
}

// ── Compression helpers ─────────────────────────────────────────────────

function gzipDecompressWithTrailing(data: Uint8Array): Uint8Array {
  return pako.inflateRaw(data.slice(GZIP_HEADER_SIZE))
}

function gzipDecompress(data: Uint8Array): Uint8Array {
  return pako.ungzip(data)
}

function gzipCompress(data: Uint8Array): Uint8Array {
  return pako.gzip(data)
}

async function sha1(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-1", data)
  return new Uint8Array(digest)
}

// ── Binary helpers ──────────────────────────────────────────────────────

function findBytes(data: Uint8Array, needle: Uint8Array, start = 0): number {
  outer: for (let i = start; i <= data.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (data[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

function findAllGzipOffsets(data: Uint8Array): number[] {
  const offsets: number[] = []
  let pos = 0
  while (pos < data.length - 2) {
    const found = findBytes(data, GZIP_MAGIC, pos)
    if (found === -1) break
    offsets.push(found)
    pos = found + 1
  }
  return offsets
}

// ── Currency search ─────────────────────────────────────────────────────

function findCurrencyOffset(block2: Uint8Array): number {
  const view = new DataView(block2.buffer, block2.byteOffset, block2.byteLength)
  let pos = 0

  while (pos < block2.length - (4 + CURRENCY_COUNT * 4 + 4)) {
    const anchorPos = findBytes(block2, CURRENCY_ANCHOR, pos)
    if (anchorPos === -1) break

    const currStart = anchorPos + 4

    const vals: number[] = []
    let valid = true
    for (let i = 0; i < CURRENCY_COUNT; i++) {
      const raw = view.getUint32(currStart + i * 4, true)
      const val = raw >> CURRENCY_SHIFT
      if (val < 0 || val > 100_000) {
        valid = false
        break
      }
      if ((raw & 0xfff) !== 0) {
        valid = false
        break
      }
      vals.push(val)
    }

    if (!valid) {
      pos = anchorPos + 1
      continue
    }

    const zeroSlot = view.getUint32(currStart + CURRENCY_COUNT * 4, true)
    if (zeroSlot !== 0) {
      pos = anchorPos + 1
      continue
    }

    return currStart
  }

  throw new Error("Currency anchor pattern not found in block 2 data")
}

function readCurrencies(block2: Uint8Array, offset: number): Currencies {
  const view = new DataView(block2.buffer, block2.byteOffset, block2.byteLength)
  return {
    cogs: view.getUint32(offset, true) >> CURRENCY_SHIFT,
    memoniteDust: view.getUint32(offset + 4, true) >> CURRENCY_SHIFT,
    memoniteShard: view.getUint32(offset + 8, true) >> CURRENCY_SHIFT,
    memoniteFragment: view.getUint32(offset + 12, true) >> CURRENCY_SHIFT,
    obsidianMemonite: view.getUint32(offset + 16, true) >> CURRENCY_SHIFT,
  }
}

function writeCurrencies(block2: Uint8Array, offset: number, currencies: Currencies): void {
  const view = new DataView(block2.buffer, block2.byteOffset, block2.byteLength)
  view.setUint32(offset, currencies.cogs << CURRENCY_SHIFT, true)
  view.setUint32(offset + 4, currencies.memoniteDust << CURRENCY_SHIFT, true)
  view.setUint32(offset + 8, currencies.memoniteShard << CURRENCY_SHIFT, true)
  view.setUint32(offset + 12, currencies.memoniteFragment << CURRENCY_SHIFT, true)
  view.setUint32(offset + 16, currencies.obsidianMemonite << CURRENCY_SHIFT, true)
}

// ── Meta flags (BitSet128) ──────────────────────────────────────────────

function findMetaFlagsOffset(block2: Uint8Array, searchFrom: number): number {
  for (let i = searchFrom; i < block2.length - (8 + BITSET_SIZE); i++) {
    let allZero = true
    for (let j = 0; j < 8; j++) {
      if (block2[i + j] !== 0) {
        allZero = false
        break
      }
    }
    if (!allZero) continue

    const bitsetStart = i + 8
    let setBits = 0
    for (let j = 0; j < BITSET_SIZE; j++) {
      let b = block2[bitsetStart + j]
      while (b) {
        setBits += b & 1
        b >>= 1
      }
    }
    if (setBits >= 10 && setBits <= 128) {
      return bitsetStart
    }
  }
  throw new Error("Meta flags bitset not found in block 2 data")
}

function readMetaFlags(block2: Uint8Array, offset: number): MetaFlags {
  const flags: MetaFlags = {}
  for (let i = 0; i < META_FLAG_NAMES.length; i++) {
    const enumVal = FLAG_ENUM_BASE + i
    const bitPos = enumVal + FLAG_BIT_OFFSET
    const byteIdx = bitPos >> 3
    const bitIdx = bitPos & 7
    const isSet = byteIdx < BITSET_SIZE && (block2[offset + byteIdx] & (1 << bitIdx)) !== 0
    flags[META_FLAG_NAMES[i]] = isSet
  }
  return flags
}

function writeMetaFlags(block2: Uint8Array, offset: number, flags: MetaFlags): void {
  for (let i = 0; i < META_FLAG_NAMES.length; i++) {
    const name = META_FLAG_NAMES[i]
    if (!(name in flags)) continue
    const enumVal = FLAG_ENUM_BASE + i
    const bitPos = enumVal + FLAG_BIT_OFFSET
    const byteIdx = bitPos >> 3
    const bitIdx = bitPos & 7
    if (byteIdx >= BITSET_SIZE) continue
    if (flags[name]) {
      block2[offset + byteIdx] |= 1 << bitIdx
    } else {
      block2[offset + byteIdx] &= ~(1 << bitIdx)
    }
  }
}

// ── Decode ──────────────────────────────────────────────────────────────

export async function decodeSaveFromFile(file: File): Promise<WindblownSave> {
  const arrayBuffer = await file.arrayBuffer()
  const raw = new Uint8Array(arrayBuffer)

  // Verify magic
  for (let i = 0; i < MTWB_MAGIC.length; i++) {
    if (raw[i] !== MTWB_MAGIC[i]) {
      throw new Error(`Not a Windblown save file (bad magic at byte ${i})`)
    }
  }

  // Find GZIP blocks
  const gzipOffsets = findAllGzipOffsets(raw)
  if (gzipOffsets.length < 2) {
    throw new Error(`Expected 2 GZIP blocks, found ${gzipOffsets.length}`)
  }

  const block1GzipOffset = gzipOffsets[0]
  const block2GzipOffset = gzipOffsets[1]

  // Decompress block 1 → JSON metadata
  const block1Data = raw.slice(block1GzipOffset, block2GzipOffset)
  const block1Decompressed = gzipDecompressWithTrailing(block1Data)
  const jsonStr = new TextDecoder().decode(block1Decompressed)
  const metadata = JSON.parse(jsonStr) as PlayerMeta

  // Find block 1's GZIP end to locate the gap
  const isizeBytes = new Uint8Array(4)
  new DataView(isizeBytes.buffer).setUint32(0, block1Decompressed.length & 0xffffffff, true)
  let block1GzipEnd = -1
  for (let i = block2GzipOffset - 4; i >= block1GzipOffset; i--) {
    if (
      raw[i] === isizeBytes[0] &&
      raw[i + 1] === isizeBytes[1] &&
      raw[i + 2] === isizeBytes[2] &&
      raw[i + 3] === isizeBytes[3]
    ) {
      block1GzipEnd = i + 4
      break
    }
  }
  if (block1GzipEnd === -1) {
    throw new Error("Could not find block 1 GZIP end (ISIZE trailer)")
  }

  // Gap structure: [20-byte SHA-1 hash] [static metadata bytes]
  const gapStaticBytes = raw.slice(block1GzipEnd + SHA1_SIZE, block2GzipOffset)

  // Decompress block 2 → binary game state
  const block2Decompressed = gzipDecompress(raw.slice(block2GzipOffset))

  // Find currencies
  const currencyOffset = findCurrencyOffset(block2Decompressed)
  const currencies = readCurrencies(block2Decompressed, currencyOffset)

  // Find meta flags bitset (in tail section, after currencies)
  const metaFlagsOffset = findMetaFlagsOffset(block2Decompressed, currencyOffset + 28)
  const metaFlags = readMetaFlags(block2Decompressed, metaFlagsOffset)

  return {
    metadata,
    currencies,
    metaFlags,
    _raw: raw,
    _block2Decompressed: block2Decompressed,
    _block1GzipOffset: block1GzipOffset,
    _block2GzipOffset: block2GzipOffset,
    _gapStaticBytes: gapStaticBytes,
    _currencyOffset: currencyOffset,
    _metaFlagsOffset: metaFlagsOffset,
  }
}

// ── Encode ──────────────────────────────────────────────────────────────

export async function encodeSaveToBlob(save: WindblownSave): Promise<Blob> {
  // 1. Modify block 2 with updated currencies and flags
  const modifiedBlock2 = new Uint8Array(save._block2Decompressed)
  writeCurrencies(modifiedBlock2, save._currencyOffset, save.currencies)
  writeMetaFlags(modifiedBlock2, save._metaFlagsOffset, save.metaFlags)

  // 2. Recompress block 2
  const compressedBlock2 = gzipCompress(modifiedBlock2)

  // 3. Extract original block 1 compressed data (unchanged)
  const block1Decompressed = gzipDecompressWithTrailing(
    save._raw.slice(save._block1GzipOffset, save._block2GzipOffset),
  )
  const isizeBytes = new Uint8Array(4)
  new DataView(isizeBytes.buffer).setUint32(0, block1Decompressed.length & 0xffffffff, true)
  let block1GzipEnd = -1
  for (let i = save._block2GzipOffset - 4; i >= save._block1GzipOffset; i--) {
    if (
      save._raw[i] === isizeBytes[0] &&
      save._raw[i + 1] === isizeBytes[1] &&
      save._raw[i + 2] === isizeBytes[2] &&
      save._raw[i + 3] === isizeBytes[3]
    ) {
      block1GzipEnd = i + 4
      break
    }
  }
  if (block1GzipEnd === -1) throw new Error("Could not find block 1 GZIP end")

  const block1Compressed = save._raw.slice(save._block1GzipOffset, block1GzipEnd)

  // 4. Compute SHA-1 hashes
  const headerHash = await sha1(block1Compressed)

  const gapHashInput = new Uint8Array(save._gapStaticBytes.length + compressedBlock2.length)
  gapHashInput.set(save._gapStaticBytes, 0)
  gapHashInput.set(compressedBlock2, save._gapStaticBytes.length)
  const gapHash = await sha1(gapHashInput)

  // 5. Build the file:
  // [magic 4B] [version 5B] [headerHash 20B] [block1 gzip] [gapHash 20B] [gapStatic] [block2 gzip]
  const magic = save._raw.slice(0, 4)
  const version = save._raw.slice(4, 9)

  const totalSize =
    4 + 5 + SHA1_SIZE + block1Compressed.length + SHA1_SIZE + save._gapStaticBytes.length + compressedBlock2.length
  const output = new Uint8Array(totalSize)
  let offset = 0

  output.set(magic, offset)
  offset += 4
  output.set(version, offset)
  offset += 5
  output.set(headerHash, offset)
  offset += SHA1_SIZE
  output.set(block1Compressed, offset)
  offset += block1Compressed.length
  output.set(gapHash, offset)
  offset += SHA1_SIZE
  output.set(save._gapStaticBytes, offset)
  offset += save._gapStaticBytes.length
  output.set(compressedBlock2, offset)

  return new Blob([output], { type: "application/octet-stream" })
}
