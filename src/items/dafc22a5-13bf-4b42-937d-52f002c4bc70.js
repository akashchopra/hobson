// Item: view-update-watcher
// ID: dafc22a5-13bf-4b42-937d-52f002c4bc70
// Type: 22222222-0000-0000-0000-000000000000
// Watches: e0e00000-0001-0002-0000-000000000000 (item:updated) for type aaaaaaaa-0000-0000-0000-000000000000 (view)

// Watches for view code changes and re-renders all items using that view.
// This ensures that when you edit a view's code, all items currently
// rendered with that view update immediately.

export async function onItemUpdated({ id, item }, api) {
  const result = await api.rerenderByView(id);
  if (result.updated > 0) {
    console.log(`[view-update-watcher] Re-rendered ${result.updated} items using view ${item.name || id}`);
  }
}
