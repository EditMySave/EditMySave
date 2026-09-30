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
 *   node scripts/build-dungeons-2-catalog.mjs
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
    }),
  )
  .sort((a, b) => a.name.localeCompare(b.name))

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
}

await mkdir(OUTPUT_DIR, { recursive: true })
const out = `${OUTPUT_DIR}editor-catalog.json`
await writeFile(out, JSON.stringify(catalog, null, 1) + "\n")
console.log(
  `✓ ${items.length} items (${items.filter((i) => i.icon).length} with icons), ${equipSlots.length} slots, ${rarities.length} rarities, ${skins.length} skins, ` +
    `${Object.keys(achievements).length} achievements, ${minecartStations.length} stations → ${out}`,
)
