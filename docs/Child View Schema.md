# Child View Schema

This document describes the schema for child entries in an item's `children` array. The design allows each view/renderer to store its own configuration alongside the child reference.

## Schema

```javascript
{
  id: String,           // Required: GUID of the child item
  view?: {              // Optional: current view configuration
    type: String,       // Required if view present: renderer GUID
    ...                 // Renderer-specific properties
  },
  previousView?: {      // Optional: snapshot for "revert view"
    type: String,       // Required if previousView present: renderer GUID
    ...                 // Renderer-specific properties
  }
}
```

## Rules

| Field | Required | Meaning |
|-------|----------|---------|
| `id` | Yes | Child item reference |
| `view` | No | Current view config; absent = use default renderer |
| `view.type` | Yes (if `view` present) | Renderer GUID |
| `view.*` | No | Renderer-specific properties |
| `previousView` | No | Snapshot to restore when reverting view |
| `previousView.type` | Yes (if `previousView` present) | Previous renderer GUID |

**Invalid states:**
- `view` present without `view.type`
- `previousView` present without `previousView.type`

## Examples

### Minimal (default renderer)

```javascript
{ id: "a1b2c3d4-..." }
```

### Container view with spatial positioning

```javascript
{
  id: "a1b2c3d4-...",
  view: {
    type: "f6af99f7-b5ec-4d87-b78d-c79ba9ca1f0d",  // container-view
    x: 20,
    y: 50,
    width: 400,
    height: 300,
    z: 1000,
    bannerPosition: "left",
    bannerSize: 200
  }
}
```

### With previous view snapshot

```javascript
{
  id: "a1b2c3d4-...",
  view: {
    type: "f6af99f7-b5ec-4d87-b78d-c79ba9ca1f0d",  // container-view
    x: 100,
    y: 100,
    width: 500,
    height: 400,
    z: 1001,
    bannerPosition: "bottom",
    bannerSize: 150
  },
  previousView: {
    type: "69253de7-a08d-40e3-b8da-ec88ee33a25a",  // sortable_list_view
    sortField: "modified",
    sortDirection: "desc"
  }
}
```

## Rationale

**Why namespace under `view`?**
- Clean separation between item reference (`id`) and presentation (`view`)
- Each renderer owns its own property schema under `view.*`
- No property collisions between different renderer types
- `view.type` makes the renderer choice explicit

**Why store view config in parent's children array?**
- Same item can appear in different parents with different view settings
- Parent controls how its children are displayed
- View preferences are contextual to where the item appears
- Consistent with parent already controlling child layout

**Why separate `previousView`?**
- Enables "revert to previous view" functionality
- Each view type may need different properties to restore properly
- Keeps current and previous state cleanly separated

## Migration

Items with legacy flat spatial properties:
```javascript
// Before
{ id: "...", x: 20, y: 20, width: 400, view: "renderer-guid" }

// After
{ id: "...", view: { type: "renderer-guid", x: 20, y: 20, width: 400 } }
```

### Files Updated

**Data items migrated:**
- `c3f4c6ad-e827-4999-bf22-724873a5aade` (Hobson)
- `e62219e1-939f-4955-a427-ce67016b9079` (Hobson TODOs)
- `88888888-0000-0000-0000-000000000000` (system-viewport)
- `716cc99c-8cb5-4339-a7d6-96c2ff1bc193` (Item Browser)
- `b59c81dd-d383-4123-8d25-a199ae0eecbb` (Tag Browser)

**Code items updated:**
- `33333333-3333-0000-0000-000000000000` (kernel-viewport) - persist/restore methods
- `33333333-1111-0000-0000-000000000000` (kernel-core) - setChildView method
- `33333333-5555-0000-0000-000000000000` (kernel-rendering) - restorePreviousView in API
- `ef793c27-2d4b-4c99-b05a-2769db5bc5a9` (container_view) - read/write spatial properties
- `69253de7-a08d-40e3-b8da-ec88ee33a25a` (sortable_list_view) - read view type
- `9428203f-c088-4a54-bbcb-fdbef244189e` (item_search_view) - read view type
- `bd74da77-a459-454a-b001-48685d4b536d` (viewport_view) - read/write children properties
