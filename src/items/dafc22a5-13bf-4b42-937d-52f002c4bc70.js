// Watches for view code changes and re-renders all items using that view.
// This ensures that when you edit a view's code, all items currently
// rendered with that view update immediately.

export async function onItemUpdated({ id, item }, api) {
  const result = await api.rerenderByView(id);
  if (result.updated > 0) {
    console.log(`[view-update-watcher] Re-rendered ${result.updated} items using view ${item.name || id}`);
  }
}
