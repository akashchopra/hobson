// Item: item-palette
// ID: f1111111-0005-0000-0000-000000000000
// Type: 66666666-0000-0000-0000-000000000000

// Item Palette Library
// Provides the item search/navigation modal. Moved from kernel to userland.
// See [item-palette documentation](item://f1111111-0005-0000-0000-000000000000)

let api = null;

export async function onSystemBootComplete({ safeMode }, _api) {
  if (safeMode) return;
  api = _api;
}

// [BEGIN:show]
export async function show() {
  if (!api) {
    console.warn('item-palette: not initialized');
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
    z-index: 10000;
  `;

  const modal = document.createElement("div");
  modal.style.cssText = `
    background: white;
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
  searchContainer.style.cssText = "padding: 16px; border-bottom: 1px solid #ddd;";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search items...";
  searchInput.style.cssText = "width: 100%; padding: 8px 12px; font-size: 16px; border: 1px solid #ddd; border-radius: 4px; outline: none;";
  searchContainer.appendChild(searchInput);
  modal.appendChild(searchContainer);

  // Item list container
  const listContainer = document.createElement("div");
  listContainer.style.cssText = "flex: 1; overflow: auto; padding: 8px;";
  modal.appendChild(listContainer);

  const items = await api.getAll();
  items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

  const renderList = (filter = "") => {
    listContainer.innerHTML = "";
    const filtered = filter
      ? items.filter(i => (i.name || i.id).toLowerCase().includes(filter.toLowerCase()))
      : items;

    for (const item of filtered) {
      const row = document.createElement("div");
      row.style.cssText = "padding: 8px 12px; cursor: pointer; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;";
      row.onmouseenter = () => row.style.background = "#f0f0f0";
      row.onmouseleave = () => row.style.background = "";

      const info = document.createElement("div");
      const name = document.createElement("div");
      name.style.fontWeight = "500";
      name.textContent = item.name || item.id.slice(0, 8);
      info.appendChild(name);

      const typeLine = document.createElement("div");
      typeLine.style.cssText = "font-size: 12px; color: #666;";
      typeLine.textContent = item.type.slice(0, 8);
      info.appendChild(typeLine);

      row.appendChild(info);

      // Click to navigate
      row.onclick = () => {
        hide();
        api.navigate(item.id);
      };

      listContainer.appendChild(row);
    }

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "padding: 20px; text-align: center; color: #666;";
      empty.textContent = "No items found";
      listContainer.appendChild(empty);
    }
  };

  renderList();

  searchInput.oninput = () => renderList(searchInput.value);

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
