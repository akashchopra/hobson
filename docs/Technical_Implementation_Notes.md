# Personal Information App
## Technical Implementation Notes

*Last Updated: 2026-01-10 (Session 6)*

---

## Purpose

This document contains concrete implementation patterns, code examples, and technical details for building the system. It complements the Design Decisions Log by showing **how** to implement what was decided, not just **what** was decided.

Sections are numbered to match the Design Decisions Log for easy cross-reference.

---

## 1. Data Model & Item Definition

### Storage API Specification

The kernel's storage layer provides these core operations:

```javascript
interface Storage {
  /**
   * Retrieve a single item by ID
   * @throws Error if item not found
   */
  async get(id: string): Promise<Item>
  
  /**
   * Create or update an item (upsert)
   * Validates type chain, name uniqueness, and required fields before saving
   * @throws Error if validation fails
   */
  async set(item: Item): Promise<void>
  
  /**
   * Delete an item by ID
   * Succeeds silently if item doesn't exist (idempotent)
   */
  async delete(id: string): Promise<void>
  
  /**
   * Query items matching filter criteria
   * Only matches top-level fields (id, name, type, created, modified)
   * Returns empty array if no matches
   */
  async query(filter: QueryFilter): Promise<Item[]>
  
  /**
   * Retrieve all items in the database
   * Use for complex queries with user code filtering
   */
  async getAll(): Promise<Item[]>
  
  /**
   * Check if an item exists without loading it
   */
  async exists(id: string): Promise<boolean>
}

interface QueryFilter {
  id?: string          // Exact match on ID
  name?: string        // Exact match on name
  type?: string        // Exact match on type
  created?: number     // Exact match on timestamp
  modified?: number    // Exact match on timestamp
  // Content field queries not supported - use getAll() + filter
}

interface Item {
  id: string           // GUID (memorable for seed items)
  name?: string        // Optional, required for code items
  type: string         // GUID reference to type item
  created: number      // Unix timestamp
  modified: number     // Unix timestamp
  children: string[]   // Array of child item IDs (ordered)
  content: Record<string, any>  // Arbitrary key-value data
}
```

### Usage Examples

```javascript
// Get a single item
const item = await storage.get('00000000-0000-0000-0000-000000000000');

// Create or update an item
await storage.set({
  id: crypto.randomUUID(),
  name: 'my_note',
  type: 'note-type-guid',
  created: Date.now(),
  modified: Date.now(),
  children: [],  // Standard property for all items
  content: {
    text: 'Meeting notes',
    tags: ['work', 'urgent']
  }
});

// Query for items
const notes = await storage.query({ type: 'note-type-guid' });
const recent = await storage.query({ modified: Date.now() - 86400000 });

// Complex query using getAll()
const all = await storage.getAll();
const urgentNotes = all.filter(item => 
  item.type === 'note-type-guid' && 
  item.content.tags?.includes('urgent')
);

// Delete an item
await storage.delete('item-guid-to-delete');

// Check existence
if (await storage.exists('atom')) {
  // Seed items already created
}
```

### Validation Rules

When `set()` is called, the following validations occur:

1. **Type Chain Validation:**
   - Walk the type chain from `item.type` to ensure it reaches `atom`
   - Detect circular type references
   - Throw error if chain is broken or circular

2. **Name Uniqueness for Code Items:**
   - If item's type chain includes "code" (00000000-0000-0000-0000-000000000002)
   - Require `name` field to be present
   - Check for duplicate names among code items
   - Throw error if name already exists on different item

3. **Required Fields (Future):**
   - Type definitions can specify required fields in their content
   - Validate that items of that type have those fields
   - Currently not enforced, reserved for future implementation

### Error Handling

```javascript
// Item not found
try {
  await storage.get('nonexistent-guid');
} catch (error) {
  // Error: Item 'nonexistent-guid' not found
}

// Validation failure
try {
  await storage.set({
    id: 'new-guid',
    name: 'storage_api',  // Duplicate name
    type: 'library-guid',
    // ...
  });
} catch (error) {
  // Error: Code item named 'storage_api' already exists (id: existing-guid)
}

// Broken type chain
try {
  await storage.set({
    id: 'new-guid',
    type: 'nonexistent-type-guid',
    // ...
  });
} catch (error) {
  // Error: Type chain broken - item 'nonexistent-type-guid' not found
}
```

### IndexedDB Schema

```javascript
// Database: "personal_system"

// Object Store: "items"
{
  keyPath: 'id',
  indexes: [
    { name: 'type', keyPath: 'type', unique: false },
    { name: 'modified', keyPath: 'modified', unique: false },
    { name: 'name', keyPath: 'name', unique: false }  // Optional index
  ]
}
```

**Notes:**
- Single object store keeps implementation simple
- Additional indexes can be created by user code as needed
- Name index is optional but useful for code item lookups

---

## 2. Kernel Architecture & Execution Model

### Kernel Class Structure

```javascript
class Kernel {
  constructor() {
    this.storage = new ItemStorage();
    this.moduleCache = new Map(); // itemId -> {module, timestamp}
    this.currentView = null;
  }
  
  // Boot sequence
  async boot() {
    await this.storage.initialize();
    await this.ensureSeedItems();
    
    // Check for safe mode (Shift key held during load)
    if (this.isSafeMode()) {
      this.renderMinimalUI();
    } else {
      await this.renderCurrentView();
    }
  }
  
  // Safe mode check
  isSafeMode() {
    // In browser: check if Shift key is held
    return window.shiftKeyPressed; // Set by keydown listener
  }
  
  // Minimal UI for recovery
  renderMinimalUI() {
    document.body.innerHTML = `
      <div id="safe-mode">
        <h1>Safe Mode</h1>
        <p>Booted with minimal kernel only. No user code loaded.</p>
        <button onclick="kernel.listAllItems()">List All Items</button>
        <button onclick="kernel.exitSafeMode()">Exit Safe Mode</button>
      </div>
    `;
  }
  
  // Create seed items if they don't exist
  async ensureSeedItems() {
    const atomExists = await this.storage.exists("atom");
    if (!atomExists) {
      await this.createSeedItems();
    }
  }
  
  // Main render method
  async renderCurrentView() {
    const currentItem = this.getCurrentlyViewedItem();
    if (!currentItem) {
      this.renderItemList();
      return;
    }
    
    try {
      const rendered = await this.renderItem(currentItem);
      document.getElementById("main-view").replaceWith(rendered);
    } catch (error) {
      this.showError(error, currentItem.id);
    }
  }
  
  // Error display
  showError(error, itemId) {
    const errorView = document.createElement("div");
    errorView.className = "error";
    errorView.innerHTML = `
      <h3>Error in item: ${itemId}</h3>
      <pre>${error.message}\n${error.stack}</pre>
      <button onclick="kernel.editItem('${itemId}')">Edit Item</button>
    `;
    document.getElementById("main-view").replaceWith(errorView);
  }
}
```

### Item Modification Handler

```javascript
// Called when user saves changes to an item
async onItemModified(item) {
  // Save to storage
  await this.storage.update(item);
  
  // If it's a code item, invalidate and re-render
  if (await this.isCodeItem(item)) {
    // Clear from cache (or rely on timestamp check)
    this.moduleCache.delete(item.id);
    
    // Show new behavior immediately
    await this.renderCurrentView();
  }
}

// Check if an item is a code item (has "code" in its type chain)
async isCodeItem(item) {
  return await this.storage.typeChainIncludes(item.id, "code");
}
```

---

## 3. Technology Stack

*Browser and storage setup to be detailed when implementing*

**Placeholder topics:**
- IndexedDB initialization
- DOM manipulation utilities
- Module bundling (if any)

---

## 4. Seed Items

### Seed Item Creation

```javascript
async createSeedItems() {
  const now = Date.now();
  
  // 1. Atom (self-referential base)
  await this.storage.create({
    id: "atom",
    type: "atom",
    created: now,
    modified: now,
    children: [],  // Standard property for all items
    content: {
      description: "The fundamental unit. Everything is an atom or derives from atom."
    }
  });
  
  // 2. Type definition
  await this.storage.create({
    id: "type_definition",
    type: "atom",
    created: now,
    modified: now,
    children: [],
    content: {
      description: "Defines a type of item",
      required_fields: []
    }
  });
  
  // 3. Code (parent of all executable code)
  await this.storage.create({
    id: "code",
    type: "type_definition",
    created: now,
    modified: now,
    children: [],
    content: {
      description: "Executable code item",
      required_fields: ["code"]
    }
  });
  
  // 4. Renderer
  await this.storage.create({
    id: "renderer",
    type: "code",
    created: now,
    modified: now,
    children: [],
    content: {
      description: "Code that renders an item type",
      required_fields: ["for_type", "code"]
    }
  });
  
  // 5. Default renderer (renders everything as JSON)
  await this.storage.create({
    id: "default_renderer",
    type: "renderer",
    created: now,
    modified: now,
    children: [],
    content: {
      for_type: "atom",
      code: `
        export function render(item, api) {
          return api.h('pre', { class: 'json-view' }, [
            JSON.stringify(item, null, 2)
          ]);
        }
      `
    }
  });
}
```

---

## 5. Renderer System

### Renderer Lookup Algorithm

```javascript
async renderItem(item) {
  // 1. Find the most specific renderer for this item's type
  const renderer = await this.findRenderer(item.type);
  
  // 2. Load the renderer module
  const rendererModule = await this.require(renderer.id);
  
  // 3. Execute the render function
  const api = this.createReadOnlyAPI();
  const domNode = rendererModule.render(item, api);
  
  return domNode;
}

async findRenderer(typeId) {
  // Walk up the type chain looking for a renderer
  let currentType = typeId;
  
  while (currentType) {
    // Look for a renderer for this type
    const renderer = await this.storage.queryOne({
      type: "renderer",
      "content.for_type": currentType
    });
    
    if (renderer) {
      return renderer;
    }
    
    // Move up the type chain
    const typeItem = await this.storage.get(currentType);
    currentType = typeItem.type;
    
    // Stop at atom (self-referential)
    if (currentType === typeItem.id) {
      break;
    }
  }
  
  // Fall back to default renderer
  return await this.storage.get("default_renderer");
}
```

### Read-Only API for Renderers

```javascript
createReadOnlyAPI() {
  return {
    // Query items (read-only)
    query: (filter) => this.storage.query(filter),
    
    // Get single item (read-only)
    get: (itemId) => this.storage.get(itemId),
    
    // Create DOM elements
    h: (tag, props, children) => this.createElement(tag, props, children),
    
    // Load other code modules
    require: (itemId) => this.require(itemId),
    
    // NO create/update/delete operations
  };
}

// Simple virtual DOM element creation
createElement(tag, props = {}, children = []) {
  const element = document.createElement(tag);
  
  // Set properties
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('on')) {
      // Event handler
      const eventName = key.substring(2).toLowerCase();
      element.addEventListener(eventName, value);
    } else if (key === 'class') {
      element.className = value;
    } else {
      element.setAttribute(key, value);
    }
  }
  
  // Add children
  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }
  
  return element;
}
```

---

## 6. Code Execution & Invalidation

### Async Module Loading with Lazy Invalidation

```javascript
// Core require implementation
async require(itemId, callStack = new Set()) {
  // 1. Check for circular dependencies
  if (callStack.has(itemId)) {
    const chain = Array.from(callStack).join(' -> ');
    throw new Error(`Circular dependency detected: ${chain} -> ${itemId}`);
  }
  
  // 2. Check cache
  const cached = this.moduleCache.get(itemId);
  const item = await this.storage.get(itemId);
  
  // 3. Validate cache freshness via timestamp
  if (cached && cached.timestamp >= item.modified) {
    return cached.module;
  }
  
  // 4. Re-evaluate if stale or not cached
  callStack.add(itemId);
  const module = await this.evaluateCodeItem(item, callStack);
  callStack.delete(itemId);
  
  // 5. Update cache
  this.moduleCache.set(itemId, {
    module,
    timestamp: item.modified
  });
  
  return module;
}
```

### Module Cache Structure

```javascript
// Cache structure:
// Map<itemId, {module, timestamp}>
//
// Where:
// - itemId: String - the item's ID
// - module: Object - the evaluated module exports
// - timestamp: Number - item.modified at time of evaluation
//
// Example:
// moduleCache.set("findRelatedItems", {
//   module: {
//     findRelatedItems: function(item) { ... }
//   },
//   timestamp: 1704816000000
// });
```

### Example Code Item Structure

```javascript
// Example: A reusable utility code item
{
  id: "findRelatedItems",
  type: "code",
  created: 1704816000000,
  modified: 1704816000000,
  content: {
    code: `
      // Export functions that other code can use
      export function findRelatedItems(sourceItem) {
        // Query for direct relationships
        const direct = api.query({
          type: "relationship",
          "content.from": sourceItem.id
        });
        
        // Recursively find indirect relationships
        const indirect = direct.flatMap(rel => 
          findRelatedItems(rel.content.to)
        );
        
        return [...direct, ...indirect];
      }
      
      export function findBacklinks(targetItem) {
        return api.query({
          type: "relationship",
          "content.to": targetItem.id
        });
      }
    `
  }
}
```

### Example Renderer Using Code Item

```javascript
// Example: A renderer that uses the utility code
{
  id: "note_renderer_with_related",
  type: "renderer",
  content: {
    for_type: "note",
    code: `
      export async function render(item, api) {
        // Load the utility module
        const utils = await api.require("findRelatedItems");
        
        // Use its functions
        const related = utils.findRelatedItems(item);
        const backlinks = utils.findBacklinks(item);
        
        // Build UI
        return api.h("div", { class: "note" }, [
          api.h("h1", {}, [item.content.title]),
          api.h("div", { class: "content" }, [item.content.description]),
          api.h("div", { class: "related" }, [
            api.h("h2", {}, ["Related Items"]),
            ...related.map(r => renderRelatedItem(r))
          ]),
          api.h("div", { class: "backlinks" }, [
            api.h("h2", {}, ["Backlinks"]),
            ...backlinks.map(b => renderBacklink(b))
          ])
        ]);
      }
      
      function renderRelatedItem(rel) {
        return api.h("div", { class: "related-item" }, [
          rel.content.to // TODO: make this a link
        ]);
      }
      
      function renderBacklink(rel) {
        return api.h("div", { class: "backlink" }, [
          rel.content.from // TODO: make this a link
        ]);
      }
    `
  }
}
```

### Error Handling in Renderers

```javascript
async renderItem(item) {
  try {
    const renderer = await this.findRenderer(item.type);
    const rendererModule = await this.require(renderer.id);
    const api = this.createReadOnlyAPI();
    
    // Try to render
    const domNode = await rendererModule.render(item, api);
    return domNode;
    
  } catch (error) {
    // If rendering fails, show error in place
    return this.createElement('div', { class: 'render-error' }, [
      this.createElement('h3', {}, [`Error rendering ${item.id}`]),
      this.createElement('pre', {}, [error.message]),
      this.createElement('pre', {}, [error.stack]),
      this.createElement('button', {
        onclick: () => this.editItem(item.id)
      }, ['Edit Item'])
    ]);
  }
}
```

---

## 7. Code Sandboxing & Safety

### Module Evaluation with Dynamic Import

```javascript
async evaluateCodeItem(item, callStack = new Set()) {
  // Wrap code in strict mode
  const code = `
    "use strict";
    ${item.content.code}
  `;
  
  // Create a Blob URL for the module
  const blob = new Blob([code], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  
  try {
    // Dynamic import evaluates the module
    const module = await import(url);
    
    // Validate exports (optional, but recommended)
    this.validateModuleExports(module, item);
    
    return module;
    
  } catch (error) {
    // Make error more helpful
    throw new Error(`Failed to evaluate code item ${item.id}: ${error.message}`);
    
  } finally {
    // Clean up the blob URL
    URL.revokeObjectURL(url);
  }
}
```

### Module Export Validation

```javascript
validateModuleExports(module, item) {
  // Check that the module exports what we expect
  
  // For renderers, must export a render function
  if (item.type === "renderer" || 
      this.storage.typeChainIncludes(item.id, "renderer")) {
    if (typeof module.render !== "function") {
      throw new Error(
        `Renderer ${item.id} must export a 'render' function`
      );
    }
  }
  
  // For other code items, at least one export is expected
  if (Object.keys(module).length === 0) {
    console.warn(
      `Code item ${item.id} has no exports - this may be intentional`
    );
  }
}
```

### Safe Mode Implementation

```javascript
// In index.html, detect Shift key early
let shiftKeyPressed = false;

window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') {
    shiftKeyPressed = true;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') {
    shiftKeyPressed = false;
  }
});

// Then in kernel boot:
async boot() {
  await this.storage.initialize();
  await this.ensureSeedItems();
  
  // Check if Shift was held during page load
  if (window.shiftKeyPressed) {
    console.log("SAFE MODE: Booting with minimal kernel only");
    this.renderMinimalUI();
  } else {
    await this.renderCurrentView();
  }
}

renderMinimalUI() {
  document.body.innerHTML = `
    <div id="safe-mode">
      <h1>ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Safe Mode</h1>
      <p>Booted with minimal kernel only. No user code items loaded.</p>
      <p>Use this mode to fix broken code items.</p>
      
      <div class="actions">
        <button onclick="kernel.listAllItems()">
          View All Items
        </button>
        <button onclick="kernel.listCodeItems()">
          View Code Items Only
        </button>
        <button onclick="kernel.exitSafeMode()">
          Exit Safe Mode (Reload Normally)
        </button>
      </div>
      
      <div id="item-list"></div>
    </div>
  `;
}

async listCodeItems() {
  const codeItems = await this.storage.query({
    // Find items whose type chain includes "code"
    // Implementation depends on storage layer
  });
  
  const listEl = document.getElementById("item-list");
  listEl.innerHTML = codeItems.map(item => `
    <div class="item-preview">
      <strong>${item.id}</strong> (${item.type})
      <button onclick="kernel.editItemRaw('${item.id}')">
        Edit as JSON
      </button>
    </div>
  `).join('');
}

editItemRaw(itemId) {
  // Open a plain textarea editor for the item's JSON
  // This bypasses any custom renderers that might be broken
  const item = await this.storage.get(itemId);
  const json = JSON.stringify(item, null, 2);
  
  document.body.innerHTML = `
    <div class="raw-editor">
      <h2>Editing: ${itemId}</h2>
      <textarea id="raw-json" rows="30" cols="100">${json}</textarea>
      <button onclick="kernel.saveRawEdit('${itemId}')">Save</button>
      <button onclick="kernel.cancelRawEdit()">Cancel</button>
    </div>
  `;
}
```

### Protection Against Common Accidents

```javascript
// On kernel initialization, you could freeze some globals
// to make accidental breakage less likely

class Kernel {
  constructor() {
    this.protectGlobals();
    // ... rest of initialization
  }
  
  protectGlobals() {
    // Prevent accidental navigation
    try {
      Object.defineProperty(window, 'location', {
        configurable: false,
        writable: false
      });
    } catch (e) {
      // Some browsers don't allow this
      console.warn("Could not freeze window.location");
    }
    
    // Prevent accidental storage clearing
    const originalClear = localStorage.clear;
    localStorage.clear = function() {
      throw new Error(
        "localStorage.clear() is disabled. " +
        "Use kernel.clearStorage() if you really want to clear everything."
      );
    };
    
    // Could add more protections as needed
  }
}
```

**Note:** These protections are not bulletproof (they can be bypassed), but they make accidental breakage less likely.

---

## 7.5. External Libraries

Third-party JavaScript libraries are stored as code items, making them available offline.

### Manual Installation (MVP)

To use an external library:

1. Download the library's ES module or UMD bundle
2. Create a code item with type `library`
3. Paste source into `content.code`, wrapping if necessary

```javascript
// Example: Installing a UMD library as a code item
{
  id: crypto.randomUUID(),
  name: "moment",
  type: "00000000-0000-0000-0000-000000000004",  // library
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    code: `
      // UMD libraries need wrapping to export properly
      const moment = (function() {
        // ... paste entire moment.js source here ...
      })();
      
      export default moment;
    `
  }
}
```

### Usage in Code Items

```javascript
// In a renderer or library
export async function render(item, api) {
  const moment = await api.require('moment');
  const formatted = moment(item.content.date).format('MMMM Do YYYY');
  
  return api.h('div', {}, [
    api.h('span', {}, [`Created: ${formatted}`])
  ]);
}
```

### Future: Automated Installation

Build an `installLibrary` REPL function:

```javascript
// Add to REPL API
class Kernel {
  getReplAPI() {
    return {
      // ... other methods
      
      installLibrary: async ({ name, url, format = 'esm' }) => {
        // Fetch source (requires network)
        const response = await fetch(url);
        const source = await response.text();
        
        // Wrap based on format
        let code;
        if (format === 'umd') {
          code = `
            const ${name} = (function() {
              ${source}
            })();
            export default ${name};
          `;
        } else if (format === 'esm') {
          code = source;  // Already ES module
        } else if (format === 'iife') {
          code = `
            ${source}
            export default ${name};
          `;
        }
        
        // Create library item
        const item = {
          id: crypto.randomUUID(),
          name: name,
          type: "00000000-0000-0000-0000-000000000004",
          created: Date.now(),
          modified: Date.now(),
          children: [],
          content: { code }
        };
        
        await this.storage.set(item);
        return item.id;
      }
    };
  }
}
```

**Usage:**
```javascript
// In REPL (when online)
await api.installLibrary({
  name: 'lodash',
  url: 'https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/lodash.js',
  format: 'esm'
});

// Now available offline
const _ = await api.require('lodash');
```

### Library Format Notes

| Format | Example | Wrapping Required |
|--------|---------|-------------------|
| ES Module | lodash-es | None - use directly |
| UMD | moment.js | Wrap in IIFE, export default |
| IIFE | some-lib.min.js | Add export statement |
| CommonJS | node modules | Needs more complex shimming |

**Recommendation:** Prefer ES module versions when available. Most popular libraries now offer ESM builds.

---

## 8. Bootstrap and System Management

### Boot Sequence

```javascript
class Kernel {
  async boot() {
    // 1. Initialize storage layer
    await this.storage.initialize();
    
    // 2. Ensure seed items exist (self-healing)
    await this.ensureSeedItems();
    
    // 3. Check for safe mode
    if (this.isSafeMode()) {
      this.renderMinimalUI();
      return;
    }
    
    // 4. Render current view
    await this.renderCurrentView();
  }
}
```

### Seed Item Creation

Seed items are created in dependency order to avoid validation errors:

```javascript
const SEED_ITEMS = [
  // 1. atom - no dependencies (self-referential)
  {
    id: "00000000-0000-0000-0000-000000000000",
    name: "atom",
    type: "00000000-0000-0000-0000-000000000000",
    created: 0,
    modified: 0,
    content: {
      description: "The fundamental unit. Everything is an atom or derives from atom."
    }
  },
  
  // 2. type_definition - depends on atom
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "type_definition",
    type: "00000000-0000-0000-0000-000000000000",
    created: 0,
    modified: 0,
    content: {
      description: "Defines a type of item"
    }
  },
  
  // 3. code - depends on type_definition
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "code",
    type: "00000000-0000-0000-0000-000000000001",
    created: 0,
    modified: 0,
    content: {
      description: "Executable code. Items with this in their type chain are code items.",
      required_fields: ["code"]
    }
  },
  
  // 4. renderer - depends on code
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "renderer",
    type: "00000000-0000-0000-0000-000000000002",
    created: 0,
    modified: 0,
    content: {
      description: "Code that renders an item type",
      required_fields: ["for_type", "code"]
    }
  },
  
  // 5. library - depends on code
  {
    id: "00000000-0000-0000-0000-000000000004",
    name: "library",
    type: "00000000-0000-0000-0000-000000000002",
    created: 0,
    modified: 0,
    content: {
      description: "Reusable code module",
      required_fields: ["code"]
    }
  },
  
  // 6. default_renderer - depends on renderer
  {
    id: "00000000-0000-0000-0000-000000000005",
    name: "default_renderer",
    type: "00000000-0000-0000-0000-000000000003",
    created: 0,
    modified: 0,
    content: {
      for_type: "00000000-0000-0000-0000-000000000000",
      code: `
        export function render(item, api) {
          return api.h('pre', { class: 'json-view' }, [
            JSON.stringify(item, null, 2)
          ]);
        }
      `
    }
  },
  
  // 7. workspace - default root item, depends on atom
  {
    id: "00000000-0000-0000-0000-000000000006",
    name: "workspace",
    type: "00000000-0000-0000-0000-000000000000",
    created: 0,
    modified: 0,
    children: [],
    content: {
      title: "Workspace",
      description: "Default starting point. Add items here or navigate elsewhere."
    }
  }
];

async ensureSeedItems() {
  // Create seed items in dependency order
  // This avoids validation errors during bootstrap
  
  for (const seed of SEED_ITEMS) {
    const exists = await this.storage.exists(seed.id);
    
    if (!exists) {
      console.log(`Creating seed item: ${seed.name}`);
      
      // Set timestamps to current boot time
      const now = Date.now();
      const seedWithTimestamps = {
        ...seed,
        created: now,
        modified: now
      };
      
      await this.storage.set(seedWithTimestamps);
    } else {
      console.log(`Seed item already exists: ${seed.name}`);
    }
  }
}
```

**Important:** Seed items are created in this specific order because:
1. `atom` is self-referential and has no dependencies
2. `type_definition` references `atom`
3. `code` references `type_definition`
4. `renderer` and `library` reference `code`
5. `default_renderer` references `renderer`
6. `workspace` references `atom` (could be created earlier, but listed last for clarity)

Creating them out of order would cause type chain validation to fail.

### Export Functionality

```javascript
// Add to REPL API
class Kernel {
  getReplAPI() {
    return {
      // ... other API methods
      
      export: async () => {
        const items = await this.storage.getAll();
        const json = JSON.stringify(items, null, 2);
        
        // Download as file
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        return items.length;
      }
    };
  }
}
```

### Import Functionality

```javascript
// Add to REPL API
class Kernel {
  getReplAPI() {
    return {
      // ... other API methods
      
      import: async (json) => {
        const items = JSON.parse(json);
        let created = 0;
        let skipped = 0;
        
        for (const item of items) {
          // Merge strategy: skip items that already exist
          const exists = await this.storage.exists(item.id);
          
          if (!exists) {
            await this.storage.set(item);
            created++;
          } else {
            console.log(`Skipping existing item: ${item.id}`);
            skipped++;
          }
        }
        
        return { created, skipped };
      }
    };
  }
}
```

**Usage in REPL:**
```javascript
// Export all items
const count = await api.export();
console.log(`Exported ${count} items`);

// Import from JSON string
const json = `[{"id": "...", ...}]`;
const result = await api.import(json);
console.log(`Created ${result.created}, skipped ${result.skipped}`);
```

### System Reset

```javascript
// Add to REPL API (or Safe Mode UI)
class Kernel {
  getReplAPI() {
    return {
      // ... other API methods
      
      reset: async () => {
        const confirmed = confirm(
          'This will delete ALL data and recreate seed items. ' +
          'Are you sure? This cannot be undone.'
        );
        
        if (!confirmed) {
          return { cancelled: true };
        }
        
        // Clear all data
        const items = await this.storage.getAll();
        for (const item of items) {
          await this.storage.delete(item.id);
        }
        
        // Recreate seed items
        await this.ensureSeedItems();
        
        // Reload page
        window.location.reload();
      }
    };
  }
}
```

### Safe Mode Recovery

Safe mode provides access to these recovery functions when user code is broken:

```javascript
renderMinimalUI() {
  document.body.innerHTML = `
    <div id="safe-mode">
      <h1>ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Safe Mode</h1>
      <p>Booted with minimal kernel only. No user code items loaded.</p>
      
      <div class="actions">
        <button onclick="kernel.exportData()">
          Export All Data
        </button>
        <button onclick="kernel.resetSystem()">
          Reset System (Dangerous!)
        </button>
        <button onclick="kernel.exitSafeMode()">
          Exit Safe Mode
        </button>
      </div>
      
      <div id="item-list"></div>
    </div>
  `;
}

exportData() {
  // Same as api.export() but callable from safe mode UI
  this.storage.getAll().then(items => {
    const json = JSON.stringify(items, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safe-mode-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

resetSystem() {
  const confirmed = confirm(
    'WARNING: This will delete ALL your data!\n\n' +
    'Only the seed items will remain.\n\n' +
    'Have you exported your data? This cannot be undone!'
  );
  
  if (confirmed) {
    this.getReplAPI().reset();
  }
}

exitSafeMode() {
  window.location.reload();
}
```

---

## 9. Containers and Hierarchical Rendering

### Container Pattern

Containers are items that render other items. No special kernel support needed beyond what's already provided.

```javascript
// Example: Simple list container renderer
export function render(listContainer, api) {
  const childIds = listContainer.children || [];
  
  return api.h('div', { class: 'list-container' }, [
    api.h('h2', {}, [listContainer.content.title || 'Untitled List']),
    api.h('div', { class: 'items' }, 
      childIds.map(childId => api.renderItem(childId))
    ),
    api.h('button', {
      onclick: () => addNewItem(listContainer, api)
    }, ['+ Add Item'])
  ]);
}

async function addNewItem(container, api) {
  const newItem = {
    id: crypto.randomUUID(),
    type: 'note',  // Or whatever type is appropriate
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: { text: 'New item' }
  };
  
  await api.create(newItem, true);  // true = add as child
}
```

### Nested Container Example

```javascript
// Kanban board renders columns, columns render tasks
export function render(board, api) {
  const columnIds = board.children || [];
  
  return api.h('div', { class: 'kanban-board' }, [
    api.h('h1', {}, [board.content.title]),
    api.h('div', { class: 'columns' },
      columnIds.map(colId => api.renderItem(colId))
    ),
    api.h('button', {
      onclick: () => addColumn(board, api)
    }, ['+ Add Column'])
  ]);
}

// Column renderer (also a container)
export function render(column, api) {
  const taskIds = column.children || [];
  
  return api.h('div', { class: 'kanban-column' }, [
    api.h('input', {
      value: column.content.title,
      onchange: (e) => updateTitle(column, e.target.value, api)
    }),
    api.h('div', { class: 'tasks' },
      taskIds.map(taskId => api.renderItem(taskId))
    ),
    api.h('button', {
      onclick: () => addTask(column, api)
    }, ['+ Add Task'])
  ]);
}
```

### Child Management in API

The renderer API provides these operations for managing children:

```javascript
createRendererAPI(containerItem) {
  return {
    // ... other API methods
    
    // Add a child to this container
    addChild: async (childId) => {
      // Validate no cycle
      if (await this.wouldCreateCycle(containerItem.id, childId)) {
        throw new Error(
          `Adding ${childId} to ${containerItem.id} would create a cycle`
        );
      }
      
      const updated = {
        ...containerItem,
        children: [...(containerItem.children || []), childId],
        modified: Date.now()
      };
      
      await this.storage.set(updated);
    },
    
    // Remove a child from this container (item still exists)
    removeChild: async (childId) => {
      const updated = {
        ...containerItem,
        children: (containerItem.children || []).filter(id => id !== childId),
        modified: Date.now()
      };
      
      await this.storage.set(updated);
    },
    
    // Create a new item and optionally add as child
    create: async (item, addAsChild = true) => {
      // Ensure item has all required fields
      if (!item.children) {
        item.children = [];
      }
      
      await this.storage.set(item);
      
      if (addAsChild) {
        await this.addChild(containerItem.id, item.id);
      }
      
      return item.id;
    },
    
    // Delete item entirely (notifies all parents)
    delete: async (itemId) => {
      if (!await this.isDescendant(itemId, containerItem.id)) {
        throw new Error(
          `Cannot delete ${itemId} - not a descendant of ${containerItem.id}`
        );
      }
      
      // Find all parents before deleting
      const parentIds = await this.findAllParents(itemId);
      
      // Delete from storage
      await this.storage.delete(itemId);
      
      // Notify all parents
      for (const parentId of parentIds) {
        await this.notifyParent(parentId, 'onChildDeleted', itemId);
      }
    }
  };
}
```

### Cycle Detection Algorithm

```javascript
async wouldCreateCycle(parentId, newChildId) {
  // Adding newChildId to parentId's children
  // Creates cycle if we can reach parentId from newChildId
  
  async function canReach(fromId, toId, visited = new Set()) {
    if (fromId === toId) return true;
    if (visited.has(fromId)) return false;
    
    visited.add(fromId);
    
    try {
      const item = await this.storage.get(fromId);
      const children = item.children || [];
      
      for (const childId of children) {
        if (await canReach(childId, toId, visited)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      // Item doesn't exist, no path through it
      return false;
    }
  }
  
  return await canReach(newChildId, parentId);
}
```

### Finding All Parents

```javascript
async findAllParents(itemId) {
  const allItems = await this.storage.getAll();
  return allItems
    .filter(item => item.children?.includes(itemId))
    .map(item => item.id);
}
```

**Note:** This is O(n) but acceptable for personal use. Can be optimized with a parent index if needed.

### Descendant Checking

```javascript
async isDescendant(itemId, ancestorId) {
  // Check if itemId is in ancestorId's descendant tree
  
  async function checkRecursive(checkId, targetId, visited = new Set()) {
    if (checkId === targetId) return true;
    if (visited.has(checkId)) return false;
    
    visited.add(checkId);
    
    try {
      const item = await this.storage.get(checkId);
      const children = item.children || [];
      
      for (const childId of children) {
        if (await checkRecursive(childId, targetId, visited)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
  
  return await checkRecursive(ancestorId, itemId);
}
```

---

## 10. Lifecycle Hooks and Reactivity

### Subscription Management

The kernel maintains subscriptions between parents and children:

```javascript
class SubscriptionManager {
  constructor() {
    // Map: childId -> Set<parentId>
    this.subscriptions = new Map();
  }
  
  subscribe(parentId, childId) {
    if (!this.subscriptions.has(childId)) {
      this.subscriptions.set(childId, new Set());
    }
    this.subscriptions.get(childId).add(parentId);
  }
  
  unsubscribe(parentId, childId) {
    const parents = this.subscriptions.get(childId);
    if (parents) {
      parents.delete(parentId);
      if (parents.size === 0) {
        this.subscriptions.delete(childId);
      }
    }
  }
  
  getParents(childId) {
    return Array.from(this.subscriptions.get(childId) || []);
  }
  
  unsubscribeAll(itemId) {
    // When an item is deleted, clean up all its subscriptions
    this.subscriptions.delete(itemId);
    
    // Also remove it as a parent from other subscriptions
    for (const [childId, parents] of this.subscriptions.entries()) {
      parents.delete(itemId);
    }
  }
}
```

### Rendering with Automatic Subscription

```javascript
async renderItem(itemId, rendererName) {
  const item = await this.storage.get(itemId);
  
  // Subscribe this item to all its children
  (item.children || []).forEach(childId => {
    this.subscriptions.subscribe(itemId, childId);
  });
  
  // Find and execute renderer
  const renderer = await this.findRenderer(item.type, rendererName);
  const rendererModule = await this.require(renderer.id);
  const api = this.createRendererAPI(item);
  
  return await rendererModule.render(item, api);
}
```

### Change Notification

```javascript
async onItemChanged(itemId) {
  const item = await this.storage.get(itemId);
  
  // Find all parents subscribed to this item
  const parentIds = this.subscriptions.getParents(itemId);
  
  // Notify each parent
  for (const parentId of parentIds) {
    await this.notifyParentOfChange(parentId, item);
  }
}

async notifyParentOfChange(parentId, changedChild) {
  try {
    const parent = await this.storage.get(parentId);
    const renderer = await this.findRenderer(parent.type);
    const rendererModule = await this.require(renderer.id);
    
    // Call lifecycle hook if it exists
    if (rendererModule.onChildChanged) {
      const api = this.createRendererAPI(parent);
      await rendererModule.onChildChanged(changedChild, api);
    }
    
    // Automatically re-render the parent
    await this.reRenderItem(parentId);
    
  } catch (error) {
    console.error(`Error notifying parent ${parentId}:`, error);
  }
}
```

### Deletion Notification

```javascript
async onItemDeleted(itemId) {
  // Find all parents before cleanup
  const parentIds = await this.findAllParents(itemId);
  
  // Notify each parent
  for (const parentId of parentIds) {
    await this.notifyParentOfDeletion(parentId, itemId);
  }
  
  // Clean up subscriptions
  this.subscriptions.unsubscribeAll(itemId);
}

async notifyParentOfDeletion(parentId, deletedChildId) {
  try {
    const parent = await this.storage.get(parentId);
    const renderer = await this.findRenderer(parent.type);
    const rendererModule = await this.require(renderer.id);
    
    // Call lifecycle hook if it exists
    if (rendererModule.onChildDeleted) {
      const api = this.createRendererAPI(parent);
      await rendererModule.onChildDeleted(deletedChildId, api);
    }
    
    // Automatically re-render the parent
    await this.reRenderItem(parentId);
    
  } catch (error) {
    console.error(`Error notifying parent ${parentId}:`, error);
  }
}
```

### Example Lifecycle Hook Implementation

```javascript
// In a kanban board renderer
export function render(board, api) {
  // ... rendering code
}

export function onChildChanged(column, api) {
  // A column was modified
  // Could update aggregate statistics, show notification, etc.
  console.log(`Column ${column.id} was modified`);
  
  // No need to explicitly re-render - happens automatically
}

export function onChildDeleted(columnId, api) {
  // A column was deleted
  // Could show undo notification, log the deletion, etc.
  console.log(`Column ${columnId} was deleted`);
  
  // Note: The board will re-render automatically
  // The deleted column will no longer appear in children array
}
```

---

## 11. Navigation and URL Management

### Boot with URL Parameter

```javascript
class Kernel {
  async boot() {
    await this.storage.initialize();
    await this.ensureSeedItems();
    
    if (this.isSafeMode()) {
      this.renderMinimalUI();
      return;
    }
    
    // Get root from URL or use default
    const rootId = this.getRootFromURL();
    await this.renderRoot(rootId);
    
    // Set up browser history handling
    this.setupHistoryHandling();
  }
  
  getRootFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('root') || '00000000-0000-0000-0000-000000000006';  // workspace
  }
  
  setupHistoryHandling() {
    window.addEventListener('popstate', async (event) => {
      const rootId = this.getRootFromURL();
      await this.renderRoot(rootId);
    });
  }
}
```

### Navigation Helper

```javascript
async navigateToItem(itemId) {
  // Update URL
  const url = new URL(window.location);
  url.searchParams.set('root', itemId);
  window.history.pushState({ itemId }, '', url);
  
  // Render new root
  await this.renderRoot(itemId);
}

async renderRoot(itemId) {
  try {
    const item = await this.storage.get(itemId);
    const domNode = await this.renderItem(itemId);
    
    // Replace main container
    const mainContainer = document.getElementById('main-view');
    mainContainer.innerHTML = '';
    mainContainer.appendChild(domNode);
    
    // Store current root for reference
    this.currentRoot = itemId;
    
  } catch (error) {
    console.error(`Failed to render root ${itemId}:`, error);
    this.showError(error, itemId);
  }
}
```

### Exposing Navigation to Renderers

The API can include navigation helpers:

```javascript
createRendererAPI(containerItem) {
  return {
    // ... other API methods
    
    // Navigate to a different root item
    navigate: (itemId) => {
      return this.navigateToItem(itemId);
    },
    
    // Get current root item ID
    getCurrentRoot: () => {
      return this.currentRoot;
    }
  };
}
```

### Example Usage in Renderer

```javascript
// Navigate when clicking an item
export function render(list, api) {
  const items = list.children || [];
  
  return api.h('div', { class: 'item-list' }, 
    items.map(itemId => 
      api.h('button', {
        onclick: async () => {
          await api.navigate(itemId);
        }
      }, [await getItemTitle(itemId)])
    )
  );
}

// Or create a proper link with href
export function render(list, api) {
  const items = list.children || [];
  
  return api.h('div', { class: 'item-list' },
    items.map(itemId =>
      api.h('a', {
        href: `?root=${itemId}`,
        onclick: (e) => {
          e.preventDefault();
          api.navigate(itemId);
        }
      }, [await getItemTitle(itemId)])
    )
  );
}
```

---

## 12. Container Pattern Implementation

### Two-Step Child Creation

Containers use a simplified two-step flow:
1. Click "Add Child" → blank child appears immediately
2. Click the child → navigate to it for editing

This avoids the complexity of "creation mode" while maintaining immediate feedback.

### Container Renderer Example

```javascript
export function render(container, api) {
  const containerDiv = api.h('div', { class: 'container-view' }, []);
  
  // Header with title and add button
  const header = api.h('div', {}, [
    api.h('h2', {}, [container.content.title || 'Untitled']),
    api.h('button', {
      onclick: async () => {
        await api.createChild(api.IDS.CONTAINER, {
          title: 'New Container'
        });
      }
    }, ['+ Add Container'])
  ]);
  containerDiv.appendChild(header);
  
  // Render children recursively
  const childIds = container.children || [];
  for (const childId of childIds) {
    const childNode = await api.renderItem(childId);
    containerDiv.appendChild(childNode);
  }
  
  return containerDiv;
}
```

### createChild API

The renderer API provides a simplified child creation method:

```javascript
createChild: async (type, content = {}) => {
  const newItem = {
    type,
    content,
    children: []
  };
  const id = await api.create(newItem, true);  // true = add as child
  return id;
}
```

**Usage:**
```javascript
// Create a container as a child
const id = await api.createChild(api.IDS.CONTAINER, {
  title: 'My New Container'
});

// Create any type
const noteId = await api.createChild('note-type-guid', {
  text: 'New note',
  tags: []
});
```

**What Happens:**
1. Item is created with generated ID and timestamps
2. Item is added to parent's `children` array
3. Parent's `modified` timestamp is updated
4. Reactivity system triggers parent re-render
5. New child appears immediately

### Recursive Rendering

Containers render their children by calling `api.renderItem()`:

```javascript
for (const childId of container.children) {
  try {
    const childNode = await api.renderItem(childId);
    parentElement.appendChild(childNode);
  } catch (error) {
    // Handle broken child references
    const errorNode = api.h('div', { class: 'error' }, [
      `Error rendering ${childId}: ${error.message}`
    ]);
    parentElement.appendChild(errorNode);
  }
}
```

**Notes:**
- Each child is rendered with its own appropriate renderer
- Recursion depth is unlimited (containers can contain containers)
- Each child's renderer receives the standard API
- Broken references are caught and displayed gracefully

### Container Type Hierarchy

```
atom
  └─ container (type: atom)
       └─ workspace (type: container)
```

The `container` type is a basic type (type: atom) like any other. The workspace is an instance of container. Users can create other container types that inherit from container if they want specialized behavior.

---

## Implementation Status

Sections marked with *(to be added)* will be populated as we design those parts of the system.

| Section | Status |
|---------|--------|
| 1. Data Model & Storage API | Complete |
| 2. Kernel Architecture | Complete |
| 3. Technology Stack | To be added |
| 4. Seed Items | Complete |
| 5. Renderer System | Complete |
| 6. Code Execution | Complete |
| 7. Code Sandboxing | Complete |
| 7.5. External Libraries | Complete |
| 8. Bootstrap & System Management | Complete |
| 9. Containers & Hierarchical Rendering | Complete |
| 10. Lifecycle Hooks & Reactivity | Complete |
| 11. Navigation & URL Management | Complete |
| 12. Container Pattern Implementation | Complete |

---

## Notes on Code Style

All examples use:
- **Async/await** for asynchronous operations
- **ES6 modules** with `export`/`import`
- **Arrow functions** where appropriate
- **Template literals** for multi-line strings
- **Descriptive variable names** over brevity

These are suggestions, not requirements. Adapt to your preferences.
