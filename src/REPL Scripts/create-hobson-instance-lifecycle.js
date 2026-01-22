// Create the hobson-instance-lifecycle library item
// This handles cascade delete when a hobson-instance is deleted

const LIBRARY_TYPE = '66666666-0000-0000-0000-000000000000';
const HOBSON_INSTANCE_TYPE = '99999999-0000-0000-0000-000000000000';

const lifecycleItem = {
  id: crypto.randomUUID(),
  name: 'hobson-instance-lifecycle',
  type: LIBRARY_TYPE,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    description: 'Handles lifecycle events for hobson-instance items, including cascade delete of nested items.',
    watches: [
      {
        event: 'item:deleted',
        type: HOBSON_INSTANCE_TYPE
      }
    ],
    code: `// hobson-instance-lifecycle
// Handles cascade delete when a hobson-instance is deleted

export async function onItemDeleted({ id, item }, api) {
  console.log(\`Hobson instance deleted: \${item.name || id}. Cleaning up nested items...\`);

  // Get all items including nested (raw) to find items with this prefix
  // In parent context, getAllRaw returns items with their full prefixed IDs
  const allItems = await api.getAllRaw();
  const prefix = id + ':';
  const nestedItems = allItems.filter(i => i.id.startsWith(prefix));

  if (nestedItems.length === 0) {
    console.log('No nested items to clean up.');
    return;
  }

  console.log(\`Found \${nestedItems.length} nested items to delete...\`);

  // Delete each nested item
  // The IDs from getAllRaw are already the full prefixed IDs (e.g., "instance-abc:kernel-core")
  for (const nestedItem of nestedItems) {
    try {
      await api.delete(nestedItem.id);
    } catch (e) {
      console.warn(\`Failed to delete nested item \${nestedItem.id}:\`, e.message);
    }
  }

  console.log(\`Cleaned up \${nestedItems.length} nested items from instance \${item.name || id}.\`);
}
`
  }
};

await kernel.storage.set(lifecycleItem, kernel);
console.log(`Created hobson-instance-lifecycle item with ID: ${lifecycleItem.id}`);
console.log('This item watches for hobson-instance deletions and cleans up nested items.');
