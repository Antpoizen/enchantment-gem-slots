# PF1e Enchantment and Gem Slots

A Foundry Virtual Tabletop module that adds configurable enchantment slots and gem sockets to Pathfinder 1e equipment.


## Version 1.0.4

This release fixes PF1e item-sheet layout conflicts by making the Enchantments & Gems tab its own scroll container and allowing every panel to use its natural content height. No manual bottom padding is required.

- Corrected the Enchantments & Gems configuration layout on PF1e 11.11 item sheets.
- Replaced label-based grid wrappers that PF1e compressed with dedicated field containers.
- Added explicit minimum sizes and pointer interaction rules for number fields, checkboxes, buttons, text fields, selects, and textareas.
- Added a single-column layout for very narrow item-sheet windows.

## Target Versions

- Foundry Virtual Tabletop **12, Build 331**
- Pathfinder 1e system **11.11**

The manifest intentionally limits compatibility to Foundry generation 12 and PF1e 11.11. The module does not modify PF1e core files.

## Supported Items

The interface is enabled by default for:

- `weapon` items
- `equipment` items

PF1e 11.11 represents armor, shields, wondrous items, rings, and most other worn gear as `equipment` items with different subtypes or equipment slots. A world setting can enable other PF1e physical item types.

## Installation

1. Extract the `enchantment-gem-slots` folder into:
   ```text
   <Foundry user data>/Data/modules/
   ```
2. Restart Foundry VTT.
3. Open the PF1e world.
4. Enable **PF1e Enchantment and Gem Slots** in Manage Modules.
5. Reload the world when prompted.

## Item Sheet Usage

Supported item sheets receive an **Enchantments & Gems** tab.

Each item can configure:

- Base and bonus enchantment slots
- Maximum enchantment rank
- Base and bonus gem slots
- Per-item enable switches for enchantments and gems

The tab displays used, maximum, and remaining slots. Disabled entries remain installed and continue to occupy slots, but their mechanical changes are not applied.

A maximum enchantment rank of `0` means that the item has no rank limit.

## Adding Entries

Use **Add Enchantment** or **Socket Gem**, or drag an Item document from an Actor, the Items directory, or a Compendium onto the matching drop zone.

A dropped Item is referenced by UUID. The source is not duplicated. The dialog copies its name, icon, description, and UUID, and allows all values to be adjusted before saving.

Each entry supports:

- Name and description
- Rank or tier
- Slot cost
- GP cost
- Enabled state
- Icon
- Source Item UUID
- One or more PF1e mechanical changes

## Mechanical Changes

Mechanical changes are stored in module flags and synchronized into the item's native `system.changes` array. Module-owned PF1e changes use a flavor marker beginning with `[EGS:`. Synchronization always removes and rebuilds only module-owned changes, preserving changes created directly through PF1e.

Each change supports:

- PF1e target, such as `ac`, `mhp`, `str`, or another target available in PF1e 11.11
- Formula
- `add` or `set` operator
- Bonus type
- Priority
- Application condition
- Optional damage-type note

PF1e's own active-item rules remain authoritative. For physical items, native changes normally apply only while the item is active, which includes its equipped state, quantity, container state, and item hit points. The module's carried and identified conditions add extra gates; they do not bypass PF1e's active-item requirement.

The optional damage-type field is stored for macros and future integration but is not interpreted by PF1e's ItemChange engine.

## Permissions

Players must own an Item to modify its slots. World settings independently control whether owners can:

- Install, edit, enable, or disable entries
- Remove entries

Gamemasters can override slot limits. Rank overrides can be separately enabled or disabled.

## Identification

Players cannot see enchantment or gem details on an unidentified physical item. The item sheet and chat card show only an unidentified-item notice until the item is identified. Gamemasters retain full visibility.

## Module Settings

World settings include:

- Enable enchantments or gems
- Enable other physical item types
- Default slots for weapons, armor, shields, wondrous equipment, other equipment, and optional physical items
- Enforce maximum enchantment rank
- Make rank 0 enchantments cost zero slots
- Permit player over-slotting
- Permit GM rank overrides
- Player installation and removal permissions
- Native PF1e mechanical changes
- Validation warnings
- Chat-card button
- Debug logging

## Gamemaster Manager

Open **Game Settings → Configure Settings → Module Settings → Enchantment & Gem Slot Manager**.

The manager can:

- Review all persistent world and Actor items containing module data
- Display invalid and over-slotted items
- Recalculate PF1e changes
- Clear broken source UUIDs
- Enable or disable all entries
- Export settings and item data to JSON
- Import compatible JSON exports

Import uses item UUIDs. Items that no longer exist are reported and skipped.

## Public API

```javascript
const egs = game.modules.get("enchantment-gem-slots").api;
```

Available methods:

```javascript
getEnchantments(item)
getGems(item)
getItemSettings(item)
getSlotSummary(item)
validateItemSlots(item)
setItemSettings(item, updateData)
addEnchantment(item, enchantmentData)
updateEnchantment(item, enchantmentId, updateData)
removeEnchantment(item, enchantmentId)
addGem(item, gemData)
updateGem(item, gemId, updateData)
removeGem(item, gemId)
recalculateItem(item)
syncItemEffects(item)
```

### Example: Add an Enchantment

```javascript
const item = actor.items.getName("Longsword");
const egs = game.modules.get("enchantment-gem-slots").api;

await egs.addEnchantment(item, {
  name: "Ward of Protection",
  description: "A defensive enchantment reinforces its bearer.",
  rank: 2,
  slotCost: 1,
  gpCost: 8000,
  enabled: true,
  changes: [
    {
      target: "ac",
      formula: "1",
      operator: "add",
      type: "deflection",
      priority: 0,
      condition: "equipped"
    }
  ]
});
```

The example uses PF1e's native `ac` change target. For other statistics, select a target exposed by PF1e 11.11's change-target picker.

### Example: Add a Gem

```javascript
const item = actor.items.getName("Mithral Breastplate");
const egs = game.modules.get("enchantment-gem-slots").api;

await egs.addGem(item, {
  name: "Moonstone",
  gemType: "Defensive",
  rank: 1,
  slotCost: 1,
  description: "+1 armor class while the armor is active.",
  changes: [
    {
      target: "ac",
      formula: "1",
      operator: "add",
      type: "natural",
      condition: "equipped"
    }
  ]
});
```

### Example: Validate the Selected Item

```javascript
const item = canvas.tokens.controlled[0]?.actor?.items.getName("Longsword");
if (!item) return ui.notifications.warn("Select a token with the item.");

const result = game.modules
  .get("enchantment-gem-slots")
  .api
  .validateItemSlots(item);

console.log(result);
ui.notifications.info(result.valid ? "Slots are valid." : "The item has slot errors.");
```

## Integration Hooks

The module fires:

```text
enchantment-gem-slots.enchantmentAdded
enchantment-gem-slots.enchantmentUpdated
enchantment-gem-slots.enchantmentRemoved
enchantment-gem-slots.gemAdded
enchantment-gem-slots.gemUpdated
enchantment-gem-slots.gemRemoved
enchantment-gem-slots.itemRecalculated
```

Example:

```javascript
Hooks.on("enchantment-gem-slots.gemAdded", (item, gem) => {
  console.log(`${gem.name} was socketed into ${item.name}`);
});
```

## Stored Data

Module data is stored under:

```text
flags.enchantment-gem-slots.settings
flags.enchantment-gem-slots.enchantments
flags.enchantment-gem-slots.gems
```

No PF1e source files are changed.

## Migration

The module maintains a hidden world schema version. On the first GM login after an update, persistent world Items and Actor-owned Items containing module flags are normalized and their native PF1e changes are synchronized.

## Testing Checklist

Before using the module in a production world, test it in a copy of the world:

- Enable the module on Foundry 12.331 with PF1e 11.11
- Open weapon and equipment sheets
- Confirm the new tab switches correctly from every PF1e sheet tab
- Add, edit, toggle, and remove enchantments and gems
- Test rank 0 slot behavior
- Test maximum-rank rejection and GM override
- Test normal slot rejection, GM over-slotting, and player over-slotting setting
- Drag Items from the world directory, an Actor, and a Compendium
- Delete a referenced Item and confirm the missing-source warning
- Equip and unequip an Actor-owned item and verify native changes
- Move an item into and out of a container
- Reduce item quantity to zero and verify PF1e deactivates its changes
- Test an unidentified item as a player
- Post identified and unidentified summaries to chat
- Test player installation and removal permissions
- Test a linked token Actor and a synthetic unlinked token Actor
- Export JSON, change data, then import the export
- Run the GM manager's recalculate and broken-reference tools
- Reload the world and verify no duplicate PF1e changes appear

## Known Limitations

- This package has been statically validated in the generated source environment, but it has not been executed inside a licensed Foundry VTT 12.331 runtime here. Test it in a backup world before production use.
- PF1e 11.11's native ItemChange engine controls when physical-item changes apply. The module does not create hidden buff items to bypass those rules.
- The damage-type field is metadata only.
- Source Item references are informational. Updating the source Item does not automatically overwrite the installed entry.
- Synthetic token data is supported through normal Item document updates, but the GM manager only scans persistent world Items and persistent Actor-owned Items.
- PF1e change targets are system-defined strings. Invalid targets are preserved and warned about rather than guessed or automatically rewritten.
- Foundry document flags are part of the Item data delivered to clients with document access. The module hides unidentified details in its UI and chat cards, but cannot prevent a technically sophisticated owner from inspecting raw browser-side document data.
