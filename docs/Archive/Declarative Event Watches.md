# Declarative Event Watches

## Problem

Code items need to respond to system events (item created, deleted, updated). Currently this requires imperative subscription via `api.events.on()`, which:

- Requires code to run at boot time to register listeners
- Makes it hard to query "what watches what" without executing code
- Subscription lifecycle is manual and error-prone
- Doesn't fit the "everything is data" philosophy

## Solution

Code items declare watches as **data** in their `content.watches` property. The system automatically manages subscriptions and calls handlers when matching events fire.

## Design Principles

- **Declarative over imperative** - Watches are data, not `events.on()` calls
- **Inspectable** - "What watches what" is queryable without executing code
- **Evaluated at event-fire time** - Filters (especially `typeExtends`) are checked against current state, not cached at boot
- **Consistent with reactive rendering** - Same pattern as Phase 4 renderer watches, but for any code item

## Watches Data Structure

```javascript
{
  id: "some-code-item",
  type: "library",  // or renderer, editor, etc.
  content: {
    watches: [
      {
        event: "item:deleted",
        type: "99999999-0000-0000-0000-000000000000"
      },
      {
        event: "item:updated",
        typeExtends: "22222222-0000-0000-0000-000000000000"
      },
      {
        event: "item:created",
        id: "88888888-0000-0000-0000-000000000000"
      }
    ],
    code: "..."
  }
}
```

### Watch Object Fields

| Field | Description |
|-------|-------------|
| `event` | Required. The event type to watch: `item:created`, `item:updated`, `item:deleted` |
| `type` | Optional. Exact match on `item.type` |
| `typeExtends` | Optional. Matches if the item's type chain includes this ID |
| `id` | Optional. Matches only a specific item ID |

If no filter fields are provided (only `event`), the watch matches all events of that type.

Multiple filter fields are AND-ed together.

## Handler Naming Convention

Code items export handler functions named by convention:

| Event | Handler Function |
|-------|------------------|
| `item:created` | `onItemCreated(event, api)` |
| `item:updated` | `onItemUpdated(event, api)` |
| `item:deleted` | `onItemDeleted(event, api)` |

### Handler Signature

```javascript
export function onItemDeleted({ id, item, previous }, api) {
  // id: the deleted item's ID
  // item: the deleted item data
  // previous: undefined for deletions (present for updates)
  // api: the standard renderer/REPL API
}
```

## Event-Fire Time Evaluation

When an event fires:

1. Query all code items that have `watches` containing this event type
2. For each watcher, evaluate its filter against the event's item:
   - `type`: exact match `event.item.type === filter.type`
   - `typeExtends`: walk the item's type chain, check if `filter.typeExtends` is in the chain
   - `id`: exact match `event.item.id === filter.id`
3. For each matching watcher:
   - Load the code item via module system
   - Call the appropriate handler function
   - Pass event data and API

**Why event-fire time?** Type chains can change (new types created). Caching at boot would miss dynamically created types.

## Queryability

The structured data enables queries like:

```javascript
// Find all items that respond to hobson-instance deletion
const watchers = (await api.getAll()).filter(item =>
  item.content?.watches?.some(w =>
    w.event === 'item:deleted' &&
    w.type === '99999999-0000-0000-0000-000000000000'
  )
);

// Find all items that watch any deletion
const deletionWatchers = (await api.getAll()).filter(item =>
  item.content?.watches?.some(w => w.event === 'item:deleted')
);
```

## Example: Cascade Delete for Nested Instances

```javascript
{
  id: "hobson-instance-lifecycle",
  name: "hobson-instance-lifecycle",
  type: "66666666-0000-0000-0000-000000000000",  // library
  content: {
    watches: [
      {
        event: "item:deleted",
        type: "99999999-0000-0000-0000-000000000000"  // hobson-instance type
      }
    ],
    code: `
export async function onItemDeleted({ id, item }, api) {
  // When a hobson-instance is deleted, clean up all its prefixed items
  const allItems = await api.getAllRaw();
  const prefix = id + ':';
  const nestedItems = allItems.filter(i => i.id.startsWith(prefix));

  console.log(\`Cleaning up \${nestedItems.length} items from deleted instance \${id}\`);

  for (const nested of nestedItems) {
    await api.delete(nested.id);
  }
}
`
  }
}
```

## Integration with Reactive Rendering

This pattern is consistent with Phase 4 of the Event System and Reactive Rendering design:

- **Renderers with watches** → system triggers partial re-render
- **Code items with watches** → system calls handler function

The difference is the action taken:
- Renderers: re-render
- Other code items: call exported handler

Both use the same `watches` data structure and event-fire time evaluation.

## Implementation Considerations

### Boot Sequence

1. Kernel boots normally
2. After boot, query all code items with `watches` property
3. Build an index: `eventType → [watcher items]`
4. Hook into event system to intercept events and dispatch to watchers

### Handler Errors

If a handler throws:
- Log the error
- Continue processing other watchers
- Don't break the event chain

### Performance

- Keep an index of watchers by event type (avoid scanning all items on every event)
- Invalidate/update index when code items are created/updated/deleted
- Type chain walking should be cached per-request (within one event dispatch)

### Ordering

Multiple watchers for the same event:
- No guaranteed order (unless we add a `priority` field later)
- Each handler should be independent

## Open Questions

1. **Should renderers use the same system?** Currently Phase 4 proposes `export const watches = [...]` in code. Should renderers also use `content.watches` for consistency?

2. **Wildcard events?** Should we support `event: "item:*"` to watch all item events?

3. **Custom events?** User-defined events like `my-feature:something` - should watches support these too?

4. **Async handlers?** Handlers are likely async. Should we await them or fire-and-forget?

5. **Handler return values?** Could a handler return something meaningful (e.g., cancel the event)?

## Relationship to Existing Systems

| System | Purpose | Watches Location |
|--------|---------|------------------|
| Event System (Phase 1) | Emit/subscribe to events | Imperative `api.events.on()` |
| Reactive Rendering (Phase 4) | Re-render on events | `export const watches` in code |
| Declarative Watches (this doc) | Run handlers on events | `content.watches` in data |

This design could eventually **replace** both the imperative subscription and the Phase 4 code-based watches, unifying on a single data-driven approach.
