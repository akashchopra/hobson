// Register event listener for cascade delete of nested instance items
// When a hobson-instance item is deleted, all its prefixed items are also deleted

const HOBSON_INSTANCE_TYPE = '99999999-0000-0000-0000-000000000000';

const unsubscribe = kernel.events.on('item:deleted', async ({ id, item }) => {
  // Check if deleted item was a hobson-instance
  if (item.type !== HOBSON_INSTANCE_TYPE) {
    return;
  }

  console.log(`Hobson instance deleted: ${id}. Cleaning up nested items...`);

  // Get all items including nested (raw) to find items with this prefix
  const allItems = await kernel.storage.getAllRaw();
  const prefix = `${id}:`;
  const nestedItems = allItems.filter(i => i.id.startsWith(prefix));

  if (nestedItems.length === 0) {
    console.log('No nested items to clean up.');
    return;
  }

  console.log(`Found ${nestedItems.length} nested items to delete...`);

  // Delete each nested item (use storage.delete directly to avoid recursion)
  for (const nestedItem of nestedItems) {
    try {
      await kernel.storage.delete(nestedItem.id);
    } catch (e) {
      console.warn(`Failed to delete nested item ${nestedItem.id}:`, e.message);
    }
  }

  console.log(`Cleaned up ${nestedItems.length} nested items.`);
});

console.log('Cascade delete listener registered. Store `unsubscribe` to remove later.');
// To unsubscribe later: unsubscribe()
