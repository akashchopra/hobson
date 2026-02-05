# Query-Driven Documentation for Hobson

**Date:** 2026-01-27

---

## Problem Statement

Transclusion enables keeping documentation in sync with actual items (e.g., listing kernel modules and transcluding their descriptions). However, if items are added, removed, or split, the documentation becomes stale. The list must be manually maintained.

**Example:** A document lists each kernel module and transcludes its description. If a new module is added, the document must be manually updated to include it.

---

## Goal

Enable documentation that automatically stays current by querying the item database rather than hardcoding item references.

---

## Solution Options

### Option 1: Query Syntax Extension

Extend transclusion syntax to support inline queries:

```markdown
## Kernel Modules

{{query:type=kernel-module|sort=name}}
```

**How it works:**
- Parser recognizes `{{query:...}}` syntax
- Executes query using existing `api.query()`
- Transcludes specified field from each result (default: `content.description`)
- Renders as list

**Pros:**
- Minimal implementation—reuses existing query infrastructure
- Simple syntax for basic cases
- No new item types needed

**Cons:**
- Syntax could become complex for sophisticated queries
- Limited to `api.query()` capabilities
- Not reusable—must duplicate query logic across documents
- Query logic hidden in document markup

---

### Option 2: Query Items

Create queries as first-class items that can be transcluded:

```javascript
{
  id: "query-kernel-modules",
  type: "query",
  content: {
    description: "All kernel modules sorted by name",
    filter: { type: "kernel-module" },
    sort: "name",
    template: "- **{{name}}**: {{content.description}}"
  }
}
```

Usage in documents:
```markdown
## Kernel Modules

{{transclude:query-kernel-modules}}
```

**How it works:**
- Query renderer executes the query
- Applies sorting/filtering
- Formats results using template
- Returns formatted text for transclusion

**Pros:**
- Queries are reusable items
- Can be tested and refined independently
- Templates provide flexible formatting
- Fits "everything is an item" philosophy
- Queries are discoverable in the system
- Query logic is explicit and editable

**Cons:**
- More implementation work (new type + renderer)
- Requires template expansion mechanism
- Need to decide on template syntax

**Implementation sketch:**

```javascript
// Query renderer
export async function render(item, api) {
  const { filter, sort, template } = item.content;
  
  // Execute query
  let results = await api.query(filter);
  
  // Sort if specified
  if (sort) {
    results.sort((a, b) => 
      a[sort] > b[sort] ? 1 : -1
    );
  }
  
  // Format results
  return results.map(result => 
    template 
      ? expandTemplate(template, result)
      : result.content.description || result.name
  ).join('\n');
}

function expandTemplate(template, item) {
  // Replace {{field}} with item.field
  // Replace {{content.subfield}} with item.content.subfield
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    return getNestedValue(item, path.split('.'));
  });
}
```

---

### Option 3: Inline JS in Markdown (Recommended)

Extend markdown rendering to support executable code blocks:

````markdown
# Kernel Modules

```query
const modules = await api.query({ type: GUIDS.KERNEL_MODULE });
modules.sort((a, b) => a.name.localeCompare(b.name));
return modules.map(m => `- **${m.name}**: ${m.content.description || 'No description'}`).join('\n');
```
````

**How it works:**
- Markdown renderer recognizes ` ```query ` code blocks
- Executes code with `api` in scope
- Takes returned string, parses as markdown
- Inserts rendered result into document

**Transclusion chrome:**

Query results should maintain provenance—each result needs transclusion chrome linking to its source item. This enables navigation from the generated list to the actual items.

Helper API:
```javascript
const modules = await api.query({ type: GUIDS.KERNEL_MODULE });
return api.transcludeEach(modules, m =>
  `- **${m.name}**: ${m.content.description}`
);
```

`api.transcludeEach(items, formatter)` wraps each formatted result with standard transclusion chrome linking to the source item's ID. For single items, `api.transclude(item, content)` provides the same wrapping.

**Pros:**
- Self-contained: document contains its own logic
- Full JS power: no template language to design or outgrow
- Low ceremony: no separate items to create/manage for one-off queries
- Fast iteration: edit query where you see its output
- Still "code as data": code lives in item content

**Cons:**
- Not directly reusable across documents (must copy code)
- Harder to test in isolation
- Blurs line between content and code

---

### Option 4: Live Document Type (Declarative)

Create a document type where content contains declarative query expressions:

```markdown
# Kernel Modules

<query type="kernel-module" sort="name">
- **{name}**: {content.description}
</query>
```

**How it works:**
- Live document renderer parses content
- Recognizes `<query>` blocks
- Executes queries and expands inline
- Renders final document

**Pros:**
- Natural syntax—queries embedded directly in prose
- Documents are self-contained

**Cons:**
- Most complex implementation
- Requires designing a query/template DSL that will inevitably grow
- Query syntax embedded in string content (harder to validate)
- Declarative approaches tend to become unwieldy as requirements expand

---

## Recommendation

**Implement Option 3: Inline JS in Markdown**

### Rationale

1. **Minimal addition**: Solves the immediate documentation need without new item types
2. **Full power**: JS avoids designing a template/query DSL that will inevitably grow unwieldy
3. **Self-contained**: Documents contain their own logic—no hunting for query items
4. **Low ceremony**: Don't need to create, name, and manage separate items for every dynamic section
5. **Fast iteration**: Edit queries right where you see their output

### Why Not Query Items?

Query items (Option 2) have merit—reusability, testability, discoverability. However:

- For the immediate use case (self-documentation), inline is sufficient
- If query duplication becomes a problem, that's the signal to add query items later
- The two approaches aren't mutually exclusive

### Implementation Path

**Phase 1: Core Implementation**
- Extend markdown renderer to recognize ` ```query ` code blocks
- Execute code with `api` in scope (async supported)
- Parse returned string as markdown, insert into document
- Implement `api.transclude(item, content)` and `api.transcludeEach(items, formatter)` helpers for per-result chrome

**Phase 2: Error Handling**
- Graceful failure display (show error in document, don't break render)
- Consider timeout for runaway queries

**Phase 3: Query Items** (future, if needed)
- Add query type for reusable/shared queries
- Transclude query items like any other item
- See "Future Direction" section below

---

## Use Cases

Beyond kernel module documentation, query-driven content enables:

- **Dynamic TOCs**: Tables of contents that update as workspace grows
- **Capability matrices**: "All renderers and what types they support"
- **Tag indices**: "All items tagged with X"
- **Code inventories**: "All library items with their descriptions"
- **Relationship maps**: "All items linking to this item"
- **Status dashboards**: "Incomplete items by type"

---

## Future Direction: Editor-Mediated Unification

The distinction between "inline code" and "query items" rests on a misconception about editors.

### The Insight

An editor's job is to make it easy to achieve a goal, not to expose the underlying data model. The choice between inline and referenced is an **implementation detail** that a good editor should hide.

Consider: when you select "insert query" in a document, the editor could:
1. Create a query item behind the scenes
2. Display it inline (transcluded in edit mode)
3. Let you edit as if it were inline code

The user experiences inline editing. The data model stays clean (queries are always items). Reusability comes free (the item exists, can be referenced elsewhere).

### Implications

This dissolves the inline-vs-referenced debate entirely:
- **Data model**: Queries are always items ("everything is an item" holds)
- **Editing experience**: Feels inline, fluid, low-friction
- **Reusability**: Automatic—items exist, can be referenced

### Broader Principle

The editor is a **lens**, not a 1:1 representation of the data model. This suggests:
- **Item-first data model**: Clean, principled, REPL-friendly
- **UI-first editing experience**: Fluent views that hide the seams

This connects to the REPL-first vs UI-first tension. The answer may be: both. The REPL manipulates items directly; the UI provides seamless editing over them.

### For Now

Inline JS is the pragmatic starting point. When a "transclude-in-edit-mode" editor exists, inline blocks could migrate to proper query items seamlessly—or both syntaxes could coexist, since inline remains useful for truly ephemeral cases.

---

## Alignment with Principles

**Humane Dozen:**
- **Self-revealing**: System presents current state, doesn't require manual maintenance
- **Alive with your data**: Documentation reflects live system state

**Itemized OS:**
- Everything queryable
- Items as unit of composition
- System describes itself

**Smalltalk/Live Environment:**
- Introspection built-in
- System constantly reflecting its own state
