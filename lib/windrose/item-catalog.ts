import catalogData from "@/data/windrose/item_catalog.json";

export interface CatalogItem {
  id: string;
  itemParams: string;
  name: string;
  description: string;
}

export const itemCatalog: CatalogItem[] = catalogData as CatalogItem[];

const _byParams = new Map<string, CatalogItem>();
for (const item of itemCatalog) {
  _byParams.set(item.itemParams, item);
}

export function lookupItemByParams(itemParams: string): CatalogItem | undefined {
  return _byParams.get(itemParams);
}

/** Extract a readable name from an item params path */
function extractNameFromParams(itemParams: string): string {
  if (!itemParams) return "Empty";
  const fileName = itemParams.split("/").pop()?.split(".")[0] ?? itemParams;
  return fileName
    .replace(/^DA_/, "")
    .replace(/^(EID|CID|DID|AID)_/, "")
    .replace(/_/g, " ")
    .replace(/T(\d+)$/, " T$1");
}

/** Get a display name for an item, checking the catalog first */
export function getItemDisplayName(itemParams: string): string {
  const catalogItem = lookupItemByParams(itemParams);
  if (catalogItem?.name) return catalogItem.name;
  return extractNameFromParams(itemParams);
}
