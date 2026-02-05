# Hobson: System Architecture

## Vision and Inspirations

Hobson is a personal information management system synthesizing ideas from five computing traditions:

**Smalltalk/Lisp Environments** — Image-based persistence where entire runtime state survives across sessions. Code is evaluated interactively via REPL. The system can inspect and modify itself while running.

**Conway's Humane Dozen** — Systems should be immediate (changes visible instantly), inspectable (all parts examinable), modifiable (changeable without stopping), unified (source and runtime are the same), and always-on (no start/stop concept).

**Obsidian Linking** — Notes as first-class entities with explicit bidirectional relationships forming a knowledge graph.

**Obenauer's Itemized OS** — Every digital artifact is an "item" in a unified graph. Separation of data from presentation allows multiple views of the same content.

These traditions converge on a single principle: **radical uniformity**. Everything—data, types, code, renderers, UI—is an item. Items reference types which reference types, forming inheritance chains. This uniformity enables self-documentation, self-modification, and self-hosting.

---

## The Item Data Model

Every piece of data in Hobson has the same structure:

| Field | Description |
|-------|-------------|
| id | GUID (e.g., "550e8400-e29b-41d4-a716-446655440000") |
| name | Optional human-readable name (required for code items) |
| type | GUID of type item |
| created | Timestamp |
| modified | Timestamp |
| attachments | Array of attached item IDs or positioned objects |
| content | Arbitrary key-value data |

### Type Hierarchy

Items reference types which reference types, forming chains that terminate at the ATOM item:

```
note_item → note_type → TYPE_DEFINITION → ATOM (self-referential)
```

The kernel validates that every type chain terminates at ATOM and contains no cycles.

### Children

Children are always objects with an `id` and a `view`:

```javascript
attachments: [
  {
    id: "item-guid",
    view: {
      type: "view-guid"   // Required: which view to render with
      // ... view-specific data
    },
    previousView: { ... } // Optional: stored state for view toggling
  }
]
```

The `view.type` field is required and specifies which view renders the child. All other `view` properties are view-specific—each view defines what data it needs. For example, a spatial container view expects positioning data:

```javascript
view: {
  type: "spatial-view-guid",
  x: 20, y: 20,
  width: 400, height: 300,
  z: 0,
  pinned: false,
  minimized: false,
  maximized: false,
  bannerPosition: "left",
  bannerSize: 200
}
```

A list view might require no additional properties beyond `type`. The `previousView` object preserves state when toggling between views, enabling restore-to-previous behavior.

---

## Bootstrap Architecture

Hobson uses a two-part bootstrap to achieve self-modification:

### Bootloader (bootstrap.html)

A minimal (~350 line) HTML/JavaScript file that never changes. Its responsibilities:

1. Open IndexedDB and create the object store
2. Look for `kernel-core` item in the database
3. If missing: show import UI for initial kernel JSON
4. If present: create a custom `require()` function and compose the kernel
5. Call `kernel.boot()` to initialize the system

The bootloader creates a `storageBackend` that handles ID prefixing for nested instances, making the same kernel work for both top-level and nested Hobson environments.

### Boot Sequence

**First run (empty database):**
```
Open IndexedDB → No kernel found → Show import UI → User imports kernel.json
→ All items stored → Page reloads → Kernel found → Boot
```

**Subsequent runs:**
```
Open IndexedDB → Load kernel-core → Create require() → Compose modules
→ Instantiate Kernel → boot() → Render to DOM
```

---

## Kernel Modules

The kernel decomposes into eight specialized modules, each stored as an item with a fixed GUID.

### KERNEL_STORAGE

Wraps the bootloader-provided storage backend with validation. Key responsibilities:

- CRUD operations: `get(id)`, `set(item)`, `delete(id)`, `query(filter)`
- Type chain validation: ensures every item's type forms a valid chain to ATOM
- Code item validation: ensures code items have unique names
- Cycle detection: prevents circular type definitions

### KERNEL_VIEWPORT

Manages view state—what item is currently displayed and with which view:

- **rootId**: Currently viewed item
- **rootViewId**: Optional view override for current root
- **rootViewConfig**: Additional view configuration (e.g., banner position)
- **Selection state**: Runtime-only state for selected child within root

Viewport state persists to a special viewport item. Selection clears on boot; view preferences persist.

### KERNEL_MODULE_SYSTEM

Loads and caches executable code items (libraries, views):

1. Item's code wrapped with `"use strict"`
2. Wrapped in a Blob and converted to Object URL
3. Dynamically imported via `import(url)`
4. Result cached in memory
5. Cache cleared when any code item is saved

The `require(name)` function loads code items by name or ID and returns the evaluated module.

### KERNEL_RENDERING_SYSTEM

Renders items to DOM using appropriate views. Key systems:

**Render Instance Registry** — Tracks what's currently rendered: which items, with which views, in which DOM locations. Enables partial re-render of specific items in place.

**View Lookup** — Walks an item's type chain looking for a matching view. Multiple views can exist for one type; first match wins; falls back to default view.

**Partial Re-render** — `rerenderItem(itemId)` locates the render instance, re-executes the renderer, and replaces DOM content while preserving positioning and siblings.

**Renderer API Creation** — Constructs the `api` object passed to view render functions. This ~300-line API provides storage operations, navigation, child management, and helpers that views use to interact with the system.

### KERNEL_REPL

Provides the browser-based Read-Eval-Print-Loop for scripting:

- Toggle with Escape key
- Access to full API via `api` object
- Command history with up/down arrow navigation
- Supports async/await and top-level await
- Captures and displays results with error handling
- Resizable input/transcript split panel

### KERNEL_SAFE_MODE

Provides recovery interface when code items are broken. Activated via `?safe=1` URL parameter:

- Loads kernel normally but skips user code items
- Shows minimal UI with item list and raw JSON editor
- Allows repairing broken code items and reloading normally
- Export/import data for backup and restoration
- System reset capability (with confirmation) for complete database clearing

### KERNEL_STYLES

Contains all CSS for the system as a code item. On boot, kernel fetches this item and injects CSS into a `<style>` tag. Enables visual theming from within Hobson.

### KERNEL_CORE

Main kernel composition and orchestration:

- **Module composition**: Loads all subsystems and wires together dependencies
- **Event system**: EventBus with wildcard support for item events
- **Boot sequence**: Ensures seeds exist, applies styles, restores viewport, renders initial root
- **Item lifecycle**: Save with events, delete with cascading parent updates
- **Declarative watches**: System for code items to subscribe to events
- **Navigation**: Updates URL and viewport on item selection
- **System UI**: Help dialog, item list modal, error fallback display

Note: kernel-core is the largest module, handling both orchestration and some UI presentation. The UI responsibilities could be extracted to a separate module for cleaner separation.

---

## Key Item Types

### Well-Known GUIDs

| Type | GUID | Purpose |
|------|------|---------|
| ATOM | 00000000-0000-0000-0000-000000000000 | Self-referential base |
| TYPE_DEFINITION | 11111111-0000-0000-0000-000000000000 | Metaclass for types |
| CODE | 22222222-0000-0000-0000-000000000000 | Base for executable items |
| KERNEL_MODULE | 33333333-0000-0000-0000-000000000000 | Kernel subsystem marker |
| VIEW | aaaaaaaa-0000-0000-0000-000000000000 | Imperative view code |
| VIEW_SPEC | bbbbbbbb-0000-0000-0000-000000000000 | Declarative view definition |
| FIELD_VIEW | cccccccc-0000-0000-0000-000000000000 | Field component view |
| LIBRARY | 66666666-0000-0000-0000-000000000000 | Shared utility code |
| VIEWPORT_TYPE | 77777777-0000-0000-0000-000000000000 | Type for viewport |
| VIEWPORT | 88888888-0000-0000-0000-000000000000 | The viewport item |

### User-Defined Types

Created by making items of type TYPE_DEFINITION:

```javascript
{ id: "note-type", name: "note", type: TYPE_DEFINITION, content: { description: "A markdown note" } }
```

Items of this type reference it:

```javascript
{ id: "my-note", type: "note-type", content: { title: "Title", body: "Content..." } }
```

---

## The View System

The view system unifies rendering and editing. Views can be read-only, editable, or mixed-mode.

### View Discovery

When rendering an item:
1. Walk its type chain
2. Look for VIEW or VIEW_SPEC items with matching `for_type`
3. First match wins (can override via per-child view)
4. Fall back to default JSON view if nothing found

### View Preferences

Users can customize view selection at three levels using the `preferredView` field:

| Level | Where Stored | Question Answered |
|-------|--------------|-------------------|
| **Contextual** | Parent's child spec `view.type` | "How should this parent display this child?" |
| **Item** | Item's `preferredView` field | "What view does this specific item prefer?" |
| **Type** | Type definition's `preferredView` field | "What view do items of this type prefer?" |

The `preferredView` field is a top-level item property (not in `content`) because the kernel reads it during view resolution.

**View Resolution Order:**

```
1. Explicit viewId passed to renderItem()     → use that
2. Parent's child spec has view.type          → use that (contextual override)
3. Item has preferredView field               → use that (item preference)
4. Type definition has preferredView field    → use that (type preference)
5. Walk type chain for VIEW/VIEW_SPEC         → use first match
6. DEFAULT_VIEW                               → fallback (JSON inspector)
```

**Example:**

```javascript
// Item with preferred view
{
  id: "my-workspace",
  type: "note-type-id",
  preferredView: "container-view-id",  // This note prefers spatial view
  content: { ... }
}

// Type definition with preferred view
{
  id: "note-type-id",
  type: TYPE_DEFINITION,
  name: "note",
  preferredView: "note-view-editable",  // All notes prefer editable view
  content: { description: "A markdown note" }
}
```

**API Methods:**

- `api.setPreferredView(itemId, viewId)` — Set preferred view on any item (including type definitions)
- `api.getPreferredView(itemId)` — Get an item's preferred view
- `api.getEffectiveView(itemId)` — Get the view that would actually be used (full hierarchy)
- `api.getContextualView(itemId, parentId)` — Get contextual override from parent

**UI Access:**

Right-click any item to access:
- **View As...** — Quick contextual override (common for read/edit switching)
- **View Settings...** — Modal showing all three levels with explanations

### Imperative Views

For complex interactions, export a render function:

```javascript
export async function render(item, api) {
  return api.createElement('div', {}, [
    ['h1', {}, [item.content.title]],
    ['p', {}, [item.content.body]]
  ]);
}
```

### Declarative View Specs

For simpler cases, declare structure:

```javascript
content: {
  for_type: "note-type",
  ui_hints: [
    { field: "title", label: "Title", mode: "editable" },
    { field: "body", label: "Content", component: "markdown_editor" }
  ]
}
```

### Field Views

Reusable components for common field types (text, markdown, date, reference). Can be unified (one component handles both display and edit) or separate (display-only and edit-only variants).

### The Renderer API

Passed to render functions as the second parameter:

- `get(id)`, `set(item)`, `update(item)`, `delete(id)`, `query(filter)` — Storage
- `renderItem(itemId, viewId)`, `rerenderItem(itemId)` — Rendering
- `attach(parentId, childId)`, `detach(parentId, childId)` — Composition
- `navigate(itemId)` — Navigation
- `IDS` — Well-known GUIDs
- `viewport` — View state access
- `siblingContainer` — Parent container context for "open as sibling" operations
- `setAttachmentView(parentId, childId, viewId)` — Override child's contextual view
- `updateViewConfig(parentId, childId, config)` — Persist view state in parent's attachments array

### Runtime View Patterns

**Sibling Container** — Views can request items to open as siblings within the same parent container. The `api.siblingContainer` provides the parent context, enabling "open here" behavior where clicking a link adds the target item as a sibling window rather than navigating away.

**View Config Persistence** — Per-child view state (window position, size, banner settings, collapsed state) is stored in the parent's `attachments` array. This keeps view-specific layout data with the composition relationship rather than on the items themselves, allowing the same item to appear differently in different contexts.

---

## Event System and Reactive Patterns

### Event Bus

Simple pub-sub with namespace and wildcard support:

- `item:created`, `item:updated`, `item:deleted` — Storage events
- `system:error` — System errors
- `item:*`, `system:*` — Wildcard subscriptions

### Declarative Watches

Code items can declare event subscriptions:

```javascript
content: {
  watches: [
    { event: "item:created", type: "note-type" },
    { event: "item:updated", typeExtends: "container-type" }
  ],
  code: `
    export async function onItemCreated(event, api) { ... }
    export async function onItemUpdated(event, api) { ... }
  `
}
```

When matching events fire, the kernel calls the appropriate handler function with event data and full API access.

---

## Extension Mechanism

Hobson is extended entirely by creating items. No external code changes needed.

### Adding a New Type
1. Create a type item (type = TYPE_DEFINITION)
2. Create a view for it (type = VIEW or VIEW_SPEC)
3. Optionally create field views for properties
4. Items of that type now render correctly

### Modifying Behavior
Edit any code item from within Hobson:
1. Open item in raw editor
2. Modify `content.code`
3. Save → module cache cleared → next require() loads new code

### Event-Driven Handlers
Create code items with `content.watches` to respond to system events without modifying existing code.

### Shared Libraries
Create library items that can be required by other code:

```javascript
const utils = await api.require('utilities');
```

---

## Nested Instances (Self-Hosting)

A Hobson instance can contain another Hobson instance through ID prefixing:

1. Create item of type `hobson-instance`
2. Renderer attempts to boot kernel, finds nothing (due to prefixing)
3. User imports kernel.json into nested instance
4. Items stored with prefix: `instance-abc:kernel-core`, `instance-abc:note-1`
5. Child instance boots with prefixed storage adapter

The child instance is unaware of prefixing. When it requests `kernel-core`, it receives `instance-abc:kernel-core`. When it stores `my-note`, it's saved as `instance-abc:my-note`. True isolation with shared storage.

---

## Extensions Beyond the Kernel

The base kernel provides only essential infrastructure. Richer facilities are built as items. This section examines how system-level features are implemented through the extension mechanism.

### Case Study: Error Handling System

The error handling system demonstrates how user-defined items can provide system-level functionality using the event mechanism. Five items collaborate to capture, store, display, and manage errors:

**1. Error Type** (`error`)
A type definition describing the structure of error items:
- `message` — The error message
- `errorType` — Error class (TypeError, SyntaxError, etc.)
- `frames` — Parsed stack trace with navigable item references
- `context` — Operation, item ID, and renderer that caused the error
- `timestamp` — When the error occurred
- `resolved` — Whether marked as handled

**2. Error List Type** (`error-list`)
A container type for collecting all error items chronologically.

**3. Error Handler** (`default-error-handler`)
A library with a declarative watch on `system:error` events:
```javascript
watches: [{ event: "system:error" }]
```
When the kernel emits a `system:error` event, this handler:
- Parses the stack trace, matching source names to item IDs
- Creates an error item with structured data
- Displays a toast notification with click-to-navigate

**4. Error View** (`error_view`)
Renders individual error items with:
- Color-coded header (red unresolved, green resolved)
- Clickable context links (navigate to source item)
- Clickable stack frames (navigate to code item at line number)
- Action buttons (mark resolved, delete)

**5. Error List View** (`error_list_view`)
Renders the error list with:
- All errors sorted newest-first
- Refresh button to re-query error items
- Clear all button with confirmation

**How It Works**

When an error occurs anywhere in the system:
```
Runtime error thrown
  ↓
Kernel catches via global error handler
  ↓
Kernel emits system:error event with { error, context, timestamp }
  ↓
default-error-handler's onSystemError() called
  ↓
Handler parses stack, creates error item, shows toast
  ↓
User clicks toast → navigates to error item
  ↓
error_view renders with clickable stack trace
  ↓
User clicks stack frame → navigates to source code item
```

The entire system is replaceable. Delete `default-error-handler` to disable error capture. Create a custom handler to log errors differently. Modify `error_view` to change the display. All without touching kernel code.

### Other Event-Driven Extensions

**View Update Watcher** (`view-update-watcher`)
Watches for updates to view items. When a view's code changes, automatically re-renders all items currently displayed with that view. Enables live editing of views with immediate feedback.

**Hobson Instance Lifecycle** (`hobson-instance-lifecycle`)
Watches for deletion of hobson-instance items. When a nested instance is deleted, cascade-deletes all items with that instance's prefix, preventing orphaned nested data.

### Types Created
- **Note** — Markdown documents with title, body, and tags
- **Container** — Spatial canvas for organizing items as positioned windows
- **Tag** — Hierarchical categorization items
- **Script** — Executable code snippets
- **Item Search** — Saved search configurations
- **Tag Browser** — Interface for navigating by tags
- **Error, Error List** — System error capture (see case study above)
- **Hobson Instance** — Nested Hobson environments

### Views Created
- **Note Views** — Editable and readonly views for markdown notes with link detection
- **Container View** — 2D canvas with draggable, resizable windows
- **Code Views** — Editable and readonly views for code items
- **Tag Browser View** — Hierarchical tag navigation
- **Item Search View** — Search interface with results
- **Sortable List View** — Reorderable list of attachments
- **Compact Card View** — Condensed item display
- **Generic View** — Spec-driven rendering from VIEW_SPEC items
- **Error Views** — Error detail and error list views (see case study above)

### Libraries Created
- **Markdown** — `markdown-it`, `marked`, `hobson-markdown` for parsing and rendering
- **CodeMirror** — Code editing with syntax highlighting
- **Field Editors** — Text, textarea, checkbox, number, select, item reference
- **Tag Picker UI** — Tag selection interface
- **Item Search Lib** — Search functionality
- **CSS Loader** — Dynamic stylesheet loading
- **Generic Editor** — Form generation from type specs
- **Default Error Handler** — Error capture and toast notifications (see case study above)

### Field Views Created
- **Text, Textarea, Heading** — Basic text display/editing
- **Markdown** — Editable and readonly markdown fields
- **Code** — Syntax-highlighted code fields
- **Checkbox, Number** — Primitive value fields
- **Tags** — Tag reference display
- **Timestamp** — Date/time formatting
- **JSON** — Raw JSON editing

---

## Module Interactions

### Data Flow: Creating an Item

```
User (REPL or UI)
  ↓
api.set(item)
  ↓
Kernel.saveItem(item)
  ↓
Storage.set(item, kernel)  [validates type chain]
  ↓
StorageBackend.set(item)   [IndexedDB write, prefixes if nested]
  ↓
Kernel.events.emit('item:created', ...)
  ↓
Declarative watchers called
```

### Data Flow: Rendering

```
navigateToItem(itemId)
  ↓
Kernel.renderRoot(itemId)
  ↓
RenderingSystem.renderItem(viewportId)
  ↓
Viewport renderer executes
  ↓
Calls renderItem(rootId) for current root
  ↓
Type chain walk → view lookup
  ↓
ModuleSystem.require(viewId)
  ↓
Evaluate view code if first time
  ↓
render(item, api) called
  ↓
May call renderItem() for attachments (recursion)
  ↓
Register in instance registry → Insert into DOM
```

---

## Summary

Hobson achieves its goals through layered simplicity:

1. **Items** provide uniform structure for all data
2. **Types** provide categorization and inheritance
3. **Bootloader** provides minimal, unchanging entry point
4. **Kernel modules** provide core infrastructure as modifiable items
5. **Views** provide presentation separate from data
6. **Events** provide reactive extensibility
7. **REPL** provides interactive programmability

The result is a system that can document itself, modify itself, and host instances of itself—all while remaining approachable for daily use as a personal information manager.
