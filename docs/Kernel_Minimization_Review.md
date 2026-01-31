# Kernel Minimization Review

**Status**: Review of `Kernel_Minimization_Plan.md` and `Theming_System_Design.md`
**Date**: 2026-01-31
**Verdict**: Philosophically sound, but practical gaps need resolution before implementation

---

## Executive Summary

The kernel minimization proposal correctly identifies the separation of "mechanisms vs policies" as the right architectural principle. The theming system design demonstrates the pattern well. However, both documents have gaps around:

1. **First-boot experience** - How does a fresh system activate userland features?
2. **Bootstrap ordering** - Contradictions between the two documents on `applyStyles()`
3. **Error recovery** - Safe mode becomes more critical but isn't enhanced to match
4. **Watch mechanics** - The documents don't clearly explain how declarative watches actually work

This review documents these issues and proposes resolutions.

---

## Issue 1: The Bootstrap Paradox

### Problem

The minimization plan describes three userland initialization patterns:

1. **Manual initialization** - User runs `api.require('feature')` in REPL
2. **Startup script** - Library with `system:boot-complete` watch auto-runs
3. **Feature pack** - One library that loads all others

None of these solve the first-boot problem:

- **Manual** requires REPL, but REPL is being moved to userland
- **Startup script** requires the library to already exist with registered watches
- **Feature pack** still requires something to call `api.require()`

If REPL moves to userland, how does a new user activate *anything*?

### Current Watch Mechanics

Examining `kernel-core.js`, declarative watches work by:

1. `setupDeclarativeWatches()` registers a wildcard listener on `item:*`
2. When any item event fires, `dispatchToWatchers()` scans ALL items in storage
3. Items with `content.watches` arrays matching the event have their handlers called
4. The handler is loaded via `require()` on-demand

**Key insight**: Libraries don't need to be "imported" to have their watches work. They just need to *exist in storage* with a `content.watches` declaration. The kernel finds them by scanning.

However, this only helps if:
- The library exists in the initial seed/import
- An event fires that matches the watch

On first boot, `kernel-styles` exists but no `item:updated` event fires for it - the styles are just *there*.

### Proposed Resolution: Auto-Import Mechanism

Add a minimal "auto-import" field to the viewport item:

```javascript
{
  id: "88888888-0000-0000-0000-000000000000",
  type: "77777777-0000-0000-0000-000000000000",
  name: "viewport",
  content: {
    autoActivate: [
      "theme-hot-reload",
      "repl-ui",
      "keyboard-shortcuts"
    ]
  }
}
```

During boot, after `setupDeclarativeWatches()`, the kernel does:

```javascript
// Auto-activate configured libraries
const viewport = await this.storage.get(IDS.VIEWPORT);
const toActivate = viewport.content?.autoActivate || [];
for (const name of toActivate) {
  try {
    const lib = await this.moduleSystem.require(name);
    if (lib.activate) await lib.activate(this.createREPLAPI());
  } catch (e) {
    console.warn(`Auto-activate ${name} failed:`, e.message);
  }
}
```

**Why this works**:
- It's data, not code (configuration in an item)
- Users can modify it (remove features they don't want)
- Kernel remains minimal (just reads a list and calls `require`)
- Fails gracefully (warns but continues)
- Follows existing patterns (`api.require()` already exists)

**Alternative**: Emit `system:boot-complete` event and let startup scripts self-register. But this still requires the startup script to exist, and doesn't help with first boot unless we ship it in seeds.

### Decision Needed

Choose one of:

1. **Auto-activate list** in viewport (explicit, configurable)
2. **Boot-complete event** + shipped startup script (implicit, watch-based)
3. **Both** (belt and suspenders)

Recommendation: Option 1 (auto-activate list) is simpler and more transparent.

---

## Issue 2: applyStyles() Contradiction

### Problem

The theming document says:
> "Add `data-kernel-styles` attribute in `applyStyles()`"

The minimization document says:
> "Remove `applyStyles()` from kernel"

These directly conflict.

### Current Behavior

`kernel-core.applyStyles()` (lines 155-174):

1. Removes existing `#kernel-styles` element if present
2. Creates new `<style id="kernel-styles">`
3. Loads CSS from `kernel-styles` item
4. Falls back to minimal inline CSS if item missing
5. Appends to `<head>`

This runs once during `boot()`, before any userland code.

### Analysis

If `applyStyles()` is removed:

1. No styles are applied on boot
2. User sees unstyled content until `theme-hot-reload` runs
3. But `theme-hot-reload` only watches `item:updated` - no event fires on first boot
4. System remains unstyled

The hot-reload library would need an `activate()` function that applies styles immediately, plus a watch for updates. But who calls `activate()`? Back to Issue 1.

### Proposed Resolution: Two-Phase Approach

**Phase 1 (Theming MVP)**: Keep `applyStyles()` in kernel, add the data attribute

```javascript
async applyStyles() {
  const existing = document.querySelector('style[data-kernel-styles]');
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.setAttribute('data-kernel-styles', 'true');
  // ... rest unchanged
}
```

Create `theme-hot-reload` library that handles updates. The kernel applies initial styles; the library handles hot-reload.

**Phase 2 (After auto-activate solved)**: Move initial application to `theme-hot-reload.activate()`

```javascript
// theme-hot-reload library
export async function activate(api) {
  await applyStyles(api);
}

export async function onItemUpdated({ item }, api) {
  await applyStyles(api);
}

async function applyStyles(api) {
  const existing = document.querySelector('style[data-kernel-styles]');
  if (existing) existing.remove();

  const stylesItem = await api.get(api.IDS.KERNEL_STYLES);
  const style = document.createElement('style');
  style.setAttribute('data-kernel-styles', 'true');
  style.textContent = stylesItem.content.code;
  document.head.appendChild(style);
}
```

With auto-activate solving the bootstrap problem, the kernel's `applyStyles()` can be removed.

### Decision Needed

1. Implement Phase 1 first (keep `applyStyles()`, add hot-reload)
2. Implement Phase 2 after auto-activate mechanism exists
3. Update both documents to reflect this sequencing

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

## Issue 5: Missing system:boot-complete Event

### Problem

The startup script pattern in the minimization plan assumes a `system:boot-complete` event exists. It doesn't.

### Proposed Resolution

Add to `kernel-core.boot()`, after all initialization:

```javascript
async boot() {
  // ... existing boot code ...

  // Signal that boot is complete (for startup scripts)
  this.events.emit('system:boot-complete', {
    safeMode: this._safeMode,
    debugMode: this.debugMode,
    rootId: this.currentRoot
  });
}
```

This is a one-line addition that enables the startup script pattern.

### Decision Needed

Add this event. It's minimal, useful, and doesn't add complexity.

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

### Phase 0: Prerequisites (Before Any Migration)

1. Add `system:boot-complete` event to kernel
2. Add hardcoded safe-mode keyboard shortcut (Ctrl+Shift+S)
3. Implement auto-activate mechanism in viewport
4. Rename `createREPLAPI()` to `createScriptingAPI()` with alias

### Phase 1: Theming (As Currently Designed)

1. Keep `applyStyles()` in kernel (don't remove yet)
2. Add `data-kernel-styles` attribute
3. Define CSS variables in `kernel-styles`
4. Create `theme-hot-reload` library with:
   - `activate()` function (for explicit activation)
   - `onItemUpdated` handler (for hot reload)
5. Add `theme-hot-reload` to default auto-activate list
6. Test: fresh boot applies styles, editing updates live

### Phase 2: REPL UI Migration

1. Create `repl-ui` library with:
   - `activate()` - creates container, registers handlers
   - Full REPL functionality (toggle, run, history)
2. Remove REPL container creation from kernel boot
3. Add `repl-ui` to default auto-activate list
4. Test: REPL works via Escape key after auto-activation

### Phase 3: Keyboard Shortcuts Migration

1. Create `keyboard-shortcuts` library with:
   - Configurable bindings as data
   - `activate()` - registers document listener
   - Action dispatcher
2. Remove keyboard handlers from kernel boot (except safe-mode shortcut)
3. Add `keyboard-shortcuts` to default auto-activate list
4. Test: all shortcuts work, custom bindings possible

### Phase 4: Remove applyStyles() from Kernel

1. Move initial style application to `theme-hot-reload.activate()`
2. Remove `applyStyles()` from kernel boot
3. Ensure bootstrap.html has adequate fallback CSS
4. Test: fresh boot still styled (via auto-activate)

### Phase 5: Remaining UI Components

1. Item palette (`showItemList()`) → `item-palette` library
2. Help dialog (`showHelp()`) → `help-browser` library or help item
3. Raw editor → keep minimal in safe mode, enhance in userland

### Phase 6: Polish

1. Create `standard-features` pack that loads common libraries
2. Improve safe mode with library management
3. Document all patterns
4. Create "minimal" vs "full" configuration examples

---

## Open Questions

These need explicit decisions before proceeding:

1. **Auto-activate mechanism**: Use viewport field, or different approach?
2. **Naming**: Rename `createREPLAPI()` now or later?
3. **CSS variables**: Use semantic naming from the start?
4. **Safe mode shortcut**: Which key combination? (Proposed: Ctrl+Shift+S)
5. **Phase 0 scope**: Implement all prerequisites before Phase 1, or interleave?

---

## Appendix: Code Snippets

### A. Auto-Activate Implementation

```javascript
// In kernel-core boot(), after setupDeclarativeWatches()
async autoActivateLibraries() {
  try {
    const viewport = await this.storage.get(this.IDS.VIEWPORT);
    const toActivate = viewport.content?.autoActivate || [];

    for (const name of toActivate) {
      try {
        const lib = await this.moduleSystem.require(name);
        if (typeof lib.activate === 'function') {
          await lib.activate(this.createScriptingAPI());
        }
      } catch (e) {
        console.warn(`Auto-activate ${name} failed:`, e.message);
        this.showActivationWarning(name, e);
      }
    }
  } catch (e) {
    console.warn('Auto-activate failed:', e.message);
  }
}
```

### B. theme-hot-reload Library (Full)

```javascript
{
  id: "...",
  name: "theme-hot-reload",
  type: "66666666-0000-0000-0000-000000000000",
  content: {
    description: "Applies and hot-reloads kernel styles",
    watches: [
      {
        event: "item:updated",
        id: "33333333-8888-0000-0000-000000000000"
      }
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
    console.log('✨ Styles applied');
  } catch (e) {
    console.error('Failed to apply styles:', e);
  }
}

// Called on auto-activate (initial boot)
export async function activate(api) {
  await applyStyles(api);
}

// Called when kernel-styles is edited
export async function onItemUpdated({ item }, api) {
  await applyStyles(api);
  console.log('✨ Theme hot-reloaded!');
}
    `
  }
}
```

### C. Safe Mode Keyboard Shortcut

```javascript
// In kernel-core boot(), unconditionally
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

---

## Conclusion

The kernel minimization vision is correct. The theming system is a good first step. But the practical implementation requires solving the bootstrap paradox first.

**Recommended next step**: Implement Phase 0 (prerequisites), then Phase 1 (theming with `applyStyles()` still in kernel). This proves the pattern while maintaining a working system.

The full removal of `applyStyles()` and REPL from the kernel should wait until auto-activate is proven reliable.
