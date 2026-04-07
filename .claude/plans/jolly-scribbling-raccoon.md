# Windblown Save Editor - Implementation Plan

## Context
Adding a Windblown save editor to the EditMySave platform. A working Deno-based codec exists at `app/windblown/windblown/save_io.ts` that decodes/encodes `.sav` files (MTWB binary format with GZIP-compressed blocks and SHA-1 integrity hashes). This codec needs to be ported to browser APIs and wrapped with the standard editor UI.

**Editable fields**: 5 currencies (numbers) + 116 meta flags (booleans). Player name is display-only.

---

## Files to Create/Modify

### 1. `lib/windblown/decoder.ts` — Browser-compatible codec
Port `save_io.ts` from Node/Deno APIs to browser APIs:
- `node:zlib` → `pako` (already a project dependency)
  - `inflateRawSync(data)` → `pako.inflateRaw(data)` (handles trailing data identically)
  - `gunzipSync(data)` → `pako.ungzip(data)`
  - `gzipSync(data)` → `pako.gzip(data)`
- `node:crypto` → `crypto.subtle`
  - `createHash("sha1").update(data).digest()` → `await crypto.subtle.digest("SHA-1", data)` (async)
- `Deno.readFile(path)` → `file.arrayBuffer()` (File API)
- `Deno.writeFile(path, data)` → return `new Blob([output])`

**Export interface:**
```typescript
export interface WindblownSave {
  metadata: PlayerMeta        // display-only player info from block 1 JSON
  currencies: Currencies      // 5 editable currency values
  metaFlags: MetaFlags        // 116 editable boolean flags
  // Internal state for re-encoding (prefixed with _)
  _raw: Uint8Array
  _block2Decompressed: Uint8Array
  _block1GzipOffset: number
  _block2GzipOffset: number
  _gapStaticBytes: Uint8Array
  _currencyOffset: number
  _metaFlagsOffset: number
}

export async function decodeSaveFromFile(file: File): Promise<WindblownSave>
export async function encodeSaveToBlob(save: WindblownSave): Promise<Blob>
```

All binary helpers (`findBytes`, `findCurrencyOffset`, `readCurrencies`, `writeCurrencies`, `findMetaFlagsOffset`, `readMetaFlags`, `writeMetaFlags`) port unchanged — they already work with `Uint8Array`/`DataView`.

Copy constants and type definitions (`META_FLAG_NAMES`, `PlayerMeta`, `Currencies`, `MetaFlags`, etc.) directly from `save_io.ts`.

### 2. `app/windblown/save-mutations.ts` — Pure mutation functions
```typescript
updateCurrency(save, key, value) → WindblownSave
maxAllCurrencies(save) → WindblownSave           // sets all to 99,999
toggleMetaFlag(save, flagName, value) → WindblownSave
unlockAllFlags(save) → WindblownSave
unlockCategoryFlags(save, flagNames[]) → WindblownSave
```
Currency max value: 99,999 (safe under the `<< 12` uint32 encoding limit of 1,048,575).

### 3. `app/windblown/page.tsx` — Editor UI
**3 tabs**: Currencies | Unlocks | Raw JSON

**Currencies tab**: Grid of 5 cards, each with currency name, number input, and individual "Max" button. Icons from lucide-react (Coins, Gem, etc.).

**Unlocks tab**: 8 collapsible Accordion sections with Checkbox toggles per flag. Each section header shows `{label} (X/Y)` count badge. Per-category "Unlock All" / "Lock All" buttons.

**Flag categories** (defined inline or in `data/windblown/meta-flags.json`):
| Category | Count | Examples |
|---|---|---|
| Progression | 17 | KilledABoss, ReachedArena, FoundABlueprint |
| NPCs & Tutorials | 9 | TalkedToAmi, RescuedSigourney, GotEmoteTutorial |
| Hub & Access | 5 | CanAccessHub, CanPublicMultiplayer, UnlockedCogGates |
| Feature Unlocks | 19 | UnlockedEndlessMode, UnlockedNewGamePlus, UnlockedShopForge |
| Leveled Upgrades | 46 | SyncAttackLvl1/2, HealFlaskChargeLvl1/2/3, UnlockedRarityLvl1/2/3 |
| Pulsor System | 5 | UnlockedPulsorStoneFeeding, UnlockedPulsorEffects |
| Miscellaneous | 11 | BetterJars, GiverReroll, BoonDeckLvl1, FinishedRarity |
| Player Flags | 3 | PerpetualFlagAlphaPlayer, PerpetualFlagDemoPlayer |

**Sidebar** (EditorSidebar component):
- Quick stats: Player Name (display), Unlocks count (X/116)
- Quick actions: "Max All Currencies", "Unlock All Flags"
- Download JSON export + Download modified .sav

### 4. `data/games.json` — Add entry
```json
{
  "id": "windblown",
  "name": "Windblown",
  "description": "Edit currencies, unlocks, and meta progression for your Windblown save files",
  "image": "/images/windblown/cover.png",
  "route": "/windblown",
  "status": "available",
  "supportedVersion": "Early Access",
  "platforms": [{
    "name": "Steam",
    "supported": true,
    "saveLocation": {
      "windows": "C:\\Users\\[USERNAME]\\AppData\\LocalLow\\Motion Twin\\Windblown"
    },
    "fileName": "*.sav",
    "instructions": "Put the following into your file explorer: %USERPROFILE%\\AppData\\LocalLow\\Motion Twin\\Windblown. Look for a .sav file and drag it into this editor.",
    "notes": "Always create a backup before editing. The save file uses MTWB binary format with GZIP compression and SHA-1 integrity hashes."
  }]
}
```

### 5. Cleanup — Move reference files
Move `app/windblown/windblown/` (save_io.ts, cli.ts, decoded.json) to `app/windblown/_reference/` (underscore prefix ignored by Next.js App Router) to keep as reference without route interference.

---

## Implementation Order
1. Create `lib/windblown/decoder.ts` (port codec to browser APIs)
2. Create `app/windblown/save-mutations.ts`
3. Add entry to `data/games.json`
4. Create `app/windblown/page.tsx`
5. Move reference files to `app/windblown/_reference/`
6. Test with real `.sav` file

## Verification
- Upload a real Windblown `.sav` file → verify currencies and flags decode correctly
- Edit currencies → download → re-upload → verify values persisted
- Toggle flags → download → re-upload → verify flags persisted
- Verify SHA-1 hashes are recalculated (game should accept the modified file)
- Run `pnpm build` to verify no TypeScript errors
