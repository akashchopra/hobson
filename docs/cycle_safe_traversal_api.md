# Kernel API: Cycle-Safe Rendering and Traversal

## Background

The current kernel prevents cycles in the item graph by checking in `addChild()`. This assumes a tree structure is always desirable.

However, there are legitimate use cases for cyclic structures:

- **Search results as children**: A search widget might find its own container as a result
- **Bidirectional relationships**: Item A references B, B references A
- **Graph structures**: Knowledge graphs, state machines, etc.

Rather than forbidding cycles, the kernel should permit them and provide safe primitives that let user code handle cycles appropriately.

## Design Principles

1. **Cycles are valid data** - The kernel should not enforce tree-only structures
2. **Rendering is protected** - The kernel detects cycles during render dispatch
3. **User code decides presentation** - How to display a cycle is context-dependent
4. **Explicit handling required** - API design forces acknowledgment of cycle cases

## Core Change: Cycle-Safe `renderItem`

### Current Problem

Rendering is recursive through the dispatch mechanism:

1. Container A's view calls `api.renderItem(B)`
2. B's view calls `api.renderItem(C)`
3. If C's children includes A → `api.renderItem(A)` → infinite loop

### Solution: Track Render Path

The kernel tracks which items are currently being rendered. If `renderItem` is called for an item already in the render path, it's a cycle.

**New `renderItem` signature:**

```javascript
api.renderItem(itemId, viewId?, options?)
```

**Options:**
```javascript
{
  onCycle: (item) => DOMNode  // Required when cycles are possible
}
```

**Kernel behavior:**
- Cycle detected + `onCycle` provided → call callback, return its result
- Cycle detected + no `onCycle` → throw error with helpful message
- No cycle → render normally, passing render path to child API

### Implementation

**Kernel maintains render path in context:**

```javascript
async renderItem(itemId, viewId, options = {}, context = {}) {
  const renderPath = context.renderPath || [];

  // Cycle detection
  if (renderPath.includes(itemId)) {
    if (options.onCycle) {
      const item = await this.kernel.storage.get(itemId);
      return options.onCycle(item);
    } else {
      throw new Error(
        `Cycle detected rendering item ${itemId}. ` +
        `Render path: ${renderPath.join(' → ')} → ${itemId}. ` +
        `Provide onCycle callback to handle cycles.`
      );
    }
  }

  // Normal rendering with updated path
  const newPath = [...renderPath, itemId];
  const item = await this.kernel.storage.get(itemId);
  const view = await this.findView(item.type, viewId);
  const api = this.createRendererAPI(item, { renderPath: newPath });

  return await view.render(item, api);
}
```

**API passed to views includes the path:**

```javascript
createRendererAPI(containerItem, context = {}) {
  return {
    // ... existing API methods ...

    renderItem: async (childId, viewId, options) => {
      return this.renderItem(childId, viewId, options, context);
    }
  };
}
```

### View Migration

**Before (breaks on cycle):**
```javascript
for (const childSpec of item.children) {
  const childNode = await api.renderItem(childSpec.id);
  container.appendChild(childNode);
}
```

**After (handles cycles explicitly):**
```javascript
for (const childSpec of item.children) {
  const childId = typeof childSpec === 'string' ? childSpec : childSpec.id;
  const child = await api.get(childId);

  const childNode = await api.renderItem(childSpec.id, null, {
    onCycle: (item) => api.createElement('div', {
      class: 'cycle-marker',
      style: 'padding: 8px; color: #888; font-style: italic; border: 1px dashed #ccc;'
    }, ['↻ ' + (item.name || item.id.substring(0, 8)) + ' (already shown above)'])
  });

  container.appendChild(childNode);
}
```

### When is `onCycle` Required?

The kernel cannot statically know if a view will recurse. The rule is:

- If a cycle is actually encountered and no `onCycle` is provided → error
- If no cycle occurs, `onCycle` is never called (and not required)

In practice, any view that calls `api.renderItem()` on children should provide `onCycle`. Views that don't render children (e.g., a simple note view) don't need it.

## Supporting API Changes

### Remove Cycle Prevention from `addChild()`

**Current behavior:**
```javascript
if (await this.wouldCreateCycle(parentId, childId)) {
  throw new Error(`Adding ${childId} to ${parentId} would create a cycle`);
}
```

**New behavior:**
- Remove this check
- `addChild()` succeeds even if it creates a cycle
- Cycles are handled at render time, not at data modification time

### Advisory Cycle Detection

Keep these as optional utilities for code that wants to check before creating cycles:

#### `api.hasCycle(itemId)`

Check if an item's descendant graph contains any cycles.

```javascript
const cyclic = await api.hasCycle(itemId);
// Returns: boolean
```

#### `api.wouldCreateCycle(parentId, childId)`

Check if adding a child would create a cycle.

```javascript
const wouldCycle = await api.wouldCreateCycle(parentId, childId);
if (wouldCycle) {
  // User decides what to do - warn, prevent, or allow
}
```

## Traversal Helpers

For non-rendering traversal (export, counting, analysis), provide explicit helpers.

### `api.mapChildren(itemId, normalFn, cycleFn, options?)`

Recursively map over children with explicit handling for both cases.

**Parameters:**
- `itemId` - Root item to traverse from
- `normalFn(child, context)` - Called for normal children, returns transformed value
- `cycleFn(child, context)` - Called when a cycle is detected, returns transformed value
- `options` - Optional: `{ maxDepth: number }`

**Context object:**
```javascript
{
  depth: number,      // Current recursion depth (0-indexed)
  path: string[],     // Array of item IDs from root to current
  parentId: string    // Immediate parent's ID
}
```

**Example - building a tree view:**
```javascript
const nodes = await api.mapChildren(
  container.id,
  async (child, ctx) => {
    return { id: child.id, name: child.name, depth: ctx.depth };
  },
  async (child, ctx) => {
    return { id: child.id, name: child.name, depth: ctx.depth, isCycle: true };
  }
);
```

### `api.foldChildren(itemId, initialValue, fn, options?)`

Recursively fold/reduce over children with cycle detection via context flag.

**Parameters:**
- `itemId` - Root item to traverse from
- `initialValue` - Starting accumulator value
- `fn(accumulator, child, context)` - Reducer function, returns new accumulator
- `options` - Optional: `{ maxDepth: number }`

**Context object:**
```javascript
{
  depth: number,
  path: string[],
  parentId: string,
  isCyclePoint: boolean  // True if this child creates a cycle
}
```

**Example - counting descendants:**
```javascript
const count = await api.foldChildren(container.id, 0, async (acc, child, ctx) => {
  if (ctx.isCyclePoint) return acc; // Don't double-count
  return acc + 1;
});
```

**Example - collecting IDs:**
```javascript
const allIds = await api.foldChildren(container.id, [], async (acc, child, ctx) => {
  if (ctx.isCyclePoint) return acc;
  return [...acc, child.id];
});
```

## Testing Checklist

- [ ] Implement render path tracking in kernel
- [ ] Update `renderItem` to detect cycles and require `onCycle`
- [ ] Remove cycle prevention from `addChild()`
- [ ] Implement `api.hasCycle()` (advisory)
- [ ] Implement `api.wouldCreateCycle()` (advisory) - already exists, just expose in API
- [ ] Implement `api.mapChildren()`
- [ ] Implement `api.foldChildren()`
- [ ] Update `container_view` with `onCycle` handler
- [ ] Update any other views that call `renderItem` on children
- [ ] Test: Create intentional cycle via REPL
- [ ] Test: Cycle renders with marker, no infinite loop
- [ ] Test: Error thrown when cycle encountered without handler
- [ ] Test: Error message includes render path for debugging
- [ ] Test: Search widget can include ancestor as result
- [ ] Test: Traversal helpers work correctly with cycles

## Migration Effort

**Views requiring update:**
- `container_view` - renders children in spatial layout
- Any custom container-style views

**Views NOT requiring update:**
- `note_view` - doesn't render children
- `code_view` - doesn't render children
- `script_view` - doesn't render children
- View-specs (declarative) - rendered by `generic_view`, which doesn't recurse into children
- Simple leaf views

## Future Considerations

- **Cycle visualization**: A debug view that highlights cycles in the item graph
- **Configurable cycle markers**: Global style for cycle markers vs per-view
- **Cycle-aware queries**: `api.query()` options to include/exclude cyclic paths
