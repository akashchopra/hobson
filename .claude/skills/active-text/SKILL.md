---
description: "Reference for the Active Text document format used in content.description: full block and inline node schema, table structure, special nodes, and programmatic construction."
user-invocable: false
---

# Active Text — Format Reference

Active Text is the JSON AST format used in `content.description` (and anywhere rich text appears). It replaces plain markdown strings. The canonical representation is a nested array; there is no string form in storage.

## Key Items

| Item | GUID |
|------|------|
| `field-view-doc-editable` | `d0d0d0d0-0007-0000-0000-000000000000` |
| `field-view-doc-readonly` | `d0d0d0d0-0006-0000-0000-000000000000` |
| `markdown-to-active-text` | `d0d0d0d0-0008-0000-0000-000000000000` |
| Transclusion doc | `c0c0c0c0-0035-0000-0000-000000000000` |

## Root Structure

```json
[":doc",
  [":p", {"s": "First paragraph."}],
  [":h2", {"s": "A heading"}],
  [":p", {"s": "Second paragraph."}]
]
```

- The first element is always the string `":doc"`.
- Remaining elements are **block nodes**.
- An empty document is `[":doc", [":p", {"s": ""}]]` — always at least one block.

## Text Leaf

Plain text is represented as an object with an `s` key:

```json
{"s": "text content"}
```

This is not a tagged array — it's a plain object. It appears as a child of block and inline nodes.

## Block Nodes

| Tag | Children | Notes |
|-----|----------|-------|
| `":p"` | inline nodes + text leaves | Paragraph |
| `":h1"` – `":h6"` | usually a single text leaf | Heading |
| `":ul"` | `":li"` nodes | Unordered list |
| `":ol"` | `":li"` nodes | Ordered list |
| `":li"` | block nodes (usually `":p"`) | List item — children are blocks, not inline |
| `":blockquote"` | block nodes | Blockquote |
| `":code-block"` | single text leaf | Code block — the `s` value is the full code string |
| `":table"` | `":thead"` and/or `":tbody"` | Table — see Table Structure below |
| `":hr"` | *(none)* | Horizontal rule |
| non-keyword array | *(Hob expression)* | Eval block — see Eval Blocks below |

### Examples

```json
[":h2", {"s": "Section Title"}]

[":ul",
  [":li", [":p", {"s": "First item"}]],
  [":li", [":p", {"s": "Second item"}]]
]

[":code-block", {"s": "const x = 1;\nconsole.log(x);"}]

[":blockquote", [":p", {"s": "A quoted passage."}]]
```

## Inline Nodes

Inline nodes appear as children of leaf block nodes (`:p`, `:h1`–`:h6`, `:th`, `:td`).

| Tag | Shape | Renders as |
|-----|-------|-----------|
| `":strong"` | `[":strong", {"s": "text"}]` | **Bold** |
| `":em"` | `[":em", {"s": "text"}]` | *Italic* |
| `":code"` | `[":code", {"s": "text"}]` | `Inline code` |
| `":s"` | `[":s", {"s": "text"}]` | ~~Strikethrough~~ |
| `":mark"` | `[":mark", {"s": "text"}]` | ==Highlight== |
| `":item-ref"` | `[":item-ref", {"s": "guid"}, {"s": "display"}]` | Clickable item link |
| `":link"` | `[":link", {"s": "url"}, {"s": "display"}]` | External hyperlink |
| `":field-ref"` | `[":field-ref", {"s": "field-name"}]` | `{{field-name}}` — inline field value |
| `":transclusion"` | `[":transclusion", "item-id", "field-name", "display"]` | Embedded field from another item |

**Note:** `:item-ref` and `:link` use `{"s": "..."}` objects for their arguments. `:transclusion` uses **raw strings**, not `{s:}` objects.

### Examples

```json
[":p",
  {"s": "See "},
  [":item-ref", {"s": "c0c0c0c0-0003-0000-0000-000000000000"}, {"s": "Navigation"}],
  {"s": " for details."}
]

[":p",
  {"s": "This is "},
  [":strong", {"s": "important"}],
  {"s": " and "},
  [":em", {"s": "nuanced"}],
  {"s": "."}
]

[":p",
  [":link", {"s": "https://example.com"}, {"s": "Example"}]
]
```

## Table Structure

Tables nest as: `:table` → `:thead`/`:tbody` → `:tr` → `:th`/`:td` → inline content.

```json
[":table",
  [":thead",
    [":tr",
      [":th", {"s": "Column A"}],
      [":th", {"s": "Column B"}]
    ]
  ],
  [":tbody",
    [":tr",
      [":td", {"s": "Cell 1"}],
      [":td", {"s": "Cell 2"}]
    ],
    [":tr",
      [":td", {"s": "Cell 3"}],
      [":td", [":strong", {"s": "Bold cell"}]]
    ]
  ]
]
```

## Special Nodes

### `:item-ref` (inline)
```json
[":item-ref", {"s": "<item-guid>"}, {"s": "Display Text"}]
```
The display text is optional — if omitted the renderer falls back to the item name fetched at render time. Inserted by the editor when typing `@`.

### `:transclusion` (inline)
```json
[":transclusion", "<item-id>", "<field-name>", "<display-text>"]
```
Arguments are **plain strings**, not `{s:}` objects. Inserted by `@@` in the editor. At render time the renderer calls `get-field` on the referenced item and field and renders the result inline. Reactive: re-renders when the referenced item changes.

### `:field-ref` (inline)
```json
[":field-ref", {"s": "field-name"}]
```
References a field on the *current* item (`:self`). Inserted by `{{` in the editor. Renders as `{{field-name}}` and evaluates at render time.

### Eval Blocks (block-level)
A non-keyword array (first element does not start with `:`) is a Hob expression embedded as a block:
```json
["some-hob-fn", {"s": "arg"}]
```
Evaluated at render time by the doc renderer. Used for dynamic computed content.

## Programmatic Construction

### Building a document in JS

```javascript
function makeDoc(...blocks) {
  return [':doc', ...blocks];
}

function p(...children) {
  return [':p', ...children];
}

function text(s) {
  return { s };
}

function h2(s) {
  return [':h2', { s }];
}

function itemRef(guid, display) {
  return [':item-ref', { s: guid }, { s: display }];
}

// Usage
const doc = makeDoc(
  h2('My Heading'),
  p(text('Hello '), itemRef('some-guid', 'Some Item'), text('.')),
  [':code-block', { s: 'const x = 1;' }]
);
```

### Reading text from a document (JS)

```javascript
function extractText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'object' && !Array.isArray(node)) return node.s || '';
  if (Array.isArray(node)) return node.slice(1).map(extractText).join('');
  return '';
}

const text = extractText(item.content.description);
```

### Checking if a field is Active Text

```javascript
function isActiveText(value) {
  return Array.isArray(value) && value[0] === ':doc';
}
```

## Rendering

Use the field-view items to render Active Text to DOM — don't hand-roll a renderer:

```javascript
// Readonly
const fv = await api.require('field-view-doc-readonly');
const el = await fv.render(item.content.description, { mode: 'readonly' }, api);

// Editable
const fv = await api.require('field-view-doc-editable');
const el = await fv.render(item.content.description, {
  mode: 'editable',
  onChange: (newAst) => { /* save */ }
}, api);
```

In Hob views, use `(require "field-view-doc-editable")` and call `.render`.
