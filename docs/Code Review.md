Architectural Code Review: Hobson

  Executive Summary

  Hobson demonstrates a solid foundation for an item-centric, self-modifying system. The core design principles (everything-is-an-item, type hierarchy, live code) are well-executed. However, there are several architectural concerns around API consistency, coupling, and potential scalability issues that should be addressed as the system matures.

  ---
  1. Core Architecture Strengths

  1.1 Clean Type System

  The type hierarchy with atom as the self-referential root is elegant:
  atom ← type_definition ← code ← renderer/library
  The typeChainIncludes() method correctly walks the chain to determine item capabilities. The cycle detection in _validateTypeChain() is well-implemented.

  1.2 Module Loading System

  The require() method (hobson.html:1609) with cache freshness checking is well-designed:
  - Resolves by name or ID
  - Circular dependency detection
  - Cache invalidation based on modified timestamp
  - Dynamic ES module loading via Blob URLs

  1.3 Validation Layer

  Good defensive programming in ItemStorage._validateItem():
  - Type chain validation prevents orphaned types
  - Code item name uniqueness enforcement
  - Prevents circular type references

  ---
  2. Architectural Concerns

  2.1 CRITICAL: Inconsistent API Between Contexts

  There are two different API surfaces with confusingly different method names:
  ┌─────────────┬───────────────┬────────────────────────┐
  │  Operation  │   REPL API    │      Renderer API      │
  ├─────────────┼───────────────┼────────────────────────┤
  │ Save item   │ api.set(item) │ api.update(item)       │
  ├─────────────┼───────────────┼────────────────────────┤
  │ Re-render   │ N/A (manual)  │ Automatic on update    │
  ├─────────────┼───────────────┼────────────────────────┤
  │ Silent save │ N/A           │ api.updateSilent(item) │
  └─────────────┴───────────────┴────────────────────────┘
  Impact: This inconsistency caused your scripts to fail. Code items written for one context won't work in the other.

  Recommendation: Unify the APIs. Either:
  - Make REPL API match renderer API (add update that triggers re-render)
  - Make renderer API have explicit set vs update semantics
  - Document the differences prominently

  2.2 Tight Coupling: window.kernel Leakage

  Several code items directly access window.kernel:

  script_renderer.js:55-56:
  const replApi = window.kernel.createREPLAPI();
  // and
  window.kernel.editItemRaw(item.id);

  note_renderer.js:
  const recent = window.kernel.getRecentItems();

  Problem: This bypasses the designed API boundary, creating implicit dependencies that:
  - Make testing difficult
  - Create fragile coupling
  - Violate the principle that renderers should only use the provided api

  Recommendation: Expose needed functionality through the renderer API:
  api.getRecentItems()  // Add to renderer API
  api.editRaw(itemId)   // Add to renderer API
  api.createREPLContext()  // For script execution

  2.3 Query Performance: O(n) Scanning

  ItemStorage.query() (hobson.html:1056-1064) does full table scan:
  async query(filter) {
    const all = await this.getAll();
    return all.filter(item => { ... });
  }

  IndexedDB has an index on type but it's never used. All queries fetch everything.

  Impact: As item count grows, every api.query({ type: X }) becomes slower.

  Recommendation: Leverage the existing index:
  async queryByType(typeId) {
    return new Promise((resolve, reject) => {
      const index = store.index("type");
      const request = index.getAll(typeId);
      // ...
    });
  }

  2.4 Child Format Inconsistency

  Children can be either strings or position objects:
  children: ["item-id"]  // Old format
  children: [{ id: "item-id", x: 20, y: 20, ... }]  // New format

  This forces defensive code throughout (hobson.html:1712-1714, 1759-1761, 1786-1789):
  const childId = typeof c === 'string' ? c : c.id;

  Recommendation: Migrate all children to the object format with a one-time migration script, then simplify the code.

  ---
  3. Renderer Code Items Review

  3.1 note_renderer (~450 lines)

  Strengths:
  - Well-structured with clear separation of concerns
  - Tag picker with proper state management (pendingTags, isPickerOpen)
  - Markdown rendering via loaded library

  Concerns:
  - Massive single function - should be decomposed
  - Tag logic is duplicated from tag_browser_renderer
  - State management is ad-hoc (closures over mutable variables)

  Suggestion: Extract tag picking into a shared library:
  const tagPicker = await api.require('tag_picker_lib');
  tagPicker.render(container, { onSelect, onRemove, currentTags });

  3.2 tag_browser_renderer (~200 lines)

  Strengths:
  - Clean tree-building logic
  - Proper parent/child hierarchy handling

  Concerns:
  - Tree building duplicated in note_renderer
  - No lazy loading for large tag sets

  3.3 note_search_renderer (~180 lines)

  Strengths:
  - Debounced search (300ms)
  - Persists query in item content

  Concerns:
  - Full-text search via string scanning is O(items × content_length)
  - No indexing strategy

  Suggestion: For scale, consider a search index item that's rebuilt on item changes.

  3.4 code_renderer

  Concern: Uses api.update() which triggers re-render, but then also does manual navigation:
  await api.update(updated);
  await api.navigate(api.IDS.WORKSPACE);
  setTimeout(() => api.navigate(currentRoot), 50);

  The double-navigation suggests confusion about what update does. The 50ms setTimeout is a race condition waiting to happen.

  ---
  4. Missing Architectural Pieces

  4.1 No Event System

  When an item changes, there's no way for other interested parties to know. The current approach is full re-render via renderRoot().

  Impact:
  - Can't build reactive components
  - Inefficient updates (full DOM rebuild)

  Recommendation: Add an event bus:
  kernel.on('item:updated', (item) => { ... });
  kernel.on('item:deleted', (id) => { ... });

  4.2 No Undo/Versioning

  Items are overwritten without history. The deletion audit trail in localStorage is a start, but there's no way to:
  - Undo a change
  - See item history
  - Roll back to a previous version

  4.3 No Schema Validation for Content

  Type definitions declare required_fields but this is never enforced:
  content: {
    required_fields: ["code"]  // Declared but not checked
  }

  ---
  5. Security Considerations

  5.1 Code Execution Surface

  evaluateCodeItem() uses dynamic import via Blob URL:
  const blob = new Blob([code], { type: "application/javascript" });
  const module = await import(url);

  This is intentional for the system's design, but:
  - Any item with executable code can access the full DOM
  - No sandboxing between code items
  - A malicious code item could exfiltrate data

  For a personal system this is acceptable, but document the trust model.

  5.2 Renderer API Has Write Access

  Renderers can call api.update(), api.delete(), api.create(). This means a renderer can modify or delete any item in the system.

  Consideration: Should renderers be read-only with explicit mutation endpoints?

  ---
  6. Summary of Recommendations

  High Priority

  1. Unify REPL and Renderer APIs - Critical for code reuse
  2. Eliminate window.kernel access - Add missing methods to API instead
  3. Migrate children to consistent format - Reduce defensive code

  Medium Priority

  4. Extract shared code - Tag picker logic, tree building
  5. Use IndexedDB indexes - For type queries at minimum
  6. Add event system - Foundation for reactive updates

  Lower Priority (Future)

  7. Add undo/versioning - Important for a live-editable system
  8. Enforce schema - Validate required_fields
  9. Consider search indexing - As content grows

  ---
  7. Verdict

  The architecture is sound for its purpose: a personal, Smalltalk-inspired live system. The core concepts (everything-is-an-item, type hierarchy, renderers) are well-executed. The main issues are around API consistency and some code duplication, which are straightforward to address.

  The system successfully achieves its goal of being self-modifying - you can edit renderers and immediately see changes, which is impressive for a browser-based system.
