import { type WindblownSave, CURRENCY_NAMES, CURRENCY_FRIENDLY_NAMES } from "@/lib/windblown/decoder"

const MAX_CURRENCY = 99999

export function updateCurrency(save: WindblownSave, enumId: number, value: number): WindblownSave {
  // Update in place if already present; otherwise append a new entry. New non-zero entries
  // are structurally inserted into the save's currency array at encode time.
  if (save.currencies.some((c) => c.enumId === enumId)) {
    return {
      ...save,
      currencies: save.currencies.map((c) => (c.enumId === enumId ? { ...c, amount: value } : c)),
    }
  }
  const name = CURRENCY_NAMES[enumId] ?? `currency_${enumId}`
  const friendlyName = CURRENCY_FRIENDLY_NAMES[enumId] ?? name
  return {
    ...save,
    currencies: [...save.currencies, { enumId, name, friendlyName, amount: value }],
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
