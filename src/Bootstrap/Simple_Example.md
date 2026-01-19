# Bootstrap Architecture - Simple Working Example

This is a minimal example demonstrating the bootstrap architecture pattern.

## Files

### 1. bootstrap.html
Minimal bootloader that:
- Opens IndexedDB
- Checks for kernel-core
- Shows import UI if missing
- Loads and boots kernel if present

### 2. simple-kernel.json
```json
[
  {
    "id": "kernel-storage",
    "type": "kernel-module",
    "name": "Storage",
    "created": 0,
    "modified": 0,
    "content": {
      "code": "export class Storage { constructor() { this.data = new Map(); } async get(id) { if (!this.data.has(id)) throw new Error('Not found: ' + id); return this.data.get(id); } async set(item) { this.data.set(item.id, item); } }"
    }
  },
  {
    "id": "kernel-core",
    "type": "kernel-module",
    "name": "Core",
    "created": 0,
    "modified": 0,
    "content": {
      "code": "export async function loadKernel(require) { const { Storage } = await require('kernel-storage'); class Kernel { constructor() { this.storage = new Storage(); this.rootElement = document.createElement('div'); this.rootElement.innerHTML = '<h1>Hobson is running!</h1><p>Kernel loaded successfully from items.</p>'; } async boot() { console.log('Kernel booted'); } } return Kernel; }"
    }
  }
]
```

## How It Works

1. User opens `bootstrap.html`
2. No items in IndexedDB → Import UI shown
3. User imports `simple-kernel.json`
4. Items stored in IndexedDB
5. Page reloads
6. Bootstrap finds `kernel-core` in IndexedDB
7. Creates require function
8. Calls `loadKernel(require)`
9. `loadKernel` loads `kernel-storage` via require
10. Creates Kernel class with Storage instance
11. Returns Kernel class
12. Bootstrap instantiates Kernel
13. Calls `kernel.boot()`
14. Kernel renders to DOM

## Testing

1. Open `bootstrap.html` in browser
2. Open DevTools console
3. You should see import UI
4. Import `simple-kernel.json`
5. Page reloads
6. You should see "Hobson is running!"
7. In console, `window.kernel` is available

## Extending

To add a new subsystem:

1. Create new kernel module item:
```json
{
  "id": "kernel-rendering",
  "type": "kernel-module",
  "name": "Rendering",
  "content": {
    "code": "export class Rendering { async render(item) { /* ... */ } }"
  }
}
```

2. Update kernel-core to load it:
```javascript
export async function loadKernel(require) {
  const { Storage } = await require('kernel-storage');
  const { Rendering } = await require('kernel-rendering'); // NEW
  
  class Kernel {
    constructor() {
      this.storage = new Storage();
      this.rendering = new Rendering(this); // NEW
      // ...
    }
  }
  return Kernel;
}
```

3. Re-export kernel-core to JSON
4. Import updated kernel

## Key Insights

1. **Bootstrap is minimal and stable** - Never changes
2. **Kernel is items** - All logic in IndexedDB
3. **Self-loading pattern** - kernel-core orchestrates loading
4. **Same pattern for nested** - hobson-instance renderer would do identical process with prefixed storage

This pattern scales from this 2-module example to the full 8-module Hobson kernel.
