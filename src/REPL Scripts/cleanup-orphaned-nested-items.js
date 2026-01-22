// Clean up orphaned nested instance items
// These are items with prefixed IDs (like "instance-abc:kernel-core")
// where the parent instance item no longer exists

const HOBSON_INSTANCE_TYPE = '99999999-0000-0000-0000-000000000000';

const allItems = await kernel.storage.getAllRaw();

// Get all existing hobson-instance item IDs
const existingInstances = new Set(
  allItems
    .filter(i => i.type === HOBSON_INSTANCE_TYPE)
    .map(i => i.id)
);

console.log(`Found ${existingInstances.size} existing hobson-instance items`);

// Find all prefixed items (contain ":" in their ID)
const prefixedItems = allItems.filter(i => i.id.includes(':'));

console.log(`Found ${prefixedItems.length} prefixed items total`);

// Group by prefix (instance ID)
const byPrefix = new Map();
for (const item of prefixedItems) {
  const prefix = item.id.split(':')[0];
  if (!byPrefix.has(prefix)) {
    byPrefix.set(prefix, []);
  }
  byPrefix.get(prefix).push(item);
}

console.log(`Found ${byPrefix.size} unique instance prefixes`);

// Check which prefixes have no corresponding hobson-instance item
let orphanedCount = 0;
for (const [prefix, items] of byPrefix) {
  if (!existingInstances.has(prefix)) {
    console.log(`Instance ${prefix.slice(0, 8)}... no longer exists. Deleting ${items.length} orphaned items...`);

    for (const item of items) {
      try {
        await kernel.storage.delete(item.id);
        orphanedCount++;
      } catch (e) {
        console.warn(`Failed to delete ${item.id}:`, e.message);
      }
    }
  } else {
    console.log(`Instance ${prefix.slice(0, 8)}... still exists (${items.length} items)`);
  }
}

console.log(`\nCleanup complete. Deleted ${orphanedCount} orphaned items.`);
