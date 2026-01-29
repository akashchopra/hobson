# Review: kernel-module-system

**Item ID:** `33333333-4444-0000-0000-000000000000`
**Type:** kernel-module

---

## Responsibilities

1. Load code items as ES modules
2. Cache modules with timestamp-based invalidation
3. Detect circular dependencies
4. Resolve names to IDs
5. Check if items are code items (type chain includes CODE)

---

## Code Review

### Strengths

- **Proper cache invalidation:** Checks `item.modified` timestamp against cached timestamp
- **Circular dependency detection:** Uses `callStack` Set to detect cycles
- **Source URL annotation:** Adds `//# sourceURL` for debugging
- **Error capture:** Calls `kernel.captureError()` per error handling spec

### Issues Found

**None critical.**

### Minor Observations

1. **Line 46-52:** Blob URL is created and revoked immediately after import:
   ```javascript
   const blob = new Blob([code], { type: "application/javascript" });
   const url = URL.createObjectURL(blob);

   try {
     const module = await import(url);
     return module;
   } finally {
     URL.revokeObjectURL(url);
   }
   ```
   This is correct - the import completes before `finally` runs. The module is cached in browser memory even after URL revocation.

2. **Line 17-22:** Name-to-ID resolution assumes names are shorter than 36 chars or don't contain hyphens:
   ```javascript
   if (!nameOrId.includes("-") || nameOrId.length < 36) {
     // Treat as name
   }
   ```
   This heuristic could fail for names like `my-renderer-item` (contains hyphen, could be 36+ chars). Consider more robust UUID detection.

3. **Error wrapping:** Creates new Error with `{ cause: error }` which is good for error chaining, but the stack is then overwritten with original stack. This loses the wrapper's stack.

---

## API Surface

| Method | Description | Notes |
|--------|-------------|-------|
| `require(nameOrId, callStack)` | Load module | Returns cached if fresh |
| `evaluateCodeItem(item)` | Execute code | Creates blob URL |
| `isCodeItem(item)` | Check type chain | Async |
| `typeChainIncludes(typeId, targetId)` | Check inheritance | Async |
| `clearCache()` | Invalidate all | For safe mode, etc. |

---

## Recommendations

1. **Medium priority:** Improve UUID detection:
   ```javascript
   const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
   const isUUID = UUID_PATTERN.test(nameOrId);
   ```

2. **Low priority:** Keep wrapper error's stack in addition to original:
   ```javascript
   wrappedError.originalStack = error.stack;
   wrappedError.stack = `${wrappedError.message}\n    caused by:\n${error.stack}`;
   ```

---

## Verdict

**Status:** ✓ No changes required (minor improvements optional)

Well-implemented module system. The caching and circular dependency detection are correct. The blob URL handling is proper.
