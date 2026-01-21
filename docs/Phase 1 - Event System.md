# Phase 1 - Event System

## Overview

Add a simple pub/sub event system to the kernel. Storage operations emit events; user code can subscribe.

## Design

### EventBus Class

```javascript
class EventBus {
  constructor() {
    this.listeners = new Map();  // event name -> Set of handlers
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);  // Return unsubscribe function
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(event, data) {
    // Exact match
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (e) {
          console.error(`Event handler error for ${event}:`, e);
        }
      }
    }

    // Wildcard match (e.g., 'item:*' matches 'item:created')
    const [namespace] = event.split(':');
    const wildcardHandlers = this.listeners.get(`${namespace}:*`);
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler({ ...data, event });
        } catch (e) {
          console.error(`Wildcard handler error for ${event}:`, e);
        }
      }
    }
  }

  // For debugging: list all registered events
  getRegisteredEvents() {
    return [...this.listeners.keys()];
  }
}
```

### Event Types

| Event | Data | When |
|-------|------|------|
| `item:created` | `{ id, item }` | New item saved for first time |
| `item:updated` | `{ id, item, previous }` | Existing item modified |
| `item:deleted` | `{ id, item }` | Item deleted |

### Integration Points

Events are emitted from kernel methods, not storage directly. This keeps storage pure.

**Kernel methods that emit events:**

1. All paths that call `storage.set()`:
   - `createEditorAPI().save()`
   - `createEditorAPI().saveAndClose()`
   - `editItemRaw()` save button
   - `createREPLAPI().set()`
   - `createREPLAPI().update()`
   - `addChild()`
   - `removeChild()`
   - `setChildRenderer()`
   - `import()`

2. Delete path:
   - `deleteItem()` → emits `item:deleted`

### Implementation Strategy

Rather than modifying every call site, create a wrapper method:

```javascript
async saveItem(item, options = {}) {
  const exists = await this.storage.exists(item.id);
  const previous = exists ? await this.storage.get(item.id) : null;

  await this.storage.set(item, this);

  if (exists) {
    this.events.emit('item:updated', { id: item.id, item, previous });
  } else {
    this.events.emit('item:created', { id: item.id, item });
  }

  return item;
}
```

Then update call sites to use `kernel.saveItem()` instead of `kernel.storage.set()`.

### API Exposure

**REPL API:**
```javascript
events: {
  on: (event, handler) => kernel.events.on(event, handler),
  off: (event, handler) => kernel.events.off(event, handler),
  emit: (event, data) => kernel.events.emit(event, data),  // For user-defined events
  list: () => kernel.events.getRegisteredEvents()
}
```

**Renderer API:** Read-only subscription
```javascript
events: {
  on: (event, handler) => kernel.events.on(event, handler),
  off: (event, handler) => kernel.events.off(event, handler)
}
```

## File Changes

### kernel-core (33333333-1111-0000-0000-000000000000)

1. Add `EventBus` class
2. Add `this.events = new EventBus()` in Kernel constructor
3. Add `saveItem(item, options)` wrapper method
4. Update all `storage.set()` calls to use `saveItem()`
5. Update `deleteItem()` to emit `item:deleted`
6. Add `events` to REPL API

### kernel-rendering (33333333-5555-0000-0000-000000000000)

1. Update `create()`, `set()`, `update()`, `updateSilent()` to use `kernel.saveItem()`
2. Add `events` to renderer API (read-only: on/off only)

### kernel-repl (33333333-6666-0000-0000-000000000000)

1. Update storage operations to use `kernel.saveItem()`
2. Add `events` to REPL API

### kernel-safe-mode (33333333-7777-0000-0000-000000000000)

1. Update `saveItem()` and import to use `kernel.saveItem()`

### Exceptions

**kernel-viewport**: Uses `storage.set()` directly for internal state management. This is intentional - viewport state changes (navigation) are internal bookkeeping, not user data changes that should trigger reactive updates.

## Testing

After implementation, test in REPL:

```javascript
// Subscribe to all item events
const unsub = api.events.on('item:*', e => console.log('Event:', e));

// Create an item - should log item:created
await api.set({ id: crypto.randomUUID(), type: api.IDS.ATOM, name: 'test', children: [], content: {} });

// Update it - should log item:updated
const items = await api.query({ name: 'test' });
await api.set({ ...items[0], content: { changed: true } });

// Delete it - should log item:deleted
await api.delete(items[0].id);

// Unsubscribe
unsub();
```

## Future Considerations

- **Batching:** Multiple rapid changes could be batched into single event (not implementing now)
- **Async handlers:** Currently handlers are sync; could support async with `emitAsync()`
- **Event history:** Could maintain recent event log for debugging (not implementing now)
