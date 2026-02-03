# Symbol Indexing System Design

*Decision Date: 2026-02-03*

---

## Problem Statement

When documenting Hobson within Hobson, it's awkward to reference specific code constructs. Current capabilities:

- `item://UUID#code?lines=10-20` — fragile, breaks when code changes
- `item://UUID#code?region=name` — requires manual `[BEGIN:name]`/`[END:name]` markers around every function

The specific pain point: wanting to mention `api.getAll()` in documentation and link to its definition. The function is one line inside `createREPLAPI`, which in turn calls kernel code. Wrapping every API function in region markers is excessive.

**Desired**: A way to reference named code constructs (functions, methods, properties) that survives refactoring and requires no manual annotation.

---

## Design Decisions

### 1. Symbol-based URL Addressing

Extend the `item://` URL scheme with a `symbol` parameter:

```
item://UUID#code?symbol=getAll
item://UUID#code?symbol=createREPLAPI.getAll
```

The qualified form (`parent.child`) handles disambiguation when the same name appears multiple times.

### 2. Metadata-based Index (Option 4)

Rather than parsing on each render, store extracted symbols as item metadata:

```javascript
content: {
  code: "...",
  _symbols: {
    "getAll": { line: 42, col: 8, kind: "property", scope: "createREPLAPI" },
    "createREPLAPI": { line: 10, col: 2, kind: "function", scope: null }
  }
}
```

**Rationale**: Identical parsing work to on-demand resolution, but enables future features:
- Find all references (query metadata across items, not re-parse everything)
- Go to definition (click identifier → jump to definition)
- Symbol search ("show all items defining `render`")

### 3. User-Space Implementation

The indexer runs as a **declarative watch handler** responding to `item:saved` events, not kernel code.

**Rationale**: 
- Follows the error handling pattern (kernel emits events, user code responds)
- Indexing logic is inspectable and modifiable
- Can be disabled/replaced by user
- Keeps kernel minimal

### 4. Acorn for Parsing

Use the Acorn JavaScript parser (~50KB) rather than regex or CodeMirror tokens.

**Rationale**:
- Accurate AST parsing handles all syntax correctly
- CodeMirror 5's tokenizer doesn't provide structure, just a flat token stream
- Acorn is battle-tested and handles modern JS (ES2024)
- One-time cost, enables robust future features

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Action                          │
│                    (save a code item)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Kernel: saveItem()                       │
│              Emits 'item:saved' event                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Declarative Watch: symbol-indexer              │
│  - Checks if item is a code item                            │
│  - Parses code with Acorn                                   │
│  - Extracts symbol definitions                              │
│  - Updates item._symbols metadata                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Render-time Resolution                    │
│  - Markdown renderer sees ?symbol=X                         │
│  - Looks up in item.content._symbols                        │
│  - Navigates to line/col                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Add Acorn Library

**Task 1.1**: Download Acorn and add as a code item

Download from: `https://cdn.jsdelivr.net/npm/acorn@8/dist/acorn.min.js`

Create item:
- name: `acorn`
- type: code (library)
- content.code: the minified source

**Task 1.2**: Create Acorn wrapper for ES module export

```javascript
// acorn-wrapper
const acorn = window.acorn;
delete window.acorn;
export default acorn;
export const parse = acorn.parse;
export const tokenizer = acorn.tokenizer;
```

### Phase 2: Symbol Extraction Library

**Task 2.1**: Create `symbol-extractor-lib` code item

```javascript
// symbol-extractor-lib
// Extracts symbol definitions from JavaScript code using Acorn

export async function extractSymbols(code, api) {
  const acorn = await api.require('acorn-wrapper');

  let ast;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,  // We need line/column info
      allowReturnOutsideFunction: true,  // For REPL-style code
    });
  } catch (e) {
    // Parse error - return empty symbols rather than failing
    console.warn('Symbol extraction parse error:', e.message);
    return {};
  }

  const symbols = {};

  // Walk the AST
  walkNode(ast, null, symbols);

  return symbols;
}

function walkNode(node, scope, symbols) {
  if (!node || typeof node !== 'object') return;

  switch (node.type) {
    case 'FunctionDeclaration':
      if (node.id?.name) {
        addSymbol(symbols, node.id.name, node.loc, 'function', scope);
        // Walk body with this function as scope
        walkNode(node.body, node.id.name, symbols);
      }
      break;

    case 'VariableDeclaration':
      for (const decl of node.declarations) {
        if (decl.id?.name) {
          const kind = decl.init?.type === 'ArrowFunctionExpression' ||
                       decl.init?.type === 'FunctionExpression'
            ? 'function' : 'variable';
          addSymbol(symbols, decl.id.name, decl.loc, kind, scope);

          if (decl.init) {
            const initScope = decl.id.name;
            if (decl.init.body) {
              // Arrow function / function expression body
              walkNode(decl.init.body, initScope, symbols);
            } else if (decl.init.type === 'ObjectExpression') {
              // Object literal - walk properties with variable as scope
              walkNode(decl.init, initScope, symbols);
            }
          }
        }
      }
      break;

    case 'ClassDeclaration':
      if (node.id?.name) {
        addSymbol(symbols, node.id.name, node.loc, 'class', scope);
        walkNode(node.body, node.id.name, symbols);
      }
      break;

    case 'MethodDefinition':
      if (node.key?.name) {
        addSymbol(symbols, node.key.name, node.loc, 'method', scope);
        walkNode(node.value?.body, `${scope}.${node.key.name}`, symbols);
      }
      break;

    case 'PropertyDefinition':
      // Class fields: class Foo { bar = () => {} }
      if (node.key?.name) {
        const kind = node.value?.type === 'FunctionExpression' ||
                     node.value?.type === 'ArrowFunctionExpression'
          ? 'field-function' : 'field';
        addSymbol(symbols, node.key.name, node.loc, kind, scope);

        if (node.value?.body) {
          const newScope = scope ? `${scope}.${node.key.name}` : node.key.name;
          walkNode(node.value.body, newScope, symbols);
        }
      }
      break;

    case 'Property':
      // Object literal properties: { foo: ..., bar() {} }
      if (node.key?.name) {
        const kind = node.value?.type === 'FunctionExpression' ||
                     node.value?.type === 'ArrowFunctionExpression' ||
                     node.method
          ? 'property-function' : 'property';
        addSymbol(symbols, node.key.name, node.loc, kind, scope);

        const newScope = scope ? `${scope}.${node.key.name}` : node.key.name;

        if (node.value?.body) {
          // Function property - walk its body
          walkNode(node.value.body, newScope, symbols);
        } else if (node.value?.type === 'ObjectExpression') {
          // Nested object literal
          walkNode(node.value, newScope, symbols);
        }
      }
      break;

    case 'ExportNamedDeclaration':
      if (node.declaration) {
        walkNode(node.declaration, scope, symbols);
      }
      break;

    case 'ExportDefaultDeclaration':
      if (node.declaration) {
        // For `export default function foo()`, capture foo
        walkNode(node.declaration, scope, symbols);
      }
      break;

    default:
      // Recursively walk all child nodes
      for (const key of Object.keys(node)) {
        if (key === 'loc' || key === 'range') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          for (const c of child) {
            walkNode(c, scope, symbols);
          }
        } else if (child && typeof child === 'object' && child.type) {
          walkNode(child, scope, symbols);
        }
      }
  }
}

function addSymbol(symbols, name, loc, kind, scope) {
  // Key is just the name; scope is stored as metadata for disambiguation
  const key = scope ? `${scope}.${name}` : name;
  symbols[key] = {
    name,
    line: loc.start.line,
    col: loc.start.column,
    endLine: loc.end.line,
    endCol: loc.end.column,
    kind,
    scope: scope || null
  };
}
```

### Phase 3: Symbol Indexer Watch

**Task 3.1**: Create `symbol-indexer-watch` item

```javascript
// Declarative watch that indexes symbols in code items on save

export const watch = {
  event: 'item:saved',
  
  async handler(event, api) {
    const { item } = event;
    
    // Only process code items
    const isCode = await api.typeChainIncludes(item.type, api.IDS.CODE);
    if (!isCode) return;
    
    // Only process items with code content
    const code = item.content?.code;
    if (!code || typeof code !== 'string') return;
    
    // Extract symbols
    const extractor = await api.require('symbol-extractor-lib');
    const symbols = await extractor.extractSymbols(code, api);
    
    // Check if symbols changed (avoid unnecessary saves)
    const existingSymbols = item.content._symbols || {};
    if (JSON.stringify(symbols) === JSON.stringify(existingSymbols)) {
      return; // No change
    }
    
    // Update item with new symbols
    // Use api.set to avoid triggering another item:saved event loop
    // (The kernel should dedupe or the watch system should prevent recursion)
    item.content._symbols = symbols;
    await api.set(item);
    
    console.log(`Indexed ${Object.keys(symbols).length} symbols in ${item.name || item.id}`);
  }
};
```

**Task 3.2**: Register the watch

Add to the watches collection (however that's currently structured in your system).

### Phase 4: URL Resolution in Markdown Renderer

**Task 4.1**: Update `parseItemUrl` to handle symbol parameter

In `field_view_markdown_readonly`:

```javascript
const parseItemUrl = (url) => {
  const match = url.match(/item:\/\/([a-f0-9\-]+)(?:#([^?]+))?(?:\?(.+))?/);
  if (!match) return null;
  const itemId = match[1];
  const fragment = match[2] || null;
  const queryString = match[3] || null;
  const queryParams = {};
  if (queryString) {
    queryString.split('&').forEach(pair => {
      const [key, val] = pair.split('=');
      queryParams[decodeURIComponent(key)] = decodeURIComponent(val);
    });
  }
  return { itemId, fragment, queryParams };
};
```

**Task 4.2**: Add symbol resolution logic

When processing a transclusion or link with `?symbol=`:

```javascript
if (parsed.queryParams.symbol) {
  const symbolName = parsed.queryParams.symbol;
  const symbols = transcludedItem.content?._symbols || {};
  
  // Try exact match first
  let symbolInfo = symbols[symbolName];
  
  // If not found, try unqualified match (first symbol with that name)
  if (!symbolInfo) {
    for (const [key, info] of Object.entries(symbols)) {
      if (info.name === symbolName) {
        symbolInfo = info;
        break;
      }
    }
  }
  
  if (!symbolInfo) {
    throw new Error(`Symbol not found: ${symbolName}`);
  }
  
  // Use the line/col for navigation or highlighting
  startLine = symbolInfo.line;
  // Could also compute a line range using endLine
}
```

**Task 4.3**: Update code field view for symbol highlighting

The `field_view_code_readonly` already handles `?line=` URL params. Extend to support `?symbol=`:

```javascript
// Check for symbol param
const symbolParam = urlParams.get('symbol');
if (symbolParam && item.content?._symbols) {
  const symbolInfo = item.content._symbols[symbolParam] ||
    Object.values(item.content._symbols).find(s => s.name === symbolParam);
  
  if (symbolInfo) {
    const cmLine = symbolInfo.line - 1;
    cm.scrollIntoView({ line: cmLine, ch: symbolInfo.col }, 100);
    
    // Highlight the symbol's range
    for (let l = symbolInfo.line - 1; l < symbolInfo.endLine; l++) {
      cm.addLineClass(l, 'background', 'line-highlight');
    }
  }
}
```

### Phase 5: Backfill Existing Items

**Task 5.1**: Create a one-time script to index all existing code items

```javascript
// Run in REPL to backfill symbols for all code items
const extractor = await api.require('symbol-extractor-lib');
const codeItems = await api.query({ type: api.IDS.CODE });
// Also get items that inherit from CODE
const allItems = await api.getAll();
let indexed = 0;

for (const item of allItems) {
  const isCode = await api.typeChainIncludes(item.type, api.IDS.CODE);
  if (!isCode || !item.content?.code) continue;
  
  const symbols = await extractor.extractSymbols(item.content.code, api);
  if (Object.keys(symbols).length > 0) {
    item.content._symbols = symbols;
    await api.set(item);
    indexed++;
  }
}

return `Indexed ${indexed} code items`;
```

---

## URL Scheme Summary

| URL | Meaning |
|-----|---------|
| `item://UUID` | Full item transclusion |
| `item://UUID#code` | Code field |
| `item://UUID#code?lines=10-20` | Line range (fragile) |
| `item://UUID#code?region=foo` | Named region |
| `item://UUID#code?symbol=getAll` | Symbol by name |
| `item://UUID#code?symbol=createREPLAPI.getAll` | Qualified symbol |

These can be used in:
- Markdown links: `[getAll](item://UUID#code?symbol=getAll)`
- Transclusions: `![](item://UUID#code?symbol=getAll)` (shows the symbol's code)

---

## Symbol Schema

```typescript
interface SymbolInfo {
  name: string;        // Unqualified name
  line: number;        // 1-based start line
  col: number;         // 0-based start column
  endLine: number;     // 1-based end line
  endCol: number;      // 0-based end column
  kind: SymbolKind;
  scope: string | null; // Parent scope for qualified lookup
  signature?: string;  // Function signature, e.g., "(id, options = ...)"
}

type SymbolKind =
  | 'function'          // function foo() {} or const foo = () => {}
  | 'variable'          // const foo = 123
  | 'class'             // class Foo {}
  | 'method'            // class method: foo() {}
  | 'field'             // class field: foo = 123
  | 'field-function'    // class field: foo = () => {}
  | 'property'          // object property: { foo: 123 }
  | 'property-function' // object method: { foo() {} } or { foo: () => {} }

// Stored as:
content._symbols: {
  [qualifiedName: string]: SymbolInfo
}
```

---

## Known Limitations

The symbol extractor handles common JavaScript patterns but intentionally skips some edge cases:

**Computed property names** — `{ [dynamicKey]: fn }` has no static name to index. Skipped.

**Destructuring declarations** — `const { a, b } = obj` could index `a` and `b` as top-level symbols, but currently doesn't. Add if this pattern is common in the codebase.

**Dynamic patterns** — `obj[key] = value`, `Object.assign()`, `Object.defineProperty()`, etc. These create properties at runtime with no static name. Skipped.

**Re-exports** — `export { foo } from './bar'` doesn't create a new definition, just re-exports. Currently not indexed (the original definition in `./bar` would be).

---

## Future Extensions

### Find All References

With symbols indexed, finding references requires:
1. A separate `_references` index tracking identifier *uses*
2. Cross-item queries: "find all items where `_references` includes X"

This is more complex because you need to resolve what each identifier refers to (scope analysis). Defer until needed.

### Go To Definition

Click on an identifier in code → find which item defines it → navigate there.

Requires:
1. Click handler in CodeMirror that gets the word under cursor
2. Query all items for matching symbol definitions
3. Navigate to the match (or show disambiguation if multiple)

### Symbol Autocomplete

In the link/transclusion picker, offer autocomplete for symbols:
1. User types `item://kernel-core#code?symbol=`
2. System queries `kernel-core.content._symbols`
3. Shows dropdown of available symbols

### Auto-Generated API Documentation

Use query blocks to generate live API reference tables from indexed symbols:

````markdown
```query
const core = await api.get('33333333-1111-0000-0000-000000000000');
const symbols = core.content._symbols || {};

// Filter to REPL API methods (direct children only)
const apiMethods = Object.entries(symbols)
  .filter(([key, info]) => {
    return key.startsWith('Kernel.createREPLAPI.') &&
           key.split('.').length === 3 &&
           info.kind.includes('function');
  })
  .sort((a, b) => a[1].line - b[1].line);

// Generate markdown table with linked method names
let md = '| Method | Signature |\n|--------|----------|\n';
for (const [key, info] of apiMethods) {
  // Put full method name inside the link text to avoid markdown parsing issues
  const link = `[\`api.${info.name}\`](item://33333333-1111-0000-0000-000000000000?symbol=${key})`;
  md += `| ${link} | \`${info.signature || '()'}\` |\n`;
}
return md;
```
````

**Note:** The link must be `[`api.name`](url)` not `` `api.`[name](url) `` — markdown requires `[` to not be preceded by certain characters.

---

## Open Questions

1. **Recursion prevention**: When the indexer updates an item, does that trigger another `item:saved` event? The watch system may need to track "currently handling" to prevent loops, or the indexer can use a lower-level save that doesn't emit.

2. **Non-JavaScript code**: The system is JavaScript-specific. For other languages (CSS, JSON, Markdown), either skip indexing or add language-specific extractors later.

3. **Parse errors**: If code has syntax errors, Acorn will fail. Current design: log warning, return empty symbols. The item remains usable but un-indexed until fixed.

4. **Symbol key collisions**: Two functions with the same qualified name (unlikely but possible with dynamic scopes). Current design: last one wins. Could use array of locations instead.

---

## Implementation Order

1. **Add Acorn** — prerequisite for everything else
2. **Symbol extractor library** — can be tested in REPL immediately
3. **Watch handler** — enables automatic indexing going forward
4. **Backfill script** — index existing code items
5. **Markdown renderer updates** — makes `?symbol=` links work
6. **Code field view updates** — symbol-based highlighting

Phases 1-4 can be done without touching the markdown renderer, allowing incremental testing.
