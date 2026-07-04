/**
 * Windblown Save File Codec (Browser-compatible, v2 MetaCurrency format)
 *
 * Container (unchanged across game versions):
 *   MTWB magic + version(5B) + SHA1(20B) + GZIP(block1 = JSON player metadata)
 *   + gap[SHA1(20B) + static bytes] + GZIP(block2 = game state)
 *
 * block2 is a Photon Quantum bit-packed serialized stream (LSB-first). This codec
 * handles the reworked ("v2") save format:
 *
 * CURRENCIES — a dynamic `MetaCurrency` collection (replaces the old fixed 5-slot
 * array), serialized as `[u16 count][count × record]`, record (48 bits) =
 * `[u8 pad=0][u8 enumType][u32 amount]` (all LSB-first). Editing an amount is an
 * in-place 32-bit bit patch — nothing downstream shifts.
 *
 * UNLOCK FLAGS — a `Quantum.MetaFlagMask` contiguous LSB-first bitfield located
 * without fixed offsets via a self-validating fingerprint (see locateFlagMask).
 *
 * Browser APIs: pako (GZIP), crypto.subtle (SHA-1), File input / Blob output.
 * Ported from the Deno POC lib/windblown/v2/save_io.ts.
 */

import pako from "pako"

// ── Constants ───────────────────────────────────────────────────────────

const MTWB_MAGIC = new Uint8Array([0x4d, 0x54, 0x57, 0x42]) // "MTWB"
const GZIP_MAGIC = new Uint8Array([0x1f, 0x8b, 0x08])
const GZIP_HEADER_SIZE = 10
const SHA1_SIZE = 20

// Currency record layout (bits)
const REC_BITS = 48
const REC_PAD_BITS = 8
const REC_ENUM_BITS = 8
const REC_AMOUNT_BITS = 32
const COUNT_BITS = 16

/**
 * Enum value → `Quantum.MetaCurrencyType` member identifier, extracted verbatim from the
 * game's global-metadata.dat (IL2CPP metadata v39). These are the names as the enum defines
 * them — mostly the enemy/biome source each material drops from — not localized display names.
 * The enum is dense (values 0–46 == declaration order); unknown ids fall back to `currency_<id>`.
 */
export const CURRENCY_NAMES: Record<number, string> = {
  0: "Cog",
  1: "Autumn",
  2: "AutumnBoss",
  3: "AutumnAlpha",
  4: "AmassmoussNG",
  5: "BomberNG",
  6: "Mushroom",
  7: "MushroomBoss",
  8: "MushroomAlpha",
  9: "MushroomWarriorNG",
  10: "AntRangedNG",
  11: "Factory",
  12: "FactoryBoss",
  13: "FactoryAlpha",
  14: "WorkerNailgunNG",
  15: "GyroNG",
  16: "Summer",
  17: "SummerBoss",
  18: "SummerAlpha",
  19: "WildGolemWhipSecretUnderground",
  20: "WildCavernSecretUnderground",
  21: "WildJawSecretUnderground",
  22: "WildToothBeastSecretUnderground",
  23: "WildCavernNG",
  24: "WildJawNG",
  25: "RatVillage",
  26: "RatVillageBoss",
  27: "RatVillageHeadBoss",
  28: "PirateSword",
  29: "PirateGoblin",
  30: "PirateShieldNG",
  31: "PirateBombNG",
  32: "Sanctuary",
  33: "SanctuaryBoss",
  34: "SentinelDrone",
  35: "SentinelPaladin",
  36: "SentinelDroneNG",
  37: "SentinelCasterNG",
  38: "Incubator",
  39: "IncubatorNavelessPyroBoss",
  40: "IncubatorNavelessRogueBoss",
  41: "IncubatorNavelessWarriorBoss",
  42: "Octo",
  43: "SentinelTallNG",
  44: "NavelessWerewolfNG",
  45: "Secret",
  46: "GolemChicken",
}

/**
 * Enum value → localized in-game display name, extracted from the game's Unity Localization
 * String Tables (BoscoDictionary, English). Joined by the `META_CURRENCY_<ENUMNAME>` key
 * convention — all 47 enum members matched exactly. Rich-text color tags stripped.
 */
export const CURRENCY_FRIENDLY_NAMES: Record<number, string> = {
  0: "Cogs",
  1: "Dried Grass",
  2: "Tribomber Eye",
  3: "Golemic Variant Eye",
  4: "Obsidian Amassmoss Cannon",
  5: "Obsidian Bomber Body",
  6: "Glowing Spores",
  7: "Infected Tribomber Leg",
  8: "Fungal Variant Leg",
  9: "Obsidian Amanita Swordsman Hat",
  10: "Obsidian Myrmetal Worker Claw",
  11: "Steam Capsule",
  12: "Headbanger Ventricore",
  13: "Mechanical Variant Cable",
  14: "Obsidian OMI-nail Nail Gun",
  15: "Obsidian Gy-RHÔ Propeller",
  16: "Intact Bone",
  17: "Broken Banger Lantern",
  18: "Prehistoric Variant Vertebra",
  19: "Albino Dominator Variant Whip",
  20: "Albino Burrower Variant Claw",
  21: "Albino Crocobrute Variant Jaw",
  22: "Albino Brachioral Variant Spine",
  23: "Obsidian Burrower Chitin",
  24: "Obsidian Crocobrute Tooth",
  25: "Cheese Rind",
  26: "Pirate Captain's Treasure",
  27: "Fugitive Core",
  28: "Marmonoa Belt",
  29: "Pick-Squeak Pick",
  30: "Obsidian Beaverage Shield",
  31: "Obsidian Ratter Bag",
  32: "Dark Shard",
  33: "Memoreaper Altar",
  34: "R0GU3 Wing",
  35: "P4L4DIN Torn Cape",
  36: "Obsidian R0GU3 Wing",
  37: "Obsidian M4GE Staff",
  38: "Stem Cell Tube",
  39: "Fraternal Flame",
  40: "Fraternal Lightning",
  41: "Fraternal Stone",
  42: "Tentacle",
  43: "Obsidian Obliterator Halo",
  44: "Obsidian Lycan Arm",
  45: "Ancient Tablet Fragment",
  46: "Golliform Jar",
}

// ── Meta-flag unlocks (Quantum.MetaFlagMask) ────────────────────────────
//
// block2 stores unlock flags as a contiguous LSB-first bitfield: flag[i] is at
// bit (maskBitPos + i). The mask is located WITHOUT fixed offsets by a
// self-validating fingerprint: slide across every bit offset and keep only the
// position whose decoded set is internally consistent — always-unlocked anchors
// set, every leveled unlock sequential (LvlN ⇒ Lvl(N-1)), and every dependency
// satisfied. Exactly one offset survives.

export const META_FLAG_NAMES: string[] = [
  "UnlockedAWeapon", "SawAMiniBossOrBoss", "UnlockedSelectSpecies", "FoundABlueprint", "KilledAMiniBossOrBoss",
  "VisitedAShop", "UnlockedTrialChest", "CanAccessHub", "AccessedHub", "KilledABoss", "SyncAttackLvl1",
  "ExtraHealerEffectLvl1", "ExtraHealerEffectLvl2", "ExtraHealerEffectLvl3", "UnawareDMGIncreaseLvl1",
  "UnawareDMGIncreaseLvl2", "UnawareDMGIncreaseLvl3", "RunCurrencyReserveLvl1", "RunCurrencyReserveLvl2",
  "RunCurrencyReserveLvl3", "GiverReroll", "HealFlaskEffectLvl1", "HealFlaskEffectLvl2", "FoodHealthEffectLvl1",
  "FoodHealthEffectLvl2", "FoodCookingEffectLvl1", "FoodCookingEffectLvl2", "BetterJars", "CanPublicMultiplayer",
  "TalkedToAmi", "AmiCanDecryptMemories", "SawABoss", "StartedARun", "UnlockedAPermanentUpgrade", "DidEatFood",
  "UnlockedHealFlask", "UnlockedStartGiver", "UsedHealer", "FoundAGearBlueprint", "MobJuiceSkillRefill",
  "UnlockedChallenge", "UnlockedRecyclingLvl1", "HealFlaskChargeLvl1", "HealFlaskChargeLvl2", "HealFlaskChargeLvl3",
  "UnlockedOptionalElite", "UnlockedStartWeaponLvl1", "UnlockedStartTrinketLvl1", "UnlockedStartTrinketLvl2",
  "CanAccessSecrets", "AlterattackLvl1", "UnlockedWeaponTraining", "UnlockedStartWeaponLvl2", "UnlockedRecyclingLvl2",
  "GotHubSecretMetaCurrency", "FoundAMemoryBlueprint", "UnlockedGiftSlotLvl1", "UnlockedGiftSlotLvl2",
  "UnlockedEnemyVariantsLv1", "UnlockedEnemyVariantsLv2", "UnlockedCogGates", "ReachedPathChoice", "ReachedArena",
  "ReachedPath3Choices", "HasPermBackstabBonus", "DiedAfterFirstMemoryGiver", "UnlockedATeamMove",
  "GotAmiUnlockingChip", "TalkedToCuprik", "SyncAttackLvl2", "UnlockedBangerPulsor", "UnlockedHexGiver",
  "RescuedSigourney", "TalkedToSigourney", "PerpetualFlagAlphaPlayer", "PerpetualFlagDemoPlayer",
  "PerpetualFlagSuperEarlyAccessPlayer", "UnlockedNewGamePlus", "GotTeleportToTeamTutorial", "UnlockedEndlessMode",
  "UnlockedShopForge", "PlentierShopLvl1", "PlentierShopLvl2", "BuyableBoosts", "UnlockedTrinketTraining",
  "UnlockedGiftTraining", "GotEmoteTutorial", "UnlockedPaidEquippedBoonLvl1", "BoonDeckLvl1",
  "UnlockedFullBoonDeckPulsorSlot", "UnlockedMetaCurrencyExchange", "UnlockedRarityLvl1", "HexGiverCanAppear",
  "ReachedMamaChildReward", "UnlockedBackpackLvl1", "UnlockedPlayerRemains", "UnlockedPulsorSlotLvl1",
  "UnlockedPulsorSlotLvl2", "UnlockedPulsorStoneFeeding", "UnlockedPulsorDustFeeding", "UnlockedPulsorShardFeeding",
  "UnlockedPulsorFragmentFeeding", "UnlockedPulsorStoneUpgradeLvl1", "UnlockedPulsorStoneUpgradeLvl2",
  "UnlockedStoneCheaperUpgradeLvl1", "UnlockedStoneCheaperUpgradeLvl2", "UnlockedRareAffixesLvl1",
  "UnlockedTeamMoveAlterattackEffect", "UnlockedPulsorEffects", "UnlockedPaidEquippedBoonLvl2",
  "UnlockedBiomeIncentivization", "UnlockedRarityLvl2", "UnlockedRarityLvl3", "UnlockedRareAffixesLvl2",
  "FinishedRarity",
]

/** Number of trailing unnamed flags (appended by newer game versions) to surface. */
export const EXTRA_FLAG_BITS = 24

const _flagIdx = (n: string) => META_FLAG_NAMES.indexOf(n)

/** Leveled unlocks are strictly sequential: LvlN ⇒ Lvl(N-1). */
const FLAG_LEVEL_CHAINS: number[][] = [
  ["ExtraHealerEffectLvl1", "ExtraHealerEffectLvl2", "ExtraHealerEffectLvl3"],
  ["UnawareDMGIncreaseLvl1", "UnawareDMGIncreaseLvl2", "UnawareDMGIncreaseLvl3"],
  ["RunCurrencyReserveLvl1", "RunCurrencyReserveLvl2", "RunCurrencyReserveLvl3"],
  ["HealFlaskEffectLvl1", "HealFlaskEffectLvl2"],
  ["FoodHealthEffectLvl1", "FoodHealthEffectLvl2"],
  ["FoodCookingEffectLvl1", "FoodCookingEffectLvl2"],
  ["HealFlaskChargeLvl1", "HealFlaskChargeLvl2", "HealFlaskChargeLvl3"],
  ["UnlockedStartWeaponLvl1", "UnlockedStartWeaponLvl2"],
  ["UnlockedStartTrinketLvl1", "UnlockedStartTrinketLvl2"],
  ["UnlockedRecyclingLvl1", "UnlockedRecyclingLvl2"],
  ["SyncAttackLvl1", "SyncAttackLvl2"],
  ["PlentierShopLvl1", "PlentierShopLvl2"],
  ["UnlockedGiftSlotLvl1", "UnlockedGiftSlotLvl2"],
  ["UnlockedEnemyVariantsLv1", "UnlockedEnemyVariantsLv2"],
  ["UnlockedPulsorSlotLvl1", "UnlockedPulsorSlotLvl2"],
  ["UnlockedPulsorStoneUpgradeLvl1", "UnlockedPulsorStoneUpgradeLvl2"],
  ["UnlockedStoneCheaperUpgradeLvl1", "UnlockedStoneCheaperUpgradeLvl2"],
  ["UnlockedRarityLvl1", "UnlockedRarityLvl2", "UnlockedRarityLvl3"],
  ["UnlockedRareAffixesLvl1", "UnlockedRareAffixesLvl2"],
  ["UnlockedPaidEquippedBoonLvl1", "UnlockedPaidEquippedBoonLvl2"],
].map((g) => g.map(_flagIdx))

/** Causal dependencies: child ⇒ parent (impossible to have child without parent). */
const FLAG_DEPS: [number, number][] = [
  ["AccessedHub", "CanAccessHub"], ["KilledABoss", "SawABoss"], ["KilledAMiniBossOrBoss", "SawAMiniBossOrBoss"],
  ["TalkedToSigourney", "RescuedSigourney"], ["HexGiverCanAppear", "UnlockedHexGiver"],
  ["FinishedRarity", "UnlockedRarityLvl3"], ["UnlockedPulsorDustFeeding", "UnlockedPulsorStoneFeeding"],
  ["UnlockedPulsorShardFeeding", "UnlockedPulsorDustFeeding"],
  ["UnlockedPulsorFragmentFeeding", "UnlockedPulsorShardFeeding"],
  ["UnlockedFullBoonDeckPulsorSlot", "BoonDeckLvl1"], ["BoonDeckLvl1", "UnlockedPaidEquippedBoonLvl1"],
  ["ReachedArena", "ReachedPathChoice"], ["ReachedPath3Choices", "ReachedPathChoice"],
].map(([a, b]) => [_flagIdx(a), _flagIdx(b)] as [number, number])

/** Flags always set once a player has reached the hub (used as location anchors). */
const FLAG_ANCHORS = ["UnlockedAWeapon", "CanAccessHub", "AccessedHub", "StartedARun"].map(_flagIdx)

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
  [key: string]: unknown
}

/** A single MetaCurrency entry. Clean/editable surface — bit positions live on WindblownSave. */
export interface CurrencyEntry {
  /** MetaCurrencyType enum value. */
  enumId: number
  /** Raw enum member identifier (e.g. `AutumnBoss`), else `currency_<id>`. */
  name: string
  /** Localized in-game display name (e.g. `Tribomber Eye`); falls back to `name`. */
  friendlyName: string
  amount: number
}

export type MetaFlags = Record<string, boolean>

export interface WindblownSave {
  metadata: PlayerMeta
  /** Dynamic MetaCurrency list (editable). */
  currencies: CurrencyEntry[]
  /** Named flags + `flag_<i>` extras (editable). Empty `{}` if the mask couldn't be located. */
  metaFlags: MetaFlags
  // ── preserved re-encode scaffold ──
  _raw: Uint8Array
  _block2Decompressed: Uint8Array
  _block1GzipOffset: number
  _block2GzipOffset: number
  _gapStaticBytes: Uint8Array
  /** enumId → absolute bit position of that currency's amount field within block2. */
  _currencyBitPos: Record<number, number>
  /** Bit position of the currency array's u16 count prefix (for structural inserts). */
  _currencyArrayBitPos: number
  /** Number of currency records currently stored in the array. */
  _currencyCount: number
  /** Absolute bit position of flag[0] in the mask, or -1 if not located. */
  _flagMaskBitPos: number
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

/** Find the end of a GZIP stream by locating its ISIZE trailer (mod 2^32). */
function findGzipEnd(raw: Uint8Array, gzipStart: number, searchLimit: number, decompressedLen: number): number {
  const isize = new Uint8Array(4)
  new DataView(isize.buffer).setUint32(0, decompressedLen & 0xffffffff, true)
  for (let i = searchLimit - 4; i >= gzipStart; i--) {
    if (raw[i] === isize[0] && raw[i + 1] === isize[1] && raw[i + 2] === isize[2] && raw[i + 3] === isize[3]) {
      return i + 4
    }
  }
  throw new Error("Could not find GZIP end (ISIZE trailer)")
}

// ── Bit-stream helpers (LSB-first, operate directly on block2) ──────────

function readBits(data: Uint8Array, bitPos: number, n: number): number {
  // Float accumulation to safely handle full 32-bit unsigned values.
  let v = 0
  for (let i = 0; i < n; i++) {
    const bit = (data[(bitPos + i) >> 3] >> ((bitPos + i) & 7)) & 1
    if (bit) v += 2 ** i
  }
  return v
}

function writeBits(data: Uint8Array, bitPos: number, n: number, value: number): void {
  for (let i = 0; i < n; i++) {
    const bit = Math.floor(value / 2 ** i) % 2
    const byteIdx = (bitPos + i) >> 3
    const bitIdx = (bitPos + i) & 7
    if (bit) data[byteIdx] |= 1 << bitIdx
    else data[byteIdx] &= ~(1 << bitIdx)
  }
}

/** Copy `n` bits from src@srcPos to dst@dstPos (LSB-first), in 24-bit chunks. */
function copyBits(src: Uint8Array, srcPos: number, dst: Uint8Array, dstPos: number, n: number): void {
  let i = 0
  for (; i + 24 <= n; i += 24) writeBits(dst, dstPos + i, 24, readBits(src, srcPos + i, 24))
  for (; i < n; i++) {
    const bit = (src[(srcPos + i) >> 3] >> ((srcPos + i) & 7)) & 1
    const bp = dstPos + i
    if (bit) dst[bp >> 3] |= 1 << (bp & 7)
    else dst[bp >> 3] &= ~(1 << (bp & 7))
  }
}

/**
 * Structurally append new currency records to the MetaCurrency array: bumps the u16
 * count and splices `records` (48 bits each) in after the last existing record, shifting
 * every downstream bit forward. Returns a new, longer block2. Records are appended at the
 * array's tail so existing records keep their bit positions (in-place patches stay valid).
 */
function insertCurrencyRecords(
  block2: Uint8Array,
  arrayBitPos: number,
  oldCount: number,
  records: { enumId: number; amount: number }[],
): Uint8Array {
  const insertBitPos = arrayBitPos + COUNT_BITS + oldCount * REC_BITS
  const totalBits = block2.length * 8
  const addBits = records.length * REC_BITS
  const dst = new Uint8Array((totalBits + addBits) / 8)

  copyBits(block2, 0, dst, 0, insertBitPos)
  let p = insertBitPos
  for (const r of records) {
    writeBits(dst, p, REC_PAD_BITS, 0)
    p += REC_PAD_BITS
    writeBits(dst, p, REC_ENUM_BITS, r.enumId)
    p += REC_ENUM_BITS
    writeBits(dst, p, REC_AMOUNT_BITS, r.amount)
    p += REC_AMOUNT_BITS
  }
  copyBits(block2, insertBitPos, dst, insertBitPos + addBits, totalBits - insertBitPos)
  writeBits(dst, arrayBitPos, COUNT_BITS, oldCount + records.length)
  return dst
}

// ── Currency array location & parsing ───────────────────────────────────

interface RawCurrencyArray {
  bitPos: number
  count: number
  records: { enumId: number; amount: number; amountBitPos: number }[]
}

/**
 * Scan every bit offset for the MetaCurrency array signature:
 * `[u16 count][count × (pad=0, enum<200 distinct, u32 amount)]` with the first
 * record being Cogs (enum 0). Among all matches, pick the one with the most
 * records (the real array; shorter matches are bit-shifted overlaps).
 */
function locateCurrencyArray(block2: Uint8Array): RawCurrencyArray {
  const totalBits = block2.length * 8
  let best: RawCurrencyArray | null = null

  for (let bp = 0; bp <= totalBits - COUNT_BITS; bp++) {
    const count = readBits(block2, bp, COUNT_BITS)
    if (count < 8 || count > 128) continue

    const recStart = bp + COUNT_BITS
    if (recStart + count * REC_BITS > totalBits) continue

    const records: RawCurrencyArray["records"] = []
    const seen = new Set<number>()
    let ok = true
    for (let r = 0; r < count; r++) {
      const b = recStart + r * REC_BITS
      const pad = readBits(block2, b, REC_PAD_BITS)
      const enumId = readBits(block2, b + REC_PAD_BITS, REC_ENUM_BITS)
      const amountBitPos = b + REC_PAD_BITS + REC_ENUM_BITS
      const amount = readBits(block2, amountBitPos, REC_AMOUNT_BITS)
      if (pad !== 0 || enumId > 200 || amount > 50_000_000 || seen.has(enumId)) {
        ok = false
        break
      }
      seen.add(enumId)
      records.push({ enumId, amount, amountBitPos })
    }
    if (!ok || records.length !== count) continue
    if (records[0].enumId !== 0) continue // Cogs is always enum 0 and always present

    if (!best || count > best.count) best = { bitPos: bp, count, records }
  }

  if (!best) throw new Error("MetaCurrency array not found in block2")
  return best
}

// ── Meta-flag mask location & parsing ───────────────────────────────────

function flagBit(block2: Uint8Array, bitPos: number): boolean {
  return ((block2[bitPos >> 3] >> (bitPos & 7)) & 1) === 1
}

/**
 * Locate the flag mask by self-validating fingerprint (see META_FLAG_NAMES note):
 * the unique bit offset whose decoded flag set is internally consistent.
 * Returns the absolute bit position of flag[0], or -1 if not confidently found.
 */
function locateFlagMask(block2: Uint8Array): number {
  const N = META_FLAG_NAMES.length
  const total = block2.length * 8
  let best = -1
  let bestSet = -1

  for (let B = 0; B + N < total; B++) {
    // Cheap anchor gate first.
    let anchored = true
    for (const a of FLAG_ANCHORS) {
      if (!flagBit(block2, B + a)) {
        anchored = false
        break
      }
    }
    if (!anchored) continue

    // Level monotonicity.
    let coherent = true
    for (const chain of FLAG_LEVEL_CHAINS) {
      for (let k = 1; k < chain.length && coherent; k++) {
        if (flagBit(block2, B + chain[k]) && !flagBit(block2, B + chain[k - 1])) coherent = false
      }
      if (!coherent) break
    }
    if (!coherent) continue

    // Causal dependencies.
    for (const [child, parent] of FLAG_DEPS) {
      if (flagBit(block2, B + child) && !flagBit(block2, B + parent)) {
        coherent = false
        break
      }
    }
    if (!coherent) continue

    let set = 0
    for (let i = 0; i < N; i++) if (flagBit(block2, B + i)) set++
    if (set > bestSet) {
      bestSet = set
      best = B
    }
  }
  return best
}

function readFlags(block2: Uint8Array, maskBitPos: number): MetaFlags {
  const flags: MetaFlags = {}
  for (let i = 0; i < META_FLAG_NAMES.length; i++) {
    flags[META_FLAG_NAMES[i]] = flagBit(block2, maskBitPos + i)
  }
  for (let i = 0; i < EXTRA_FLAG_BITS; i++) {
    const idx = META_FLAG_NAMES.length + i
    flags[`flag_${idx}`] = flagBit(block2, maskBitPos + idx)
  }
  return flags
}

function writeFlags(block2: Uint8Array, maskBitPos: number, flags: MetaFlags): void {
  const setFlag = (i: number, on: boolean) => {
    const bp = maskBitPos + i
    if (on) block2[bp >> 3] |= 1 << (bp & 7)
    else block2[bp >> 3] &= ~(1 << (bp & 7))
  }
  for (let i = 0; i < META_FLAG_NAMES.length; i++) {
    const v = flags[META_FLAG_NAMES[i]]
    if (typeof v === "boolean") setFlag(i, v)
  }
  for (let i = 0; i < EXTRA_FLAG_BITS; i++) {
    const idx = META_FLAG_NAMES.length + i
    const v = flags[`flag_${idx}`]
    if (typeof v === "boolean") setFlag(idx, v)
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

  // Decompress block 1 → JSON metadata (has trailing gap bytes → raw inflate)
  const block1Decompressed = gzipDecompressWithTrailing(raw.slice(block1GzipOffset, block2GzipOffset))
  const metadata = JSON.parse(new TextDecoder().decode(block1Decompressed)) as PlayerMeta

  // Locate block 1's GZIP end via ISIZE trailer to find the gap.
  const block1GzipEnd = findGzipEnd(raw, block1GzipOffset, block2GzipOffset, block1Decompressed.length)

  // Gap structure: [20-byte SHA-1 hash] [static metadata bytes]
  const gapStaticBytes = raw.slice(block1GzipEnd + SHA1_SIZE, block2GzipOffset)

  // Decompress block 2 → bit-packed game state
  const block2Decompressed = gzipDecompress(raw.slice(block2GzipOffset))

  // Currencies (dynamic MetaCurrency array)
  const arr = locateCurrencyArray(block2Decompressed)
  const currencies: CurrencyEntry[] = arr.records.map((r) => ({
    enumId: r.enumId,
    name: CURRENCY_NAMES[r.enumId] ?? `currency_${r.enumId}`,
    friendlyName: CURRENCY_FRIENDLY_NAMES[r.enumId] ?? CURRENCY_NAMES[r.enumId] ?? `currency_${r.enumId}`,
    amount: r.amount,
  }))
  const currencyBitPos: Record<number, number> = {}
  for (const r of arr.records) currencyBitPos[r.enumId] = r.amountBitPos

  // Unlock flags (fingerprint-located mask; may be absent)
  const flagMaskBitPos = locateFlagMask(block2Decompressed)
  const metaFlags = flagMaskBitPos >= 0 ? readFlags(block2Decompressed, flagMaskBitPos) : {}

  return {
    metadata,
    currencies,
    metaFlags,
    _raw: raw,
    _block2Decompressed: block2Decompressed,
    _block1GzipOffset: block1GzipOffset,
    _block2GzipOffset: block2GzipOffset,
    _gapStaticBytes: gapStaticBytes,
    _currencyBitPos: currencyBitPos,
    _currencyArrayBitPos: arr.bitPos,
    _currencyCount: arr.count,
    _flagMaskBitPos: flagMaskBitPos,
  }
}

// ── Encode ──────────────────────────────────────────────────────────────

export async function encodeSaveToBlob(save: WindblownSave): Promise<Blob> {
  // 1. Patch block 2: currency amounts already stored are fixed 32-bit fields patched
  //    in place; currencies not yet in the save (no located field) with a non-zero
  //    amount are collected for a structural insert below.
  let modifiedBlock2 = new Uint8Array(save._block2Decompressed)
  const toInsert: { enumId: number; amount: number }[] = []
  for (const c of save.currencies) {
    if (c.amount < 0 || c.amount > 0xffffffff) {
      throw new Error(`Currency "${c.name}" amount out of range: ${c.amount}`)
    }
    const bitPos = save._currencyBitPos[c.enumId]
    if (bitPos !== undefined) {
      writeBits(modifiedBlock2, bitPos, REC_AMOUNT_BITS, c.amount)
    } else if (c.amount > 0) {
      toInsert.push({ enumId: c.enumId, amount: c.amount })
    }
  }
  if (save._flagMaskBitPos >= 0) {
    writeFlags(modifiedBlock2, save._flagMaskBitPos, save.metaFlags)
  }
  // Structural insert: append new records at the array tail (existing records — and the
  // upstream flag mask — keep their bit positions, so the patches above stay valid).
  if (toInsert.length > 0) {
    modifiedBlock2 = insertCurrencyRecords(
      modifiedBlock2, save._currencyArrayBitPos, save._currencyCount, toInsert,
    )
  }

  // 2. Recompress block 2
  const compressedBlock2 = gzipCompress(modifiedBlock2)

  // 3. Extract original block 1 compressed data (unchanged)
  const block1Decompressed = gzipDecompressWithTrailing(
    save._raw.slice(save._block1GzipOffset, save._block2GzipOffset),
  )
  const block1GzipEnd = findGzipEnd(
    save._raw, save._block1GzipOffset, save._block2GzipOffset, block1Decompressed.length,
  )
  const block1Compressed = save._raw.slice(save._block1GzipOffset, block1GzipEnd)

  // 4. Recompute SHA-1 hashes.
  const headerHash = await sha1(block1Compressed)
  const gapHashInput = new Uint8Array(save._gapStaticBytes.length + compressedBlock2.length)
  gapHashInput.set(save._gapStaticBytes, 0)
  gapHashInput.set(compressedBlock2, save._gapStaticBytes.length)
  const gapHash = await sha1(gapHashInput)

  // 5. Reassemble:
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
