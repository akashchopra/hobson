---
description: "Reference for Hobson generic-view and view-specs: ui_hints format, all hint properties, available field_view options, save/cancel behavior, and skeleton JSON."
user-invocable: false
---

# Generic Views — Writing Guide

`generic-view` (`b429b19d-ef0d-4f4f-b2a2-b9e6f80451f2`) is a JS library that interprets **view-spec items** to build UI declaratively. Use it when you want an editable/readonly form for a type without writing view code.

## When to Use

- Simple CRUD editing of an item's fields (text, tags, code, doc, etc.)
- Readonly display of structured content
- You want Save/Cancel/Save&View buttons automatically

For complex interactive logic, write a Hob or JS view instead.

## View-Spec Item Structure

A view-spec item is type `aaaaaaaa-0000-0000-0000-000000000000` (same as a regular view). It specifies which view is the target via `content.for_type` and configures field rendering via `content.ui_hints`.

**Every view-spec must include a `code` field** with the following boilerplate — the viewport engine calls `render(item, api)` on the view item directly, so without it the item crashes with "has no code to evaluate":

```javascript
export async function render(item, api) {
  const genericView = await api.require('generic-view');
  return genericView.render(item, api);
}
```

```json
{
  "id": "<guid>",
  "name": "my-type-view",
  "type": "aaaaaaaa-0000-0000-0000-000000000000",
  "content": {
    "for_type": "<type-guid>",
    "displayName": "My Type",
    "description": [":doc", [":p", {"s": "Editable view for My Type."}]],
    "ui_hints": {
      "name": {
        "field_view": "text",
        "mode": "editable",
        "label": "Name"
      },
      "content.description": {
        "field_view": "doc-editable",
        "mode": "editable",
        "label": "Notes"
      }
    }
  },
  "attachments": []
}
```

Fields are rendered top-to-bottom in the order they appear in `ui_hints`.

## `ui_hints` Field Options

| Property | Type | Description |
|----------|------|-------------|
| `field_view` | string | Field-view suffix: `"text"`, `"doc-editable"`, `"code-editable"`, `"tags"`, etc. Defaults to `"markdown"` for `content.description`, `"json"` otherwise. |
| `mode` | `"editable"` \| `"readonly"` | Controls editability. If any field is editable, Save/Cancel buttons appear. |
| `label` | string | Section label shown above the field. |
| `hidden` | boolean | Skip rendering entirely. |
| `showIfPresent` | boolean | Only render if the field has a non-null value. |
| `collapsible` | boolean | Wrap in a `<details>` element. |
| `startCollapsed` | `boolean` \| `"ifEmpty"` | Initial open state when collapsible. |
| `placeholder` | string | Placeholder text passed to the field view. |
| `dividerAfter` | boolean | Render an `<hr>` after this field. |

## Available Field Views

Reference as the `field_view` value (the part after `field-view-`):

| Value | Use for |
|-------|---------|
| `text` | Single-line text |
| `textarea` | Multi-line plain text |
| `doc-editable` | Active Text (rich doc) — editable |
| `doc-readonly` | Active Text — readonly |
| `code-editable` | Code with syntax highlighting — editable |
| `code-readonly` | Code — readonly |
| `hob-text` | Hob expression — mobile-friendly text editor |
| `hob-structural` | Hob expression — keyboard-driven structural editor |
| `checkbox` | Boolean toggle |
| `number` | Numeric input |
| `tags` | Tag picker (array of GUIDs) |
| `item-ref` | Single item reference picker |
| `timestamp` | Date/time display and picker |
| `json` | Raw JSON fallback |
| `heading` | Editable `<h1>`/`<h2>` etc. |
| `markdown` | Markdown renderer (readonly) |

## Save / Cancel Behaviour

When any field has `mode: "editable"`:
- A sticky footer appears with **Cancel**, **Save**, and **Save & View** buttons.
- **Cancel** returns to the item's default view (via `api.restorePreviousView`).
- **Save** writes the edited item and re-renders in place.
- **Save & View** writes then returns to the default view.

Changes are held in a local clone of the item until saved — nothing is auto-saved on keystroke.

## Nested Field Paths

Use dot notation to address nested fields:

```json
"ui_hints": {
  "content.title": { "field_view": "text", "mode": "editable", "label": "Title" },
  "content.description": { "field_view": "doc-editable", "mode": "editable", "label": "Body" },
  "content.tags": { "field_view": "tags", "mode": "editable", "label": "Tags" }
}
```

If one field writes to a parent path that another writes to a child path (e.g. `content` and `content.description`), generic-view merges them correctly.

## Full Skeleton

```json
{
  "id": "<new-guid>",
  "name": "my-type-edit-view",
  "type": "aaaaaaaa-0000-0000-0000-000000000000",
  "created": 0,
  "modified": 0,
  "content": {
    "for_type": "<type-guid>",
    "displayName": "My Type (Edit)",
    "description": [":doc", [":p", {"s": "Editable view for My Type."}]],
    "code": "export async function render(item, api) {\n  const genericView = await api.require('generic-view');\n  return genericView.render(item, api);\n}\n",
    "ui_hints": {
      "name": {
        "field_view": "heading",
        "mode": "editable",
        "label": null
      },
      "content.description": {
        "field_view": "doc-editable",
        "mode": "editable",
        "label": "Notes"
      },
      "content.tags": {
        "field_view": "tags",
        "mode": "editable",
        "label": "Tags",
        "showIfPresent": false
      }
    }
  },
  "attachments": []
}
```

Set `preferredView` on the type item to point at this view's GUID so it becomes the default.
