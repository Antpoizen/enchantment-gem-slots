import { api } from "./api.js";
import { MODULE_ID, MODULE_TITLE } from "./constants.js";
import { debug, isSupportedItem, itemHasModuleData } from "./data.js";
import { syncAllEffects, syncItemEffects } from "./effects.js";
import { renderItemSheet } from "./item-sheet.js";
import { migrateWorldData } from "./migration.js";
import { registerSettings } from "./settings.js";

const TEMPLATE_PATHS = [
  `modules/${MODULE_ID}/templates/item-slots.hbs`,
  `modules/${MODULE_ID}/templates/entry-dialog.hbs`,
  `modules/${MODULE_ID}/templates/gm-manager.hbs`,
  `modules/${MODULE_ID}/templates/chat-card.hbs`,
];

function updateTouchesEffects(changes) {
  if (changes.flags?.[MODULE_ID]) return true;
  const system = changes.system ?? {};
  return system.equipped !== undefined
    || system.carried !== undefined
    || system.identified !== undefined
    || system.quantity !== undefined
    || system.hp !== undefined;
}

Hooks.once("init", async () => {
  if (game.system.id !== "pf1") {
    console.error(`${MODULE_TITLE} requires the pf1 system.`);
    return;
  }

  registerSettings();
  await loadTemplates(TEMPLATE_PATHS);

  const module = game.modules.get(MODULE_ID);
  module.api = api;

  // PF1e 11.11 still renders its main Item sheet through the legacy ItemSheet
  // render hook, so the module injects a tab without replacing the system sheet.
  Hooks.on("renderItemSheet", renderItemSheet);
  Hooks.on("createItem", async (item, options, userId) => {
    if (userId !== game.user.id) return;
    if (!isSupportedItem(item) || !itemHasModuleData(item)) return;
    try {
      await syncItemEffects(item, { render: false });
    } catch (error) {
      Hooks.onError(`${MODULE_ID}.createItem`, error, {
        msg: `Failed to synchronize effects after creating ${item.uuid}`,
        log: "error",
        data: { item, options },
      });
    }
  });

  Hooks.on("updateItem", async (item, changes, options, userId) => {
    if (options.enchantmentGemSlotsSync) return;
    if (userId !== game.user.id) return;
    if (!isSupportedItem(item) || !updateTouchesEffects(changes)) return;
    try {
      await syncItemEffects(item, { render: false });
    } catch (error) {
      Hooks.onError(`${MODULE_ID}.updateItem`, error, {
        msg: `Failed to synchronize effects after updating ${item.uuid}`,
        log: "error",
        data: { item, changes },
      });
    }
  });

  Hooks.on(`${MODULE_ID}.settingsChanged`, async () => {
    if (game.user.isGM) await syncAllEffects();
    for (const app of Object.values(ui.windows)) {
      if (app.document?.documentName === "Item") app.render(false);
    }
  });

  debug("Initialized");
});

Hooks.once("ready", async () => {
  const foundryVersion = game.version ?? game.release?.version;
  const pf1Version = game.system.version;
  if (foundryVersion !== "12.331") {
    console.warn(`${MODULE_TITLE} was built for Foundry VTT 12.331; running ${foundryVersion}.`);
  }
  if (pf1Version !== "11.11") {
    console.warn(`${MODULE_TITLE} was built for PF1e 11.11; running ${pf1Version}.`);
  }

  if (game.user.isGM) {
    await migrateWorldData();
    await syncAllEffects();
  }
  debug("Ready", { foundryVersion, pf1Version });
});
