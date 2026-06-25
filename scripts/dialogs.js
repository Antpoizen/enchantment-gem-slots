import { CHANGE_CONDITIONS, ENTRY_KINDS, MODULE_ID } from "./constants.js";
import { getPF1ChangeChoices, normalizeEntry, normalizeMechanicalChange } from "./data.js";

function localize(key) {
  return game.i18n.localize(key);
}

function renumberChangeRows(html) {
  html.find(".egs-change-row").each((index, element) => {
    element.dataset.index = String(index);
    element.querySelectorAll("[data-field]").forEach((input) => {
      input.name = `changes.${index}.${input.dataset.field}`;
    });
  });
}

function activateChangeControls(html) {
  const addButton = html.find("[data-action='add-change']");
  addButton.on("click", (event) => {
    event.preventDefault();
    const template = html.find("template.egs-change-template")[0];
    const list = html.find(".egs-change-list")[0];
    if (!template || !list) return;
    list.insertAdjacentHTML("beforeend", template.innerHTML);
    renumberChangeRows(html);
  });

  html.on("click", "[data-action='remove-change']", (event) => {
    event.preventDefault();
    event.currentTarget.closest(".egs-change-row")?.remove();
    renumberChangeRows(html);
  });

  html.on("click", "[data-action='pick-image']", (event) => {
    event.preventDefault();
    const input = html.find("input[name='img']")[0];
    if (!input) return;
    const picker = new FilePicker({
      type: "image",
      current: input.value,
      callback: (path) => {
        input.value = path;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
    });
    picker.render(true);
  });
}

function parseEntryForm(html, kind, existing = {}) {
  const form = html.find("form.egs-entry-form")[0];
  const data = new FormData(form);
  const changes = [];

  html.find(".egs-change-row").each((_index, row) => {
    const get = (field) => row.querySelector(`[data-field='${field}']`)?.value ?? "";
    const change = normalizeMechanicalChange({
      id: row.dataset.changeId || undefined,
      nativeId: row.dataset.nativeId || undefined,
      formula: get("formula"),
      operator: get("operator"),
      target: get("target"),
      type: get("type"),
      priority: get("priority"),
      condition: get("condition"),
      damageType: get("damageType"),
    });
    changes.push(change);
  });

  return normalizeEntry({
    ...existing,
    name: data.get("name"),
    description: data.get("description"),
    rank: data.get("rank"),
    tierLabel: data.get("tierLabel"),
    slotCost: data.get("slotCost"),
    gpCost: data.get("gpCost"),
    enabled: data.get("enabled") === "on",
    img: data.get("img"),
    sourceUuid: data.get("sourceUuid"),
    gemType: data.get("gemType"),
    changes,
  }, kind);
}

function validateEntry(entry) {
  if (!entry.name) return localize("EGS.Validation.EmptyName");
  for (const change of entry.changes) {
    if (!change.formula) return localize("EGS.Validation.EmptyFormula");
    try {
      Roll.create(change.formula);
    } catch (error) {
      return game.i18n.format("EGS.Validation.InvalidFormula", {
        formula: change.formula,
        error: error.message,
      });
    }
  }
  return null;
}

export async function openEntryDialog({
  item,
  kind,
  entry = {},
  sourceItem = null,
} = {}) {
  const isGem = kind === ENTRY_KINDS.gem;
  const initial = normalizeEntry({
    ...entry,
    name: entry.name || sourceItem?.name || "",
    description: entry.description || sourceItem?.system?.description?.value || "",
    img: entry.img || sourceItem?.img || "icons/svg/item-bag.svg",
    sourceUuid: entry.sourceUuid || sourceItem?.uuid || "",
    changes: entry.changes ?? [],
  }, kind);

  const { targets, bonusTypes } = getPF1ChangeChoices(item);
  const content = await renderTemplate(`modules/${MODULE_ID}/templates/entry-dialog.hbs`, {
    item,
    entry: initial,
    isGem,
    kind,
    targets,
    bonusTypes,
    conditions: {
      [CHANGE_CONDITIONS.always]: "EGS.Condition.Always",
      [CHANGE_CONDITIONS.equipped]: "EGS.Condition.Equipped",
      [CHANGE_CONDITIONS.carried]: "EGS.Condition.Carried",
      [CHANGE_CONDITIONS.identified]: "EGS.Condition.Identified",
      [CHANGE_CONDITIONS.carriedIdentified]: "EGS.Condition.CarriedIdentified",
    },
    operators: {
      add: "EGS.Operator.Add",
      set: "EGS.Operator.Set",
    },
  });

  const title = game.i18n.format(
    isGem ? "EGS.Dialog.GemTitle" : "EGS.Dialog.EnchantmentTitle",
    { item: item.name },
  );

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    const dialog = new Dialog({
      title,
      content,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: localize("EGS.Action.Save"),
          callback: (html) => {
            const parsed = parseEntryForm(html, kind, initial);
            const error = validateEntry(parsed);
            if (error) {
              ui.notifications.error(error);
              return false;
            }
            finish(parsed);
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: localize("EGS.Action.Cancel"),
          callback: () => finish(null),
        },
      },
      default: "save",
      render: (html) => activateChangeControls(html),
      close: () => finish(null),
    }, {
      classes: ["pf1", "egs-dialog"],
      width: 720,
      resizable: true,
    });
    dialog.render(true);
  });
}
