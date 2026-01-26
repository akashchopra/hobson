# Type Chain Semantics Fix - Impact Assessment

**Date:** 2026-01-25
**Related:** [Type_Chain_Semantics_Fix.md](Type_Chain_Semantics_Fix.md)

---

## Affected Code Locations

### 1. Module System (kernel-module-system)
**File:** `src/items/33333333-4444-0000-0000-000000000000.json`

| Function | Current Behavior | Change Required |
|----------|-----------------|-----------------|
| `typeChainIncludes()` | Walks type chain for membership | Keep for delegation, deprecate for capability |
| `isCodeItem()` | Calls `typeChainIncludes(item.type, CODE)` | Replace with `item.content?.code` check |

### 2. Kernel Core
**File:** `src/items/33333333-1111-0000-0000-000000000000.json`

| Location | Current Usage | Change Required |
|----------|--------------|-----------------|
| `getEditors()` | `typeChainIncludes(item.type, IDS.EDITOR)` to find editors | Check `item.type === IDS.EDITOR` (direct) or `item.content?.is_editor` |
| `isCodeItem()` wrapper | Delegates to moduleSystem | Replace with content check |
| `evaluateWatchFilter()` | `watch.typeExtends` walks chain | Remove or replace with explicit type list |
| ~3 call sites | `isCodeItem(item)` checks | Update to new signature |

### 3. Rendering System (kernel-rendering)
**File:** `src/items/33333333-5555-0000-0000-000000000000.json`

| Function | Current Behavior | Change Required |
|----------|-----------------|-----------------|
| `findView()` | Walks type chain to find inherited views | **Keep as-is** - correct delegation pattern |
| `findRenderer()` | Similar chain walk for renderers | **Keep as-is** - correct delegation pattern |

### 4. User Code (viewport_view)
**File:** `src/items/bd74da77-a459-454a-b001-48685d4b536d.json`

| Usage | Current | Change Required |
|-------|---------|-----------------|
| `api.typeChainIncludes()` | Checks if item is container type | Evaluate: delegation or capability? |
| `api.getEditors()` | Relies on editor discovery | Will work after core fix |

---

## Migration Strategy

### Phase 1: Add Content-Based Capability Checks

Add new functions without removing old ones:

```javascript
// New capability checks (synchronous, no chain walk)
hasCode(item) {
  return typeof item.content?.code === 'string' &&
         item.content.code.trim().length > 0;
}

isDirectType(item, typeId) {
  return item.type === typeId;
}
```

### Phase 2: Update Call Sites

Replace capability detection calls:

```javascript
// Before
if (await kernel.isCodeItem(item)) { ... }

// After
if (kernel.hasCode(item)) { ... }
```

Update editor discovery:

```javascript
// Before
for (const item of allItems) {
  if (await this.moduleSystem.typeChainIncludes(item.type, IDS.EDITOR)) {
    allEditors.push(item);
  }
}

// After
const allEditors = allItems.filter(item => item.type === IDS.EDITOR);
```

### Phase 3: Deprecate Old Functions

- Mark `isCodeItem()` as deprecated
- Keep `typeChainIncludes()` available for delegation use cases
- Update documentation

---

## Risk Assessment

### Low Risk
- **Renderer/View lookup**: No change needed, already correct
- **Direct type checks**: Simple replacement, well-defined semantics

### Medium Risk
- **Editor discovery**: Currently finds editors whose type *inherits* from EDITOR. Changing to direct type match means subtypes of EDITOR won't be found unless we also walk the chain for *that* purpose (delegation to find applicable items)
- **Watch filters**: `typeExtends` feature would be removed; evaluate if anyone uses it

### Clarification Needed
- **Editor/Renderer subtypes**: Do we have items where `item.type = custom_editor` and `custom_editor.type = EDITOR`? If so, finding "all editors" is itself a delegation question, not just capability detection.

---

## Open Question: Editor Discovery Semantics

The current `getEditors()` finds all items whose type chain includes `EDITOR`. This conflates two questions:

1. **"Is this item an editor?"** → Capability (should use content or direct type)
2. **"What editors exist for this type?"** → Query (should search by `content.for_type`)

Proposed resolution: Editors are found by querying for items with `content.for_type` matching the target. The item's own type only matters for *how to render the editor itself*.

```javascript
// Simplified: just query by content
async getEditors(targetTypeId) {
  const allItems = await this.storage.getAll();
  return allItems.filter(item =>
    item.content?.for_type === targetTypeId &&
    typeof item.content?.code === 'string'
  );
}
```

This removes the type chain check entirely for editor discovery.

---

## Effort Estimate

| Component | Files | Complexity |
|-----------|-------|------------|
| Module system | 1 | Low - add new function |
| Kernel core | 1 | Medium - multiple call sites |
| User code audit | 1-2 | Low - verify usage patterns |
| Testing | - | Medium - behavior verification |

---

## Recommendation

**Proceed with implementation.** The semantic fix is sound and the migration is straightforward. The main decision point is editor discovery semantics - recommend the content-based query approach to fully decouple capability from type hierarchy.
