import { MODULE_ID } from "./constants.js";
import { GMManager } from "./gm-manager.js";

function registerBoolean(key, name, hint, defaultValue, { restricted = true, onChange } = {}) {
  game.settings.register(MODULE_ID, key, {
    name,
    hint,
    scope: "world",
    config: true,
    restricted,
    type: Boolean,
    default: defaultValue,
    onChange,
  });
}

function registerNumber(key, name, hint, defaultValue = 0) {
  game.settings.register(MODULE_ID, key, {
    name,
    hint,
    scope: "world",
    config: true,
    restricted: true,
    type: Number,
    default: defaultValue,
    range: { min: 0, max: 99, step: 1 },
  });
}

export function registerSettings() {
  const refresh = () => Hooks.callAll(`${MODULE_ID}.settingsChanged`);

  game.settings.registerMenu(MODULE_ID, "gmManager", {
    name: "EGS.Settings.GMManager.Name",
    label: "EGS.Settings.GMManager.Label",
    hint: "EGS.Settings.GMManager.Hint",
    icon: "fas fa-gem",
    type: GMManager,
    restricted: true,
  });

  registerBoolean("enableEnchantments", "EGS.Settings.EnableEnchantments.Name", "EGS.Settings.EnableEnchantments.Hint", true, { onChange: refresh });
  registerBoolean("enableGems", "EGS.Settings.EnableGems.Name", "EGS.Settings.EnableGems.Hint", true, { onChange: refresh });
  registerBoolean("enableOtherPhysicalItems", "EGS.Settings.EnableOtherPhysical.Name", "EGS.Settings.EnableOtherPhysical.Hint", false, { onChange: refresh });
  registerBoolean("enforceMaximumRank", "EGS.Settings.EnforceRank.Name", "EGS.Settings.EnforceRank.Hint", true);
  registerBoolean("rankZeroUsesNoSlots", "EGS.Settings.RankZeroFree.Name", "EGS.Settings.RankZeroFree.Hint", true);
  registerBoolean("allowOverSlotting", "EGS.Settings.AllowOverSlotting.Name", "EGS.Settings.AllowOverSlotting.Hint", false);
  registerBoolean("gmOverrideRank", "EGS.Settings.GMOverrideRank.Name", "EGS.Settings.GMOverrideRank.Hint", true);
  registerBoolean("playerInstall", "EGS.Settings.PlayerInstall.Name", "EGS.Settings.PlayerInstall.Hint", true, { restricted: true });
  registerBoolean("playerRemove", "EGS.Settings.PlayerRemove.Name", "EGS.Settings.PlayerRemove.Hint", true, { restricted: true });
  registerBoolean("enableMechanicalEffects", "EGS.Settings.EnableEffects.Name", "EGS.Settings.EnableEffects.Hint", true, { onChange: refresh });
  registerBoolean("showValidationWarnings", "EGS.Settings.ShowWarnings.Name", "EGS.Settings.ShowWarnings.Hint", true);
  registerBoolean("showChatButton", "EGS.Settings.ShowChat.Name", "EGS.Settings.ShowChat.Hint", true);
  registerBoolean("debugLogging", "EGS.Settings.Debug.Name", "EGS.Settings.Debug.Hint", false);

  registerNumber("defaultEnchantWeapon", "EGS.Settings.DefaultEnchantWeapon.Name", "EGS.Settings.DefaultEnchantWeapon.Hint", 0);
  registerNumber("defaultEnchantArmor", "EGS.Settings.DefaultEnchantArmor.Name", "EGS.Settings.DefaultEnchantArmor.Hint", 0);
  registerNumber("defaultEnchantShield", "EGS.Settings.DefaultEnchantShield.Name", "EGS.Settings.DefaultEnchantShield.Hint", 0);
  registerNumber("defaultEnchantWondrous", "EGS.Settings.DefaultEnchantWondrous.Name", "EGS.Settings.DefaultEnchantWondrous.Hint", 0);
  registerNumber("defaultEnchantOtherEquipment", "EGS.Settings.DefaultEnchantOtherEquipment.Name", "EGS.Settings.DefaultEnchantOtherEquipment.Hint", 0);
  registerNumber("defaultEnchantOtherPhysical", "EGS.Settings.DefaultEnchantOtherPhysical.Name", "EGS.Settings.DefaultEnchantOtherPhysical.Hint", 0);

  registerNumber("defaultGemWeapon", "EGS.Settings.DefaultGemWeapon.Name", "EGS.Settings.DefaultGemWeapon.Hint", 0);
  registerNumber("defaultGemArmor", "EGS.Settings.DefaultGemArmor.Name", "EGS.Settings.DefaultGemArmor.Hint", 0);
  registerNumber("defaultGemShield", "EGS.Settings.DefaultGemShield.Name", "EGS.Settings.DefaultGemShield.Hint", 0);
  registerNumber("defaultGemWondrous", "EGS.Settings.DefaultGemWondrous.Name", "EGS.Settings.DefaultGemWondrous.Hint", 0);
  registerNumber("defaultGemOtherEquipment", "EGS.Settings.DefaultGemOtherEquipment.Name", "EGS.Settings.DefaultGemOtherEquipment.Hint", 0);
  registerNumber("defaultGemOtherPhysical", "EGS.Settings.DefaultGemOtherPhysical.Name", "EGS.Settings.DefaultGemOtherPhysical.Hint", 0);

  game.settings.register(MODULE_ID, "schemaVersion", {
    scope: "world",
    config: false,
    restricted: true,
    type: Number,
    default: 0,
  });
}

export const EXPORTED_SETTING_KEYS = Object.freeze([
  "enableEnchantments",
  "enableGems",
  "enableOtherPhysicalItems",
  "enforceMaximumRank",
  "rankZeroUsesNoSlots",
  "allowOverSlotting",
  "gmOverrideRank",
  "playerInstall",
  "playerRemove",
  "enableMechanicalEffects",
  "showValidationWarnings",
  "showChatButton",
  "debugLogging",
  "defaultEnchantWeapon",
  "defaultEnchantArmor",
  "defaultEnchantShield",
  "defaultEnchantWondrous",
  "defaultEnchantOtherEquipment",
  "defaultEnchantOtherPhysical",
  "defaultGemWeapon",
  "defaultGemArmor",
  "defaultGemShield",
  "defaultGemWondrous",
  "defaultGemOtherEquipment",
  "defaultGemOtherPhysical",
]);
