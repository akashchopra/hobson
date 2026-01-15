// Fix window.kernel references in code items
// Replace with proper API methods

console.log('=== Fixing window.kernel References ===\n');

// Get all code items
const allItems = await api.getAll();
const codeItems = [];

for (const item of allItems) {
  if (item.content && item.content.code) {
    codeItems.push(item);
  }
}

console.log(`Found ${codeItems.length} code items`);

let fixedCount = 0;

for (const item of codeItems) {
  const originalCode = item.content.code;
  let updatedCode = originalCode;
  let hasChanges = false;

  // Replace window.kernel.createREPLAPI() with api.createREPLContext()
  if (updatedCode.includes('window.kernel.createREPLAPI()')) {
    updatedCode = updatedCode.replace(/window\.kernel\.createREPLAPI\(\)/g, 'api.createREPLContext()');
    hasChanges = true;
    console.log(`  ${item.name}: Fixed createREPLAPI()`);
  }

  // Replace window.kernel.editItemRaw(id) with api.editRaw(id)
  if (updatedCode.includes('window.kernel.editItemRaw(')) {
    updatedCode = updatedCode.replace(/window\.kernel\.editItemRaw\(/g, 'api.editRaw(');
    hasChanges = true;
    console.log(`  ${item.name}: Fixed editItemRaw()`);
  }

  // Replace window.kernel.getRecentItems() with api.getRecentItems()
  if (updatedCode.includes('window.kernel.getRecentItems()')) {
    updatedCode = updatedCode.replace(/window\.kernel\.getRecentItems\(\)/g, 'api.getRecentItems()');
    hasChanges = true;
    console.log(`  ${item.name}: Fixed getRecentItems()`);
  }

  if (hasChanges) {
    const updated = {
      ...item,
      content: {
        ...item.content,
        code: updatedCode
      }
    };
    await api.set(updated);
    fixedCount++;
    console.log(`✓ Updated ${item.name}`);
  }
}

console.log(`\n=== Complete ===`);
console.log(`Fixed ${fixedCount} code items`);
console.log(`\nwindow.kernel references have been replaced with proper API methods.`);
