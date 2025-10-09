import type { SwornSave } from "@/lib/sworn/decoder"

interface CurrencyValues {
  fairyEmbers: number
  silk: number
  moonstone: number
  grailWater: number
  crystalShards: number
}

const CURRENCY_IDENTIFIERS = {
  crystalShards: "medaocebbencincbicdalchabd",
  fairyEmbers: "medaocebbencinfaibiembeb",
  grailWater: "medaocebbencincingbailgadeb",
  moonstone: "medaocebbencinmooncdone",
  silk: "medaocebbencincilk",
}

/**
 * Sets all currencies to their maximum values (999999)
 */
export function maxAllCurrencies(saveData: SwornSave): SwornSave {
  const updatedSave = { ...saveData }
  updatedSave.segments = updatedSave.segments.map((segment) => {
    if (segment.category === "medal") {
      if (
        segment.text === CURRENCY_IDENTIFIERS.crystalShards ||
        segment.text === CURRENCY_IDENTIFIERS.fairyEmbers ||
        segment.text === CURRENCY_IDENTIFIERS.grailWater ||
        segment.text === CURRENCY_IDENTIFIERS.moonstone ||
        segment.text === CURRENCY_IDENTIFIERS.silk
      ) {
        return { ...segment, value: 999999 }
      }
    }
    return segment
  })
  return updatedSave
}

/**
 * Updates specific currency values in the save data
 */
export function updateCurrencies(saveData: SwornSave, currencies: CurrencyValues): SwornSave {
  const updatedSave = { ...saveData }
  updatedSave.segments = updatedSave.segments.map((segment) => {
    if (segment.category === "medal") {
      if (segment.text === CURRENCY_IDENTIFIERS.crystalShards) {
        return { ...segment, value: currencies.crystalShards }
      } else if (segment.text === CURRENCY_IDENTIFIERS.fairyEmbers) {
        return { ...segment, value: currencies.fairyEmbers }
      } else if (segment.text === CURRENCY_IDENTIFIERS.grailWater) {
        return { ...segment, value: currencies.grailWater }
      } else if (segment.text === CURRENCY_IDENTIFIERS.moonstone) {
        return { ...segment, value: currencies.moonstone }
      } else if (segment.text === CURRENCY_IDENTIFIERS.silk) {
        return { ...segment, value: currencies.silk }
      }
    }
    return segment
  })
  return updatedSave
}
