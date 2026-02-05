# Tags and Classification

**Last Updated:** 2026-02-04

---

## Overview

Tags provide a flexible, user-defined mechanism for organizing and finding items. Unlike relationships (which have semantic meaning), tags are classification metadata - ways of grouping items by topic, status, priority, or any other dimension the user finds useful.

---

## Terminology: `attachments` vs `parent`

Hobson items have two distinct hierarchical concepts that should not be confused:

| Property | Location | Purpose | Example |
|----------|----------|---------|---------|
| `attachments` | Top-level array | Compositional - items composed into this item's view | Windows on a spatial canvas, sections in a document |
| `parent` | `content.parent` | Taxonomical - where this item sits in a classification tree | "hobson" → "projects" → "work" |

These are intentionally asymmetric terms. `attachments` suggests physical composition ("I've attached the contact details to the meeting note"), while `parent` indicates tree hierarchy.

**They are not inverses.** An item's `attachments` are things displayed within it. An item's `parent` is its position in a taxonomy. An item can have both, neither, or either independently.

---

## Core Design Decisions

### Any Item Can Be a Tag

There is no dedicated "tag type". Any item can be used as a tag by placing its ID in another item's `tags` array.

```javascript
// A note about Hobson
{
  id: "hobson-note",
  type: "note",
  content: {
    description: "# Hobson\n\nHobson is a personal information system..."
  }
}

// Another note tagged with the Hobson note
{
  id: "architecture-note",
  type: "note",
  content: {
    description: "# Architecture decisions\n\n...",
    tags: ["hobson-note"]
  }
}
```

**Why no dedicated tag type?**

- **Philosophical consistency:** "Everything is an item" - tags shouldn't be special
- **No duplication:** You don't create "Hobson the note" AND "Hobson the tag"
- **Reduced mental overhead:** One concept instead of two parallel structures
- **Natural evolution:** An item can become a tag organically through usage

### Lightweight Labels

For pure classification markers like "urgent", "draft", "bug" - create minimal notes with only a description:

```javascript
{
  id: "urgent-label",
  type: "note",
  content: {
    description: "Applied to items requiring immediate attention"
  }
}
```

These are just notes with minimal content. No special treatment required.

### Tags Referenced in Arrays

Items reference tags via ID arrays in their content:

```javascript
{
  id: "note-123",
  type: "note",
  content: {
    description: "# Meeting Notes\n\n...",
    tags: ["hobson-note", "urgent-label", "work-note"]
  }
}
```

**Not via relationship items:**

```javascript
// We DON'T do this:
{
  id: "rel-456",
  type: "relationship",
  content: {
    from: "note-123",
    to: "hobson-note",
    type: "tagged_with"
  }
}
```

### Tags vs Relationships

**Use tags for:**
- Classification ("work", "urgent", "personal")
- Topics and categories
- Status markers
- Any grouping where the relationship type doesn't add meaning

**Use relationship items for:**
- Semantic connections ("argues against", "inspired by", "follows from")
- Connections that need their own metadata (when established, confidence level)
- Multiple relationship types between same items

**The key distinction:**

In "Note A is tagged with Work", the "is tagged with" part is grammatical scaffolding. The information is "Work."

In "Note A follows from Note B", the "follows from" part carries semantic meaning. You might query "what follows from X?"

---

## Universal Tags

Tags can be applied to ANY item type, not just notes:

```javascript
// Note with tags
{
  type: "note",
  content: {
    description: "...",
    tags: ["hobson-note", "urgent-label"]
  }
}

// Renderer with tags
{
  type: "renderer",
  content: {
    description: "Renders note items with markdown",
    code: "...",
    tags: ["experimental-label", "ui-note"]
  }
}

// Container with tags
{
  type: "container",
  content: {
    description: "Development workspace",
    tags: ["work-note", "archive-label"]
  }
}
```

**Why universal?**

1. **Philosophical consistency** - "Everything is an item" suggests everything should be taggable
2. **Cross-cutting queries** - "Show me everything tagged 'urgent'" regardless of type
3. **Simpler mental model** - One tagging system, works everywhere
4. **No kernel changes** - `content.tags` is just a convention, kernel doesn't care
5. **Future-proofing** - Don't close doors for future use cases

---

## Hierarchical Organization

Any item can have an optional `parent` property for hierarchical organization:

```javascript
// Top-level category
{
  id: "work-note",
  type: "note",
  content: {
    description: "Work-related items",
    parent: null
  }
}

// Sub-category
{
  id: "projects-note",
  type: "note",
  content: {
    description: "Project-related items",
    parent: "work-note"
  }
}

// Specific project
{
  id: "hobson-note",
  type: "note",
  content: {
    description: "# Hobson\n\nHobson is a personal information system...",
    parent: "projects-note"
  }
}
```

**Path construction:**

Walk up parent chain to build full path: "work → projects → hobson"

**Display in tag browser:**
```
▼ work
  ▼ projects
    • hobson
    • other-project
  • meetings
▼ personal
  • journal
  • health
```

**Tagging semantics:**

When you tag a note with "hobson", does it automatically inherit "projects" and "work"? Two approaches:

**Option A: Explicit only**
- Note tagged with "hobson" is ONLY tagged with "hobson"
- To find all work items, you must search descendants

**Option B: Implicit inheritance**
- Note tagged with "hobson" is implicitly tagged with "projects" and "work"
- Simpler queries, but changes tag semantics

**Decision:** Start with Option A (explicit only). Add inheritance queries later if needed. Keeps data model simple.

---

## Tag Browser

A specialized item type that displays items used as tags and enables tag-based navigation.

### Tag Discovery Algorithm

The tag browser discovers tags by scanning usage:

1. Scan all items, collect IDs that appear in any `tags` array
2. For each collected ID, walk up its `parent` chain
3. Include all ancestors in the tree (even if not directly used as tags)
4. Render as tree structure

**Example:**

```javascript
// Only hobson-note is used as a tag
{ id: "some-note", content: { tags: ["hobson-note"] } }

// But hobson-note has ancestors
{ id: "hobson-note", content: { parent: "projects-note" } }
{ id: "projects-note", content: { parent: "work-note" } }
{ id: "work-note", content: { parent: null } }
```

Tag browser shows:
```
work-note
└── projects-note
    └── hobson-note
```

Even though only `hobson-note` is actually used as a tag, the full ancestry is displayed for context.

### Tag Browser Renderer

```javascript
export async function render(browser, api) {
  // 1. Find all items used as tags
  const allItems = await api.getAll();
  const usedAsTag = new Set();
  
  allItems.forEach(item => {
    (item.content?.tags || []).forEach(tagId => usedAsTag.add(tagId));
  });
  
  // 2. Walk up parent chains to include ancestors
  const toInclude = new Set(usedAsTag);
  
  for (const tagId of usedAsTag) {
    let current = await api.get(tagId);
    while (current?.content?.parent) {
      toInclude.add(current.content.parent);
      current = await api.get(current.content.parent);
    }
  }
  
  // 3. Fetch all items to include
  const tagItems = await Promise.all(
    [...toInclude].map(id => api.get(id))
  );
  
  // 4. Build tree from parent relationships
  const tree = buildTree(tagItems);
  
  // 5. Render tree with click handlers
  return renderTree(tree, async (tagId) => {
    const tagged = allItems.filter(item => 
      item.content?.tags?.includes(tagId)
    );
    
    for (const item of tagged) {
      await api.openSibling(item.id);
    }
  });
}
```

### Tag Browser Interactions

When user clicks a tag:

**Option A: Direct manipulation**
- All non-matching windows close
- Matching windows open
- Canvas actively reshapes

**Option B: Results list**
- Show list of matching items below tree
- Click item to open as window
- Canvas unchanged until explicit action

**Option C: Visual indicators**
- Matching windows highlight
- Non-matching windows dim
- Canvas structure preserved

**Current thinking:** Option B (results list) is simplest and least surprising.

---

## Note Search

Complementary to tag browsing - find items by text content:

```javascript
{
  id: "my_note_search",
  type: "note_search_type",
  content: {
    description: "Search all items by text content",
    target_container: null  // If specified, only search within this container
  }
}
```

### Tag + Search Integration

Tag browser and search can work together:

- Filter by tag, then search within tagged items
- Search for text, then filter results by tag
- Combine: "Show work items containing 'deadline'"

---

## Tag Editing UI

Items need UI to add/remove tags.

### Tag Picker

The tag picker shows all items (not just a specific type). User selects items to add to the `tags` array.

Implementation can filter or search to help find items quickly.

### Inline Tag Editor

Tags displayed as pills in item display:
```
[hobson] [urgent] [work] [+]
```

Click [+] to add tag (opens picker), click [x] on pill to remove.

---

## Queries

### Find Items by Tag

```javascript
// Simple
const items = await api.getAll();
const tagged = items.filter(item => 
  item.content?.tags?.includes(tagId)
);

// With type filter
const notes = await api.query({ type: NOTE_TYPE });
const taggedNotes = notes.filter(n => 
  n.content?.tags?.includes(tagId)
);

// Multiple tags (AND)
const bothTags = items.filter(item =>
  item.content?.tags?.includes(tag1) &&
  item.content?.tags?.includes(tag2)
);

// Multiple tags (OR)
const eitherTag = items.filter(item =>
  item.content?.tags?.includes(tag1) ||
  item.content?.tags?.includes(tag2)
);
```

### Find Items Used as Tags

```javascript
// All items used as tags in system
const items = await api.getAll();
const tagIds = new Set(items.flatMap(i => i.content?.tags || []));
const tags = await Promise.all([...tagIds].map(id => api.get(id)));

// Most frequently used tags
const tagCounts = {};
items.forEach(item => {
  (item.content?.tags || []).forEach(tagId => {
    tagCounts[tagId] = (tagCounts[tagId] || 0) + 1;
  });
});
const sorted = Object.entries(tagCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([tagId, count]) => ({ tagId, count }));
```

### Hierarchical Queries

```javascript
// Find all descendants of an item (by parent chain)
async function getDescendants(itemId) {
  const allItems = await api.getAll();
  const descendants = [];
  
  const findChildren = (parentId) => {
    const children = allItems.filter(i => i.content?.parent === parentId);
    children.forEach(child => {
      descendants.push(child.id);
      findChildren(child.id);  // Recursive
    });
  };
  
  findChildren(itemId);
  return descendants;
}

// Find items tagged with item OR any descendant
const tagIds = [itemId, ...(await getDescendants(itemId))];
const items = await api.getAll();
const matches = items.filter(item =>
  item.content?.tags?.some(t => tagIds.includes(t))
);
```

---

## Design Rationale

### Why No Dedicated Tag Type?

**Considered:** Dedicated "tag" type for classification items.

**Rejected:**
- Creates artificial distinction between "content items" and "classification items"
- Forces duplication when you want "Hobson the note" and "Hobson the tag"
- Increases mental overhead maintaining parallel structures
- Violates "everything is just an item" philosophy

**Accepted:** Any item can be used as a tag. Tag browser discovers tags by scanning usage.

### Why Not Relationships for Tags?

**Considered:** Using relationship items for tagging.

**Rejected:** 
- Creates proliferation of relationship items (one per tag per item)
- Queries become complex (filter relationship items, then fetch targets)
- "Tagged with" relationship doesn't add semantic value
- Inconsistent with `attachments` array pattern (which also uses direct references)

**When to use relationships:** When the connection itself has meaning ("argues against", "inspired by") or needs metadata.

### Why Walk Parent Chains in Tag Browser?

**Considered:** Only show items directly used as tags.

**Rejected:**
- Produces flat list with no hierarchy context
- User can't see organizational structure

**Accepted:** Walk parent chains to include ancestors, providing full tree context even if ancestors aren't directly used as tags.

---

## Cross-References

- For container composition patterns, see Spatial_Windowing.md
- For generic item editor (which will handle tag editing), see Future_Directions.md
- For current implementation status, see Design_Decisions_Log.md
- For the description property design, see Description_Property_Design.md
