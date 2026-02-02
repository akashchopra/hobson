# Documentation Transformation Plan

**Date:** 2026-02-02

## Vision

Transform Hobson's documentation from monolithic external files to an interconnected knowledge graph of items. Every distinct concept, entity, or idea becomes its own item with a rich description. Higher-level documents become aggregators that link to or transclude atomic pieces.

This aligns with Hobson's core philosophy: everything is an item.

---

## Current State

### What Exists

**External documentation (72 files in `/docs/`):**
- Comprehensive but disconnected from the running system
- Can't be linked to, transcluded, or discovered within Hobson

**Internal doc items (6 note items):**
- `doc-core-concepts`, `doc-architecture-overview`, etc.
- Better, but still monolithic - each covers multiple concepts in one document

**Description fields:**
- Most items have brief one-line descriptions
- Pattern established but underutilized

**Linking/transclusion capabilities (working):**
- `[name](item://id)` - navigation links
- `![name](item://id)` - full transclusion
- `![name](item://id#field)` - field transclusion
- `![name](item://id#code?region=name)` - named region transclusion
- `![name](item://id#code?lines=1-10)` - line range transclusion
- `` ```query `` blocks - dynamic content generation

### The Problem

The "Core Concepts" note covers Items, Types, Code as Data, Views all in one place. Each should be its own item. The overview should transclude/link to them.

---

## Phase 1: Atomic Concept Items

Create individual items for each fundamental concept. Use `concept:` prefix for pure documentation items that don't represent types or code.

### 1.1 Enhance Existing Type Definitions

These items already exist but need richer descriptions:

| Item | Current Description | Enhancement Needed |
|------|--------------------|--------------------|
| `kernel:item` (atom) | "Root of type hierarchy" | Full explanation of item structure, fields, examples |
| `type-definition` | "Defines a type of item" | Type chains, inheritance, creation examples |
| `code` | "Executable code..." | What makes code executable, module system, caching |
| `library` | - | Purpose, api.require(), examples |
| `kernel:view` | "Code that displays..." | View system overview, render function, API |
| `view-spec` | "Declarative specification..." | ui_hints, when to use vs imperative |
| `field-view` | - | Field-level components, creating custom ones |

### 1.2 Create New Concept Items

System-level concepts that aren't types:

| Item Name | Purpose |
|-----------|---------|
| `concept:kernel` | What the kernel is, its responsibilities, minimal design |
| `concept:bootstrap` | How the system boots, bootloader vs kernel, first run vs normal |
| `concept:navigation` | URL handling, viewport state, history, navigate() |
| `concept:transclusion` | How embedding works, syntax, partial vs full |
| `concept:children` | Parent-child relationships, composition, spatial positioning |
| `concept:event-system` | EventBus, declarative watches, event types |
| `concept:safe-mode` | Recovery, when to use, what's available |

### 1.3 Enhance Kernel Module Descriptions

Each kernel module item exists but descriptions are terse:

- `kernel:core` - Orchestration, boot sequence, item lifecycle
- `kernel:storage` - Validation, type chain checking, IndexedDB
- `kernel:viewport` - View state, root item, selection
- `kernel:module-system` - Code loading, caching, require()
- `kernel:rendering-system` - View dispatch, instance registry, re-render
- `kernel:repl` - Interactive scripting, API access
- `kernel:safe-mode` - Recovery interface
- `kernel:styles` - CSS injection, theming

---

## Phase 2: Aggregator Documents

Transform monolithic docs into aggregators that transclude atomic pieces.

### 2.1 Core Concepts (Rework)

Current: One large document explaining Items, Types, Code, Views inline.

New structure:
```markdown
# Core Concepts

Everything in Hobson is built from these fundamental concepts.

## Items
![](item://00000000-0000-0000-0000-000000000000#description)

## Types
![](item://11111111-0000-0000-0000-000000000000#description)

## Code
![](item://22222222-0000-0000-0000-000000000000#description)

## Views
![](item://aaaaaaaa-0000-0000-0000-000000000000#description)
```

Benefits:
- Overview auto-updates when concepts are refined
- Each concept is independently linkable
- No content duplication

### 2.2 Architecture Overview (Rework)

Use query blocks to dynamically list kernel modules:

```markdown
# Architecture Overview

## Kernel Modules

```query
const modules = await api.query(item =>
  item.type === api.IDS.KERNEL_MODULE
);
return transcludeEach(modules, m =>
  `### [${m.name}](item://${m.id})\n${m.content?.description || ''}`
);
```
```

### 2.3 Other Aggregators

- "Views & Rendering" → transclude view, view-spec, field-view descriptions
- "Events System" → transclude concept:event-system plus event type definitions
- "Getting Started" → transclude key concepts with beginner framing

---

## Phase 3: Backlinks

Enable discovery of "what links to this item?"

### 3.1 Backlinks Library

Create `backlinks-lib` (type: library):

```javascript
// Scan all items for item:// references
// Build and cache reverse index
// Return items that link to a given ID

export async function getBacklinks(itemId, api) {
  // Implementation: regex scan content.description and content.code
  // for item://itemId patterns
}

export async function rebuildIndex(api) {
  // Full scan, cache results
}
```

### 3.2 Backlinks Display

Options (decide during implementation):
- Field view component showing "Linked from:" section
- Add to generic view automatically
- Accessible via context menu "Show backlinks"

### 3.3 Performance Considerations

- Scan all items (per user preference)
- Cache results, invalidate on item:updated events
- Lazy rebuild on first access after invalidation

---

## Phase 4: Concept Index

A discoverable glossary of all documented concepts.

### 4.1 Index Container

Create `concept:index` (type: container or note):

```markdown
# Concept Index

All documented concepts in Hobson, auto-generated.

## Types

```query
const types = await api.query(item =>
  item.type === api.IDS.TYPE_DEFINITION
);
types.sort((a,b) => (a.name||'').localeCompare(b.name||''));
return transcludeEach(types, t =>
  `- **[${t.name}](item://${t.id})**: ${t.content?.description?.split('\n')[0] || 'No description'}`
);
```

## System Concepts

```query
const concepts = await api.query(item =>
  item.name?.startsWith('concept:')
);
concepts.sort((a,b) => a.name.localeCompare(b.name));
return transcludeEach(concepts, c =>
  `- **[${c.name}](item://${c.id})**: ${c.content?.description?.split('\n')[0] || 'No description'}`
);
```
```

### 4.2 Discovery Access

- Add to viewport's help menu
- Link from "Getting Started" documentation
- Keyboard shortcut? (defer)

---

## Phase 5: User Journey Support

### 5.1 Type Creation Guidance

When creating a new type, show contextual help:
- What the description field is for
- Examples from existing types
- Prompt: "Describe what items of this type represent"

### 5.2 Item Creation Guidance

When creating an item of a specific type:
- Show the type's description (what am I creating?)
- List required fields with explanations
- Show optional fields with purpose hints

Implementation: Enhance generic editor to fetch and display type documentation.

---

## Deferred Questions

### Relationships Beyond Children

**Question:** How to model explicit bidirectional relationships like "related-to", "depends-on", "example-of"?

**Current thinking:** Separate relationship items with source/target/type fields, rather than storing in either endpoint.

**Defer to:** Separate design discussion. Create `docs/Relationship_System_Design.md` when ready.

### In-Context Help

**Question:** Do we need a `content.help` property, or does `content.description` suffice?

**Current thinking:** Description should be sufficient if we make it rich enough. Help might be a rendered view of the description with additional context.

**Defer to:** Revisit after Phase 1 & 2 complete. Assess whether descriptions alone meet user needs.

---

## Implementation Order

1. **Phase 1.1** - Enhance existing type definitions (atom, type-definition, code, view, etc.)
2. **Phase 1.2** - Create concept: items for system concepts
3. **Phase 1.3** - Enhance kernel module descriptions
4. **Phase 2.1** - Rework Core Concepts as aggregator
5. **Phase 2.2** - Rework Architecture Overview as aggregator
6. **Phase 3** - Build backlinks library and display
7. **Phase 4** - Create concept index
8. **Phase 5** - User journey enhancements (type/item creation guidance)

---

## Success Criteria

- Every fundamental concept is its own item with comprehensive description
- Overview documents transclude atomic concepts (no duplication)
- Users can discover "what links to this?" for any item
- Concept index provides browsable glossary
- Creating new types/items shows relevant documentation

---

## Notes

- All documentation lives in items, not external files
- External `/docs/` files remain as developer reference but aren't the source of truth for users
- Naming convention: `concept:` prefix for pure documentation items
- Backlinks scan all items (comprehensive over performant)
