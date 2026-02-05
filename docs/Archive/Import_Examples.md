# Import Script Examples

Real-world examples of using the import scripts.

## Scenario 1: Basic Restore from Backup

You have a backup file `backup-1705276800000.json` and want to restore it.

### REPL Session:

```javascript
// Paste the quick import script (import-quick.js)
(async function quickImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const json = await file.text();
    const result = await api.import(json);
    console.log(`✓ Imported: ${result.created} created, ${result.skipped} skipped`);
  };
  input.click();
})();

// Select your backup file in the dialog
// Output: ✓ Imported: 47 created, 9 skipped
```

---

## Scenario 2: Import from Clipboard

You copied JSON from another source (API, email, etc.) and want to import it.

### REPL Session:

```javascript
// Paste JSON directly (assuming you have it in clipboard)
const json = `[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "useful_library",
    "type": "00000000-0000-0000-0000-000000000004",
    "created": 1705276800000,
    "modified": 1705276800000,
    "attachments": [],
    "content": {
      "code": "export function helper() { return 'useful'; }"
    }
  }
]`

// Import it
const result = await api.import(json)
console.log(result)
// Output: {created: 1, skipped: 0}

// Verify
await api.get('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
```

---

## Scenario 3: Preview Before Importing

You have a large backup and want to see what will happen before committing.

### REPL Session:

```javascript
// Load the full import script first
// ... paste import-script.js ...

// Read your backup file (you'll select it)
const input = document.createElement('input');
input.type = 'file';
input.accept = '.json';

const json = await new Promise((resolve) => {
  input.onchange = async (e) => {
    const text = await e.target.files[0].text();
    resolve(text);
  };
  input.click();
});

// Preview what will be imported
const preview = await previewImport(json)

// Output shows:
// === Import Preview ===
// Total items: 56
// Will create: 47
// Will skip (already exist): 9
//
// Items to create:
//   - my_new_library (type: 00000000-0000-0000-0000-000000000004)
//   - custom_renderer (type: 00000000-0000-0000-0000-000000000003)
//   ...

// If it looks good, import
const result = await api.import(json)
```

---

## Scenario 4: Update Code Items

You have new versions of renderers/libraries and want to overwrite the old ones.

### REPL Session:

```javascript
// Load the full import script
// ... paste import-script.js ...

// Get the updated code items JSON
const json = `[
  {
    "id": "existing-library-id-here",
    "name": "my_library",
    "type": "00000000-0000-0000-0000-000000000004",
    "created": 1705276800000,
    "modified": 1705283000000,
    "attachments": [],
    "content": {
      "code": "export function helper() { return 'updated!'; }"
    }
  }
]`

// Import WITH overwrite
const result = await importWithOverwrite(json, true)
console.log(result)
// Output: {created: 0, updated: 1, skipped: 0}

// Verify the update
const item = await api.get('existing-library-id-here')
console.log(item.content.code)
// Output: export function helper() { return 'updated!'; }
```

---

## Scenario 5: Import Only Specific Types

You have a backup with many items but only want to import libraries.

### REPL Session:

```javascript
// Load the full import script
// ... paste import-script.js ...

// Your full backup JSON
const fullBackup = `[... all your items ...]`

// Import only libraries
const result = await importSelective(
  fullBackup,
  item => item.type === api.IDS.LIBRARY
)

// Output shows:
// Selected 5 of 56 items for import
// Created: string_utils
// Created: date_helpers
// Created: api_client
// Skipped (exists): test_helpers
// Created: validators
//
// Import complete: {created: 4, skipped: 1, total: 5}
```

---

## Scenario 6: Clone a Set of Items

You want to duplicate a workspace with all its attachments and code.

### REPL Session:

```javascript
// Load the full import script
// ... paste import-script.js ...

// Export a specific workspace and its attachments
const workspaceId = 'some-workspace-id';
const allItems = await api.getAll();

// Get the workspace and all descendants
function getDescendants(itemId, allItems) {
  const descendants = [];
  const item = allItems.find(i => i.id === itemId);

  if (!item) return descendants;

  descendants.push(item);

  const childIds = item.attachments.map(c =>
    typeof c === 'string' ? c : c.id
  );

  for (const childId of childIds) {
    descendants.push(...getDescendants(childId, allItems));
  }

  return descendants;
}

const itemsToClone = getDescendants(workspaceId, allItems);
const json = JSON.stringify(itemsToClone, null, 2);

// Clone with new IDs
const result = await importWithNewIds(json);

console.log(`Cloned ${result.created} items`);
console.log('Old workspace ID:', workspaceId);
console.log('New workspace ID:', result.idMap.get(workspaceId));

// The new workspace is now available
const newWorkspace = await api.get(result.idMap.get(workspaceId));
console.log(newWorkspace);
```

---

## Scenario 7: Migrate from Old Format

You have items in an old format and need to transform them during import.

### REPL Session:

```javascript
// Your old format
const oldFormatJson = `[
  {
    "guid": "old-id-format",
    "itemName": "my_item",
    "itemType": "library",
    "data": {
      "source": "function() {}"
    }
  }
]`

// Transform to new format
const oldItems = JSON.parse(oldFormatJson);
const newItems = oldItems.map(old => ({
  id: old.guid,
  name: old.itemName,
  type: old.itemType === 'library' ? api.IDS.LIBRARY :
        old.itemType === 'renderer' ? api.IDS.RENDERER :
        api.IDS.ATOM,
  created: Date.now(),
  modified: Date.now(),
  attachments: [],
  content: {
    code: old.data.source
  }
}));

// Import transformed items
const json = JSON.stringify(newItems);
const result = await api.import(json);
console.log(result);
```

---

## Scenario 8: Selective Recovery After Accidental Delete

You accidentally deleted items and want to recover specific ones.

### REPL Session:

```javascript
// View deleted items
const deleted = helpers.viewDeleted()

// Shows:
// === Deleted Items (5) ===
// [0] my_important_note (deleted: 2025-01-14T10:30:00Z)
// [1] draft_document (deleted: 2025-01-14T10:31:00Z)
// ...

// Recover specific item
helpers.recoverDeleted(0)

// Or, if you have a backup, selectively import
const backup = `[... your backup ...]`;

// Load the full import script
// ... paste import-script.js ...

// Import only the items you need
await importSelective(backup, item =>
  item.name === 'my_important_note' ||
  item.id === 'specific-guid-here'
)
```

---

## Scenario 9: Batch Import Multiple Backup Files

You have several backup files and want to import them all.

### REPL Session:

```javascript
// Load the full import script
// ... paste import-script.js ...

// Create a batch import function
async function batchImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.multiple = true; // Allow multiple files

  return new Promise((resolve) => {
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      const results = [];

      for (const file of files) {
        console.log(`Importing ${file.name}...`);
        const json = await file.text();
        const result = await api.import(json);
        console.log(`  ✓ ${result.created} created, ${result.skipped} skipped`);
        results.push({ file: file.name, ...result });
      }

      resolve(results);
    };

    input.click();
  });
}

// Run batch import
const results = await batchImport();
console.log('Batch import complete:', results);

// Output:
// Importing backup-1.json...
//   ✓ 23 created, 0 skipped
// Importing backup-2.json...
//   ✓ 15 created, 8 skipped
// Importing backup-3.json...
//   ✓ 31 created, 2 skipped
// Batch import complete: [...]
```

---

## Scenario 10: Import and Add to Current Workspace

Import items and automatically add them to the current workspace.

### REPL Session:

```javascript
// Load the full import script
// ... paste import-script.js ...

// Enhanced import that adds to workspace
async function importAndAddToWorkspace(json) {
  const items = JSON.parse(json);
  const workspace = await api.get(api.IDS.WORKSPACE);
  let created = 0;

  for (const item of items) {
    const exists = await api.exists(item.id);

    if (!exists) {
      await api.set(item);
      created++;

      // Add to workspace if not already a child
      if (!workspace.attachments.includes(item.id)) {
        await api.attach(api.IDS.WORKSPACE, item.id);
        console.log(`Created and added to workspace: ${item.name || item.id}`);
      }
    }
  }

  console.log(`Import complete: ${created} items created and added to workspace`);
  return { created };
}

// Use it
const json = `[...]`;
await importAndAddToWorkspace(json);
```

---

## Tips

1. **Always backup before major imports**: `await api.export()`

2. **Test with a subset first**: Use `importSelective()` to import just one or two items

3. **Check for conflicts**: Use `previewImport()` to see what exists

4. **Verify after import**:
   ```javascript
   await api.get('item-id')
   await helpers.findByName('item_name')
   ```

5. **Clean up if needed**:
   ```javascript
   // Delete mistakenly imported item
   await api.delete('item-id')

   // View deletion history
   helpers.viewDeleted()

   // Recover if needed
   helpers.recoverDeleted(0)
   ```

6. **Use the REPL history**: Press ↑ to recall previous commands

7. **Save import scripts**: Keep `import-script.js` handy for repeated use
