# Review: kernel-viewport

**Item ID:** `33333333-3333-0000-0000-000000000000`
**Type:** kernel-module

---

## Responsibilities

1. Track current root item (what's being viewed)
2. Manage view override for root (selected view type)
3. Store previous view for "restore" functionality
4. Handle selection state (runtime only, not persisted)
5. Persist/restore state to viewport item

---

## Code Review

### Strengths

- **Clean state management:** Clear separation between runtime state and persisted state
- **Previous view tracking:** Enables "restore previous view" UX
- **View config support:** Stores additional config (banner position, etc.) alongside view type

### Issues Found

**None critical.**

### Minor Observations

1. **State consistency:** `setRoot()` clears selection but doesn't clear `rootViewConfig`. The caller is expected to manage view config separately. This is intentional but could be documented.

2. **Line 91-99:** `persist()` builds the child spec inline. If the format changes, multiple places would need updating:
   ```javascript
   const childSpec = { id: this.rootId };
   if (viewConfig) {
     childSpec.view = viewConfig;
   }
   if (this._hasPreviousRootView) {
     // ...build previousView
   }
   ```
   Consider extracting to `buildChildSpec()` method.

3. **Backward compatibility:** The `restore()` method handles both old (`child.renderer`) and new (`child.view.type`) formats. Good defensive coding.

---

## API Surface

| Method | Description | Notes |
|--------|-------------|-------|
| `setRoot(itemId)` | Set current root | Clears selection |
| `getRootView()` | Get view override | Returns view type ID or null |
| `setRootView(viewId)` | Set view override | Stores previous automatically |
| `getRootViewConfig()` | Full view config | Type + additional props |
| `updateRootViewConfig(updates)` | Merge config updates | For banner position, etc. |
| `restorePreviousRootView()` | Revert to previous | Returns boolean success |
| `select(itemId, parentId)` | Set selection | Runtime only |
| `clearSelection()` | Clear selection | Runtime only |
| `persist()` | Save to storage | Async |
| `restore()` | Load from storage | Async |

---

## Recommendations

1. **Documentation:** Add comment explaining that `setRoot()` doesn't clear `rootViewConfig` intentionally.

2. **Low priority:** Extract child spec building to reduce code duplication between `persist()` and understanding.

---

## Verdict

**Status:** ✓ No changes required

Focused module with clear purpose. The previous view tracking is a nice UX feature properly implemented.
