# Type System Migration Plan: Separating Instantiation from Inheritance

**Date:** 2026-02-01
**Status:** Phase 1 & 2 Complete - Ready for Testing
**Depends on:** Type_System_Refinement_Separating_Instantiation_from_Inheritance.md

---

## Current State Analysis

### Current Type Hierarchy

```
kernel:item (00000000...)
  type: 00000000... (self-referential)
    │
    └── kernel:type-definition (11111111...)
          type: 00000000... (kernel:item)
            │
            ├── kernel:code (22222222...)
            │     type: 11111111... (type-definition)
            │       │
            │       ├── kernel:module (33333333...)
            │       │     type: 22222222... (code)
            │       │
            │       ├── kernel:view (aaaaaaaa...)
            │       │     type: 22222222... (code)
            │       │
            │       └── kernel:library (66666666...)
            │             type: 22222222... (code)
            │
            ├── kernel:viewport-type (77777777...)
            │     type: 11111111... (type-definition)
            │
            └── view-spec (bbbbbbbb...)
                  type: 11111111... (type-definition)
```

### The Conflation Problem

Items with `type: CODE` currently include BOTH:
1. **Type-definitions** extending CODE: `kernel:view`, `kernel:library`, `kernel:module`
2. **Instances** of CODE: `3rd Party Library Downloader`, actual code items

The system cannot distinguish between "X is a type that extends CODE" and "X is an instance of CODE" without inspecting content structure.

---

## Target State

### New Type Hierarchy

```
kernel:item (00000000...)
  type: TYPE_DEFINITION
  extends: null  ← root of extends chain
    │
    └── [extends]
          │
          ├── kernel:type-definition (11111111...)
          │     type: TYPE_DEFINITION (self-referential)
          │     extends: ITEM
          │
          ├── kernel:code (22222222...)
          │     type: TYPE_DEFINITION
          │     extends: ITEM
          │       │
          │       └── [extends]
          │             │
          │             ├── kernel:module (33333333...)
          │             │     type: TYPE_DEFINITION
          │             │     extends: CODE
          │             │
          │             ├── kernel:view (aaaaaaaa...)
          │             │     type: TYPE_DEFINITION
          │             │     extends: CODE
          │             │
          │             └── kernel:library (66666666...)
          │                   type: TYPE_DEFINITION
          │                   extends: CODE
          │
          ├── kernel:viewport-type (77777777...)
          │     type: TYPE_DEFINITION
          │     extends: ITEM
          │
          └── view-spec (bbbbbbbb...)
                type: TYPE_DEFINITION
                extends: ITEM
```

### Key Changes

| Item | Before | After |
|------|--------|-------|
| kernel:item | `type: self` | `type: TYPE_DEFINITION, extends: null` |
| kernel:type-definition | `type: ITEM` | `type: TYPE_DEFINITION, extends: ITEM` |
| kernel:code | `type: TYPE_DEFINITION` | `type: TYPE_DEFINITION, extends: ITEM` |
| kernel:module | `type: CODE` | `type: TYPE_DEFINITION, extends: CODE` |
| kernel:view | `type: CODE` | `type: TYPE_DEFINITION, extends: CODE` |
| kernel:library | `type: CODE` | `type: TYPE_DEFINITION, extends: CODE` |
| kernel:viewport-type | `type: TYPE_DEFINITION` | `type: TYPE_DEFINITION, extends: ITEM` |
| view-spec | `type: TYPE_DEFINITION` | `type: TYPE_DEFINITION, extends: ITEM` |

---

## Inventory: Items Requiring Migration

### Seed Type-Definitions (must migrate)

| GUID | Name | Current `type` | New `extends` |
|------|------|----------------|---------------|
| `00000000-0000-0000-0000-000000000000` | kernel:item | ITEM (self) | `null` |
| `11111111-0000-0000-0000-000000000000` | kernel:type-definition | ITEM | ITEM |
| `22222222-0000-0000-0000-000000000000` | kernel:code | TYPE_DEFINITION | ITEM |
| `33333333-0000-0000-0000-000000000000` | kernel:module | CODE | CODE |
| `66666666-0000-0000-0000-000000000000` | kernel:library | CODE | CODE |
| `77777777-0000-0000-0000-000000000000` | kernel:viewport-type | TYPE_DEFINITION | ITEM |
| `aaaaaaaa-0000-0000-0000-000000000000` | kernel:view | CODE | CODE |
| `bbbbbbbb-0000-0000-0000-000000000000` | view-spec | TYPE_DEFINITION | ITEM |

### User-Defined Type-Definitions (need `extends: ITEM`)

| GUID | Name | Notes |
|------|------|-------|
| `99999999-0000-0000-0000-000000000000` | hobson-instance | Nested instance type |
| `871ae771-b9b1-4f40-8c7f-d9038bfb69c3` | note | Core user content type |
| `7ac3cf17-2c10-454a-bc06-24db64e440c4` | item-search | UI type |
| `4f4b7331-874c-4814-90b7-c344e199d711` | script | REPL script type |
| `05e72011-d70e-4ff3-ac78-fe6b7fc5d884` | tag-browser | UI type |
| `d1da8525-b0dc-4a79-8bef-0cbed1ed003d` | tag | Classification type |
| `e7707000-0000-0000-0000-000000000001` | system:error | Error capture type |
| `e7707000-0000-0000-0000-000000000010` | system:error-list | Error list container |

### User-Defined Type-Definitions (need `extends: CODE`)

| GUID | Name | Notes |
|------|------|-------|
| `23b66a83-5c61-4320-9517-5aa2abad2d1f` | css | Has `required_fields: ["code"]`, needs code views |

### Non-Type Items (NO migration needed)

Items with `type: CODE` that are instances (not type-definitions):
- `ce370c3d-...` "3rd Party Library Downloader" — stays `type: CODE`
- `dafc22a5-...` (check - likely an instance)

---

## Migration Phases

### Phase 0: Preparation

1. **Export current state**
   ```bash
   # In Hobson REPL
   await api.dumpAll()
   ```

2. **Create backup branch**
   ```bash
   git checkout -b type-system-migration-backup
   git add -A && git commit -m "Backup before type system migration"
   git checkout master
   ```

3. **Verify all src/items/*.json are current**
   - Compare with live database
   - Update any stale exports

### Phase 1: Data Migration (JSON files)

**Order matters: migrate from leaves to root to avoid broken references during testing.**

#### Step 1.1: Migrate code-extending types

Edit these files to add `type: TYPE_DEFINITION` and `extends: CODE`:

- [ ] `src/items/33333333-0000-0000-0000-000000000000.json` (kernel:module)
- [ ] `src/items/66666666-0000-0000-0000-000000000000.json` (kernel:library)
- [ ] `src/items/aaaaaaaa-0000-0000-0000-000000000000.json` (kernel:view)

#### Step 1.2: Migrate item-extending types

Edit these files to add `extends: ITEM` (type stays TYPE_DEFINITION):

- [ ] `src/items/22222222-0000-0000-0000-000000000000.json` (kernel:code)
- [ ] `src/items/77777777-0000-0000-0000-000000000000.json` (kernel:viewport-type)
- [ ] `src/items/bbbbbbbb-0000-0000-0000-000000000000.json` (view-spec)
- [ ] All user-defined types with `type: TYPE_DEFINITION`

#### Step 1.3: Migrate bootstrap types

- [ ] `src/items/11111111-0000-0000-0000-000000000000.json` (kernel:type-definition)
  - Change `type` from ITEM to TYPE_DEFINITION (self-referential)
  - Add `extends: ITEM`

- [ ] `src/items/00000000-0000-0000-0000-000000000000.json` (kernel:item)
  - Change `type` from ITEM (self) to TYPE_DEFINITION
  - Add `extends: null`

### Phase 2: Kernel Code Changes

#### Step 2.1: Update IDS constant

File: `src/items/33333333-1111-0000-0000-000000000000.json` (kernel:core)

```javascript
// Before
ATOM: "00000000-0000-0000-0000-000000000000",

// After
ITEM: "00000000-0000-0000-0000-000000000000",
```

Also add alias for backwards compatibility during transition:
```javascript
ATOM: "00000000-0000-0000-0000-000000000000", // DEPRECATED: use ITEM
ITEM: "00000000-0000-0000-0000-000000000000",
```

#### Step 2.2: Add buildExtendsChain method

File: `src/items/33333333-4444-0000-0000-000000000000.json` (kernel:module-system)

```javascript
async buildExtendsChain(typeId) {
  const chain = [];
  let current = typeId;
  const visited = new Set();

  while (current && !visited.has(current)) {
    chain.push(current);
    visited.add(current);

    const typeItem = await this.kernel.storage.get(current);
    if (!typeItem || typeItem.extends === undefined) break;
    current = typeItem.extends;
  }

  return chain;
}
```

#### Step 2.3: Update typeChainIncludes for capability detection

File: `src/items/33333333-4444-0000-0000-000000000000.json` (kernel:module-system)

```javascript
// For checking if an INSTANCE has capability X
async instanceOf(item, targetTypeId) {
  const chain = await this.buildExtendsChain(item.type);
  return chain.includes(targetTypeId);
}

// Keep old method during transition, but have it use new logic
async typeChainIncludes(typeId, targetId) {
  const chain = await this.buildExtendsChain(typeId);
  return chain.includes(targetId);
}
```

#### Step 2.4: Update view discovery

File: `src/items/33333333-5555-0000-0000-000000000000.json` (kernel:rendering-system)

```javascript
async findView(item) {
  const IDS = this.kernel.IDS;

  // Get the item's type, then walk its extends chain
  const typeChain = await this.kernel.modules.buildExtendsChain(item.type);

  const allViews = await this.kernel.storage.query({ type: IDS.VIEW });

  for (const typeId of typeChain) {
    const view = allViews.find(v => v.content?.for_type === typeId);
    if (view) return view;
  }

  return await this.kernel.storage.get(IDS.DEFAULT_VIEW);
}
```

#### Step 2.5: Update storage validation (if any)

Check if storage validates type chains and update to handle `extends` field.

### Phase 3: Testing

#### Test Cases

1. **Type-definition item renders correctly**
   - Open kernel:module type-definition
   - Should show type-definition view, NOT code view
   - Verify: view has `for_type: TYPE_DEFINITION`

2. **Code instance renders correctly**
   - Open an instance of kernel:module (e.g., kernel:core)
   - Should show code view
   - Verify: walks extends chain MODULE → CODE → ITEM

3. **View discovery for custom types**
   - Create instance of user-defined type
   - Should find appropriate view via extends chain

4. **Capability detection**
   - `instanceOf(kernelCore, CODE)` should return true
   - `instanceOf(kernelCore, TYPE_DEFINITION)` should return false

5. **Safe mode boot**
   - Boot with `?safe=1`
   - Verify kernel loads correctly

### Phase 4: Cleanup

1. Remove `IDS.ATOM` alias after confirming no usage
2. Remove bounded type chain heuristic code
3. Update documentation

---

## Rollback Plan

If migration fails mid-way:

1. **Restore from git**
   ```bash
   git checkout type-system-migration-backup -- src/items/
   ```

2. **Clear IndexedDB and reimport**
   - Open DevTools → Application → IndexedDB
   - Delete Hobson database
   - Reload page (fresh boot from initial-kernel.json)

3. **Or use safe mode**
   - Load `?safe=1` to boot minimal kernel
   - Manually fix broken items via REPL

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| View discovery breaks | Medium | High | Test extensively before deploying |
| Capability detection breaks | Medium | High | Keep old method as fallback |
| IndexedDB migration fails | Low | Medium | Always have backup.json export |
| Self-referential bootstrap fails | Low | Critical | Test type-definition.type = type-definition carefully |
| User data loss | Low | Critical | Export all items before starting |

---

## Open Questions

1. **Should `extends: null` be explicit or implicit?**
   - Explicit: kernel:item has `extends: null`
   - Implicit: missing `extends` means root
   - Recommendation: Explicit for clarity

2. **Default `extends` for new user types?**
   - Option A: Require explicit `extends` on all type-definitions
   - Option B: Default to `extends: ITEM` if not specified
   - Recommendation: Option B (less friction, sensible default)

3. **Backwards compatibility period?**
   - How long to keep `IDS.ATOM` alias?
   - Should kernel code check both `type` chain and `extends` chain during transition?

---

## Success Criteria

- [ ] All type-definitions have `type: TYPE_DEFINITION`
- [ ] All type-definitions have appropriate `extends` value
- [ ] View discovery uses `extends` chain for instances
- [ ] Capability detection uses `extends` chain
- [ ] No heuristics needed for type chain boundaries
- [ ] All existing views still work
- [ ] Safe mode boots successfully
- [ ] No user data loss
