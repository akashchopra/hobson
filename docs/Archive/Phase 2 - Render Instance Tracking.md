# Phase 2 - Render Instance Tracking

**Status: Implemented**

## Overview

Track what's currently rendered: which items, with which views, in which DOM locations. This enables Phase 3 (partial re-render) by providing a way to locate and update specific rendered instances.

## Design

### RenderInstanceRegistry Class

```javascript
class RenderInstanceRegistry {
  constructor() {
    this.instances = new Map();      // instanceId -> InstanceInfo
    this.byItemId = new Map();       // itemId -> Set<instanceId>
    this.byViewId = new Map();       // viewId -> Set<instanceId>
    this.byParentId = new Map();     // parentId -> Set<instanceId>
    this.nextId = 1;
  }
}
```

### Instance Structure

```javascript
{
  instanceId: number,     // Unique per render (auto-incrementing)
  domNode: Node,          // The rendered DOM element
  itemId: string,         // What item is rendered
  viewId: string,         // Which view rendered it
  parentId: string|null,  // Containing item (null for root)
  timestamp: number       // When rendered (for debugging)
}
```

### Operations

| Method | Purpose |
|--------|---------|
| `register(domNode, itemId, viewId, parentId)` | Register new instance, returns instanceId |
| `unregister(instanceId)` | Remove single instance |
| `unregisterByParent(parentId)` | Remove all instances with given parent |
| `clear()` | Remove all instances (full re-render) |
| `getByItemId(itemId)` | Get all instances rendering an item |
| `getByViewId(viewId)` | Get all instances using a view |
| `get(instanceId)` | Get single instance by ID |
| `getAll()` | Get all instances (for debugging) |

### DOM Integration

Each rendered element gets a `data-render-instance` attribute with its instance ID. This enables:
- Finding the instance for a DOM element
- Debugging in browser dev tools
- Phase 3: locating the DOM to replace

### Lifecycle

1. **Full re-render** (`renderRoot`): Call `registry.clear()` before rendering
2. **Nested render** (`api.renderItem`): Register after render completes
3. **Parent re-renders attachments**: Call `registry.unregisterByParent(parentId)` first

### API Exposure

**Renderer API** (read-only for views):
```javascript
api.instances: {
  getByItemId: (itemId) => [...],
  getAll: () => [...]
}
```

**REPL API** (full access for debugging):
```javascript
api.instances: {
  getByItemId, getByViewId, get, getAll, clear
}
```

## Integration Points

### kernel-rendering (33333333-5555-0000-0000-000000000000)

1. Add `RenderInstanceRegistry` class
2. Initialize `this.registry = new RenderInstanceRegistry()` in constructor
3. Modify `renderItem()`:
   - After successful render, register instance
   - Add `data-render-instance` attribute to DOM
4. Add `clearInstances()` method (called by kernel before `renderRoot`)
5. Expose registry queries in renderer API

### kernel-core (33333333-1111-0000-0000-000000000000)

1. Modify `renderRoot()` to call `this.rendering.clearInstances()` before rendering
2. Add instances to REPL API

## Testing

After implementation, test in REPL:

```javascript
// Render something, then check instances
const instances = api.instances.getAll();
console.log('Current instances:', instances);

// Check instances for specific item
const itemInstances = api.instances.getByItemId(api.viewport.getRoot());
console.log('Root item instances:', itemInstances);

// Verify DOM attributes
document.querySelectorAll('[data-render-instance]').forEach(el => {
  console.log('Instance', el.dataset.renderInstance, el);
});
```

## Future Considerations

- **Memory**: Registry holds references to DOM nodes. Clear on navigation to prevent leaks.
- **Duplicates**: Same item can be rendered multiple times (different parents, different views). This is expected.
- **View specs**: Both code views and declarative view-specs should be tracked the same way.
