import type { WindblownSave, Currencies } from "@/lib/windblown/decoder"

const MAX_CURRENCY = 99999

export function updateCurrency(save: WindblownSave, key: keyof Currencies, value: number): WindblownSave {
  return {
    ...save,
    currencies: { ...save.currencies, [key]: value },
  }
}

export function maxAllCurrencies(save: WindblownSave): WindblownSave {
  return {
    ...save,
    currencies: {
      cogs: MAX_CURRENCY,
      memoniteDust: MAX_CURRENCY,
      memoniteShard: MAX_CURRENCY,
      memoniteFragment: MAX_CURRENCY,
      obsidianMemonite: MAX_CURRENCY,
    },
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
