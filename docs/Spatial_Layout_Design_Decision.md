# Spatial Layout Design Decision

**Date:** 2026-01-26  
**Status:** Approved

---

## Summary

Remove the specific `container` type and make spatial layout a universal rendering option available for any item with attachments. The description field is displayed as a floating banner that can be positioned and collapsed according to user preference.

---

## Core Decision: Remove Container as Special Type

### Current State
- Specific `container` type exists in the type system
- `container_renderer` provides 2D spatial windowing
- Architecture already supports children on ALL items

### New State
- No specific `container` type
- `spatial_layout` renderer works with **any item that has attachments**
- Spatial organization emerges from renderer choice, not type distinction

### Rationale

1. **Aligns with Radical Uniformity**: The kernel already states "any item can contain other items" - the type system shouldn't contradict this
2. **Enables Emergent Behavior**: Notes, projects, tags - any type can be viewed spatially when useful
3. **Supports Continuous Evolution**: Users can start with simple items and progressively add attachments without reclassifying
4. **Follows Renderer Philosophy**: Presentation is chosen by parent, not baked into item types
5. **Reduces Conceptual Overhead**: One less type to learn, one less decision point
6. **Honors Humane Dozen Principles**:
   - **Modifiable**: Can switch any item to spatial view mid-stream
   - **Transparent**: Capability is universal, not hidden behind type distinction
   - **Continuous**: No need to "convert" items between states

---

## Description Handling in Spatial Layout

### The Problem

Any item can have `content.description`, but spatial layout is about organizing children. How should description be displayed?

### Solution: Floating Banner with Flexible Positioning

Description is displayed as a **banner** that:
- Floats as a z-index layer (background)
- Windows can overlap it (user choice)
- Can be collapsed to minimize space
- Can be positioned at top/bottom/left/right

---

## Banner Design Specification

### Layering Model (Z-Index Based)

```
Z-Index Layers:
- Banner: z-index 0 (background layer)
- Canvas: z-index 1 (contains windows)
- Windows: z-index 2+ (foreground, incrementing)
```

**Key principle:** Banner is always an overlay, regardless of position. Windows are positioned relative to the **full viewport**, not canvas-minus-banner.

### Coordinate System

Window positions are **always relative to full viewport**:

- **Top banner**: Window at `y=0` overlaps banner
- **Bottom banner**: Window at `y=maxHeight` overlaps banner  
- **Left banner**: Window at `x=0` overlaps banner
- **Right banner**: Window at `x=maxWidth` overlaps banner

**User agency**: User decides whether to position windows to avoid banner or intentionally overlap it.

### Banner Positions

```
┌─────────────────────────────┐
│ TOP: ▼ Description          │
├─────────────────────────────┤
│  [Window 1]    [Window 2]   │
│         [Window 3]          │
└─────────────────────────────┘

┌─────────────────────────────┐
│  [Window 1]    [Window 2]   │
│         [Window 3]          │
├─────────────────────────────┤
│ BOTTOM: ▼ Description       │
└─────────────────────────────┘

┌───┬─────────────────────────┐
│ L │ [Window 1] [Window 2]   │
│ E │                         │
│ F │    [Window 3]           │
│ T │                         │
└───┴─────────────────────────┘

┌─────────────────────────┬───┐
│ [Window 1] [Window 2]   │ R │
│                         │ I │
│    [Window 3]           │ G │
│                         │ H │
└─────────────────────────┴───┘
```

### Banner States

1. **Expanded**: Full description visible (default if description exists)
2. **Collapsed**: Minimal space showing only expand control
3. **Hidden**: No banner rendered (when no description)

```
Expanded:
┌────────────────────────────┐
│ ▼ Description      [⚙][×] │
│ Full text here...          │
└────────────────────────────┘

Collapsed:
┌────────────────────────────┐
│ ▶ Description      [⚙][×] │
└────────────────────────────┘
```

### CSS Guidelines

**Horizontal banners (top/bottom):**
```css
.banner-horizontal {
  width: 100%;
  height: auto;
  min-height: 40px;      /* Collapsed */
  max-height: 30vh;      /* Expanded */
  overflow-y: auto;
}
```

**Vertical banners (left/right):**
```css
.banner-vertical {
  height: 100%;
  width: auto;
  min-width: 40px;       /* Collapsed */
  max-width: 30vw;       /* Expanded */
  overflow-x: auto;
  writing-mode: horizontal-tb;
}
```

---

## State Persistence

Banner position and collapse state are **presentation metadata**, stored in:

### For Nested Items
In parent's child specification:
```javascript
{
  id: "child-123",
  renderer: "spatial_layout",
  bannerPosition: "left",     // "top" | "bottom" | "left" | "right"
  bannerCollapsed: false,
  x: 0, y: 0, 
  width: 800, 
  height: 600
}
```

### For Root Items
In viewport state:
```javascript
viewport.state = {
  rootId: "workspace-abc",
  renderer: "spatial_layout",
  bannerPosition: "right",
  bannerCollapsed: false
}
```

---

## User Interface

### Banner Controls

**Settings icon** in banner corner opens menu:
```
Banner Settings ▸
  ├─ Position
  │   ├─ ☑ Top
  │   ├─ ☐ Bottom
  │   ├─ ☐ Left
  │   └─ ☐ Right
  ├─ [✓] Expanded
  └─ [×] Hide Banner
```

**Direct controls:**
- Click `▼`/`▶` to toggle expanded/collapsed
- Click `[×]` to hide banner entirely
- Click `[⚙]` for position menu

### Context Menu Integration

Right-click on item → "Display As..." → "Spatial Layout"
- Works for any item with attachments (or that could have attachments)
- No longer requires item to be "container" type

---

## Benefits

### For Users

1. **Maximum flexibility**: Position banner where it's most useful
2. **Full canvas space**: Windows can use entire viewport
3. **User agency**: Complete control over layout and visibility
4. **Progressive disclosure**: Description there when needed, hidden when not
5. **Accessibility**: Position text where it's most readable

### For System

1. **Simpler type system**: One less seed item, one less concept
2. **Emergent complexity**: Sophisticated layouts from simple rules
3. **Universal capability**: Any item can grow into spatial organization
4. **Consistent with architecture**: Renderer choice, not type constraint

---

## Use Cases

### Notes with Spatial Children
```javascript
{
  type: "note",
  content: {
    description: "# Project X\n\nOverview of the project...",
  },
  attachments: [
    {id: "meeting-notes", x: 20, y: 50, ...},
    {id: "todo-list", x: 450, y: 50, ...},
    {id: "resources", x: 20, y: 400, ...}
  ]
}
```
View as: Text (for editing) OR Spatial (for organizing)

### Pure Spatial Workspace
```javascript
{
  type: "workspace",  // or just "note" with no description
  attachments: [
    {id: "project-a", x: 20, y: 20, ...},
    {id: "project-b", x: 500, y: 20, ...}
  ]
}
```
No banner (no description) → full canvas space

### Tagged Items Browser
```javascript
{
  type: "tag",
  content: {
    name: "Important",
    description: "Items tagged as important for Q1 review"
  },
  attachments: [/* tagged items */]
}
```
View as: List OR Spatial layout with context banner

---

## Implementation Notes

### Flexbox Container Structure

```javascript
const container = createElement('div', {
  class: 'spatial-view',
  style: `display: flex; 
          flex-direction: ${isHorizontal ? 'column' : 'row'};
          width: 100%; 
          height: 100%;`
});
```

### Rendering Order

```javascript
if (position === 'top' || position === 'left') {
  container.appendChild(banner);
  container.appendChild(canvas);
} else {
  container.appendChild(canvas);
  container.appendChild(banner);
}
```

### Window Overlap Detection (Optional Future)

Could add visual feedback when windows overlap banner:
- Fade banner slightly
- Add "windows covering description" indicator
- Provide "auto-arrange to reveal banner" helper

---

## Migration Path

1. **Deprecate `container` type**: Mark as deprecated, add notice pointing to spatial_layout renderer
2. **Create `spatial_layout` renderer**: Works with any item type
3. **Update default workspace**: Can remain typed as anything (suggest `workspace` or generic `note`)
4. **Update documentation**: Explain "any item can be viewed spatially"
5. **Add banner position controls**: Settings icon and menu
6. **Preserve existing layouts**: Existing container items continue working (just using new renderer)

---

## Design Philosophy

This decision embodies core Hobson principles:

- **Radical Uniformity**: All items can contain attachments, all can be viewed spatially
- **User Agency**: Complete control over layout, positioning, visibility
- **Emergent Complexity**: Sophisticated organization from simple, uniform rules
- **Modifiable**: Switch views mid-stream, no commitment to "container-ness"
- **Inspectable**: Description always accessible, just sometimes overlapped
- **Transparent**: No hidden type distinctions, what you see is what exists

---

## Open Questions

1. **Default banner position**: Top (most familiar), or user preference?
2. **Visual feedback**: Should windows have subtle highlight when overlapping banner?
3. **Auto-positioning**: Should there be an "auto-arrange" helper to avoid banner?
4. **Mobile**: Different defaults for portrait/landscape orientations?
5. **Banner width/height**: Fixed or resizable? (Current: max 30% viewport)

---

## Related Documents

- **Design_Decisions_Log.md**: Section 9 (Containers and Hierarchical Rendering)
- **Technical_Overview.md**: Section on Spatial Windowing
- **Rendering_and_Editing_System.md**: Parent-controlled renderer selection
- **Humane Dozen PDF**: Source of design principles

---

## Revision History

| Date | Change |
|------|--------|
| 2026-01-26 | Initial decision: Remove container type, add flexible banner positioning |
