import {
  ENTRY_KINDS,
  FLAG_KEYS,
  MODULE_HOOKS,
  MODULE_ID,
} from "./constants.js";
import {
  getEnchantments,
  getGems,
  getItemSettings,
  getSlotSummary,
  normalizeEntry,
  normalizeItemSettings,
  validateItemSlots,
} from "./data.js";
import { syncItemEffects } from "./effects.js";

function collectionKey(kind) {
  return kind === ENTRY_KINDS.gem ? FLAG_KEYS.gems : FLAG_KEYS.enchantments;
}

function entriesFor(item, kind) {
  return kind === ENTRY_KINDS.gem ? getGems(item) : getEnchantments(item);
}

function canOwn(item) {
  return Boolean(game.user.isGM || item?.isOwner);
}

function assertModifyPermission(item, action = "install") {
  if (!item || item.documentName !== "Item") throw new Error(game.i18n.localize("EGS.Error.InvalidItem"));
  if (!canOwn(item)) throw new Error(game.i18n.localize("EGS.Error.NotOwner"));
  if (game.user.isGM) return;

  if (action === "remove" && !game.settings.get(MODULE_ID, "playerRemove")) {
    throw new Error(game.i18n.localize("EGS.Error.PlayerRemoveDisabled"));
  }
  if (action !== "remove" && !game.settings.get(MODULE_ID, "playerInstall")) {
    throw new Error(game.i18n.localize("EGS.Error.PlayerInstallDisabled"));
  }
}

function canBypassOverSlotting() {
  return game.user.isGM || game.settings.get(MODULE_ID, "allowOverSlotting");
}

function canBypassRank() {
  return game.user.isGM && game.settings.get(MODULE_ID, "gmOverrideRank");
}

async function saveEntries(item, kind, entries, { render = true } = {}) {
  const key = collectionKey(kind);
  await item.setFlag(MODULE_ID, key, entries);
  await syncItemEffects(item, { render: false });
  if (render) item.sheet?.render(false);
  return entries;
}

function ensureValidationAllowed(validation) {
  const overSlotErrors = validation.errors.filter((error) => error.code.endsWith("over-slot"));
  const rankErrors = validation.errors.filter((error) => error.code === "enchantment-rank-too-high");
  const ordinaryErrors = validation.errors.filter((error) => (
    !error.code.endsWith("over-slot") && error.code !== "enchantment-rank-too-high"
  ));

  if (ordinaryErrors.length) {
    throw new Error(ordinaryErrors.map((error) => error.message).join("\n"));
  }
  if (overSlotErrors.length && !canBypassOverSlotting()) {
    throw new Error(overSlotErrors.map((error) => error.message).join("\n"));
  }
  if (rankErrors.length && !canBypassRank()) {
    throw new Error(rankErrors.map((error) => error.message).join("\n"));
  }
  return validation;
}

function ensureProjectedValid(item, kind, entries) {
  const overrides = kind === ENTRY_KINDS.gem
    ? { gems: entries }
    : { enchantments: entries };
  return ensureValidationAllowed(validateItemSlots(item, overrides));
}

async function addEntry(item, kind, entryData) {
  assertModifyPermission(item, "install");
  const entry = normalizeEntry(entryData, kind);
  if (!entry.name) throw new Error(game.i18n.localize("EGS.Validation.EmptyName"));

  const entries = entriesFor(item, kind);
  entries.push(entry);
  ensureProjectedValid(item, kind, entries);
  await saveEntries(item, kind, entries);

  Hooks.callAll(
    kind === ENTRY_KINDS.gem ? MODULE_HOOKS.gemAdded : MODULE_HOOKS.enchantmentAdded,
    item,
    entry,
  );
  return entry;
}

async function updateEntry(item, kind, entryId, updateData) {
  assertModifyPermission(item, "install");
  const entries = entriesFor(item, kind);
  const index = entries.findIndex((entry) => entry.id === entryId);
  if (index < 0) throw new Error(game.i18n.localize("EGS.Error.EntryNotFound"));

  const updated = normalizeEntry(
    foundry.utils.mergeObject(entries[index], updateData, { inplace: false, overwrite: true }),
    kind,
  );
  updated.id = entries[index].id;
  entries[index] = updated;
  ensureProjectedValid(item, kind, entries);
  await saveEntries(item, kind, entries);

  Hooks.callAll(
    kind === ENTRY_KINDS.gem ? MODULE_HOOKS.gemUpdated : MODULE_HOOKS.enchantmentUpdated,
    item,
    updated,
  );
  return updated;
}

async function removeEntry(item, kind, entryId) {
  assertModifyPermission(item, "remove");
  const entries = entriesFor(item, kind);
  const index = entries.findIndex((entry) => entry.id === entryId);
  if (index < 0) throw new Error(game.i18n.localize("EGS.Error.EntryNotFound"));
  const [removed] = entries.splice(index, 1);
  await saveEntries(item, kind, entries);

  Hooks.callAll(
    kind === ENTRY_KINDS.gem ? MODULE_HOOKS.gemRemoved : MODULE_HOOKS.enchantmentRemoved,
    item,
    removed,
  );
  return removed;
}

async function setItemSettings(item, updateData) {
  assertModifyPermission(item, "install");
  const current = getItemSettings(item);
  const merged = normalizeItemSettings(
    foundry.utils.mergeObject(current, updateData, { inplace: false, overwrite: true }),
    item,
  );
  ensureValidationAllowed(validateItemSlots(item, { settings: merged }));
  await item.setFlag(MODULE_ID, FLAG_KEYS.settings, merged);
  await syncItemEffects(item, { render: false });
  item.sheet?.render(false);
  return merged;
}

async function recalculateItem(item) {
  assertModifyPermission(item, "install");
  await syncItemEffects(item, { render: false });
  const result = validateItemSlots(item);
  Hooks.callAll(MODULE_HOOKS.itemRecalculated, item, result);
  return result;
}

export const api = Object.freeze({
  getEnchantments,
  getGems,
  getItemSettings,
  getSlotSummary,
  validateItemSlots,
  setItemSettings,
  addEnchantment: (item, data) => addEntry(item, ENTRY_KINDS.enchantment, data),
  updateEnchantment: (item, id, data) => updateEntry(item, ENTRY_KINDS.enchantment, id, data),
  removeEnchantment: (item, id) => removeEntry(item, ENTRY_KINDS.enchantment, id),
  addGem: (item, data) => addEntry(item, ENTRY_KINDS.gem, data),
  updateGem: (item, id, data) => updateEntry(item, ENTRY_KINDS.gem, id, data),
  removeGem: (item, id) => removeEntry(item, ENTRY_KINDS.gem, id),
  recalculateItem,
  syncItemEffects,
});
