import type { WindblownSave } from "@/lib/windblown/decoder"

const MAX_CURRENCY = 99999

export function updateCurrency(save: WindblownSave, enumId: number, value: number): WindblownSave {
  // Only currencies already stored in the save can be edited: adding a new record corrupts
  // the save in-game, so encodeSaveToBlob refuses it (see the note in lib/windblown/decoder.ts).
  if (!save.currencies.some((c) => c.enumId === enumId)) return save
  return {
    ...save,
    currencies: save.currencies.map((c) => (c.enumId === enumId ? { ...c, amount: value } : c)),
  }
}

export function maxAllCurrencies(save: WindblownSave): WindblownSave {
  return {
    ...save,
    currencies: save.currencies.map((c) => ({ ...c, amount: MAX_CURRENCY })),
  }
}

export function toggleMetaFlag(save: WindblownSave, flagName: string, value: boolean): WindblownSave {
  return {
    ...save,
    metaFlags: { ...save.metaFlags, [flagName]: value },
  }
}

export function unlockAllFlags(save: WindblownSave): WindblownSave {
  const allTrue: Record<string, boolean> = {}
  for (const key of Object.keys(save.metaFlags)) {
    allTrue[key] = true
  }
  return {
    ...save,
    metaFlags: allTrue,
  }
}

export function unlockCategoryFlags(save: WindblownSave, flagNames: string[]): WindblownSave {
  const updated = { ...save.metaFlags }
  for (const name of flagNames) {
    if (name in updated) {
      updated[name] = true
    }
  }
  return {
    ...save,
    metaFlags: updated,
  }
}

export function lockCategoryFlags(save: WindblownSave, flagNames: string[]): WindblownSave {
  const updated = { ...save.metaFlags }
  for (const name of flagNames) {
    if (name in updated) {
      updated[name] = false
    }
  }
  return {
    ...save,
    metaFlags: updated,
  }
}
