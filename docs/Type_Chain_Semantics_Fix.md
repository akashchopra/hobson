# Type Chain Semantics Fix

**Date:** 2026-01-23

---

## The Problem

Type chains are currently used for two different purposes:

1. **Behavior Delegation** (correct): Finding renderers/editors by walking up the chain
2. **Capability Detection** (incorrect): Determining if an item "has code" by checking chain membership

This creates a logical inconsistency. Consider:

```
note_renderer → renderer → code → type_definition → atom
```

Using type chain inclusion:
- `note_renderer` "is code" ✓ (makes sense - it has executable code)
- `note_renderer` "is type_definition" ✗ (clearly wrong - it's not a type definition)
- `note_renderer` "is atom" ✗ (technically true but meaningless)

**The issue:** Type chain walking implies full transitivity (if A→B→C then A "is" C), which breaks semantic meaning.

---

## The Distinction

**Type chains should only answer:** "How does this item behave?" (delegation)

**Type chains should NOT answer:** "What capabilities does this item have?" (identity)

### Behavior Delegation (Keep Using Type Chains)

When rendering an `academic_paper` item (where `academic_paper → note`):
1. Look for `academic_paper_renderer` (not found)
2. Walk up chain to `note`
3. Find `note_renderer` - use it!

This is correct: specialized types inherit their parent's rendering behavior.

### Capability Detection (Stop Using Type Chains)

When validating whether an item needs a name:
- **Current (incorrect):** Walk type chain to check if `CODE` appears
- **Proposed (correct):** Check if `item.content.code` exists

---

## Proposed Fix

Change capability checks from type-based to content-based:

```javascript
// BEFORE (type chain walking)
async isCodeItem(item) {
  return await this.typeChainIncludes(item.type, CODE_ID);
}

// AFTER (direct capability check)
isCodeItem(item) {
  return item.content?.code && 
         typeof item.content.code === 'string' && 
         item.content.code.trim().length > 0;
}
```

**Benefits:**
- Removes semantic inconsistency
- Type identity is determined by direct type only
- Capabilities are explicit (based on content)
- Type chains remain purely for behavior delegation

---

## Summary

**Keep type chain walking for:** Renderer lookup, editor lookup (delegation patterns)

**Stop type chain walking for:** Capability detection, *transitive* identity checks

**Direct type matching remains valid for:** Identity queries like "is this a renderer?" or "show me all type definitions" - checking `item.type === RENDERER_ID` is correct because it asks about the item's immediate type, not a transitive relationship.

**Use content inspection for:** Capability detection like "does this item have executable code?" - checking `item.content?.code` is correct because capabilities are self-describing.

This makes the system's semantics clear and consistent:
- **Type chain** → behavior delegation (inheritance)
- **Direct type** → identity (what kind of thing is this?)
- **Content presence** → capability (what can this thing do?)
