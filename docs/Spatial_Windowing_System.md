# Spatial Windowing System

**Last Updated:** 2026-01-13

---

## Overview

Containers in Hobson render their attachments as positioned, draggable windows on a 2D canvas rather than in a linear list. This enables spatial organization that matches how people naturally organize information - multiple items visible simultaneously, persistent layouts, direct manipulation.

**Status:** Implemented in Session 8

---

## Core Design

### Containers as 2D Canvas

Containers provide a spatial workspace:

- Children are positioned at (x, y) coordinates
- Windows have width, height, z-index (stacking order)
- Users drag windows to reposition
- Click anywhere on window to bring to front
- Layouts persist across sessions

### Why Spatial vs Hierarchical?

**Spatial organization benefits:**

- Multiple items visible simultaneously (no context switching)
- Persistent layouts (muscle memory for locations)
- Direct manipulation (drag to organize)
- Natural mental model (physical desktop metaphor)
- No navigation hierarchy to remember

**Trade-offs:**

- More complex than linear lists
- Requires position persistence
- Mobile interaction model TBD
- Can become cluttered without discipline

**Decision:** Worth the complexity for desktop workflows. Mobile may use different container renderer.

---

## Data Model

### Positioned Children

Children evolved from simple ID arrays to positioned objects:

**Before (string format):**
```javascript
attachments: ["item-1", "item-2", "item-3"]
```

**After (positioned format):**
```javascript
attachments: [
  {
    id: "item-1",
    x: 20,           // Left position in pixels
    y: 20,           // Top position in pixels
    width: 400,      // Window width in pixels
    height: 300,     // Window height in pixels
    z: 0,            // Stacking order (higher = on top)
    minimized: false // Future: minimize functionality
  },
  {
    id: "item-2",
    x: 50,
    y: 50,
    width: 400,
    height: 300,
    z: 1,
    minimized: false
  }
]
```

### Backward Compatibility

The system handles both formats:
```javascript
const childId = typeof child === 'string' ? child : child.id;
const x = child.x || 0;  // Default for string format
```

Old string-format attachments work with default positioning (0, 0). They convert to object format on first interaction (drag, bring-to-front).

### Per-Child Renderer Selection

Positioned attachments can optionally specify which renderer to use:
```javascript
{
  id: "note-1",
  x: 20, y: 20, width: 400, height: 300, z: 0,
  renderer: "note_compact_renderer"  // Optional
}
```

If omitted, uses default renderer for that item's type. This allows different visualizations within the same container.

---

## Window Management

### Window Structure

Each child renders as a window with:

- **24px titlebar** - Shows item title, draggable
- **Content area** - Rendered item, scrollable
- **Absolute positioning** - CSS `position: absolute`
- **Z-index** - Stacking order

### Drag to Move

Mousedown on titlebar initiates drag:

1. Capture start mouse position
2. Read start window position from DOM
3. Attach global mousemove/mouseup listeners
4. On mousemove: update wrapper.style.left/top
5. On mouseup: save new position to database

**Why global listeners?**

Mouse can leave window during drag. Titlebar listeners only fire when over titlebar. Global listeners ensure drag completes properly.

### Click to Front

Clicking anywhere on window brings it to front (except titlebar, which drags):

1. Read fresh attachments from database
2. Calculate max z-index
3. If current z-index < max, increment to max + 1
4. Update wrapper.style.zIndex immediately
5. Save new z-index to database

**Why not always update z-index?**

Avoid unnecessary writes. If already on top, do nothing.

### Default Positioning

New attachments positioned diagonally to avoid overlap:
```javascript
const numChildren = parent.attachments.length;
const offset = numChildren * 30;

const newChild = {
  id: childId,
  x: 20 + offset,   // Diagonal stacking
  y: 20 + offset,
  width: 400,
  height: 300,
  z: numChildren,
  minimized: false
};
```

---

## Silent Updates

**Problem:** Dragging a window triggers position updates. If each update triggers a re-render, the DOM is destroyed mid-drag, breaking the interaction.

**Solution:** Two-tier update system:
```javascript
// Normal update - triggers re-render
await api.update(item);

// Silent update - saves without re-render
await api.updateSilent(item);
```

### When to Use Silent Updates

- Position updates during drag
- Z-index updates when bringing to front
- Any change where re-render would be jarring

### When NOT to Use Silent Updates

- Adding/removing attachments (need to show new elements)
- Content changes (need to reflect in UI)
- Type changes (might need different renderer)

### The Trade-off

Silent updates preserve DOM state (scroll, focus, textarea cursor) but create stale closure problem. Handlers must read fresh data from database.

---

## Stale Closure Prevention

**The Problem:**

Event handlers capture data at render time:
```javascript
const attachments = item.attachments;  // Snapshot at render time

titlebar.onmousedown = () => {
  const maxZ = Math.max(...attachments.map(c => c.z));  // Uses stale data!
};
```

After silent updates, database has current state but closure has old state. This caused multiple bugs:

- Windows jumping to wrong positions
- Z-index calculations using stale data
- Position updates reverting other windows

**The Solution:**

Always read fresh data from database in event handlers:
```javascript
titlebar.onmousedown = async () => {
  const freshItem = await api.get(item.id);  // Current state
  const freshChildren = freshItem.attachments;
  const maxZ = Math.max(...freshChildren.map(c => c.z));
};
```

**Critical locations:**

- `updateChild()` function - MUST read fresh attachments
- Click-to-front handler - MUST read fresh z-indices
- Drag end handler - MUST read fresh state

**Red flags:**

- Variables captured from outer scope used in async handlers
- Array/object snapshots used for database updates
- Calculations based on "current" data that might be stale

---

## Scroll State Preservation

**Problem:** When re-renders are necessary (adding/removing windows), scroll positions are lost.

**Solution:** Save and restore scroll state across re-renders.

### Implementation
```javascript
// Before re-render: Save scroll positions keyed by item ID
const scrollStates = new Map();
const windows = mainView.querySelectorAll('[data-item-id]');
windows.forEach(wrapper => {
  const itemId = wrapper.getAttribute('data-item-id');
  const content = wrapper.querySelector('.window-content');
  if (content) {
    scrollStates.set(itemId, {
      scrollTop: content.scrollTop,
      scrollLeft: content.scrollLeft
    });
  }
});

// Render new DOM
const domNode = await this.renderItem(itemId);
mainView.innerHTML = "";
mainView.appendChild(domNode);

// After re-render: Restore scroll positions
setTimeout(() => {
  const newWindows = mainView.querySelectorAll('[data-item-id]');
  newWindows.forEach(wrapper => {
    const itemId = wrapper.getAttribute('data-item-id');
    const saved = scrollStates.get(itemId);
    if (saved) {
      const content = wrapper.querySelector('.window-content');
      if (content) {
        content.scrollTop = saved.scrollTop;
        content.scrollLeft = saved.scrollLeft;
      }
    }
  });
}, 0);
```

### Key Points

- Use `data-item-id` attribute for stable tracking (not DOM position or index)
- Use `.window-content` class for consistent selector
- `setTimeout(..., 0)` ensures DOM is fully rendered before restoration
- Map keyed by item ID handles reordering gracefully

### Applies To

The same pattern works for:
- Focus state (which element has focus)
- Text selection ranges
- Textarea cursor positions
- Any DOM state that should persist

---

## Link Navigation

**Problem:** Markdown links in notes would traditionally navigate to new root, destroying entire workspace.

**Solution:** `api.openSibling()` opens linked item as sibling window in current workspace.
```javascript
// In markdown renderer
link.onclick = (e) => {
  e.preventDefault();
  api.openSibling(itemId);  // Opens as window in workspace
};
```

Not:
```javascript
api.navigate(itemId);  // Would destroy entire workspace
```

This preserves spatial layout - clicking a link adds a new window rather than replacing the view.

---

## Implementation Patterns

### The parseInt Zero Trap

**Problem:** `parseInt("0px") || fallback` treats 0 as falsy.
```javascript
// WRONG - window at x=0 jumps to fallback
const x = parseInt(wrapper.style.left) || 50;

// CORRECT - 0 is a valid position
const leftPx = parseInt(wrapper.style.left);
const x = isNaN(leftPx) ? 50 : leftPx;
```

**Why this matters:**

- Window at (0, 0) is valid position
- `||` operator treats 0 as falsy, triggers fallback
- `isNaN()` check correctly detects parse failure

**Pattern to use:**
```javascript
const parsed = parseInt(string);
const value = isNaN(parsed) ? defaultValue : parsed;
```

### Reading Position from DOM

When starting a drag, read current position from DOM (not from closure):
```javascript
// Read from DOM using isNaN check
const leftPx = parseInt(wrapper.style.left);
const topPx = parseInt(wrapper.style.top);
const startLeft = isNaN(leftPx) ? x : leftPx;
const startTop = isNaN(topPx) ? y : topPx;
```

This ensures you're using actual current position, not stale render-time data.

### Updating Multiple Properties Together

When dragging, you might need to update both position AND z-index:
```javascript
// Single save with all updates
const updates = { 
  x: newX, 
  y: newY,
  width: width,   // Include for string-to-object conversion
  height: height,
  z: needsZUpdate ? maxZ + 1 : currentZ
};

await updateChild(childId, updates);
```

Avoids multiple sequential database writes. Include all properties for complete data (especially when converting string to object format).

---

## Future Enhancements

### Pinning

**Decided but not implemented:**

Windows can be pinned to prevent accidental movement:

- Pin icon in titlebar
- Pinned windows ignore drag events
- Pinned windows show visual indicator
- Can be unpinned and repositioned

**Implementation:** Add `pinned: boolean` to positioned child, check in drag handler.

### Resizing

Windows currently have fixed size. Future: drag corners/edges to resize:

- Resize handles on borders
- Min/max size constraints
- Save new size to database
- Potentially complex with different content aspect ratios

### Minimize/Maximize

- Minimize: Collapse to titlebar only
- Maximize: Fill entire container
- Toggle between states
- Store state in `minimized` property

### Window Chrome

Additional UI elements:

- Close button (remove child from parent)
- Window menu (duplicate, move to container, etc)
- Status bar (show item type, metadata)

### Keyboard Shortcuts

- Escape to close active window
- Tab to cycle through windows
- Arrow keys to move window
- Ctrl+arrows to resize window

### Multi-Select

Select multiple windows and operate on them together:

- Shift+click to add to selection
- Drag selection box to select multiple
- Move/resize/close selected windows as group

### Canvas Zoom/Pan

For large workspaces:

- Zoom in/out to see more/less
- Pan across large canvas
- Minimap for navigation

---

## Mobile Considerations

**Current approach:** 2D canvas is desktop-focused. Mobile should use different container renderer.

**Why separate?**

- Touch interactions differ from mouse (gestures vs clicks)
- Screen size limits spatial organization
- Mobile benefits from focused, single-item views

**Strategy:**

Create mobile-specific containers:

- `my_notes_desktop`: Tag browser + search + spatial canvas
- `my_notes_mobile`: Linear list with swipe navigation

Both reference same underlying items, just render differently.

**NOT responsive design** - different containers for different contexts is more flexible and simpler than trying to make one container work everywhere.

---

## Docking Considerations

**Explored and deferred:**

Traditional docked panels (left/right/top/bottom edges) were considered:

**Why docking is appealing:**
- Automatic alignment
- Enforced boundaries
- Resize in lockstep

**Why deferred:**
- Complex implementation (resize algorithms, edge conflicts)
- Mixed mode complexity (docked + floating windows)
- Pinning provides similar benefit (spatial stability)
- Can be added later if need emerges

**Current approach:** Spatial positioning with optional pinning achieves similar goals with less complexity.

---

## Design Rationale

### Why Spatial Over Hierarchical?

**Considered:** Traditional tree/list navigation.

**Rejected:** 
- Context switching cost (back/forward navigation)
- Single focus (one item at a time)
- Loses spatial relationships
- No muscle memory for locations

**Accepted:** Spatial canvas with multiple visible windows.

**Trade-off:** More complex implementation for better UX.

### Why Positioned Objects Over Strings?

**Considered:** Storing layout separately from attachments array.

**Rejected:**
- Duplicates data (attachments array + separate layout)
- Synchronization issues (what if child removed but layout entry remains?)
- More complex queries (fetch item, then fetch layout)

**Accepted:** Position data lives with child reference. Single source of truth.

**Backward compatibility:** Gracefully handles old string format, converts on first update.

### Why Silent Updates?

**Considered:** Re-rendering on every change.

**Rejected:**
- DOM destruction breaks drag interactions
- Scroll positions lost
- Focus state lost
- Jarring user experience

**Accepted:** Two-tier update system (normal + silent).

**Trade-off:** Silent updates create stale closure problem, but preserving DOM state is worth it.

---

## Bugs Fixed During Development

### 1. Drag Snap-Back

**Problem:** Windows snapped to wrong position when starting drag.

**Cause:** Reading position from stale closure instead of DOM.

**Fix:** Read current position from `wrapper.style.left/top` using `isNaN()` check.

### 2. Z-Index Inconsistency

**Problem:** Click-to-front worked once then stopped.

**Cause:** Using stale closure of attachments array for maxZ calculation.

**Fix:** Read fresh attachments from database in click handler.

### 3. Position Jumping

**Problem:** Windows jumped when adding new windows.

**Cause:** `updateChild()` using stale attachments snapshot.

**Fix:** Read fresh item from database before updating.

### 4. Scroll Loss on Link Click

**Problem:** Scroll position lost when clicking links.

**Cause:** `api.openSibling()` triggering full re-render.

**Fix:** Scroll state preservation in `renderRoot()`.

### 5. ParseInt Zero Trap

**Problem:** Windows at x=0 or y=0 jumping to defaults.

**Cause:** `parseInt("0px") || default` treating 0 as falsy.

**Fix:** Use `isNaN(parsed) ? default : parsed` pattern.

---

## Cross-References

- For container renderer implementation, see Technical_Implementation_Notes.md Section 13
- For stale closure antipattern, see PROJECT_MEMORY.md
- For multiple renderers per type, see Rendering_and_Editing.md
- For tag browser + search in containers, see Tags_and_Classification.md
