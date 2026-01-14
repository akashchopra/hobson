# Item Import Guide

This guide explains how to import items from JSON backups in Hobson.

## Quick Start

### Method 1: Built-in Import (Simplest)

Hobson has a built-in import function:

```javascript
// In REPL: paste your JSON as a string
await api.import('[{"id":"...","type":"..."}]')
```

Returns: `{created: number, skipped: number}`

### Method 2: Quick File Import

Copy and paste the contents of `import-quick.js` into the REPL. It will:
1. Open a file picker
2. Read the JSON file
3. Import using the built-in API
4. Report results

### Method 3: Advanced Import Script

For more control, load the full script from `import-script.js`:

```javascript
// Copy/paste the entire import-script.js file into REPL
// Then use any of the provided functions
```

---

## Import Functions Reference

### 1. `importFromFile()`

Opens a file picker to select a JSON backup file.

```javascript
await importFromFile()
```

**Use when:** You have a backup JSON file on disk.

---

### 2. `importFromPrompt()`

Shows a prompt dialog to paste JSON directly.

```javascript
await importFromPrompt()
```

**Use when:** You have JSON text in your clipboard (e.g., from API response, copied text).

---

### 3. `importWithOverwrite(json, overwrite)`

Import with option to overwrite existing items.

```javascript
const json = '[{"id":"..."}]';

// Skip existing items (default behavior)
await importWithOverwrite(json, false)

// Overwrite existing items
await importWithOverwrite(json, true)
```

**Use when:** You want to update existing items with new data.

**Returns:** `{created, updated, skipped}`

---

### 4. `importSelective(json, filterFn)`

Import only items matching a filter function.

```javascript
const json = '[{"id":"...","type":"..."}]';

// Import only libraries
await importSelective(json, item => item.type === api.IDS.LIBRARY)

// Import only items created after a date
await importSelective(json, item => item.created > 1705276800000)

// Import only named items
await importSelective(json, item => item.name)

// Import by type name (requires type lookup)
await importSelective(json, item => item.type === api.IDS.RENDERER)
```

**Use when:** You only want to import specific items from a backup.

---

### 5. `importWithNewIds(json)`

Import items but assign new GUIDs to everything. Useful for duplicating items.

```javascript
const json = '[{"id":"..."}]';
const result = await importWithNewIds(json)

// result.idMap contains old ID -> new ID mapping
console.log(result.idMap)
```

**Features:**
- Generates new GUIDs for all items
- Remaps all references (type, children)
- Preserves relationships between imported items
- Updates timestamps to now

**Use when:** You want to duplicate a set of items without replacing originals.

---

### 6. `previewImport(json)`

Dry-run mode - shows what would be imported without actually importing.

```javascript
const json = '[{"id":"..."}]';
const preview = await previewImport(json)

console.log(preview.toCreate)  // Items that will be created
console.log(preview.toSkip)    // Items that already exist
```

**Use when:** You want to see what will happen before committing to an import.

---

## Common Use Cases

### Restore from Backup

```javascript
// Load the script
// ... paste import-script.js ...

// Import backup file
await importFromFile()
```

### Merge Two Systems

```javascript
// Export from system A, import into system B
// Existing items are preserved (not overwritten)
await importFromFile()
```

### Update Seed Items or Code

```javascript
const json = await (await fetch('new-seed-items.json')).text()
await importWithOverwrite(json, true)
```

### Clone a Workspace

```javascript
// Export workspace and its children from one system
const workspaceBackup = '[...]'

// Import with new IDs in another system (or same system)
const result = await importWithNewIds(workspaceBackup)

// The new workspace ID:
console.log(result.idMap.get('00000000-0000-0000-0000-000000000006'))
```

### Import Only Code Items

```javascript
const backup = '[...]'

// Import only renderers and libraries
await importSelective(backup, item =>
  item.type === api.IDS.RENDERER ||
  item.type === api.IDS.LIBRARY
)
```

### Selective Recovery

```javascript
// Preview what's in the backup
const backup = '[...]'
const preview = await previewImport(backup)

// Review what will be created
preview.toCreate.forEach(item => {
  console.log(item.name || item.id)
})

// Import only specific items
await importSelective(backup, item =>
  item.name === 'my_important_library'
)
```

---

## JSON Format

Hobson backup files are JSON arrays of item objects:

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "my_library",
    "type": "00000000-0000-0000-0000-000000000004",
    "created": 1705276800000,
    "modified": 1705283000000,
    "children": [],
    "content": {
      "code": "export function test() { return 42; }"
    }
  }
]
```

### Required Fields
- `id`: GUID string
- `type`: GUID of type item
- `created`: Unix timestamp (milliseconds)
- `modified`: Unix timestamp (milliseconds)
- `children`: Array of IDs or positioned objects
- `content`: Object with arbitrary data

### Optional Fields
- `name`: String (required for code items: renderers, libraries)

---

## Import Behavior

### Default (Built-in `api.import()`)
- Skips items with duplicate IDs
- Does NOT overwrite existing items
- Uses `_rawSet()` to bypass validation
- Fast and safe for merging backups

### Validation
When using `api.set()` (not `_rawSet()`):
- Validates type chain integrity
- Checks for circular type references
- Enforces code item name uniqueness
- May fail if validation errors occur

### Timestamps
- Built-in import: Preserves original timestamps
- `importWithNewIds()`: Sets timestamps to `Date.now()`
- `importWithOverwrite()`: Updates `modified` timestamp

### Children References
- String children: Imported as-is
- Positioned children: `{id, x, y, width, height, z, pinned}`
- IDs are remapped in `importWithNewIds()`

---

## Troubleshooting

### "Type chain validation failed"

Using `api.set()` validates the type chain. If importing items with custom types:
1. Import type definitions first
2. Or use the built-in `api.import()` which bypasses validation

### "Duplicate name"

Code items (renderers, libraries) must have unique names. Either:
- Rename conflicting items before import
- Use `importWithOverwrite()` to replace existing
- Use `importWithNewIds()` and rename after

### "Item skipped"

Default behavior - item with that ID already exists. To overwrite:
- Use `importWithOverwrite(json, true)`

### Items imported but not visible

Check:
1. Items were created: `await api.exists('item-id')`
2. Items are in workspace children: `const ws = await api.get(api.IDS.WORKSPACE)`
3. Container needs refresh: close and reopen item

---

## Exporting Items

To create backups for importing:

```javascript
// Export all items
const count = await api.export()
// Downloads: backup-{timestamp}.json

// Export to variable (for selective export)
const allItems = await api.getAll()
const onlyLibraries = allItems.filter(item => item.type === api.IDS.LIBRARY)
const json = JSON.stringify(onlyLibraries, null, 2)

// Save manually
const blob = new Blob([json], {type: 'application/json'})
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'libraries-backup.json'
a.click()
```

---

## Safety Notes

- **Always preview first:** Use `previewImport()` before importing large backups
- **Backup before overwrite:** Run `api.export()` before using `importWithOverwrite()`
- **Test with small sets:** Import a few items first to verify format
- **Check workspace:** Imported items may not be added to workspace automatically
- **Recovery available:** Deleted items stored in `localStorage['hobson-deleted-items']`

---

## See Also

- `docs/Code_Items.md` - Catalog of code items in system
- `docs/Technical_Implementation_Notes.md` - Storage implementation details
- `src/hobson.html:2279-2308` - Built-in import/export code
- `src/hobson.html:966-1112` - ItemStorage class
