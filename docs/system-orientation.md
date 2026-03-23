# Hobson System Orientation

A concise guide for Claude to read at session start. Covers what exists, what it does, and where to find details. For the full feature list see the Feature Overview item (`c0c0c0c0-0092`). For project priorities see the Roadmap item (`c0c0c0c0-0090`).

## Philosophy & Goals

Hobson is a personal information management system where everything — data, code, UI, documentation — is an **item** stored in IndexedDB. The system is inspired by Smalltalk's live image, Lisp's REPL-first development, Obsidian's linking, and Obenauer's itemized OS concept. The north star is a system that defines itself in terms of itself: views are items, types are items, the documentation you're reading about items is itself made of items.

Key design values: radical uniformity (one abstraction for everything), user sovereignty (everything is inspectable and modifiable), minimal kernel (if it can be an item, it must be an item), and self-revealing code (every API call expresses its intent through its arguments).

**Detailed docs:** Philosophy & Inspirations (`a0a0a0a0-d0c0-4000-8000-000000000001`), Project Context (`c0c0c0c0-0030`)

## The Item Model

An item is a JSON object with `id` (GUID), `type` (GUID of a type-definition item), `created`/`modified` timestamps, `attachments` (array of child item IDs — compositional hierarchy), and `content` (a schema-free map of type-specific data).

**Types** are items too. Every item's `type` field points to a type-definition item, forming chains that terminate at the `atom` seed. `typeChainIncludes()` checks inheritance. The seed types (item, type-definition, code, library, view, kernel-module) are created at first boot with well-known GUIDs.

**Attachments** are the compositional hierarchy — a workspace contains notes, a note can contain sub-items. An item can appear as an attachment in multiple parents. Cycles are permitted (knowledge graphs) but detected at render time.

**Tags** are lightweight cross-cutting classification. Any item can serve as a tag. Tags are stored in `content.tags` as an array of GUIDs. The system ships with tags for concept, feature, idea, starred, archive, and task.

**Content conventions:** `content.description` holds Active Text (the document format), `content.code`/`content.hob` hold source code, `content.tags` holds tag GUIDs, `content.parent` holds taxonomical parent. Spatial fields (`x`, `y`, `width`, `height`, `z`, `minimized`, `maximized`) are used by the spatial canvas.

**Detailed docs:** Core Concepts (`a0a0a0a0-d0c0-4000-8000-000000000002`), Attachments (`c0c0c0c0-0005`), Tags & Classification (`c0c0c0c0-0021`), Content Field Conventions (`c0c0c0c0-0024`)

## Three-Layer Architecture

| Layer | Responsibility | Key items |
|-------|---------------|-----------|
| **Kernel** | Storage (IndexedDB), event bus, code/module loading, bootstrap. No UI except safe-mode fallback. | `kernel:core` (`33333333-1111`), `kernel:storage` (`33333333-2222`), `kernel:module-system` (`33333333-4444`), `kernel:safe-mode` (`33333333-7777`), `kernel:styles` (`33333333-8888`) |
| **Viewport** | Rendering engine, navigation, view resolution, chrome (REPL bar, help dialog). Built from regular items but core infrastructure. | `viewport-rendering` (`f1111111-0008`), `viewport-manager`, `selection-manager`, `keyboard-shortcuts` |
| **Userland** | Views, libraries, type definitions, user data, documentation. Everything the user creates or customizes. | All views, libraries, notes, workspaces, etc. |

**The kernel boundary rule:** If it can be built as an item, it must not be in the kernel. The kernel provides only what cannot be implemented as items.

**Boot sequence:** `bootloader.html` opens IndexedDB → loads `kernel:core` as ES module → kernel initializes storage, seeds, styles, safe-mode screen → emits `kernel:boot-complete` → `viewport-manager` takes over and renders the UI.

**API layering:** `kernel.createAPI()` provides base API (storage, events, modules). `viewport-rendering.enrichAPI()` adds rendering methods (createElement, setRootView, editRaw, etc.).

**Detailed docs:** System Layers (`c0c0c0c0-0091`), Architecture Overview (`a0a0a0a0-d0c0-4000-8000-000000000003`), Kernel (`c0c0c0c0-0001`), Bootstrap (`c0c0c0c0-0002`)

## Active Text (Document Format)

Active Text is a JSON AST format used in `content.description`. It replaces plain markdown strings. The AST uses tagged arrays: `[":doc", [":p", {"s": "text"}], [":h2", {"s": "heading"}], ...]`. Block nodes include `:p`, `:h1`–`:h6`, `:ul`/`:ol`/`:li`, `:blockquote`, `:code-block`, `:table`, `:hr`, `:eval` (embedded Hob expressions). Inline nodes include `:strong`, `:em`, `:code`, `:s` (strikethrough), `:mark` (highlight), `:item-ref`, `:transclusion`, `:field-ref`, `:link`.

The Active Text editor supports contenteditable editing with per-block granularity, markdown shortcuts for block creation, `@` autocomplete for item references, `@@` for transclusions, `{{` for field references, inline formatting via keyboard shortcuts, and click-to-edit popovers for links and references.

**Rendering:** The `doc-renderer` library converts AST to DOM. Read-only rendering is handled by `field-view-doc-readonly`, editable by `field-view-doc-editable`.

**Detailed docs:** Transclusion (`c0c0c0c0-0035`)

## Views & Rendering

A **view** is a code item that renders an item to DOM. Views receive `(item, api)` and return a DOM element. The system resolves which view to use via: explicit override (context menu "Change View") → type-definition's `content.default_view` → `generic-view` fallback.

**Three ways to write views:**
1. **Declarative view-specs** — JSON config consumed by `generic-view`. Specify field names, field-view types, and layout. No code required.
2. **JS views** — Full ES module with `render(item, api)`. Maximum flexibility.
3. **Hob views** — Written in the Hob language. Use morphdom for efficient DOM diffing. Preferred for new views.

**Field views** are sub-views that render a single field (text input, checkbox, markdown, code editor, etc.). View-specs compose field-views into layouts.

**Reactive updates:** When an item changes, `viewport-rendering` re-renders all instances showing that item. Hob views use selector-filtered reactivity — views declare which items they depend on via `get-item :select`, and only re-render when those specific items change.

**Detailed docs:** Views & Rendering (`a0a0a0a0-d0c0-4000-8000-000000000004`), Viewport (`c0c0c0c0-0033`)

## The Hob Language

Hob is a Lisp dialect designed for Hobson. Code is stored as JSON AST in `content.hob`, with a human-readable s-expression format (`.hob` sidecar files) for editing. The `hob-interpreter` library evaluates the AST.

**Key features:** Item references as a primitive type (`@name` resolves to a GUID), invisible async (all functions are async-transparent), atoms for persistent reactive state (`(def-atom name initial-value)`), macros, destructuring, and a structural editor (`field-view-hob-structural`) for keyboard-driven code editing.

**Where Hob is used:** Views (22 of ~46 converted), eval blocks in Active Text documents, search predicates in the item palette (e.g., `(type? "note")`).

**JS interop:** `(invoke obj "method" args...)` calls JS methods. `(require "lib-name")` loads libraries. `(def-js "name" js-code-string)` defines JS helpers. Hob functions are always async — they cannot be passed as synchronous callbacks to JS APIs.

**Detailed docs:** Hob Language (`c0c0c0c0-0054`), Hob Language Design Direction (`c0c0c0c0-0058`)
**Code:** `hob-interpreter` (`40b00001-0000-4000-8000-000000000000`), `field-view-hob-structural` (`50fe7334`)

## Workspace & Navigation

**Spatial canvas** is the primary workspace view. Items appear as draggable, resizable windows on a freeform 2D canvas. Supports anchoring, minimizing, z-ordering. Workspaces are container items typically rendered as spatial canvases.

**Navigation** is URL-based with full browser history. Each item has a permalink (`?item=GUID`). Navigate into a container to make it the root. Back/forward works. `Ctrl+K` opens the item palette for search. `Ctrl+Shift+N` creates a new item, `Ctrl+Shift+A` adds an existing item (in spatial canvas context).

**Item palette** supports free text search, structured filters (`type:note`, `tag:starred`, `name:kernel`), and Hob predicate expressions (`(type? "note")`, `(sort :modified)`).

**Context menus** (right-click) provide context-sensitive actions: change view, edit raw JSON, delete, navigate into, add children, manage tags, inspect source, etc.

**Sortable lists** provide an alternative ordered-list view for any container.

**Detailed docs:** Navigation (`c0c0c0c0-0003`), Context Menu (`c0c0c0c0-0034`), Viewport (`c0c0c0c0-0033`)
**Code:** `spatial-canvas-view` (`ef793c27`), `item-palette` (`f1111111-0005`), `context-menu-lib`, `keyboard-shortcuts` (`f1111111-0004`), `sortable-list-view` (`69253de7`)

## Development Tools

**REPL** (`Ctrl+\`) — Interactive JavaScript console with full kernel API access. Persistent history via REPL session items. Can query, create, and modify items live.

**System Browser** — Smalltalk-inspired multi-pane browser for exploring types, tags, views, and libraries. Jump to implementations, see type hierarchies.

**Symbol Browser** — Search and navigate exported symbols (functions, classes, constants) across all code items.

**Type Workshop** — Visual tool for creating and editing type definitions. Auto-generates paired views (editable + readonly) with field specifications.

**Element Inspector** — Click any UI element to see which item and view rendered it, the full render chain, and jump to source code. Activated via `?debug` URL parameter.

**Testing** — Built-in test runner with assertion library. Tests run inside nested instances for full isolation (isolated storage via ID prefixing, isolated DOM via iframe, automatic cleanup). 315 tests across 13 test suites covering the Hob interpreter, kernel modules, and rendering.

**Detailed docs:** REPL (`c0c0c0c0-0008`), Testing (`c0c0c0c0-0036`), Code Execution & Sandboxing (`c0c0c0c0-0028`)
**Code:** `test-lib` (`7e570001`), `test-suite` type (`7e570002`), `system-browser` (`3a36e7d0`), `symbol-browser` (`ac0ac0ac-0008`), `element-inspector` (`eeee0000-0000-0000-0000-000000000010`)

## Infrastructure

**Import/export** — JSON-based. Export produces one file per item or a single backup. Import uses topological sort for dependency ordering. Hot-reload on import: kernel modules trigger full page reload, styles replace in-place, views/libraries re-render affected instances.

**Safe mode** (`?safe=1` or `Ctrl+Shift+S`) — Boots kernel only, no user code. View, edit, delete, import/export items. Recovery escape hatch when userland code breaks.

**Error tracking** — Three-tier system: kernel emits error events → userland handler creates error items with parsed stack traces → fallback to REPL. Stack frames link to source code items.

**Theming** — oklch-based color system via CSS custom properties. Configurable hue, tint strength, font size. User CSS items can add custom styles. Hot-reloads on edit.

**Event system** — Hierarchical event bus with type-based dispatch. Core events: `item:created`, `item:updated`, `item:deleted`, `kernel:boot-complete`, `viewport:ready`. Sticky events for late subscribers. Declarative watches on items filter events by type/id.

**Nested instances** — Complete isolated Hobson environments via `?instance=<id>`. Storage isolation through ID prefixing in IndexedDB. DOM isolation via iframes. Used for testing and sandboxed experimentation. Cascade delete prevents orphaned data.

**App pages & widgets** — Grid-based pages for composing interactive UIs from widget items (buttons, sliders, radio groups). Support shared state (`pageContext`) for inter-widget communication. Used for the Theme Editor and nested instance creation tool.

**Code execution** — Code items evaluated as ES modules via `import()` with blob URLs. Strict mode. `require(name)` loads by name or GUID with caching and circular dependency detection.

**Detailed docs:** Import/Export (`c0c0c0c0-0027`), Error Handling (`c0c0c0c0-0023`), Nested Instances (`c0c0c0c0-0037`), App Pages and Widgets (`c0c0c0c0-0038`), URL Parameters (`c0c0c0c0-0031`)

## Implementation Patterns

These are recurring patterns in the codebase that you should understand before modifying code:

- **Silent update** (`c0c0c0c0-0010`) — `api.set()` saves without re-rendering (for drag/resize); `api.update()` saves and re-renders.
- **Stale closure prevention** (`c0c0c0c0-0011`) — Always `api.get()` fresh data in async handlers; closures capture render-time snapshots that go stale after silent updates.
- **Scroll state preservation** (`c0c0c0c0-0012`) — Save/restore scroll positions across re-renders. Less needed now that Hob views use morphdom.
- **Cycle-safe traversal** (`c0c0c0c0-0013`) — Cycles are valid data. Use visited-set pattern. `renderItem()` detects render-path cycles; `hasCycle()`/`wouldCreateCycle()` are advisory only.
- **Type chain validation** (`c0c0c0c0-0014`) — Type chains must terminate at `atom` or `TYPE_DEFINITION`. Validated on save.
- **Module cache invalidation** (`c0c0c0c0-0015`) — Modules cached by ID; `item:updated` events clear stale entries. Require where you use (not at render time) for hot-reload.
- **Common gotchas** (`c0c0c0c0-0016`) — `parseInt` zero trap, attachment format evolution (strings vs positioned objects), Hob atom re-render loops.

## Seed Item GUIDs

```
ITEM:                00000000-0000-0000-0000-000000000000
TYPE_DEFINITION:     11111111-0000-0000-0000-000000000000
CODE:                22222222-0000-0000-0000-000000000000
KERNEL_CORE:         33333333-1111-0000-0000-000000000000
KERNEL_STORAGE:      33333333-2222-0000-0000-000000000000
KERNEL_MODULE_SYS:   33333333-4444-0000-0000-000000000000
KERNEL_SAFE_MODE:    33333333-7777-0000-0000-000000000000
KERNEL_STYLES:       33333333-8888-0000-0000-000000000000
LIBRARY:             66666666-0000-0000-0000-000000000000
VIEW:                aaaaaaaa-0000-0000-0000-000000000000
DEFAULT_VIEW:        aaaaaaaa-1111-0000-0000-000000000000
EVENT_DEFINITION:    e0e00000-0000-0000-0000-000000000000
```
