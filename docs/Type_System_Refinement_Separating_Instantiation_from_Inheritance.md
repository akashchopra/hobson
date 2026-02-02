# Type System Refinement: Separating Instantiation from Inheritance

**Date:** 2026-01-31
**Status:** Proposed

---

## Problem Statement

The current type system uses a single `type` field to express two different relationships:

1. **Instantiation**: "X is an instance of Y" (e.g., `my-note.type = note`)
2. **Subtyping**: "Type X inherits from Type Y" (e.g., `kernel-module.type = code`)

This conflation causes problems:

- When viewing the `kernel-module` type-definition item, the system walks its type chain (`code → type-definition → atom`) and finds `code-view`, even though `kernel-module` **is** a type-definition, not a code instance.
- The bounded type chain fix (stopping at TYPE_DEFINITION boundary) was a heuristic workaround, not a clean solution.
- The semantics are confusing: does `kernel-module.type = code` mean "kernel-module is code" or "instances of kernel-module are code"?

---

## The Solution

Separate the two relationships:

- **`type`** — "What is this item?" (instantiation)
- **`extends`** — "What does this type inherit from?" (subtyping, only valid on type-definitions)

---

## New Model

### Type Hierarchy

```
item (GUID: 00000000-..., type: TYPE_DEFINITION, extends: null)
   ↑ extends
type-definition (GUID: 11111111-..., type: TYPE_DEFINITION, extends: ITEM)
   ↑ extends  
code (GUID: 22222222-..., type: TYPE_DEFINITION, extends: ITEM)
   ↑ extends
kernel-module (GUID: 33333333-..., type: TYPE_DEFINITION, extends: CODE)
```

### Key Principles

1. **Every type-definition has `type: TYPE_DEFINITION`** — This answers "what is this item?" uniformly.
2. **The `extends` field captures inheritance** — Only meaningful on type-definitions.
3. **Instances never have `extends`** — They have `type`, which points to their type-definition.
4. **`item` is the root of the `extends` hierarchy** — Renamed from `atom` for clarity.
5. **`type-definition` is self-referential via `type`** — It is itself a type-definition.

---

## Concrete Examples

### Type-Definition Items

```javascript
// Root type (renamed from atom)
{
  id: "00000000-0000-0000-0000-000000000000",
  name: "item",
  type: "11111111-0000-0000-0000-000000000000",  // TYPE_DEFINITION
  extends: null                                   // Root of hierarchy
}

// Type of types
{
  id: "11111111-0000-0000-0000-000000000000",
  name: "type-definition",
  type: "11111111-0000-0000-0000-000000000000",  // Self-referential
  extends: "00000000-0000-0000-0000-000000000000" // Extends ITEM
}

// Code type
{
  id: "22222222-0000-0000-0000-000000000000",
  name: "code",
  type: "11111111-0000-0000-0000-000000000000",  // TYPE_DEFINITION
  extends: "00000000-0000-0000-0000-000000000000" // Extends ITEM
}

// Kernel-module type
{
  id: "33333333-0000-0000-0000-000000000000",
  name: "kernel-module",
  type: "11111111-0000-0000-0000-000000000000",  // TYPE_DEFINITION
  extends: "22222222-0000-0000-0000-000000000000" // Extends CODE
}

// View type
{
  id: "aaaaaaaa-0000-0000-0000-000000000000",
  name: "view",
  type: "11111111-0000-0000-0000-000000000000",  // TYPE_DEFINITION
  extends: "22222222-0000-0000-0000-000000000000" // Extends CODE
}
```

### Instance Items

```javascript
// An instance of kernel-module
{
  id: "33333333-1111-0000-0000-000000000000",
  name: "kernel-core",
  type: "33333333-0000-0000-0000-000000000000",  // KERNEL_MODULE
  // No 'extends' field — instances don't extend, they instantiate
  content: { code: "..." }
}

// An instance of note
{
  id: "...",
  name: "My Note",
  type: "note-type-id",
  content: { body: "Hello world" }
}
```

---

## View Discovery Changes

### Rendering a Type-Definition Item

When opening the `kernel-module` type-definition to view/edit it:

1. Get item: `kernel-module`
2. Walk `type` chain: `TYPE_DEFINITION → TYPE_DEFINITION` (self-referential, stops)
3. Find view with `for_type: TYPE_DEFINITION`
4. **Result:** Shows type-definition editor/viewer

### Rendering an Instance

When opening `kernel-core` (an instance of kernel-module):

1. Get item: `kernel-core`
2. Get item's type: `KERNEL_MODULE`
3. Walk `extends` chain of that type: `KERNEL_MODULE → CODE → ITEM`
4. Find first view matching any type in that chain
5. **Result:** Finds `code-view` (for_type: CODE)

### Updated Algorithm

```javascript
async findViewForItem(item) {
  const IDS = this.kernel.IDS;
  
  // Build the inheritance chain for the item's type
  const typeChain = await this.buildExtendsChain(item.type);
  
  // Find views matching any type in the chain
  const allViews = await this.kernel.storage.query({
    type: [IDS.VIEW, IDS.VIEW_SPEC]
  });
  
  for (const typeId of typeChain) {
    const matchingView = allViews.find(v => v.content?.for_type === typeId);
    if (matchingView) return matchingView;
  }
  
  return null; // Fall back to default view
}

async buildExtendsChain(typeId) {
  const chain = [];
  let current = typeId;
  const visited = new Set();
  
  while (current && !visited.has(current)) {
    chain.push(current);
    visited.add(current);
    
    const typeItem = await this.kernel.storage.get(current);
    current = typeItem.extends;  // Walk extends, not type
  }
  
  return chain;
}
```

---

## The Bounded Type Chain Fix Becomes Unnecessary

The original bounded type chain heuristic (stopping at TYPE_DEFINITION boundary) was solving a symptom, not the root cause. With this refinement:

- **Instances** have their capabilities determined by walking their type's `extends` chain
- **Type-definitions** are always rendered as type-definitions (via their `type: TYPE_DEFINITION`)

The two concerns are cleanly separated, and no heuristics are needed.

---

## Migration Plan

### Seed Item Changes

| Item | Current `type` | New `type` | New `extends` |
|------|----------------|------------|---------------|
| atom → **item** | ATOM | TYPE_DEFINITION | `null` |
| type-definition | ATOM | TYPE_DEFINITION | ITEM |
| code | TYPE_DEFINITION | TYPE_DEFINITION | ITEM |
| kernel-module | CODE | TYPE_DEFINITION | CODE |
| view | CODE | TYPE_DEFINITION | CODE |
| view-spec | CODE | TYPE_DEFINITION | CODE |
| field-view | CODE | TYPE_DEFINITION | CODE |
| library | CODE | TYPE_DEFINITION | CODE |
| viewport-type | TYPE_DEFINITION | TYPE_DEFINITION | ITEM |

### User-Defined Type Changes

All user-defined types (those with `type: TYPE_DEFINITION`) need no change to `type`, but may need `extends` added if they should inherit from something other than ITEM.

### GUID Preservation

- ATOM's GUID (`00000000-...`) is preserved; only the name changes to "item"
- All other GUIDs remain unchanged
- Rename `IDS.ATOM` to `IDS.ITEM` in code (same GUID value)

---

## Kernel Code Changes

### 1. kernel-rendering

Update view discovery to walk `extends` chain:

```javascript
// Before
async findView(typeId) {
  // Walks type field
}

// After  
async findViewForInstance(item) {
  // Gets item.type, then walks extends chain of that type
}
```

### 2. kernel-core

Update `typeChainIncludes` for capability detection:

```javascript
// Before: walked type field with boundary heuristic
// After: walks extends field, no heuristic needed

async instanceOf(item, targetTypeId) {
  const chain = await this.buildExtendsChain(item.type);
  return chain.includes(targetTypeId);
}
```

### 3. IDS constant rename

```javascript
// Before
IDS: {
  ATOM: '00000000-0000-0000-0000-000000000000',
  ...
}

// After
IDS: {
  ITEM: '00000000-0000-0000-0000-000000000000',
  ...
}
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Touches fundamental type system | Extensive testing before deployment |
| All type-definitions need migration | Write migration script; can be done atomically |
| Views registered `for_type: CODE` | Still work—semantics unchanged for instances |
| Existing code using `typeChainIncludes` | Update to use `extends` chain |
| Self-referential bootstrap | TYPE_DEFINITION.type = TYPE_DEFINITION is valid |

---

## Implementation Phases

### Phase 1: Kernel Changes (High Risk)
1. Add `buildExtendsChain` method
2. Update `findView` to use extends chain for instances
3. Update capability detection utilities
4. Rename ATOM → ITEM in IDS
5. Test extensively with current data (should still work as type chain walks still find things)

### Phase 2: Data Migration (Medium Risk)
1. Update seed items in initial-kernel.json
2. Write migration for existing databases
3. Update all type-definitions to have `type: TYPE_DEFINITION` and appropriate `extends`

### Phase 3: Documentation
1. Update System_Architecture.md
2. Update any views/tools that inspect the type system
3. Remove bounded type chain documentation (no longer needed)

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| `type` field means | Both instantiation and inheritance | Instantiation only |
| `extends` field | Does not exist | Inheritance (type-definitions only) |
| Root type | `atom` (self-referential) | `item` (type: TYPE_DEFINITION) |
| Self-referential anchor | `atom.type = atom` | `type-definition.type = type-definition` |
| View for type-definition item | Found via heuristic boundary | Found via `type: TYPE_DEFINITION` |
| View for instance | Walked mixed chain | Walks `extends` chain of item's type |
| Bounded chain heuristic | Required | Not needed |

This refinement makes the type system semantics explicit, removes the need for heuristics, and aligns with how most object-oriented systems distinguish instantiation from inheritance.
