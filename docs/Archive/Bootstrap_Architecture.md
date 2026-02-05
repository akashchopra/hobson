# Hobson Bootstrap Architecture

*Created: 2026-01-19*

---

## Overview

This document describes Hobson's bootstrap architecture, where the kernel is decomposed into modules stored as items, loaded by a minimal bootloader. This enables:

1. **Self-documentation** - kernel code is linkable from documentation
2. **Self-modification** - kernel can be edited from within Hobson
3. **Self-hosting** - Hobson instances can run within Hobson
4. **Theoretical completeness** - the system defines itself in terms of itself

---

## Architecture Components

### 1. Bootstrap HTML (~100 lines)

A minimal, stable bootloader file (`bootstrap.html`) that:
- Opens IndexedDB
- Checks for `kernel-core` item
- If missing, shows import UI
- If present, loads and boots the kernel
- Never changes after deployment

### 2. Kernel Modules (items)

The kernel decomposed into ~8 modules, each stored as an item:

- **kernel-styles** - All CSS
- **kernel-storage** - IndexedDB wrapper
- **kernel-viewport** - View state management
- **kernel-module-system** - Require/eval for user code
- **kernel-rendering** - Item rendering system
- **kernel-repl** - REPL interface
- **kernel-safe-mode** - Recovery/debugging UI
- **kernel-core** - Main kernel composition

### 3. Self-Loading Pattern

`kernel-core` exports a `loadKernel(require)` function that:
- Takes a require function as parameter
- Loads all dependencies using that require
- Composes and returns the Kernel class

This decouples kernel loading from storage location.

---

## Bootstrap Process

### Top-Level Boot (First Run)

```
1. User opens bootstrap.html
2. Bootstrap checks IndexedDB for kernel-core
3. Not found → Show import UI
4. User imports initial-kernel.json (contains all kernel modules + seeds)
5. Bootstrap reloads
```

### Top-Level Boot (Subsequent Runs)

```
1. Bootstrap opens IndexedDB
2. Creates minimal require function:
   - Loads item from IndexedDB
   - Creates blob URL from code
   - Dynamic import() as ES module
   - Caches result
3. Loads kernel-core module
4. Calls loadKernel(require)
5. Instantiates and boots Kernel
6. Renders to DOM
```

### Nested Boot (Hobson-in-Hobson)

```
1. User creates empty hobson-instance item
2. User navigates to it
3. hobson-instance renderer executes:
   - Creates storage adapter that prefixes IDs
   - Attempts to load kernel-core (resolves to instance-abc:kernel-core)
   - Not found → shows import UI
4. User imports kernel.json file
5. Items stored with instance-abc: prefix
6. Renderer re-renders
7. Now kernel-core exists → bootKernel succeeds
8. Calls loadKernel(require)
9. Boots kernel
10. Returns kernel's root element
11. Child Hobson renders inside parent
```

**Key insight:** This is identical to top-level bootstrap, just with a storage adapter that transparently prefixes IDs.

---

## Module Structure

### Module Granularity

**Chosen level: Major subsystems (6-8 modules)**

Each module represents a cohesive subsystem:
- Large enough to be conceptually meaningful
- Small enough to be comprehensible (~100-500 lines)
- Maps to architectural boundaries

**Not chosen:**
- Coarser (monolithic kernel) - loses documentation linking
- Finer (function-level) - too much coordination overhead

### Module Format

Each kernel module is an ES module item:

```javascript
// Item: kernel-storage
{
  id: 'kernel-storage',
  type: 'kernel-module',
  name: 'Storage',
  content: {
    code: `
      export class Storage {
        constructor() {
          this.dbName = 'hobson';
          this.storeName = 'items';
        }
        
        async get(id) { /* ... */ }
        async set(item) { /* ... */ }
        async query(criteria) { /* ... */ }
        // ...
      }
    `
  }
}
```

### Dependency Pattern

Modules receive dependencies via constructor (dependency injection):

```javascript
// kernel-rendering module
export class RenderingSystem {
  constructor(kernel) {
    this.kernel = kernel;
  }
  
  async renderItem(itemId) {
    // Access other subsystems via kernel
    const item = await this.kernel.storage.get(itemId);
    const module = await this.kernel.moduleSystem.require(id);
    // ...
  }
}
```

**Rationale:**
- Kernel modules are a cohesive unit, not independent libraries
- Avoids circular import problems
- Makes coordination explicit
- Kernel acts as dependency container

### kernel-core Structure

The main composition module:

```javascript
export async function loadKernel(require) {
  // Load all subsystem modules
  const {Storage} = await require('kernel-storage');
  const {Viewport} = await require('kernel-viewport');
  const {ModuleSystem} = await require('kernel-module-system');
  const {RenderingSystem} = await require('kernel-rendering');
  const {REPL} = await require('kernel-repl');
  const {SafeMode} = await require('kernel-safe-mode');
  
  // Compose kernel
  class Kernel {
    constructor() {
      this.storage = new Storage();
      this.viewport = new Viewport(this.storage);
      this.moduleSystem = new ModuleSystem(this.storage);
      this.rendering = new RenderingSystem(this);
      this.repl = new REPL(this);
      this.safeMode = new SafeMode(this);
      
      this.rootElement = document.createElement('div');
      this.rootElement.id = 'app';
    }
    
    async boot() { /* ... */ }
    async renderRoot() { /* ... */ }
    
    reloadKernel() {
      window.parent.postMessage({type: 'reload-kernel'}, '*');
    }
  }
  
  return Kernel;
}
```

**Key properties:**
- Slim - mostly composition
- Single entry point
- Heavy logic in specialized modules
- Explicit about what constitutes "the kernel"

---

## Self-Hosting

### Creating Nested Instances

Creating a nested Hobson instance follows the same pattern as the top-level bootstrap:

1. Create an empty `hobson-instance` item
2. Navigate to it
3. Renderer attempts to boot kernel (finds no kernel due to ID prefixing)
4. Shows import UI (identical to top-level bootstrap)
5. User imports kernel JSON
6. Items stored with instance prefix
7. Kernel boots

**User workflow:**
```javascript
// In REPL - create empty instance
await api.storage.set({
  id: 'my-experiment',
  type: 'hobson-instance',
  name: 'Kernel Experiments'
});

// Navigate to it
api.viewport.select('my-experiment');

// Renderer shows import UI → user imports kernel.json
// Nested Hobson boots
```

This approach is architecturally elegant: **nested instances work exactly like top-level Hobson**, just with prefixed storage.

### hobson-instance Renderer

```javascript
export async function render(item, api) {
  const instanceId = item.id;
  
  // Create storage adapter with ID prefixing
  const storageAdapter = {
    async get(id) {
      return api.get(`${instanceId}:${id}`);
    },
    async set(item) {
      return api.update({
        ...item,
        id: `${instanceId}:${item.id}`
      });
    },
    async query(criteria) {
      // Query with prefix, strip prefix from results
      const results = await api.storage.query({
        ...criteria,
        idPrefix: `${instanceId}:`
      });
      return results.map(item => ({
        ...item,
        id: item.id.replace(`${instanceId}:`, '')
      }));
    }
  };
  
  // Try to boot kernel
  try {
    const kernel = await bootKernel(storageAdapter);
    await kernel.boot();
    return kernel.rootElement;
  } catch (error) {
    // Kernel not found - show import UI (same as top-level bootstrap)
    return createImportUI(instanceId, api);
  }
}

function createImportUI(instanceId, api) {
  const container = document.createElement('div');
  container.innerHTML = `
    <h1>Import Kernel</h1>
    <p>This Hobson instance needs a kernel.</p>
    <input type="file" accept=".json">
  `;
  
  const input = container.querySelector('input');
  input.onchange = async (e) => {
    const items = JSON.parse(await e.target.files[0].text());
    
    // Store all items with instance prefix
    for (const item of items) {
      await api.storage.set({
        ...item,
        id: `${instanceId}:${item.id}`
      });
    }
    
    // Trigger re-render
    await api.update(api.getCurrentItem());
  };
  
  return container;
}

async function bootKernel(storageAdapter) {
  // Create require using storage adapter
  const moduleCache = new Map();
  
  async function require(itemId) {
    if (moduleCache.has(itemId)) {
      return moduleCache.get(itemId);
    }
    
    const item = await storageAdapter.get(itemId);
    if (!item?.content?.code) {
      throw new Error(`Kernel module not found: ${itemId}`);
    }
    
    const code = `"use strict";\n${item.content.code}`;
    const blob = new Blob([code], {type: 'application/javascript'});
    const url = URL.createObjectURL(blob);
    
    try {
      const module = await import(url);
      moduleCache.set(itemId, module);
      return module;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  
  // Bootstrap kernel (same pattern as top-level)
  const {loadKernel} = await require('kernel-core');
  const Kernel = await loadKernel(require);
  return new Kernel();
}
```

### Storage Isolation

Child Hobson's items are stored in parent's IndexedDB with prefixed IDs.

**After user creates instance and imports kernel:**

**Parent's storage:**
```
kernel-core              (parent's kernel)
kernel-storage           (parent's kernel)
note-123                 (parent's data)
instance-abc             (nested instance marker - just the item)
instance-abc:kernel-core (child's kernel - imported by user)
instance-abc:kernel-storage
instance-abc:note-456    (child's data - created by child)
```

**Child sees (via storageAdapter):**
```
kernel-core              (transparently maps to instance-abc:kernel-core)
kernel-storage
note-456
```

The child instance is unaware of the prefixing - it's completely transparent.

### Key Properties

1. **Uniform bootstrap** - nested uses same pattern as top-level
2. **True isolation** - child can't access parent's items
3. **Shared format** - no special storage mechanism needed
4. **Self-contained** - child imports its own complete kernel + data
5. **Queryable** - parent can find all child items by prefix
6. **Exportable** - export child by filtering on prefix
7. **No hierarchy limit** - child can contain its own attachments
8. **User controls import** - can import minimal, full, or custom kernel

---

## Kernel Modification and Reload

### Modifying Kernel

User edits a kernel module (e.g., `kernel-rendering`):

```javascript
// In REPL
const rendering = await api.get('kernel-rendering');
rendering.content.code = `
  export class RenderingSystem {
    // ... modified implementation
  }
`;
await api.update(rendering);

// Reload to apply changes
api.reloadKernel();
```

### Reload Process

```javascript
// In Kernel class
reloadKernel() {
  if (window.parent === window) {
    // Top-level: message to bootstrap
    window.postMessage({type: 'reload-kernel'}, '*');
  } else {
    // Nested: message to parent
    window.parent.postMessage({
      type: 'reload-child-kernel',
      instanceId: this.instanceId
    }, '*');
  }
}
```

```javascript
// In bootstrap
window.addEventListener('message', async (e) => {
  if (e.data.type === 'reload-kernel') {
    // Clear cache
    moduleCache.clear();
    
    // Clear DOM
    document.getElementById('root').innerHTML = '';
    
    // Re-boot
    await boot();
  }
});
```

**Note:** All runtime state is lost on reload. To preserve state:
- Persist critical state to items before reload
- Restore from items after boot

---

## Documentation Linking

### Problem Solved

Documentation can reference actual kernel code:

```markdown
## Rendering System

When an item changes, Hobson calls 
[renderItem()](item:kernel-rendering#renderItem)
which determines the renderer based on item type.

The full rendering system is in 
[kernel-rendering](item:kernel-rendering).
```

### Implementation

Links use format: `item:MODULE_ID#FUNCTION_NAME`

Item viewer:
1. Recognizes `item:` link
2. Loads specified module
3. Parses code to find function
4. Displays with syntax highlighting
5. Optionally scrolls to function
6. Can edit directly

### Granularity Trade-off

**Module-level linking:** Can link to entire modules
**Function-level anchors:** Parse code to jump to functions

We chose module-level items with function-level anchors because:
- Modules are the right granularity for editing
- Functions are the right granularity for documentation
- Parsing is simpler than managing 100+ item dependencies

---

## Distribution

### File Structure

```
bootstrap.html           (~100 lines, never changes)
initial-kernel.json      (all kernel modules + seeds)
```

### initial-kernel.json Contents

```json
[
  {
    "id": "kernel-core",
    "type": "kernel-module",
    "name": "Core",
    "content": {
      "code": "export async function loadKernel(require) { ... }"
    },
    "created": 1234567890,
    "modified": 1234567890
  },
  {
    "id": "kernel-storage",
    "type": "kernel-module",
    "name": "Storage",
    "content": {
      "code": "export class Storage { ... }"
    },
    "created": 1234567890,
    "modified": 1234567890
  },
  // ... all other kernel modules
  // ... all seed items (types, renderers, etc.)
]
```

### First Run

1. User opens `bootstrap.html`
2. No kernel in IndexedDB → import UI shown
3. User selects `initial-kernel.json`
4. All items imported
5. Page reloads
6. Bootstrap finds kernel and runs

### Updates

To update the kernel for users:
1. Export modified kernel modules
2. Distribute new JSON file
3. Users import (overwrites old modules)
4. Kernel reloads with new code

---

## Migration Path

### From Current Monolithic Kernel

1. **Extract modules** - split current `hobson.html` into modules
2. **Test independently** - ensure each module works
3. **Create kernel-core** - compose modules with `loadKernel()`
4. **Write bootstrap** - minimal bootloader
5. **Generate initial-kernel.json** - export to JSON
6. **Test bootstrap** - verify it boots correctly
7. **Implement reload** - test kernel modification
8. **Create hobson-instance** - test self-hosting

### Extraction Strategy

Start with largest/most isolated subsystems:
1. Storage (no dependencies)
2. Viewport (depends on Storage)
3. ModuleSystem (depends on Storage)
4. SafeMode (depends on Storage)
5. REPL (depends on ModuleSystem)
6. Rendering (depends on Storage, ModuleSystem)
7. Core (composes everything)

### Testing at Each Step

After extracting each module:
- Does it export expected interface?
- Can kernel-core load it?
- Does functionality still work?
- Run existing items/renderers

---

## Design Rationales

### Why Decompose the Kernel?

**Problem:** Monolithic kernel prevents:
- Linking to specific kernel code from docs
- Fine-grained kernel modification
- Self-hosting (kernel can't be "just another item")

**Solution:** Bootstrap architecture

**Benefits:**
- Documentation can reference live code
- Kernel is modifiable like any other code
- Enables Hobson-in-Hobson
- Achieves "theoretical completeness"

**Cost:**
- More complex bootstrap
- Module coordination needed
- Migration effort

**Decision:** Benefits outweigh costs for this project

### Why Self-Loading Pattern?

**Alternatives considered:**

1. **Explicit dependency metadata**
   ```javascript
   {
     id: 'kernel-viewport',
     dependencies: ['kernel-storage']
   }
   ```
   - Pro: Dependencies visible in data
   - Con: Duplicate declaration (in data + code)

2. **Convention-based loading**
   - Bootstrap hardcodes load order
   - Pro: Simple
   - Con: Brittle, doesn't scale to nested instances

3. **Self-loading (chosen)**
   - kernel-core declares dependencies in code
   - Pro: Single source of truth
   - Pro: Same pattern for top-level and nested
   - Pro: Kernel manages its own composition

### Why Module-Level Granularity?

**Alternatives:**

- **Coarser:** One kernel item
  - Can't link to specific functions
  - All-or-nothing editing
  
- **Finer:** Function-level items
  - 100+ items to coordinate
  - Complex dependency management
  - Overkill for documentation

- **Module-level (chosen):**
  - 6-8 manageable items
  - Can still link to functions via parsing
  - Natural architectural boundaries

### Why ID Prefixing for Nested Instances?

**Alternatives:**

1. **Separate databases**
   ```javascript
   indexedDB.open('hobson-child-' + instanceId)
   ```
   - Pro: True isolation
   - Con: Can't query across instances
   - Con: Export/backup is complex

2. **Single database with namespacing (chosen)**
   ```javascript
   'instance-abc:kernel-core'
   ```
   - Pro: All data in one place
   - Pro: Can query/export by prefix
   - Pro: Simpler backup
   - Con: Needs storage adapter

3. **Iframe with separate origin**
   - Pro: Browser-enforced isolation
   - Con: Heavy weight
   - Con: Complex communication

---

## Open Questions

### 1. Should Bootstrap Be an Item?

Could make bootstrap.html even smaller:

```html
<!DOCTYPE html>
<script>
// Load 'bootstrap' item
// Execute it
</script>
```

**Pros:**
- Bootstrap itself is modifiable
- True "items all the way down"

**Cons:**
- Chicken-and-egg: how does minimal bootstrap load itself?
- Need fallback bootstrap hardcoded
- Adds complexity for unclear benefit

**Current decision:** Keep bootstrap as static file

### 2. Should Nested Instances Use Iframe?

Current: Child renders in parent's DOM

**Alternative:** Render in iframe
- Stronger isolation
- Separate JS context
- Can't accidentally access parent

**Trade-offs:**
- Iframe adds complexity
- Communication via postMessage
- Heavier weight

**Current decision:** Same DOM initially, iframe later if needed

### 3. How to Handle Kernel Versioning?

When parent has kernel v2 but child has kernel v1:
- Should child auto-upgrade?
- Should child stay at v1?
- Should user choose?

**Current decision:** Child stays at version it was created with

### 4. Should Styles Be a Module?

Currently planned: `kernel-styles` as separate item

**Alternative:** Inline in kernel-core or HTML template

**Decision:** Separate item for consistency with other kernel modules

---

## Success Criteria

This architecture succeeds if:

1. ✅ Kernel code can be linked from documentation
2. ✅ Kernel modules can be edited from within Hobson
3. ✅ Edits take effect after reload
4. ✅ Nested Hobson instances can be created
5. ✅ Nested instances are fully functional
6. ✅ Nested instances can contain nested instances (recursive)
7. ✅ Bootstrap is stable (never needs updates)
8. ✅ Distribution is two files (bootstrap + JSON)
9. ✅ Migration from current kernel is feasible

---

## Next Steps

1. Extract first module (Storage) from current kernel
2. Test in isolation
3. Create minimal kernel-core that uses it
4. Write bootstrap that loads kernel-core
5. Iterate through remaining modules
6. Test reload functionality
7. Implement hobson-instance type and renderer
8. Test nested instance creation
9. Document kernel module API
10. Update user-facing docs

---

## References

- Current kernel implementation: `/mnt/project/hobson.html`
- Design Decisions Log: `/mnt/project/Design_Decisions_Log.md`
- Technical Implementation Notes: `/mnt/project/Technical_Implementation_Notes.md`
- This conversation starting with: "I'm curious about how far I could push the capabilities of Hobson..."
