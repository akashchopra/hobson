---
description: "Reference for writing JS views in Hobson: render contract, full API reference, DOM patterns, when to use JS over Hob, and skeleton templates."
user-invocable: false
---

# JS Views — Writing Guide

Do not write JS views unless Hob's async model is incompatible with a requirement.

## Item Structure

```json
{
  "id": "<guid>",
  "name": "my-view",
  "type": "aaaaaaaa-0000-0000-0000-000000000000",
  "content": {
    "for_type": "<type-guid>",
    "displayName": "My View",
    "description": [":doc", ...],
    "code": "..."
  },
  "attachments": []
}
```

`content.code` is a JS string. Alongside the `.json` there is a paired `.code` sidecar with the same source for convenient reading.

## Render Contract

```javascript
export async function render(item, api) {
  // Build and return a DOM element.
  // item: snapshot of the item at render time
  // api: full rendering API
  const container = api.createElement('div', { className: 'my-view' });
  // ... populate container ...
  return container;
}
```

The rendering engine calls `render`, mounts the returned element, and calls it again on re-renders (via morphdom diffing).

## API Reference

### Storage
| Call | Description |
|------|-------------|
| `await api.get(id)` | Fetch item by GUID |
| `await api.set(item)` | Save item, triggers reactive re-renders |
| `await api.getAll()` | All items in current namespace |
| `await api.getBlob(id)` | Fetch Blob from blob store |
| `await api.setBlob(id, blob)` | Store binary data |
| `await api.delete(id)` | Delete item |

### Rendering
| Call | Description |
|------|-------------|
| `api.createElement(tag, props?)` | Create DOM element |
| `await api.require(name)` | Load a module by name |
| `await api.rerenderItem(id)` | Re-render a specific item |
| `api.getViewId()` | GUID of the view item currently rendering |
| `api.getParentId()` | Rendering context parent GUID |
| `api.getNavigateTo()` | Navigation params from context (field, symbol, region, lines) |

### Navigation
| Call | Description |
|------|-------------|
| `await api.navigate(id)` | Navigate viewport to item |
| `api.viewport.getRoot()` | Current viewport root GUID |
| `await api.viewport.setRootView(viewId)` | Override root view (null to clear) |
| `await api.restorePreviousView(itemId)` | Return to previous view |

### Attachment Management
| Call | Description |
|------|-------------|
| `await api.setAttachmentView(parentId, childId, viewConfig)` | Override view for one attachment |
| `await api.findContainerOf(itemId)` | Find item that has this as attachment |

## DOM Creation Patterns

```javascript
// Simple element
const div = api.createElement('div', { className: 'foo' });
div.style.cssText = 'padding: 16px;';
div.textContent = 'Hello';

// With event handler
const btn = api.createElement('button');
btn.textContent = 'Click';
btn.onclick = async () => {
  const fresh = await api.get(item.id);
  await api.set({ ...fresh, modified: Date.now() });
  await api.rerenderItem(item.id);
};

// Building a list of child items
for (const attachment of item.attachments || []) {
  const childId = typeof attachment === 'string' ? attachment : attachment.id;
  const child = await api.get(childId);
  const childEl = api.createElement('div');
  childEl.textContent = child.name;
  container.appendChild(childEl);
}
```

## Always Fetch Fresh Before Saving

```javascript
// Correct
const fresh = await api.get(item.id);
await api.set({ ...fresh, content: { ...fresh.content, field: newValue }, modified: Date.now() });

// Wrong — item is a stale snapshot from when render() was called
await api.set({ ...item, content: { ...item.content, field: newValue } });
```

## When to Use JS Over Hob

- **Synchronous callbacks required**: sort comparators, `Sortable.js`, native drag-and-drop event handlers that must run sync.
- **Browser API objects**: need to pass `File`, `Blob`, `FileReader`, `Canvas`, `WebGL` contexts to native APIs.
- **External JS library integration**: wrapping a library that isn't Hob-friendly.
- **Complex DOM manipulation**: intricate layout logic that would be awkward in hiccup.

For all other cases, prefer Hob — it has less boilerplate, reactive state is simpler, and it aligns with the system's direction.

## Minimal Skeleton

```javascript
export async function render(item, api) {
  const container = api.createElement('div', { className: 'my-view' });
  container.style.cssText = 'padding: 16px;';

  const heading = api.createElement('h2');
  heading.textContent = item.name;
  container.appendChild(heading);

  return container;
}
```

## Full Skeleton (with editable field + save)

```javascript
export async function render(item, api) {
  const container = api.createElement('div');
  container.style.cssText = 'max-width: 700px; margin: 0 auto; padding: 20px;';

  const input = api.createElement('input');
  input.type = 'text';
  input.value = item.content?.field || '';
  input.style.cssText = 'padding: 8px; border: 1px solid var(--color-border); border-radius: var(--border-radius); width: 100%;';
  container.appendChild(input);

  const saveBtn = api.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.style.cssText = 'margin-top: 8px; padding: 8px 16px; background: var(--color-primary); color: white; border: none; border-radius: var(--border-radius); cursor: pointer;';
  saveBtn.onclick = async () => {
    const fresh = await api.get(item.id);
    await api.set({
      ...fresh,
      content: { ...fresh.content, field: input.value },
      modified: Date.now()
    });
    await api.rerenderItem(item.id);
  };
  container.appendChild(saveBtn);

  return container;
}
```

## Key Item GUIDs

| Item | GUID |
|------|------|
| View type | `aaaaaaaa-0000-0000-0000-000000000000` |
| Library type | `66666666-0000-0000-0000-000000000000` |
| viewport-rendering (API source) | `f1111111-0008-0000-0000-000000000000` |
