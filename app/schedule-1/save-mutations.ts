import type { Schedule1Save, MoneyData, RankData, PlayerEntry } from "@/lib/schedule-1/decoder"

// ── Money ───────────────────────────────────────────────────────────────

export function setMoney(save: Schedule1Save, balance: number): Schedule1Save {
  return {
    ...save,
    money: {
      ...save.money,
      OnlineBalance: balance,
      Networth: Math.max(balance, save.money.Networth),
    },
  }
}

export function maxMoney(save: Schedule1Save): Schedule1Save {
  return setMoney(save, 9999999)
}

export function updateMoneyField(save: Schedule1Save, field: keyof MoneyData, value: number): Schedule1Save {
  return {
    ...save,
    money: { ...save.money, [field]: value },
  }
}

// ── Rank ─────────────────────────────────────────────────────────────────

export function setRank(save: Schedule1Save, rank: number, tier: number, xp?: number): Schedule1Save {
  const updated: RankData = {
    ...save.rank,
    Rank: rank,
    Tier: tier,
  }
  if (xp !== undefined) {
    updated.XP = xp
    updated.TotalXP = xp
  }
  return { ...save, rank: updated }
}

export function maxRank(save: Schedule1Save): Schedule1Save {
  return setRank(save, 10, 5, 999999)
}

export function updateRankField(save: Schedule1Save, field: keyof RankData, value: unknown): Schedule1Save {
  return {
    ...save,
    rank: { ...save.rank, [field]: value },
  }
}

export function unlockAllRegions(save: Schedule1Save): Schedule1Save {
  return {
    ...save,
    rank: { ...save.rank, UnlockedRegions: [0, 1, 2, 3, 4, 5] },
  }
}

// ── Properties & Businesses ─────────────────────────────────────────────

export function setAllOwned(save: Schedule1Save): Schedule1Save {
  const properties: Record<string, Record<string, unknown>> = {}
  for (const [name, data] of Object.entries(save.properties)) {
    properties[name] = { ...data, IsOwned: true }
  }
  const businesses: Record<string, Record<string, unknown>> = {}
  for (const [name, data] of Object.entries(save.businesses)) {
    businesses[name] = { ...data, IsOwned: true }
  }
  return { ...save, properties, businesses }
}

export function togglePropertyOwned(save: Schedule1Save, name: string, owned: boolean): Schedule1Save {
  return {
    ...save,
    properties: {
      ...save.properties,
      [name]: { ...save.properties[name], IsOwned: owned },
    },
  }
}

export function toggleBusinessOwned(save: Schedule1Save, name: string, owned: boolean): Schedule1Save {
  return {
    ...save,
    businesses: {
      ...save.businesses,
      [name]: { ...save.businesses[name], IsOwned: owned },
    },
  }
}

// ── Players ─────────────────────────────────────────────────────────────

interface InventoryItem {
  DataType: string
  ID: string
  Quantity: number
  CashBalance?: number
  [key: string]: unknown
}

export function setPlayerCash(save: Schedule1Save, amount: number): Schedule1Save {
  const players: Record<string, PlayerEntry> = {}
  for (const [name, entry] of Object.entries(save.players)) {
    if (!entry.inventory) {
      players[name] = entry
      continue
    }
    const inv = entry.inventory as { Items: string[]; [k: string]: unknown }
    const newItems = inv.Items.map((itemStr) => {
      const parsed: InventoryItem = JSON.parse(itemStr)
      if (parsed.DataType === "CashData") {
        return JSON.stringify({ ...parsed, CashBalance: amount })
      }
      return itemStr
    })
    players[name] = {
      ...entry,
      inventory: { ...inv, Items: newItems },
    }
  }
  return { ...save, players }
}

// ── NPCs ────────────────────────────────────────────────────────────────

interface NPCData {
  DataType: string
  BaseData: string
  AdditionalDatas: Array<{ Name: string; Contents: string }>
  [key: string]: unknown
}

export function setAllRelationships(save: Schedule1Save, delta: number): Schedule1Save {
  const npcsObj = save.npcs as { NPCs: NPCData[]; [k: string]: unknown }
  if (!npcsObj.NPCs) return save

  const newNPCs = npcsObj.NPCs.map((npc) => {
    const newAdditional = npc.AdditionalDatas.map((ad) => {
      if (ad.Name === "Relationship") {
        const data = JSON.parse(ad.Contents)
        return {
          ...ad,
          Contents: JSON.stringify({ ...data, RelationDelta: delta, Unlocked: true }, null, 4),
        }
      }
      return ad
    })
    return { ...npc, AdditionalDatas: newAdditional }
  })

  return {
    ...save,
    npcs: { ...npcsObj, NPCs: newNPCs },
  }
}

// ── Products & Sewer ────────────────────────────────────────────────────

const KNOWN_PRODUCTS = ["ogkush", "sourdiesel", "greencrack", "granddaddypurple", "meth", "cocaine", "shroom"]

export function unlockAllProducts(save: Schedule1Save): Schedule1Save {
  const products = save.products as Record<string, unknown>
  const discovered = [...((products.DiscoveredProducts as string[]) ?? [])]
  for (const p of KNOWN_PRODUCTS) {
    if (!discovered.includes(p)) discovered.push(p)
  }
  return {
    ...save,
    products: { ...products, DiscoveredProducts: discovered },
  }
}

export function unlockSewer(save: Schedule1Save): Schedule1Save {
  return {
    ...save,
    sewer: { ...save.sewer, IsSewerUnlocked: true },
  }
}

// ── Law ─────────────────────────────────────────────────────────────────

export function setLawIntensity(save: Schedule1Save, intensity: number): Schedule1Save {
  return {
    ...save,
    law: { ...save.law, InternalLawIntensity: intensity },
  }
}
