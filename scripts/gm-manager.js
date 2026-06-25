import { CURRENT_SCHEMA_VERSION, MODULE_ID } from "./constants.js";
import {
  cloneModuleFlags,
  collectPersistentItems,
  getEnchantments,
  getGems,
  getSlotSummary,
  isSupportedItem,
  itemHasModuleData,
  normalizeEntry,
  normalizeItemSettings,
  resolveEntrySources,
  updateItemModuleFlags,
  validateItemSlots,
} from "./data.js";
import { syncItemEffects } from "./effects.js";

function settingKeysForExport() {
  return [...game.settings.settings.values()]
    .filter((setting) => setting.namespace === MODULE_ID && setting.scope === "world")
    .map((setting) => setting.key)
    .filter((key) => key !== "schemaVersion");
}

async function readFileText(file) {
  if (typeof readTextFromFile === "function") return readTextFromFile(file);
  return file.text();
}

function saveJson(data, filename) {
  const text = JSON.stringify(data, null, 2);
  if (typeof saveDataToFile === "function") {
    saveDataToFile(text, "application/json", filename);
    return;
  }
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export class GMManager extends FormApplication {
  get title() {
    return game.i18n.localize("EGS.GMManager.Title");
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "egs-gm-manager",
      template: `modules/${MODULE_ID}/templates/gm-manager.hbs`,
      classes: ["pf1", "egs-gm-manager"],
      width: 980,
      height: 700,
      resizable: true,
      closeOnSubmit: false,
      submitOnChange: false,
    });
  }

  async getData() {
    const rows = [];
    const items = collectPersistentItems().filter((item) => isSupportedItem(item) && itemHasModuleData(item));

    for (const item of items) {
      const enchantments = await resolveEntrySources(getEnchantments(item));
      const gems = await resolveEntrySources(getGems(item));
      const validation = validateItemSlots(item, { enchantments, gems });
      const summary = getSlotSummary(item, { enchantments, gems });
      rows.push({
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        owner: item.actor?.name ?? game.i18n.localize("EGS.GMManager.WorldItem"),
        type: item.type,
        subType: item.system?.subType ?? "",
        enchantmentCount: enchantments.length,
        gemCount: gems.length,
        enchantmentSlots: `${summary.enchantment.used}/${summary.enchantment.max}`,
        gemSlots: `${summary.gem.used}/${summary.gem.max}`,
        invalid: !validation.valid,
        issueCount: validation.errors.length + validation.warnings.length,
        issues: [...validation.errors, ...validation.warnings],
      });
    }

    rows.sort((a, b) => a.owner.localeCompare(b.owner) || a.name.localeCompare(b.name));
    return {
      rows,
      totalItems: rows.length,
      invalidItems: rows.filter((row) => row.invalid).length,
      version: game.modules.get(MODULE_ID)?.version ?? "",
      schemaVersion: game.settings.get(MODULE_ID, "schemaVersion"),
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.on("click", "[data-action='open-item']", async (event) => {
      event.preventDefault();
      const item = await fromUuid(event.currentTarget.dataset.uuid);
      if (!item) return ui.notifications.warn(game.i18n.localize("EGS.Warning.SourceMissing"));
      item.sheet?.render(true);
    });

    html.on("click", "[data-action='recalculate-item']", async (event) => {
      event.preventDefault();
      const item = await fromUuid(event.currentTarget.dataset.uuid);
      if (!item) return;
      await syncItemEffects(item, { render: false });
      ui.notifications.info(game.i18n.format("EGS.Notification.Recalculated", { name: item.name }));
      this.render(false);
    });

    html.on("click", "[data-action='recalculate-all']", async (event) => {
      event.preventDefault();
      await this._recalculateAll();
    });

    html.on("click", "[data-action='clean-broken']", async (event) => {
      event.preventDefault();
      await this._cleanBrokenReferences();
    });

    html.on("click", "[data-action='enable-all']", async (event) => {
      event.preventDefault();
      await this._setAllEnabled(true);
    });

    html.on("click", "[data-action='disable-all']", async (event) => {
      event.preventDefault();
      await this._setAllEnabled(false);
    });

    html.on("click", "[data-action='export']", (event) => {
      event.preventDefault();
      this._exportData();
    });

    html.on("click", "[data-action='import']", (event) => {
      event.preventDefault();
      html.find("input[type='file'][data-import-file]").trigger("click");
    });

    html.on("change", "input[type='file'][data-import-file]", async (event) => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      await this._importData(file);
      event.currentTarget.value = "";
    });
  }

  async _updateObject(_event, _formData) {}

  get managedItems() {
    return collectPersistentItems().filter((item) => isSupportedItem(item) && itemHasModuleData(item));
  }

  async _recalculateAll() {
    let count = 0;
    for (const item of this.managedItems) {
      await syncItemEffects(item, { render: false });
      count += 1;
    }
    ui.notifications.info(game.i18n.format("EGS.Notification.RecalculatedAll", { count }));
    this.render(false);
  }

  async _cleanBrokenReferences() {
    let cleaned = 0;
    for (const item of this.managedItems) {
      const flags = cloneModuleFlags(item);
      let changed = false;
      for (const key of ["enchantments", "gems"]) {
        if (!Array.isArray(flags[key])) continue;
        for (const entry of flags[key]) {
          if (!entry.sourceUuid) continue;
          const source = await fromUuid(entry.sourceUuid).catch(() => null);
          if (!source) {
            entry.sourceUuid = "";
            cleaned += 1;
            changed = true;
          }
        }
      }
      if (changed) await updateItemModuleFlags(item, flags, { render: false });
    }
    ui.notifications.info(game.i18n.format("EGS.Notification.CleanedReferences", { count: cleaned }));
    this.render(false);
  }

  async _setAllEnabled(enabled) {
    let count = 0;
    for (const item of this.managedItems) {
      const flags = cloneModuleFlags(item);
      let changed = false;
      for (const key of ["enchantments", "gems"]) {
        if (!Array.isArray(flags[key])) continue;
        for (const entry of flags[key]) {
          if (entry.enabled === enabled) continue;
          entry.enabled = enabled;
          changed = true;
          count += 1;
        }
      }
      if (changed) {
        await updateItemModuleFlags(item, flags, { render: false });
        await syncItemEffects(item, { render: false });
      }
    }
    ui.notifications.info(game.i18n.format(
      enabled ? "EGS.Notification.EnabledEntries" : "EGS.Notification.DisabledEntries",
      { count },
    ));
    this.render(false);
  }

  _exportData() {
    const settings = {};
    for (const key of settingKeysForExport()) settings[key] = game.settings.get(MODULE_ID, key);
    const items = this.managedItems.map((item) => ({
      uuid: item.uuid,
      name: item.name,
      flags: cloneModuleFlags(item),
    }));
    saveJson({
      module: MODULE_ID,
      moduleVersion: game.modules.get(MODULE_ID)?.version ?? "",
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      settings,
      items,
    }, `${MODULE_ID}-export.json`);
  }

  async _importData(file) {
    let data;
    try {
      data = JSON.parse(await readFileText(file));
    } catch (error) {
      return ui.notifications.error(game.i18n.format("EGS.Error.InvalidImport", { error: error.message }));
    }
    if (data.module !== MODULE_ID || !Array.isArray(data.items)) {
      return ui.notifications.error(game.i18n.localize("EGS.Error.IncompatibleImport"));
    }

    if (data.settings && typeof data.settings === "object") {
      const validKeys = new Set(settingKeysForExport());
      for (const [key, value] of Object.entries(data.settings)) {
        if (validKeys.has(key)) await game.settings.set(MODULE_ID, key, value);
      }
    }

    let imported = 0;
    let missing = 0;
    for (const itemData of data.items) {
      const item = await fromUuid(itemData.uuid).catch(() => null);
      if (!item || item.documentName !== "Item") {
        missing += 1;
        continue;
      }
      const rawFlags = itemData.flags ?? {};
      const normalizedFlags = {
        settings: normalizeItemSettings(rawFlags.settings ?? {}, item),
        enchantments: Array.isArray(rawFlags.enchantments)
          ? rawFlags.enchantments.map((entry) => normalizeEntry(entry, "enchantment"))
          : [],
        gems: Array.isArray(rawFlags.gems)
          ? rawFlags.gems.map((entry) => normalizeEntry(entry, "gem"))
          : [],
      };
      await updateItemModuleFlags(item, normalizedFlags, { render: false });
      await syncItemEffects(item, { render: false });
      imported += 1;
    }
    ui.notifications.info(game.i18n.format("EGS.Notification.Imported", { imported, missing }));
    this.render(false);
  }
}
