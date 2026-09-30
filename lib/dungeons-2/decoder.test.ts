// Tests for the Minecraft Dungeons 2 character save codec and mutations.
//
// Loads the immutable sample saves in ./fixtures and drives the browser-facing
// API (decodeSaveFromFile → encodeSaveToBlob) via a File wrapper, exactly as
// the app does. Character saves are plain JSON, so a no-edit roundtrip must be
// byte-identical.
//
// Run from the EditMySave repo root:  deno task test:dungeons-2

import { assert, assertEquals, assertNotEquals, assertRejects } from "@std/assert"

import {
  type CharacterSave,
  decodeSaveFromFile,
  encodeSaveToBlob,
  getAttribute,
  isRawNumber,
  NO_SLOT,
  numberValue,
  parseLossless,
} from "./decoder.ts"
import {
  addItem,
  completeAllAchievements,
  MINECART_ACHIEVEMENT,
  setMinecartStation,
  claimMerchantItem,
  completeQuest,
  duplicateItem,
  setAttribute,
  setEquippedSlot,
  setLevel,
  setMetaFlag,
} from "../../app/dungeons-2/save-mutations.ts"

const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname
const CHARACTER = fixture("Character3e32bf70-bc1e-11f1-80e5-7294a1be58a5.sav")
const GLOBAL = fixture("GlobalSaveDataDefault.sav")

async function load(path: string): Promise<{ raw: Uint8Array; file: File }> {
  const raw = await Deno.readFile(path)
  return { raw, file: new File([raw], path.split("/").pop()!) }
}

async function encode(save: CharacterSave): Promise<string> {
  return new TextDecoder().decode(new Uint8Array(await (await encodeSaveToBlob(save)).arrayBuffer()))
}

Deno.test("character save round-trips byte-identical", async () => {
  const { raw, file } = await load(CHARACTER)
  const save = await decodeSaveFromFile(file)
  const out = new Uint8Array(await (await encodeSaveToBlob(save)).arrayBuffer())
  assertEquals(out, raw)
})

Deno.test("attribute edit changes only that field", async () => {
  const { raw, file } = await load(CHARACTER)
  const save = await decodeSaveFromFile(file)
  assertEquals(getAttribute(save, "Emeralds"), 46)
  const text = await encode(setAttribute(save, "Emeralds", 9999))
  const original = new TextDecoder().decode(raw)
  assertEquals(
    text,
    original.replace(
      '"AttributeName":"Emeralds","CurrentValue":46',
      '"AttributeName":"Emeralds","CurrentValue":9999',
    ),
  )
})

Deno.test("missing attribute is appended", async () => {
  const save = await decodeSaveFromFile((await load(CHARACTER)).file)
  const updated = setAttribute(save, "BrandNew", 5)
  assertEquals(getAttribute(updated, "BrandNew"), 5)
  assertEquals(updated.CharacterSaveV1.Ability.Attributes.length, save.CharacterSaveV1.Ability.Attributes.length + 1)
})

Deno.test("int64 ticks beyond 2^53 survive", () => {
  const parsed = parseLossless('{"t":639262945959731234}') as { t: unknown }
  assert(isRawNumber(parsed.t))
  assertEquals(JSON.stringify(parsed), '{"t":639262945959731234}')
  assertEquals(numberValue(parseLossless("38.791999816894531")), 38.791999816894531)
})

Deno.test("non-character files are rejected with a friendly error", async () => {
  await assertRejects(
    async () => decodeSaveFromFile((await load(GLOBAL)).file),
    Error,
    "settings file",
  )
})

Deno.test("setLevel updates attribute and metadata", async () => {
  const save = setLevel(await decodeSaveFromFile((await load(CHARACTER)).file), 42)
  assertEquals(getAttribute(save, "Level"), 42)
  assertEquals(save.CharacterSaveV1.MetaData.Level, 42)
})

Deno.test("equipment slots stay exclusive", async () => {
  const save = await decodeSaveFromFile((await load(CHARACTER)).file)
  const entries = save.CharacterSaveV1.Inventory!.Entries
  const melee = "SW.ItemSlot.Equipment.MeleeWeapon"
  const current = entries.findIndex((e) => e.EquippedSlot === melee)
  const other = entries.findIndex((e) => e.ItemData.TypeTag === "SW.Item.GiantClub")
  const updated = setEquippedSlot(save, other, melee).CharacterSaveV1.Inventory!.Entries
  assertEquals(updated[other].EquippedSlot, melee)
  assertEquals(updated[current].EquippedSlot, NO_SLOT)
  assertEquals(updated.filter((e) => e.EquippedSlot === melee).length, 1)
})

Deno.test("duplicateItem clears slot and reseeds", async () => {
  const save = await decodeSaveFromFile((await load(CHARACTER)).file)
  const entries = save.CharacterSaveV1.Inventory!.Entries
  const idx = entries.findIndex((e) => e.EquippedSlot !== NO_SLOT)
  const updated = duplicateItem(save, idx).CharacterSaveV1.Inventory!.Entries
  const copy = updated[updated.length - 1]
  assertEquals(updated.length, entries.length + 1)
  assertEquals(copy.ItemData.TypeTag, entries[idx].ItemData.TypeTag)
  assertEquals(copy.EquippedSlot, NO_SLOT)
  assertNotEquals(copy.ItemData.GeneratorData.GenesisRandomSeed, entries[idx].ItemData.GeneratorData.GenesisRandomSeed)
  // Original untouched.
  assertNotEquals(entries[idx].EquippedSlot, NO_SLOT)
  // Serialises without raw-number objects leaking through.
  assert(!(await encode(duplicateItem(save, idx))).includes("rawJSON"))
})

Deno.test("addItem builds a fresh item and records discovery + collection", async () => {
  const save = await decodeSaveFromFile((await load(CHARACTER)).file)
  const tag = "SW.Item.Axe_Unique1"
  const updated = addItem(save, {
    tag,
    rarity: "SW.Rarity.Unique",
    power: 25,
    hasPower: true,
    collectionKey: "CollectedWeaponsUnique",
  })
  const added = updated.CharacterSaveV1.Inventory!.Entries.at(-1)!
  // Same field layout as a game-written entry.
  const template = save.CharacterSaveV1.Inventory!.Entries[0]
  assertEquals(Object.keys(added), Object.keys(template))
  assertEquals(Object.keys(added.ItemData), Object.keys(template.ItemData))
  assertEquals(
    Object.keys(added.ItemData.GeneratorData.PowerGeneratorValues),
    Object.keys(template.ItemData.GeneratorData.PowerGeneratorValues),
  )
  assertEquals(added.ItemData.TypeTag, tag)
  assertEquals(added.ItemData.GeneratorData.PowerGeneratorValues.ItemPower, 25)
  assertEquals(added.ItemData.TargetSlotOverride, NO_SLOT)
  assert(updated.CharacterSaveV1.LootProgression!.DiscoveredLoot.includes(tag))
  assert((updated.CharacterSaveV1.CollectionsStats!.CollectedWeaponsUnique as string[]).includes(tag))
})

Deno.test("addItem without power stores -1 like capes and pets", async () => {
  const save = await decodeSaveFromFile((await load(CHARACTER)).file)
  const updated = addItem(save, { tag: "SW.Item.Cosmetic.Pet.Blub", rarity: "SW.Rarity.Common", power: 50, hasPower: false })
  const values = updated.CharacterSaveV1.Inventory!.Entries.at(-1)!.ItemData.GeneratorData.PowerGeneratorValues
  assertEquals(values.ItemPower, -1)
  assertEquals(values.ItemPowerOriginal, 0)
})

Deno.test("minecart stations stay in sync with the collection achievement", async () => {
  const save = await decodeSaveFromFile((await load(CHARACTER)).file)
  const station = "SW.MinecartStation.PlainsA1.Barn"
  const on = setMinecartStation(save, station, true).CharacterSaveV1
  assert(on.WorldExploration!.DiscoveredMinecartStationTags!.includes(station))
  assert(on.Achievements!.CollectionAchievements![MINECART_ACHIEVEMENT].CollectedTags.includes(station))
  const off = setMinecartStation({ ...save, CharacterSaveV1: on }, station, false).CharacterSaveV1
  assert(!off.WorldExploration!.DiscoveredMinecartStationTags!.includes(station))
  assert(!off.Achievements!.CollectionAchievements![MINECART_ACHIEVEMENT].CollectedTags.includes(station))
})

Deno.test("completeAllAchievements raises counters to their targets", async () => {
  const save = await decodeSaveFromFile((await load(CHARACTER)).file)
  const updated = completeAllAchievements(save, {
    counts: { "SW.Achievements.Open100Chests": 100 },
    collections: { [MINECART_ACHIEVEMENT]: ["SW.MinecartStation.Town", "SW.MinecartStation.PlainsA1.Barn"] },
  }).CharacterSaveV1
  assertEquals(updated.Achievements!.CountAchievements!["SW.Achievements.Open100Chests"].Count, 100)
  assert(Object.values(updated.Achievements!.BoolAchievements!).every((a) => a.bCompleted))
  assertEquals(updated.WorldExploration!.DiscoveredMinecartStationTags, [
    "SW.MinecartStation.Town",
    "SW.MinecartStation.PlainsA1.Barn",
  ])
})

Deno.test("claimMerchantItem moves stock into the inventory", async () => {
  const save = await decodeSaveFromFile((await load(CHARACTER)).file)
  const idx = save.CharacterSaveV1.Inventory!.Entries.findIndex((e) =>
    e.ItemData.TargetSlotOverride.includes("VillageMerchant")
  )
  const entry = claimMerchantItem(save, idx).CharacterSaveV1.Inventory!.Entries[idx]
  assertEquals(entry.ItemData.TargetSlotOverride, NO_SLOT)
  assertEquals(entry.MerchantDiscount, 0)
})

Deno.test("completeQuest completes every task", async () => {
  const save = completeQuest(await decodeSaveFromFile((await load(CHARACTER)).file), "CA01")
  const quest = save.CharacterSaveV1.quest!.Quests.find((q) => q.QuestName === "CA01")!
  assertEquals(quest.State, "Completed")
  assert(quest.TaskData.every((t) => t.State === "Completed"))
})

Deno.test("setMetaFlag toggles only that MetaData flag", async () => {
  const { raw, file } = await load(CHARACTER)
  const save = await decodeSaveFromFile(file)
  assertEquals(save.CharacterSaveV1.MetaData.IsOnline, false)
  const text = await encode(setMetaFlag(save, "IsOnline", true))
  assertEquals(text, new TextDecoder().decode(raw).replace('"IsOnline":false', '"IsOnline":true'))
})
