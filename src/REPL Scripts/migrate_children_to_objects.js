// Migrate all string children to object format
// This eliminates the need for defensive code throughout the system

console.log('=== Migrating Children to Object Format ===\n');

// Get all items
const allItems = await api.getAll();
let migratedCount = 0;
let alreadyOk = 0;

for (const item of allItems) {
  if (!item.children || item.children.length === 0) {
    continue;
  }

  let hasStringChildren = false;
  const newChildren = [];

  for (const child of item.children) {
    if (typeof child === 'string') {
      // Convert string to object format with default values
      hasStringChildren = true;
      newChildren.push({
        id: child,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        z: 1000,
        pinned: false
      });
    } else {
      // Already an object, keep as-is
      newChildren.push(child);
    }
  }

  if (hasStringChildren) {
    const updated = {
      ...item,
      children: newChildren
    };
    await api.set(updated);
    migratedCount++;
    console.log(`✓ Migrated ${item.name || item.id}: ${item.children.length} children`);
  } else {
    alreadyOk++;
  }
}

console.log(`\n=== Migration Complete ===`);
console.log(`Migrated: ${migratedCount} items`);
console.log(`Already correct: ${alreadyOk} items`);
console.log(`\nAll children are now in consistent object format!`);
