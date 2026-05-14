// Rich enum dropdown for save-side FName fields.
//
// Used to replace the legacy free-form `<input type="text">` and the
// plain native `<select>` in app/far-far-west/page.tsx. Options come
// from one of the items.json catalog categories (skins, jokers, emotes,
// etc.) and each option carries:
//
//   - an icon-letter placeholder (real PNG bundle is a follow-up)
//   - a tiny element dot (Acid / Cactus / Elec / Fire / Voodoo)
//   - the description as a native browser tooltip on hover
//
// The save-mutations layer now supports inserting structural entries
// (`raw_ops.ts`), so option lists are *not* gated on ownership — any
// catalog entry is selectable.

"use client"

import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface Attrs {
  element?: string | null
  iconPath?: string | null
  rarity?: string | null
  longName?: string | null
  unlockedVia?: string | null
}

export interface EnumSelectProps {
  label: string
  value: string
  /** All selectable IDs. Caller already filters / orders. */
  options: string[]
  /** Map of id → display name. */
  labels: Record<string, string>
  /** Map of id → description (rendered as native title tooltip). */
  descriptions?: Record<string, string>
  /** Map of id → attribute block (for element dot, etc.). */
  attributes?: Record<string, Attrs>
  /** Allow a "None" sentinel option (used for joker slots). */
  allowNone?: boolean
  onChange: (v: string) => void
}

const ELEMENT_TINT: Record<string, string> = {
  Acid:   "bg-green-500",
  Cactus: "bg-emerald-500",
  Elec:   "bg-yellow-400",
  Fire:   "bg-red-500",
  Voodoo: "bg-purple-500",
}

function Dot({ element }: { element?: string | null }) {
  if (!element) return null
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${ELEMENT_TINT[element] ?? "bg-gray-400"}`}
      aria-label={element}
      title={element}
    />
  )
}

function IconLetter({ id, label }: { id: string; label: string }) {
  const initial = label.replace(/^[a-z]+/, "").charAt(0).toUpperCase() || id.charAt(0).toUpperCase() || "?"
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded bg-muted-foreground/20 text-muted-foreground text-[10px] font-semibold shrink-0"
      aria-hidden
    >
      {initial}
    </span>
  )
}

function OptionRow({
  id,
  label,
  desc,
  attr,
  compact = false,
}: {
  id: string
  label: string
  desc?: string
  attr?: Attrs
  /** When true, render just the name line (used inside the Select trigger
   *  so the closed control stays single-line). When false, also render
   *  the description below — used inside open-menu rows. */
  compact?: boolean
}) {
  return (
    <span
      className="flex flex-col gap-0.5 w-full"
      title={desc ?? undefined}
    >
      <span className="inline-flex items-center gap-1.5">
        <IconLetter id={id} label={label} />
        <span className="truncate">{attr?.longName ?? label}</span>
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          <Dot element={attr?.element} />
          {attr?.rarity && (
            <span className="text-[10px] uppercase tracking-wide opacity-70">{attr.rarity}</span>
          )}
        </span>
      </span>
      {!compact && desc && (
        <span className="text-[11px] text-muted-foreground line-clamp-2 leading-snug pl-[22px]">
          {desc}
        </span>
      )}
    </span>
  )
}

export function EnumSelect({
  label,
  value,
  options,
  labels,
  descriptions = {},
  attributes = {},
  allowNone = false,
  onChange,
}: EnumSelectProps) {
  // Inject current value as an extra option if it isn't already present
  // (preserves whatever the save shipped with even if the catalog has
  // moved on — degraded but not lossy).
  const all = React.useMemo(() => {
    const set = new Set(options)
    if (value && !set.has(value) && value !== "None") set.add(value)
    return [...set]
  }, [options, value])

  const currentDesc = descriptions[value]

  return (
    <div className="space-y-1.5" title={currentDesc ?? undefined}>
      <Label className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
        <span>{label}</span>
        <Dot element={attributes[value]?.element ?? null} />
      </Label>
      <Select value={value || "__unset__"} onValueChange={(v) => onChange(v === "__unset__" ? "" : v)}>
        <SelectTrigger className="h-9 bg-background border-border text-foreground">
          <SelectValue placeholder="—">
            <OptionRow id={value} label={labels[value] ?? value} desc={descriptions[value]} attr={attributes[value]} compact />
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {allowNone && (
            <SelectItem value="None">
              <span className="text-muted-foreground italic">None</span>
            </SelectItem>
          )}
          {all.map((id) => (
            <SelectItem key={id} value={id}>
              <OptionRow id={id} label={labels[id] ?? id} desc={descriptions[id]} attr={attributes[id]} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Inline description for the currently-selected value, visible
          without hover. Only renders when a real description exists. */}
      {currentDesc && (
        <p className="text-[11px] text-muted-foreground italic leading-snug">
          {currentDesc}
        </p>
      )}
    </div>
  )
}
