# Personal Information App
## Design Decisions Log

*Last Updated: 2026-01-13 (Documentation restructure)*

---

## Project Overview

A personal information management system combining:

- Image-based persistence (Smalltalk-inspired)
- Item-centric data model (Obenauer's itemized OS)
- Immediate, inspectable principles (Conway's Humane Dozen)
- Offline-first architecture
- Cross-platform (laptop + mobile)
- Self-extensible through code written within the system

---

## Core Design Principles

From Conway's Humane Dozen:

- **Immediate**: Every modification immediately seen in behavior
- **Inspectable**: All parts can be examined at any time
- **Modifiable**: Change work in midstream
- **Unified**: Source and runtime are the same
- **Always on**: No concept of starting or stopping

---

## Decisions Made

### 1. Data Model & Item Definition

**Decision: Radical Uniformity with Type Hierarchy**

All data is stored as items with this structure:

```
Item {
  id: String           // UUID or meaningful slug
  type: String         // ID of another item (or "atom" for base)
  created: Timestamp   // Immutable
  modified: Timestamp  // Updated on each change
  content: Map<String, Any>  // Arbitrary key-value data
}
```

**Key Principles:**

- **Everything is an item**: Notes, code, relationships, type definitions, renderers - all use the same structure
- **Type is a pointer**: The `type` field references another item that defines what this item is
- **Type chains to atom**: All type chains must eventually reach the self-referential `atom` item
- **No null types**: Every item must have an explicit type (enforces clarity)
- **Content is unconstrained**: The kernel doesn't enforce schemas on the content field
- **Kernel validates type chains**: Prevents circular type definitions and dangling references

**Relationships:**

- Relationships are modeled as distinct items (not embedded properties)
- Allows relationships to have their own metadata, lifecycle, and evolution
- Relationship types are also items, enabling custom relationship vocabularies
- Two kinds of linking:
  - **Inline references** (markdown links): Casual navigation, no metadata impact
  - **Explicit relationships**: First-class items with typed, bidirectional semantics

**Emergent Structure:**

- Start with inline links when dumping content
- Progressively reify important relationships as explicit relationship items
- Types and schemas emerge through usage rather than upfront design

**Tags as Universal Property:**

- Any item can have `content.tags` array (not type-specific)
- Tags are items (enabling metadata, hierarchy)
- Referenced by ID in the tags array
- See Section 13 and Tags_and_Classification.md for details

---

### 1.5. Item Identification and Naming

**Decision: GUID-Based IDs with Optional Human-Readable Names**

All items are identified by globally unique identifiers (GUIDs), with optional names for human readability.

**Item Identification:**

- **ID field**: Always a GUID (UUID format)
  - Provides stable, unique references across the system
  - Never needs to change once created
  - No collision concerns when importing/syncing

- **Name field**: Optional string for human readability
  - Not required for general items (notes, data, etc.)
  - **Required for code items** (libraries, renderers, etc.)
  - Used by `api.require()` to load code modules
  - Example: `await api.require('storage_api')`

**Special GUIDs for Seed Items:**

To aid debugging and comprehension, seed items use memorable GUIDs:

```
atom:              00000000-0000-0000-0000-000000000000
type_definition:   00000000-0000-0000-0000-000000000001
code:              00000000-0000-0000-0000-000000000002
renderer:          00000000-0000-0000-0000-000000000003
library:           00000000-0000-0000-0000-000000000004
default_renderer:  00000000-0000-0000-0000-000000000005
```

These are still valid GUIDs (no special-casing in kernel), just easy to recognize.

**Code Item Detection:**

Code items are identified by their type hierarchy, not by a specific field:

- Any item whose type chain includes the "code" type is a code item
- This makes the system extensible - users can create new code types
- Examples: `library`, `renderer`, custom `script` type, etc.
- All descend from the "code" seed item

**Name Uniqueness for Code Items:**

- The kernel **enforces unique names** for code items
- Validation happens on item save (fail fast)
- Prevents ambiguous `require()` calls
- User adopts namespacing convention for organization (e.g., `my_utils/format_date`)

**Reference Strategy:**

- All references in item content use GUIDs, never names
- Example relationship: `{from: "guid-123", to: "guid-456"}`
- Names are only used for code lookups via `require()`
- Editors provide lookup UI to hide GUIDs from users

**Updated Item Structure:**

```javascript
Item {
  id: String           // GUID (memorable for seed items)
  name?: String        // Optional, required for code items
  type: String         // GUID reference to type item
  created: Timestamp
  modified: Timestamp
  children: String[]   // Array of child item IDs (ordered)
  content: Map<String, Any>
}
```

**Rationale:**
- GUIDs eliminate naming burden for general items (thousands of notes)
- Required names for code items enable readable `require()` calls
- Type-based code detection allows user-defined code types
- Reference-by-GUID ensures data integrity
- Special GUIDs for seeds aid debugging without special-casing
- **Children array is standard property**: All items can contain other items, enabling hierarchical composition
- Children ordering is significant (array order) but containers may use additional sorting

---

### 2. Kernel Architecture & Execution Model

**Decision: Always-On Browser-Based Runtime**

The system is a continuously running web application that embodies the "always on" principle from the Humane Dozen.

**Execution Model:**

- **Always-on image**: The app runs continuously (like Smalltalk) - no "restart"
- **UI is code items**: The interface itself is composed of items that execute
- **Immediate feedback**: Modifying a code item changes running behavior instantly
- **REPL capability**: Can write and execute ad-hoc scripts for one-off tasks
- **Event loop**: Kernel checks for scheduled tasks and recurring operations

**Kernel Responsibilities:**

The kernel provides the minimal runtime environment:

1. **Storage Layer**: 
   - CRUD operations on items
   - Type chain validation (ensures chains reach "atom", no cycles)
   - Indexing for query performance
   - Persistence (likely IndexedDB for browser storage)
   
   **Validation Strategy:**
   - Type chain validation, name uniqueness, and required fields are checked on write (in `set()`)
   - Operations fail fast with descriptive errors
   - No lazy validation
   
   **Query Capabilities:**
   - Initial implementation: simple matching on top-level fields (id, name, type, created, modified)
   - Content field queries: use `getAll()` + user code filtering
   - Can be enhanced with indexes later without API changes

2. **Execution Environment**:
   - Execute code stored in items
   - Provide safe API to user code (query, render)
   - Isolate user code from kernel internals
   - Handle errors without crashing the system

3. **Rendering System**:
   - Look up renderer items for given types
   - Walk type chain to find most specific renderer
   - Execute renderer code and display results
   - Fall back to default renderer (JSON view)

4. **Minimal UI**:
   - Item list with search
   - Item editor (plain text/JSON)
   - Navigation between items
   - Eventually replaced by UI items created within system

**Safe Mode**: Hold Shift while loading to boot with minimal kernel UI only, no user code items loaded (for fixing broken systems).

**Bootstrap Process:**

1. Manually insert `atom` item into storage
2. Kernel creates seed items on first run
3. Seed items provide type system and renderer infrastructure
4. Build everything else from within the running system

---

### 3. Technology Stack

**Decision: Browser-Based with JavaScript**

**Runtime Platform:**
- Browser-based for cross-platform compatibility
- **Laptop**: Full browser (Chrome/Firefox) or Electron wrapper
- **Phone**: Mobile browser (Safari/Chrome) or WebView wrapper
- Single codebase for both platforms

**Language:**
- **Primary**: JavaScript (runs natively in browser)
- **Future**: Extensible to support other languages via interpreter items
  - Could add Lisp/Scheme interpreter as items within the system
  - Language support becomes a feature you build, not a kernel requirement

**Storage:**
- IndexedDB for browser persistence
- Allows offline-first operation
- Suitable for storing items as JSON

**UI Framework:**
- Minimal: Use basic DOM manipulation or lightweight virtual DOM
- Later: Can be replaced by UI component items within the system
- Initial UI is intentionally minimal/ugly - will be rebuilt from within

**Code Editing:**
- Plain textarea initially (consistent with minimal kernel)
- Later: Can integrate Monaco/CodeMirror as items

**Rationale:**
- Browser provides universal runtime
- JavaScript is well-known and sufficient for initial implementation
- Can progressively enhance with better languages/tools from within
- Web technologies enable true "write once, run anywhere"

---

### 4. Seed Items

**Decision: Minimal Bootstrap Set with Type Hierarchy**

The system ships with these pre-created items on first boot:

```javascript
{
  id: "00000000-0000-0000-0000-000000000000",
  name: "atom",
  type: "00000000-0000-0000-0000-000000000000",  // self-referential
  created: <boot_timestamp>,
  modified: <boot_timestamp>,
  children: [],  // Standard property for all items
  content: {
    description: "The fundamental unit. Everything is an atom or derives from atom."
  }
}

{
  id: "00000000-0000-0000-0000-000000000001",
  name: "type_definition",
  type: "00000000-0000-0000-0000-000000000000",  // atom
  created: <boot_timestamp>,
  modified: <boot_timestamp>,
  children: [],
  content: {
    description: "Defines a type of item"
  }
}

{
  id: "00000000-0000-0000-0000-000000000002",
  name: "code",
  type: "00000000-0000-0000-0000-000000000001",  // type_definition
  created: <boot_timestamp>,
  modified: <boot_timestamp>,
  children: [],
  content: {
    description: "Executable code. Items with this in their type chain are code items.",
    required_fields: ["code"]
  }
}

{
  id: "00000000-0000-0000-0000-000000000003",
  name: "renderer",
  type: "00000000-0000-0000-0000-000000000002",  // code
  created: <boot_timestamp>,
  modified: <boot_timestamp>,
  children: [],
  content: {
    description: "Code that renders an item type",
    required_fields: ["for_type", "code"]
  }
}

{
  id: "00000000-0000-0000-0000-000000000004",
  name: "library",
  type: "00000000-0000-0000-0000-000000000002",  // code
  created: <boot_timestamp>,
  modified: <boot_timestamp>,
  children: [],
  content: {
    description: "Reusable code module",
    required_fields: ["code"]
  }
}

{
  id: "00000000-0000-0000-0000-000000000005",
  name: "default_renderer",
  type: "00000000-0000-0000-0000-000000000003",  // renderer
  created: <boot_timestamp>,
  modified: <boot_timestamp>,
  children: [],
  content: {
    for_type: "00000000-0000-0000-0000-000000000000",  // atom
    code: `
      export function render(item, api) {
        return api.createElement('pre', {}, [
          JSON.stringify(item, null, 2)
        ]);
      }
    `
  }
}

{
  id: "00000000-0000-0000-0000-000000000006",
  name: "workspace",
  type: "00000000-0000-0000-0000-000000000000",  // atom
  created: <boot_timestamp>,
  modified: <boot_timestamp>,
  children: [],
  content: {
    title: "Workspace",
    description: "Default starting point. Add items here or navigate elsewhere."
  }
}
```

**Type Hierarchy:**

```
atom (all items inherit from this)
  +-- type_definition (types themselves are items)
  |     +-- code (parent of all executable code)
  |           +-- renderer (displays items)
  |           +-- library (reusable modules)
  +-- container (items that contain other items)
  |     +-- workspace (default root)
```

**Seed Item Summary:**

| GUID | Name | Purpose |
|------|------|---------|
| 00000000-...-000000 | atom | Self-referential base type |
| 00000000-...-000001 | type_definition | Defines types |
| 00000000-...-000002 | code | Parent of executable items |
| 00000000-...-000003 | renderer | Code that renders items |
| 00000000-...-000004 | library | Reusable code modules |
| 00000000-...-000005 | default_renderer | Fallback JSON renderer |
| 00000000-...-000006 | workspace | Default root item |
| 00000000-...-000007 | container | Type for items that contain other items |
| 00000000-...-000008 | container_renderer | Renders container items with child management |

**Rationale:**
- Minimal set needed to bootstrap type system, code execution, and rendering
- "code" type enables extensibility - users can create new code types
- Special GUIDs (00000000-...) make seed items easy to recognize
- Everything else can be built from within the running system
- Workspace provides sensible default root for first boot
- Week 1 goal: Replace default renderer for common types (notes, code, etc.)

---

### 5. Renderer System

**Decision: Type-Chain-Based Rendering with Nested Components**

**How Rendering Works:**

1. When displaying an item, look for a renderer where `for_type` matches item's type
2. If not found, walk up the type chain to find a more general renderer
3. Fall back to `default_renderer` (JSON display) if no specific renderer exists
4. Execute the renderer code to generate UI

**Renderer API:**

Renderers receive two parameters:
- `item`: The item being rendered
- `api`: Object with methods to:
  - `h(tag, props, children)`: Create UI elements (like React.createElement)
  - `query(filter)`: Query other items
  - NO create/update/delete (those operations happen elsewhere)

**Nested Renderers:**

UI can be composed of multiple renderer levels:
- Application shell renderer
- Item list renderer
- Individual item renderers
- Field/component renderers

Each level can be customized independently by creating appropriate renderer items.

**Code Isolation:**
- Renderers run in sandboxed context
- Cannot crash the system
- Errors display in place of broken renderer

---

### 6. Code Execution & Invalidation

**Decision: Lazy Invalidation with Timestamp Checking + Async Module Loading**

**Module Loading:**

Code items are evaluated as ES modules using dynamic `import()`. The `require` API is asynchronous to support future enhancements (lazy loading, external imports, etc.):

```javascript
// Usage in code items:
const module = await api.require("findRelatedItems");
const items = module.findRelatedItems(item);  // function itself is sync
```

**Cache Invalidation Strategy:**

Code items are cached after evaluation. Cache invalidation uses lazy checking:
- Each cached module stores the timestamp when it was evaluated
- On each `require()` call, compare cached timestamp with item's `modified` timestamp
- If item was modified since caching, re-evaluate and update cache
- No explicit dependency graph needed - correctness guaranteed by timestamp checks

**Implementation Pattern:**

```javascript
async require(itemId) {
  const cached = this.moduleCache.get(itemId);
  const item = await this.storage.get(itemId);
  
  // Check if cache is stale
  if (cached && cached.timestamp >= item.modified) {
    return cached.module;
  }
  
  // Re-evaluate if stale or not cached
  const module = await this.evaluateCodeItem(item);
  this.moduleCache.set(itemId, {
    module,
    timestamp: item.modified
  });
  return module;
}
```

**Re-rendering on Modification:**

When a code item is modified:
- Clear its cache entry (or rely on timestamp check)
- Re-render the current view to show new behavior
- Simple approach for MVP: re-render entire main view
- Can optimize later with smarter dependency tracking if needed

**Error Handling:**

- Renderers receive **read-only API** (no create/update/delete operations)
- Side-effecting code is explicit (action handlers, import scripts)
- Errors display in place of broken content with error details
- No automatic reversion - user fixes the code forward
- System remains stable even when user code has errors

**Circular Dependencies:**

- Circular dependencies across items are **not allowed**
- Detection via call stack tracking during `require()`
- Throws clear error message showing the circular chain
- Mutually recursive functions must be in the same code item

**Rationale:**
- Simple to implement (no dependency graph needed)
- Automatically correct (checks on every access)
- Fast enough for personal use (cache lookups are cheap)
- Async `require` provides future flexibility without blocking queries/rendering
- Can add smarter invalidation later if profiling shows it's needed
- Read-only renderer API prevents accidental side effects

---

### 7. Code Sandboxing & Safety

**Decision: ES Module Imports with Strict Mode**

Code items are evaluated as native ES modules using dynamic `import()`. This provides baseline isolation:

**Evaluation Approach:**

```javascript
async evaluateCodeItem(item) {
  const code = `
    "use strict";
    ${item.content.code}
  `;
  
  const url = URL.createObjectURL(
    new Blob([code], { type: "application/javascript" })
  );
  
  return await import(url);
}
```

**Safety Properties:**

- **Module scope**: Code runs in its own scope, not global scope
- **Strict mode**: Catches common JavaScript errors and prevents unsafe operations
- **Export validation**: Kernel can validate that modules export expected functions
- **Error boundaries**: Errors in user code are caught and displayed, don't crash kernel

**Known Limitations:**

- Code can still access global objects (`window`, `document`, `localStorage`) if it chooses to
- This is **acceptable for a personal system** where you write all code yourself
- Not defending against malicious code, but against accidental errors
- Provides reasonable protection without massive complexity

**Future Enhancements:**

If accidental breakage becomes a problem:
- Add Web Worker execution (true isolation, but adds async complexity)
- Use SES (Secure ECMAScript) polyfill for frozen realms
- Add more aggressive global object freezing
- Implement import restrictions via import maps

**Safe Mode:**

Hold Shift while loading to boot with minimal kernel UI only:
- No user code items are loaded or executed
- Provides recovery path if code items break the system
- Kernel and storage remain accessible for fixes

**Rationale:**
- ES modules provide good-enough isolation for personal use
- Strict mode catches most accidental errors
- Keeps implementation simple without Web Worker complexity
- Can tighten sandboxing later if needed
- Focus is on making accidents unlikely, not perfect security

---

### 7.5. External Libraries

**Decision: Libraries as Code Items**

Third-party JavaScript libraries are stored as code items within the system, making them available offline and accessible via the standard `api.require()` mechanism.

**Why This Approach:**

The kernel uses dynamic `import()` with blob URLs, which means there's no module resolution system. User code cannot do:
```javascript
import moment from 'moment';  // Won't work - no CDN, no node_modules
```

Instead, library source code is stored directly in the system as items.

**Usage Pattern:**

```javascript
// In your renderer or library code
export async function render(item, api) {
  const moment = await api.require('moment');
  const formatted = moment(item.content.date).format('MMMM Do YYYY');
  // ...
}
```

**Installation Process (MVP - Manual):**

1. Download the library's ES module or UMD bundle source
2. Create a code item with type `library` and appropriate name
3. Paste the source into `content.code`
4. Wrap if necessary to provide proper exports

```javascript
// Example: Installing moment.js as a code item
{
  id: "<generated-guid>",
  name: "moment",
  type: "00000000-0000-0000-0000-000000000004",  // library
  content: {
    code: `
      // If UMD format, wrap to export:
      const moment = (function() {
        // ... entire moment.js source ...
      })();
      
      export default moment;
    `
  }
}
```

**Future Enhancement - Automated Installation:**

Build an `installLibrary` REPL function that:
- Fetches source from CDN (when online)
- Detects format (ES module, UMD, CommonJS)
- Wraps appropriately
- Creates the code item automatically

```javascript
await api.installLibrary({
  name: 'moment',
  url: 'https://cdn.jsdelivr.net/npm/moment@2.29.4/dist/moment.min.js',
  format: 'umd'
});
```

**Tradeoffs:**

*Pros:*
- Fully offline - library source is just data in the system
- Version pinned - you know exactly what version you have
- Inspectable - can examine or modify library code if needed
- Consistent - same `require()` pattern for all code

*Cons:*
- Manual process initially
- Large libraries increase storage size (acceptable for IndexedDB)
- Some libraries may need wrapper adjustments for exports
- Updates are manual until install tooling is built

**Rationale:**
- Maintains offline-first principle
- No special kernel support needed - uses existing code item infrastructure
- Aligns with "everything is an item" philosophy
- Installation tooling can be built within the system itself

---

### 8. Bootstrap and System Management

**Decision: Self-Healing Bootstrap with Manual Export/Import**

**Bootstrap Strategy:**

The system automatically ensures seed items exist on every boot:
- Check for each seed item by ID
- Recreate any missing seed items in dependency order
- Do not overwrite existing seed items (preserves user modifications)
- Self-healing: system recovers from deleted seed items

**First Run Detection:**
- Check if `atom` (00000000-0000-0000-0000-000000000000) exists
- If absent, create all seed items
- No separate "first run" flag needed

**Seed Item Modification:**
- Users can modify seed items (they're just items)
- Bootstrap does not overwrite existing seed items
- If seed items are broken, Safe Mode provides recovery path
- Consistent with "everything is inspectable and modifiable" principle

**Export/Import:**
- Export: Download all items as JSON file
- Import: Merge items (skip items with duplicate IDs)
- Available as REPL functions, not automatic
- Export includes everything (seed items and user data)

**System Reset:**
- Clear all data and recreate seed items
- Available in Safe Mode with confirmation
- Nuclear option for recovery from broken state

**Rationale:**
- Self-healing prevents system breakage from accidental deletions
- Dependency-ordered creation avoids validation errors
- Manual export/import gives user control over data
- Seed items are part of system infrastructure, should always exist
- But users can modify them for experimentation/customization

---

### 9. Containers and Hierarchical Rendering

**Decision: Containers Are Items That Render Other Items**

There is no special "container" concept in the kernel. A container is simply an item whose renderer happens to render other items as part of its UI.

**Key Principles:**

- **No special container type**: Containers are items with renderers that call `api.renderItem()` on children
- **Hierarchical composition**: Containers can contain other containers, forming arbitrarily deep trees
- **Graph structure**: Items can have multiple parents (appear in multiple containers)
- **Explicit tree structure**: The `children` array defines parent-child relationships
- **DAG enforcement**: Cycles are prevented through validation on `addChild()`

**Parent-Child Relationships:**

```javascript
// A kanban board container
{
  id: "kanban-board-123",
  type: "kanban_board",
  children: ["column-1", "column-2", "column-3"],  // Explicit child list
  content: {
    title: "Project Tasks"
  }
}

// A column container (child of the board)
{
  id: "column-1",
  type: "kanban_column",
  children: ["task-1", "task-2"],  // Its own children
  content: {
    title: "Todo"
  }
}
```

**Multiple Parents (Graph Structure):**

Items can appear in multiple containers simultaneously:
- Task item appears in both "Project Kanban" and "Personal Todo List"
- Note appears in both "Meeting Notes" folder and "Client X" project
- Code snippet appears in both "Utilities" library and "Documentation" example

**Cycle Prevention:**

When adding a child, the kernel validates that no cycle would be created:
```javascript
// Prevent: A ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ B ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ C ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ A
await api.addChild(childId);
// Throws error if childId's descendants include the current item
```

**Container Renderer Pattern:**

```javascript
// Example container renderer
export function render(container, api) {
  const childItems = container.children || [];
  
  return api.createElement('div', {class: 'container'}, [
    api.createElement('h1', {}, [container.content.title]),
    api.createElement('div', {class: 'children'}, 
      // Recursively render each child
      childItems.map(childId => api.renderItem(childId))
    )
  ]);
}
```

**Renderer Decides Navigation:**

When a container includes a link to another item, the renderer decides the behavior:
- Navigate to new root (change URL, full-screen the linked item)
- Open in place (modal, sidebar panel within current container)
- Open in adjacent panel (Obenauer's browsing paths pattern)

The kernel provides navigation helpers but doesn't enforce a particular pattern.

**Rationale:**
- Consistency: Containers use the same item structure as everything else
- Flexibility: Any renderer can become a container by rendering children
- Emergent complexity: Complex UIs emerge from simple composition rules
- Graph structure enables flexible organization (items in multiple contexts)
- Cycle prevention maintains graph integrity without over-constraining

---

### 10. Lifecycle Hooks and Reactivity

**Decision: Automatic Subscriptions with Optional Lifecycle Hooks**

When a renderer renders an item, it automatically subscribes to changes in that item's children. The kernel manages this subscription and calls optional lifecycle hooks when children change.

**Lifecycle Hook Exports:**

Renderers can optionally export these hooks:

```javascript
// Optional: Called when a direct child item is modified
export function onChildChanged(childItem, api) {
  // Update local state, recalculate aggregates, etc.
  // Parent automatically re-renders after this hook completes
}

// Optional: Called when a direct child item is deleted
export function onChildDeleted(childId, api) {
  // Clean up references, show notification, etc.
  // Parent automatically re-renders after this hook completes
}
```

**Automatic Subscriptions:**

- When rendering an item, kernel subscribes it to all items in its `children` array
- When a child changes, kernel calls the parent's lifecycle hook (if defined)
- After lifecycle hook completes, kernel automatically re-renders the parent
- Only **direct parents** are notified, not grandparents or ancestors

**Notification Scope:**

```javascript
// Hierarchy:
// Workspace
// ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ Kanban Board
//     ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ Todo Column
//         ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ Task #123

// If Task #123 changes:
// - Todo Column's onChildChanged is called ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“
// - Kanban Board is NOT notified (not a direct parent)
// - Workspace is NOT notified (not a direct parent)
```

**Multiple Parent Notifications:**

When an item appears in multiple containers (graph structure):
```javascript
// Task #123 appears in:
// - Project Kanban (via Todo Column)
// - Personal Todo List
// - Recent Items Widget

// If Task #123 changes, ALL direct parents get notified:
// 1. Todo Column.onChildChanged(task, api)
// 2. Personal Todo List.onChildChanged(task, api)  
// 3. Recent Items Widget.onChildChanged(task, api)
```

**Deletion Notifications:**

Deletion is separate from child removal:
```javascript
// Remove from parent (item still exists elsewhere)
await api.removeChild(childId);

// Delete entirely (notifies ALL parents across the system)
await api.delete(childId);
// ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ Finds all items where children.includes(childId)
// ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ Calls onChildDeleted on each parent
// ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ Parents can decide how to handle (show tombstone, remove silently, etc.)
```

**Re-render Triggers:**

- Lifecycle hooks trigger automatic re-renders of the parent
- No explicit `api.rerender()` call needed
- Simpler mental model: hooks are for reacting, re-rendering is automatic
- Can optimize later with selective re-rendering if performance requires

**Rationale:**
- Automatic subscriptions eliminate boilerplate subscription management
- Direct-parent-only notifications prevent cascading re-renders
- Optional hooks maintain simplicity (not all renderers need them)
- Automatic re-renders after hooks match reactive framework patterns
- Separate delete/removeChild operations give fine-grained control
- Multiple parent notifications essential for graph structure consistency

---

### 11. Navigation and URL Management

**Decision: URL-Based Root with Renderer-Controlled Navigation**

The root item being displayed is specified via URL query parameter, enabling bookmarking and browser history integration.

**URL Format:**

```
app.html?root=<item-id>
app.html                    // Uses default root
app.html?root=my-dashboard
app.html?root=kanban-board-123
```

**Boot Sequence:**

```javascript
async boot() {
  await this.storage.initialize();
  await this.ensureSeedItems();
  
  if (this.isSafeMode()) {
    this.renderMinimalUI();
    return;
  }
  
  // Get root from URL parameter
  const params = new URLSearchParams(window.location.search);
  const rootId = params.get('root') || '00000000-0000-0000-0000-000000000006';  // workspace
  
  await this.renderItem(rootId);
}
```

**Navigation Helper:**

The kernel provides a helper for programmatic navigation:

```javascript
async navigateToItem(itemId) {
  // Update URL (adds to browser history)
  const url = new URL(window.location);
  url.searchParams.set('root', itemId);
  window.history.pushState({ itemId }, '', url);
  
  // Render new root
  await this.renderItem(itemId);
}

// Browser back/forward support
window.addEventListener('popstate', async (event) => {
  const params = new URLSearchParams(window.location.search);
  const rootId = params.get('root') || '00000000-0000-0000-0000-000000000006';  // workspace
  await this.renderItem(rootId);
});
```

**Renderer-Controlled Behavior:**

Containers decide how links to other items behave:

```javascript
// Option 1: Navigate (change root, full-screen item)
function renderLink(itemId, text) {
  return api.createElement('a', {
    href: `?root=${itemId}`,
    onclick: (e) => {
      e.preventDefault();
      kernel.navigateToItem(itemId);
    }
  }, [text]);
}

// Option 2: Open in modal/panel (stay in current root)
function renderLink(itemId, text) {
  return api.createElement('button', {
    onclick: () => this.openItemInPanel(itemId)
  }, [text]);
}

// Option 3: Open in adjacent panel (browsing path pattern)
function renderLink(itemId, text) {
  return api.createElement('button', {
    onclick: () => this.addToBrowsingPath(itemId)
  }, [text]);
}
```

**Configurable Default Root:**

Users can bookmark different starting points:
- Personal dashboard: `app.html?root=my-dashboard`
- Work projects: `app.html?root=work-kanban`
- Default (system workspace): `app.html`

**Rationale:**
- URL-based root enables bookmarking and sharing
- Browser history support enables back/forward navigation
- Renderer control maintains flexibility (no one-size-fits-all navigation)
- Simple implementation with standard web APIs
- Supports multiple workflow patterns (full-screen vs. panels vs. browsing paths)

---

### 12. 2D Canvas Windowing System

**Decision: Spatial Browsing with Positioned Windows**

Containers render their children as draggable, positioned windows on a 2D canvas rather than in a linear list or grid.

**Core Design:**

- Container = Desktop/Canvas (2D space for arranging windows)
- Children = Windows (positioned rectangles containing items)
- Recursive composition: Containers within containers work naturally
- Position data stored in parent's children array (not in child itself)

**Data Model Evolution:**

Children changed from simple ID array to positioned objects:

```javascript
// Before
children: ["item-1", "item-2"]

// After
children: [
  {id: "item-1", x: 20, y: 20, width: 400, height: 300, z: 0, minimized: false},
  {id: "item-2", x: 50, y: 50, width: 400, height: 300, z: 1, minimized: false}
]
```

**Backward Compatibility:**

- Renderer checks `typeof child === 'string'`
- Old string format treated as x=0, y=0, z=0, default size
- Silent updates convert strings to objects on first interaction

**Window Management:**

- **24px titlebar**: Shows item title, entire bar is draggable
- **Drag to move**: Mousedown on titlebar â†’ drag â†’ mouseup saves position
- **Click to front**: Click anywhere on window brings it to top z-index
- **Absolute positioning**: CSS `position: absolute` with explicit left/top/z-index

**Silent Updates Pattern:**

Critical pattern to avoid re-render during interaction:

```javascript
// Normal update - triggers re-render
await api.update(item);

// Silent update - saves without re-render
await api.updateSilent(item);
```

Used for:
- Position updates during drag
- Z-index updates when bringing to front
- Any change that shouldn't destroy DOM state (scroll, focus, etc.)

**Scroll State Preservation:**

When re-renders are necessary (adding/removing windows):

```javascript
// Before re-render: Save scroll positions keyed by item ID
const scrollStates = new Map();
windows.forEach(wrapper => {
  const itemId = wrapper.getAttribute('data-item-id');
  const content = wrapper.querySelector('.window-content');
  scrollStates.set(itemId, {scrollTop: content.scrollTop, ...});
});

// After re-render: Restore scroll positions
setTimeout(() => {
  newWindows.forEach(wrapper => {
    const itemId = wrapper.getAttribute('data-item-id');
    const saved = scrollStates.get(itemId);
    if (saved) {
      wrapper.querySelector('.window-content').scrollTop = saved.scrollTop;
    }
  });
}, 0);
```

**Stale Closure Prevention:**

Major source of bugs: Event handlers capturing stale data at render time.

**Problem:**
```javascript
const children = item.children;  // Snapshot

const updateChild = (id, updates) => {
  children.map(...);  // Uses stale snapshot!
};

titlebar.onmousedown = () => {
  const maxZ = Math.max(...children.map(c => c.z));  // Stale!
};
```

**Solution:** Always read fresh data from database:
```javascript
const updateChild = async (id, updates) => {
  const fresh = await api.get(item.id);  // Current state
  fresh.children.map(...);
};
```

**Link Navigation:**

Markdown links in notes open as sibling windows:

```javascript
link.onclick = (e) => {
  e.preventDefault();
  api.openSibling(itemId);  // Opens in current workspace
};
```

Not:
```javascript
api.navigate(itemId);  // Would destroy entire workspace
```

**Default Positioning:**

New children positioned diagonally:
```javascript
const numChildren = parent.children.length;
const offset = numChildren * 30;
const newChild = {
  x: 20 + offset,
  y: 20 + offset,
  width: 400,
  height: 300,
  z: numChildren
};
```

**Rationale:**
- Spatial organization matches mental models (physical desktop)
- Multiple items visible simultaneously (context preservation)
- No navigation hierarchy to remember (everything's in view)
- Drag-and-drop is direct manipulation (Humane Dozen principles)
- Recursive containers enable arbitrarily deep organization
- Silent updates maintain interaction fluidity (no jarring re-renders)

**Trade-offs:**
- More complex than linear lists (worth it for spatial flexibility)
- Requires position persistence (but enables persistent layouts)
- Need scroll preservation (but enables natural multitasking)
- Mobile may need different interaction model (defer until tested)

---

### 13. Tags as Universal Property

**Decision: All Items Can Be Tagged**

Tags are a universal classification system - any item type can have `content.tags` array referencing tag items.

**Key Points:**

- **Tags are items**: Each tag is an item with metadata (name, color, hierarchy)
- **Referenced in arrays**: Items store `content.tags: [tag-id-1, tag-id-2]`
- **Not relationship items**: Tags are classification metadata, not semantic relationships
- **Universal application**: Works for notes, code items, containers, any type
- **No harder to implement**: Same effort as type-specific tags

**Rationale:**

Tags as items (not strings):
- Enables tag rename without updating all tagged items
- Allows tag metadata (colors, descriptions, hierarchy)
- Supports rich tag queries and displays

Universal (not note-specific):
- Consistent with "everything is an item" philosophy
- Prevents forcing architectural limits on user organization
- Different users will use tags differently (some on notes only, others everywhere)
- Cross-cutting queries ("show me all urgent items") become possible

Not relationship items:
- "Note A is tagged with Work" - the "is tagged with" doesn't add meaning
- "Note A follows on from Note B" - the "follows on from" carries semantic value
- Therefore: tags as references, relationships as items

**For full design details, see Tags_and_Classification.md**

---

### 14. Editors as Separate Items & Multiple Renderers

**Decision: Editors Are Separate from Renderers, Multiple of Each Allowed**

Editors and renderers are parallel systems, both supporting multiple items per type.

**Core Design:**

**Renderers:**
- Display items (read-only or editable)
- Multiple renderers per type (e.g., `note_full`, `note_compact`, `note_card`)
- Lookup by type, walk type chain for inheritance
- Fallback to default JSON renderer

**Editors:**
- Edit items (separate from display)
- Can be declarative specs (UI hints) or imperative code
- Multiple editors per type (e.g., `note_simple_editor`, `note_advanced_editor`)
- Generic editor interprets specs, custom code for complex cases
- Fallback to structured JSON editor (always works)

**Why Separate:**

Extensibility:
- Add new view without modifying existing renderer (multiple renderers)
- Add new editing experience without changing display (separate editors)
- Users can create alternatives without breaking existing code

Flexibility:
- Renderer can be editable (unified view/edit)
- Or renderer displays, editor edits (separated view/edit)
- Or both patterns coexist (hybrid)

Consistency:
- Renderers are already separate items
- Making editors separate provides parallel structure

**Edit/View Transition:**

Renderers provide "Edit" button:
```javascript
onclick: async () => {
  await api.editItem(item.id);  // Uses default editor
  // Or: await api.editItem(item.id, editorId);  // Specific editor
}
```

**Generic Editor:**

Progressive disclosure system:
- **Level 0**: Raw JSON (always works)
- **Level 1**: Structured fields (each property separate)
- **Level 2**: Typed field editors (markdown, tag_selector, etc via plugins)
- **Level 3**: Custom editor code (full control when needed)

**For full design details, see Rendering_and_Editing.md**

---

### 15. Emergency REPL Loading

**Decision: Kernel Loads REPL Directly on Error, Falls Back to Dev Tools**

The REPL is a userland library (`repl-ui`) that normally activates via the `system:boot-complete` event. However, if errors occur before or during that process, the kernel attempts to load the REPL directly as a recovery mechanism.

**Problem Statement:**

The REPL moved from kernel to userland for consistency ("everything is an item"). But this creates a recovery problem:

1. Normal boot: viewport renders → `system:boot-complete` fires → `repl-ui` activates
2. If viewport rendering breaks before boot-complete, the REPL never appears
3. User has no way to inspect/fix the problem without safe mode (nuclear option)

**Solution: Emergency REPL Loading**

When the kernel's error capture system receives an error and no handlers respond:

```javascript
async captureError(error, context = {}) {
  // Emit system:error event for userland handlers
  this.events.emit({
    type: EVENT_IDS.SYSTEM_ERROR,
    content: { error, context }
  });

  // If no handlers responded (REPL not visible), try loading it directly
  try {
    const replLib = await this.moduleSystem.require('repl-ui');
    if (replLib.showEmergency) {
      replLib.showEmergency(error, context);
    }
  } catch (replError) {
    // REPL itself is broken - user can use browser dev tools
    console.error('Emergency REPL failed to load:', replError);
    console.error('Original error:', error, context);
  }
}
```

**Failure Modes:**

| Scenario | Recovery Path |
|----------|---------------|
| Viewport rendering breaks | Kernel catches error → loads repl-ui directly → user debugs |
| repl-ui library is broken | Kernel logs to console → user opens browser dev tools |
| Storage is corrupted | Nothing works → safe mode or fresh import |

**Design Principles:**

- **REPL stays an item**: Editable, versionable, consistent with "everything is an item"
- **No duplicate implementations**: Single repl-ui library, kernel just has a privileged path to load it
- **Graceful degradation**: Emergency REPL → dev tools console → safe mode
- **Skip kernel fallback UI**: Dev tools console is sufficient for the rare case where repl-ui itself is broken

**What This Enables:**

- `repl-ui` can export both normal activation (`onSystemBootComplete`) and emergency activation (`showEmergency`)
- Emergency mode might skip non-essential features (history persistence, syntax highlighting) for reliability
- Kernel makes no assumptions about REPL implementation - just calls `require()` and a known export

**Future Consideration:**

A keyboard shortcut (e.g., Ctrl+Shift+R) could force-load the REPL bypassing normal boot. Deferred until we see if it's actually needed - the error-triggered path may be sufficient.

**Rationale:**
- Maintains item-centric architecture (REPL is still a library item)
- Provides practical recovery without safe mode's nuclear approach
- Dev tools console is always available as ultimate fallback
- No kernel UI code to maintain for edge cases

---

### 16. Module-Level State and Hot-Reload

**Status: OPEN PROBLEM**

Libraries that cache state at module level (e.g., `let api = null`) break when the module is hot-reloaded. This section documents the problem and known patterns.

**The Problem:**

The module system uses timestamp-based cache invalidation:
```javascript
// In ModuleSystem.require()
if (cached && cached.timestamp >= item.modified) {
  return cached.module;  // Return cached module
}
// Otherwise re-evaluate the code
```

When a code item is modified:
1. Module cache detects stale timestamp
2. Code is re-evaluated via `import()` of a new blob URL
3. This creates a **fresh module namespace** with all module-level variables reset
4. But `onSystemBootComplete` doesn't fire again (boot already happened)
5. Result: Module-level state (like `api`) is null, functionality breaks

**Example of Problematic Pattern:**

```javascript
// item-palette library (PROBLEMATIC)
let api = null;  // Module-level state

export async function onSystemBootComplete({ safeMode }, _api) {
  if (safeMode) return;
  api = _api;  // Set during boot
}

export async function show() {
  if (!api) {
    console.warn('item-palette: not initialized');
    return;  // Silently fails after hot-reload!
  }
  // ... uses api
}
```

**Current Workaround Pattern (viewport-manager):**

```javascript
let popstateHandlerRegistered = false;

export async function onSystemBootComplete({ safeMode }, _api) {
  if (!popstateHandlerRegistered) {
    window.addEventListener('popstate', handlePopstate);
    popstateHandlerRegistered = true;
  }
}

// Uses window.kernel directly instead of cached api
const viewport = await window.kernel.storage.get(VIEWPORT_ID);
await window.kernel.renderViewport();
```

**Problems with Current Workaround:**

1. **Flag doesn't survive re-evaluation**: If module is re-evaluated, `popstateHandlerRegistered` resets to `false`, but the old listener is still attached → duplicate handlers
2. **No cleanup mechanism**: Can't remove old handler before adding new one
3. **Still requires `onSystemBootComplete`**: Maintains dependency on boot event machinery

**Proposed Clean Pattern:**

For API access - don't cache, use window.kernel directly:
```javascript
export async function show() {
  const api = window.kernel.createREPLAPI();
  // ... use api
}
```

For event listeners - use window-level references for cleanup:
```javascript
// Remove old handler if exists (from previous module evaluation)
if (window._myModuleHandler) {
  window.removeEventListener('popstate', window._myModuleHandler);
}
window._myModuleHandler = handlePopstate;
window.addEventListener('popstate', window._myModuleHandler);
```

**Open Questions:**

1. Should we formalize a `window.kernel` API contract for userland code?
2. Should the kernel call cleanup hooks before re-evaluating modules?
3. Should `onSystemBootComplete` be called on hot-reload (with a flag)?
4. How to handle multiple instances of event listeners cleanly?
5. Should we introduce a module lifecycle API (`onLoad`, `onUnload`)?

**Affected Libraries:**

Libraries currently using the problematic pattern (caching api at module level):
- `item-palette` - Cmd+K item search
- `keyboard-shortcuts` - Global keyboard shortcuts
- `repl-ui` - REPL interface
- `help-dialog` - Help modal
- `viewport-manager` - Navigation state (partially migrated)

**Symptoms of This Bug:**

- Feature works after fresh page load
- Feature stops working after editing any code item
- Browser refresh fixes it
- Console may show "not initialized" warnings

---

## Decisions Deferred

### Offline-First & Sync

**Status:** Deferred until single-device functionality works

**Questions to address later:**
- Sync strategy between laptop and phone
- Conflict resolution approach
- What syncs to mobile vs stays on laptop
- Sync timing (continuous, periodic, manual)

**Current thinking:**
- Mobile may be "subset" experience due to resource constraints
- Need conflict resolution strategy before implementing sync

---

### Extensibility Model

**Status:** Partially decided

**Decisions made:**
- Target user: Developer (me) initially
- Extension via code items (textual, JavaScript)
- Immediate feedback through always-on execution

**Questions remaining:**
- Should visual/dataflow programming be added?
- How to make "self-revealing" interfaces for code?
- Structure of code editor within the system?

---

### Cross-Platform Strategy

**Status:** Partially decided

**Decisions made:**
- Same app on both platforms (not separate companion app)
- Browser-based for maximum compatibility

**Questions remaining:**
- How to handle different UI paradigms (keyboard vs touch)?
- Feature parity vs platform-appropriate design?
- Could mobile actually be primary interface?
- How aggressive should mobile subset be?

---

### First Use Case / MVP

**Decision: Note-Taking as Primary Use Case**

Start with basic note-taking functionality:
- Create notes with markdown content
- Link between notes (inline markdown links initially)
- Search/filter notes
- Custom renderer for notes (better than JSON)

Then progressively add:
- Explicit relationship items
- Code execution within notes
- Query system
- More sophisticated UI

**Rationale:** Notes are simple enough to implement quickly but rich enough to exercise the core system.

---

## Reference Systems

Systems examined for insights:

- **TiddlyWiki**: Self-contained, extensible, offline-first
- **Emacs/Org-mode**: Ultimate self-modifying environment
- **Notion**: Databases + notes (but cloud-dependent)
- **Jupyter**: Code + data + narrative
- **Glamorous Toolkit**: Moldable development (Pharo Smalltalk)
- **Obsidian**: Local-first notes with graph view

---

## Change Log

| Date | Decision / Change |
|------|-------------------|
| 2026-01-09 | Initial document created with key decision areas identified |
| 2026-01-09 | Session 1: Made decisions on data model, kernel architecture, tech stack, seed items, renderer system |
| 2026-01-09 | Session 2: Made decisions on code execution model (async require, lazy invalidation), sandboxing (ES modules with strict mode), circular dependency handling, error handling, and explicitly decided against version control |
| 2026-01-09 | Session 3: Made decisions on item identification (GUIDs with optional names), name uniqueness enforcement for code items, code item detection via type hierarchy, special GUIDs for seed items, and updated seed item structure to include "code" type |
| 2026-01-10 | Session 4: Made decisions on storage API signatures (method contracts, validation strategy, query capabilities), bootstrap behavior (self-healing seed items, export/import strategy, system reset), and seed item creation order |
| 2026-01-10 | Session 5: Made decisions on containers (items that render children), graph structure (DAG with multiple parents), lifecycle hooks (onChildChanged, onChildDeleted), automatic subscriptions and reactivity, navigation (URL-based root), unified view/edit model, delete vs removeChild operations, and cycle prevention |
| 2026-01-10 | Session 6: Added external libraries as code items (section 7.5), added workspace seed item as default root (GUID ...000006), ready for implementation |
| 2026-01-10 | Session 7: Implemented container type and renderer - two-step child creation flow (click to create, click to edit), container manages child addition via createChild API, workspace is now type container, validates hierarchical composition |
| 2026-01-12 | Session 8: Implemented 2D canvas windowing system with spatial browsing - positioned children (x,y,width,height,z), draggable windows, click-to-front, silent updates for DOM preservation, scroll state restoration, stale closure prevention, openSibling API for link navigation |
| 2026-01-13 | Documentation restructure: Created subsystem docs (Rendering_and_Editing.md, Tags_and_Classification.md, Spatial_Windowing.md, Future_Directions.md). Added sections 13 (Tags as Universal Property) and 14 (Editors as Separate Items & Multiple Renderers). Decided tags apply to all items, editors separate from renderers, multiple of each per type. |
| 2026-02-03 | Added section 15 (Emergency REPL Loading). Kernel loads repl-ui directly on error when normal boot-complete activation didn't happen. Falls back to dev tools console if repl-ui itself is broken. No kernel fallback UI needed. |
| 2026-02-03 | Added section 16 (Module-Level State and Hot-Reload). Documented the open problem where libraries caching `api` at module level break after hot-reload. Proposed clean pattern: use `window.kernel` directly, use window-level references for event listener cleanup. |

---

## Open Questions for Next Session

### Answered in Session 5

1. ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ **Event system**: Decided - Automatic subscriptions with lifecycle hooks, direct-parent-only notifications
2. ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ **Nested renderer composition**: Decided - Containers are items that render children, recursive composition via `api.renderItem()`
3. ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ **Context-specific APIs**: Decided - Single unified API with scoped write access (descendants only)
4. ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ **Navigation between items**: Decided - URL-based root with renderer-controlled behavior
5. ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ **View vs Edit modes**: Decided - Unified view/edit, renderers decide interaction model
6. ✅ **Multiple renderers per type**: Decided - Supported, single default renderer for MVP, selection mechanism deferred (see Section 14, Rendering_and_Editing.md)
7. ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ **Hierarchical containers**: Decided - Graph structure (DAG) with explicit children array
8. ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ **Delete semantics**: Decided - Separate `removeChild()` and `delete()` operations
9. ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ **Cycle prevention**: Decided - Validate on `addChild()` to prevent cycles

### Still Open

1. **Hot-reload and module lifecycle**: How should libraries handle state across hot-reloads? (See Section 16)
   - Formalize `window.kernel` API contract?
   - Add module lifecycle hooks (`onLoad`, `onUnload`)?
   - Call `onSystemBootComplete` on hot-reload with a flag?
   - Standard pattern for event listener cleanup?

2. **Code item organization conventions**: What patterns for structuring code across multiple items?
   - One large item vs many small items?
   - Namespacing conventions beyond just names?
   - How to handle related functions (keep together or split)?

2. **Initial UI/UX**: What does the minimal kernel UI actually look like?
   - Item list view implementation?
   - Navigation between items?
   - Editing interface?
   - Testing new renderers workflow?

3. **Type chain utilities**: Helper functions for working with type chains?
   - `isOfType(item, typeId)` - check if item or ancestor matches type
   - `getTypeChain(item)` - return full chain as array
   - Caching strategy for type chain lookups?

4. **Performance optimizations**: Strategies for large hierarchies?
   - Lazy rendering (only visible portions)
   - Virtual scrolling for long lists
   - Renderer result caching
   - When to implement these?
