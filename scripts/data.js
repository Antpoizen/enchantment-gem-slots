import {
  CHANGE_CONDITIONS,
  ENTRY_KINDS,
  EXCLUDED_PHYSICAL_ITEM_TYPES,
  FLAG_KEYS,
  MODULE_ID,
  SUPPORTED_BASE_ITEM_TYPES,
} from "./constants.js";

const utils = foundry.utils;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function integer(value, fallback = 0) {
  return Math.trunc(finiteNumber(value, fallback));
}

function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, integer(value, fallback));
}

export function debug(...args) {
  if (game.settings?.get(MODULE_ID, "debugLogging")) {
    console.debug(`${MODULE_ID} |`, ...args);
  }
}

export function getPF1ChangeChoices(item) {
  const localizeChoice = (value, fallback) => {
    const raw = typeof value === "string" ? value : value?.label ?? fallback;
    return game.i18n?.localize ? game.i18n.localize(raw) : raw;
  };

  let targets = {};
  try {
    const source = globalThis.pf1?.utils?.internal?.getBuffTargets?.("buffs", {
      actor: item?.actor,
      item,
    }) ?? {};
    targets = Object.fromEntries(
      Object.entries(source)
        .map(([key, data]) => [key, localizeChoice(data, key)])
        .sort((a, b) => String(a[1]).localeCompare(String(b[1]))),
    );
  } catch (_error) {
    targets = {};
  }

  const bonusTypes = Object.fromEntries(
    Object.entries(globalThis.pf1?.config?.bonusTypes ?? {})
      .map(([key, data]) => [key, localizeChoice(data, key)])
      .sort((a, b) => String(a[1]).localeCompare(String(b[1]))),
  );
  return { targets, bonusTypes };
}

export function isSupportedItem(item) {
  if (!item || item.documentName !== "Item") return false;
  if (SUPPORTED_BASE_ITEM_TYPES.has(item.type)) return true;
  if (!game.settings.get(MODULE_ID, "enableOtherPhysicalItems")) return false;
  return Boolean(item.isPhysical) && !EXCLUDED_PHYSICAL_ITEM_TYPES.has(item.type);
}

export function getEquipmentDefaultKey(item, category) {
  if (item.type === "weapon") return `${category}Weapon`;
  if (item.type !== "equipment") return `${category}OtherPhysical`;

  const subType = item.system?.subType ?? item.subType ?? "other";
  if (subType === "armor") return `${category}Armor`;
  if (subType === "shield") return `${category}Shield`;
  if (subType === "wondrous") return `${category}Wondrous`;
  return `${category}OtherEquipment`;
}

function getWorldDefault(item, category) {
  const key = getEquipmentDefaultKey(item, category);
  return nonNegativeInteger(game.settings.get(MODULE_ID, key), 0);
}

export function getDefaultItemSettings(item) {
  return {
    baseEnchantSlots: getWorldDefault(item, "defaultEnchant"),
    bonusEnchantSlots: 0,
    maxEnchantRank: 0,
    baseGemSlots: getWorldDefault(item, "defaultGem"),
    bonusGemSlots: 0,
    enchantmentsEnabled: true,
    gemsEnabled: true,
  };
}

export function normalizeItemSettings(settings = {}, item = null) {
  const defaults = item ? getDefaultItemSettings(item) : {
    baseEnchantSlots: 0,
    bonusEnchantSlots: 0,
    maxEnchantRank: 0,
    baseGemSlots: 0,
    bonusGemSlots: 0,
    enchantmentsEnabled: true,
    gemsEnabled: true,
  };

  return {
    baseEnchantSlots: nonNegativeInteger(settings.baseEnchantSlots, defaults.baseEnchantSlots),
    bonusEnchantSlots: nonNegativeInteger(settings.bonusEnchantSlots, defaults.bonusEnchantSlots),
    maxEnchantRank: nonNegativeInteger(settings.maxEnchantRank, defaults.maxEnchantRank),
    baseGemSlots: nonNegativeInteger(settings.baseGemSlots, defaults.baseGemSlots),
    bonusGemSlots: nonNegativeInteger(settings.bonusGemSlots, defaults.bonusGemSlots),
    enchantmentsEnabled: settings.enchantmentsEnabled ?? defaults.enchantmentsEnabled,
    gemsEnabled: settings.gemsEnabled ?? defaults.gemsEnabled,
  };
}

export function getItemSettings(item) {
  return normalizeItemSettings(item.getFlag(MODULE_ID, FLAG_KEYS.settings) ?? {}, item);
}

export function normalizeMechanicalChange(change = {}) {
  const allowedConditions = new Set(Object.values(CHANGE_CONDITIONS));
  const condition = allowedConditions.has(change.condition) ? change.condition : CHANGE_CONDITIONS.always;
  const operator = change.operator === "set" ? "set" : "add";

  return {
    id: String(change.id || utils.randomID(12)),
    nativeId: String(change.nativeId || utils.randomID(8)).slice(0, 16),
    formula: String(change.formula ?? "").trim(),
    operator,
    target: String(change.target ?? "").trim(),
    type: String(change.type ?? "untyped").trim() || "untyped",
    priority: integer(change.priority, 0),
    condition,
    damageType: String(change.damageType ?? "").trim(),
  };
}

export function normalizeEntry(entry = {}, kind = ENTRY_KINDS.enchantment) {
  const isGem = kind === ENTRY_KINDS.gem;
  const normalized = {
    id: String(entry.id || utils.randomID(16)),
    kind,
    name: String(entry.name ?? "").trim(),
    description: String(entry.description ?? "").trim(),
    rank: nonNegativeInteger(entry.rank ?? entry.tier, 0),
    tierLabel: String(entry.tierLabel ?? "").trim(),
    slotCost: nonNegativeInteger(entry.slotCost, 1),
    gpCost: nonNegativeNumber(entry.gpCost, 0),
    enabled: entry.enabled !== false,
    img: String(entry.img ?? "icons/svg/item-bag.svg").trim() || "icons/svg/item-bag.svg",
    sourceUuid: String(entry.sourceUuid ?? "").trim(),
    gemType: isGem ? String(entry.gemType ?? "").trim() : "",
    changes: Array.isArray(entry.changes)
      ? entry.changes.map((change) => normalizeMechanicalChange(change))
      : [],
  };
  return normalized;
}

export function getEntries(item, kind) {
  const key = kind === ENTRY_KINDS.gem ? FLAG_KEYS.gems : FLAG_KEYS.enchantments;
  const raw = item.getFlag(MODULE_ID, key);
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => normalizeEntry(entry, kind));
}

export function getEnchantments(item) {
  return getEntries(item, ENTRY_KINDS.enchantment);
}

export function getGems(item) {
  return getEntries(item, ENTRY_KINDS.gem);
}

export function getEffectiveSlotCost(entry, kind) {
  if (
    kind === ENTRY_KINDS.enchantment
    && game.settings.get(MODULE_ID, "rankZeroUsesNoSlots")
    && Number(entry.rank) === 0
  ) return 0;
  return nonNegativeInteger(entry.slotCost, 0);
}

export function getSlotSummary(item, overrides = {}) {
  const settings = overrides.settings ?? getItemSettings(item);
  const enchantments = overrides.enchantments ?? getEnchantments(item);
  const gems = overrides.gems ?? getGems(item);

  const enchantmentsActive = settings.enchantmentsEnabled
    && game.settings.get(MODULE_ID, "enableEnchantments");
  const gemsActive = settings.gemsEnabled
    && game.settings.get(MODULE_ID, "enableGems");
  const enchantmentMax = enchantmentsActive
    ? settings.baseEnchantSlots + settings.bonusEnchantSlots
    : 0;
  const gemMax = gemsActive
    ? settings.baseGemSlots + settings.bonusGemSlots
    : 0;

  const enchantmentUsed = enchantmentsActive
    ? enchantments.reduce(
      (total, entry) => total + getEffectiveSlotCost(entry, ENTRY_KINDS.enchantment),
      0,
    )
    : 0;
  const gemUsed = gemsActive
    ? gems.reduce(
      (total, entry) => total + getEffectiveSlotCost(entry, ENTRY_KINDS.gem),
      0,
    )
    : 0;

  return {
    settings,
    enchantments,
    gems,
    enchantment: {
      max: enchantmentMax,
      used: enchantmentUsed,
      remaining: enchantmentMax - enchantmentUsed,
      full: enchantmentMax > 0 && enchantmentUsed === enchantmentMax,
      over: enchantmentUsed > enchantmentMax,
    },
    gem: {
      max: gemMax,
      used: gemUsed,
      remaining: gemMax - gemUsed,
      full: gemMax > 0 && gemUsed === gemMax,
      over: gemUsed > gemMax,
    },
  };
}

export function validateItemSlots(item, overrides = {}) {
  const summary = getSlotSummary(item, overrides);
  const warnings = [];
  const errors = [];
  const { targets, bonusTypes } = getPF1ChangeChoices(item);
  const hasTargetCatalog = Object.keys(targets).length > 0;
  const hasBonusTypeCatalog = Object.keys(bonusTypes).length > 0;

  if (summary.enchantment.over) {
    errors.push({
      code: "enchantment-over-slot",
      message: game.i18n.format("EGS.Validation.EnchantmentOverSlots", {
        used: summary.enchantment.used,
        max: summary.enchantment.max,
      }),
    });
  }
  if (summary.gem.over) {
    errors.push({
      code: "gem-over-slot",
      message: game.i18n.format("EGS.Validation.GemOverSlots", {
        used: summary.gem.used,
        max: summary.gem.max,
      }),
    });
  }

  if (game.settings.get(MODULE_ID, "enforceMaximumRank") && summary.settings.maxEnchantRank > 0) {
    for (const entry of summary.enchantments) {
      if (entry.rank > summary.settings.maxEnchantRank) {
        errors.push({
          code: "enchantment-rank-too-high",
          entryId: entry.id,
          message: game.i18n.format("EGS.Validation.RankTooHigh", {
            name: entry.name,
            rank: entry.rank,
            max: summary.settings.maxEnchantRank,
          }),
        });
      }
    }
  }

  for (const entry of [...summary.enchantments, ...summary.gems]) {
    if (!entry.name) {
      errors.push({
        code: "empty-name",
        entryId: entry.id,
        message: game.i18n.localize("EGS.Validation.EmptyName"),
      });
    }
    if (entry.sourceUuid && entry.sourceMissing) {
      warnings.push({
        code: "missing-source",
        entryId: entry.id,
        message: game.i18n.format("EGS.Validation.MissingSource", { name: entry.name }),
      });
    }
    for (const change of entry.changes) {
      if (!change.target) {
        errors.push({
          code: "missing-change-target",
          entryId: entry.id,
          changeId: change.id,
          message: game.i18n.format("EGS.Validation.MissingChangeTarget", { name: entry.name }),
        });
      } else if (hasTargetCatalog && !(change.target in targets)) {
        warnings.push({
          code: "invalid-change-target",
          entryId: entry.id,
          changeId: change.id,
          message: game.i18n.format("EGS.Validation.InvalidChangeTarget", {
            name: entry.name,
            target: change.target,
          }),
        });
      }
      if (hasBonusTypeCatalog && change.type && !(change.type in bonusTypes)) {
        warnings.push({
          code: "invalid-bonus-type",
          entryId: entry.id,
          changeId: change.id,
          message: game.i18n.format("EGS.Validation.InvalidBonusType", {
            name: entry.name,
            type: change.type,
          }),
        });
      }
      if (!change.formula) {
        errors.push({
          code: "empty-formula",
          entryId: entry.id,
          changeId: change.id,
          message: game.i18n.localize("EGS.Validation.EmptyFormula"),
        });
      } else if (globalThis.Roll?.create) {
        try {
          Roll.create(change.formula);
        } catch (error) {
          errors.push({
            code: "invalid-formula",
            entryId: entry.id,
            changeId: change.id,
            message: game.i18n.format("EGS.Validation.InvalidFormula", {
              formula: change.formula,
              error: error.message,
            }),
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary,
  };
}

export async function resolveEntrySources(entries) {
  const cache = new Map();
  for (const entry of entries) {
    if (!entry.sourceUuid) continue;
    if (!cache.has(entry.sourceUuid)) {
      cache.set(entry.sourceUuid, fromUuid(entry.sourceUuid).catch(() => null));
    }
  }

  await Promise.all([...cache.values()]);
  return Promise.all(entries.map(async (entry) => {
    if (!entry.sourceUuid) return { ...entry, sourceMissing: false };
    const source = await cache.get(entry.sourceUuid);
    return {
      ...entry,
      sourceMissing: !source,
      sourceName: source?.name ?? "",
    };
  }));
}

export function collectPersistentItems() {
  const items = [];
  const seen = new Set();
  const add = (item) => {
    if (!item || seen.has(item.uuid)) return;
    seen.add(item.uuid);
    items.push(item);
  };

  for (const item of game.items ?? []) add(item);
  for (const actor of game.actors ?? []) {
    for (const item of actor.items ?? []) add(item);
  }
  return items;
}

export function itemHasModuleData(item) {
  const flags = item.flags?.[MODULE_ID];
  return Boolean(flags && (
    Array.isArray(flags.enchantments)
    || Array.isArray(flags.gems)
    || flags.settings
  ));
}

export function cloneModuleFlags(item) {
  return utils.deepClone(item.flags?.[MODULE_ID] ?? {});
}

export async function updateItemModuleFlags(item, flags, options = {}) {
  return item.update({ [`flags.${MODULE_ID}`]: flags }, options);
}

export function sanitizeForTemplate(text) {
  return String(text ?? "");
}
