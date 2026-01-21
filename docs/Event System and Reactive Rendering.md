# Event System and Reactive Rendering

## Problem

The current rendering architecture triggers full viewport re-renders on most state changes. This causes:

- Loss of unsaved editor state when saving other items
- Scroll position resets
- Window focus/selection issues
- Accumulating point-fixes to prevent re-renders in specific cases

The root cause: no mechanism for partial updates. Either everything re-renders, or nothing does.

## Solution

Two complementary systems:

1. **Event system** - Kernel emits events on storage operations; user code can subscribe
2. **Reactive rendering** - Renderers declare what events they watch; only affected items re-render

## Design Principles

- **Declarative over imperative** - Watches are data, not code buried in render functions
- **Inspectable** - "What watches what" is queryable without executing code
- **Incremental** - Each phase delivers standalone value
- **User-space friendly** - Event system enables features like waste bin, undo, sync

## Incremental Implementation

### Phase 1: Event System

**Goal:** Kernel emits events on storage operations; API exposes subscription for user code.

**Events emitted:**
```
item:created   { id, item }
item:updated   { id, item, previous }
item:deleted   { id, item }
```

**API surface:**
```javascript
api.events.on('item:deleted', (event) => { ... })
api.events.off('item:deleted', handler)
api.events.emit(name, data)  // for user-defined events
```

**Enables:**
- Waste bin (subscribe to deletions, store deleted items)
- Audit logging
- User-space sync mechanisms
- Foundation for Phase 3

**Standalone value:** Yes - useful even without reactive rendering.

**Details:** See `Phase 1 - Event System.md`

---

### Phase 2: Render Instance Tracking

**Goal:** Track what's currently rendered: which items, with which renderers, in which DOM locations.

**Registry structure:**
```javascript
{
  instanceId,     // unique per render
  domNode,        // the rendered DOM
  itemId,         // what item
  rendererId,     // which renderer
  parentId,       // containing item (for cleanup)
}
```

**Operations:**
- Register on render
- Unregister on removal
- Query: "what instances exist for item X?"
- Query: "what instances use renderer Y?"

**Enables:**
- Foundation for partial re-render (Phase 3)
- Debugging: "what's currently rendered?"
- Future: detect duplicate renders of same item

**Standalone value:** Limited - primarily infrastructure for Phase 3.

**Details:** See `Phase 2 - Render Instance Tracking.md`

---

### Phase 3: Partial Re-render

**Goal:** Re-render a specific item in place without affecting siblings or parent.

**Mechanism:**
- Locate the render instance by itemId (and optionally rendererId)
- Re-execute the renderer
- Replace DOM content within existing wrapper
- Preserve: position, size, z-index, window chrome

**Key distinction:**
- Container/wrapper: managed by parent renderer, preserved
- Content: produced by item's renderer, replaced

**Enables:**
- Safe re-render that doesn't destroy unrelated state
- Foundation for reactive rendering (Phase 4)

**Standalone value:** Yes - can be triggered manually via API for testing.

**Details:** See `Phase 3 - Partial Re-render.md`

---

### Phase 4: Reactive Rendering

**Goal:** Renderers declare watches; matching events trigger automatic partial re-render.

**Renderer declaration:**
```javascript
export const watches = ['item:created', 'item:deleted'];

export function render(item, api) {
  // ...
}
```

**Mechanism:**
1. When renderer is loaded, extract `watches` array
2. When item is rendered, register its watches (from its renderer)
3. When event fires, find instances with matching watches
4. Partial re-render each matching instance

**Watch patterns:**
```
'item:created'      // specific event
'item:*'            // all item events
'item:updated:xyz'  // specific item updated (stretch goal)
```

**Lifecycle:**
- Watches registered when item renders
- Watches unregistered when item removed from DOM
- Renderer switch: unregister old, register new

**Enables:**
- Counter that updates when items added/deleted
- Live views that respond to changes
- Editors that see external changes

**Details:** See `Phase 4 - Reactive Rendering.md`

---

## Migration Path

**Current code continues to work.** Renderers without `watches` simply don't participate in reactive updates - they behave exactly as today.

**Gradual adoption:**
1. Add watches to renderers that need reactivity
2. Remove point-fixes that were preventing re-renders
3. Eventually: audit remaining `renderRoot()` calls

## Open Questions

1. **Watch specificity** - Should renderers be able to watch specific item IDs, or only event types?
2. **Debouncing** - Multiple rapid events could trigger multiple re-renders. Batch within animation frame?
3. **Error handling** - If a partial re-render fails, what's the recovery?
4. **Nested rendering** - Item A contains Item B; both watch same event. Render order?

## Non-Goals (for now)

- Cross-tab synchronization
- Undo/redo (uses events, but separate feature)
- Automatic dependency inference (watches are explicit)
