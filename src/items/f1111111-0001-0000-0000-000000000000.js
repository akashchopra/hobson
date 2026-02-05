// Selection Manager Library
// Handles item selection state via events, replacing kernel viewport selection

let selectedItemId = null;
let selectedParentId = null;
let api = null;

// Called at boot
export async function onSystemBootComplete({ safeMode }, _api) {
  if (safeMode) return;  // No selection in safe mode

  api = _api;

  // Emit initial selection state
  api.events.emit({
    type: api.EVENT_IDS.VIEWPORT_SELECTION_CHANGED,
    content: {
      current: { itemId: null, parentId: null },
      previous: null
    }
  });
}

// Public API - called by views or other code
export function select(itemId, parentId = null) {
  const previous = { itemId: selectedItemId, parentId: selectedParentId };
  selectedItemId = itemId;
  selectedParentId = parentId;

  if (api) {
    api.events.emit({
      type: api.EVENT_IDS.VIEWPORT_SELECTION_CHANGED,
      content: {
        current: { itemId: selectedItemId, parentId: selectedParentId },
        previous
      }
    });
  }
}

export function clearSelection() {
  select(null, null);
}

export function getSelection() {
  return selectedItemId;
}

export function getSelectionParent() {
  return selectedParentId;
}
