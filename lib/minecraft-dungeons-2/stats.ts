/**
 * Predicted gear stats for Minecraft Dungeons 2.
 *
 * Weapon base values come from data/minecraft-dungeons-2/gear-stats.json; effect
 * values are formatted exactly as the game does (editor_data.json formatting).
 * Item Power scales damage against the area's level up to the rule set's cap,
 * but that formula lives in game code, so predictions here are base values
 * adjusted only by the item's own always-on effects.
 */
import gearData from "@/data/minecraft-dungeons-2/gear-stats.json"
import { EFFECT_BATCH, type InventoryEntry, numberValue } from "./decoder"
import { RULES, describeEffect, effectDisplayValue, formatEffectValue, gameEffect, gameEnchantment } from "./catalog"

/** A combo hit: damage, or [damage, repeat count] for multi-hit swings. */
export type ComboHit = number | [number, number]

export interface MeleeStats {
  name: string
  weight: "light" | "medium" | "heavy" | "fist"
  combo: ComboHit[]
  total: number
  jump: number
  reach: number
  /** Fraction of damage dealt to enemies next to the target. */
  splash: number
}

export interface RangedStats {
  name: string
  damage: number
  arrows: number
  /** Seconds between shots. */
  rate: number
  ammo: number
  reload: number
  chargeTime?: number
  chargeMultiplier?: number
}

export interface EffectStats {
  name: string
  group: string
  /** Percent per tier; `true` for on/off effects (e.g. Pyrotechnics). */
  tiers: Partial<Record<Tier, number | true>>
  /** Description with X as the value placeholder. */
  text: string
}

export type Tier = "I" | "II" | "III" | "Unique"

interface GearData {
  rules: {
    powerMultiplierCap: number
    veryLowPowerRatio: number
    dropPowerAboveLevel: number
    maxRolledEffects: number
    defaultSplash: number
  }
  melee: Record<string, MeleeStats>
  ranged: Record<string, RangedStats>
  effects: Record<string, EffectStats>
}

const gear = gearData as unknown as GearData

export const GEAR_RULES = {
  ...gear.rules,
  // The live rule set's scaling caps (weapons / armor) override the guide's 1.75x.
  powerMultiplierCap: RULES.factorConstants.LimitValue,
  armorPowerMultiplierCap: RULES.factorConstantsArmor.LimitValue,
  maxRolledEffects: RULES.rolledEffects.max,
}

/**
 * Base weapon stats. Uniques not listed separately share their base weapon's
 * stats, so pass the base tags (catalog `baseOf`) as a fallback.
 */
export function meleeStats(tag: string, baseTags: string[] = []): MeleeStats | undefined {
  return gear.melee[tag] ?? baseTags.map((t) => gear.melee[t]).find(Boolean)
}

export function rangedStats(tag: string, baseTags: string[] = []): RangedStats | undefined {
  return gear.ranged[tag] ?? baseTags.map((t) => gear.ranged[t]).find(Boolean)
}

export function formatCombo(combo: ComboHit[], scale = 1): string {
  return combo
    .map((hit) => (Array.isArray(hit) ? `${round(hit[0] * scale)} (x${hit[1]})` : `${round(hit * scale)}`))
    .join(" / ")
}

export function round(n: number, digits = 1): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

// ── Effects on an item ──────────────────────────────────────────────────

export type EffectKind = "enchantment" | "rolled" | "talisman"

export interface ItemEffectInfo {
  kind: EffectKind
  /** SW.Effect.* / SW.Enchantment.* */
  tag: string
  template: string
  tier?: Tier
  /** Percent from the gear tables, when known. */
  percent?: number
  /** True for on/off unique effects. */
  flag?: boolean
  /** Raw Intensity stored in the save. */
  raw: number
  name?: string
  /** Description with the value filled in. */
  text?: string
  /** Formatted value ("10%"), when the game defines a format for this effect. */
  valueLabel?: string
}

const BATCH_KIND: Record<string, EffectKind> = {
  [EFFECT_BATCH.enchantment]: "enchantment",
  [EFFECT_BATCH.rerollable]: "rolled",
  [EFFECT_BATCH.upgradable]: "talisman",
}

function tierOf(template: string): Tier | undefined {
  const suffix = template.split(".").pop()
  return suffix === "I" || suffix === "II" || suffix === "III" || suffix === "Unique" ? suffix : undefined
}

export function formatPercent(percent: number): string {
  return `${round(percent)}%`
}

/** Every effect on an item, named and formatted the way the game shows it. */
export function itemEffects(entry: InventoryEntry): ItemEffectInfo[] {
  return (entry.ItemData.Effects ?? []).flatMap((batch) =>
    (batch.EffectsInThisBatch ?? []).map((e) => {
      const template = e.GeneratorData?.GeneratorParentTemplate ?? ""
      const tier = tierOf(template)
      const raw = numberValue(e.Intensity)
      const display = effectDisplayValue(e.TypeTag, raw)
      // On/off unique effects (Pyrotechnics…) have no number to show.
      const flag = !display && !!gameEffect(e.TypeTag) && !gameEffect(e.TypeTag)?.formatting
      return {
        kind: BATCH_KIND[batch.TypeTag] ?? "rolled",
        tag: e.TypeTag,
        template,
        tier,
        percent: display?.percent ? display.value : undefined,
        flag: flag || undefined,
        raw,
        name: gameEffect(e.TypeTag)?.displayName ?? gameEnchantment(e.TypeTag)?.displayName ?? gear.effects[e.TypeTag]?.name,
        text: describeEffect(e.TypeTag, raw),
        valueLabel: formatEffectValue(e.TypeTag, raw),
      }
    }),
  )
}

function percentOf(effects: ItemEffectInfo[], name: string): number {
  return effects.filter((e) => e.name === name).reduce((sum, e) => sum + (e.percent ?? 0), 0)
}

// Effects that change a weapon's numbers in every situation get folded into the
// prediction; situational ones (Duelist, Vanguard, crits…) are listed instead.
const ALWAYS_ON = new Set(["Sharpness", "Impact", "Sharpshooter", "Reload", "Quiver"])

export function isAlwaysOn(effect: ItemEffectInfo): boolean {
  return !!effect.name && ALWAYS_ON.has(effect.name)
}

// ── Predictions ─────────────────────────────────────────────────────────

export interface MeleePrediction {
  base: MeleeStats
  /** Damage multiplier from Sharpness. */
  damageBonus: number
  combo: string
  total: number
  jump: number
  splashTotal: number
}

export function predictMelee(base: MeleeStats, effects: ItemEffectInfo[]): MeleePrediction {
  const damageBonus = percentOf(effects, "Sharpness") / 100
  const scale = 1 + damageBonus
  return {
    base,
    damageBonus,
    combo: formatCombo(base.combo, scale),
    total: round(base.total * scale),
    jump: round(base.jump * scale),
    splashTotal: round(base.total * scale * base.splash),
  }
}

export interface RangedPrediction {
  base: RangedStats
  damageBonus: number
  damage: number
  /** Seconds between shots after Reload. */
  rate: number
  ammo: number
  /** Uncharged damage per second: damage × arrows ÷ rate. */
  dps: number
  baseDps: number
  charged?: number
}

export function predictRanged(base: RangedStats, effects: ItemEffectInfo[]): RangedPrediction {
  const damageBonus = percentOf(effects, "Impact") / 100
  const damage = base.damage * (1 + damageBonus)
  const rate = base.rate * (1 - percentOf(effects, "Reload") / 100)
  const ammo = Math.floor(base.ammo * (1 + percentOf(effects, "Quiver") / 100))
  const charged =
    base.chargeMultiplier !== undefined
      ? damage * base.chargeMultiplier * (1 + percentOf(effects, "Sharpshooter") / 100)
      : undefined
  return {
    base,
    damageBonus,
    damage: round(damage),
    rate: round(rate, 3),
    ammo,
    dps: round((damage * base.arrows) / rate),
    baseDps: round((base.damage * base.arrows) / base.rate),
    charged: charged !== undefined ? round(charged) : undefined,
  }
}

// ── Item Power ──────────────────────────────────────────────────────────

export type PowerStanding = "very-low" | "ok" | "above"

/**
 * Item Power compared with the character's level. The game compares gear with
 * the area's recommended power (not stored in saves); items drop near the
 * player's level, so level is the closest reference available.
 */
export function powerStanding(power: number, level: number): { ratio: number; standing: PowerStanding } {
  const ratio = level > 0 ? power / level : 1
  const standing = ratio < GEAR_RULES.veryLowPowerRatio ? "very-low" : ratio > 1 ? "above" : "ok"
  return { ratio, standing }
}

/** Highest Item Power a drop can roll at this level. */
export function maxDropPower(level: number): number {
  return Math.max(1, level) + GEAR_RULES.dropPowerAboveLevel
}

/** Sum of each effect's percentage across a set of items (e.g. everything equipped). */
export function effectTotals(entries: InventoryEntry[]): { name: string; percent: number; count: number }[] {
  const totals = new Map<string, { percent: number; count: number }>()
  for (const entry of entries) {
    for (const e of itemEffects(entry)) {
      if (!e.name || e.percent === undefined) continue
      const t = totals.get(e.name) ?? { percent: 0, count: 0 }
      totals.set(e.name, { percent: t.percent + e.percent, count: t.count + 1 })
    }
  }
  return [...totals].map(([name, t]) => ({ name, ...t })).sort((a, b) => b.percent - a.percent)
}
