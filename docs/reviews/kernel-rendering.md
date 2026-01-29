# Review: kernel-rendering

**Item ID:** `33333333-5555-0000-0000-000000000000`
**Type:** kernel-module

---

## Responsibilities

1. Manage render instance registry (track what's rendered where)
2. Execute views with API context
3. Resolve views via preference hierarchy (item → type → chain)
4. Provide partial re-render capability
5. Create renderer API for views

---

## Code Review

### Strengths

- **Render Instance Registry:** Clean implementation with proper indexing and cleanup
- **Preference hierarchy:** Well-designed: item.preferredView → type.preferredView → type chain
- **Cycle detection:** Prevents infinite loops in nested rendering
- **Comprehensive API:** Rich renderer API with CRUD, navigation, helpers

### Issues Found

**HIGH PRIORITY:**

1. **Lines 295-310, 345-360:** View resolution queries are inefficient:
   ```javascript
   async findView(typeId) {
     while (currentType && !visited.has(currentType)) {
       // PROBLEM: Queries ALL views for each type in the chain
       const views = await this.kernel.storage.query({ type: IDS.VIEW });
       const view = views.find(v => v.content?.for_type === currentType);
       // ... same for VIEW_SPEC
     }
   }
   ```

   **Impact:** For a 5-level type chain, this performs 10+ storage queries.

   **Fix:** Query once, filter locally:
   ```javascript
   async findView(typeId) {
     const allViews = await this.kernel.storage.query({ type: IDS.VIEW });
     const allViewSpecs = await this.kernel.storage.query({ type: IDS.VIEW_SPEC });

     let currentType = typeId;
     while (currentType && !visited.has(currentType)) {
       const view = allViews.find(v => v.content?.for_type === currentType);
       if (view) return view;
       const viewSpec = allViewSpecs.find(v => v.content?.for_type === currentType);
       if (viewSpec) return viewSpec;
       // ... continue up chain
     }
   }
   ```

### Minor Observations

1. **Lines 425-450:** `createRendererAPI` is ~300 lines. Consider extracting to separate file for readability.

2. **Line 245:** `resolveView` catches and logs when preferred view not found, then falls through. Good defensive coding.

3. **Registry cleanup:** `rerenderItem` properly unregisters nested instances before replacement. Good memory management.

---

## API Surface

### RenderInstanceRegistry

| Method | Description |
|--------|-------------|
| `register(domNode, itemId, viewId, parentId)` | Track render instance |
| `unregister(instanceId)` | Remove tracking |
| `unregisterByParent(parentId)` | Cleanup children |
| `clear()` | Full reset |
| `getByItemId(itemId)` | Find instances |
| `getSummary()` | Debug stats |

### RenderingSystem

| Method | Description |
|--------|-------------|
| `renderItem(itemId, viewId, options, context)` | Main render |
| `rerenderItem(itemId)` | Partial update |
| `rerenderByView(viewId)` | Update all using view |
| `resolveView(item)` | Preference hierarchy |
| `findView(typeId)` | Type chain lookup |
| `getViews(typeId)` | All available views |
| `createRendererAPI(item, context)` | Build API object |

---

## Recommendations

1. **HIGH:** Fix view resolution query efficiency (see above)

2. **MEDIUM:** Extract `createRendererAPI` to improve readability

3. **LOW:** Add caching for view resolution results (invalidate on view item changes)

---

## Verdict

**Status:** ⚠️ Needs performance fix

Core functionality is solid, but view resolution performance should be addressed. The render instance registry is well-implemented.
