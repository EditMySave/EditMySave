// Tests for the Windblown v2 (MetaCurrency) save codec.
//
// Loads the immutable sample save ./671ab6c4a259a71f2b5a46c9.sav and drives the
// browser-facing API (decodeSaveFromFile → encodeSaveToBlob) via a File wrapper,
// exactly as the app does. The container is reconstructed with recomputed SHA-1
// hashes, so a no-edit encode is NOT byte-identical (block2 re-gzips to a
// different-but-valid stream, cascading into the gapHash). Instead we assert:
//   - the codec's hash model matches the ORIGINAL file's stored hashes
//     (so the game's validation will pass), and
//   - every semantic field survives a decode → encode → decode roundtrip.
//
// Container layout is derived from the file (not hardcoded) so a future sample
// swap doesn't invalidate the offsets.
//
// Run from the EditMySave repo root:  deno task test:windblown

import { assert, assertEquals } from "@std/assert"
import { createHash } from "node:crypto"
import { gunzipSync, inflateRawSync } from "node:zlib"

import { decodeSaveFromFile, encodeSaveToBlob, type WindblownSave } from "./decoder.ts"

const SAMPLE = new URL("./671ab6c4a259a71f2b5a46c9.sav", import.meta.url).pathname

const sha1 = (dt: Uint8Array) => new Uint8Array(createHash("sha1").update(Buffer.from(dt)).digest())
const hex = (dt: Uint8Array) => [...dt].map((b) => b.toString(16).padStart(2, "0")).join("")

/** Derive the container region offsets from the raw bytes (format-driven, not hardcoded). */
function layout(raw: Uint8Array) {
  const gz = (from: number) => {
    for (let i = from; i < raw.length - 2; i++) {
      if (raw[i] === 0x1f && raw[i + 1] === 0x8b && raw[i + 2] === 0x08) return i
    }
    return -1
  }
  const block1Off = gz(0) // == 29 (4 magic + 5 version + 20 headerHash)
  const block2Off = gz(block1Off + 1)
  const block1 = new Uint8Array(inflateRawSync(Buffer.from(raw.slice(block1Off + 10, block2Off))))
  const isize = new Uint8Array(4)
  new DataView(isize.buffer).setUint32(0, block1.length & 0xffffffff, true)
  let block1End = -1
  for (let i = block2Off - 4; i >= block1Off; i--) {
    if (raw[i] === isize[0] && raw[i + 1] === isize[1] && raw[i + 2] === isize[2] && raw[i + 3] === isize[3]) {
      block1End = i + 4
      break
    }
  }
  return {
    headerHash: [9, 29] as const,
    block1: [block1Off, block1End] as const,
    gapHash: [block1End, block1End + 20] as const,
    gapStatic: [block1End + 20, block2Off] as const,
    block2Off,
  }
}

function toFile(name: string, bytes: Uint8Array): File {
  return new File([bytes as BlobPart], name, { type: "application/octet-stream" })
}

async function loadSample(): Promise<{ save: WindblownSave; original: Uint8Array }> {
  const original = await Deno.readFile(SAMPLE)
  const save = await decodeSaveFromFile(toFile("sample.sav", original))
  return { save, original }
}

async function encode(save: WindblownSave): Promise<Uint8Array> {
  const blob = await encodeSaveToBlob(save)
  return new Uint8Array(await blob.arrayBuffer())
}

/** sha1(gapStatic + block2) — the gapHash model, valid for any file. */
function gapHashOf(raw: Uint8Array): Uint8Array {
  const L = layout(raw)
  const gapStatic = raw.slice(...L.gapStatic)
  const block2comp = raw.slice(L.block2Off)
  const input = new Uint8Array(gapStatic.length + block2comp.length)
  input.set(gapStatic, 0)
  input.set(block2comp, gapStatic.length)
  return sha1(input)
}

Deno.test("decode surfaces player, currencies, and flags", async () => {
  const { save } = await loadSample()

  assertEquals(save.metadata.PlayerId, "671ab6c4a259a71f2b5a46c9")
  assertEquals(save.metadata.Serial, 285)

  // Cog (enum 0) is always the first record; friendly name resolves to "Cogs".
  assertEquals(save.currencies[0].enumId, 0)
  assertEquals(save.currencies[0].name, "Cog")
  assertEquals(save.currencies[0].friendlyName, "Cogs")
  assertEquals(save.currencies[0].amount, 81375)
  assertEquals(save.currencies.length, 20)
  // enum 2 (AutumnBoss) resolves to its localized display name.
  assertEquals(save.currencies.find((c) => c.enumId === 2)!.friendlyName, "Tribomber Eye")

  // Flag mask must be located for this save.
  assert(save._flagMaskBitPos >= 0, "flag mask should be located")
  assert(Object.keys(save.metaFlags).length > 0, "flags should be surfaced")
})

Deno.test("hash model matches the original file's stored hashes", async () => {
  // Load-bearing correctness proof: if our reconstruction model reproduces the
  // ORIGINAL hashes, the game will accept our edits.
  const raw = await Deno.readFile(SAMPLE)
  const L = layout(raw)
  assertEquals(hex(sha1(raw.slice(...L.block1))), hex(raw.slice(...L.headerHash)), "headerHash")
  assertEquals(hex(gapHashOf(raw)), hex(raw.slice(...L.gapHash)), "gapHash")
})

Deno.test("no-edit encode preserves all content regions", async () => {
  const { save, original } = await loadSample()
  const round = await encode(save)
  const L = layout(original)

  const regionEq = (a: number, b: number) => {
    for (let i = a; i < b; i++) if (original[i] !== round[i]) return i
    return -1
  }

  // Header, block1, and gapStatic are preserved verbatim (no-edit path shifts nothing).
  assertEquals(regionEq(0, L.block1[1]), -1, "header + block1 identical")
  assertEquals(regionEq(...L.gapStatic), -1, "gapStatic identical")

  // gapHash is intentionally recomputed (block2 re-gzips differently).
  assert(regionEq(...L.gapHash) !== -1, "gapHash is expected to be recomputed")

  // block2's decompressed payload must be byte-identical.
  const b2o = new Uint8Array(gunzipSync(Buffer.from(original.slice(L.block2Off))))
  const b2r = new Uint8Array(gunzipSync(Buffer.from(round.slice(layout(round).block2Off))))
  assertEquals(hex(b2o), hex(b2r), "block2 payload identical")

  // The re-encoded file must carry hashes valid for its own content.
  const RL = layout(round)
  assertEquals(hex(gapHashOf(round)), hex(round.slice(...RL.gapHash)), "recomputed gapHash valid")
  assertEquals(hex(sha1(round.slice(...RL.block1))), hex(round.slice(...RL.headerHash)), "headerHash valid")
})

Deno.test("re-decode roundtrip preserves currencies, metadata, and flags", async () => {
  const { save } = await loadSample()
  const round = await encode(save)
  const save2 = await decodeSaveFromFile(toFile("round.sav", round))

  assertEquals(save2._flagMaskBitPos, save._flagMaskBitPos)
  assertEquals(save2.metadata.PlayerId, save.metadata.PlayerId)
  assertEquals(save2.metadata.Serial, save.metadata.Serial)
  assertEquals(save2.currencies, save.currencies)
  assertEquals(save2.metaFlags, save.metaFlags)
})

Deno.test("currency edit roundtrips (in-place patch)", async () => {
  const { save } = await loadSample()
  const edited: WindblownSave = {
    ...save,
    currencies: save.currencies.map((c) => (c.enumId === 0 ? { ...c, amount: 999999 } : c)),
  }
  const round = await encode(edited)
  const back = await decodeSaveFromFile(toFile("round.sav", round))
  assertEquals(back.currencies.find((c) => c.enumId === 0)!.amount, 999999)
  // and its hashes are valid
  const L = layout(round)
  assertEquals(hex(gapHashOf(round)), hex(round.slice(...L.gapHash)), "gapHash valid after edit")
})

Deno.test("adding a not-yet-stored currency roundtrips (structural insert)", async () => {
  const { save } = await loadSample()
  const before = save.currencies.length
  // enum 1 (Autumn) is absent from this save. Append it, encode, re-decode.
  assert(!save.currencies.some((c) => c.enumId === 1), "enum 1 should not be stored yet")
  const edited: WindblownSave = {
    ...save,
    currencies: [...save.currencies, { enumId: 1, name: "Autumn", friendlyName: "Dried Grass", amount: 4242 }],
  }
  const round = await encode(edited)
  const back = await decodeSaveFromFile(toFile("round.sav", round))

  // The new record is present and correct...
  assertEquals(back.currencies.length, before + 1, "count grew by one")
  const added = back.currencies.find((c) => c.enumId === 1)
  assert(added, "inserted currency present after roundtrip")
  assertEquals(added!.amount, 4242)
  assertEquals(added!.name, "Autumn")

  // ...every previously-stored currency is untouched...
  for (const c of save.currencies) {
    assertEquals(back.currencies.find((x) => x.enumId === c.enumId)!.amount, c.amount, `enum ${c.enumId} preserved`)
  }

  // ...flags survive the downstream bit shift...
  assertEquals(back.metaFlags, save.metaFlags)

  // ...and the container hashes are valid for the new, longer block2.
  const L = layout(round)
  assertEquals(hex(gapHashOf(round)), hex(round.slice(...L.gapHash)), "gapHash valid after insert")
  assertEquals(hex(sha1(round.slice(...L.block1))), hex(round.slice(...L.headerHash)), "headerHash valid after insert")
})

Deno.test("flag edit roundtrips", async () => {
  const { save } = await loadSample()

  // Pick a flag that is currently unset and flip it on.
  const target = Object.entries(save.metaFlags).find(([, v]) => !v)?.[0]
  assert(target, "expected at least one unset flag")
  const edited: WindblownSave = {
    ...save,
    metaFlags: { ...save.metaFlags, [target]: true },
  }
  const round = await encode(edited)
  const back = await decodeSaveFromFile(toFile("round.sav", round))
  assertEquals(back.metaFlags[target], true, "flipped flag persists")
})
