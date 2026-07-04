// Tests for raw-scaffold structural mutations.
//
// Each test loads the immutable sample save at
// /Users/reisscashmore/Development/SaveEditor/saves/far-far-west/76561198034513767.save,
// applies a mutation, and asserts the result via parse → mutate →
// serialize → parse. Byte-roundtrip tests assert that *no-op* paths
// preserve the original encrypted file bit-for-bit.
//
// Run from the EditMySave repo root: `deno task test:far-far-west`.

import { assert, assertEquals, assertExists } from "@std/assert"

// We exercise the same code paths the browser uses, but with Deno's
// Web Crypto + the npm aes-js shim. Using --no-check so tsconfig path
// aliases (`@/...`) don't trip Deno — we touch only relative imports.

import {
  decodeSaveFromFile,
  encodeSaveToBlob,
  reprojectFriendly,
  stripFNameSuffix,
  type FFWSave,
} from "./decoder.ts"
import * as raw from "./raw_ops.ts"

const SAMPLE = "/Users/reisscashmore/Development/SaveEditor/saves/far-far-west/76561198034513767.save"

// File-like wrapper so we can hand the decoder a `File` without Browser APIs.
function toFile(name: string, bytes: Uint8Array): File {
  return new File([bytes as BlobPart], name, { type: "application/octet-stream" })
}

async function load(): Promise<{ save: FFWSave; original: Uint8Array }> {
  const original = await Deno.readFile(SAMPLE)
  const save = await decodeSaveFromFile(toFile("76561198034513767.save", original))
  return { save, original }
}

async function encode(save: FFWSave): Promise<Uint8Array> {
  const blob = await encodeSaveToBlob(save)
  return new Uint8Array(await blob.arrayBuffer())
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function findFirstDiff(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i
  return a.length === b.length ? -1 : n
}

// ─── byte fidelity: untouched save round-trips exactly ─────────────────

Deno.test("byte fidelity — decode → encode of pristine save is byte-identical", async () => {
  const { save, original } = await load()
  const rebuilt = await encode(save)
  assertEquals(rebuilt.length, original.length, "size mismatch")
  if (!bytesEqual(rebuilt, original)) {
    const diff = findFirstDiff(rebuilt, original)
    throw new Error(`first byte mismatch at offset ${diff}`)
  }
})

// ─── inventory ────────────────────────────────────────────────────────

Deno.test("inventory — update existing key changes its amount on re-decode", async () => {
  const { save } = await load()
  const before = save.friendly.playerProgress.runtimeInventory.moneyGold
  assertExists(before, "sample save should have moneyGold")
  assert(before !== 12345, "sample save's moneyGold collides with our sentinel")

  // Mutate in-place via raw_ops (this is what the value-only setter uses
  // at encode time via graft, but we test the structural insert path too).
  const inv = (save.raw.properties as any[])
    .find((p) => stripFNameSuffix(p._name) === "playerProgress").value
    .find((p: any) => stripFNameSuffix(p._name) === "runtimeInventory").value
  const entry = inv.find((e: any[]) => e.some((p: any) => stripFNameSuffix(p._name) === "name" && p.value === "moneyGold"))
  for (const p of entry) if (stripFNameSuffix(p._name) === "amount") p.value = 12345
  const projected = reprojectFriendly(save)
  assertEquals(projected.friendly.playerProgress.runtimeInventory.moneyGold, 12345)

  const bytes = await encode(projected)
  const decoded = await decodeSaveFromFile(toFile("76561198034513767.save", bytes))
  assertEquals(decoded.friendly.playerProgress.runtimeInventory.moneyGold, 12345)
})

Deno.test("inventory — insertInventoryEntry adds a brand-new key, decodes back", async () => {
  const { save } = await load()
  const NEW_ID = "itemNotInSave_RawOpsTest"
  // Pre-condition: this id is not in the save.
  assert(!(NEW_ID in (save.friendly.playerProgress.runtimeInventory ?? {})), "test id pre-exists")

  const r = raw.insertInventoryEntry(save.raw, NEW_ID, 4242)
  assertEquals(r, "inserted")
  const projected = reprojectFriendly(save)
  assertEquals(projected.friendly.playerProgress.runtimeInventory[NEW_ID], 4242)

  // Re-decode after encode — proves the structural change survived a full
  // GVAS serialize → decrypt → parse round-trip.
  const bytes = await encode(projected)
  const decoded = await decodeSaveFromFile(toFile("76561198034513767.save", bytes))
  assertEquals(decoded.friendly.playerProgress.runtimeInventory[NEW_ID], 4242)
})

Deno.test("inventory — insert then remove returns to byte-identical baseline", async () => {
  const { save, original } = await load()
  const NEW_ID = "itemRoundTripSentinel"
  assertEquals(raw.insertInventoryEntry(save.raw, NEW_ID, 99), "inserted")
  assertEquals(raw.removeInventoryEntry(save.raw, NEW_ID), true)
  const rebuilt = await encode(save)
  assertEquals(rebuilt.length, original.length)
  assert(bytesEqual(rebuilt, original), `first diff at ${findFirstDiff(rebuilt, original)}`)
})

// ─── challenges map ───────────────────────────────────────────────────

Deno.test("challenges — insertMapEntry adds a new stat key", async () => {
  const { save } = await load()
  const KEY = "TestChallengeNotInSave"
  assert(!(KEY in (save.friendly.playerProgress.challenges ?? {})))
  const r = raw.insertMapEntry(save.raw, "playerProgress.challenges", KEY, 7777)
  assertEquals(r, "inserted")
  const projected = reprojectFriendly(save)
  assertEquals(projected.friendly.playerProgress.challenges[KEY], 7777)

  const bytes = await encode(projected)
  const decoded = await decodeSaveFromFile(toFile("76561198034513767.save", bytes))
  assertEquals(decoded.friendly.playerProgress.challenges[KEY], 7777)
})

// ─── scalar loadout fields ────────────────────────────────────────────

Deno.test("loadout — setScalarProperty adds a new top-level string field on playerProgress", async () => {
  const { save } = await load()
  const FIELD = "testLoadoutFieldNotInSave"
  assert(!(FIELD in save.friendly.playerProgress), "field pre-exists")
  const r = raw.setScalarProperty(save.raw, "playerProgress", FIELD, "skinHooty")
  assertEquals(r, "inserted")
  const projected = reprojectFriendly(save)
  assertEquals(projected.friendly.playerProgress[FIELD], "skinHooty")

  const bytes = await encode(projected)
  const decoded = await decodeSaveFromFile(toFile("76561198034513767.save", bytes))
  assertEquals(decoded.friendly.playerProgress[FIELD], "skinHooty")
})

// ─── joker slot ───────────────────────────────────────────────────────

Deno.test("jokers — setEquippedJokerSlot bootstraps a weapon entry and equips a joker", async () => {
  const { save } = await load()
  // Use a clearly-fake weapon id so the test is deterministic regardless
  // of which real weapons happen to be in the fixture's itemJokers map.
  const NEW_WEAPON = "itemRawOpsTestWeapon"
  const jokers = save.friendly.playerProgress.itemJokers ?? {}
  assert(!(NEW_WEAPON in jokers), "sentinel weapon pre-exists in fixture")

  const r = raw.setEquippedJokerSlot(save.raw, NEW_WEAPON, "A", "jokerStonks")
  // After bootstrap, the cloned template already contains jokerA/B/C/D
  // scalars (reset to "None"), so we overwrite an existing slot — the
  // structural insert happened at the *weapon-entry* level, not the slot.
  assert(r === "inserted" || r === "updated", `expected inserted/updated, got ${r}`)
  const projected = reprojectFriendly(save)
  assertEquals(projected.friendly.playerProgress.itemJokers[NEW_WEAPON].jokerA, "jokerStonks")

  const bytes = await encode(projected)
  const decoded = await decodeSaveFromFile(toFile("76561198034513767.save", bytes))
  assertEquals(decoded.friendly.playerProgress.itemJokers[NEW_WEAPON].jokerA, "jokerStonks")
})

// ─── weapon tweaks ────────────────────────────────────────────────────

Deno.test("tweaks — setWeaponTweak adds a tweak entry under an existing weapon", async () => {
  const { save } = await load()
  const upgrades = save.friendly.playerProgress.itemsUpgrades ?? {}
  // Pick the first weapon present and a tweak that isn't already in its map.
  const weapon = Object.keys(upgrades)[0]
  assertExists(weapon, "sample save has no itemsUpgrades — can't test tweak insert")
  const NEW_TWEAK = "jokerUpgradeRawOpsTestSentinel"
  assert(!(NEW_TWEAK in (upgrades[weapon].tweaks ?? {})))
  const r = raw.setWeaponTweak(save.raw, weapon, NEW_TWEAK, 5)
  assertEquals(r, "inserted")
  const projected = reprojectFriendly(save)
  assertEquals(projected.friendly.playerProgress.itemsUpgrades[weapon].tweaks[NEW_TWEAK], 5)

  const bytes = await encode(projected)
  const decoded = await decodeSaveFromFile(toFile("76561198034513767.save", bytes))
  assertEquals(decoded.friendly.playerProgress.itemsUpgrades[weapon].tweaks[NEW_TWEAK], 5)
})

// ─── manual game-side checklist ───────────────────────────────────────
//
// Once these tests pass, drop the saved file into the Far Far West save
// directory (e.g. via the editor app's Download button) and verify in
// the running game:
//
//   1. A previously-unowned item shows up in inventory at the right count.
//      (e.g. set a value for `itemSpellFireBeam` if you never picked it up)
//   2. A joker equipped on a never-upgraded weapon appears in the loadout
//      screen for that weapon (e.g. equip jokerStonks on itemDefaultGun).
//   3. A new weapon tweak takes effect — buff a stat that wasn't there.
//   4. A new loadout cosmetic (e.g. `title` set to a previously-locked id)
//      appears on the player.
//   5. The save loads without crashing.
