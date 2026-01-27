# Hobson Kernel Code Review

*Review Date: 2026-01-27*
*Reviewed Files: kernel.json, bootloader.html*

---

## Executive Summary

The Hobson kernel is well-architected and follows the documented design principles. The bootstrap architecture, event system, and storage abstraction are particularly well-implemented. However, this review identified **2 critical bugs**, **3 moderate issues**, and several minor code quality concerns that should be addressed.

---

## Critical Issues

### 1. Undefined `kernel` Reference in kernel-module-system

**Location:** `kernel-module-system` → `isCodeItem()` and `typeChainIncludes()`

**Problem:** The variable `kernel` is referenced but never defined in the module's scope. The module receives `kernel` via constructor and stores it as `this.kernel`, but the code incorrectly references the bare `kernel` variable.

**Affected Code:**
```javascript
async isCodeItem(item) {
  return await this.typeChainIncludes(item.type, kernel.IDS.CODE);  // ❌ kernel undefined
}

async typeChainIncludes(typeId, targetId) {
  // ...
  if (current === kernel.IDS.ATOM) break;  // ❌ kernel undefined
  // ...
}
```

**Impact:** Any call to `isCodeItem()` or `typeChainIncludes()` will throw a `ReferenceError`. This affects:
- Code item validation during save
- Type chain checking in renderers
- Module cache invalidation logic

**Fix:**
```javascript
async isCodeItem(item) {
  return await this.typeChainIncludes(item.type, this.kernel.IDS.CODE);
}

async typeChainIncludes(typeId, targetId) {
  // ...
  if (current === this.kernel.IDS.ATOM) break;
  // ...
}
```

---

### 2. Incorrect ID Constants in kernel-storage Validation

**Location:** `kernel-storage` → `_validateItem()`

**Problem:** The hardcoded IDs in the validation function do not match the actual seed item IDs defined in the kernel and kernel.json.

**Affected Code:**
```javascript
async _validateItem(item, kernel) {
  const IDS = {
    ATOM: "00000000-0000-0000-0000-000000000000",
    TYPE_DEFINITION: "00000000-0000-0000-0000-000000000001",  // ❌ WRONG
    CODE: "00000000-0000-0000-0000-000000000002"              // ❌ WRONG
  };
  // ...
}
```

**Correct Values (from kernel.json seed items):**
```javascript
const IDS = {
  ATOM: "00000000-0000-0000-0000-000000000000",
  TYPE_DEFINITION: "11111111-0000-0000-0000-000000000000",  // ✓ Correct
  CODE: "22222222-0000-0000-0000-000000000000"              // ✓ Correct
};
```

**Impact:** Type chain validation may fail incorrectly or succeed when it shouldn't. The `TYPE_DEFINITION` and `CODE` checks won't match actual items.

**Fix:** Update the IDs to match the seed items, or better yet, receive IDS from the kernel parameter:
```javascript
async _validateItem(item, kernel) {
  const IDS = kernel?.IDS || {
    ATOM: "00000000-0000-0000-0000-000000000000",
    TYPE_DEFINITION: "11111111-0000-0000-0000-000000000000",
    CODE: "22222222-0000-0000-0000-000000000000"
  };
  // ...
}
```

---

## Moderate Issues

### 3. Undefined Variable in sourceURL Comment

**Location:** `kernel-module-system` → `evaluateCodeItem()`

**Problem:** The code references `itemId` which is not defined in this function's scope. The function parameter is `item`, not `itemId`.

**Affected Code:**
```javascript
async evaluateCodeItem(item) {
  // ...
  const code = `
    "use strict";
    ${item.content.code}
    //# sourceURL=${item.name || itemId + '.js'}  // ❌ itemId undefined
  `;
  // ...
}
```

**Impact:** When an item has no name, the sourceURL will be `undefined.js`, making debugging harder.

**Fix:**
```javascript
//# sourceURL=${item.name || item.id}.js
```

---

### 4. Dead Code: REPL.createAPI()

**Location:** `kernel-repl` → `createAPI()` method (approximately 140 lines)

**Problem:** The `REPL` class has a `createAPI()` method that is never called. The REPL's `run()` method calls `this.kernel.createREPLAPI()` instead:

```javascript
async run() {
  // ...
  const api = this.kernel.createREPLAPI();  // Uses kernel's method, not REPL's
  // ...
}
```

**Impact:** 
- ~140 lines of dead code that must be maintained
- Risk of the two API implementations drifting apart
- Confusion about which is canonical

**Fix:** Remove `REPL.createAPI()` entirely. The canonical implementation is `Kernel.createREPLAPI()`.

---

### 5. Global Event Handlers Not Cleaned Up on Reload

**Location:** `kernel-core` → `boot()` and `reloadKernel()`

**Problem:** The kernel registers several global event handlers with guards to prevent double-registration:

```javascript
if (!window._globalErrorHandler) {
  window._globalErrorHandler = (event) => { ... };
  window.addEventListener('error', window._globalErrorHandler);
}
// Similar for: _unhandledRejectionHandler, _replKeyboardHandler, _popstateHandler
```

However, `reloadKernel()` simply posts a message to trigger reload without cleaning up these handlers:

```javascript
reloadKernel() {
  window.postMessage({type: 'reload-kernel'}, '*');
}
```

**Impact:** While the guards prevent double-registration, the old handlers reference the old kernel instance. After reload, there are stale closures that reference deallocated objects.

**Fix:** Add cleanup before reload:
```javascript
reloadKernel() {
  // Clean up global handlers
  if (window._globalErrorHandler) {
    window.removeEventListener('error', window._globalErrorHandler);
    delete window._globalErrorHandler;
  }
  if (window._unhandledRejectionHandler) {
    window.removeEventListener('unhandledrejection', window._unhandledRejectionHandler);
    delete window._unhandledRejectionHandler;
  }
  if (window._replKeyboardHandler) {
    document.removeEventListener('keydown', window._replKeyboardHandler);
    delete window._replKeyboardHandler;
  }
  if (window._popstateHandler) {
    window.removeEventListener('popstate', window._popstateHandler);
    delete window._popstateHandler;
  }
  
  window.postMessage({type: 'reload-kernel'}, '*');
}
```

---

## Minor Issues

### 6. Unused Variable in Bootloader

**Location:** `bootloader.html`

**Problem:** The `safeMode` variable is parsed but never used:
```javascript
const safeMode = urlParams.get('safe') === '1';
```

Safe mode is actually handled by the kernel after boot, not by the bootloader.

**Impact:** Minor confusion; no functional impact.

**Fix:** Remove the unused variable or add a comment explaining it's parsed for potential future use.

---

### 7. Missing Error Cause Chain

**Location:** `kernel-module-system` → `evaluateCodeItem()`

**Problem:** When wrapping errors, the original error is not preserved in the chain:
```javascript
const wrappedError = new Error(`Failed to evaluate...`);
wrappedError.stack = error.stack;
// Original error is lost
```

**Fix:** Preserve the error chain:
```javascript
const wrappedError = new Error(`Failed to evaluate...`, { cause: error });
wrappedError.stack = error.stack;
```

---

### 8. Magic Strings for Event Names

**Location:** Throughout `kernel-core`

**Problem:** Event names are hardcoded strings scattered throughout the code:
- `'item:deleted'`
- `'item:created'`
- `'item:updated'`
- `'system:error'`
- `'item:*'`
- `'system:*'`

**Impact:** Typos won't be caught; refactoring is error-prone.

**Recommendation:** Define event names as constants:
```javascript
const EVENTS = {
  ITEM_CREATED: 'item:created',
  ITEM_UPDATED: 'item:updated',
  ITEM_DELETED: 'item:deleted',
  SYSTEM_ERROR: 'system:error',
  ITEM_WILDCARD: 'item:*',
  SYSTEM_WILDCARD: 'system:*'
};
```

---

### 9. Complex Viewport State

**Location:** `kernel-viewport`

**Observation:** The Viewport class tracks 8 distinct pieces of state:
- `rootId`
- `rootViewId`
- `rootViewConfig`
- `previousRootViewId`
- `previousRootViewConfig`
- `_hasPreviousRootView`
- `selectedItemId`
- `selectedParentId`

**Recommendation:** Consider consolidating related state into objects:
```javascript
this.root = {
  id: null,
  view: { id: null, config: {} },
  previousView: { id: null, config: {} }
};
this.selection = {
  itemId: null,
  parentId: null
};
```

This is not urgent but would improve maintainability.

---

## Positive Observations

### Well-Designed Event System
The EventBus with wildcard support (`namespace:*`) is elegant and enables the declarative watch pattern effectively. The separation between item events and system events is clean.

### Robust Cycle Detection
The render path tracking via context (`context.renderPath`) handles render cycles correctly without preventing valid data cycles in the item graph.

### Clean Storage Abstraction
The storage layer's support for both direct IndexedDB and the backend adapter pattern enables nested instances cleanly. The ID prefixing is transparent to the kernel.

### Good Error Boundaries
Render errors are caught and displayed with helpful information. The fallback error UI ensures errors are always visible even when handlers fail.

### Self-Documenting IDS Constants
The `[BEGIN:SEED_IDS]` / `[END:SEED_IDS]` markers in kernel-core are a nice touch for tooling that might need to extract these.

---

## Summary Table

| Priority | Issue | Location | Status |
|----------|-------|----------|--------|
| 🔴 Critical | `kernel` undefined in module-system | kernel-module-system | Needs fix |
| 🔴 Critical | Wrong IDs in storage validation | kernel-storage | Needs fix |
| 🟡 Moderate | `itemId` undefined in sourceURL | kernel-module-system | Needs fix |
| 🟡 Moderate | Dead code `createAPI()` | kernel-repl | Should remove |
| 🟡 Moderate | Global handlers not cleaned up | kernel-core | Should fix |
| 🟢 Minor | Unused `safeMode` variable | bootloader.html | Can remove |
| 🟢 Minor | Missing error cause chain | kernel-module-system | Nice to have |
| 🟢 Minor | Magic strings for events | kernel-core | Nice to have |
| 🟢 Minor | Complex viewport state | kernel-viewport | Future refactor |

---

## Recommended Next Steps

1. **Immediate:** Fix the two critical bugs (undefined `kernel` reference and wrong IDs)
2. **Soon:** Fix the moderate issues (sourceURL, dead code removal, handler cleanup)
3. **Later:** Address minor issues as part of ongoing maintenance

---

## Files Reviewed

- `kernel.json` (254 lines) - Contains 18 items including 8 kernel modules
- `bootloader.html` (as provided in document) - ~245 lines

## Methodology

- Manual code review
- Cross-reference with Technical_Overview.md and other project documentation
- Comparison of ID constants across modules
- Dead code analysis
- Error handling flow analysis
