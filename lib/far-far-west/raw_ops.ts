// Structural edits on the raw GVAS scaffold.
//
// The decoder's `graftProperties` is value-only — it patches existing
// properties in place but refuses to add or remove structure (silently
// ignores new map/inventory keys, errors on array-length mismatch). The
// React UI's "give all items" / "unlock all jokers" / "equip joker on
// any weapon" flows therefore can't actually write any of the new
// entries that don't already happen to be in the save.
//
// This module fills that gap. Every insert follows the same pattern:
//
//   1) Find the target property by dotted path.
//   2) If a sibling element already represents the same key/id, patch
//      its value and return `"updated"`.
//   3) Otherwise `structuredClone` an existing sibling — its `_type`,
//      `_meta`, `_meta_raw`, FName envelope and value shape are exactly
//      what `serializeGvas` expects to encode — overwrite the leaf
//      value(s), and push the clone in.
//
// `_meta_raw` is intentionally reused: UE writes the array's element
// descriptor once for the outer container, not per element, so the
// same descriptor bytes are byte-faithful for any new element of the
// same array/map. Same for the FName suffix — UE's loader re-interns
// FName indices at load time, so suffix-reuse doesn't cause a clash.

import type { GvasFile } from "./decoder"
import { stripFNameSuffix } from "./decoder"

type Any = any
type Property = Any
type PropertyList = Property[]

// ─── path navigation ─────────────────────────────────────────────────────

function findProperty(props: PropertyList, name: string): Property | undefined {
  return props.find((p) => stripFNameSuffix(p._name) === name)
}

// Walk a dotted path through the gvas tree. Descends into StructProperty
// values (which are themselves property lists). Stops at the named leaf;
// returns the property reference or undefined.
function findPath(gvas: GvasFile, path: string): Property | undefined {
  if (!path) return undefined
  const parts = path.split(".")
  let list: PropertyList = gvas.properties
  let prop: Property | undefined
  for (const part of parts) {
    prop = findProperty(list, part)
    if (!prop) return undefined
    if (prop._type === "StructProperty" && Array.isArray(prop.value)) {
      list = prop.value
    }
  }
  return prop
}

// Get the property list at a dotted path (root or the contents of a
// StructProperty). Used for inserting top-level scalars onto e.g.
// `playerProgress`.
function findPropertyList(gvas: GvasFile, path: string): PropertyList {
  if (!path) return gvas.properties
  const prop = findPath(gvas, path)
  if (!prop) throw new Error(`raw_ops: path not found: ${path}`)
  if (prop._type !== "StructProperty" || !Array.isArray(prop.value)) {
    throw new Error(`raw_ops: ${path} is not a StructProperty with a property list (got ${prop._type})`)
  }
  return prop.value as PropertyList
}

// ─── Inventory: ArrayProperty<StructProperty{name, amount}> ──────────────

export type InsertResult = "inserted" | "updated" | "no-template"

const RUNTIME_INVENTORY = "playerProgress.runtimeInventory"

export function insertInventoryEntry(gvas: GvasFile, id: string, amount: number): InsertResult {
  const inv = findPath(gvas, RUNTIME_INVENTORY)
  if (!inv) throw new Error(`raw_ops: ${RUNTIME_INVENTORY} not found in save`)
  if (inv._type !== "ArrayProperty") throw new Error(`raw_ops: ${RUNTIME_INVENTORY} is not an ArrayProperty`)
  const value = inv.value as PropertyList[]

  // Update path: entry already present.
  const existing = value.find((entry) => entry.some((p) => stripFNameSuffix(p._name) === "name" && p.value === id))
  if (existing) {
    for (const p of existing) if (stripFNameSuffix(p._name) === "amount") p.value = amount
    return "updated"
  }

  // Insert path: clone the first sibling, overwrite name + amount.
  if (value.length === 0) return "no-template"
  const clone = structuredClone(value[0]) as PropertyList
  for (const p of clone) {
    const n = stripFNameSuffix(p._name)
    if (n === "name") p.value = id
    if (n === "amount") p.value = amount
  }
  value.push(clone)
  return "inserted"
}

export function removeInventoryEntry(gvas: GvasFile, id: string): boolean {
  const inv = findPath(gvas, RUNTIME_INVENTORY)
  if (!inv) return false
  const value = inv.value as PropertyList[]
  const idx = value.findIndex((entry) => entry.some((p) => stripFNameSuffix(p._name) === "name" && p.value === id))
  if (idx === -1) return false
  value.splice(idx, 1)
  return true
}

// ─── MapProperty inserts/removes ────────────────────────────────────────
//
// Maps use the shape `value = { items: [{key, value}, ...], num_keys_to_remove }`.
// The `key` is a raw scalar (string/number/bool); `value` can be a scalar
// or a nested property list (for struct-valued maps).

export function insertMapEntry(gvas: GvasFile, path: string, key: Any, value: Any): InsertResult {
  const prop = findPath(gvas, path)
  if (!prop) throw new Error(`raw_ops: ${path} not found`)
  if (prop._type !== "MapProperty") throw new Error(`raw_ops: ${path} is not a MapProperty (got ${prop._type})`)

  const items = prop.value.items as Array<{ key: Any; value: Any }>
  const existing = items.find((it) => it.key === key)
  if (existing) {
    existing.value = mergeMapValue(existing.value, value)
    return "updated"
  }
  if (items.length === 0) return "no-template"
  const template = items[0]
  const cloned: Any = structuredClone(template.value)
  items.push({ key, value: mergeMapValue(cloned, value) })
  return "inserted"
}

export function removeMapEntry(gvas: GvasFile, path: string, key: Any): boolean {
  const prop = findPath(gvas, path)
  if (!prop || prop._type !== "MapProperty") return false
  const items = prop.value.items as Array<{ key: Any; value: Any }>
  const idx = items.findIndex((it) => it.key === key)
  if (idx === -1) return false
  items.splice(idx, 1)
  return true
}

// Combine a cloned-template value with the caller's payload. Scalar
// templates become the payload outright; struct templates get the
// payload's named fields written onto the cloned property list.
function mergeMapValue(cloned: Any, payload: Any): Any {
  if (cloned === null || cloned === undefined || typeof cloned !== "object") {
    return payload
  }
  if (Array.isArray(cloned) && payload && typeof payload === "object" && !Array.isArray(payload)) {
    // cloned is a property list (struct contents); payload is { name: value, … }
    for (const p of cloned) {
      const n = stripFNameSuffix(p._name)
      if (n in payload) p.value = payload[n]
    }
    return cloned
  }
  return payload
}

// ─── Append into an array nested inside a map entry's struct value ──────
//
// Used by `itemJokers[<weapon>].jokers[]` and any other "list of FNames"
// nested under a map.

export function appendToNestedArray(
  gvas: GvasFile,
  mapPath: string,
  mapKey: Any,
  arrayName: string,
  value: Any,
): "appended" | "duplicate" | "no-template" | "missing-key" {
  const map = findPath(gvas, mapPath)
  if (!map || map._type !== "MapProperty") throw new Error(`raw_ops: ${mapPath} not a MapProperty`)
  const entry = (map.value.items as Array<{ key: Any; value: Any }>).find((it) => it.key === mapKey)
  if (!entry) return "missing-key"
  const arr = findProperty(entry.value as PropertyList, arrayName)
  if (!arr || arr._type !== "ArrayProperty") {
    throw new Error(`raw_ops: ${arrayName} not an ArrayProperty under ${mapPath}[${mapKey}]`)
  }
  const items = arr.value as Any[]
  if (items.includes(value)) return "duplicate"
  items.push(value)
  return "appended"
}

export function removeFromNestedArray(
  gvas: GvasFile,
  mapPath: string,
  mapKey: Any,
  arrayName: string,
  value: Any,
): boolean {
  const map = findPath(gvas, mapPath)
  if (!map || map._type !== "MapProperty") return false
  const entry = (map.value.items as Array<{ key: Any; value: Any }>).find((it) => it.key === mapKey)
  if (!entry) return false
  const arr = findProperty(entry.value as PropertyList, arrayName)
  if (!arr) return false
  const items = arr.value as Any[]
  const idx = items.indexOf(value)
  if (idx === -1) return false
  items.splice(idx, 1)
  return true
}

// ─── Scalar property insert/update ──────────────────────────────────────
//
// Adds a string/number/boolean property onto a parent property list,
// cloning the envelope from a sibling of compatible type.

export function setScalarProperty(
  gvas: GvasFile,
  parentPath: string,
  name: string,
  value: string | number | boolean,
): InsertResult {
  const list = findPropertyList(gvas, parentPath)
  const existing = findProperty(list, name)
  if (existing) {
    existing.value = value
    return "updated"
  }

  const compatible = (p: Property): boolean => {
    if (typeof value === "number")  return p._type === "IntProperty"  || p._type === "FloatProperty" || p._type === "DoubleProperty"
    if (typeof value === "boolean") return p._type === "BoolProperty"
    return p._type === "StrProperty" || p._type === "NameProperty"
  }
  const template = list.find(compatible)
  if (!template) return "no-template"

  const clone = structuredClone(template) as Property
  // Bare name; UE re-interns FNames on load so the suffix from the
  // template doesn't conflict. (Verified: writeProperties writes _name
  // verbatim as fstring; the loader allocates fresh FName indices.)
  clone._name = name
  clone.value = value
  list.push(clone)
  return "inserted"
}

export function removeScalarProperty(gvas: GvasFile, parentPath: string, name: string): boolean {
  const list = findPropertyList(gvas, parentPath)
  const idx = list.findIndex((p) => stripFNameSuffix(p._name) === name)
  if (idx === -1) return false
  list.splice(idx, 1)
  return true
}

// ─── Joker-specific helpers ─────────────────────────────────────────────
//
// Jokers add two access patterns map-and-nested-array together:
//
//   playerProgress.itemJokers[<weapon>].jokerA/B/C/D   (scalar slots)
//   playerProgress.itemJokers[<weapon>].jokers[]       (owned-list)
//
// Bootstrapping a weapon entry that isn't in the save clones the map's
// first existing entry and resets the slots/owned-list to empty.

const ITEM_JOKERS = "playerProgress.itemJokers"

function bootstrapJokerWeaponEntry(gvas: GvasFile, weapon: string): "bootstrapped" | "no-template" | "exists" {
  const map = findPath(gvas, ITEM_JOKERS)
  if (!map || map._type !== "MapProperty") throw new Error(`raw_ops: ${ITEM_JOKERS} missing or wrong type`)
  const items = map.value.items as Array<{ key: Any; value: Any }>
  if (items.some((it) => it.key === weapon)) return "exists"
  if (items.length === 0) return "no-template"
  const cloneList = structuredClone(items[0].value) as PropertyList
  for (const p of cloneList) {
    const n = stripFNameSuffix(p._name)
    if (/^joker[A-D]$/.test(n)) p.value = "None"
    else if (n === "jokers") p.value = []
  }
  items.push({ key: weapon, value: cloneList })
  return "bootstrapped"
}

export function setEquippedJokerSlot(
  gvas: GvasFile,
  weapon: string,
  slot: "A" | "B" | "C" | "D",
  jokerId: string,
): InsertResult {
  const map = findPath(gvas, ITEM_JOKERS)
  if (!map) throw new Error(`raw_ops: ${ITEM_JOKERS} not found`)
  let entry = (map.value.items as Array<{ key: Any; value: Any }>).find((it) => it.key === weapon)
  if (!entry) {
    const r = bootstrapJokerWeaponEntry(gvas, weapon)
    if (r === "no-template") return "no-template"
    entry = (map.value.items as Array<{ key: Any; value: Any }>).find((it) => it.key === weapon)!
  }
  const slotName = `joker${slot}`
  const list = entry.value as PropertyList
  const existing = findProperty(list, slotName)
  if (existing) { existing.value = jokerId; return "updated" }
  const sibling = list.find((p) => /^joker[A-D]$/.test(stripFNameSuffix(p._name)))
  if (!sibling) return "no-template"
  const clone = structuredClone(sibling) as Property
  clone._name = slotName
  clone.value = jokerId
  list.push(clone)
  return "inserted"
}

export function addJokerToWeaponPool(gvas: GvasFile, weapon: string, jokerId: string): "appended" | "duplicate" | "no-template" {
  const map = findPath(gvas, ITEM_JOKERS)
  if (!map) throw new Error(`raw_ops: ${ITEM_JOKERS} not found`)
  if (!(map.value.items as Array<{ key: Any }>).some((it) => it.key === weapon)) {
    const r = bootstrapJokerWeaponEntry(gvas, weapon)
    if (r === "no-template") return "no-template"
  }
  const r = appendToNestedArray(gvas, ITEM_JOKERS, weapon, "jokers", jokerId)
  return r === "missing-key" ? "no-template" : r
}

// ─── Tweaks (weapon upgrades) ───────────────────────────────────────────
//
// `playerProgress.itemsUpgrades` is a MapProperty<NameProperty, StructProperty>
// where each struct has a `tweaks` MapProperty<NameProperty, IntProperty>.

const ITEMS_UPGRADES = "playerProgress.itemsUpgrades"

function bootstrapWeaponUpgrade(gvas: GvasFile, weapon: string): "bootstrapped" | "no-template" | "exists" {
  const map = findPath(gvas, ITEMS_UPGRADES)
  if (!map) throw new Error(`raw_ops: ${ITEMS_UPGRADES} not found`)
  const items = map.value.items as Array<{ key: Any; value: Any }>
  if (items.some((it) => it.key === weapon)) return "exists"
  if (items.length === 0) return "no-template"
  const cloneList = structuredClone(items[0].value) as PropertyList
  // Empty out the tweaks map on the clone.
  const tweaks = findProperty(cloneList, "tweaks")
  if (tweaks && tweaks._type === "MapProperty") {
    tweaks.value.items = []
    tweaks.value.num_keys_to_remove = 0
  }
  items.push({ key: weapon, value: cloneList })
  return "bootstrapped"
}

export function setWeaponTweak(gvas: GvasFile, weapon: string, tweak: string, value: number): InsertResult {
  const map = findPath(gvas, ITEMS_UPGRADES)
  if (!map) throw new Error(`raw_ops: ${ITEMS_UPGRADES} not found`)
  if (!(map.value.items as Array<{ key: Any }>).some((it) => it.key === weapon)) {
    const r = bootstrapWeaponUpgrade(gvas, weapon)
    if (r === "no-template") return "no-template"
  }
  const entry = (map.value.items as Array<{ key: Any; value: Any }>).find((it) => it.key === weapon)!
  const tweaks = findProperty(entry.value as PropertyList, "tweaks")
  if (!tweaks || tweaks._type !== "MapProperty") {
    throw new Error(`raw_ops: tweaks map missing on itemsUpgrades[${weapon}]`)
  }
  const items = tweaks.value.items as Array<{ key: Any; value: Any }>
  const existing = items.find((it) => it.key === tweak)
  if (existing) { existing.value = value; return "updated" }
  if (items.length === 0) {
    // No sibling tweak in this weapon to clone; pull from any other weapon.
    const donor = (map.value.items as Array<{ key: Any; value: Any }>)
      .map((it) => findProperty(it.value as PropertyList, "tweaks"))
      .find((t) => t && t._type === "MapProperty" && (t.value.items as Any[]).length > 0)
    if (!donor) return "no-template"
    const donorItems = donor.value.items as Array<{ key: Any; value: Any }>
    items.push({ key: tweak, value: structuredClone(donorItems[0].value) })
    items[items.length - 1].value = value
    return "inserted"
  }
  items.push({ key: tweak, value: structuredClone(items[0].value) })
  items[items.length - 1].value = value
  return "inserted"
}
