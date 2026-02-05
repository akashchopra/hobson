# Event System Assessment

Assessment of the reactive rendering proposal in `Event System and Reactive Rendering.md`.

## Current Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1: Event System** | Complete | `EventBus` class, wildcard matching, events for `item:created/updated/deleted` and `system:error` |
| **Phase 2: Render Instance Tracking** | Complete | `RenderInstanceRegistry` tracks all rendered items |
| **Phase 3: Partial Re-render** | Complete | `rerenderItem(itemId)` updates item in place |
| **Phase 4: Reactive Rendering** | Different approach | Implemented as code-item watchers, not view-level watches |

## What Actually Got Built

Instead of the proposed view-based reactive rendering, Hobson has a **code-item watcher system**:

```javascript
// Example: hobson-instance-lifecycle (f939abc4-2e9e-4d6a-a049-c9361fb3590d)
content: {
  watches: [{ event: "item:deleted", type: "99999999-..." }],
  code: "export async function onItemDeleted({ id, item }, api) { ... }"
}
```

This is fundamentally different from the proposal:

- **Proposal:** Views declare watches -> automatic partial re-render of visible DOM
- **Implemented:** Code items declare watches -> custom handler code executes

The current system is useful for side-effects (cascade delete, error logging) but doesn't solve the original problem of rendering churn.

## Does the Proposal Still Make Sense?

**Yes, but with caveats.**

### Strengths

1. **Addresses real pain** - `renderRoot()` is still called throughout kernel-core (lines 665, 851, 985). The problems (editor state loss, scroll resets) remain.

2. **Incremental path** - Phases 2-3 can be implemented independently and provide immediate value.

3. **Declarative over imperative** - The `watches` array on views is inspectable, unlike buried re-render calls.

### Weaknesses and Concerns

1. **Watch specificity (Open Question #1)** - Watching by event type alone may be too coarse. A counter view that watches `item:created` would re-render when *any* item is created, even items in unrelated containers. The proposal acknowledges this but leaves it open.

2. **Nested rendering (Open Question #4)** - If parent and child both watch the same event, render order matters. Parent-first could cause child to be destroyed and re-created. Child-first could render stale data if parent would change structure.

3. **Phase 2 complexity** - Tracking render instances requires solving the "when does an instance die?" problem. DOM mutation observation? Manual cleanup? The registry could leak if not careful.

4. **Interaction with existing watchers** - The code-item watcher system already exists. How do view-level watches coexist? Could a `hobson-instance-lifecycle` handler delete an item, triggering an `item:deleted` event, triggering a view re-render that shows stale data?

## Recommendation

**Implement Phases 2-3 before Phase 4.**

The current `renderRoot()` pain is real. Phase 3 (partial re-render) alone would let you surgically update specific views without the machinery of automatic watches. You could expose:

```javascript
api.viewport.rerenderItem(itemId)  // Re-render just this item in place
```

This gives 80% of the benefit with 20% of the complexity. Code that currently calls `renderRoot()` after a save could instead call `rerenderItem()` on the specific changed item.

Phase 4 (automatic reactive watches) is more ambitious and the open questions are harder. Defer it until you have real experience with Phase 3 and better understand which re-render patterns are actually common.

## Next Steps

1. Design Phase 2 render instance registry with explicit lifecycle management
2. Implement Phase 3 `rerenderItem()` API
3. Audit existing `renderRoot()` calls and replace with targeted re-renders where possible
4. Gather data on which events actually trigger re-renders in practice before designing Phase 4
