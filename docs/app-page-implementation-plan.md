# App Page Implementation Plan

*Date: 2026-02-11*
*Status: Proposed*

---

## Overview

This plan introduces an **app-page** system for building interactive tool pages using Hobson's existing item and attachment infrastructure. Rather than inventing a new block data model, widgets are items — each with its own type and view — and the page is an item that contains them as attachments, with a grid-based layout view.

The approach follows Hobson's core principle of radical uniformity: a button is an item, a markdown block is an item, a checkbox group is an item. They can be inspected, linked to, and reused independently.

### Motivating Example

A "Create Nested Instance" page where the user sees explanatory markdown, a checkbox group to select which items to include, and a button to create the instance. Today this requires creating a type-definition, an instance, and a custom imperative view. With app-pages, it requires creating a page item, adding widget attachments, and positioning them on a grid.

---

## Architecture

### How It Fits the Existing System

The app-page system uses three existing mechanisms:

1. **Attachments array** — widget items are attachments of the page item, exactly as spatial container children are today
2. **Per-attachment view configuration** — the `view` object on each attachment entry stores grid position (col, row, span) rather than spatial coordinates (x, y, width, height)
3. **View rendering** — each widget is rendered by its own view, exactly as any item is today

This is architecturally analogous to the spatial container view, but with a CSS grid layout model instead of absolute positioning, and with a shared state mechanism for inter-widget communication.

### The Pieces

```
app-page (type-definition)
├── app-page-view (view) — renders the grid and child widgets; manages shared state
│
widget-markdown (type-definition)
├── widget-markdown-view (view)
│
widget-button (type-definition)
├── widget-button-view (view)
│
widget-checkbox-group (type-definition)
├── widget-checkbox-group-view (view)
```

Each widget type is independent and new widget types can be added incrementally without modifying any existing code.

---

## Data Model

### Page Item

```javascript
{
  id: "nested-instance-creator",
  type: "<app-page-type-id>",
  name: "Create Nested Instance",
  created: Date.now(),
  modified: Date.now(),
  attachments: [
    {
      id: "<markdown-widget-id>",
      view: {
        type: "<app-page-view-id>",    // identifies this as grid-positioned
        col: 1, row: 1,
        colSpan: 12, rowSpan: 1
      }
    },
    {
      id: "<checkbox-widget-id>",
      view: {
        type: "<app-page-view-id>",
        col: 1, row: 2,
        colSpan: 12, rowSpan: 1
      }
    },
    {
      id: "<button-create-id>",
      view: {
        type: "<app-page-view-id>",
        col: 1, row: 3,
        colSpan: 6, rowSpan: 1
      }
    },
    {
      id: "<button-cancel-id>",
      view: {
        type: "<app-page-view-id>",
        col: 7, row: 3,
        colSpan: 6, rowSpan: 1
      }
    }
  ],
  content: {
    description: "Tool for creating nested Hobson instances",
    columns: 12,
    rowHeight: "auto",
    gap: 8
  }
}
```

**Notes on the grid model:**

- 12 columns is a well-understood responsive grid (matches Bootstrap, CSS Grid conventions).
- `rowSpan` and `colSpan` control widget size. `row` and `col` are 1-based to match CSS Grid.
- `rowHeight: "auto"` means rows size to their content. An alternative would be a fixed row height for dashboard-style layouts, but auto is the right default for document-like pages.
- Widgets that should appear on the same line simply share the same `row` value with different `col` values.

### Widget Items

Widgets are ordinary items. Their `content` stores configuration; their views handle rendering and interaction.

**Markdown widget:**

```javascript
{
  id: "<markdown-widget-id>",
  type: "<widget-markdown-type-id>",
  name: "Instructions",
  attachments: [],
  content: {
    body: "# Create a Nested Instance\n\nChoose which items to include in the new instance. Libraries provide reusable code, while views control how items are displayed."
  }
}
```

**Checkbox group widget:**

```javascript
{
  id: "<checkbox-widget-id>",
  type: "<widget-checkbox-group-type-id>",
  name: "Item Selector",
  attachments: [],
  content: {
    label: "Items to include",
    source: `
      const all = await api.getAll();
      return all.filter(i => i.type === api.IDS.LIBRARY);
    `,
    labelField: "name",
    stateKey: "selectedItems"
  }
}
```

**Button widget:**

```javascript
{
  id: "<button-create-id>",
  type: "<widget-button-type-id>",
  name: "Create Button",
  attachments: [],
  content: {
    label: "Create Instance",
    variant: "primary",
    code: `
      const selected = pageContext.getState('selectedItems');
      const lib = await api.require('create-nested-instance');
      await lib.create(selected, api);
    `
  }
}
```

The `code` field is a JavaScript string executed on click with `api` and `pageContext` in scope. This is more direct than an indirection layer — the button's behavior is right there on the item, inspectable and editable like any other code in Hobson.

---

## Shared State

### The Problem

Widgets need to communicate: the checkbox group produces a list of selected items; the button's handler needs to consume that list. But widgets are independent items — they don't know about each other.

### The Solution: Runtime State on the Page

The app-page-view maintains a runtime state object (a simple key-value map) that is **not** persisted to the page item's content. It lives only as long as the page is rendered. This is the right choice because:

- UI state (checkbox selections, text input values) is ephemeral — it shouldn't survive a page reload unless explicitly saved
- Persisting every checkbox toggle to IndexedDB would be noisy and slow
- Configuration (which query to run, which handler to invoke) is in `content` and persists normally

The app-page-view creates the state object and passes it to widget views via an extended context:

```javascript
// Inside app-page-view's render function
const pageState = {};

const pageContext = {
  getState(key) {
    return pageState[key];
  },

  setState(key, value) {
    pageState[key] = value;
    // Notify any widgets that depend on this key
    notifyStateChange(key, value);
  },

  // Subscribe to state changes (for widgets that need to react)
  onStateChange(key, callback) {
    // Simple pub/sub within the page
  }
};
```

### How Widgets Use State

**The checkbox group** writes to state when selections change:

```javascript
// In widget-checkbox-group-view
onChange(selectedItems) {
  pageContext.setState(widget.content.stateKey, selectedItems);
}
```

**The button** reads from state when clicked — the inline code accesses `pageContext` directly:

```javascript
// In the button item's content.code
const selected = pageContext.getState('selectedItems');
const lib = await api.require('create-nested-instance');
await lib.create(selected, api);
```

### How PageContext Reaches Widget Views

This is the key integration question. The existing rendering pipeline calls `view.render(item, api)` — there's no third argument for page context. There are two options:

**Option A: Augment the api object.** The app-page-view wraps the standard api with additional methods before passing it to widget views:

```javascript
const widgetApi = {
  ...api,
  pageContext   // adds getState, setState, onStateChange
};

// Render each widget with the augmented API
const widgetView = await api.require(widgetViewName);
const element = await widgetView.render(widgetItem, widgetApi);
```

This works because the app-page-view is responsible for rendering its own children — it doesn't go through the kernel's standard renderItem pipeline for them. It loads each widget item, finds its view, and calls render directly, just as the spatial container view does.

**Option B: Use a well-known property on the widget item.** Pass context via a temporary property that widget views look for. This is messier and I'd avoid it.

**Recommendation: Option A.** It's clean, explicit, and doesn't touch the kernel. Widget views that use `api.pageContext` know they're page widgets. Widget views that don't use it work fine as standalone items too — they just won't have inter-widget communication.

---

## Implementation Steps

### Step 1: Type Definitions

Create two category items and four type definitions. No kernel changes required — these are just items.

**App page type:**

```javascript
{
  id: "<generate-guid>",
  name: "app-page",
  type: TYPE_DEFINITION,
  attachments: [],
  content: {
    description: "A grid-based page for composing interactive tool UIs from widget items. Children are rendered as widgets on a CSS grid."
  }
}
```

**Widget types (three to start):**

```javascript
// widget-markdown
{
  id: "<generate-guid>",
  name: "widget-markdown",
  type: TYPE_DEFINITION,
  attachments: [],
  content: {
    description: "A markdown text block for use in app-pages.",
    fields: {
      body: { type: "string", description: "Markdown content" }
    }
  }
}

// widget-button
{
  id: "<generate-guid>",
  name: "widget-button",
  type: TYPE_DEFINITION,
  attachments: [],
  content: {
    description: "A clickable button for use in app-pages. The code field is executed on click with api and pageContext in scope.",
    fields: {
      label: { type: "string", description: "Button text" },
      variant: { type: "string", description: "primary | secondary | danger", default: "primary" },
      code: { type: "string", description: "JavaScript to execute on click (has api, pageContext in scope)" }
    }
  }
}

// widget-checkbox-group
{
  id: "<generate-guid>",
  name: "widget-checkbox-group",
  type: TYPE_DEFINITION,
  attachments: [],
  content: {
    description: "A group of checkboxes populated from a code-defined source, for use in app-pages.",
    fields: {
      label: { type: "string", description: "Group label" },
      source: { type: "string", description: "JavaScript that returns an array of items (has api in scope)" },
      labelField: { type: "string", description: "Which field on source items to use as checkbox label (dot-path)" },
      stateKey: { type: "string", description: "Key to write selected items to in page state" }
    }
  }
}
```

**Testing:** Create these via REPL. Verify they appear in the item list and their type chains validate.

---

### Step 2: Widget Views

Three small view items, one per widget type. These are independent and testable in isolation.

#### widget-markdown-view

Renders markdown content. This is essentially the same rendering logic already used in the note view, extracted into a widget context.

```javascript
export async function render(item, api) {
  const container = api.createElement('div', {
    class: 'widget-markdown'
  });

  const body = item.content?.body || '';

  // Use existing markdown library if available
  try {
    const md = await api.require('markdown-renderer');
    container.innerHTML = md.render(body);
  } catch {
    // Fallback: render as pre-formatted text
    const pre = api.createElement('pre', {
      style: 'white-space: pre-wrap; margin: 0;'
    });
    pre.textContent = body;
    container.appendChild(pre);
  }

  // Make item links clickable (same pattern as note view)
  container.querySelectorAll('a[href^="item://"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').replace('item://', '');
      api.navigate(targetId);
    });
  });

  return container;
}
```

**Content fields:** `body` (string, markdown)

#### widget-button-view

Renders a button that executes inline code on click.

```javascript
export async function render(item, api) {
  const label = item.content?.label || 'Button';
  const variant = item.content?.variant || 'primary';

  const button = api.createElement('button', {
    class: `widget-button widget-button-${variant}`
  });
  button.textContent = label;

  button.addEventListener('click', async () => {
    const code = item.content?.code;
    if (!code) return;

    try {
      button.disabled = true;
      button.textContent = 'Working...';

      const pageContext = api.pageContext || { getState() {}, setState() {} };
      const fn = new Function('api', 'pageContext', `return (async () => { ${code} })()`);
      await fn(api, pageContext);

    } catch (err) {
      console.error('Button handler error:', err);
      alert('Error: ' + err.message);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });

  return button;
}
```

**Content fields:** `label` (string), `variant` (string), `code` (string — JavaScript executed on click with `api` and `pageContext` in scope)

**Note on the code pattern:** The button's behavior is inline code on the item itself, consistent with how code items work in Hobson. The code can `api.require()` libraries for complex logic, keeping the button's `content.code` as a thin orchestration layer.

#### widget-checkbox-group-view

Renders a list of checkboxes populated from a code-defined source, writing selections to page state.

```javascript
export async function render(item, api) {
  const container = api.createElement('div', {
    class: 'widget-checkbox-group'
  });

  const label = item.content?.label;
  if (label) {
    const labelEl = api.createElement('div', {
      class: 'widget-checkbox-group-label'
    });
    labelEl.textContent = label;
    container.appendChild(labelEl);
  }

  // Run source code to get options
  const sourceCode = item.content?.source;
  const labelField = item.content?.labelField || 'name';
  const stateKey = item.content?.stateKey;

  let options = [];
  if (sourceCode) {
    try {
      const fn = new Function('api', `return (async () => { ${sourceCode} })()`);
      options = await fn(api) || [];
    } catch (err) {
      console.error('Checkbox group source error:', err);
      const errEl = api.createElement('div', { class: 'widget-error' });
      errEl.textContent = 'Failed to load options: ' + err.message;
      container.appendChild(errEl);
      return container;
    }
  }

  const selected = new Set();

  const listEl = api.createElement('div', {
    class: 'widget-checkbox-list'
  });

  for (const opt of options) {
    const row = api.createElement('label', {
      class: 'widget-checkbox-row'
    });

    const checkbox = api.createElement('input', { type: 'checkbox' });
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selected.add(opt.id);
      } else {
        selected.delete(opt.id);
      }
      // Write to page state
      if (stateKey && api.pageContext) {
        api.pageContext.setState(stateKey, Array.from(selected));
      }
    });

    const labelSpan = api.createElement('span', {});
    // Walk the label field path (supports "name", "content.title", etc.)
    labelSpan.textContent = getNestedValue(opt, labelField) || opt.id;

    row.appendChild(checkbox);
    row.appendChild(labelSpan);
    listEl.appendChild(row);
  }

  container.appendChild(listEl);
  return container;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}
```

**Content fields:** `label` (string), `source` (string — JavaScript that returns an array, has `api` in scope), `labelField` (string, dot-path), `stateKey` (string)

**Testing for all widget views:** Create a widget item of each type manually (via REPL or default view). Open the widget item directly — it should render standalone (buttons without page context simply won't read state, checkboxes will render but selections won't propagate anywhere). This confirms each widget view works independently before integrating into the page.

---

### Step 3: The App Page View

This is the core piece — the view for app-page items that renders children on a CSS grid with shared state. It's modelled on the spatial container view but with different layout logic.

```javascript
export async function render(pageItem, api) {
  const IDS = api.IDS || kernel.IDS;

  // --- Page State (runtime only, not persisted) ---
  const pageState = {};
  const stateListeners = {};  // key -> [callback]

  const pageContext = {
    getState(key) {
      return pageState[key];
    },
    setState(key, value) {
      pageState[key] = value;
      (stateListeners[key] || []).forEach(cb => cb(value));
    },
    onStateChange(key, callback) {
      if (!stateListeners[key]) stateListeners[key] = [];
      stateListeners[key].push(callback);
    }
  };

  // --- Grid Container ---
  const columns = pageItem.content?.columns || 12;
  const gap = pageItem.content?.gap || 8;

  const grid = api.createElement('div', {
    class: 'app-page-grid',
    style: `
      display: grid;
      grid-template-columns: repeat(${columns}, 1fr);
      gap: ${gap}px;
      padding: 16px;
      max-width: 960px;
      width: 100%;
    `
  });

  // --- Render Each Child Widget ---
  const children = pageItem.attachments || [];

  for (const childSpec of children) {
    const childId = childSpec.id || childSpec;
    const viewConfig = childSpec.view || {};

    // Load the child item
    let childItem;
    try {
      childItem = await api.get(childId);
    } catch {
      console.warn('App page: failed to load child', childId);
      continue;
    }

    // Find the view for this child item
    const childView = await api.findView(childItem.type);
    if (!childView) {
      console.warn('App page: no view for child', childItem.name, childItem.type);
      continue;
    }

    // Load the view module
    let viewModule;
    try {
      viewModule = await api.require(childView.name || childView.id);
    } catch {
      console.warn('App page: failed to load view for', childItem.name);
      continue;
    }

    // Create augmented API with page context
    const widgetApi = Object.create(api);
    widgetApi.pageContext = pageContext;

    // Render the widget
    let widgetElement;
    try {
      widgetElement = await viewModule.render(childItem, widgetApi);
    } catch (err) {
      console.error('App page: widget render error', childItem.name, err);
      widgetElement = api.createElement('div', { class: 'widget-error' });
      widgetElement.textContent = `Error rendering ${childItem.name}: ${err.message}`;
    }

    // Wrap in grid cell with positioning
    const col = viewConfig.col || 1;
    const row = viewConfig.row || 'auto';
    const colSpan = viewConfig.colSpan || columns;
    const rowSpan = viewConfig.rowSpan || 1;

    const cell = api.createElement('div', {
      class: 'app-page-cell',
      style: `
        grid-column: ${col} / span ${colSpan};
        grid-row: ${row === 'auto' ? 'auto' : `${row} / span ${rowSpan}`};
      `,
      'data-item-id': childId
    });

    cell.appendChild(widgetElement);
    grid.appendChild(cell);
  }

  // --- Outer wrapper ---
  const wrapper = api.createElement('div', {
    class: 'app-page',
    style: 'display: flex; justify-content: center; height: 100%; overflow-y: auto;'
  });
  wrapper.appendChild(grid);

  return wrapper;
}
```

**Key decisions in this code:**

- The page view renders children *directly* — it doesn't go through the kernel's standard renderItem pipeline. This is the same pattern the spatial container uses, and it's what allows us to pass the augmented API with `pageContext`.
- Grid positioning comes from each attachment's `view` object in the parent's attachments array, consistent with how spatial positioning works today.
- `Object.create(api)` for the widget API means widgets inherit all standard API methods and can additionally access `pageContext`. Widgets that don't use `pageContext` work fine — they're just normal views.
- Errors in individual widgets don't crash the page. Each widget renders in a try/catch with a visible error placeholder.

**Testing:** Create an app-page item with one markdown widget as an attachment. Configure the attachment's view with grid position. Navigate to the page. The markdown should render in the grid. Then add more widgets and test state flow.

---

### Step 4: CSS for Widgets

Add styles to the kernel styles item (or as a separate library). These should be minimal — widgets should look native to Hobson's existing aesthetic.

```css
/* App Page */
.app-page {
  font-family: inherit;
}

.app-page-grid {
  align-content: start;
}

.app-page-cell {
  min-width: 0;    /* prevent grid blowout */
}

/* Markdown Widget */
.widget-markdown {
  line-height: 1.5;
}
.widget-markdown h1 { font-size: 1.4em; margin: 0 0 0.5em; }
.widget-markdown h2 { font-size: 1.2em; margin: 0 0 0.4em; }
.widget-markdown p { margin: 0 0 0.5em; }

/* Button Widget */
.widget-button {
  padding: 8px 20px;
  border: 1px solid var(--border-color, #555);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  background: var(--bg-secondary, #2a2a2a);
  color: var(--text-color, #e0e0e0);
  transition: background 0.15s;
}
.widget-button:hover {
  background: var(--bg-hover, #3a3a3a);
}
.widget-button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.widget-button-primary {
  background: var(--accent-color, #4a9eff);
  color: #fff;
  border-color: var(--accent-color, #4a9eff);
}
.widget-button-primary:hover {
  filter: brightness(1.1);
}
.widget-button-danger {
  background: #c0392b;
  color: #fff;
  border-color: #c0392b;
}

/* Checkbox Group Widget */
.widget-checkbox-group-label {
  font-weight: bold;
  margin-bottom: 8px;
  font-size: 14px;
}
.widget-checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.widget-checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  cursor: pointer;
  font-size: 14px;
}
.widget-checkbox-row:hover {
  background: var(--bg-hover, rgba(255,255,255,0.05));
}

/* Shared */
.widget-error {
  color: #e74c3c;
  padding: 8px;
  border: 1px solid #e74c3c;
  border-radius: 4px;
  font-size: 13px;
}
```

---

### Step 5: End-to-End Test — The Nested Instance Page

This is the validation step. Build the actual "Create Nested Instance" page as described in the motivating example.

**Items to create:**

1. An `app-page` item: "Create Nested Instance"
2. A `widget-markdown` item with instructional text
3. A `widget-checkbox-group` item querying for libraries (or all code items)
4. A `widget-button` item labelled "Create" with inline code that calls the `create-nested-instance` library
5. Optionally a `widget-button` item labelled "Cancel" that navigates back

**The handler library** (`create-nested-instance` or whatever it's currently called) is invoked directly from the button's `content.code`. No adapter needed — the inline code calls whatever API the library exports.

**Test sequence:**

1. Navigate to the app-page item
2. Verify: markdown renders with formatted text
3. Verify: checkbox group shows libraries with checkboxes
4. Check several items
5. Click "Create"
6. Verify: handler receives the selected item IDs and creates the nested instance
7. Verify: errors are handled gracefully (no items selected, handler failure, etc.)

---

## Step 6: Design Mode (Future)

Once the data model and live rendering are proven, the next major step is a visual design mode for app-pages. This section is intentionally brief — the details should be worked out after experience with manually-built pages reveals what matters most.

### Concept

The app-page-view gains a design/live toggle (a button or keyboard shortcut). In design mode:

- A visible grid overlay shows column boundaries
- Each widget shows drag handles for repositioning and resizing on the grid
- Clicking a widget selects it and shows a property panel (its content fields rendered via the standard field/view system)
- A toolbar or `/` menu allows inserting new widgets (creates a new widget item of the chosen type and adds it as a child)
- Dragging a widget snaps to grid cells and updates its `view.col`, `view.row`, `view.colSpan`, `view.rowSpan` in the parent's attachments array
- Widgets are not interactive in design mode (buttons don't fire, checkboxes don't toggle)

In live mode, the grid overlay disappears and widgets are fully interactive. The switch is instant — same view, different rendering branch.

### What Makes This Tractable

The hard parts of a visual designer — persistence, layout calculation, component rendering — are already handled by existing systems. The designer is "just" a UI layer that manipulates the parent item's attachments array (positions) and the child item's content (configuration). Both are standard Hobson item operations.

The spatial container view already implements drag-to-reposition with snap, z-ordering, and resize handles. Much of that interaction code can be adapted for grid-based positioning. The key differences:

- Grid snapping replaces pixel-perfect positioning
- Column/row/span replaces x/y/width/height
- Widget insertion creates a typed item (user picks from widget types) and adds it as an attachment

### Open Questions for Design Mode

- **Property panel location**: sidebar, popover, or inline panel below the widget?
- **Widget templates**: should there be pre-configured widget templates (e.g., "form group" = a row with label + input + button)?
- **Undo**: design changes are item saves. Undo could use item versioning if implemented, or a simple local undo stack in the view.
- **Responsive behaviour**: should the grid adapt for mobile? If so, how does the designer express responsive breakpoints?

These are best answered after building and using several pages manually.

---

## Future Widget Types

Once the core system is working, new widget types are incremental additions (one type-definition + one view each):

- **widget-text-input** — single-line text field, writes to page state
- **widget-select** — dropdown populated from a query or static options
- **widget-divider** — visual separator (horizontal rule)
- **widget-embedded-item** — renders any Hobson item inline using its own view (the bridge to full Hobson rendering within a page)
- **widget-number-input** — numeric input with optional min/max
- **widget-toggle** — boolean switch
- **widget-item-picker** — search/select for referencing an existing item
- **widget-code** — inline code display (syntax-highlighted)
- **widget-data-table** — renders query results as a table

The `widget-embedded-item` type is particularly powerful — it means any Hobson item with a view can appear inside a page, making pages composable with the entire existing system.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Widget views need API shape not available in standard rendering | Medium | App-page-view renders children directly (same as container_view), so it controls the API passed to widget views. No kernel changes needed. |
| State management becomes complex as pages grow | Low | State is a flat key-value map. Complexity should push users toward custom views, not toward making page state more powerful. |
| Performance with many widgets | Low | Each widget is one item load + one view render. Unlikely to be an issue below ~30 widgets per page. |
| Grid layout insufficient for complex UIs | Expected | This is by design — complex UIs should be views. The embedded-item widget bridges the gap. |
| Widget type proliferation creates maintenance burden | Low | Each widget is independent — they don't interact with each other except through state. New widgets don't affect existing ones. |
| No kernel changes needed | N/A — positive | This entire system is implemented as userland items. No risk to kernel stability. |

---

## Summary of Items to Create

| # | Item | Type | Purpose |
|---|------|------|---------|
| 1 | app-page | TYPE_DEFINITION | The page type |
| 2 | widget-markdown | TYPE_DEFINITION | Markdown text widget type |
| 3 | widget-button | TYPE_DEFINITION | Button widget type |
| 4 | widget-checkbox-group | TYPE_DEFINITION | Checkbox group widget type |
| 5 | app-page-view | VIEW | Renders app-page items as grid with shared state |
| 6 | widget-markdown-view | VIEW | Renders markdown widget |
| 7 | widget-button-view | VIEW | Renders button widget |
| 8 | widget-checkbox-group-view | VIEW | Renders checkbox group widget |
| 9 | (CSS additions) | — | Added to kernel-styles |
| 10 | Create Nested Instance | app-page | The first real page (test case) |
| 11 | (widget attachments for #10) | various | 3-4 widgets for the test page |

Total: ~8 new items for the framework, ~4 for the test page. No kernel modifications.
