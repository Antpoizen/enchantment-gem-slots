import { api } from "./api.js";
import { ENTRY_KINDS, MODULE_ID } from "./constants.js";
import {
  getEffectiveSlotCost,
  getEnchantments,
  getGems,
  getItemSettings,
  getSlotSummary,
  isSupportedItem,
  resolveEntrySources,
  validateItemSlots,
} from "./data.js";
import { openEntryDialog } from "./dialogs.js";

function canInstall(item) {
  return game.user.isGM || (item.isOwner && game.settings.get(MODULE_ID, "playerInstall"));
}

function canRemove(item) {
  return game.user.isGM || (item.isOwner && game.settings.get(MODULE_ID, "playerRemove"));
}

async function prepareEntry(item, entry, kind, settings) {
  const descriptionHTML = await TextEditor.enrichHTML(entry.description || "", {
    secrets: game.user.isGM || item.isOwner,
    relativeTo: item,
    rollData: item.getRollData?.() ?? {},
  });
  return {
    ...entry,
    descriptionHTML,
    effectiveSlotCost: getEffectiveSlotCost(entry, kind),
    rankInvalid: kind === ENTRY_KINDS.enchantment
      && game.settings.get(MODULE_ID, "enforceMaximumRank")
      && settings.maxEnchantRank > 0
      && entry.rank > settings.maxEnchantRank,
    disabledClass: entry.enabled ? "" : "egs-disabled",
  };
}

async function buildSheetContext(item, app) {
  const settings = getItemSettings(item);
  const canSeeDetails = game.user.isGM || item.system?.identified !== false;
  const resolvedEnchantments = await resolveEntrySources(getEnchantments(item));
  const resolvedGems = await resolveEntrySources(getGems(item));
  const summary = getSlotSummary(item, {
    settings,
    enchantments: resolvedEnchantments,
    gems: resolvedGems,
  });
  const validation = validateItemSlots(item, {
    settings,
    enchantments: resolvedEnchantments,
    gems: resolvedGems,
  });
  const enchantments = canSeeDetails
    ? await Promise.all(resolvedEnchantments.map((entry) => prepareEntry(item, entry, ENTRY_KINDS.enchantment, settings)))
    : [];
  const gems = canSeeDetails
    ? await Promise.all(resolvedGems.map((entry) => prepareEntry(item, entry, ENTRY_KINDS.gem, settings)))
    : [];

  return {
    item,
    settings,
    enchantments,
    gems,
    summary,
    validation,
    canSeeDetails,
    editable: Boolean(canSeeDetails && app.isEditable && item.isOwner),
    canInstall: Boolean(canSeeDetails && app.isEditable && canInstall(item)),
    canRemove: Boolean(canSeeDetails && app.isEditable && canRemove(item)),
    enableEnchantments: game.settings.get(MODULE_ID, "enableEnchantments") && settings.enchantmentsEnabled,
    enableGems: game.settings.get(MODULE_ID, "enableGems") && settings.gemsEnabled,
    showWarnings: canSeeDetails && game.settings.get(MODULE_ID, "showValidationWarnings"),
    showChatButton: game.settings.get(MODULE_ID, "showChatButton"),
    effectsEnabled: game.settings.get(MODULE_ID, "enableMechanicalEffects"),
  };
}

function notifyError(error) {
  console.error(`${MODULE_ID} |`, error);
  ui.notifications.error(error.message ?? String(error));
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[character]);
}

async function confirmRemoval(entry) {
  const name = escapeHTML(entry.name);
  return Dialog.confirm({
    title: game.i18n.localize("EGS.Dialog.RemoveTitle"),
    content: `<p>${game.i18n.format("EGS.Dialog.RemoveConfirm", { name })}</p>`,
    yes: () => true,
    no: () => false,
    defaultYes: false,
  });
}

function getEntry(item, kind, id) {
  const entries = kind === ENTRY_KINDS.gem ? getGems(item) : getEnchantments(item);
  return entries.find((entry) => entry.id === id);
}

async function handleEntryAction(item, action, kind, id) {
  const isGem = kind === ENTRY_KINDS.gem;
  const entry = id ? getEntry(item, kind, id) : null;

  if (action === "add") {
    const data = await openEntryDialog({ item, kind });
    if (!data) return;
    if (isGem) await api.addGem(item, data);
    else await api.addEnchantment(item, data);
    return;
  }

  if (!entry) throw new Error(game.i18n.localize("EGS.Error.EntryNotFound"));

  if (action === "edit") {
    const data = await openEntryDialog({ item, kind, entry });
    if (!data) return;
    if (isGem) await api.updateGem(item, id, data);
    else await api.updateEnchantment(item, id, data);
    return;
  }

  if (action === "toggle") {
    const data = { enabled: !entry.enabled };
    if (isGem) await api.updateGem(item, id, data);
    else await api.updateEnchantment(item, id, data);
    return;
  }

  if (action === "remove") {
    if (!(await confirmRemoval(entry))) return;
    if (isGem) await api.removeGem(item, id);
    else await api.removeEnchantment(item, id);
  }
}

async function getDroppedItem(event) {
  let data;
  try {
    data = TextEditor.getDragEventData(event);
  } catch (_error) {
    const raw = event.dataTransfer?.getData("text/plain");
    if (raw) data = JSON.parse(raw);
  }
  if (!data) return null;

  let document = null;
  if (data.uuid) document = await fromUuid(data.uuid);
  else if (data.type === "Item" && data.id) document = game.items.get(data.id);
  return document?.documentName === "Item" ? document : null;
}

async function handleDrop(item, event, kind) {
  event.preventDefault();
  event.stopPropagation();
  const sourceItem = await getDroppedItem(event);
  if (!sourceItem) {
    ui.notifications.warn(game.i18n.localize("EGS.Warning.DropItemOnly"));
    return;
  }
  const data = await openEntryDialog({ item, kind, sourceItem });
  if (!data) return;
  if (kind === ENTRY_KINDS.gem) await api.addGem(item, data);
  else await api.addEnchantment(item, data);
}

async function openUuid(uuid) {
  const document = await fromUuid(uuid);
  if (!document) {
    ui.notifications.warn(game.i18n.localize("EGS.Warning.SourceMissing"));
    return;
  }
  document.sheet?.render(true);
}

export async function postItemSlotsToChat(item) {
  const settings = getItemSettings(item);
  const canSeeDetails = game.user.isGM || item.system?.identified !== false;
  let enchantments = await resolveEntrySources(getEnchantments(item));
  let gems = await resolveEntrySources(getGems(item));
  const summary = getSlotSummary(item, { settings, enchantments, gems });
  const validation = validateItemSlots(item, { settings, enchantments, gems });

  if (canSeeDetails) {
    enchantments = await Promise.all(enchantments.map((entry) => prepareEntry(item, entry, ENTRY_KINDS.enchantment, settings)));
    gems = await Promise.all(gems.map((entry) => prepareEntry(item, entry, ENTRY_KINDS.gem, settings)));
  } else {
    enchantments = [];
    gems = [];
  }

  const content = await renderTemplate(`modules/${MODULE_ID}/templates/chat-card.hbs`, {
    item,
    canSeeDetails,
    enchantments,
    gems,
    summary,
    validation,
    showWarnings: canSeeDetails && game.settings.get(MODULE_ID, "showValidationWarnings"),
  });

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    content,
    flags: {
      [MODULE_ID]: { itemUuid: item.uuid },
    },
  });
}

function activateCustomTab(app, html, navLink, tabContent) {
  app._egsActive = true;
  const nav = html.find("nav.tabs[data-group='primary']").first();
  const body = html.find("section.primary-body").first();
  nav.find("[data-tab]").removeClass("active");
  body.children(".tab[data-group='primary']").removeClass("active");
  navLink.addClass("active");
  tabContent.addClass("active");
}

function installTabNavigation(app, html, navLink, tabContent) {
  navLink.on("click.egs", (event) => {
    event.preventDefault();
    event.stopPropagation();
    activateCustomTab(app, html, navLink, tabContent);
  });

  html.find("nav.tabs[data-group='primary'] [data-tab]").not(navLink).on("click.egs", () => {
    app._egsActive = false;
    tabContent.removeClass("active");
    navLink.removeClass("active");
  });

  if (app._egsActive) activateCustomTab(app, html, navLink, tabContent);
}

function installListeners(app, html, tabContent) {
  const item = app.item ?? app.document;

  tabContent.on("change", "[data-setting-field]", async (event) => {
    const input = event.currentTarget;
    const field = input.dataset.settingField;
    const value = input.type === "checkbox" ? input.checked : Number(input.value);
    try {
      await api.setItemSettings(item, { [field]: value });
    } catch (error) {
      notifyError(error);
    }
  });

  tabContent.on("click", "[data-entry-action]", async (event) => {
    event.preventDefault();
    const button = event.currentTarget;
    try {
      await handleEntryAction(
        item,
        button.dataset.entryAction,
        button.dataset.kind,
        button.dataset.entryId,
      );
    } catch (error) {
      notifyError(error);
    }
  });

  tabContent.on("click", "[data-action='post-chat']", async (event) => {
    event.preventDefault();
    try {
      await postItemSlotsToChat(item);
    } catch (error) {
      notifyError(error);
    }
  });

  tabContent.on("click", "[data-action='open-source']", async (event) => {
    event.preventDefault();
    try {
      await openUuid(event.currentTarget.dataset.uuid);
    } catch (error) {
      notifyError(error);
    }
  });

  tabContent.find(".egs-drop-zone").on("dragover", (event) => {
    event.preventDefault();
    event.currentTarget.classList.add("egs-drag-over");
  });
  tabContent.find(".egs-drop-zone").on("dragleave", (event) => {
    event.currentTarget.classList.remove("egs-drag-over");
  });
  tabContent.find(".egs-drop-zone").on("drop", async (event) => {
    event.currentTarget.classList.remove("egs-drag-over");
    try {
      await handleDrop(item, event.originalEvent ?? event, event.currentTarget.dataset.kind);
    } catch (error) {
      notifyError(error);
    }
  });
}

export async function renderItemSheet(app, html) {
  if (game.system.id !== "pf1") return;
  const item = app.item ?? app.document;
  if (!isSupportedItem(item)) return;
  if (!html?.find) return;

  const nav = html.find("nav.tabs[data-group='primary']").first();
  const body = html.find("section.primary-body").first();
  if (!nav.length || !body.length) return;
  if (nav.find("[data-tab='egs-slots']").length || app._egsRendering) return;

  app._egsRendering = true;
  try {
    const context = await buildSheetContext(item, app);
    const contentHTML = await renderTemplate(`modules/${MODULE_ID}/templates/item-slots.hbs`, context);
    // Foundry does not await render hooks. Re-check after asynchronous context/template work
    // so rapid sheet re-renders cannot insert the tab more than once.
    if (nav.find("[data-tab='egs-slots']").length) return;

    const navLink = $(
      `<a class="item" data-tab="egs-slots" data-group="primary" data-tooltip="EGS.Tab.Tooltip">`
      + `<i class="fas fa-gem"></i> ${game.i18n.localize("EGS.Tab.Label")}</a>`,
    );
    const tabContent = $(contentHTML);
    nav.append(navLink);
    body.append(tabContent);

    installTabNavigation(app, html, navLink, tabContent);
    installListeners(app, html, tabContent);
  } catch (error) {
    Hooks.onError(`${MODULE_ID}.renderItemSheet`, error, {
      msg: `Failed to render slots for ${item.uuid}`,
      log: "error",
      data: { app, item },
    });
  } finally {
    app._egsRendering = false;
  }
}
