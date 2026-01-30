# Content Field Conventions - Future Considerations

**Date:** 2026-01-30
**Status:** Documentation for future consideration

---

## Current State

The kernel recognizes certain `content` fields with special semantics:

| Field | Used by | Purpose |
|-------|---------|---------|
| `content.code` | Module system, views | Executable JavaScript |
| `content.watches` | Event system | Declarative event subscriptions |
| `content.for_type` | Rendering system | View/renderer targeting |

This creates a de facto convention where `content` is not fully opaque to the kernel, despite the original design intention.

---

## Potential Future Pain Points

### 1. Proliferation of Kernel-Known Fields

**Scenario:** Each new capability adds another field the kernel must understand.

- Today: `code`, `watches`, `for_type`
- Tomorrow: `schema`, `permissions`, `hooks`, `migrations`, `validators`...

**Pain:** Every new field requires kernel code changes. The implicit convention list grows, becomes tribal knowledge.

### 2. User-Defined Types with Kernel Semantics

**Scenario:** Users want to create types with kernel-level behavior (e.g., a plugin system where custom types need validated fields).

**Pain:** No way to express "my type requires field X" without modifying kernel code. User-defined types are second-class citizens.

### 3. Validation

**Scenario:** Want to catch malformed items (e.g., "view missing for_type").

**Pain:** Validation rules must be hardcoded per type in the kernel. No declarative way to express type requirements.

### 4. Content Field Collisions

**Scenario:** User stores `for_type` in a non-view item for their own purposes. Later changes item's type to view.

**Pain:** Ambiguity - is `for_type` user data or the view's structural field? No namespace separation.

### 5. Querying at Scale

**Scenario:** Need to efficiently find "all views that render notes".

**Pain:** Requires scanning `content.for_type` across all items. If type-specific fields were in a predictable location, indexing would be cleaner.

### 6. Composition / Mixins

**Scenario:** Want "sortable container view" = container behavior + sortable behavior + view behavior.

**Pain:** Each mixin might have required fields. No way to express or validate composed type requirements.

### 7. Schema Evolution

**Scenario:** Views now require a `version` field that didn't exist before.

**Pain:** No migration system. Manual updates, no way to find items missing required fields.

---

## Potential Mitigations

### Option A: Type-Declared Schemas (Minimal Change)

Type definitions declare a `schema` field listing their required content fields:

```javascript
// type_definition for "view"
{
  id: "aaaaaaaa-0000-0000-0000-000000000000",
  name: "view",
  type: TYPE_DEFINITION,
  content: {
    schema: {
      required: ["for_type", "code"],
      properties: {
        for_type: { type: "guid", description: "Type this view renders" },
        code: { type: "string", description: "Render function code" }
      }
    }
  }
}
```

**Pros:** Content location stays the same. Schema is explicit and queryable. Kernel reads schema from type, validates accordingly.

**Cons:** Still mixing schema fields with user data in `content`. Collision risk remains.

### Option B: Separate Type Fields (Structural Change)

Move type-specific data to the `type` field:

```javascript
// Current
{
  type: "view-guid",
  content: { for_type: "note-guid", code: "..." }
}

// Proposed
{
  type: { id: "view-guid", for_type: "note-guid" },
  content: { code: "..." }
}
```

**Pros:** Clean separation. `type.*` is schema-defined, `content` is truly instance-specific. No collisions.

**Cons:** Breaking change requiring migration of all items and code.

**Open question:** Where does `code` go? It's required by type (all views have it) but varies per instance. Possibly:
- `type.*` = metadata about the typing relationship
- `content.*` = the payload/implementation

### Option C: Namespaced Content (Compromise)

Reserve a namespace in content for type-specific fields:

```javascript
{
  type: "view-guid",
  content: {
    _type: { for_type: "note-guid" },  // Reserved namespace
    code: "...",
    userField: "..."  // User data
  }
}
```

**Pros:** Less invasive than Option B. Clear separation within content.

**Cons:** Still requires migration. Awkward nesting.

### Option D: Status Quo + Documentation

Accept that certain content fields have kernel semantics. Document thoroughly.

**Pros:** No migration. System works today.

**Cons:** Technical debt accumulates. Pain points remain latent.

---

## Likely Trigger for Action

The most likely scenario that forces this decision:

> Adding a feature that requires a new kernel-understood content field, and realizing you're playing whack-a-mole updating kernel code to recognize content fields.

At that point, Option A (type-declared schemas) provides most of the benefit with minimal migration.

---

## Decision

**For now:** Status quo (Option D). The bounded type chain fix addressed the immediate semantic issue. Monitor for pain points listed above.

**If pain emerges:** Consider Option A first (type-declared schemas) as it's additive and non-breaking.

**If clean slate opportunity arises:** Consider Option B (structural change) for maximum clarity.
