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

// ── Organisation Name ───────────────────────────────────────────────────

export function setOrganisationName(save: Schedule1Save, name: string): Schedule1Save {
  return {
    ...save,
    game: { ...save.game, OrganisationName: name },
  }
}

// ── Time ────────────────────────────────────────────────────────────────

export function updateTimeField(save: Schedule1Save, field: string, value: number): Schedule1Save {
  return {
    ...save,
    time: { ...save.time, [field]: value },
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

export function setSinglePlayerCash(save: Schedule1Save, playerKey: string, amount: number): Schedule1Save {
  const entry = save.players[playerKey]
  if (!entry?.inventory) return save
  const inv = entry.inventory as { Items: string[]; [k: string]: unknown }
  const newItems = inv.Items.map((itemStr) => {
    const parsed: InventoryItem = JSON.parse(itemStr)
    if (parsed.DataType === "CashData") {
      return JSON.stringify({ ...parsed, CashBalance: amount })
    }
    return itemStr
  })
  return {
    ...save,
    players: {
      ...save.players,
      [playerKey]: { ...entry, inventory: { ...inv, Items: newItems } },
    },
  }
}

export function setPlayerItemQuantity(
  save: Schedule1Save,
  playerKey: string,
  itemIndex: number,
  quantity: number,
): Schedule1Save {
  const entry = save.players[playerKey]
  if (!entry?.inventory) return save
  const inv = entry.inventory as { Items: string[]; [k: string]: unknown }
  const newItems = [...inv.Items]
  const parsed: InventoryItem = JSON.parse(newItems[itemIndex])
  newItems[itemIndex] = JSON.stringify({ ...parsed, Quantity: quantity })
  return {
    ...save,
    players: {
      ...save.players,
      [playerKey]: { ...entry, inventory: { ...inv, Items: newItems } },
    },
  }
}

// ── NPCs ────────────────────────────────────────────────────────────────

interface NPCEntry {
  DataType: string
  BaseData: string
  AdditionalDatas: Array<{ Name: string; Contents: string }>
  [key: string]: unknown
}

function getNPCId(npc: NPCEntry): string {
  const base = JSON.parse(npc.BaseData)
  return base.ID ?? ""
}

function updateNPCAdditionalData(
  save: Schedule1Save,
  npcId: string,
  dataName: string,
  updater: (data: Record<string, unknown>) => Record<string, unknown>,
): Schedule1Save {
  const npcsObj = save.npcs as { NPCs: NPCEntry[]; [k: string]: unknown }
  if (!npcsObj.NPCs) return save

  const newNPCs = npcsObj.NPCs.map((npc) => {
    if (getNPCId(npc) !== npcId) return npc
    const newAdditional = npc.AdditionalDatas.map((ad) => {
      if (ad.Name !== dataName) return ad
      const data = JSON.parse(ad.Contents)
      return { ...ad, Contents: JSON.stringify(updater(data), null, 4) }
    })
    return { ...npc, AdditionalDatas: newAdditional }
  })

  return { ...save, npcs: { ...npcsObj, NPCs: newNPCs } }
}

export function setAllRelationships(save: Schedule1Save, delta: number): Schedule1Save {
  const npcsObj = save.npcs as { NPCs: NPCEntry[]; [k: string]: unknown }
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

  return { ...save, npcs: { ...npcsObj, NPCs: newNPCs } }
}

export function setNPCRelationship(save: Schedule1Save, npcId: string, delta: number): Schedule1Save {
  return updateNPCAdditionalData(save, npcId, "Relationship", (data) => ({
    ...data,
    RelationDelta: delta,
  }))
}

export function setNPCDependence(save: Schedule1Save, npcId: string, dependence: number): Schedule1Save {
  return updateNPCAdditionalData(save, npcId, "CustomerData", (data) => ({
    ...data,
    Dependence: dependence,
  }))
}

export function setDealerCash(save: Schedule1Save, dealerId: string, cash: number): Schedule1Save {
  const npcsObj = save.npcs as { NPCs: NPCEntry[]; [k: string]: unknown }
  if (!npcsObj.NPCs) return save

  const newNPCs = npcsObj.NPCs.map((npc) => {
    if (getNPCId(npc) !== dealerId) return npc
    if (npc.DataType !== "DealerData") return npc
    const baseData = JSON.parse(npc.BaseData)
    baseData.Cash = cash
    return { ...npc, BaseData: JSON.stringify(baseData) }
  })

  return { ...save, npcs: { ...npcsObj, NPCs: newNPCs } }
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

export function setProductPrice(save: Schedule1Save, productId: string, price: number): Schedule1Save {
  const products = save.products as Record<string, unknown>
  const prices = (products.ProductPrices as Array<{ String: string; Int: number }>) ?? []
  const newPrices = prices.map((p) => (p.String === productId ? { ...p, Int: price } : p))
  return {
    ...save,
    products: { ...products, ProductPrices: newPrices },
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

// ── Cartel ──────────────────────────────────────────────────────────────

export function setCartelStatus(save: Schedule1Save, status: number): Schedule1Save {
  return {
    ...save,
    cartel: { ...save.cartel, Status: status },
  }
}

export function setCartelRegionInfluence(save: Schedule1Save, region: number, influence: number): Schedule1Save {
  const cartel = save.cartel as Record<string, unknown>
  const regions = (cartel.RegionInfluence as Array<{ Region: number; Influence: number }>) ?? []
  const newRegions = regions.map((r) => (r.Region === region ? { ...r, Influence: influence } : r))
  return {
    ...save,
    cartel: { ...cartel, RegionInfluence: newRegions },
  }
}

// ── Vehicles ────────────────────────────────────────────────────────────

export function setVehicleColor(save: Schedule1Save, vehicleGuid: string, color: string): Schedule1Save {
  const vehicles = save.ownedVehicles as { Vehicles: Array<{ GUID: string; [k: string]: unknown }>; [k: string]: unknown }
  if (!vehicles.Vehicles) return save
  const newVehicles = vehicles.Vehicles.map((v) => (v.GUID === vehicleGuid ? { ...v, Color: color } : v))
  return {
    ...save,
    ownedVehicles: { ...vehicles, Vehicles: newVehicles },
  }
}

// ── Shops ───────────────────────────────────────────────────────────────

export function setShopItemStock(save: Schedule1Save, shopCode: string, itemId: string, quantity: number): Schedule1Save {
  const shopsObj = save.shops as { Shops: Array<{ ShopCode: string; ItemStockQuantities: Array<{ String: string; Int: number }>; [k: string]: unknown }>; [k: string]: unknown }
  if (!shopsObj.Shops) return save
  const newShops = shopsObj.Shops.map((shop) => {
    if (shop.ShopCode !== shopCode) return shop
    const newStock = shop.ItemStockQuantities.map((item) =>
      item.String === itemId ? { ...item, Int: quantity } : item,
    )
    return { ...shop, ItemStockQuantities: newStock }
  })
  return {
    ...save,
    shops: { ...shopsObj, Shops: newShops },
  }
}

// ── Variables ───────────────────────────────────────────────────────────

export function setVariable(save: Schedule1Save, name: string, value: string): Schedule1Save {
  const vars = save.variables as { Variables: Array<{ Name: string; Value: string; [k: string]: unknown }>; [k: string]: unknown }
  if (!vars.Variables) return save
  const newVars = vars.Variables.map((v) => (v.Name === name ? { ...v, Value: value } : v))
  return {
    ...save,
    variables: { ...vars, Variables: newVars },
  }
}

// ── Quests ──────────────────────────────────────────────────────────────

export function setQuestState(save: Schedule1Save, questIndex: number, state: number): Schedule1Save {
  const questsObj = save.quests as { Quests: Array<{ State: number; [k: string]: unknown }>; [k: string]: unknown }
  if (!questsObj.Quests) return save
  const newQuests = questsObj.Quests.map((q, idx) => (idx === questIndex ? { ...q, State: state } : q))
  return {
    ...save,
    quests: { ...questsObj, Quests: newQuests },
  }
}
