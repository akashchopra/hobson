# Tags and Classification

**Last Updated:** 2026-01-13

---

## Overview

Tags provide a flexible, user-defined taxonomy for organizing and finding items. Unlike relationships (which have semantic meaning), tags are classification metadata - ways of grouping items by topic, status, priority, or any other dimension the user finds useful.

---

## Core Design Decisions

### Tags are Items

Tags are first-class items in the system, not just strings:
```javascript
{
  id: "tag-work",
  type: "tag_type_id",
  name: "work",
  content: {
    name: "work",
    color: "#3b82f6",
    description: "Work-related items",
    parent: null  // or parent tag ID for hierarchy
  }
}
```

**Why tags as items?**

- Central definition (one place to edit name, color, description)
- Can have properties (color, icon, metadata)
- Support hierarchy (parent references)
- Can be queried, rendered, edited like any item
- Consistent with "everything is an item" philosophy

### Tags Referenced in Arrays

Items reference tags via ID arrays in their content:
```javascript
{
  id: "note-123",
  type: "note",
  content: {
    text: "# Meeting Notes",
    tags: ["tag-work", "tag-urgent", "tag-projects"]
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
    to: "tag-work",
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
    text: "...",
    tags: ["tag-work", "tag-urgent"]
  }
}

// Renderer with tags
{
  type: "renderer",
  content: {
    code: "...",
    tags: ["tag-experimental", "tag-ui"]
  }
}

// Container with tags
{
  type: "container",
  content: {
    title: "My Workspace",
    tags: ["tag-work", "tag-archive"]
  }
}
```

**Why universal?**

1. **Philosophical consistency** - "Everything is an item" suggests everything should be taggable
2. **Cross-cutting queries** - "Show me everything tagged 'urgent'" regardless of type
3. **Simpler mental model** - One tagging system, works everywhere
4. **No kernel changes** - `content.tags` is just a convention, kernel doesn't care
5. **Future-proofing** - Don't close doors for future use cases

**Usage patterns:**

- **Power users** - Tag code items, renderers, types
- **Regular users** - Tag notes, documents, high-level items
- **Cross-type queries** - "Show all work-related items" includes notes AND code AND containers

---

## Hierarchical Tags

Tags can form hierarchies via parent references:
```javascript
// Parent tag
{
  id: "tag-work",
  content: {
    name: "work",
    parent: null
  }
}

// Child tag
{
  id: "tag-projects",
  content: {
    name: "projects",
    parent: "tag-work"
  }
}

// Grandchild tag
{
  id: "tag-hobson",
  content: {
    name: "hobson",
    parent: "tag-projects"
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

**Recommendation:** Start with Option A (explicit only). Add inheritance queries later if needed. Keeps data model simple.

---

## Tag Browser

A specialized item type that displays the tag hierarchy and enables tag-based navigation.

### Tag Browser Structure
```javascript
{
  id: "my_tag_browser",
  type: "tag_browser_type",
  content: {
    title: "Browse by Tag",
    target_container: null  // If specified, only show tags from this container's items
  }
}
```

### Tag Browser Renderer

The tag browser renderer:

1. Queries all tag items
2. Builds hierarchy from parent relationships
3. Renders as expandable tree
4. Clicking a tag shows matching items
```javascript
export async function render(browser, api) {
  // Query all tags
  const tags = await api.query({ type: TAG_TYPE_ID });
  
  // Build tree from parent relationships
  const tree = buildTagTree(tags);
  
  // Render tree with click handlers
  return renderTree(tree, async (tagId) => {
    // Find items with this tag
    const allItems = await api.getAll();
    const tagged = allItems.filter(item => 
      item.content.tags?.includes(tagId)
    );
    
    // Open them as sibling windows
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
    title: "Search Notes",
    target_container: null  // If specified, only search within this container
  }
}
```

### Search Renderer
```javascript
export async function render(search, api) {
  const input = api.createElement('input', {
    type: 'text',
    placeholder: 'Search...',
    oninput: async (e) => {
      const query = e.target.value.toLowerCase();
      if (!query) {
        results.innerHTML = '';
        return;
      }
      
      // Search across all items
      const allItems = await api.getAll();
      const matches = allItems.filter(item => {
        const content = JSON.stringify(item.content).toLowerCase();
        return content.includes(query);
      });
      
      // Display results
      renderResults(matches, results);
    }
  });
  
  const results = api.createElement('div', { class: 'search-results' }, []);
  
  return api.createElement('div', {}, [input, results]);
}
```

### Tag + Search Integration

Tag browser and search can work together:

- Filter by tag, then search within tagged items
- Search for text, then filter results by tag
- Combine: "Show work items containing 'deadline'"

---

## "My Notes" Container

Combining tag browser + search + notes in a container creates a complete note-taking app:
```javascript
{
  id: "my_notes",
  type: "container",
  content: {
    title: "My Notes"
  },
  children: [
    {
      id: "tag-browser-instance",
      x: 0, y: 0, width: 250, height: 600, z: 0
    },
    {
      id: "search-instance",
      x: 260, y: 0, width: 540, height: 100, z: 0
    }
    // Note windows open below/beside these
  ]
}
```

Add "New Note" button to search renderer → complete note-taking workflow.

---

## Tag Creation Workflows

### Explicit Creation (MVP)

User creates tag items manually:
```javascript
// Via REPL
await api.set({
  id: crypto.randomUUID(),
  type: TAG_TYPE_ID,
  created: Date.now(),
  modified: Date.now(),
  content: {
    name: "work",
    parent: null
  }
});
```

Or via "New Item" button selecting tag type.

### Implicit Creation (Future)

Type unknown tag in note tag field → system auto-creates tag item:
```javascript
// User types "work/projects/hobson" in tag field
// System creates three tag items if they don't exist:
// - work
// - projects (parent: work)
// - hobson (parent: projects)
```

**Why defer implicit creation?**

- Explicit is simpler to implement
- Proves the concept first
- Implicit can be added later when workflow proves valuable

---

## Tag Editing UI

Notes need UI to add/remove tags. Several approaches:

### Text Field (MVP)

Simple comma-separated list of tag IDs:
```
Tags: tag-work, tag-urgent, tag-projects
```

User must know tag IDs. Functional but not elegant.

### Tag Selector Widget

Visual selector showing available tags:

- List of all tags with checkboxes
- Or dropdown with search
- Or pills with remove button + add button

This becomes a **field editor** for the generic item editor (see Future_Directions.md).

### Inline Tag Editor

Tags displayed as pills in note display:
```
[work] [urgent] [projects] [+]
```

Click [+] to add tag, click [x] on pill to remove.

---

## Queries

### Find Items by Tag
```javascript
// Simple
const items = await api.getAll();
const tagged = items.filter(item => 
  item.content.tags?.includes(tagId)
);

// With type filter
const notes = await api.query({ type: NOTE_TYPE });
const taggedNotes = notes.filter(n => 
  n.content.tags?.includes(tagId)
);

// Multiple tags (AND)
const bothTags = items.filter(item =>
  item.content.tags?.includes(tag1) &&
  item.content.tags?.includes(tag2)
);

// Multiple tags (OR)
const eitherTag = items.filter(item =>
  item.content.tags?.includes(tag1) ||
  item.content.tags?.includes(tag2)
);
```

### Find Tags by Usage
```javascript
// All tags used in system
const items = await api.getAll();
const tagIds = new Set(items.flatMap(i => i.content.tags || []));
const tags = await Promise.all([...tagIds].map(id => api.get(id)));

// Most frequently used tags
const tagCounts = {};
items.forEach(item => {
  (item.content.tags || []).forEach(tagId => {
    tagCounts[tagId] = (tagCounts[tagId] || 0) + 1;
  });
});
const sorted = Object.entries(tagCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([tagId, count]) => ({ tagId, count }));
```

### Hierarchical Queries
```javascript
// Find all descendants of a tag
async function getTagDescendants(tagId) {
  const allTags = await api.query({ type: TAG_TYPE });
  const descendants = [];
  
  const findChildren = (parentId) => {
    const children = allTags.filter(t => t.content.parent === parentId);
    children.forEach(child => {
      descendants.push(child.id);
      findChildren(child.id);  // Recursive
    });
  };
  
  findChildren(tagId);
  return descendants;
}

// Find items tagged with tag OR any descendant
const tagIds = [tagId, ...(await getTagDescendants(tagId))];
const items = await api.getAll();
const matches = items.filter(item =>
  item.content.tags?.some(t => tagIds.includes(t))
);
```

---

## Implementation Plan

### Phase 1: Basic Tags (Week 1-2)

1. **Create tag type and seed items**
   - Tag type definition
   - Maybe a few default tags

2. **Add tags to notes**
   - Modify note renderer to show/edit tags
   - Simple text field (comma-separated IDs)

3. **Build tag browser**
   - New item type + renderer
   - Query all tags, display as flat list
   - Click tag → log matching items to console

4. **Open matching items**
   - Tag browser calls `api.openSibling()` to open notes as windows
   - Prove the concept works end-to-end

### Phase 2: Hierarchy and Search (Week 3)

5. **Add hierarchy to tags**
   - Parent references in tag items
   - Tag browser renders as tree
   - Expand/collapse branches

6. **Build note search**
   - New item type + renderer
   - Text input + results list
   - Open items as sibling windows

7. **Create "My Notes" container**
   - Container with tag browser + search + notes
   - Prove the composed workflow

### Phase 3: Polish (Week 4+)

8. **Better tag editing UI**
   - Visual tag selector (pills, dropdown, etc)
   - Auto-complete tag names

9. **Tag metadata**
   - Colors, icons, descriptions
   - Render in tag browser

10. **Advanced queries**
    - Multiple tag filter (AND/OR)
    - Date ranges
    - Full-text search + tags

---

## Design Rationale

### Why Not Relationships for Tags?

**Considered:** Using relationship items for tagging.

**Rejected:** 
- Creates proliferation of relationship items (one per tag per item)
- Queries become complex (filter relationship items, then fetch targets)
- "Tagged with" relationship doesn't add semantic value
- Inconsistent with `children` array pattern (which also uses direct references)

**When to use relationships:** When the connection itself has meaning ("argues against", "inspired by") or needs metadata.

### Why Universal Tags?

**Considered:** Tags only on notes.

**Rejected:**
- Artificially limits extensibility
- Same implementation cost as universal
- Closes doors for future use cases
- Violates "everything is an item" consistency

**Accepted:** Universal tags with convention that some types use them more than others. Power users tag code, regular users tag notes. Both are valid.

### Why Explicit Creation (MVP)?

**Considered:** Implicit tag creation (auto-create when typing unknown tag).

**Deferred:**
- Explicit is simpler to implement
- Proves the concept first
- Can add implicit later without changing data model
- Explicit creation acceptable for early usage

---

## Cross-References

- For container composition patterns, see Spatial_Windowing.md
- For generic item editor (which will handle tag editing), see Future_Directions.md
- For current implementation status, see Design_Decisions_Log.md
- For field editor plugins, see Future_Directions.md
