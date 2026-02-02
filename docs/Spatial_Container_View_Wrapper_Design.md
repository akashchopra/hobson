# Spatial Canvas as View Wrapper

*Design Document — February 2026*

---

## Problem Statement

The `spatial-canvas-view` currently conflates two concerns:

1. **Spatial layout** — displaying children as draggable windows on a 2D canvas
2. **Content presentation** — rendering `content.description` in a resizable banner

This coupling limits the view's usefulness. If a code item has children, viewing it as a spatial container shows a description banner (which code items don't meaningfully have) rather than the syntax-highlighted code. The spatial layout capability is locked to one specific content presentation.

---

## Design Overview

Separate spatial layout from content presentation by making `spatial-canvas-view` a **view wrapper**:

- The view renders an **optional inner view** as a full-bleed background
- Children render as **draggable windows floating above** the background
- Any item type can use spatial layout while retaining its natural content view

### Before and After

**Before:** Spatial container = banner with description + window canvas

**After:** Spatial container = background (inner view) + floating windows

---

## Architecture

### View Composition

The wrapper view calls `api.renderItem()` to render the same item with a different view:

```javascript
export async function render(item, api) {
  const viewConfig = api.getViewConfig() || {};
  const innerViewConfig = viewConfig.innerView;
  
  // Background layer
  const background = api.createElement('div', {
    style: 'position: absolute; inset: 0; z-index: 0; overflow: auto;'
  });
  
  if (innerViewConfig) {
    // Render THIS item with the specified inner view
    const innerDom = await api.renderItem(item.id, innerViewConfig);
    background.appendChild(innerDom);
  }
  
  // Windows render above at z-index 1+
  // ... existing window logic ...
}
```

This requires no kernel changes — views can already render other views via `api.renderItem()`.

### DOM Structure

```
container (position: relative, 100% × 100%)
├── background (position: absolute, inset: 0, z-index: 0)
│   └── inner view DOM (or empty if no innerView)
└── window wrappers (position: absolute, z-index: 1+)
    ├── window 1
    ├── window 2
    └── ...
```

### View Config Structure

```javascript
// In parent's children array (or viewport root config)
{
  id: "some-note",
  view: {
    type: "spatial-canvas-view",
    
    // NEW: optional inner view for background
    innerView: {
      type: "note-view-editable"
      // ... any config the inner view needs
    }
  }
}

// The item's own children store window positions
{
  id: "some-note",
  children: [
    { id: "child-1", view: { type: "...", x: 50, y: 50, z: 0, ... } },
    { id: "child-2", view: { type: "...", x: 200, y: 100, z: 1, ... } }
  ]
}
```

### Z-Index Management

Windows must always appear above the background:

| Layer | Z-Index |
|-------|---------|
| Background (inner view) | 0 |
| Windows | 1 + child.view.z |
| Minimized tray | 1000 (unchanged) |

The existing relative z-index logic for windows remains unchanged; we simply add a base offset of 1 to ensure all windows are above the background.

---

## Behavior

### No Inner View (Default)

When `innerView` is not specified:
- Background div exists but is empty
- Behaves like current spatial container without the banner
- Clean canvas for arranging windows

### With Inner View

When `innerView` is specified:
- Background renders the item using that view
- Background is scrollable if inner content overflows
- Background receives pointer events (interactive)
- Windows float above background
- Clicking a window brings it to front (existing behavior)

### User Interaction

The inner view is fully interactive:
- Text selection works
- Links are clickable
- Editable views can be edited
- Scroll is independent of windows

Windows take precedence where they overlap:
- Natural z-index stacking handles this
- No special pointer-events manipulation needed

---

## User Interface

### Context Menu Changes

**Remove:**
- "Move Banner to Left"
- "Move Banner to Right"  
- "Move Banner to Top"
- "Move Banner to Bottom"

**Add** (when right-clicking background or container):

```
Set Background View...  →  ✓ note-view-editable
                           note-view-readonly
                           code-view-readonly
                           default_view (JSON)
                           ─────────────────────
                           Clear Background
```

### Menu Implementation

```javascript
async function buildBackgroundViewSubmenu(item, api, currentViewConfig) {
  const views = await api.getViews(item.type);
  const currentInner = currentViewConfig?.innerView?.type;
  
  const menuItems = views.map(view => ({
    label: view.content?.displayName || view.name,
    checked: view.id === currentInner,
    action: async () => {
      await api.updateViewConfig({ 
        innerView: { type: view.id } 
      });
      // Trigger re-render
    }
  }));
  
  if (currentInner) {
    menuItems.push({ separator: true });
    menuItems.push({
      label: 'Clear Background',
      action: async () => {
        await api.updateViewConfig({ innerView: null });
      }
    });
  }
  
  return menuItems;
}
```

---

## Implementation Plan

### Phase 1: Core Implementation

#### Task 1.1: Restructure DOM

Remove banner infrastructure, add background layer:

- Remove: `bannerPosition`, `bannerSize` handling
- Remove: Banner div, resize handle, description rendering
- Remove: Canvas area offset calculations
- Add: Background div with `position: absolute; inset: 0; z-index: 0`

#### Task 1.2: Render Inner View

```javascript
const background = api.createElement('div', {
  class: 'spatial-background',
  style: 'position: absolute; inset: 0; z-index: 0; overflow: auto;'
});

if (innerViewConfig) {
  const innerDom = await api.renderItem(item.id, innerViewConfig);
  background.appendChild(innerDom);
}

container.appendChild(background);
```

#### Task 1.3: Adjust Window Z-Index

Ensure all windows render above background:

```javascript
const baseZ = 1;

// When creating window
const windowZ = baseZ + (childView.z || 0);
wrapper.style.zIndex = windowZ;

// When bringing to front
const maxZ = Math.max(...children.map(c => c.view?.z || 0));
const newZ = maxZ + 1;
await updateChild(childId, { z: newZ });
wrapper.style.zIndex = baseZ + newZ;
```

#### Task 1.4: Update Context Menu

- Remove banner position menu items
- Add "Set Background View..." submenu
- Wire up view selection and clearing

#### Task 1.5: Clean Up Unused Code

Remove:
- `getBannerStyles()` function
- `getResizeHandleStyles()` function
- Banner resize drag handling
- Description markdown rendering

### Phase 2: Polish (if needed)

#### Task 2.1: Inner View State Persistence

If inner views need to persist their viewConfig state, enhance the context passed to inner render:

```javascript
// Create custom context for inner view
const innerContext = {
  ...context,
  viewConfig: innerViewConfig,
  updateViewConfig: async (updates) => {
    // Merge updates into innerView subobject
    const current = api.getViewConfig() || {};
    await api.updateViewConfig({
      innerView: { ...current.innerView, ...updates }
    });
  }
};
```

This is only needed for views that use `updateViewConfig()`. Most views persist state via `api.update(item)` and work without changes.

---

## Migration

### Backward Compatibility

**Existing spatial containers (no innerView):**
- Continue to work
- Background is empty (clean canvas)
- No visible change in behavior

**Existing config fields (bannerPosition, bannerSize):**
- Ignored (no effect)
- Remain in storage harmlessly
- Can be cleaned up in future migration if desired

**Items with content.description:**
- No longer auto-displayed
- User can set innerView to a view that displays it
- Or switch to a note-type view for the item

### No Data Migration Required

The change is purely in rendering logic. Existing data structures remain valid.

---

## Examples

### Note with Attachments

A note item with child items as related materials:

```javascript
{
  id: "meeting-notes",
  type: "note",
  content: { 
    title: "Q1 Planning",
    body: "## Agenda\n- Budget review\n- Roadmap..."
  },
  children: [
    { id: "budget-spreadsheet", view: { type: "...", x: 600, y: 50, ... } },
    { id: "roadmap-diagram", view: { type: "...", x: 600, y: 300, ... } }
  ]
}

// Viewed with:
view: {
  type: "spatial-canvas-view",
  innerView: { type: "note-view-editable" }
}
```

Result: Editable note fills the background; spreadsheet and diagram float as windows on the right.

### Code with Examples

A library item with example usage items as children:

```javascript
{
  id: "date-utils",
  type: "code",
  content: { 
    code: "export function formatDate(d) { ... }"
  },
  children: [
    { id: "example-1", view: { type: "...", x: 500, y: 50, ... } },
    { id: "example-2", view: { type: "...", x: 500, y: 250, ... } }
  ]
}

// Viewed with:
view: {
  type: "spatial-canvas-view",
  innerView: { type: "code-view-readonly" }
}
```

Result: Syntax-highlighted code in background; example items as windows alongside.

### Pure Workspace (No Background)

A container used purely for spatial arrangement:

```javascript
{
  id: "my-workspace",
  type: "container",
  children: [
    { id: "item-1", view: { ... } },
    { id: "item-2", view: { ... } }
  ]
}

// Viewed with:
view: {
  type: "spatial-canvas-view"
  // No innerView — empty background
}
```

Result: Clean canvas with windows only (current behavior).

---

## Future Possibilities

### Other Wrapper Views

The pattern generalizes. Other layout wrappers could include:

- **split-view** — Inner view on one side, single child on other
- **tabs-view** — Inner view as first tab, children as additional tabs
- **overlay-view** — Inner view with children as modal overlays

### Nested Wrappers

Nothing prevents wrappers from wrapping wrappers:

```javascript
view: {
  type: "spatial-canvas-view",
  innerView: {
    type: "split-view",
    innerView: { type: "note-view-editable" },
    // ...
  }
}
```

Whether this is useful or chaotic remains to be seen.

---

## Testing Checklist

| Test Case | Expected Result |
|-----------|-----------------|
| Existing spatial container (no innerView) | Empty background, windows work as before |
| Set Background View on a note | Note content visible behind windows |
| Windows above background | All windows visible and interactive |
| Background scrollable | Long content scrolls, windows stay fixed |
| Click-to-front | Windows still come to front correctly |
| Clear Background | Returns to empty canvas |
| Editable inner view | Can edit content through background |
| Inner view with links | Links clickable, navigation works |

---

## Summary

| Aspect | Change |
|--------|--------|
| Concept | Spatial layout becomes a wrapper, not a content presenter |
| DOM | Banner replaced with full-bleed background layer |
| Config | New `innerView` field in view config |
| Menu | Banner position items → "Set Background View..." |
| Migration | None required; backward compatible |
| Risk | Low; changes are isolated to one view |
