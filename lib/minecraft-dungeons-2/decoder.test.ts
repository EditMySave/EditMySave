// Tests for the Minecraft Dungeons 2 character save codec and mutations.
//
// Loads the immutable sample saves in ./fixtures and drives the browser-facing
// API (decodeSaveFromFile → encodeSaveToBlob) via a File wrapper, exactly as
// the app does. Character saves are plain JSON, so a no-edit roundtrip must be
// byte-identical.
//
// Run from the EditMySave repo root:  deno task test:minecraft-dungeons-2

import { assert, assertEquals, assertNotEquals, assertRejects } from "@std/assert"

import {
  type CharacterSave,
  EFFECT_BATCH,
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
  removeItemEffect,
  setItemEffect,
  setTalismanProgress,
} from "../../app/minecraft-dungeons-2/save-mutations.ts"

const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname
const CHARACTER = fixture("Character3e32bf70-bc1e-11f1-80e5-7294a1be58a5.sav")
const GLOBAL = fixture("GlobalSaveDataDefault.sav")
/** Level 8 save with enchantments, rolled effects and two talismans. */
const ENCHANTED = fixture("CharacterWithEnchant.sav")

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

// ── Effects & talismans (enchanted fixture) ─────────────────────────────

async function loadEnchanted() {
  const { raw, file } = await load(ENCHANTED)
  const save = await decodeSaveFromFile(file)
  const entries = save.CharacterSaveV1.Inventory!.Entries
  const find = (tag: string) => entries.findIndex((e) => e.ItemData.TypeTag === tag)
  return { raw, save, entries, find }
}

Deno.test("enchanted save round-trips byte-identical", async () => {
  const { raw, save } = await loadEnchanted()
  assertEquals(new Uint8Array(await (await encodeSaveToBlob(save)).arrayBuffer()), raw)
})

Deno.test("upgrading an enchantment rewrites only that effect", async () => {
  const { raw, save, find } = await loadEnchanted()
  const rapier = find("SW.Item.Rapier")
  const updated = setItemEffect(save, rapier, EFFECT_BATCH.enchantment, 0, {
    effect: "SW.Enchantment.Channeling",
    template: "SW.Enchantment.Channeling.II",
    value: 1,
    points: 3,
  })
  const before = '"TypeTag":"SW.Enchantment.Channeling","Intensity":1,"Quality":0,"EnchantmentPointsInvested":1,' +
    '"GeneratorData":{"GeneratorParentTemplate":"SW.Enchantment.Channeling.I","Locked":false}'
  const after = before.replace("Invested\":1", "Invested\":3").replace("Channeling.I\"", "Channeling.II\"")
  const original = new TextDecoder().decode(raw)
  assert(original.includes(before))
  assertEquals(await encode(updated), original.replace(before, after))
})

Deno.test("adding and removing effects keeps the game's batch order", async () => {
  const { save, find } = await loadEnchanted()
  const sword = find("SW.Item.Sword")
  // Enchant first, then roll an effect: the Rerollable batch must still come first.
  let updated = setItemEffect(save, sword, EFFECT_BATCH.enchantment, 0, {
    effect: "SW.Enchantment.FireAspect",
    template: "SW.Enchantment.FireAspect.I",
    value: 1,
    points: 1,
  })
  updated = setItemEffect(updated, sword, EFFECT_BATCH.rerollable, 0, {
    effect: "SW.Effect.Sharpness",
    template: "SW.EffectTemplate.Sharpness.I",
    value: 0.1,
  })
  const batches = updated.CharacterSaveV1.Inventory!.Entries[sword].ItemData.Effects
  assertEquals(batches.map((b) => b.TypeTag), [EFFECT_BATCH.rerollable, EFFECT_BATCH.enchantment])
  assertEquals(batches[0].EffectsInThisBatch[0], {
    TypeTag: "SW.Effect.Sharpness",
    Intensity: 0.1,
    Quality: 0,
    EnchantmentPointsInvested: 0,
    GeneratorData: { GeneratorParentTemplate: "SW.EffectTemplate.Sharpness.I", Locked: false },
  })
  // Removing the last effect in a batch drops the batch.
  const removed = removeItemEffect(updated, sword, EFFECT_BATCH.enchantment, 0)
  assertEquals(removed.CharacterSaveV1.Inventory!.Entries[sword].ItemData.Effects.map((b) => b.TypeTag), [
    EFFECT_BATCH.rerollable,
  ])
})

Deno.test("talisman level copies that level's effects into the active batch", async () => {
  const { save, find } = await loadEnchanted()
  const idx = find("SW.Item.Talisman.HealthBoost")
  const data = setTalismanProgress(save, idx, 2, 100).CharacterSaveV1.Inventory!.Entries[idx].ItemData
  assertEquals(data.ItemProgression.CurrentLevel, 2)
  assertEquals(data.ItemProgression.CurrentXP, 100)
  const active = data.Effects.find((b) => b.TypeTag === EFFECT_BATCH.upgradable)!.EffectsInThisBatch
  assertEquals(active[0].GeneratorData.GeneratorParentTemplate, "SW.EffectTemplate.HealthBoost.III")
  assertEquals(active[0].Intensity, 1.35)
})

Deno.test("companion talismans keep an empty active batch", async () => {
  const { save, find } = await loadEnchanted()
  const idx = find("SW.Item.Talisman.Wolf")
  const data = setTalismanProgress(save, idx, 1, 0).CharacterSaveV1.Inventory!.Entries[idx].ItemData
  assertEquals(data.Effects, [{ TypeTag: EFFECT_BATCH.upgradable, EffectsInThisBatch: [] }])
})

Deno.test("a new talisman matches the layout the game writes", async () => {
  const { save, entries, find } = await loadEnchanted()
  const game = entries[find("SW.Item.Talisman.HealthBoost")].ItemData
  const updated = addItem(save, {
    tag: "SW.Item.Talisman.HealthBoost",
    rarity: "SW.Rarity.None",
    power: 0,
    hasPower: false,
    collectionKey: "CollectedTalismans",
    talisman: ["I", "II", "III"].map((tier, i) => ({
      effect: {
        effect: "SW.Effect.HealthBoost",
        template: `SW.EffectTemplate.HealthBoost.${tier}`,
        value: [1.2, 1.25, 1.35][i],
      },
    })),
  })
  const added = updated.CharacterSaveV1.Inventory!.Entries.at(-1)!.ItemData
  assertEquals(added.Effects, game.Effects)
  assertEquals(added.ItemProgression.ItemLevels, game.ItemProgression.ItemLevels)
  assertEquals(added.RarityTag, "SW.Rarity.None")
})
