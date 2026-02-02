# Hot-Reloading Libraries

## The Problem

When a view renders, it typically requires its dependencies at the top:

```javascript
export async function render(item, api) {
  const typePicker = await api.require('type-picker-lib');

  const addChildToItem = async () => {
    await typePicker.showTypePicker(api);  // Uses captured reference
  };
  // ...
}
```

The `typePicker` variable captures a reference to the module *at render time*. If you edit `type-picker-lib` and save, the module cache is cleared and fresh code is available - but the view still holds its old reference. Your changes won't take effect until the view re-renders.

## The Solution: Re-require Where You Use

For libraries under active development, require them where they're used rather than at render time:

```javascript
export async function render(item, api) {
  const addChildToItem = async () => {
    const typePicker = await api.require('type-picker-lib');  // Fresh each time
    await typePicker.showTypePicker(api);
  };
  // ...
}
```

Now each invocation gets the current version of the library.

## Performance

This is cheap. The module system checks the cached module's timestamp against the item's `modified` field:

```javascript
if (cached && cached.timestamp >= item.modified) {
  return cached.module;  // Fast path: Map lookup + comparison
}
```

If the library hasn't changed, you get the cached module. If it has changed, you get fresh code. Either way, one async operation.

## When This Matters

- **Active development**: You're iterating on a library and want to see changes immediately
- **Debugging**: You're adding console.logs to trace behavior

## When It Doesn't Matter

- **Stable libraries**: Code that rarely changes can be captured at render time
- **Performance-critical paths**: If you're calling a library in a tight loop, capture it once (but this is rare in UI code)

## Alternative: Full Re-render

If you've edited a library and want all views to pick up the changes, you can force a full viewport re-render:

```javascript
// In REPL
await api.renderViewport()
```

This rebuilds the entire view tree with fresh requires. You'll lose transient state (scroll positions, expanded states, unsaved form inputs), but it guarantees fresh code everywhere.

## Why Not Automatic?

We considered several automatic approaches:

1. **Re-render on library save**: Destroys transient state across all views
2. **Proxy indirection**: Makes every property access async, breaks destructuring
3. **Dependency tracking**: Complex, still loses state in affected views

The re-require pattern is explicit, predictable, and matches how the module system actually works. The discipline required is: "require libraries where you use them when iterating on those libraries."
