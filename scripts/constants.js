export const MODULE_ID = "enchantment-gem-slots";
export const MODULE_TITLE = "PF1e Enchantment and Gem Slots";
export const CURRENT_SCHEMA_VERSION = 1;
export const EFFECT_FLAVOR_PREFIX = "[EGS:";

export const FLAG_KEYS = Object.freeze({
  enchantments: "enchantments",
  gems: "gems",
  settings: "settings",
});

export const ENTRY_KINDS = Object.freeze({
  enchantment: "enchantment",
  gem: "gem",
});

export const CHANGE_CONDITIONS = Object.freeze({
  always: "always",
  equipped: "equipped",
  carried: "carried",
  identified: "identified",
  carriedIdentified: "carriedIdentified",
});

export const SUPPORTED_BASE_ITEM_TYPES = new Set(["weapon", "equipment"]);
export const EXCLUDED_PHYSICAL_ITEM_TYPES = new Set([
  "spell",
  "feat",
  "class",
  "buff",
  "race",
  "attack",
  "container",
]);

export const MODULE_HOOKS = Object.freeze({
  enchantmentAdded: `${MODULE_ID}.enchantmentAdded`,
  enchantmentUpdated: `${MODULE_ID}.enchantmentUpdated`,
  enchantmentRemoved: `${MODULE_ID}.enchantmentRemoved`,
  gemAdded: `${MODULE_ID}.gemAdded`,
  gemUpdated: `${MODULE_ID}.gemUpdated`,
  gemRemoved: `${MODULE_ID}.gemRemoved`,
  itemRecalculated: `${MODULE_ID}.itemRecalculated`,
});
