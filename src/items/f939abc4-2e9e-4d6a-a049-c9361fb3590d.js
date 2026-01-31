// Item: hobson-instance-lifecycle
// ID: f939abc4-2e9e-4d6a-a049-c9361fb3590d
// Type: 66666666-0000-0000-0000-000000000000
// Watches: e0e00000-0001-0003-0000-000000000000 (item:deleted) for type 99999999-0000-0000-0000-000000000000 (hobson-instance)

// hobson-instance-lifecycle
// Handles cascade delete when a hobson-instance is deleted

export async function onItemDeleted({ id, item }, api) {
  console.log(`Hobson instance deleted: ${item.name || id}. Cleaning up nested items...`);

  // Get all items including nested (raw) to find items with this prefix
  // In parent context, getAllRaw returns items with their full prefixed IDs
  const allItems = await api.getAllRaw();
  const prefix = id + ':';
  const nestedItems = allItems.filter(i => i.id.startsWith(prefix));

  if (nestedItems.length === 0) {
    console.log('No nested items to clean up.');
    return;
  }

  console.log(`Found ${nestedItems.length} nested items to delete...`);

  // Delete each nested item
  // The IDs from getAllRaw are already the full prefixed IDs (e.g., "instance-abc:kernel-core")
  for (const nestedItem of nestedItems) {
    try {
      await api.delete(nestedItem.id);
    } catch (e) {
      console.warn(`Failed to delete nested item ${nestedItem.id}:`, e.message);
    }
  }

  console.log(`Cleaned up ${nestedItems.length} nested items from instance ${item.name || id}.`);
}
