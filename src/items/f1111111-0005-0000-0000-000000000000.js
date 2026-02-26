let api = null;
let cachedSearchItemId = null;

const MODAL_FRAME_ID = 'b0b0b0b0-0002-0000-0000-000000000000';
const MODAL_FRAME_VIEW_ID = 'b0b0b0b0-0001-0000-0000-000000000000';
const ITEM_SEARCH_TYPE_ID = '7ac3cf17-2c10-454a-bc06-24db64e440c4';

export async function onKernelBootComplete({ safeMode }, _api) {
  if (safeMode) return;
  api = _api;
}

// [BEGIN:show]
export async function show(_api) {
  // Lazy init: use passed api if module was reloaded after import
  if (_api && !api) {
    api = _api;
  }

  if (!api) {
    console.warn('item-palette: not initialized (no api available)');
    return;
  }

  // Remove existing modal if present
  hide();

  // Find the Item Search item (cache ID to avoid full scan on repeat opens)
  if (!cachedSearchItemId) {
    const searchItems = await api.query({ type: ITEM_SEARCH_TYPE_ID });
    if (searchItems.length === 0) {
      console.warn('item-palette: no item-search item found');
      return;
    }
    cachedSearchItemId = searchItems[0].id;
  }

  // Fetch search item and frame in parallel
  const [searchItem, frame] = await Promise.all([
    api.get(cachedSearchItemId),
    api.get(MODAL_FRAME_ID)
  ]);

  // Pre-fetch starred items so the first render has data immediately
  const searchLib = await api.require('item-search-lib');
  const starred = await searchLib.getStarredItems(api);
  const starredAtts = starred.map(s => ({ id: s.id }));

  // Reset search state with starred items pre-populated
  searchItem.content = { ...searchItem.content, currentQuery: '' };
  searchItem.attachments = starredAtts;
  searchItem.modified = Date.now();
  frame.attachments = [{ id: searchItem.id }];
  frame.modified = Date.now();

  // Save both in parallel
  await Promise.all([api.set(searchItem), api.set(frame)]);

  // Render the frame with modal-frame-view and append directly to body
  const overlayNode = await api.renderItem(MODAL_FRAME_ID, MODAL_FRAME_VIEW_ID);
  overlayNode.id = 'item-palette-overlay';
  document.body.appendChild(overlayNode);
}
// [END:show]

export function hide() {
  const existing = document.getElementById('item-palette-overlay');
  if (existing) {
    // Clean up any registered handlers (e.g. document event listeners) before removing
    const cleanables = existing.querySelectorAll('[data-hobson-cleanup]');
    for (const el of cleanables) {
      if (typeof el.__hobsonCleanup === 'function') {
        try { el.__hobsonCleanup(); } catch (e) { /* ignore */ }
      }
    }
    if (typeof existing.__hobsonCleanup === 'function') {
      try { existing.__hobsonCleanup(); } catch (e) { /* ignore */ }
    }
    existing.remove();
  }
}
