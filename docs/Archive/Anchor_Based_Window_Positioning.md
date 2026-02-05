# Anchor-Based Window Positioning

*Design Document — January 2026*

---

## Problem Statement

The `container_view` displays attachments as draggable windows on a 2D spatial canvas. Users assemble "task-specific workspaces" by positioning windows, but these layouts break when the container resizes because positions are stored as absolute pixel offsets from the top-left corner.

The current "Dock Left/Right/Top/Bottom" menu options position windows flush against edges with filled height/width, but this is a one-time positioning operation — the relationship to the edge is not preserved.

---

## Design Overview

Introduce **anchor-based positioning** where windows can declare which corner or edge they're positioned relative to. The system recalculates absolute positions on container resize to maintain the declared relationship.

Two user-facing concepts:

| Concept | Meaning | Anchor Behavior |
|---------|---------|-----------------|
| **Pin** | "Keep this window in this area" | Corner anchor, maintains offset from nearest corner |
| **Dock** | "Attach to this edge" | Edge anchor + fill perpendicular axis |

Users don't need to understand anchors directly. Pin and Dock are the interactions; anchors are the implementation.

---

## Data Model

### View Properties

The `view` object in the parent's attachments array gains one optional property:

```javascript
{
  id: "child-item-id",
  view: {
    // Existing properties
    x: 100,
    y: 50,
    width: 400,
    height: 300,
    z: 0,
    minimized: false,
    maximized: false,
    
    // New anchor property
    anchor: 'top-left'    // Which corner/edge position is relative to
  }
}
```

### Anchor Values

**Corner anchors** (for pinned floating windows):
- `top-left` (default/implicit when no anchor specified)
- `top-right`
- `bottom-left`
- `bottom-right`

**Edge anchors** (for docked windows):
- `left` — flush to left edge, vertically centered
- `right` — flush to right edge, vertically centered
- `top` — flush to top edge, horizontally centered
- `bottom` — flush to bottom edge, horizontally centered

### Position Interpretation

The meaning of `x` and `y` depends on the anchor:

| Anchor | x means | y means |
|--------|---------|---------|
| `top-left` | offset from left | offset from top |
| `top-right` | offset from right | offset from top |
| `bottom-left` | offset from left | offset from bottom |
| `bottom-right` | offset from right | offset from bottom |
| `left` | offset from left (usually 0) | ignored (centered or filled) |
| `right` | offset from right (usually 0) | ignored (centered or filled) |
| `top` | ignored (centered or filled) | offset from top (usually 0) |
| `bottom` | ignored (centered or filled) | offset from bottom (usually 0) |

### Fill Behavior

Fill behavior is determined by anchor type — no additional properties needed:

- **Corner anchors** (`top-left`, `top-right`, `bottom-left`, `bottom-right`): maintain width and height
- **Edge anchors** (`left`, `right`): maintain width, fill container height
- **Edge anchors** (`top`, `bottom`): maintain height, fill container width

---

## User Interactions

### Pin

**Action:** User clicks pin icon (or selects Pin from context menu)

**Behavior:**
1. Calculate which quadrant the window's center falls in
2. Set `anchor` to the nearest corner
3. Convert `x`/`y` to offsets from that corner

**Algorithm:**
```javascript
function pinWindow(view, containerWidth, containerHeight) {
  const centerX = view.x + view.width / 2;
  const centerY = view.y + view.height / 2;
  
  const anchorX = centerX < containerWidth / 2 ? 'left' : 'right';
  const anchorY = centerY < containerHeight / 2 ? 'top' : 'bottom';
  const anchor = `${anchorY}-${anchorX}`;
  
  // Convert position to offset from anchor corner
  const newX = anchorX === 'left' ? view.x : containerWidth - view.x - view.width;
  const newY = anchorY === 'top' ? view.y : containerHeight - view.y - view.height;
  
  return {
    ...view,
    anchor,
    x: newX,
    y: newY
  };
}
```

**Visual feedback:** Pin icon filled/highlighted when window is pinned.

### Unpin

**Action:** User clicks pin icon on a pinned window (or selects Unpin from context menu)

**Behavior:**
1. Convert anchor-relative position back to absolute (top-left) position
2. Remove `anchor` property (or set to `top-left`)

### Dock Left/Right/Top/Bottom

**Action:** User selects Dock → Left from context menu

**Behavior for Dock Left:**
```javascript
{
  anchor: 'left',
  x: 0,
  y: 0,
  width: view.width  // preserve existing width
}
```

**Behavior for Dock Right:**
```javascript
{
  anchor: 'right',
  x: 0,
  y: 0,
  width: view.width
}
```

**Behavior for Dock Top:**
```javascript
{
  anchor: 'top',
  x: 0,
  y: 0,
  height: view.height
}
```

**Behavior for Dock Bottom:**
```javascript
{
  anchor: 'bottom',
  x: 0,
  y: 0,
  height: view.height
}
```

**Visual feedback:** Docked windows should not show drag cursor on titlebar (dragging is disabled while docked).

### Undock

**Action:** User selects Undock from context menu (or double-clicks titlebar?)

**Behavior:**
1. Convert current position to absolute top-left coordinates
2. If edge-anchored, capture current rendered height/width
3. Remove `anchor` property (reverts to implicit `top-left`)
4. Window becomes freely draggable

---

## Rendering

### Position Calculation

When rendering a window, convert anchor-relative position to absolute CSS coordinates:

```javascript
function calculateAbsolutePosition(view, containerWidth, containerHeight) {
  const anchor = view.anchor || 'top-left';
  
  // Edge anchors fill perpendicular axis; corner anchors maintain size
  const isHorizontalEdge = anchor === 'top' || anchor === 'bottom';
  const isVerticalEdge = anchor === 'left' || anchor === 'right';
  const width = isHorizontalEdge ? containerWidth : view.width;
  const height = isVerticalEdge ? containerHeight : view.height;
  
  let left, top;
  
  if (anchor === 'top-left') {
    left = view.x;
    top = view.y;
  } else if (anchor === 'top-right') {
    left = containerWidth - view.x - width;
    top = view.y;
  } else if (anchor === 'bottom-left') {
    left = view.x;
    top = containerHeight - view.y - height;
  } else if (anchor === 'bottom-right') {
    left = containerWidth - view.x - width;
    top = containerHeight - view.y - height;
  } else if (anchor === 'left') {
    left = view.x;
    top = 0;
  } else if (anchor === 'right') {
    left = containerWidth - view.x - width;
    top = 0;
  } else if (anchor === 'top') {
    left = 0;
    top = view.y;
  } else if (anchor === 'bottom') {
    left = 0;
    top = containerHeight - view.y - height;
  }
  
  return { left, top, width, height };
}
```

### Resize Observation

The `container_view` must observe its own size changes and re-render attachments when dimensions change. Use `ResizeObserver`:

```javascript
const resizeObserver = new ResizeObserver(entries => {
  for (const entry of entries) {
    // Re-render attachments with new container dimensions
    rerenderChildren(entry.contentRect.width, entry.contentRect.height);
  }
});
resizeObserver.observe(containerElement);
```

**Important:** This should update CSS positions without full re-render to avoid losing scroll state and other transient DOM state.

---

## Drag Behavior

### Pinned Windows

Dragging a pinned window should:
1. Update position relative to current anchor during drag
2. On drag end, recalculate nearest corner and possibly change anchor

Or simpler: dragging unpins automatically. User must re-pin after repositioning.

**Recommendation:** Dragging unpins automatically. This is simpler and matches user expectation — if I drag something, I'm taking manual control.

### Docked Windows

Docked windows cannot be dragged. The titlebar should not show a move cursor. User must explicitly Undock first.

---

## Migration

Existing windows without `anchor` property default to `anchor: 'top-left'` behavior, which matches current absolute positioning. No data migration required.

Existing "pinned" windows (using current `pinned: true` flag) should be migrated:
- If `pinned: true`, calculate appropriate corner anchor based on position
- Remove `pinned` property after migration

---

## UI Considerations

### Pin Icon

Current pin icon toggles `pinned: true/false`. New behavior:
- Unpinned → Click → Calculate nearest corner, set anchor
- Pinned → Click → Convert to absolute position, remove anchor

Icon appearance:
- Unpinned: outline pin icon
- Pinned: filled pin icon (indicate which corner? probably overkill)

### Context Menu

Update Dock submenu:
- Dock Left
- Dock Right  
- Dock Top
- Dock Bottom
- Undock (only shown if currently docked)

Pin/Unpin could be in context menu as well as icon.

### Docked Window Chrome

Consider visual distinction for docked windows:
- No drag cursor on titlebar
- Maybe subtle edge highlight showing which edge it's docked to?
- Resize handle only on the non-docked edge (e.g., right edge for left-docked)

---

## Future Considerations

### Split Docking

This design handles single-window docking. It does not handle:
- Multiple windows docked to same edge (stacking)
- Splitters between docked windows
- Proportional splits

These would require a more sophisticated layout system, possibly a separate `split_view` or `tiled_view` container type.

### Snap-to-Grid

Could complement anchoring with optional snap behavior during drag, helping users align windows without precise positioning.

### Layout Presets

Save and restore complete window arrangements. Orthogonal to anchoring but synergistic — anchored layouts resize better when restored to different-sized containers.
