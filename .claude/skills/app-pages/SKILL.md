---
description: "Reference for Hobson app pages and widgets: grid layout, app-page content fields, pageContext API, widget creation patterns, and design mode."
user-invocable: false
---

# App Pages & Widgets — Writing Guide

App pages are grid-based dashboards. A page is an `app-page` item; each widget is a child item attached with grid position metadata.

## Key GUIDs

| Item | GUID |
|------|------|
| `app-page` type | `c4563df8-2eb4-4ad6-9502-5bf35b28e410` |
| `app-page-view` | `ef977316-0496-487a-b662-0ba07e40eea2` |
| `app-page-design-lib` | `9e0953dc-b75c-4015-9c6f-79afad34d5a1` |

## app-page Item Structure

```json
{
  "id": "<guid>",
  "name": "My Dashboard",
  "type": "c4563df8-2eb4-4ad6-9502-5bf35b28e410",
  "content": {
    "columns": 12,
    "gap": 8,
    "rowHeight": 40,
    "onInit": "// optional JS: runs before widgets render\n// receives: api, pageContext"
  },
  "attachments": [
    {
      "id": "<widget-guid>",
      "view": {
        "col": 1,
        "row": 1,
        "colSpan": 6,
        "rowSpan": 4
      }
    }
  ]
}
```

`col`, `row`, `colSpan`, `rowSpan` are 1-based CSS Grid values. `rowHeight` is in pixels; actual row height = `rowHeight * rowSpan + gap * (rowSpan - 1)`.

## pageContext API

Every widget receives a shared `pageContext` object for inter-widget communication. In JS views it is injected via `api.pageContext`; in Hob views via `(js-require "app-page-context")`.

```javascript
pageContext.getState(key)              // → value
pageContext.setState(key, value)       // write + notify listeners
pageContext.onStateChange(key, cb)     // subscribe; returns unsubscribe()
```

`pageContext` is reset each time the page re-renders. Do not rely on it for persistence — use `api.set()` for that.

## onInit

`onInit` is a JS string evaluated once before widget rendering:

```javascript
// Example: seed shared state from page content
pageContext.setState('filter', item.content.defaultFilter || '');
```

## Writing a Widget View (JS)

```javascript
export async function render(item, api) {
  const ctx = api.pageContext;  // injected by app-page-view
  const container = api.createElement('div', { className: 'my-widget' });

  // React to shared state
  const unsub = ctx.onStateChange('filter', (val) => {
    label.textContent = val;
  });

  container.__cleanup = unsub;
  return container;
}
```

## Writing a Widget View (Hob)

```hob
(defn render [item api]
  (def ctx (js-require "app-page-context"))
  (def filter-val (atom (.getState ctx "filter")))

  (.onStateChange ctx "filter" (fn [val] (reset! filter-val val) (rerender!)))

  [:div {:class "my-widget"}
    [:span {} (deref filter-val)]])
```

## View Override on an Attachment

To render a specific widget with a non-default view:

```json
"view": { "col": 1, "row": 1, "colSpan": 4, "rowSpan": 3, "viewId": "<view-guid>" }
```

## Creating a New Widget Type

1. Create a type item extending `atom` (or a suitable base).
   - Tag with `c0c0c0c0-0071-0000-0000-000000000000` to appear in the app-page widget picker.
2. Write a view (Hob or JS) that uses `api.pageContext` for inter-widget communication.
3. Set `preferredView` on the type to point at your view.
4. Add the widget to a page via design mode or directly in the JSON `attachments` array.

## Design Mode

`app-page-view` has a visual layout editor. A **Design** button (top-right, opacity 0.6 on hover) toggles between live mode and design mode.

In design mode: drag to reposition, resize via handles, add/remove widgets, delete (Remove from Page or Delete Permanently). Design mode writes directly to `attachment.view` on the page item.

## Grid Layout Tips

- Default: 12 columns, 8px gap, 40px row height
- Button/badge widgets: `rowSpan: 1` (40px)
- Text/note widgets: `rowSpan: 4` (~200px including gaps)
- Full-width section: `col: 1, colSpan: 12`
- Half-width split: two widgets with `colSpan: 6`

## Skeleton app-page JSON

```json
{
  "id": "<new-guid>",
  "name": "My Dashboard",
  "type": "c4563df8-2eb4-4ad6-9502-5bf35b28e410",
  "created": 0,
  "modified": 0,
  "content": {
    "columns": 12,
    "gap": 8,
    "rowHeight": 40
  },
  "attachments": []
}
```
