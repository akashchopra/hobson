# Phase 3 - Partial Re-render

**Status: Implemented**

## Overview

Re-render a specific item in place without affecting siblings or parent. This avoids the full viewport re-render that currently causes editor state loss, scroll resets, and focus issues.

## Design

### Key Insight

The Phase 2 registry tracks which DOM node corresponds to which item render. To partially re-render:

1. Find the instance(s) for the target item
2. Re-execute the view to get new DOM
3. Replace the old DOM content with new DOM
4. Preserve the wrapper/container (position, size, etc.)

### The Container Problem

Views produce DOM that gets placed into containers by their parents. For example:
- Viewport creates a window wrapper with titlebar, then puts the root item's DOM inside
- Spatial container creates positioned divs, puts each child's DOM inside

The rendered DOM from `renderItem()` is the **content**. The parent view creates the **container**.

For partial re-render to work, we need to:
1. Keep the container (parent-managed wrapper)
2. Replace only the content (item's rendered DOM)

### Implementation Approach

Add a `rerenderItem(itemId)` method that:

```javascript
async rerenderItem(itemId, options = {}) {
  // Find existing instance(s) for this item
  const instances = this.registry.getByItemId(itemId);

  if (instances.length === 0) {
    // Not currently rendered - nothing to update
    return { updated: 0 };
  }

  let updated = 0;
  for (const instance of instances) {
    // Re-render with same view
    const newDom = await this.renderItem(itemId, instance.viewId, {}, {
      parentId: instance.parentId
    });

    // Replace content in existing container
    const oldDom = instance.domNode;
    if (oldDom.parentNode) {
      oldDom.parentNode.replaceChild(newDom, oldDom);
      updated++;
    }

    // Unregister old instance (new one was registered by renderItem)
    this.registry.unregister(instance.instanceId);
  }

  return { updated };
}
```

### Considerations

**Multiple instances**: An item can be rendered multiple times (in different containers or with different views). `rerenderItem()` updates all instances.

**View consistency**: We re-render with the same view that was originally used, preserving view overrides.

**Context preservation**: The parentId is passed through so the new render has correct context.

**Registry cleanup**: Old instance is unregistered after replacement; new instance was auto-registered by `renderItem()`.

## API Surface

**Renderer API** (for views):
```javascript
api.rerenderItem(itemId)  // Re-render specific item in place
```

**REPL API** (for debugging/testing):
```javascript
api.rerenderItem(itemId)  // Same
```

## Integration Points

### kernel-rendering (33333333-5555-0000-0000-000000000000)

1. Add `rerenderItem(itemId, options)` method to `RenderingSystem`
2. Expose in renderer API as `api.rerenderItem()`

### kernel-core (33333333-1111-0000-0000-000000000000)

1. Add `rerenderItem()` to REPL API

## Testing

After implementation, test in REPL:

```javascript
// Make a change to an item
const item = await api.get(api.viewport.getRoot());
item.content.test = Date.now();
await api.set(item);  // Save without re-render

// Partial re-render just that item
await api.rerenderItem(item.id);
```

Compare with full re-render:
- Partial: Other windows keep their scroll position, editor state
- Full (`renderRoot`): Everything resets

## Future Enhancements

- `rerenderChildren(itemId)` - re-render all attachments of a container
- `rerenderByView(viewId)` - re-render all items using a specific view
- Integration with Phase 4 reactive watches
