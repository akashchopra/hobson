// Item Palette Library
// Provides the item search/navigation modal. Moved from kernel to userland.
// See [item-palette documentation](item://f1111111-0005-0000-0000-000000000000)

let api = null;
let searchLib = null;

export async function onKernelBootComplete({ safeMode }, _api) {
  if (safeMode) return;
  api = _api;
  searchLib = await api.require('item-search-lib');
}

// [BEGIN:show]
export async function show(_api) {
  // Lazy init: use passed api if module was reloaded after import
  if (_api && !api) {
    api = _api;
    searchLib = await api.require('item-search-lib');
  }

  if (!api) {
    console.warn('item-palette: not initialized (no api available)');
    return;
  }

  // Remove existing modal if present
  hide();

  const overlay = document.createElement("div");
  overlay.id = "item-list-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    z-index: 10000000;
  `;

  const modal = document.createElement("div");
  modal.style.cssText = `
    background: var(--color-bg-surface);
    border-radius: 8px;
    width: 600px;
    max-width: 90vw;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;

  // Search input
  const searchContainer = document.createElement("div");
  searchContainer.style.cssText = "padding: 16px; border-bottom: 1px solid var(--color-border-light);";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search items... (type:xxx, tag:xxx, #xxx)";
  searchInput.style.cssText = "width: 100%; padding: 8px 12px; font-size: 16px; border: 1px solid var(--color-border-light); border-radius: var(--border-radius); outline: none;";
  searchContainer.appendChild(searchInput);
  modal.appendChild(searchContainer);

  // Item list container
  const listContainer = document.createElement("div");
  listContainer.style.cssText = "flex: 1; overflow: auto; padding: 8px;";
  modal.appendChild(listContainer);

  // Pre-fetch all items for empty query display
  const allItems = await api.getAll();
  allItems.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

  let searchTimeout = null;

  const renderItems = (items) => {
    listContainer.innerHTML = "";

    for (const item of items) {
      const row = document.createElement("div");
      row.style.cssText = "padding: 8px 12px; cursor: pointer; border-radius: var(--border-radius); display: flex; justify-content: space-between; align-items: center;";
      row.onmouseenter = () => row.style.background = "var(--color-bg-hover)";
      row.onmouseleave = () => row.style.background = "";

      const info = document.createElement("div");
      const name = document.createElement("div");
      name.style.fontWeight = "500";
      name.textContent = item.name || item.id.slice(0, 8);
      info.appendChild(name);

      // Metadata
      const typeItem = allItems.find(i => i.id == item.type);
      const meta = document.createElement("div");
      meta.style.cssText = 'font-size: 12px; color: var(--color-text-secondary);';
      meta.textContent = typeItem.name;
      info.appendChild(meta);

      row.appendChild(info);

      // Click to navigate
      row.onclick = () => {
        hide();
        api.navigate(item.id);
      };

      listContainer.appendChild(row);
    }

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "padding: 20px; text-align: center; color: var(--color-text-secondary);";
      empty.textContent = "No items found";
      listContainer.appendChild(empty);
    }
  };

  const doSearch = async (query) => {
    if (!query || query.trim().length === 0) {
      renderItems(allItems);
      return;
    }

    listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--color-text-secondary);">Searching...</div>';

    const results = await searchLib.searchItems(query, api, { allItems });
    renderItems(results);
  };

  // Initial render
  renderItems(allItems);

  searchInput.oninput = () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => doSearch(searchInput.value), 150);
  };

  overlay.appendChild(modal);

  // Close on overlay click
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      hide();
    }
  };

  // Close on Escape
  const escHandler = (e) => {
    if (e.key === "Escape") {
      hide();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);

  document.body.appendChild(overlay);
  searchInput.focus();
}
// [END:show]

export function hide() {
  const existing = document.getElementById("item-list-overlay");
  if (existing) {
    existing.remove();
  }
}
