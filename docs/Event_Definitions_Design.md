# Event Definitions Design

*Draft Date: 2026-01-31*
*Revised: 2026-01-31*

---

## Problem Statement

Events in Hobson are currently magic strings (`"item:created"`, `"system:error"`). This creates several issues:

1. **Undiscoverable** — Users can't query "what events exist?" without reading source code
2. **Undocumented** — No structured place to describe what an event means or what payload it carries
3. **Invisible user events** — Custom events are completely opaque to the system
4. **Ad-hoc wildcards** — String pattern matching (`item:*`) is a separate mechanism from the type system

This conflicts with Hobson's core principles:

- **Inspectable** — All parts can be examined at any time
- **Self-revealing** — Interfaces present and explain choices
- **Everything is an item** — Uniform data model

---

## Design Principles

1. **Event definitions are items** — Queryable, documented, first-class
2. **Emitted events are item-shaped** — Uniform structure, trivially persistable
3. **Event grouping via type hierarchy** — No special wildcard syntax; use existing type chain mechanism
4. **Kernel events are seed items** — Bootstrap via `initial-kernel.json`
5. **User events work identically** — No distinction between kernel and user-defined events
6. **No runtime validation** — Event definitions are documentation; emit stays synchronous and fast

---

## Architecture Overview

### Three Concepts

| Concept | What it is | Persisted? |
|---------|-----------|------------|
| Event Definition | Item describing an event type | Yes |
| Emitted Event | Item-shaped object passed through system | No |
| Event Artifact | Item created from an event (e.g., error item) | Yes |

### Relationship to Existing Patterns

```
Type Definition     :  Item Instance
      ↕                     ↕
Event Definition    :  Emitted Event
```

Just as items reference type definitions, emitted events reference event definitions.

---

## Event Type Hierarchy

Event definitions form a type hierarchy, replacing string-based wildcards with the existing type chain mechanism.

```
type-definition
└── event-definition
    ├── item-event
    │   ├── item:created
    │   ├── item:updated
    │   └── item:deleted
    ├── system-event
    │   ├── system:error
    │   └── system:boot
    └── viewport-event
        ├── viewport:selection-changed
        └── viewport:root-changed
```

Subscribing to a parent type receives all descendant events:

```javascript
// Listen to a specific event
api.events.on(EVENT_IDS.ITEM_CREATED, handler);

// Listen to all item events (item:created, item:updated, item:deleted)
api.events.on(EVENT_IDS.ITEM_EVENT, handler);

// Listen to ALL events
api.events.on(EVENT_IDS.EVENT_DEFINITION, handler);
```

This uses the existing `typeChainIncludes` machinery — no special wildcard syntax needed.

---

## Event Definition Items

### Base Type

```javascript
{
  id: "e0e00000-0000-0000-0000-000000000000",
  type: "11111111-0000-0000-0000-000000000000",  // TYPE_DEFINITION
  name: "event-definition",
  content: {
    description: "Base type for all event definitions",
    optional_fields: ["payload", "example"]
  }
}
```

### Event Group Types

```javascript
{
  id: "e0e00000-0001-0000-0000-000000000000",
  type: "e0e00000-0000-0000-0000-000000000000",  // EVENT_DEFINITION
  name: "item-event",
  content: {
    description: "Events related to item lifecycle (create, update, delete)"
  }
}

{
  id: "e0e00000-0002-0000-0000-000000000000",
  type: "e0e00000-0000-0000-0000-000000000000",  // EVENT_DEFINITION
  name: "system-event",
  content: {
    description: "Events related to system operations (boot, errors)"
  }
}

{
  id: "e0e00000-0003-0000-0000-000000000000",
  type: "e0e00000-0000-0000-0000-000000000000",  // EVENT_DEFINITION
  name: "viewport-event",
  content: {
    description: "Events related to viewport state changes"
  }
}
```

### Specific Event Definitions

#### Item Events

```javascript
{
  id: "e0e00000-0001-0001-0000-000000000000",
  type: "e0e00000-0001-0000-0000-000000000000",  // ITEM_EVENT
  name: "item:created",
  content: {
    description: "Emitted after a new item is saved to storage",
    payload: {
      item: "The complete item data (includes item.id)"
    }
  }
}

{
  id: "e0e00000-0001-0002-0000-000000000000",
  type: "e0e00000-0001-0000-0000-000000000000",  // ITEM_EVENT
  name: "item:updated",
  content: {
    description: "Emitted after an existing item is modified",
    payload: {
      item: "The updated item data (includes item.id)",
      previous: "The item data before the update"
    }
  }
}

{
  id: "e0e00000-0001-0003-0000-000000000000",
  type: "e0e00000-0001-0000-0000-000000000000",  // ITEM_EVENT
  name: "item:deleted",
  content: {
    description: "Emitted after an item is removed from storage",
    payload: {
      item: "The item data at time of deletion (includes item.id)"
    }
  }
}
```

#### System Events

```javascript
{
  id: "e0e00000-0002-0001-0000-000000000000",
  type: "e0e00000-0002-0000-0000-000000000000",  // SYSTEM_EVENT
  name: "system:error",
  content: {
    description: "Emitted when an error occurs during rendering, module evaluation, or API calls",
    payload: {
      error: {
        name: "Error class name",
        message: "Error message",
        stack: "Stack trace string"
      },
      context: {
        operation: "What was happening (render, require, api-call)",
        itemId: "Related item ID if applicable",
        itemName: "Related item name if applicable",
        rendererId: "Renderer ID if applicable"
      }
    }
  }
}

{
  id: "e0e00000-0002-0002-0000-000000000000",
  type: "e0e00000-0002-0000-0000-000000000000",  // SYSTEM_EVENT
  name: "system:boot",
  content: {
    description: "Emitted when kernel boot completes successfully",
    payload: {
      duration: "Boot time in milliseconds"
    }
  }
}
```

#### Viewport Events

```javascript
{
  id: "e0e00000-0003-0001-0000-000000000000",
  type: "e0e00000-0003-0000-0000-000000000000",  // VIEWPORT_EVENT
  name: "viewport:selection-changed",
  content: {
    description: "Emitted when the selected item changes",
    payload: {
      itemId: "Newly selected item ID (null if deselected)",
      parentId: "Parent container of selected item",
      previous: "Previously selected item ID"
    }
  }
}

{
  id: "e0e00000-0003-0002-0000-000000000000",
  type: "e0e00000-0003-0000-0000-000000000000",  // VIEWPORT_EVENT
  name: "viewport:root-changed",
  content: {
    description: "Emitted when the viewport root item changes",
    payload: {
      rootId: "New root item ID",
      previous: "Previous root item ID"
    }
  }
}
```

---

## Emitted Event Structure

Emitted events are item-shaped objects (not persisted by default):

```javascript
{
  type: "e0e00000-0001-0001-0000-000000000000",  // event-definition ID
  content: {
    item: { id: "newly-created-item-id", type: "...", /* ... */ }
  },
  timestamp: 1706745600000  // Added by emit()
}
```

### Required Fields

| Field | Description |
|-------|-------------|
| `type` | Event definition ID |
| `content` | Event payload (structure depends on event type) |

### Fields Added by Kernel

| Field | Description |
|-------|-------------|
| `timestamp` | When the event was emitted |

### Optional Fields

| Field | Description |
|-------|-------------|
| `id` | If caller wants to identify specific event instances |
| `source` | Item ID that caused/emitted the event |

---

## API Changes

### Event ID Constants

Kernel exports event IDs alongside existing `IDS`:

```javascript
const EVENT_IDS = {
  // Base types
  EVENT_DEFINITION: "e0e00000-0000-0000-0000-000000000000",

  // Event group types (for subscribing to categories)
  ITEM_EVENT:     "e0e00000-0001-0000-0000-000000000000",
  SYSTEM_EVENT:   "e0e00000-0002-0000-0000-000000000000",
  VIEWPORT_EVENT: "e0e00000-0003-0000-0000-000000000000",

  // Specific item events
  ITEM_CREATED: "e0e00000-0001-0001-0000-000000000000",
  ITEM_UPDATED: "e0e00000-0001-0002-0000-000000000000",
  ITEM_DELETED: "e0e00000-0001-0003-0000-000000000000",

  // Specific system events
  SYSTEM_ERROR: "e0e00000-0002-0001-0000-000000000000",
  SYSTEM_BOOT:  "e0e00000-0002-0002-0000-000000000000",

  // Specific viewport events
  VIEWPORT_SELECTION_CHANGED: "e0e00000-0003-0001-0000-000000000000",
  VIEWPORT_ROOT_CHANGED:      "e0e00000-0003-0002-0000-000000000000",
};
```

### Emitting Events

**Current API:**
```javascript
api.events.emit('item:created', { item })
```

**New API:**
```javascript
api.events.emit({
  type: EVENT_IDS.ITEM_CREATED,
  content: { item }
})
```

### EventBus Implementation

The `emit()` method stays synchronous — no validation overhead:

```javascript
emit(event) {
  // Add timestamp
  const enrichedEvent = {
    ...event,
    timestamp: Date.now()
  };

  // Dispatch to all listeners whose subscribed type is in this event's type chain
  for (const [subscribedType, handlers] of this.listeners) {
    if (this.eventTypeCache.get(event.type)?.has(subscribedType)) {
      for (const handler of handlers) {
        try {
          handler(enrichedEvent);
        } catch (e) {
          console.error(`Event handler error:`, e);
        }
      }
    }
  }
}
```

### Subscription with Type Hierarchy

At subscription time, we check if the subscribed type matches via type chain:

```javascript
on(eventTypeId, handler) {
  if (!this.listeners.has(eventTypeId)) {
    this.listeners.set(eventTypeId, new Set());
  }
  this.listeners.get(eventTypeId).add(handler);
  return () => this.off(eventTypeId, handler);
}
```

For performance, the EventBus maintains a cache mapping each event type to all its ancestor types. This is built once at boot:

```javascript
async buildEventTypeCache() {
  this.eventTypeCache = new Map();
  const allEventDefs = await this.storage.query({
    typeExtends: EVENT_IDS.EVENT_DEFINITION
  });

  for (const eventDef of allEventDefs) {
    const ancestors = await this.getTypeChain(eventDef.id);
    this.eventTypeCache.set(eventDef.id, new Set(ancestors));
  }
}
```

Emit is then O(number of subscribed types) with O(1) set lookups — fast and synchronous.

### Listening for Events

```javascript
// Specific event
api.events.on(EVENT_IDS.ITEM_CREATED, (event) => {
  console.log(event.content.item.name);
});

// All item events
api.events.on(EVENT_IDS.ITEM_EVENT, (event) => {
  // event.type tells you which specific event
  console.log('Item event:', event.type);
});

// All events
api.events.on(EVENT_IDS.EVENT_DEFINITION, (event) => {
  console.log('Any event:', event.type);
});
```

### Declarative Watches

Declarative watches use the event type ID. The existing field editor for GUID fields provides search/lookup:

```javascript
{
  content: {
    watches: [
      { event: "e0e00000-0001-0001-0000-000000000000" }  // item:created
    ],
    code: "..."
  }
}
```

To watch all item events:

```javascript
{
  content: {
    watches: [
      { event: "e0e00000-0001-0000-0000-000000000000" }  // item-event (parent type)
    ],
    code: "..."
  }
}
```

### Querying Event Definitions

```javascript
// List all event definitions (includes group types and specific events)
const allEvents = await api.items.query({ typeExtends: EVENT_IDS.EVENT_DEFINITION });

// List only item events
const itemEvents = await api.items.query({ typeExtends: EVENT_IDS.ITEM_EVENT });

// Get specific event definition for documentation
const itemCreated = await api.items.get(EVENT_IDS.ITEM_CREATED);
console.log(itemCreated.content.description);
console.log(itemCreated.content.payload);
```

---

## User-Defined Events

Users create event definitions using the type hierarchy:

```javascript
// Create a custom event group
const POMODORO_EVENT = crypto.randomUUID();
await api.items.save({
  id: POMODORO_EVENT,
  type: EVENT_IDS.EVENT_DEFINITION,  // extends base event-definition
  name: "pomodoro-event",
  content: {
    description: "Events from the pomodoro timer system"
  }
});

// Create specific events under the group
const POMODORO_COMPLETED = crypto.randomUUID();
await api.items.save({
  id: POMODORO_COMPLETED,
  type: POMODORO_EVENT,  // extends pomodoro-event
  name: "pomodoro:completed",
  content: {
    description: "Emitted when a pomodoro timer finishes",
    payload: {
      duration: "Duration in minutes",
      taskId: "Associated task item ID (optional)"
    }
  }
});

// Emit the event
api.events.emit({
  type: POMODORO_COMPLETED,
  content: { duration: 25, taskId: "some-task-id" }
});

// Listen to all pomodoro events
api.events.on(POMODORO_EVENT, (event) => {
  console.log('Pomodoro event:', event);
});
```

After creating event definitions, the EventBus cache must be refreshed. This happens automatically when item events fire (the kernel watches for new event definitions).

---

## Migration Path

### Phase 1: Add Event Type Hierarchy (Non-Breaking)

1. Add `event-definition` seed type and group types to `initial-kernel.json`
2. Add specific kernel event definition seed items
3. Add `EVENT_IDS` constants to kernel
4. Build event type cache at boot
5. No changes to emit/subscribe yet — old API continues to work

### Phase 2: New Emit/Subscribe API (Breaking Change)

1. Update `emit()` to accept event objects
2. Update `on()` to use type hierarchy matching
3. Update all kernel emit calls to use new format
4. Update declarative watch system to use event type IDs
5. Update user code (renderers, handlers)

### Phase 3: Tooling

1. Event browser view (list all event definitions with hierarchy)
2. Field editor for event type references (like existing type references)
3. Autocomplete in code editor for EVENT_IDS

---

## Kernel Changes Summary

### New Seed Items

| Item | Type | ID Pattern |
|------|------|-----------|
| `event-definition` | type-definition | `e0e00000-0000-...` |
| `item-event` | event-definition | `e0e00000-0001-0000-...` |
| `system-event` | event-definition | `e0e00000-0002-0000-...` |
| `viewport-event` | event-definition | `e0e00000-0003-0000-...` |
| `item:created` | item-event | `e0e00000-0001-0001-...` |
| `item:updated` | item-event | `e0e00000-0001-0002-...` |
| `item:deleted` | item-event | `e0e00000-0001-0003-...` |
| `system:error` | system-event | `e0e00000-0002-0001-...` |
| `system:boot` | system-event | `e0e00000-0002-0002-...` |
| `viewport:selection-changed` | viewport-event | `e0e00000-0003-0001-...` |
| `viewport:root-changed` | viewport-event | `e0e00000-0003-0002-...` |

### Modified Code

1. **EventBus class**: New `emit()` signature, type hierarchy dispatch, cache building
2. **IDS constant**: Add `EVENT_DEFINITION`
3. **EVENT_IDS constant**: New export with all event type IDs
4. **Kernel emit calls**: Update to object form
5. **Watch dispatcher**: Match on event type hierarchy

---

## Benefits Summary

1. **Discoverable** — Query all events with `query({ typeExtends: EVENT_DEFINITION })`
2. **Documented** — Each event carries description and payload schema
3. **Hierarchical** — Subscribe to event categories using existing type chain mechanism
4. **Uniform** — Events follow the item pattern
5. **Persistable** — Event objects trivially saved as items for logging
6. **User-extensible** — Custom events and event groups are first-class citizens
7. **No special syntax** — Wildcards replaced by type hierarchy; one mechanism for everything

---

## Open Questions

1. **Cache invalidation?** When user creates new event definitions, the type cache needs updating.
   - *Recommendation: Kernel watches for item:created where type extends event-definition, rebuilds cache.*

2. **Event definition immutability?** Should kernel event definitions be protected from modification?
   - *Recommendation: No special protection. User can modify at own risk, consistent with other seed items.*

3. **Name uniqueness?** Should event names be unique like code item names?
   - *Recommendation: Yes, enforce uniqueness for human readability and debugging.*

4. **Audit/logging built-in?** Should there be a kernel flag to auto-persist all events?
   - *Recommendation: No. This is a user-space feature (subscribe to EVENT_DEFINITION, save as items).*

---

## Summary

Event definitions as items with type hierarchy for grouping aligns Hobson's event system with its core philosophy: everything is data, everything is inspectable, everything uses the same mechanisms. The type hierarchy approach replaces ad-hoc wildcard string matching with the existing type chain system — one concept instead of two. Events become discoverable, documented, and extensible while keeping emit synchronous and fast.
