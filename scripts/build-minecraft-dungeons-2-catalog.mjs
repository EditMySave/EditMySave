/**
 * Builds the slim Minecraft Dungeons 2 catalog the editor ships with.
 *
 * Input:  experiments/dungeons-2/catalog.json          (~15 MB full datamine, gitignored)
 *         data/minecraft-dungeons-2/catalog.json      (public catalog; supplies iconFile paths)
 * Output: data/minecraft-dungeons-2/editor-catalog.json (only what the editor uses)
 *
 * The public catalog strips the raw table rows, which hold achievement targets,
 * quest links, collection lists, DLC gating and rarity data, so both are read.
 *
 * Usage (from the repo root):
 *   node scripts/build-minecraft-dungeons-2-catalog.mjs
 *
 * Re-run after regenerating the full catalog for a new game version.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const INPUT = fileURLToPath(new URL("../experiments/dungeons-2/catalog.json", import.meta.url))
const PUBLIC_CATALOG = fileURLToPath(new URL("../data/minecraft-dungeons-2/catalog.json", import.meta.url))
const OUTPUT_DIR = fileURLToPath(new URL("../data/minecraft-dungeons-2/", import.meta.url))

const full = JSON.parse(await readFile(INPUT, "utf8"))
const publicEntries = JSON.parse(await readFile(PUBLIC_CATALOG, "utf8")).entries

/** Icon path relative to /images/minecraft-dungeons-2, e.g. "icons/SW.Item.Sword.png". */
const iconFile = (tag) => publicEntries[tag]?.iconFile
const entries = Object.values(full.entries)
const byKind = (kind) => entries.filter((e) => e.kind === kind)

/** DLC gating: e.g. "SW.Product.DeluxeEdition" when the entry isn't always available. */
function product(e) {
  const a = e.raw?.AvailabilityData
  if (!a || a.bAlwaysAvailable) return undefined
  return a.UpsellProduct?.TagName && a.UpsellProduct.TagName !== "None" ? a.UpsellProduct.TagName : undefined
}

/** Drop undefined / empty-array fields to keep the output small. */
function compact(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)),
  )
}

const tagList = (container) => (container?.GameplayTags ?? []).map((t) => t.TagName)

// ── Items ───────────────────────────────────────────────────────────────
// Abstract bases (no display name) aren't real items.
const ARMOR_PIECE = /^SW\.Item\.Property\.Armor\.(Boots|Chest|Helmet|Leggings)$/

// ── Rolled-effect compatibility ─────────────────────────────────────────
// Each effect template category (SW.EffectTemplate.Weapon, .CrossbowOnly, …) has an
// IncompatibleTagsQuery. We evaluate it against every item's tags so the editor only
// offers effects the game could roll on that item.

/** A tag plus all its parents: "SW.Item.Property.Armor.Boots" → …Armor.Boots, …Armor, … */
function withParents(tag) {
  const parts = tag.split(".")
  return parts.map((_, i) => parts.slice(0, i + 1).join("."))
}

/** Parse the query's AutoDescription, e.g. "ALL( ANY( a, b ), NONE( c ) )". */
function parseQuery(text) {
  const tokens = text.match(/ALL\(|ANY\(|NONE\(|\)|[^\s,()]+/g) ?? []
  let i = 0
  function expr() {
    const op = tokens[i++].slice(0, -1)
    const args = []
    while (tokens[i] !== ")") args.push(tokens[i].endsWith("(") ? expr() : tokens[i++])
    i++ // ")"
    return { op, args }
  }
  return expr()
}

function matches(query, tags) {
  const test = (a) => (typeof a === "string" ? tags.has(a) : matches(a, tags))
  if (query.op === "ANY") return query.args.some(test)
  if (query.op === "ALL") return query.args.every(test)
  return !query.args.some(test) // NONE
}

const effectGroupQueries = Object.fromEntries(
  entries
    .filter((e) => e.kind === "effectTemplate" && e.raw?.TemplateData?.IncompatibleTagsQuery?.AutoDescription)
    .map((e) => [e.tag.replace("SW.EffectTemplate.", ""), parseQuery(e.raw.TemplateData.IncompatibleTagsQuery.AutoDescription.trim())]),
)

// The item table an entry comes from implies its property tag; some items (quivers)
// don't repeat it in their traits.
const CATEGORY_PROPERTY = {
  melee: "SW.Item.Property.MeleeWeapon",
  ranged: "SW.Item.Property.RangedWeapon",
  armor: "SW.Item.Property.Armor",
  artifact: "SW.Item.Property.Artifact",
}

/** Effect template groups an item can roll ("Weapon", "MeleeWeapon", "CrossbowOnly", …). */
function effectGroupsFor(e) {
  const tags = new Set([e.tag, ...e.traits, CATEGORY_PROPERTY[e.category]].filter(Boolean).flatMap(withParents))
  return Object.entries(effectGroupQueries)
    .filter(([, query]) => !matches(query, tags))
    .map(([group]) => group)
}

const EFFECT_CATEGORIES = new Set(["melee", "ranged", "armor", "artifact"])

const items = byKind("item")
  .filter((e) => e.displayName)
  .map((e) =>
    compact({
      tag: e.tag,
      name: e.displayName,
      description: e.description,
      category: e.category,
      armorPiece: e.traits.map((t) => t.match(ARMOR_PIECE)?.[1]).find(Boolean),
      unique: e.traits.includes("SW.Item.Property.Unique") || undefined,
      uniqueOf: e.uniqueOf ?? undefined,
      baseOf: e.uniqueVariants,
      product: product(e),
      icon: iconFile(e.tag),
      effectGroups: EFFECT_CATEGORIES.has(e.category) ? effectGroupsFor(e) : undefined,
    }),
  )
  .sort((a, b) => a.name.localeCompare(b.name))

// ── Enchantments & rolled effects ───────────────────────────────────────
const TIERS = ["I", "II", "III", "Unique"]
const byTag = full.entries

/** Tier templates of a base tag: SW.Enchantment.Channeling → .I/.II/.III with their values. */
function tiersOf(prefix) {
  return TIERS.map((tier) => {
    // The game data has at least one casing typo ("SW.Effecttemplate.Protection.Unique").
    const e = byTag[`${prefix}.${tier}`] ?? entries.find((x) => x.tag.toLowerCase() === `${prefix}.${tier}`.toLowerCase())
    const data = e?.raw?.TemplateData
    return data && { tier, tag: e.tag, value: data.FixedEffectValue, minPower: data.MinimumRequiredItemPower || undefined }
  }).filter(Boolean).map(compact)
}

const effectCategory = (e) => e.traits.find((t) => t.startsWith("SW.EffectCategory."))?.replace("SW.EffectCategory.", "")

// Regular enchantments only; soul enchantments are a separate artifact system.
const enchantments = entries
  .filter((e) => e.kind === "enchantment" && e.displayName && e.traits.includes("SW.Enchantment"))
  .map((e) =>
    compact({
      tag: e.tag,
      name: e.displayName,
      description: e.description,
      category: effectCategory(e),
      icon: iconFile(e.tag),
      tiers: tiersOf(e.tag),
    }),
  )
  .filter((e) => e.tiers?.length)
  .sort((a, b) => a.name.localeCompare(b.name))

// Rolled effects, grouped by template base (SW.EffectTemplate.BagOfSouls.* → SW.Effect.SoulMax).
const templateBases = new Map()
for (const e of entries) {
  if (e.kind !== "effectTemplate") continue
  const m = e.tag.match(/^SW\.Effect[Tt]emplate\.(.+)\.(I|II|III|Unique)$/)
  if (!m || !e.raw?.TemplateData?.Effect?.TagName) continue
  const group = e.traits.find((t) => /^SW\.EffectTemplate\.(?!Tier)/.test(t))?.replace("SW.EffectTemplate.", "")
  const base = templateBases.get(m[1]) ?? { effect: e.raw.TemplateData.Effect.TagName, groups: new Set() }
  if (group) base.groups.add(group)
  templateBases.set(m[1], base)
}

const effects = [...templateBases]
  .filter(([, b]) => b.groups.size > 0) // talisman templates have no item group
  .map(([name, b]) => {
    const def = byTag[b.effect]
    return compact({
      template: `SW.EffectTemplate.${name}`,
      effect: b.effect,
      name: def?.displayName ?? name,
      description: def?.description,
      category: def && effectCategory(def),
      icon: iconFile(b.effect),
      groups: [...b.groups],
      tiers: tiersOf(`SW.EffectTemplate.${name}`),
    })
  })
  .filter((e) => e.tiers?.length)
  .sort((a, b) => a.name.localeCompare(b.name))

// Enchantsmith costs per rarity (GA_ItemEnchant on the player definition).
const enchantAbility = byTag["SW.Player"]?.raw?.Abilities?.find((a) => a.Ability?.endsWith("GA_ItemEnchant"))
const enchantCosts = Object.fromEntries(
  Object.entries(enchantAbility?.InstanceData?.[0]?.EnchantCostMap ?? {}).map(([key, c]) => [
    key.match(/"(.+)"/)[1],
    { points: c.EnchantmentPointCost, pointsPerLevel: c.EnchantmentPointAdditionalCostPerLevel },
  ]),
)

const rerollableEffectCounts = Object.fromEntries(
  byKind("rarity").map((e) => [e.tag, e.raw.RarityDefinition.NumberOfEffectsData?.BaseNumberOfRerollableEffects ?? 0]),
)

// ── Slots / rarities / skins / areas ────────────────────────────────────
const slotTags = byKind("itemSlot").map((e) => e.tag)
// Leaf equipment slots only ("Equipment.Artifact" is the parent of Slot0..3).
const equipSlots = slotTags
  .filter((t) => t.startsWith("SW.ItemSlot.Equipment.") && !slotTags.some((o) => o.startsWith(`${t}.`)))
  .sort()

const rarities = byKind("rarity")
  .filter((e) => !["SW.Rarity.Base", "SW.Rarity.None"].includes(e.tag))
  .map((e) => ({
    tag: e.tag,
    name: e.name,
    weight: e.raw.RarityDefinition.RarityWeight,
    powerOffset: e.raw.RarityDefinition.ItemPowerGenerationOffset,
    effects: e.raw.RarityDefinition.NumberOfEffectsData?.BaseNumberOfRerollableEffects ?? 0,
  }))
  .sort((a, b) => a.weight - b.weight)

const skins = byKind("skin")
  .map((e) =>
    compact({
      tag: e.tag,
      name: (e.displayName ?? e.name).replace(/ Skin$/, ""),
      product: product(e),
      icon: iconFile(e.tag),
    }),
  )
  .sort((a, b) => a.name.localeCompare(b.name))

const areas = Object.fromEntries(
  entries.filter((e) => e.tag.startsWith("SW.Area") && e.displayName).map((e) => [e.tag, e.displayName]),
)

// ── Achievements & quests ───────────────────────────────────────────────
function titleCase(id) {
  return id
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

const achievements = Object.fromEntries(
  entries
    .filter((e) => e.source === "DT_AchievementDefinition")
    .map((e) => {
      const c = e.raw.Condition ?? {}
      return [
        e.tag,
        compact({
          name: titleCase(e.raw.AchievementId ?? e.name).replace(/^Complete (.+) Quest$/, "$1"),
          quest: c.QuestState?.QuestName,
          target: c.MaxAmount,
          collection: tagList(c.CollectionTags),
          maxEnchantLevel: c.MaxEnchantmentLevel,
        }),
      ]
    }),
)

// Quest ids (CA00, PLa1_S08_A, ...) → friendly names via their achievement.
const questNames = {}
for (const a of Object.values(achievements)) {
  if (a.quest && !questNames[a.quest]) questNames[a.quest] = a.name
}

const minecartStations =
  achievements["SW.Achievements.DiscoverAllMinecartStations"]?.collection ??
  entries.filter((e) => e.tag.startsWith("SW.MinecartStation.") && e.tag.split(".").length > 3).map((e) => e.tag)

const catalog = {
  game: full.game,
  generatedAt: full.generatedAt,
  items,
  equipSlots,
  rarities,
  skins,
  areas,
  achievements,
  questNames,
  minecartStations,
  enchantments,
  effects,
  enchantCosts,
  rerollableEffectCounts,
}

await mkdir(OUTPUT_DIR, { recursive: true })
const out = `${OUTPUT_DIR}editor-catalog.json`
await writeFile(out, JSON.stringify(catalog, null, 1) + "\n")
console.log(
  `✓ ${items.length} items (${items.filter((i) => i.icon).length} with icons), ${equipSlots.length} slots, ${rarities.length} rarities, ${skins.length} skins, ` +
    `${Object.keys(achievements).length} achievements, ${minecartStations.length} stations, ` +
    `${enchantments.length} enchantments, ${effects.length} rolled effects → ${out}`,
)
