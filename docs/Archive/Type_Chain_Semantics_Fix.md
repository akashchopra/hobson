# Type Chain Semantics Fix

**Date:** 2026-01-23
**Status:** Implemented 2026-01-30 (bounded type chain approach)

---

## The Problem

Type chains were being walked without bounds, crossing meta-level boundaries:

```
note_view → view → code → type_definition → atom
```

Unbounded walking meant:
- `note_view` "is code" ✓ (correct)
- `note_view` "is type_definition" ✗ (wrong - crosses meta-level)
- `note_view` "is atom" ✗ (wrong - meaningless)

**The issue:** The chain conflates two relationships:
1. **Subtype**: view is-a-kind-of code (same meta-level)
2. **Meta-level**: code is-defined-by type_definition (crosses meta-levels)

---

## The Solution: Bounded Type Chain Walking

Walk the type chain but **stop at the type_definition boundary**. When an item's type is `TYPE_DEFINITION`, that item is itself a type (not an instance), so don't walk further.

```javascript
async typeChainIncludes(typeId, targetId) {
  let current = typeId;
  const visited = new Set();

  while (current && !visited.has(current)) {
    if (current === targetId) return true;
    visited.add(current);

    if (current === this.kernel.IDS.ATOM) break;

    const typeItem = await this.kernel.storage.get(current);

    // Stop at type_definition boundary
    if (typeItem.type === this.kernel.IDS.TYPE_DEFINITION) break;

    current = typeItem.type;
  }

  return false;
}
```

For `note_view`:
- Chain walked: `[view, code]` (stop because `code.type === TYPE_DEFINITION`)
- "is note_view code?" → YES (code is in chain)
- "is note_view type_definition?" → NO (not in chain, stopped before)

---

## Why This Works

The boundary recognizes that items whose type is `TYPE_DEFINITION` are **types themselves**, not instances. Walking past them enters the meta-level where the question "is X a Y?" loses its intuitive meaning.

**One rule** (stop at type_definition) handles all capability detection correctly, vs. N content-field rules that must be memorized.

---

## Summary

- **Type chain walking** → valid for both delegation AND capability detection
- **Bounded at type_definition** → prevents meta-level confusion
- **No content inspection needed** → capabilities are expressed in type hierarchy
