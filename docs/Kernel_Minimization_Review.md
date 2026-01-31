# Kernel Minimization Review

**Status**: Review of `Kernel_Minimization_Plan.md` and `Theming_System_Design.md`
**Date**: 2026-01-31
**Updated**: 2026-01-31 (refined bootstrap solution)
**Verdict**: Philosophically sound; bootstrap solution identified

---

## Executive Summary

The kernel minimization proposal correctly identifies the separation of "mechanisms vs policies" as the right architectural principle. The theming system design demonstrates the pattern well. However, both documents have gaps around:

1. **First-boot experience** - How does a fresh system activate userland features?
2. **Bootstrap ordering** - Contradictions between the two documents on `applyStyles()`
3. **Error recovery** - Safe mode becomes more critical but isn't enhanced to match
4. **Watch mechanics** - The documents don't clearly explain how declarative watches actually work

This review documents these issues and proposes resolutions.

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
      { event: "system:boot-complete" },
      { event: "item:updated", id: "33333333-8888-0000-0000-000000000000" }
    ],
    code: `
      export function onSystemBootComplete({}, api) {
        applyStyles(api);
      }

      export function onItemUpdated({ item }, api) {
        applyStyles(api);
      }

      function applyStyles(api) { /* ... */ }
    `
  }
}
```

**3. Kernel calls boot handler when saving items that watch boot**

To avoid requiring reload for newly-created libraries:

```javascript
// In kernel-core saveItem()
async saveItem(item, options = {}) {
  // ... existing save logic ...

  // If item watches system:boot-complete, call its handler now
  // (so newly created libraries activate immediately)
  if (item.content?.watches?.some(w => w.event === 'system:boot-complete')) {
    await this.callWatchHandler(item, 'system:boot-complete', {
      rootId: this.currentRoot,
      lateActivation: true  // handler can distinguish if needed
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
      { event: "system:boot-complete" },
      { event: "item:updated", id: "33333333-8888-0000-0000-000000000000" }
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

      export function onSystemBootComplete({}, api) {
        applyStyles(api);
      }

      export function onItemUpdated({ item }, api) {
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
this.events.emit('system:boot-complete', {
  rootId: this.currentRoot,
  safeMode: this._safeMode,
  debugMode: this.debugMode
});
```

### Change 2: Call boot handlers when saving items that watch boot

```javascript
// In kernel-core saveItem()
async saveItem(item, options = {}) {
  const { silent = false } = options;

  // ... existing save logic (exists check, timestamps, storage.set, events) ...

  // If item watches system:boot-complete, call its handler now
  // This enables newly-created libraries to activate without reload
  if (!silent && item.content?.watches?.some(w => w.event === 'system:boot-complete')) {
    try {
      await this.callWatchHandler(item, 'system:boot-complete', {
        rootId: this.currentRoot,
        lateActivation: true
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

## Revised Implementation Sequence

Based on this review, the recommended implementation sequence is:

### Phase 0: Kernel Prerequisites

Two small kernel changes enable everything:

1. **Emit `system:boot-complete`** at end of `boot()`
2. **Call boot handlers in `saveItem()`** for items watching boot-complete
3. Add hardcoded safe-mode keyboard shortcut (Ctrl+Shift+S)

Optional: Rename `createREPLAPI()` to `createScriptingAPI()` with alias

### Phase 1: Theming

1. Define CSS variables in `kernel-styles`
2. Create `theme-hot-reload` library with:
   - `onSystemBootComplete` handler (initial application)
   - `onItemUpdated` handler (hot reload)
3. Remove `applyStyles()` from kernel boot
4. Ensure bootstrap.html has adequate fallback CSS
5. Test: fresh boot applies styles, editing updates live

### Phase 2: REPL UI Migration

1. Create `repl-ui` library with:
   - `onSystemBootComplete` - creates container, registers handlers
   - Full REPL functionality (toggle, run, history)
2. Remove REPL container creation from kernel boot
3. Test: REPL works via Escape key after boot-complete

### Phase 3: Keyboard Shortcuts Migration

1. Create `keyboard-shortcuts` library with:
   - `onSystemBootComplete` - registers document listener
   - Configurable bindings as data
   - Action dispatcher
2. Remove keyboard handlers from kernel boot (except safe-mode shortcut)
3. Test: all shortcuts work, custom bindings possible

### Phase 4: Remaining UI Components

1. Item palette (`showItemList()`) → `item-palette` library
2. Help dialog (`showHelp()`) → `help-browser` library or help item
3. Raw editor → keep minimal in safe mode, enhance in userland

### Phase 5: Polish

1. Create `standard-features` pack (optional convenience library)
2. Improve safe mode with library management
3. Document all patterns
4. Create "minimal" vs "full" configuration examples

---

## Open Questions

Most questions resolved. Remaining decisions:

1. ~~**Auto-activate mechanism**~~ → RESOLVED: Use `system:boot-complete` event
2. **Naming**: Rename `createREPLAPI()` now or later? (Low priority)
3. **CSS variables**: Use semantic naming from the start? (Recommended: yes)
4. **Safe mode shortcut**: Which key combination? (Proposed: Ctrl+Shift+S)
5. ~~**Phase 0 scope**~~ → RESOLVED: Minimal kernel changes enable everything

---

## Appendix: Code Snippets

### A. Kernel Changes (Complete)

```javascript
// === Change 1: End of kernel-core boot() ===

async boot() {
  // ... existing boot code ...

  // After all initialization, emit boot-complete for userland libraries
  this.events.emit('system:boot-complete', {
    rootId: this.currentRoot,
    safeMode: this._safeMode,
    debugMode: this.debugMode
  });
}

// === Change 2: In kernel-core saveItem() ===

async saveItem(item, options = {}) {
  const { silent = false } = options;

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
      this.events.emit('item:updated', { id: item.id, item, previous });
    } else {
      this.events.emit('item:created', { id: item.id, item });
    }

    // NEW: If item watches system:boot-complete, call its handler now
    // This enables newly-created libraries to activate without reload
    if (item.content?.watches?.some(w => w.event === 'system:boot-complete')) {
      try {
        await this.callWatchHandler(item, 'system:boot-complete', {
          rootId: this.currentRoot,
          lateActivation: true
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
      { event: "system:boot-complete" },
      { event: "item:updated", id: "33333333-8888-0000-0000-000000000000" }
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
export async function onSystemBootComplete({ lateActivation }, api) {
  await applyStyles(api);
  if (lateActivation) {
    console.log('✨ Theme library activated');
  }
}

// Called when kernel-styles is edited
export async function onItemUpdated({ item }, api) {
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
      { event: "system:boot-complete" }
    ],
    code: `
let container = null;
let visible = false;

export function onSystemBootComplete({ safeMode }, api) {
  if (safeMode) return;  // Don't create REPL in safe mode

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

The kernel minimization vision is correct, and the bootstrap problem is now solved.

**The solution is elegant**: Two small kernel changes (~20 lines total) enable the entire minimization plan:

1. Emit `system:boot-complete` at end of boot
2. Call boot handlers when saving items that watch boot-complete

This leverages the existing declarative watch mechanism rather than adding new concepts. Libraries are self-describing - their watch declarations show when they activate. No separate configuration, no reload needed for new libraries.

**Recommended next step**: Implement Phase 0 (kernel changes), then Phase 1 (theming). The theming library will be the proof-of-concept that validates the pattern before migrating REPL and keyboard shortcuts.

**Key insight**: First boot without a starter pack is rare. The system ships with libraries that watch `system:boot-complete`, so activation happens automatically. The `saveItem()` enhancement ensures post-boot library creation also works without reload.
