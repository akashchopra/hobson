# Kernel Minimization Review

**Status**: Review of `Kernel_Minimization_Plan.md` and `Theming_System_Design.md`
**Date**: 2026-01-31
**Updated**: 2026-01-31 (aligned with implemented Event Definitions system)
**Verdict**: Philosophically sound; bootstrap solution identified; event format updated

---

## Executive Summary

The kernel minimization proposal correctly identifies the separation of "mechanisms vs policies" as the right architectural principle. The theming system design demonstrates the pattern well.

**Key solutions identified:**

1. **Bootstrap solved** - `system:boot-complete` event + boot handler call in `saveItem()`
2. **Viewport minimization** - Selection and persistence move to userland via events
3. **Event-based UI state** - Views emit intents, react to state changes

This review documents the issues, solutions, and implementation sequence.

---

## Issue 1: The Bootstrap Paradox (RESOLVED)

### Problem

The minimization plan describes three userland initialization patterns:

1. **Manual initialization** - User runs `api.require('feature')` in REPL
2. **Startup script** - Library with `system:boot-complete` watch auto-runs
3. **Feature pack** - One library that loads all others

The concern was: If REPL moves to userland, how does a new user activate *anything*?

### Key Insight: Watches Are Dynamically Discovered

Examining `kernel-core.js`, declarative watches work by:

1. `setupDeclarativeWatches()` registers a wildcard listener on `item:*` and `system:*`
2. When any event fires, `dispatchToWatchers()` scans ALL items in storage
3. Items with `content.watches` arrays matching the event have their handlers called
4. The handler is loaded via `require()` on-demand

**Libraries don't need to be "imported" to have their watches work.** They just need to *exist in storage* with a `content.watches` declaration. The kernel finds them by scanning on every event.

### Resolution: system:boot-complete Event

The solution uses the existing watch mechanism with one kernel addition:

**1. Kernel emits `system:boot-complete` at end of boot**

```javascript
// End of kernel-core boot()
this.events.emit('system:boot-complete', {
  rootId: this.currentRoot,
  safeMode: this._safeMode,
  debugMode: this.debugMode
});
```

**2. Libraries watch this event for activation**

```javascript
{
  name: "theme-hot-reload",
  content: {
    watches: [
      { event: "e0e00000-0002-0002-0000-000000000000" },  // SYSTEM_BOOT_COMPLETE
      { event: "e0e00000-0001-0002-0000-000000000000", id: "33333333-8888-0000-0000-000000000000" }  // ITEM_UPDATED for kernel-styles
    ],
    code: `
      export function onSystemBootComplete({ content }, api) {
        applyStyles(api);
      }

      export function onItemUpdated({ content }, api) {
        applyStyles(api);
      }

      function applyStyles(api) { /* ... */ }
    `
  }
}
```

**Note:** Handler names are derived from the event definition's `name` field: `system:boot-complete` → `onSystemBootComplete`, `item:updated` → `onItemUpdated`.

**3. Kernel calls boot handler when saving items that watch boot**

To avoid requiring reload for newly-created libraries:

```javascript
// In kernel-core saveItem()
async saveItem(item, options = {}) {
  // ... existing save logic ...

  // If item watches system:boot-complete, call its handler now
  // (so newly created libraries activate immediately)
  const BOOT_COMPLETE = "e0e00000-0002-0002-0000-000000000000";
  if (item.content?.watches?.some(w => w.event === BOOT_COMPLETE)) {
    await this.callWatchHandler(item, BOOT_COMPLETE, {
      type: BOOT_COMPLETE,
      content: {
        rootId: this.currentRoot,
        lateActivation: true  // handler can distinguish if needed
      },
      timestamp: Date.now()
    });
  }
}
```

### How It Works

| Scenario | What happens |
|----------|--------------|
| Boot with existing libraries | `system:boot-complete` fires → all watchers run |
| Create new library post-boot | `saveItem()` detects boot watch → calls handler directly |
| Edit existing library | Same as create - handler re-runs with fresh code |

### Why This Is Better Than Auto-Activate List

- **No separate configuration** - library declares its own needs
- **Uses existing mechanism** - just events and watches
- **Self-describing** - look at any library to see when it activates
- **No reload needed** - post-boot libraries work immediately
- **Minimal kernel addition** - one event emit + one check in saveItem

### First Boot Note

First boot without a starter pack is rare (user typically imports `initial-kernel.json` or similar). The bootstrap.html already provides an import UI for fresh systems. Libraries included in the starter pack have their boot watches triggered automatically.

**Decision**: RESOLVED - Use `system:boot-complete` event pattern.

---

## Issue 2: applyStyles() Contradiction (RESOLVED)

### Problem

The theming document says:
> "Add `data-kernel-styles` attribute in `applyStyles()`"

The minimization document says:
> "Remove `applyStyles()` from kernel"

These appeared to conflict.

### Resolution

With the `system:boot-complete` event (Issue 1), the contradiction is resolved:

1. **Remove `applyStyles()` from kernel** - it's no longer needed
2. **`theme-hot-reload` watches `system:boot-complete`** - applies styles at boot
3. **`theme-hot-reload` watches `item:updated` for kernel-styles** - handles hot-reload

The library handles both initial application AND updates:

```javascript
{
  name: "theme-hot-reload",
  content: {
    watches: [
      { event: "e0e00000-0002-0002-0000-000000000000" },  // SYSTEM_BOOT_COMPLETE
      { event: "e0e00000-0001-0002-0000-000000000000", id: "33333333-8888-0000-0000-000000000000" }  // ITEM_UPDATED
    ],
    code: `
      function applyStyles(api) {
        const existing = document.querySelector('style[data-kernel-styles]');
        if (existing) existing.remove();

        api.get(api.IDS.KERNEL_STYLES).then(stylesItem => {
          const style = document.createElement('style');
          style.setAttribute('data-kernel-styles', 'true');
          style.textContent = stylesItem.content.code;
          document.head.appendChild(style);
        });
      }

      export function onSystemBootComplete({ content }, api) {
        applyStyles(api);
      }

      export function onItemUpdated({ content }, api) {
        applyStyles(api);
      }
    `
  }
}
```

### Bootstrap Fallback

The `bootstrap.html` should include minimal inline CSS for the brief moment before `system:boot-complete` fires. This is already the case - the current bootstrap has basic layout styles.

**Decision**: RESOLVED - Remove `applyStyles()` from kernel; library handles everything via boot-complete event.

---

## Issue 3: REPL vs Scripting API Confusion

### Problem

The documents conflate "REPL" (the UI) with "REPL API" (the scripting interface). The minimization plan says:

> "Keep `createREPLAPI()` in kernel-core (essential for scripting)"

But `createREPLAPI()` is 200+ lines and is the *public interface for all userland code*, not just the REPL. Views, libraries, and watch handlers all receive this API.

### Current Usage

- `createREPLAPI()` - Used by REPL UI for scripting
- `createRendererAPI()` - Used by views, extends REPL API with render-specific methods
- Watch handlers receive renderer API

The name "REPL API" is misleading because:
- Views use it (they're not the REPL)
- Libraries use it (they're not the REPL)
- It's the general "userland API"

### Proposed Resolution

Rename for clarity:

```javascript
// In kernel-core
createScriptingAPI() {
  // ... current createREPLAPI() implementation
}

// Alias for backwards compatibility
createREPLAPI() {
  return this.createScriptingAPI();
}
```

Update documentation to refer to "scripting API" as the general interface, with "REPL API" as a legacy alias.

### Decision Needed

1. Rename now (breaking change for any code using the name)
2. Add alias and deprecate old name
3. Document the distinction without renaming

Recommendation: Option 2 (alias + deprecation) is lowest risk.

---

## Issue 4: Safe Mode Enhancement

### Problem

Under the minimization plan, userland code handles:
- Styling
- REPL UI
- Keyboard shortcuts
- Item palette (Cmd+K)

If any of these break, the user has limited recovery options:
- Manually add `?safe=1` to URL (requires knowing this exists)
- Use safe mode's minimal editing UI

Currently, if styling breaks, the REPL still works. Under the new model, a bug in `keyboard-shortcuts` that breaks Escape also breaks REPL access.

### Proposed Resolutions

#### A. Hardcoded Escape Hatch

Keep one keyboard shortcut hardcoded in the kernel:

```javascript
// In kernel-core boot()
document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+S = Safe mode (always works, even if userland broken)
  if (e.ctrlKey && e.shiftKey && e.key === 'S') {
    window.location.href = '?safe=1';
  }
});
```

This is a 5-line addition that provides a guaranteed escape path.

#### B. Safe Mode Improvements

Enhance safe mode to:
1. Show which libraries exist and their activation status
2. Allow disabling specific libraries (remove from auto-activate list)
3. Provide a "reset to defaults" that restores seed auto-activate list

#### C. Error Detection Banner

If userland activation fails during boot, show a non-modal banner:

```javascript
// In auto-activate loop
for (const name of toActivate) {
  try {
    const lib = await this.moduleSystem.require(name);
    if (lib.activate) await lib.activate(this.createREPLAPI());
  } catch (e) {
    this.showActivationWarning(name, e);
  }
}

showActivationWarning(name, error) {
  const banner = document.createElement('div');
  banner.style.cssText = 'background: #fff3cd; padding: 8px 16px; border-bottom: 1px solid #ffc107;';
  banner.innerHTML = `
    <strong>⚠️ ${name}</strong> failed to activate: ${error.message}
    <a href="?safe=1" style="margin-left: 12px;">Enter Safe Mode</a>
  `;
  document.body.insertBefore(banner, document.body.firstChild);
}
```

### Decision Needed

Implement all three (A, B, C)? The hardcoded escape hatch (A) is essential; B and C are enhancements.

---

## Issue 5: system:boot-complete Event (RESOLVED - KEY FEATURE)

### Summary

This is the key kernel addition that enables the entire minimization plan. Two changes are needed:

### Change 1: Emit event at end of boot

```javascript
// End of kernel-core boot()
const BOOT_COMPLETE = this.EVENT_IDS.SYSTEM_BOOT_COMPLETE;
this.events.emit({
  type: BOOT_COMPLETE,
  content: {
    rootId: this.currentRoot,
    safeMode: this._safeMode,
    debugMode: this.debugMode,
    lateActivation: false
  }
});
```

### Change 2: Call boot handlers when saving items that watch boot

```javascript
// In kernel-core saveItem()
async saveItem(item, options = {}) {
  const { silent = false } = options;
  const BOOT_COMPLETE = this.EVENT_IDS.SYSTEM_BOOT_COMPLETE;

  // ... existing save logic (exists check, timestamps, storage.set, events) ...

  // If item watches system:boot-complete, call its handler now
  // This enables newly-created libraries to activate without reload
  if (!silent && item.content?.watches?.some(w => w.event === BOOT_COMPLETE)) {
    try {
      await this.callWatchHandler(item, BOOT_COMPLETE, {
        type: BOOT_COMPLETE,
        content: {
          rootId: this.currentRoot,
          lateActivation: true
        },
        timestamp: Date.now()
      });
    } catch (e) {
      console.warn(`Boot handler for ${item.name || item.id} failed:`, e);
    }
  }

  return item;
}
```

### Behavior Matrix

| Scenario | Trigger | `lateActivation` |
|----------|---------|------------------|
| Existing library at boot | `system:boot-complete` event | `false` (or undefined) |
| New library created post-boot | `saveItem()` direct call | `true` |
| Existing library edited post-boot | `saveItem()` direct call | `true` |

The `lateActivation` flag lets handlers distinguish if needed (e.g., skip one-time-only initialization that already happened).

### Why This Works

- Uses existing watch infrastructure (no new mechanisms)
- Libraries are self-describing (watch declaration shows activation trigger)
- No reload needed for new libraries
- No separate "auto-activate list" to maintain
- Minimal kernel addition (~15 lines total)

**Decision**: RESOLVED - Implement both changes.

---

## Issue 6: CSS Variable Naming for Dark Mode

### Problem

The proposed variable names mix positional and semantic concerns:

- `--color-bg-body` - positional (where it's used)
- `--color-primary` - semantic (what it means)

For dark mode, positional naming is problematic. Is "body background" light or dark?

### Analysis

This is a minor concern for Phase 1 but becomes important for theme presets.

### Proposed Resolution

Use layered semantic naming:

```css
:root {
  /* Surface layers (0 = base, higher = more elevated) */
  --color-surface-0: #f5f5f5;    /* Page background */
  --color-surface-1: white;      /* Cards, panels */
  --color-surface-2: #f8f8f8;    /* Elevated elements */

  /* Content on surfaces */
  --color-on-surface: #333;
  --color-on-surface-secondary: #666;
  --color-on-surface-tertiary: #999;

  /* Borders (relative to surface) */
  --color-border: #ccc;
  --color-border-subtle: #ddd;
  --color-border-strong: #999;

  /* Interactive */
  --color-primary: #007bff;
  --color-primary-hover: #0056b3;

  /* Status */
  --color-success: #28a745;
  --color-danger: #dc3545;
  --color-warning: #ffc107;
}
```

In dark mode:
- `--color-surface-0: #1a1a1a` (dark background)
- `--color-surface-1: #2d2d2d` (lighter cards)
- `--color-on-surface: #e0e0e0` (light text)

The naming stays consistent; only values change.

### Decision Needed

Adopt semantic naming now, or defer to Phase 3 (theme presets)?

Recommendation: Adopt now. It's the same amount of work and avoids migration later.

---

## Issue 7: Watch Registration Clarity

### Problem

The documents say things like "Import once (via REPL or startup script)" which implies watches require explicit registration. This is misleading.

### How Watches Actually Work

1. Watches are declared in `item.content.watches` array
2. When an event fires, `dispatchToWatchers()` scans ALL items in storage
3. Items matching the event have their handlers loaded and called
4. No explicit "registration" step is needed

The library must *exist in storage* but doesn't need to have been `require()`d.

### Proposed Resolution

Update documentation to clarify:

> **Watch Registration**
>
> Libraries with declarative watches do NOT need to be explicitly imported. The kernel automatically discovers watches by scanning all items when events fire.
>
> A library's watches become active when:
> 1. The library item exists in storage (imported or seeded)
> 2. An event matching the watch declaration fires
>
> The kernel loads the library on-demand via `require()` when calling the handler.
>
> **Performance note**: The kernel scans all items on every event. For large item counts, consider adding an index or caching watch declarations.

---

## Issue 8: Viewport Minimization

### Opportunity

With the `system:boot-complete` event pattern established, the kernel-viewport module (~120 lines) can be significantly reduced. Most viewport logic is application-level policy, not infrastructure.

**Note on viewport events:** The kernel defines `viewport-event` types (VIEWPORT_SELECTION_CHANGED, VIEWPORT_ROOT_CHANGED) for discoverability, but these are emitted by userland libraries. Additional userland events (e.g., `ui:select` for user intent) can be defined by libraries without kernel changes.

### Current kernel-viewport Responsibilities

1. `rootId` - current root item
2. `rootViewId`, `rootViewConfig` - view preferences for root
3. `previousRootViewId`, `previousRootViewConfig` - for view switching back
4. `selectedItemId`, `selectedParentId` - selection state
5. `persist()` - save state to viewport item
6. `restore()` - load state from viewport item

### What Kernel Truly Needs

- Know what to render at boot (read URL, fall back to persisted root)
- Handle `popstate` for browser back/forward
- `navigateToItem()` - update URL, emit event, render

### Proposed Split

**Kernel keeps (~30 lines):**
- `currentRoot` property
- `getStartingRoot()` - reads URL or viewport item
- `navigateToItem()` - updates URL, emits `system:navigate`, renders
- `popstate` handler

**Moves to userland:**
- Selection state → event-based (`ui:select` / `ui:selection-changed`)
- View preferences → `viewport-manager` library
- Persistence → `viewport-manager` watches `system:navigate`

### Minimal Kernel Navigation

```javascript
class Kernel {
  constructor() {
    this.currentRoot = null;
    // Remove: this.viewport = new Viewport(this.storage);
  }

  async getStartingRoot() {
    // 1. Check URL
    const urlRoot = new URLSearchParams(location.search).get('root');
    if (urlRoot) {
      try {
        await this.storage.get(urlRoot);
        return urlRoot;
      } catch { /* invalid */ }
    }

    // 2. Check persisted viewport
    try {
      const viewport = await this.storage.get(this.IDS.VIEWPORT);
      return viewport.children?.[0]?.id || null;
    } catch {
      return null;
    }
  }

  async navigateToItem(itemId, options = {}) {
    const previous = this.currentRoot;
    this.currentRoot = itemId;

    // Update URL (unless initial load)
    if (!options.initial) {
      const url = new URL(window.location);
      url.searchParams.set('root', itemId);
      window.history.pushState({ itemId }, '', url);
    }

    // Emit navigation event (userland persists, updates selection, etc.)
    this.events.emit({
      type: this.EVENT_IDS.VIEWPORT_ROOT_CHANGED,
      content: {
        rootId: itemId,
        previous,
        initial: !!options.initial
      }
    });

    await this.renderRoot(itemId);
  }

  setupBrowserNavigation() {
    window.addEventListener('popstate', async (e) => {
      const rootId = new URLSearchParams(location.search).get('root');
      if (rootId) {
        this.currentRoot = rootId;
        this.events.emit({
          type: this.EVENT_IDS.VIEWPORT_ROOT_CHANGED,
          content: { rootId, previous: null, popstate: true }
        });
        await this.renderRoot(rootId);
      }
    });
  }
}
```

### Event-Based Selection

Instead of imperative `api.viewport.select()`, views use events:

**Userland event definitions:** The `selection-manager` library defines its own events for user intents. These use kernel-defined viewport event types where appropriate:

```javascript
// Defined by selection-manager library at activation
const UI_SELECT = crypto.randomUUID();  // userland event for intent
// Uses kernel's VIEWPORT_SELECTION_CHANGED for state change notifications
```

**View emits intent:**
```javascript
container.onclick = () => {
  api.events.emit({
    type: UI_SELECT,  // userland event ID
    content: { itemId: item.id, parentId }
  });
};
```

**View reacts to state:**
```javascript
api.events.on(api.EVENT_IDS.VIEWPORT_SELECTION_CHANGED, ({ content }) => {
  container.classList.toggle('item-selected', content.current.itemId === item.id);
});
```

**selection-manager library:**
```javascript
{
  name: "selection-manager",
  content: {
    watches: [
      { event: "e0e00000-0002-0002-0000-000000000000" }  // SYSTEM_BOOT_COMPLETE
    ],
    code: `
let selection = { itemId: null, parentId: null };
let UI_SELECT = null;  // Our userland event type

export async function onSystemBootComplete({ content }, api) {
  // Define our userland event type
  UI_SELECT = crypto.randomUUID();
  await api.set({
    id: UI_SELECT,
    type: api.EVENT_IDS.VIEWPORT_EVENT,  // Extends viewport-event
    name: "ui:select",
    content: {
      description: "User intent to select an item",
      payload: { itemId: "Item to select", parentId: "Parent container" }
    }
  });

  // Listen for our intent event
  api.events.on(UI_SELECT, ({ content }) => {
    const previous = { ...selection };
    selection = { itemId: content.itemId, parentId: content.parentId };
    api.events.emit({
      type: api.EVENT_IDS.VIEWPORT_SELECTION_CHANGED,
      content: { current: selection, previous }
    });
  });

  // Emit initial state
  api.events.emit({
    type: api.EVENT_IDS.VIEWPORT_SELECTION_CHANGED,
    content: { current: selection, previous: null }
  });
}

export function getSelection() { return selection.itemId; }
export function getSelectionParent() { return selection.parentId; }
export function getSelectEventId() { return UI_SELECT; }
    `
  }
}
```

**Note:** The library exports `getSelectEventId()` so views can obtain the userland event ID. Alternatively, views can use `api.require('selection-manager')` and call a `select(itemId, parentId)` method directly.

### viewport-manager Library

Handles persistence and view preferences:

```javascript
{
  name: "viewport-manager",
  content: {
    watches: [
      { event: "e0e00000-0002-0002-0000-000000000000" }  // SYSTEM_BOOT_COMPLETE
    ],
    code: `
const VIEWPORT_ID = "88888888-0000-0000-0000-000000000000";
let rootViewId = null;
let rootViewConfig = {};

export async function onSystemBootComplete({ content }, api) {
  // Restore view preferences
  const viewport = await api.get(VIEWPORT_ID);
  const child = viewport.children?.[0];
  if (child?.view) {
    rootViewId = child.view.type || null;
    const { type, ...config } = child.view;
    rootViewConfig = config;
  }

  // Listen for root changes (emitted by kernel or userland navigation)
  api.events.on(api.EVENT_IDS.VIEWPORT_ROOT_CHANGED, async ({ content }) => {
    if (content.initial) return;

    // Persist to viewport item
    const viewport = await api.get(VIEWPORT_ID);
    const childSpec = { id: content.rootId };
    if (rootViewId || Object.keys(rootViewConfig).length > 0) {
      childSpec.view = {
        ...(rootViewId ? { type: rootViewId } : {}),
        ...rootViewConfig
      };
    }
    viewport.children = content.rootId ? [childSpec] : [];
    await api.set(viewport);

    // Clear view prefs for new root
    rootViewId = null;
    rootViewConfig = {};
  });
}

export function getRootView() { return rootViewId; }
export function setRootView(viewId) { rootViewId = viewId; }
export function getRootViewConfig() { return rootViewConfig; }
    `
  }
}
```

### Benefits

1. **Decoupled views** - Views emit/listen to events, don't depend on specific APIs
2. **Multiple reactors** - Breadcrumbs, status bar, inspector can all listen to `ui:selection-changed`
3. **Graceful degradation** - If selection-manager not loaded, clicks do nothing but system works
4. **Replaceable** - Swap in multi-select manager, same events
5. **Smaller kernel** - ~100 lines removed, ~10 added

### Events Summary

| Event | Type ID | Emitter | Purpose |
|-------|---------|---------|---------|
| `system:boot-complete` | `e0e00000-0002-0002-...` | Kernel | Boot finished or library late-activated |
| `viewport:root-changed` | `e0e00000-0003-0002-...` | Kernel/userland | Navigation occurred |
| `viewport:selection-changed` | `e0e00000-0003-0001-...` | selection-manager | Selection state changed |
| `ui:select` | userland GUID | Views | User intent to select (defined by selection-manager) |

### Migration Considerations

Views using `api.viewport.select()` need updates:
- Option A: Views `await api.require('selection-manager')` to call methods
- Option B: Views just emit `ui:select` event (preferred - more decoupled)

Views checking selection for initial render:
- Listen for `ui:selection-changed` which fires at boot with initial state
- Or query via `await api.require('selection-manager').getSelection()`

---

## Revised Implementation Sequence

Based on this review and the implemented event definitions system, the recommended implementation sequence is:

### Phase 0: Kernel Prerequisites

Small kernel changes that enable everything:

1. **Emit `system:boot-complete`** (EVENT_IDS.SYSTEM_BOOT_COMPLETE) at end of `boot()`
2. **Emit `viewport:root-changed`** (EVENT_IDS.VIEWPORT_ROOT_CHANGED) in `navigateToItem()` and `popstate` handler
3. **Call boot handlers in `saveItem()`** for items watching boot-complete (using event GUID)
4. Add hardcoded safe-mode keyboard shortcut (Ctrl+Shift+S)

Optional: Rename `createREPLAPI()` to `createScriptingAPI()` with alias

### Phase 1: Theming

1. Define CSS variables in `kernel-styles`
2. Create `theme-hot-reload` library with:
   - Watches SYSTEM_BOOT_COMPLETE and ITEM_UPDATED (filtered to kernel-styles ID)
   - `onSystemBootComplete` handler (initial application)
   - `onItemUpdated` handler (hot reload)
3. Remove `applyStyles()` from kernel boot
4. Ensure bootstrap.html has adequate fallback CSS
5. Test: fresh boot applies styles, editing updates live

### Phase 2: Viewport Migration

1. Create `selection-manager` library:
   - Watches SYSTEM_BOOT_COMPLETE
   - Defines userland `ui:select` event (extends viewport-event)
   - Emits VIEWPORT_SELECTION_CHANGED
2. Create `viewport-manager` library:
   - Watches SYSTEM_BOOT_COMPLETE
   - Listens for VIEWPORT_ROOT_CHANGED
   - Handles persistence and view preferences
3. Simplify kernel navigation to ~30 lines
4. Remove `Viewport` class from kernel
5. Update views to use event-based selection (emit userland events, listen for kernel-defined state events)
6. Test: selection works, navigation persists, view prefs work

### Phase 3: REPL UI Migration

1. Create `repl-ui` library with:
   - `onSystemBootComplete` - creates container, registers handlers
   - Full REPL functionality (toggle, run, history)
2. Remove REPL container creation from kernel boot
3. Test: REPL works via Escape key after boot-complete

### Phase 4: Keyboard Shortcuts Migration

1. Create `keyboard-shortcuts` library with:
   - `onSystemBootComplete` - registers document listener
   - Configurable bindings as data
   - Action dispatcher
2. Remove keyboard handlers from kernel boot (except safe-mode shortcut)
3. Test: all shortcuts work, custom bindings possible

### Phase 5: Remaining UI Components

1. Item palette (`showItemList()`) → `item-palette` library
2. Help dialog (`showHelp()`) → `help-browser` library or help item
3. Raw editor → keep minimal in safe mode, enhance in userland

### Phase 6: Polish

1. Create `standard-features` pack (optional convenience library)
2. Improve safe mode with library management
3. Document all patterns
4. Create "minimal" vs "full" configuration examples

---

## Open Questions

Most questions resolved. Remaining decisions:

1. ~~**Auto-activate mechanism**~~ → RESOLVED: Use `system:boot-complete` event (EVENT_IDS.SYSTEM_BOOT_COMPLETE)
2. **Naming**: Rename `createREPLAPI()` now or later? (Low priority)
3. **CSS variables**: Use semantic naming from the start? (Recommended: yes)
4. **Safe mode shortcut**: Which key combination? (Proposed: Ctrl+Shift+S)
5. ~~**Phase 0 scope**~~ → RESOLVED: Minimal kernel changes enable everything
6. ~~**Event format**~~ → RESOLVED: Use implemented event definitions system (GUIDs, type hierarchy, handler name from event definition name)

---

## Appendix: Code Snippets

### A. Kernel Changes (Complete)

```javascript
// === Change 1: End of kernel-core boot() ===

async boot() {
  // ... existing boot code ...

  // After all initialization, emit boot-complete for userland libraries
  this.events.emit({
    type: this.EVENT_IDS.SYSTEM_BOOT_COMPLETE,
    content: {
      rootId: this.currentRoot,
      safeMode: this._safeMode,
      debugMode: this.debugMode,
      lateActivation: false
    }
  });
}

// === Change 2: In kernel-core saveItem() ===

async saveItem(item, options = {}) {
  const { silent = false } = options;
  const BOOT_COMPLETE = this.EVENT_IDS.SYSTEM_BOOT_COMPLETE;

  const exists = await this.storage.exists(item.id);
  const previous = exists ? await this.storage.get(item.id) : null;

  item.modified = Date.now();
  if (!exists && !item.created) {
    item.created = Date.now();
  }

  await this.storage.set(item, this);

  // Clear module cache if this is a code item
  if (await this.isCodeItem(item)) {
    this.moduleSystem.clearCache();
  }

  if (!silent) {
    if (exists) {
      this.events.emit({
        type: this.EVENT_IDS.ITEM_UPDATED,
        content: { item, previous }
      });
    } else {
      this.events.emit({
        type: this.EVENT_IDS.ITEM_CREATED,
        content: { item }
      });
    }

    // NEW: If item watches system:boot-complete, call its handler now
    // This enables newly-created libraries to activate without reload
    if (item.content?.watches?.some(w => w.event === BOOT_COMPLETE)) {
      try {
        await this.callWatchHandler(item, BOOT_COMPLETE, {
          type: BOOT_COMPLETE,
          content: {
            rootId: this.currentRoot,
            lateActivation: true
          },
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn(`Boot handler for ${item.name || item.id} failed:`, e);
      }
    }
  }

  return item;
}

// === Change 3: Safe mode keyboard shortcut (in boot, unconditionally) ===

if (!window._safeModeShortcut) {
  window._safeModeShortcut = (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      window.location.href = window.location.pathname + '?safe=1';
    }
  };
  document.addEventListener('keydown', window._safeModeShortcut);
}
```

### B. theme-hot-reload Library (Full)

```javascript
{
  id: "...",
  name: "theme-hot-reload",
  type: "66666666-0000-0000-0000-000000000000",
  content: {
    description: "Applies kernel styles at boot and hot-reloads on edit",
    watches: [
      { event: "e0e00000-0002-0002-0000-000000000000" },  // SYSTEM_BOOT_COMPLETE
      { event: "e0e00000-0001-0002-0000-000000000000", id: "33333333-8888-0000-0000-000000000000" }  // ITEM_UPDATED for kernel-styles
    ],
    code: `
// Apply styles from kernel-styles item
async function applyStyles(api) {
  const existing = document.querySelector('style[data-kernel-styles]');
  if (existing) existing.remove();

  try {
    const stylesItem = await api.get(api.IDS.KERNEL_STYLES);
    const style = document.createElement('style');
    style.setAttribute('data-kernel-styles', 'true');
    style.textContent = stylesItem.content.code;
    document.head.appendChild(style);
  } catch (e) {
    console.error('Failed to apply styles:', e);
  }
}

// Called at boot (or when library is created/edited post-boot)
// Handler name derived from event name: "system:boot-complete" → onSystemBootComplete
export async function onSystemBootComplete({ content }, api) {
  await applyStyles(api);
  if (content.lateActivation) {
    console.log('✨ Theme library activated');
  }
}

// Called when kernel-styles is edited
// Handler name derived from event name: "item:updated" → onItemUpdated
export async function onItemUpdated({ content }, api) {
  await applyStyles(api);
  console.log('✨ Theme hot-reloaded');
}
    `
  }
}
```

### C. repl-ui Library (Sketch)

```javascript
{
  name: "repl-ui",
  type: "66666666-0000-0000-0000-000000000000",
  content: {
    description: "REPL user interface",
    watches: [
      { event: "e0e00000-0002-0002-0000-000000000000" }  // SYSTEM_BOOT_COMPLETE
    ],
    code: `
let container = null;
let visible = false;

export function onSystemBootComplete({ content }, api) {
  if (content.safeMode) return;  // Don't create REPL in safe mode

  // Create REPL container (similar to current kernel-repl)
  container = createContainer();
  document.getElementById('app').appendChild(container);

  // Register toggle shortcut
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggle();
    }
  });
}

function createContainer() { /* ... */ }
function toggle() { visible = !visible; /* ... */ }
export function run(code) { /* ... */ }
    `
  }
}
```

---

## Conclusion

The kernel minimization vision is correct, and the key problems are solved.

**The solution is elegant**: A few small kernel changes enable the entire minimization plan:

1. Emit `system:boot-complete` (EVENT_IDS.SYSTEM_BOOT_COMPLETE) at end of boot
2. Emit `viewport:root-changed` (EVENT_IDS.VIEWPORT_ROOT_CHANGED) on navigation
3. Call boot handlers when saving items that watch boot-complete

This leverages the existing declarative watch mechanism and the newly-implemented event definitions system. Libraries are self-describing - their watch declarations (using event type GUIDs) show when they activate. No separate configuration, no reload needed for new libraries.

**Event-based UI state** (selection, view preferences) decouples views from specific APIs. Views emit intents (userland events), react to state changes (kernel-defined event types emitted by userland libraries). This enables multiple listeners, graceful degradation, and replaceable implementations.

**Integration with Event Definitions**: The implemented event definitions system (phases 1 & 2) provides:
- Type hierarchy for event grouping (subscribe to `item-event` to receive all item events)
- Discoverable event definitions as items
- Handler naming via event definition name lookup (`system:boot-complete` → `onSystemBootComplete`)
- Userland event definitions using the same mechanism

**Kernel reduction summary:**
- Remove `applyStyles()` (~20 lines)
- Remove `Viewport` class (~120 lines)
- Remove REPL UI code (~150 lines)
- Remove keyboard handlers (~30 lines)
- Add event emissions (~10 lines)
- **Net: ~300+ lines removed from kernel**

**Recommended sequence**:
1. Phase 0: Kernel events (`system:boot-complete`, `viewport:root-changed`) — now using event definition GUIDs
2. Phase 1: Theming (proves the pattern)
3. Phase 2: Viewport (selection-manager, viewport-manager) — viewport events emitted by userland
4. Phase 3+: REPL, keyboard shortcuts, remaining UI

**Key insight**: First boot without a starter pack is rare. The system ships with libraries that watch `system:boot-complete`, so activation happens automatically. The `saveItem()` enhancement ensures post-boot library creation also works without reload.
