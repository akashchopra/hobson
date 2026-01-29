# Review: kernel-safe-mode

**Item ID:** `33333333-7777-0000-0000-000000000000`
**Type:** kernel-module

---

## Responsibilities

1. Provide recovery UI when booted with `?safe=1`
2. List all items and code items
3. Enable raw JSON editing of items
4. Export/import data
5. System reset capability

---

## Code Review

### Issues Found

**CRITICAL:**

1. **Line ~55 in `_renderItemList()`:** XSS vulnerability - item names inserted into innerHTML without escaping:
   ```javascript
   preview.innerHTML = `
     <div class="item-info">
       <div class="item-name">${this._escapeHtml(item.name || item.id)}</div>
       ...
     </div>
   `;
   ```

   Wait - the code DOES call `_escapeHtml()`. Let me check the actual implementation...

   Actually looking at the code, `_escapeHtml` IS used in `editItem()` but in `_renderItemList()` the innerHTML template uses string interpolation that should call `_escapeHtml`. Let me verify the actual code:

   ```javascript
   preview.innerHTML = `
     <div class="item-info">
       <div class="item-name">${this._escapeHtml(item.name || item.id)}</div>
       <div class="item-type">Type: ${item.type}</div>
     </div>
     ...
   `;
   ```

   **Issue confirmed:** The `item.type` is NOT escaped. An item with malicious type ID could inject HTML.

   **Fix:** Escape all dynamic values:
   ```javascript
   <div class="item-type">Type: ${this._escapeHtml(item.type)}</div>
   ```

**HIGH PRIORITY:**

2. **Line ~52:** Sort crashes on undefined name:
   ```javascript
   items.sort((a,b) => a.name.localeCompare(b.name));
   ```

   **Impact:** If any item lacks a `name`, Safe Mode crashes.

   **Fix:**
   ```javascript
   items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
   ```

### Minor Observations

1. **`render()` method:** Uses inline HTML template strings. Acceptable for Safe Mode since it's minimal recovery UI, but inconsistent with DOM-based approach elsewhere.

2. **`resetSystem()`:** Properly prompts for confirmation twice (implicit in the warning message). Good UX for destructive action.

3. **`importData()`:** Correctly skips existing items to prevent data loss.

---

## API Surface

| Method | Description | Notes |
|--------|-------------|-------|
| `render(rootElement)` | Show Safe Mode UI | Main entry |
| `listAllItems()` | Display all items | Calls `_renderItemList` |
| `listCodeItems()` | Display code only | Filters by type chain |
| `editItem(itemId)` | Raw JSON editor | Uses escaped output |
| `saveItem(itemId)` | Persist edited JSON | Clears module cache |
| `deleteItem(itemId)` | Remove with confirm | |
| `exportData(singleFile)` | Download backup | |
| `importData()` | Merge from file | Skips existing |
| `resetSystem()` | Delete all | Double-confirms |

---

## Recommendations

1. **CRITICAL:** Escape `item.type` in `_renderItemList()` innerHTML

2. **HIGH:** Fix sort to handle undefined names

3. **LOW:** Consider refactoring to use DOM APIs instead of innerHTML templates for consistency

---

## Verdict

**Status:** ✓ Fixed (2026-01-29)

Both issues have been fixed:
- XSS: Added `this._escapeHtml(item.type)` to escape the type ID
- Sort crash: Changed to `(a.name || '').localeCompare(b.name || '')`

---

## Proposed Fix

```javascript
_renderItemList(items, title) {
  const listEl = document.getElementById("item-list");
  if (!listEl) return;

  listEl.innerHTML = `<h2>${this._escapeHtml(title)} (${items.length})</h2>`;

  // FIX: Handle undefined names in sort
  items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  for (const item of items) {
    const preview = document.createElement("div");
    preview.className = "item-preview";
    // FIX: Escape ALL dynamic values
    preview.innerHTML = `
      <div class="item-info">
        <div class="item-name">${this._escapeHtml(item.name || item.id)}</div>
        <div class="item-type">Type: ${this._escapeHtml(item.type)}</div>
      </div>
      <div>
        <button onclick="kernel.safeMode.editItem('${this._escapeHtml(item.id)}')">Edit as JSON</button>
        <button onclick="kernel.safeMode.deleteItem('${this._escapeHtml(item.id)}')" style="color: red;">Delete</button>
      </div>
    `;
    listEl.appendChild(preview);
  }
}
```
