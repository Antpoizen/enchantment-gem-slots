import {
  CHANGE_CONDITIONS,
  EFFECT_FLAVOR_PREFIX,
  ENTRY_KINDS,
  MODULE_ID,
} from "./constants.js";
import {
  collectPersistentItems,
  debug,
  getEnchantments,
  getGems,
  getItemSettings,
  isSupportedItem,
} from "./data.js";

// Module-owned PF1 ItemChanges are identified by a flavor prefix. Rebuilding only
// those rows preserves changes authored directly through the PF1 item sheet.
export function isModuleOwnedChange(change) {
  return typeof change?.flavor === "string" && change.flavor.startsWith(EFFECT_FLAVOR_PREFIX);
}

export function changeConditionMet(item, change) {
  switch (change.condition) {
    case CHANGE_CONDITIONS.equipped:
      return item.system?.equipped === true;
    case CHANGE_CONDITIONS.carried:
      return item.system?.carried === true;
    case CHANGE_CONDITIONS.identified:
      return item.system?.identified !== false;
    case CHANGE_CONDITIONS.carriedIdentified:
      return item.system?.carried === true && item.system?.identified !== false;
    case CHANGE_CONDITIONS.always:
    default:
      return true;
  }
}

function buildNativeChange(item, entry, change) {
  if (!change.target || !change.formula) return null;
  if (!changeConditionMet(item, change)) return null;

  const marker = `[EGS:${entry.id}:${change.id}]`;
  const flavor = `${marker} ${entry.name}`;

  return {
    _id: change.nativeId,
    formula: change.formula,
    operator: change.operator,
    target: change.target,
    type: change.type || "untyped",
    priority: Number(change.priority) || 0,
    flavor,
  };
}

export function buildNativeChanges(item) {
  if (!game.settings.get(MODULE_ID, "enableMechanicalEffects")) return [];
  if (!isSupportedItem(item)) return [];

  const result = [];
  const settings = getItemSettings(item);
  const groups = [];
  if (game.settings.get(MODULE_ID, "enableEnchantments") && settings.enchantmentsEnabled) {
    groups.push([ENTRY_KINDS.enchantment, getEnchantments(item)]);
  }
  if (game.settings.get(MODULE_ID, "enableGems") && settings.gemsEnabled) {
    groups.push([ENTRY_KINDS.gem, getGems(item)]);
  }

  for (const [kind, entries] of groups) {
    for (const entry of entries) {
      if (!entry.enabled) continue;
      for (const change of entry.changes) {
        const nativeChange = buildNativeChange(item, entry, change);
        if (nativeChange) result.push(nativeChange);
      }
    }
  }
  return result;
}

function stableChangeData(changes) {
  return changes.map((change) => ({
    _id: change._id,
    formula: String(change.formula ?? ""),
    operator: change.operator ?? "add",
    target: change.target ?? "",
    type: change.type ?? "untyped",
    priority: Number(change.priority) || 0,
    flavor: change.flavor ?? "",
  }));
}

// Synchronization is idempotent: the desired module-owned rows are rebuilt from
// flags and compared against the current serialized system.changes array.
export async function syncItemEffects(item, { render = false } = {}) {
  if (!item || item.documentName !== "Item") return item;

  const rawChanges = item.toObject().system?.changes;
  if (!Array.isArray(rawChanges)) return item;

  const preserved = rawChanges.filter((change) => !isModuleOwnedChange(change));
  const desiredOwned = buildNativeChanges(item);
  const nextChanges = [...preserved, ...desiredOwned];

  const oldStable = stableChangeData(rawChanges);
  const nextStable = stableChangeData(nextChanges);
  if (JSON.stringify(oldStable) === JSON.stringify(nextStable)) return item;

  debug("Synchronizing PF1 ItemChanges", item.uuid, { oldStable, nextStable });
  return item.update(
    { "system.changes": nextChanges },
    { enchantmentGemSlotsSync: true, render },
  );
}

export async function removeModuleEffects(item, { render = false } = {}) {
  if (!item || item.documentName !== "Item") return item;
  const rawChanges = item.toObject().system?.changes;
  if (!Array.isArray(rawChanges)) return item;
  const nextChanges = rawChanges.filter((change) => !isModuleOwnedChange(change));
  if (nextChanges.length === rawChanges.length) return item;
  return item.update(
    { "system.changes": nextChanges },
    { enchantmentGemSlotsSync: true, render },
  );
}

export async function syncAllEffects() {
  if (!game.user.isGM) return;
  const items = collectPersistentItems().filter((item) => isSupportedItem(item));
  for (const item of items) {
    try {
      await syncItemEffects(item, { render: false });
    } catch (error) {
      Hooks.onError(`${MODULE_ID}.syncAllEffects`, error, {
        msg: `Failed to synchronize ${item.uuid}`,
        log: "error",
        data: { item },
      });
    }
  }
}
