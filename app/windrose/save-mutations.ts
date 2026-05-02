import type { WindroseSave, CFEntry } from "@/lib/windrose/decoder";
import recipeListsData from "@/data/windrose/recipe_lists.json";

// --- Helpers ---

function cloneSave(save: WindroseSave, ...modifiedDBs: string[]): WindroseSave {
  const s = JSON.parse(JSON.stringify(save, (_, v) =>
    typeof v === "bigint" ? Number(v) : v
  )) as WindroseSave;
  for (const db of modifiedDBs) {
    s._modifiedDBs[db] = true;
  }
  return s;
}

function getPlayer(save: WindroseSave): Record<string, unknown> {
  return save.databases.players["R5BLPlayer"]?.[0]?.value ?? {};
}

function getPlayerMeta(save: WindroseSave): Record<string, unknown> {
  return (getPlayer(save) as { PlayerMetadata?: Record<string, unknown> }).PlayerMetadata ?? {};
}

function getProgression(save: WindroseSave): Record<string, unknown> {
  return (getPlayerMeta(save) as { PlayerProgression?: Record<string, unknown> }).PlayerProgression ?? {};
}

// --- Player Mutations ---

export function setPlayerName(save: WindroseSave, name: string): WindroseSave {
  const s = cloneSave(save, "players");
  if (s.databases.players["R5BLPlayer"]?.[0]) {
    s.databases.players["R5BLPlayer"][0].value.PlayerName = name;
  }
  return s;
}

/** After changing node levels, sync ProgressionPoints and ActivePerk */
function syncTree(tree: Record<string, unknown>) {
  const nodes = tree.Nodes as Array<Record<string, unknown>> | undefined;
  if (!nodes) return;
  let totalSpent = 0;
  for (const node of nodes) {
    const level = (node.NodeLevel as number) ?? 0;
    const nodeData = node.NodeData as Record<string, unknown> | undefined;
    const perks = (nodeData?.Perks as string[]) ?? [];
    // ActivePerk must be set when level > 0
    node.ActivePerk = level > 0 && perks.length > 0 ? perks[0] : "";
    totalSpent += level * ((nodeData?.NodePointsCost as number) ?? 1);
  }
  // ProgressionPoints must be >= total spent
  const currentPoints = (tree.ProgressionPoints as number) ?? 0;
  if (totalSpent > currentPoints) {
    tree.ProgressionPoints = totalSpent;
  }
}

export function setPlayerStat(save: WindroseSave, statIndex: number, level: number): WindroseSave {
  const s = cloneSave(save, "players");
  const player = s.databases.players["R5BLPlayer"]?.[0]?.value;
  if (!player) return s;
  const meta = player.PlayerMetadata as Record<string, unknown> | undefined;
  if (!meta) return s;
  const prog = meta.PlayerProgression as Record<string, unknown> | undefined;
  if (!prog) return s;
  const statTree = prog.StatTree as Record<string, unknown> | undefined;
  if (!statTree) return s;
  const nodes = statTree.Nodes as Array<Record<string, unknown>> | undefined;
  if (!nodes || statIndex >= nodes.length) return s;
  nodes[statIndex].NodeLevel = Math.max(0, Math.min(60, level));
  syncTree(statTree);
  return s;
}

export function setAllStatsMax(save: WindroseSave): WindroseSave {
  const s = cloneSave(save, "players");
  const player = s.databases.players["R5BLPlayer"]?.[0]?.value;
  if (!player) return s;
  const meta = player.PlayerMetadata as Record<string, unknown> | undefined;
  if (!meta) return s;
  const prog = meta.PlayerProgression as Record<string, unknown> | undefined;
  if (!prog) return s;
  const statTree = prog.StatTree as Record<string, unknown> | undefined;
  if (!statTree) return s;
  const nodes = statTree.Nodes as Array<Record<string, unknown>> | undefined;
  if (!nodes) return s;
  for (const node of nodes) {
    const nodeData = node.NodeData as Record<string, unknown> | undefined;
    const maxLevel = (nodeData?.MaxNodeLevel as number) ?? 60;
    node.NodeLevel = maxLevel;
  }
  syncTree(statTree);
  return s;
}

export function setRewardLevel(save: WindroseSave, level: number): WindroseSave {
  const s = cloneSave(save, "players");
  const player = s.databases.players["R5BLPlayer"]?.[0]?.value;
  if (!player) return s;
  const meta = player.PlayerMetadata as Record<string, unknown> | undefined;
  if (!meta) return s;
  const prog = meta.PlayerProgression as Record<string, unknown> | undefined;
  if (!prog) return s;
  prog.RewardLevel = Math.max(0, level);
  return s;
}

// --- Ship Mutations ---

export function setShipHealth(save: WindroseSave, shipIndex: number, health: number): WindroseSave {
  const s = cloneSave(save, "players");
  const ships = s.databases.players["R5BLShip"];
  if (!ships || shipIndex >= ships.length) return s;
  const attrs = ships[shipIndex].value.Attributes as Record<string, unknown> | undefined;
  if (attrs) {
    attrs.HealthPercent = Math.max(0, Math.min(1, health));
  }
  return s;
}

export function setAllShipsFullHealth(save: WindroseSave): WindroseSave {
  const s = cloneSave(save, "players");
  const ships = s.databases.players["R5BLShip"];
  if (!ships) return s;
  for (const ship of ships) {
    const attrs = ship.value.Attributes as Record<string, unknown> | undefined;
    if (attrs) {
      attrs.HealthPercent = 1;
    }
  }
  return s;
}

// --- Inventory Mutations ---

interface InventorySlot {
  IsPersonalSlot: boolean;
  ItemsStack: {
    Count: number;
    Item: {
      Attributes: unknown[];
      Effects: unknown[];
      ItemId: string;
      ItemParams: string;
    };
  };
  SlotId: number;
  SlotParams: string;
}

/** Get building blocks that have storage inventory (28-slot chests placed by the player) */
export function getStorageBlocks(save: WindroseSave): Array<{ key: string; value: Record<string, unknown> }> {
  const blocks = save.databases.worlds["R5BLActor_BuildingBlock"] ?? [];
  return blocks.filter(b => {
    const inv = b.value.Inventory as Record<string, unknown> | undefined;
    if (!inv) return false;
    const modules = (inv.Modules ?? []) as Array<Record<string, unknown>>;
    // Storage chests have 28-slot modules
    return modules.some(m => ((m.Slots ?? []) as unknown[]).length >= 20);
  });
}

function getInventorySlots(
  save: WindroseSave,
  target: "player" | "ship" | "storage",
  targetIndex: number,
  moduleIndex: number,
): InventorySlot[] | null {
  let inventory: Record<string, unknown> | undefined;

  if (target === "player") {
    const player = save.databases.players["R5BLPlayer"]?.[0]?.value;
    inventory = player?.Inventory as Record<string, unknown> | undefined;
  } else if (target === "ship") {
    const ship = save.databases.players["R5BLShip"]?.[targetIndex]?.value;
    inventory = ship?.Inventory as Record<string, unknown> | undefined;
  } else if (target === "storage") {
    const blocks = getStorageBlocks(save);
    const block = blocks[targetIndex];
    if (block) {
      inventory = block.value.Inventory as Record<string, unknown> | undefined;
    }
  }

  if (!inventory) return null;
  const modules = inventory.Modules as Array<Record<string, unknown>> | undefined;
  if (!modules || moduleIndex >= modules.length) return null;
  return modules[moduleIndex].Slots as InventorySlot[] | undefined ?? null;
}

export function setInventoryItemCount(
  save: WindroseSave,
  target: "player" | "ship" | "storage",
  targetIndex: number,
  moduleIndex: number,
  slotIndex: number,
  count: number,
): WindroseSave {
  const s = cloneSave(save, target === "storage" ? "worlds" : "players");
  const slots = getInventorySlots(s, target, targetIndex, moduleIndex);
  if (!slots) return s;
  const slot = slots.find(sl => sl.SlotId === slotIndex);
  if (!slot) return s;
  slot.ItemsStack.Count = Math.max(0, count);
  return s;
}

export function setInventoryItem(
  save: WindroseSave,
  target: "player" | "ship" | "storage",
  targetIndex: number,
  moduleIndex: number,
  slotIndex: number,
  itemParams: string,
  count: number,
): WindroseSave {
  const s = cloneSave(save, target === "storage" ? "worlds" : "players");
  const slots = getInventorySlots(s, target, targetIndex, moduleIndex);
  if (!slots) return s;
  const slot = slots.find(sl => sl.SlotId === slotIndex);
  if (!slot) return s;
  slot.ItemsStack = {
    Count: Math.max(1, count),
    Item: {
      Attributes: [],
      Effects: [],
      ItemId: Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("").toUpperCase(),
      ItemParams: itemParams,
    },
  };
  return s;
}

export function clearInventorySlot(
  save: WindroseSave,
  target: "player" | "ship" | "storage",
  targetIndex: number,
  moduleIndex: number,
  slotIndex: number,
): WindroseSave {
  const s = cloneSave(save, target === "storage" ? "worlds" : "players");
  const slots = getInventorySlots(s, target, targetIndex, moduleIndex);
  if (!slots) return s;
  const slot = slots.find(sl => sl.SlotId === slotIndex);
  if (!slot) return s;
  slot.ItemsStack = {
    Count: 0,
    Item: {
      Attributes: [],
      Effects: [],
      ItemId: "",
      ItemParams: "",
    },
  };
  return s;
}

const LEVEL_TAG = "Inventory.Item.Attribute.Level";

export function setItemLevel(
  save: WindroseSave,
  target: "player" | "ship" | "storage",
  targetIndex: number,
  moduleIndex: number,
  slotIndex: number,
  level: number,
): WindroseSave {
  const s = cloneSave(save, target === "storage" ? "worlds" : "players");
  const slots = getInventorySlots(s, target, targetIndex, moduleIndex);
  if (!slots) return s;
  const slot = slots.find(sl => sl.SlotId === slotIndex);
  if (!slot) return s;
  const attrs = slot.ItemsStack.Item.Attributes as Array<Record<string, unknown>>;
  const existing = attrs.find(a => (a.Tag as Record<string, unknown>)?.TagName === LEVEL_TAG);
  if (existing) {
    const max = (existing.MaxValue as number) ?? 15;
    existing.Value = Math.max(1, Math.min(max, level));
  } else {
    // Add level attribute if item doesn't have one yet
    attrs.push({
      MaxValue: 15,
      Tag: { TagName: LEVEL_TAG },
      Value: Math.max(1, Math.min(15, level)),
    });
  }
  return s;
}

// --- Recipe Mutations ---

interface RecipeEntry {
  IsNew: boolean;
  Recipe: { RecipeData: string };
}

interface FinishedRecipeEntry {
  Count: number;
  Recipe: { RecipeData: string };
}

function getAllKnownRecipes(): string[] {
  const all = new Set<string>();
  for (const recipes of Object.values(recipeListsData)) {
    for (const r of recipes as string[]) {
      all.add(r);
    }
  }
  return [...all];
}

export function setRecipeState(
  save: WindroseSave,
  recipeData: string,
  state: "locked" | "unlocked" | "finished",
): WindroseSave {
  const s = cloneSave(save, "players");
  const player = s.databases.players["R5BLPlayer"]?.[0]?.value;
  if (!player) return s;
  const meta = player.PlayerMetadata as Record<string, unknown> | undefined;
  if (!meta) return s;

  let unlocked = (meta.UnlockedRecipes ?? []) as RecipeEntry[];
  let finished = (meta.FinishedRecipes ?? []) as FinishedRecipeEntry[];

  // Remove from both lists first
  unlocked = unlocked.filter(r => r.Recipe.RecipeData !== recipeData);
  finished = finished.filter(r => r.Recipe.RecipeData !== recipeData);

  if (state === "unlocked" || state === "finished") {
    unlocked.push({ IsNew: false, Recipe: { RecipeData: recipeData } });
  }
  if (state === "finished") {
    finished.push({ Count: 1, Recipe: { RecipeData: recipeData } });
  }

  meta.UnlockedRecipes = unlocked;
  meta.FinishedRecipes = finished;
  return s;
}

export function unlockAllRecipes(save: WindroseSave): WindroseSave {
  const s = cloneSave(save, "players");
  const player = s.databases.players["R5BLPlayer"]?.[0]?.value;
  if (!player) return s;
  const meta = player.PlayerMetadata as Record<string, unknown> | undefined;
  if (!meta) return s;

  const existing = new Set(
    ((meta.UnlockedRecipes ?? []) as RecipeEntry[]).map(r => r.Recipe.RecipeData)
  );

  const allRecipes = getAllKnownRecipes();
  const unlocked = [...(meta.UnlockedRecipes as RecipeEntry[] ?? [])];
  for (const recipe of allRecipes) {
    if (!existing.has(recipe)) {
      unlocked.push({ IsNew: false, Recipe: { RecipeData: recipe } });
    }
  }

  meta.UnlockedRecipes = unlocked;
  return s;
}

export function finishAllRecipes(save: WindroseSave): WindroseSave {
  const s = cloneSave(save, "players");
  const player = s.databases.players["R5BLPlayer"]?.[0]?.value;
  if (!player) return s;
  const meta = player.PlayerMetadata as Record<string, unknown> | undefined;
  if (!meta) return s;

  // Combine recipes from our lists AND any already-unlocked recipes
  const allFromLists = getAllKnownRecipes();
  const currentUnlocked = ((meta.UnlockedRecipes ?? []) as RecipeEntry[]).map(r => r.Recipe.RecipeData);
  const allRecipes = [...new Set([...allFromLists, ...currentUnlocked])];

  const existingUnlocked = new Set(currentUnlocked);
  const existingFinished = new Set(
    ((meta.FinishedRecipes ?? []) as FinishedRecipeEntry[]).map(r => r.Recipe.RecipeData)
  );

  const unlocked = [...(meta.UnlockedRecipes as RecipeEntry[] ?? [])];
  const finished = [...(meta.FinishedRecipes as FinishedRecipeEntry[] ?? [])];

  for (const recipe of allRecipes) {
    if (!existingUnlocked.has(recipe)) {
      unlocked.push({ IsNew: false, Recipe: { RecipeData: recipe } });
    }
    if (!existingFinished.has(recipe)) {
      finished.push({ Count: 1, Recipe: { RecipeData: recipe } });
    }
  }

  meta.UnlockedRecipes = unlocked;
  meta.FinishedRecipes = finished;
  return s;
}

// --- World Mutations ---

export function clearAllDroppedItems(save: WindroseSave): WindroseSave {
  const s = cloneSave(save, "worlds");
  s.databases.worlds["R5BLActor_Drop"] = [];
  return s;
}

export function teleportDropsToPlayer(save: WindroseSave): WindroseSave {
  const s = cloneSave(save, "worlds");
  const drops = s.databases.worlds["R5BLActor_Drop"];
  if (!drops || drops.length === 0) return s;

  // Find player's last position from PlayerInWorld
  const piw = s.databases.worlds["R5BLPlayerInWorld"];
  if (!piw || piw.length === 0) return s;

  const spawnLocs = piw[0].value.SpawnLocations as Record<string, unknown> | undefined;
  const lastPos = spawnLocs?.LastPositionData as Record<string, unknown> | undefined;
  const worldLoc = lastPos?.WorldLocation as { X: number; Y: number; Z: number } | undefined;

  if (!worldLoc) return s;

  // Move all drops to player position with slight random offset to avoid stacking
  for (const drop of drops) {
    const offsetX = (Math.random() - 0.5) * 200;
    const offsetY = (Math.random() - 0.5) * 200;
    drop.value.WorldLocation = {
      X: worldLoc.X + offsetX,
      Y: worldLoc.Y + offsetY,
      Z: worldLoc.Z + 50,
    };
  }

  return s;
}

export function teleportDeathBagsToPlayer(save: WindroseSave): WindroseSave {
  const s = cloneSave(save, "worlds");
  const chests = s.databases.worlds["R5BLIslandChest"];
  if (!chests || chests.length === 0) return s;

  const piw = s.databases.worlds["R5BLPlayerInWorld"];
  if (!piw || piw.length === 0) return s;

  const spawnLocs = piw[0].value.SpawnLocations as Record<string, unknown> | undefined;
  const lastPos = spawnLocs?.LastPositionData as Record<string, unknown> | undefined;
  const worldLoc = lastPos?.WorldLocation as { X: number; Y: number; Z: number } | undefined;
  if (!worldLoc) return s;

  for (const chest of chests) {
    const chestClass = chest.value.ChestClass as string | undefined;
    if (!chestClass?.includes("PosthumousContainer")) continue;

    const offsetX = (Math.random() - 0.5) * 200;
    const offsetY = (Math.random() - 0.5) * 200;
    chest.value.WorldLocation = {
      X: worldLoc.X + offsetX,
      Y: worldLoc.Y + offsetY,
      Z: worldLoc.Z + 50,
    };
  }

  return s;
}

// --- Recipe list data for UI ---

export function getRecipeCategories(): Record<string, string[]> {
  return recipeListsData as Record<string, string[]>;
}

/** Extract a readable name from a recipe path */
export function getRecipeDisplayName(recipeData: string): string {
  const fileName = recipeData.split("/").pop()?.split(".")[0] ?? recipeData;
  return fileName
    .replace(/^DA_RD_/, "")
    .replace(/^(EID|CID|DID|AID)_/, "")
    .replace(/_/g, " ")
    .replace(/T(\d+)$/, " T$1");
}

/** Get a readable category name from the recipe list key */
export function getCategoryDisplayName(category: string): string {
  return category
    .replace(/^(Handyman_|Trade_)/, "")
    .replace(/_/g, " ")
    .replace(/T(\d+)$/, " T$1")
    .replace(/([A-Z])/g, " $1")
    .trim();
}
