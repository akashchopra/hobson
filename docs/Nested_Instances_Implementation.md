# Nested Instances Implementation

## Overview

Nested Hobson instances allow running a complete, isolated Hobson kernel within a parent Hobson instance. Storage isolation is achieved through ID prefixing at the database level.

## Architecture

### Storage Isolation

All items in a nested instance are stored in the parent's IndexedDB with prefixed IDs:
- Parent item: `kernel-core` → ID: `33333333-1111-0000-0000-000000000000`
- Nested item: `kernel-core` → ID: `{instanceId}:33333333-1111-0000-0000-000000000000`

The storage adapter transparently strips/adds prefixes, making isolation invisible to the nested kernel.

### Kernel Bootstrap

Nested kernels use the same bootstrap process as top-level:
1. `loadKernel(require, storageBackend)` accepts optional custom require function and storage backend
2. Custom `require` loads modules from prefixed IDs
3. Storage backend wraps all operations with ID prefixing
4. Nested kernel is unaware of prefixing

## Implementation

### Modified Items

#### 1. kernel-core (33333333-1111-0000-0000-000000000000)

**Changes:**
- `loadKernel()` signature: `async function loadKernel(require, storageBackend)`
- If `require` not provided, uses direct IndexedDB loading (backwards compatible)
- Passes `storageBackend` to `Storage` constructor
- `navigateToItem()`: Clears renderer override only when navigating to different item (prevents renderer sticking across navigations)

**Key code:**
```javascript
export async function loadKernel(require, storageBackend) {
  // If no require provided, use direct IndexedDB loading
  if (!require) {
    require = async function loadModule(itemId) {
      // ... direct IndexedDB access
    };
  }

  const { Storage } = await require(IDS.KERNEL_STORAGE);
  // ...

  class Kernel {
    constructor() {
      this.storage = new Storage(storageBackend);
      // ...
    }
  }
}
```

#### 2. kernel-storage (33333333-2222-0000-0000-000000000000)

**Changes:**
- Constructor accepts optional `backend` parameter
- All methods delegate to backend if provided, otherwise use direct IndexedDB
- Name uniqueness validation is namespace-aware (checks prefix before colon)

**Key code:**
```javascript
export class Storage {
  constructor(backend) {
    this.backend = backend;
    if (!backend) {
      // Direct IndexedDB mode
    }
  }

  async get(id) {
    if (this.backend) {
      return this.backend.get(id);
    }
    // Direct IndexedDB
  }

  async _validateItem(item, kernel) {
    // Name uniqueness only within same namespace
    const itemNamespace = item.id.includes(':') ? item.id.split(':')[0] : '';
    // Only conflict if same namespace
  }
}
```

### New Items

#### 3. hobson-instance type (99999999-0000-0000-0000-000000000000)

Type definition for nested instances. Inherits from `type_definition`.

#### 4. hobson-instance-renderer (99999999-1111-0000-0000-000000000000)

Renders a nested Hobson instance.

**Implementation:**

1. **Storage Backend**: Creates adapter that prefixes all IDs
```javascript
const storageBackend = {
  async get(id) {
    return await api.get(`${instanceId}:${id}`);
  },
  async set(item) {
    return await api.set({...item, id: `${instanceId}:${item.id}`});
  },
  // ... query, getAll also handle prefixing
};
```

2. **Custom Require**: Loads modules from prefixed storage
```javascript
const require = async function(moduleId) {
  const item = await api.get(`${instanceId}:${moduleId}`);
  // Evaluate as ES module via blob URL
};
```

3. **Bootstrap**: Boots nested kernel
```javascript
const { loadKernel } = await require(KERNEL_CORE_ID);
const Kernel = await loadKernel(require, storageBackend);
const kernel = new Kernel();
await kernel.boot();
```

4. **UI**:
   - Blue border indicating nested instance
   - "Toggle REPL" button in header (keyboard shortcuts conflict with parent)
   - Import UI if kernel not found

## Known Issues

1. **REPL Display**: Both parent and nested REPLs render but have CSS display issues. Manual styling via console works but doesn't persist across refreshes.

2. **Navigation**: Parent kernel navigation (`api.navigate()`) may not work reliably after viewing nested instances.

3. **Keyboard Shortcuts**: Nested kernel's Esc/Ctrl+\ listeners attach to global `document`, conflicting with parent. Button workaround implemented.

4. **Safe Mode**: Shows all items including prefixed nested items, causing visual duplication.

5. **Export**: Safe mode export may not trigger file download correctly.

## Testing

Create nested instance:
```javascript
const id = crypto.randomUUID();
await api.set({
  id,
  name: "Test Nested Instance",
  type: "99999999-0000-0000-0000-000000000000",
  attachments: [],
  content: {}
});
await api.navigate(id);
```

Navigate directly: `?root={instance-id}`

Import kernel when prompted, click "Boot Kernel", use "Toggle REPL" button.

## Files Modified

- `src/items/33333333-1111-0000-0000-000000000000.json` (kernel-core)
- `src/items/33333333-2222-0000-0000-000000000000.json` (kernel-storage)

## Files Created

- `src/items/99999999-0000-0000-0000-000000000000.json` (hobson-instance type)
- `src/items/99999999-1111-0000-0000-000000000000.json` (hobson-instance-renderer)

## Architecture References

See `docs/Bootstrap_Architecture.md` sections 320-390 for original nested instance design.
