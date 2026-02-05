# Element Inspector: Design and Implementation Plan

**Status:** Implemented
**Date:** 2026-01-29

---

## Motivation

Hobson aspires to be inspectable—all parts of the system should be examinable at any time (Conway's Humane Dozen, attribute #5). Currently, the system excels at navigating between items: links in markdown, transclusions, code comments referencing other items. However, when looking at a UI element and asking "who rendered this?", the system provides no direct answer.

**Example scenario:** A user sees minimized items at the bottom of a spatial container and wants to modify their appearance. Is this a viewport feature? A spatial-container-view feature? Without knowing where to look, they cannot begin.

**Goal:** Point at any UI element and answer "Who rendered you, and why?" with direct navigation to the responsible code.

---

## Current Infrastructure

The system already has partial support for this:

**RenderInstanceRegistry** — When a view renders an item, the system registers `{domNode, itemId, viewId, parentId}` and marks the root DOM node with `data-render-instance`. This is indexed by item ID, view ID, and parent ID.

**data-item-id attribute** — The viewport decorator adds this to rendered items for selection and context menu targeting.

**sourceURL comments** — The module system appends `//# sourceURL=item-name` to code items, making stack traces show meaningful names:
```
at render (spatial-container-view:47:12)
```

**Unique code item names** — The kernel validates that code items have unique names, so a name unambiguously identifies an item.

---

## Design

### Layered Approach

The implementation is split into three layers, each independently useful:

| Layer | Description | Kernel Change? |
|-------|-------------|----------------|
| 1. Debug mode infrastructure | URL parameter and context flag | Yes (small) |
| 2. Element attribution | Capture source location in createElement | Yes (small) |
| 3. Inspector UI | Keyboard shortcut, overlay, navigation | No (library) |

### Debug Mode

Source location capture has a cost (creating Error objects for stack traces). Rather than always-on, the system supports two debug modes:

**Global debug (`?debug=1`)** — URL parameter checked at boot. When enabled, all elements created via `api.createElement` receive source attribution. Zero cost when disabled.

**Subtree debug** — Re-render a specific item with debug enabled. The debug flag flows through the rendering context, so attachments also receive attribution. Useful for surgical inspection without global overhead.

| Mode | Trigger | Scope | Use Case |
|------|---------|-------|----------|
| Normal | Default | — | No overhead |
| Global debug | `?debug=1` URL | All elements | Exploring the whole UI |
| Subtree debug | REPL / API | Item + descendants | Inspecting a specific area |

**Note on subtree debug:** The initial implementation exposes subtree debug only via API (`api.rerenderItemDebug(itemId)`). Context menu integration is deferred to a future enhancement, keeping Phase 1-2 scope minimal.

### Element Attribution

When debug mode is active, `api.createElement` captures its call site:

```javascript
createElement(tag, props = {}, children = []) {
  const element = document.createElement(tag);
  
  if (this.debugMode) {
    const location = this.captureSourceLocation();
    if (location) {
      element.setAttribute('data-source', location.itemName);
      element.setAttribute('data-source-line', location.line);
    }
  }
  
  // ... existing implementation
}
```

The source location is parsed from the stack trace, extracting the item name (from sourceURL) and line number.

### Inspector UI

A library item that provides:

1. **Activation** — Keyboard shortcut (Ctrl+Shift+.) or toolbar button
2. **Visual mode** — Cursor change, highlight on hover
3. **Element inspection** — On click, collect attribution data by walking up the DOM
4. **Information display** — Overlay or panel showing:
   - View name (linked to view item)
   - Item being rendered (linked to item)
   - Source line (if debug mode was active)
   - Parent context
5. **Navigation** — Click any link to navigate, optionally with line number for code views

### Inspector Overlay Fields

When you click an element in inspect mode, the overlay displays:

| Field | Meaning |
|-------|---------|
| **Element** | The DOM element you clicked (`<tag>.classname`) — shown at top to identify what you're inspecting |
| **Item** | The data item being rendered by the view |
| **Source** | The code item and line number that called `api.createElement()` to create this element — click to navigate to that line |
| **View** | The view used for rendering (only shown if different from Source, to avoid redundancy) |
| **via X** | Shown in smaller text if the viewport decorator assigned a different item context |

The overlay shows a chain of entries as you walk up the DOM tree, revealing the rendering hierarchy.

### Information Collected

When inspecting an element, the inspector walks up the DOM collecting:

| Attribute | Source | Meaning |
|-----------|--------|---------|
| `data-source` | Layer 2 | Item name that created this element |
| `data-source-line` | Layer 2 | Line number in that item's code |
| `data-render-instance` | Existing | Render instance ID (registry lookup) |
| `data-item-id` | Existing | Item ID (from viewport decorator) |
| `data-view-id` | Layer 2 | View that rendered this element |
| `data-for-item` | Layer 2 | Item being rendered by that view |

The walk-up stops at `data-render-instance` boundaries, collecting a chain that shows the rendering hierarchy.

---

## Implementation Plan

### Phase 1: Debug Mode Infrastructure

**Goal:** Add debug flag to kernel and rendering context.

**Changes to kernel-core:**

```javascript
// In Kernel constructor or boot()
this.debugMode = new URLSearchParams(window.location.search).has('debug');
```

**Changes to kernel-rendering:**

```javascript
// In renderItem(), merge debug and viewId into context
const newContext = {
  ...context,
  renderPath: [...renderPath, itemId],
  debug: context.debug || this.kernel.debugMode,
  viewId: view.id  // Pass view ID so createElement can stamp it on elements
};
```

**API addition:**

```javascript
// In createRendererAPI()
isDebugMode: () => context.debug || kernel.debugMode,

// For subtree debug re-render
rerenderItemDebug: async (itemId) => {
  return kernel.rendering.rerenderItem(itemId, { debug: true });
}
```

**Testing:**
- Load with `?debug=1`, verify `api.isDebugMode()` returns true
- Load normally, verify it returns false
- Verify context.debug propagates to child renders

### Phase 2: Element Attribution

**Goal:** Stamp elements with source location when debug mode active.

**Stack parsing utility:**

```javascript
// In kernel-rendering or as shared utility
function parseSourceLocation(stack) {
  // Stack format (Chrome): "at functionName (sourceURL:line:col)"
  // Stack format (Firefox/Safari): "functionName@sourceURL:line:col"
  // We want lines that reference Hobson item names (no path separators, no blob:)

  const lines = stack.split('\n');
  for (const line of lines) {
    // Match sourceURL references (item names don't contain / or \)
    const match = line.match(/\(([^\/\\:]+):(\d+):\d+\)/) ||  // Chrome
                  line.match(/@([^\/\\:]+):(\d+):\d+/);        // Firefox/Safari
    if (match) {
      const [, itemName, lineNum] = match;
      // Skip internal names (e.g., createElement itself)
      if (itemName !== 'kernel-rendering') {
        return { itemName, line: parseInt(lineNum, 10) };
      }
    }
  }
  return null;
}
```

Note: Safari uses the same `@` format as Firefox, so the Firefox regex handles both. The existing `default-error-handler` item uses similar parsing and confirms cross-browser compatibility.

**Changes to createElement in createRendererAPI():**

```javascript
createElement(tag, props = {}, children = []) {
  const element = document.createElement(tag);

  // Debug attribution
  const debugActive = context.debug || kernel.debugMode;
  if (debugActive) {
    // Always stamp view context (cheap, no stack trace)
    // Note: viewId comes from context.viewId, set when renderItem() creates the API
    if (context.viewId) {
      element.setAttribute('data-view-id', context.viewId);
    }
    element.setAttribute('data-for-item', containerItem.id);

    // Capture source location (requires stack trace)
    try {
      const stack = new Error().stack;
      const location = parseSourceLocation(stack);
      if (location) {
        element.setAttribute('data-source', location.itemName);
        element.setAttribute('data-source-line', location.line);
      }
    } catch (e) {
      // Ignore - best effort
    }
  }

  // ... existing implementation
}
```

Note: `containerItem` is available in the closure scope of `createRendererAPI`. The `viewId` must be passed via `context.viewId`, which requires a small change to `renderItem()` to include it when constructing the context.

**Testing:**
- Load with `?debug=1`
- Inspect any element in DevTools
- Verify `data-source`, `data-source-line`, `data-view-id`, `data-for-item` attributes present
- Verify line numbers are plausible (within the view's code length)

### Phase 3: Inspector Library

**Goal:** User-facing inspection UI.

**New library item: `element-inspector`**

```javascript
{
  id: "<generate-guid>",
  name: "element-inspector",
  type: "66666666-0000-0000-0000-000000000000",  // library
  content: {
    description: "Inspect UI elements to find which view rendered them.",
    code: `
let inspectorState = null;

export function activate(api) {
  if (inspectorState) {
    console.warn('Element inspector already active');
    return inspectorState;
  }

  let active = false;
  let overlay = null;

  function toggleInspectMode() {
    active = !active;
    document.body.classList.toggle('hobson-inspect-mode', active);
    if (!active && overlay) {
      overlay.remove();
      overlay = null;
    }
  }

  // Keyboard shortcut: Ctrl+Shift+. (avoids conflict with browser DevTools)
  const keyHandler = (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === '.') {
      e.preventDefault();
      toggleInspectMode();
    }
  };
  document.addEventListener('keydown', keyHandler);

  // Click handler when active
  const clickHandler = async (e) => {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();

    const info = collectElementInfo(e.target);
    showInspectorOverlay(info, e.clientX, e.clientY, api);
  };
  document.addEventListener('click', clickHandler, true);

  // Hover highlight when active
  const mouseoverHandler = (e) => {
    if (!active) return;
    e.target.classList.add('hobson-inspect-highlight');
  };
  document.addEventListener('mouseover', mouseoverHandler, true);

  const mouseoutHandler = (e) => {
    if (!active) return;
    e.target.classList.remove('hobson-inspect-highlight');
  };
  document.addEventListener('mouseout', mouseoutHandler, true);

  inspectorState = {
    toggle: toggleInspectMode,
    isActive: () => active
  };

  return inspectorState;
}

export function deactivate() {
  // Note: Full cleanup requires storing handler references.
  // For now, this just resets state. A full implementation would
  // store handlers in inspectorState and remove them here.
  if (inspectorState) {
    if (inspectorState.isActive()) {
      inspectorState.toggle();
    }
    inspectorState = null;
  }
}

function collectElementInfo(element) {
  const info = {
    element,
    chain: []
  };
  
  let el = element;
  while (el && el !== document.body) {
    const entry = {};
    
    // Collect any attribution present
    if (el.dataset.source) {
      entry.source = el.dataset.source;
      entry.sourceLine = el.dataset.sourceLine;
    }
    if (el.dataset.viewId) {
      entry.viewId = el.dataset.viewId;
    }
    if (el.dataset.forItem) {
      entry.forItem = el.dataset.forItem;
    }
    if (el.dataset.itemId) {
      entry.itemId = el.dataset.itemId;
    }
    if (el.dataset.renderInstance) {
      entry.renderInstance = el.dataset.renderInstance;
    }
    
    if (Object.keys(entry).length > 0) {
      entry.tagName = el.tagName.toLowerCase();
      entry.className = el.className;
      info.chain.push(entry);
    }
    
    el = el.parentElement;
  }
  
  return info;
}

async function showInspectorOverlay(info, x, y, api) {
  // Remove existing overlay
  const existing = document.getElementById('hobson-inspector-overlay');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'hobson-inspector-overlay';
  overlay.style.cssText = \`
    position: fixed;
    left: \${x + 10}px;
    top: \${y + 10}px;
    max-width: 400px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 12px;
    z-index: 100000;
    font-size: 13px;
    font-family: system-ui, sans-serif;
  \`;
  
  // Build content
  let html = '<div style="font-weight: 600; margin-bottom: 8px;">Element Inspector</div>';
  
  if (info.chain.length === 0) {
    html += '<div style="color: #666;">No attribution found. Try reloading with ?debug=1</div>';
  } else {
    for (const entry of info.chain) {
      html += '<div style="margin-bottom: 8px; padding: 8px; background: #f5f5f5; border-radius: 4px;">';
      
      if (entry.source) {
        html += \`<div><strong>Created by:</strong> <a href="#" class="inspector-link" data-name="\${entry.source}" data-line="\${entry.sourceLine || ''}">\${entry.source}\${entry.sourceLine ? ':' + entry.sourceLine : ''}</a></div>\`;
      }
      
      if (entry.viewId) {
        html += \`<div><strong>View:</strong> <a href="#" class="inspector-link" data-id="\${entry.viewId}">\${entry.viewId.slice(0,8)}...</a></div>\`;
      }
      
      if (entry.forItem) {
        html += \`<div><strong>Rendering:</strong> <a href="#" class="inspector-link" data-id="\${entry.forItem}">\${entry.forItem.slice(0,8)}...</a></div>\`;
      }
      
      if (entry.itemId && entry.itemId !== entry.forItem) {
        html += \`<div><strong>Item:</strong> <a href="#" class="inspector-link" data-id="\${entry.itemId}">\${entry.itemId.slice(0,8)}...</a></div>\`;
      }
      
      html += \`<div style="color: #999; font-size: 11px;">&lt;\${entry.tagName}&gt;\${entry.className ? '.' + entry.className.split(' ')[0] : ''}</div>\`;
      html += '</div>';
    }
  }
  
  html += '<div style="margin-top: 8px; font-size: 11px; color: #999;">Press Ctrl+Shift+. to exit inspect mode</div>';
  
  overlay.innerHTML = html;
  
  // Add click handlers for links
  overlay.querySelectorAll('.inspector-link').forEach(link => {
    link.style.cssText = 'color: #1976d2; cursor: pointer; text-decoration: none;';
    link.onclick = async (e) => {
      e.preventDefault();
      
      const id = link.dataset.id;
      const name = link.dataset.name;
      const line = link.dataset.line;
      
      if (id) {
        await api.navigate(id, line ? { line: parseInt(line, 10) } : {});
      } else if (name) {
        // Look up by name
        const items = await api.query({ name });
        if (items.length > 0) {
          await api.navigate(items[0].id, line ? { line: parseInt(line, 10) } : {});
        }
      }
      
      overlay.remove();
    };
  });
  
  // Close on click outside
  const closeHandler = (e) => {
    if (!overlay.contains(e.target)) {
      overlay.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
  
  // Close on Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  document.body.appendChild(overlay);
}

// Export for manual activation via REPL
export function inspect(element, api) {
  const info = collectElementInfo(element);
  console.log('Element inspection:', info);
  return info;
}
`
  }
}
```

**CSS additions (kernel-styles):**

```css
.hobson-inspect-mode {
  cursor: crosshair !important;
}

.hobson-inspect-mode * {
  cursor: crosshair !important;
}

.hobson-inspect-highlight {
  outline: 2px solid #2196f3 !important;
  outline-offset: 1px;
}
```

**Activation:**

The inspector is activated automatically when loading with `?debug=1`. The kernel loads the element-inspector library and activates it during boot.

**Keyboard shortcut:** `Ctrl+Shift+>` (or `Ctrl+Shift+.` — same keys, since Shift turns `.` into `>`) toggles inspect mode on/off.

Manual activation via REPL (if not in debug mode):
```javascript
const inspector = (await api.require('element-inspector')).activate(api);
inspector.toggle();  // Enter inspect mode
```

**Testing:**
- Load with `?debug=1` — inspector auto-activates
- Press `Ctrl+Shift+>` to enter inspect mode (cursor becomes crosshair)
- Hover over elements — blue highlight appears
- Click element — overlay shows Item, Source, View chain
- Click links — navigates to source item (line navigation pending code view support)
- Press `Ctrl+Shift+>` again or `Escape` to exit inspect mode

---

## Future Enhancements

### Region Annotations

Views that want finer-grained inspection can annotate regions:

```javascript
const header = api.createElement('div', { 'data-region': 'window-chrome' }, [...]);
const content = api.createElement('div', { 'data-region': 'content-area' }, [...]);
```

The inspector would display these region names, making large views easier to understand.

### Context Menu Integration

Add "Inspect Element" to the existing right-click context menu, providing an alternative to the keyboard shortcut.

### Render Instance Enhancement

Currently the registry stores `{domNode, itemId, viewId, parentId}`. Could extend to store source location of the `renderItem` call itself, providing attribution even without debug mode for the render boundaries.

### Stack-Based Attribution Mode

For intensive debugging, a mode that captures full call stacks (not just immediate caller) and stores them in a WeakMap keyed by element. The inspector could show the complete render chain. Expensive, but powerful for debugging complex nesting.

---

## Summary

This design achieves the goal of answering "who rendered this?" for any UI element with:

- **Zero cost** in normal operation (debug flag gated)
- **Minimal kernel changes** (debug flag, createElement attribution)
- **Full navigation** to source code with line numbers
- **Progressive enhancement** (works partially without debug, fully with debug)
- **Consistency** with Hobson's philosophy (inspector is itself an item, modifiable, inspectable)

The implementation can proceed incrementally: Phase 1 and 2 are small kernel changes that enable Phase 3, which is a pure library addition.

---

## API Dependencies (Verified)

The following existing APIs are required by this design and have been verified to exist:

| API | Location | Notes |
|-----|----------|-------|
| `api.navigate(itemId, { line, col })` | kernel-core | Line/col params supported via URL query |
| `api.query({ name })` | kernel-storage | Generic filter-based query |
| `api.instances.getByItemId()` | kernel-rendering | RenderInstanceRegistry lookup |
| `containerItem` in API closure | kernel-rendering | Available in `createRendererAPI()` |

**Required addition:** `context.viewId` must be passed from `renderItem()` to enable `data-view-id` stamping.
