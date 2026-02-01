# Viewport Kernel Extraction Plan

**Status: IMPLEMENTED**

## Goal

Remove all viewport state and navigation logic from the kernel. The kernel's only job is to render the VIEWPORT item at boot. Everything else moves to userland.

## Changes Made

### 1. kernel:viewport module (33333333-3333-0000-0000-000000000000)
- Converted to deprecated stub
- No longer imported by kernel:core

### 2. kernel:core (33333333-1111-0000-0000-000000000000)

**Removed:**
- `this.viewport` instance
- `this.currentRoot`
- `navigateToItem()`
- `renderRoot()`
- `getStartingRoot()`
- `popstate` handler setup
- Kernel fallbacks in `api.viewport.*` methods

**Kept:**
- `renderViewport()` - just calls `rendering.renderItem(IDS.VIEWPORT)` and mounts to DOM

**Added to API:**
- `api.renderViewport()` - for userland to trigger re-renders
- `api.navigate()` - now delegates to `viewport-manager.navigate()`

### 3. viewport-manager (f1111111-0002-0000-0000-000000000000)

**Added:**
- `navigate(itemId, params)` - updates viewport item, pushState, calls `api.renderViewport()`
- `getRoot()` - returns current root
- Popstate handler registration at boot
- URL reading at boot to sync initial state

### 4. system:viewport-view (bd74da77-a459-454a-b001-48685d4b536d)

**Changed:**
- Now checks URL `?root=` param on first render
- If URL has root, uses that and updates viewport item to match
- Falls back to viewport item's `children[0]` if no URL root

## Boot Sequence (After)

1. Kernel loads, creates storage/rendering/events
2. Kernel calls `renderViewport()` - renders VIEWPORT item
3. Viewport view renders:
   - Checks URL for `?root=` param
   - Falls back to viewport item's children[0]
   - Updates viewport item if URL differs
   - Renders the root item
4. Kernel emits `system:boot-complete`
5. `viewport-manager` activates, sets up popstate handler, syncs state

## API Changes

### Using navigation:
```javascript
// Old (still works, delegates to viewport-manager)
await api.navigate(itemId);

// Direct userland access
const vpMgr = await api.require('viewport-manager');
await vpMgr.navigate(itemId);
```

### Triggering re-render:
```javascript
await api.renderViewport();
```

### Getting current root:
```javascript
// Via API
api.viewport.getRoot();

// Direct (after boot)
const vpMgr = await api.require('viewport-manager');
vpMgr.getRoot();
```

## Risk Mitigation

- Safe mode still works (kernel renders VIEWPORT, viewport-view handles empty state)
- If viewport-manager fails to load, navigation breaks but display still works
- URL sync failure is graceful - just loses bookmarkability

## Breaking Changes

- `system:boot-complete` event no longer includes `rootId` in content
- Libraries watching boot-complete that need rootId should read from viewport item or call `api.viewport.getRoot()`
