// Selection Manager Library
// Handles item selection state via events, replacing kernel viewport selection

const SELECTION_CHANGED = "e0e00000-0003-0001-0000-000000000000";

// State lives on globalThis so it survives moduleSystem.clearCache()
const CACHE_KEY = '__selectionManager__';
if (!globalThis[CACHE_KEY]) {
  globalThis[CACHE_KEY] = {
    selectedItemId: null,
    selectedParentId: null,
    api: null,
  };
}
const S = globalThis[CACHE_KEY];

// Called at boot
export async function onSystemBootComplete({ safeMode }, _api) {
  if (safeMode) return;  // No selection in safe mode

  S.api = _api;

  // Emit initial selection state
  S.api.events.emit({
    type: SELECTION_CHANGED,
    content: {
      current: { itemId: null, parentId: null },
      previous: null
    }
  });
}

// Public API - called by views or other code
export function select(itemId, parentId = null) {
  const previous = { itemId: S.selectedItemId, parentId: S.selectedParentId };
  S.selectedItemId = itemId;
  S.selectedParentId = parentId;

  if (S.api) {
    S.api.events.emit({
      type: SELECTION_CHANGED,
      content: {
        current: { itemId: S.selectedItemId, parentId: S.selectedParentId },
        previous
      }
    });
  }
}

export function clearSelection() {
  select(null, null);
}

export function getSelection() {
  return S.selectedItemId;
}

export function getSelectionParent() {
  return S.selectedParentId;
}
