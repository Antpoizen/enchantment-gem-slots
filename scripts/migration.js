import { CURRENT_SCHEMA_VERSION, MODULE_ID } from "./constants.js";
import {
  cloneModuleFlags,
  collectPersistentItems,
  itemHasModuleData,
  normalizeEntry,
  normalizeItemSettings,
  updateItemModuleFlags,
} from "./data.js";
import { syncItemEffects } from "./effects.js";

export async function migrateWorldData() {
  if (!game.user.isGM) return;
  const current = Number(game.settings.get(MODULE_ID, "schemaVersion") || 0);
  if (current >= CURRENT_SCHEMA_VERSION) return;

  let migrated = 0;
  for (const item of collectPersistentItems()) {
    if (!itemHasModuleData(item)) continue;
    const flags = cloneModuleFlags(item);
    const normalized = {
      settings: normalizeItemSettings(flags.settings ?? {}, item),
      enchantments: Array.isArray(flags.enchantments)
        ? flags.enchantments.map((entry) => normalizeEntry(entry, "enchantment"))
        : [],
      gems: Array.isArray(flags.gems)
        ? flags.gems.map((entry) => normalizeEntry(entry, "gem"))
        : [],
    };

    if (JSON.stringify(flags) !== JSON.stringify(normalized)) {
      await updateItemModuleFlags(item, normalized, { render: false });
      migrated += 1;
    }
    await syncItemEffects(item, { render: false });
  }

  await game.settings.set(MODULE_ID, "schemaVersion", CURRENT_SCHEMA_VERSION);
  if (migrated > 0) {
    ui.notifications.info(game.i18n.format("EGS.Notification.Migrated", { count: migrated }));
  }
}
