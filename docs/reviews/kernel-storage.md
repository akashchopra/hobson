# Review: kernel-storage

**Item ID:** `33333333-2222-0000-0000-000000000000`
**Type:** kernel-module

---

## Responsibilities

1. Delegate CRUD operations to bootloader-provided backend
2. Validate items before storage (type chain, code item names)
3. Provide query interface
4. Handle namespace separation for nested instances

---

## Code Review

### Strengths

- **Clean delegation pattern:** Storage doesn't implement IndexedDB directly; delegates to backend
- **Thorough type chain validation:** Prevents circular references and dangling types
- **Namespace-aware name uniqueness:** Code items can have same name in different instances

### Issues Found

**None critical.**

### Minor Observations

1. **Line 73:** `_validateTypeChain` uses recursion. For deeply nested type chains (unlikely in practice), could hit stack limit. Consider iterative approach if chains exceed 100 levels.

2. **Line 43-48:** `exists()` catches any error and returns false. Could mask real storage errors.
   ```javascript
   async exists(id) {
     try {
       await this.get(id);
       return true;
     } catch {
       return false;  // Doesn't distinguish "not found" from other errors
     }
   }
   ```

3. **Line 60-66:** Name uniqueness check queries by name, then filters. For large item counts, could add index on `(name, namespace)` for better performance.

---

## API Surface

| Method | Description | Notes |
|--------|-------------|-------|
| `get(id)` | Retrieve item | Throws if not found |
| `set(item, kernel)` | Store with validation | Requires kernel for code item check |
| `delete(id)` | Remove item | Delegates to backend |
| `query(filter)` | Filter items | Implementation in backend |
| `getAll()` | All items | Current namespace only |
| `getAllRaw()` | All including nested | For cascade operations |
| `exists(id)` | Check existence | Returns boolean |
| `deleteByPrefix(prefix)` | Cascade delete | For nested instances |

---

## Recommendations

1. **Low priority:** Consider logging when `exists()` catches non-"not found" errors for debugging.

2. **Future:** If performance becomes an issue with many code items, add composite index for name uniqueness check.

---

## Verdict

**Status:** ✓ No changes required

Well-implemented module with clear responsibilities. The validation logic is correct and the delegation pattern keeps it focused.
