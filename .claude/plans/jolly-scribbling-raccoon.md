# Schedule 1 Save Editor — Enhanced Editing Plan

## Context
The current Schedule 1 editor (built in the previous session) has basic editing for money, rank, property ownership, and bulk NPC relationship changes. A more progressed save (SaveGame_4) reveals many additional editable fields. The user wants to maximize what's editable, with per-player cash editing as a specific requirement.

## Current Gaps (what's NOT editable today)

### High Priority (user-requested or high-value)
1. **Per-player cash** — currently only "Max All Cash" button, no per-player input
2. **Per-player inventory item quantities** — displayed as badges but not editable
3. **Per-NPC relationship** — only "Max All" bulk action, no individual editing
4. **NPC customer dependence** — not shown or editable
5. **Product prices** — displayed but not editable
6. **Organisation name** — not editable
7. **Time data** — ElapsedDays, TimeOfDay, Playtime not shown or editable
8. **Dealer data** — DealerData NPCs have Cash, Recruited status, AssignedCustomerIDs (not shown)
9. **Cartel** — Status, RegionInfluence per region (not shown in UI, only in Raw JSON)
10. **Vehicles** — 7 vehicles with codes, colors, contents (not shown)

### Medium Priority
11. **Shops** — stock quantities per shop per item
12. **Game variables** — 38 global variables (progression flags/counters)
13. **Player variables** — per-player tutorial flags and counters
14. **Quest states** — displayed but not editable (change Active/Complete/Inactive)

### Lower Priority (display-only improvements)
15. **Metadata** — creation date, last played, game version (display)
16. **Game settings** — ConsoleEnabled toggle

---

## Files to Modify

### 1. `app/schedule-1/save-mutations.ts` — New mutation functions

**Add these new mutations:**

```
// Per-player cash (explicit player key)
setSinglePlayerCash(save, playerKey, amount) → Schedule1Save

// Per-player inventory item quantity
setPlayerItemQuantity(save, playerKey, itemIndex, quantity) → Schedule1Save

// Per-NPC relationship (by NPC ID)
setNPCRelationship(save, npcId, delta) → Schedule1Save

// NPC dependence
setNPCDependence(save, npcId, dependence) → Schedule1Save

// Dealer cash
setDealerCash(save, dealerId, cash) → Schedule1Save

// Product prices
setProductPrice(save, productId, price) → Schedule1Save

// Organisation name
setOrganisationName(save, name) → Schedule1Save

// Time fields
updateTimeField(save, field, value) → Schedule1Save

// Cartel
setCartelStatus(save, status) → Schedule1Save
setCartelRegionInfluence(save, region, influence) → Schedule1Save

// Vehicles
setVehicleColor(save, vehicleGuid, color) → Schedule1Save

// Shops
setShopItemStock(save, shopCode, itemId, quantity) → Schedule1Save

// Variables (global)
setVariable(save, name, value) → Schedule1Save

// Quest state
setQuestState(save, questIndex, state) → Schedule1Save
```

### 2. `app/schedule-1/page.tsx` — Enhanced UI

Keep the existing 5-tab structure but significantly expand each tab:

#### Economy Tab (enhanced)
- **Existing**: Money fields (4 inputs), Rank/Tier/XP, Regions — *keep as-is*
- **Add**: Organisation Name (text input at the top)
- **Add**: Time card with ElapsedDays (int), TimeOfDay (int, 0-1440 minutes), Playtime (int, minutes)

#### Players Tab (major expansion)
- **Replace** current read-only display with per-player expandable cards
- Each player card contains:
  - **Cash Balance**: number input (parsed from CashData in inventory JSON strings)
  - **Inventory Items**: editable list showing ID, Quantity, Quality, PackagingID for each non-empty slot
  - Player code (display)
- Keep "Max All Cash" button at top

#### World Tab (enhanced)
- **Properties/Businesses**: keep as-is (ownership toggles)
- **NPCs**: Replace display-only badges with expandable cards per NPC
  - Per-NPC: Relationship slider/input (0-5 range), Dependence slider/input (0-1), Unlocked toggle
  - Show NPC type badge: "Customer" vs "Dealer"
  - For Dealers: show Cash (editable input), Recruited status, assigned customer count
  - Keep "Max All Relationships" button
- **Sewer/Law**: keep as-is
- **Add**: Cartel card with Status (number input), per-region Influence inputs (0-1 range)
- **Add**: Vehicles section showing vehicle code, color, and contents count

#### Products Tab (enhanced)
- **Product prices**: make editable (number input per product)
- **Discovered products**: add individual toggle/add/remove
- **Quests**: make quest State editable (dropdown: Inactive/Active/Complete)
- **Add**: Shops section with stock quantities per shop per item

#### Raw JSON Tab — keep as-is but add more sections to the data passed

### 3. `lib/schedule-1/decoder.ts` — No changes needed
The decoder already reads all files and the Save type is generic enough (`Record<string, unknown>`) to handle all fields.

---

## Implementation Details

### Per-player cash editing (the key feature)
The CashData item is a JSON string inside the inventory Items array. To make it editable per-player:

```typescript
// In save-mutations.ts
export function setSinglePlayerCash(save: Schedule1Save, playerKey: string, amount: number): Schedule1Save {
  const entry = save.players[playerKey]
  if (!entry?.inventory) return save
  const inv = entry.inventory as { Items: string[]; [k: string]: unknown }
  const newItems = inv.Items.map((itemStr) => {
    const parsed = JSON.parse(itemStr)
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
```

In the UI, each player card shows: `<Input type="number" value={cash} onChange={...} />`

### Per-NPC relationship editing
NPCs have nested JSON strings in AdditionalDatas. The mutation must:
1. Find the NPC by parsing BaseData to get the ID
2. Find the "Relationship" entry in AdditionalDatas
3. Parse its Contents, update RelationDelta, re-stringify with 4-space indent

### Dealer data
DealerData NPCs have their extra fields inside BaseData (a JSON string). The mutation must parse BaseData, modify Cash/Recruited, and re-stringify.

### Product price editing
ProductPrices is an array of `{String, Int}` pairs. Mutation finds by String and updates Int.

---

## Verification
1. Upload SaveGame_4 folder → verify all new fields render correctly
2. Edit per-player cash → download ZIP → re-upload → verify value persisted
3. Edit individual NPC relationship → download → re-upload → verify
4. Edit product prices → download → re-upload → verify
5. Edit organisation name, time, cartel → download → re-upload → verify
6. Run `pnpm build` to confirm no TypeScript errors
