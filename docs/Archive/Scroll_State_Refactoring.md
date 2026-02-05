# Scroll State Management Refactoring

**Date**: 2026-01-16
**Summary**: Moved scroll position preservation from kernel to viewport_renderer

## Problem

The kernel's `renderRoot()` method contained scroll state management code (lines 1123-1159) that violated the minimal kernel principle:

```javascript
// Before: Kernel saved and restored scroll positions
const scrollStates = new Map();
const windows = mainView.querySelectorAll('[data-item-id]');
windows.forEach(wrapper => {
  const wId = wrapper.getAttribute('data-item-id');
  const contentDiv = wrapper.querySelector('.window-content');
  if (contentDiv) {
    scrollStates.set(wId, {
      scrollTop: contentDiv.scrollTop,
      scrollLeft: contentDiv.scrollLeft
    });
  }
});
// ... render ...
// ... then restore scroll positions
```

### Why This Was Wrong

1. **Too implementation-specific** - Kernel assumed specific DOM structure (`.window-content` class)
2. **Violates separation of concerns** - UI behavior belongs in renderers, not kernel
3. **Contradicts design principles** - Minimal UI should be "eventually replaced by UI items"
4. **Wrong abstraction level** - Scroll state is ephemeral UI state, not part of item model

According to `docs/Design_Decisions_Log.md`, the kernel should only:
- Look up renderer items for types
- Walk type chain to find appropriate renderer
- Execute renderer code and display results
- Handle errors

The kernel should handle **what** to render, not **how** the UI behaves.

## Solution

### 1. Removed from Kernel (src/hobson.html:1115-1133)

The `renderRoot()` method now only handles core responsibilities:

```javascript
async renderRoot(itemId) {
  this.viewport.setRoot(itemId);
  await this.viewport.persist();

  const mainView = document.getElementById("main-view");

  try {
    const domNode = await this.renderItem(IDS.VIEWPORT);
    mainView.innerHTML = "";
    mainView.appendChild(domNode);
  } catch (error) {
    console.error("Render error:", error);
    mainView.innerHTML = "";
    mainView.appendChild(this.createErrorView(error, itemId));
  }
}
```

### 2. Added to Viewport Renderer (viewport_renderer item)

The viewport_renderer now manages scroll state as part of its rendering logic:

```javascript
export async function render(item, api) {
  // SCROLL STATE MANAGEMENT
  // Save scroll positions from existing DOM before re-rendering
  const scrollStates = new Map();
  const existingMainView = document.getElementById("main-view");
  if (existingMainView) {
    const existingElements = existingMainView.querySelectorAll('[data-item-id]');
    existingElements.forEach(wrapper => {
      const itemId = wrapper.getAttribute('data-item-id');
      const contentDiv = wrapper.querySelector('.window-content');
      if (contentDiv) {
        scrollStates.set(itemId, {
          scrollTop: contentDiv.scrollTop,
          scrollLeft: contentDiv.scrollLeft
        });
      }
    });
  }

  // ... render viewport content ...

  // SCROLL STATE RESTORATION
  // Restore scroll positions after the new DOM is inserted by the kernel
  if (scrollStates.size > 0) {
    setTimeout(() => {
      scrollStates.forEach((state, itemId) => {
        const wrapper = container.querySelector('[data-item-id="' + itemId + '"]');
        if (wrapper) {
          const contentDiv = wrapper.querySelector('.window-content');
          if (contentDiv) {
            contentDiv.scrollTop = state.scrollTop;
            contentDiv.scrollLeft = state.scrollLeft;
          }
        }
      });
    }, 0);
  }

  return container;
}
```

### 3. Update Script

Created `src/REPL Scripts/update_viewport_renderer_with_scroll_management.js` to apply the update to the running system.

## Benefits

1. **Cleaner kernel** - Kernel now only handles core rendering pipeline
2. **Proper abstraction** - UI behavior is in UI code (renderer), not framework code (kernel)
3. **Maintainable** - Scroll management can be modified without touching kernel
4. **Exemplifies design** - Demonstrates building sophisticated UI features as items

## Implementation Notes

**Timing**: The renderer captures scroll state from the existing DOM (which is still in place when `render()` is called) and schedules restoration via `setTimeout()` after the kernel inserts the new DOM.

**Scope**: Scroll state is captured for all elements with `data-item-id` attributes that contain `.window-content` divs (typically used by container_renderer for windowed items).

## Files Changed

- `src/hobson.html` - Removed scroll management from kernel's `renderRoot()` method
- `src/REPL Scripts/update_viewport_renderer_with_scroll_management.js` - Script to update viewport_renderer item
- `docs/Scroll_State_Refactoring.md` - This document

## Related Design Decisions

See `docs/Design_Decisions_Log.md` Section 2 (Kernel Architecture) for the principle that kernel should provide minimal runtime environment, with UI details handled by code items.
