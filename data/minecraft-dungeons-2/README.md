# Minecraft Dungeons II — public asset catalog

Served at `/data/minecraft-dungeons-2/catalog.json`, icons at
`/images/minecraft-dungeons-2/icons/<tag>.png` (items 256×256,
enchantments/effects 64×64).

Keyed by gameplay tag exactly as it appears in saves. `iconFile` values are
relative to `iconBase`. The full source catalog (with `raw` table rows) lives
outside `public/` in the extraction pipeline; this public copy strips `raw`.

## Entry format

```jsonc
"SW.Item.MysticBoots": {
  "tag": "SW.Item.MysticBoots",
  "name": "MysticBoots",                    // table row name
  "kind": "item",                           // item|enchantment|effect|effectTemplate|…
  "source": "DT_ItemDefinitionArmor",       // which table defined it
  "category": "armor",                      // melee|ranged|armor|artifact|talisman|…
  "displayName": "Mystic Boots",             // localized (English)
  "description": "…",
  "icon": "/Game/Spicewood/…/T_UI_MysticBoots_Icon.…",  // object path (provenance)
  "traits": ["SW.Item.Property.LightArmor", "SW.Archetype.Mage", …],
  "uniqueOf": "SW.Item.MysticBoots_Unique",  // base→unique substitution
  "uniqueVariants": ["…_Unique"],            // set on base items
  "possibleRarities": ["SW.Rarity.Common", …],
  "iconFile": "icons/SW.Item.MysticBoots.png",
  "iconSize": [256, 256]
}
```

## Coverage (7814 tags)

| kind | count | notes |
|---|---|---|
| item | 347 | 58 melee, 22 ranged, 156 armor, 41 artifacts, 24 talismans, 33 enchantment books, 8 capes, 3 pets, 2 throwables |
| nativeTag | 4143 | tags declared in `Config/tags/SpicewoodTags.ini` (no table row) |
| effectTemplate | 332 | enchantment/effects that roll on gear |
| effect | 224 | `SW.Effect.*` gameplay effects |
| enchantment | 194 | `SW.Enchantment.*` incl. soul enchantments |
| lootSource | 129 | who drops what (`DT_LootSourceDefinition*`) |
| itemSlot | 33 | `SW.ItemSlot.*` (EquippedSlot/TargetSlotOverride values) |
| skin | 28 | `SW.Skin.*` cosmetics |
| rarity | 6 | Common/Rare/Special/Unique… |
| currency | 3 | Emeralds, SpringStone, … (Ability.Attributes names) |

## Save ↔ catalog mapping

| Save field | Catalog lookup |
|---|---|
| `Inventory.Entries[].ItemData.TypeTag` | `entries[tag]` (kind=item) |
| `Inventory.Entries[].ItemData.RarityTag` | kind=rarity |
| `Inventory.Entries[].ItemData.Effects[]` | kind=effect/effectTemplate |
| `Inventory.Entries[].ItemData.DynamicPropertyTags[]` | nativeTag (`SW.Item.Property.Dynamic.*`) |
| `Inventory.Entries[].EquippedSlot` / `TargetSlotOverride` | kind=itemSlot |
| `CollectionsStats.Collected*[]` / `LootProgression.DiscoveredLoot[]` | kind=item |
| `Cosmetics.Cosmetics["SW.Skin"].TypeTag` | kind=skin |
| `Ability.Attributes[].AttributeName` ("Emeralds"…) | kind=currency (`name` field) |

## Notes

- Join on `tag`, never on `name` — e.g. `SW.Item.Powerbow` (save) vs
  `PowerBow` (table row name). Tags are the canonical key.
- Item stats live in separate tables (`DT_Melee/Ranged/Armor/Artifact/
  TalismanPropertyDefinition`); those re-definitions are listed in
  `alsoDefinedIn` on item entries.
- Verified against a real save: 66/81 referenced tags resolve to table rows;
  the rest are runtime-only tutorial/world tags (`SW.UI.Onboarding.*`,
  `SW.Region.*`, parent tags) that exist only in C++ and are harmless.
