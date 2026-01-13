# Future Directions

**Last Updated:** 2026-01-13

---

## Overview

This document captures ideas, designs, and explorations that have been discussed but not yet implemented. These represent potential future directions for Hobson.

**Status indicators:**
- 🎯 **High priority** - Clear next steps
- 🔮 **Medium priority** - Interesting, needs more thought
- 💭 **Low priority** - Worth keeping in mind

---

## 🎯 Generic Item Editor

### Concept

A progressive disclosure system for editing items:

**Level 0:** Raw JSON editor (current implementation)

**Level 1:** Structured JSON editor
- Each property rendered as separate field
- Nested properties with visual indentation
- Array properties with add/remove functionality
- Better than JSON but no type-specific widgets

**Level 2:** Typed fields with UI hints
- Type definitions or editor items specify hints
- Generic editor consumes hints and renders appropriate widgets
- Markdown field → markdown editor
- Tags field → tag selector
- Date field → date picker

**Level 3:** Custom editors
- Full control when needed
- Write imperative code for complex editing workflows

### Editor Specifications

Editor items contain declarative UI hints:
```javascript
{
  type: "editor",
  content: {
    for_type: "note",
    ui_hints: {
      id: { hidden: true },
      type: { hidden: true },
      created: { readonly: true, label: "Created" },
      "content.title": { 
        editor: "text",
        label: "Title",
        placeholder: "Untitled"
      },
      "content.body": {
        editor: "markdown",
        label: "Content"
      },
      "content.tags": {
        editor: "tag_selector",
        label: "Tags"
      }
    }
  }
}
```

### Field Editors

Field editors are library items that render specific input types:

- `field_editor_text` - Simple text input
- `field_editor_markdown` - Markdown editor with preview
- `field_editor_tag_selector` - Tag selection UI
- `field_editor_date_picker` - Date/time picker
- `field_editor_number` - Numeric input with validation
- `field_editor_color` - Color picker
- `field_editor_file` - File upload

The generic editor loads these via `api.require()`:
```javascript
const editorCode = await api.require(`field_editor_${fieldType}`);
const widget = editorCode.render(currentValue, onChange, api);
```

### Benefits

**Reduces boilerplate:**
- Create note type + editor hints → instant editing UI
- No need to write custom editor for every type

**Enables user customization:**
- Users can create custom field editors
- Mix and match field editors for specialized workflows

**Progressive enhancement:**
- Start with Level 1 (works for all items)
- Add hints for common types
- Write custom editors only when needed

### Open Questions

**Where do hints live?**

Option A: In type definitions
- Pros: Centralized, one place to define item
- Cons: Couples data model to presentation

Option B: In separate editor items (preferred)
- Pros: Clean separation, multiple editors per type
- Cons: Additional items to manage

**What's the fallback chain?**

If field editor doesn't exist:
1. Try to load it via `api.require()`
2. If fails, fall back to... text input? JSON editor for that field?

**Bootstrap problem?**

If editors are items, how do you edit editor items? Answer: Generic editor must work without hints (Level 1).

**Should this be a seed item?**

Generic editor renderer as seed item? Or built later? If seed, has chicken-and-egg with its own editor spec.

### Implementation Approach

**Phase 1:** Build Level 1 (structured JSON editor)
- Each property as separate field
- Nested properties with indentation
- Array add/remove buttons
- Already useful without hints

**Phase 2:** Add hint system
- Editor items with UI hints
- Generic editor reads hints
- Hidden, readonly, labels working

**Phase 3:** Field editor plugins
- Create a few field editors (text, markdown, tags)
- Generic editor loads them dynamically
- Prove the plugin pattern works

**Phase 4:** Polish
- More field editors
- Validation
- Error messages
- Auto-save

---

## 🔮 Offline/Online Architecture

### Current State

System is fully offline - no network dependencies. But this limits functionality:
- Can't import data from web
- Can't sync between devices
- Can't collaborate with others

### Exploration Directions

**1. Optional Online Enhancements**

When online, system can:
- Fetch web pages for note references
- Import data from APIs
- Check for system updates
- But all core functionality remains offline

**2. Cached Web Resources**

When you reference a URL:
- System fetches and caches locally
- Subsequent access uses cache
- Periodic refresh when online
- Offline access guaranteed

**3. Device Sync**

Sync between laptop and phone:
- Conflict resolution strategy (last-write-wins? manual?)
- What syncs (all items? specific containers?)
- When syncs (continuous? periodic? manual?)

**4. Collaborative Editing**

Multiple users sharing items:
- Operational transforms or CRDT?
- Permissions model
- Conflict resolution
- This is much later - not a priority

### Open Questions

- What's the sync strategy that balances simplicity and power?
- How to handle conflicts (inevitable with offline editing)?
- Should mobile be a subset (fewer items) or mirror (all items)?
- What's the offline storage limit on mobile?

---

## 🔮 Mobile Experience

### Current Thinking

Don't make desktop UI responsive. Create mobile-specific containers and renderers:
```javascript
// Desktop
{
  id: "my_notes_desktop",
  type: "container",
  children: [
    { id: "tag-browser", x: 0, y: 0, ... },
    { id: "search", x: 260, y: 0, ... }
  ]
}

// Mobile
{
  id: "my_notes_mobile",
  type: "container",
  children: ["search", "note-1", "note-2"]  // Linear, no positioning
}
```

Same underlying data (notes, tags), different layouts.

### Mobile-Specific Renderers

- `note_mobile_renderer` - Swipeable, full-screen
- `container_mobile_renderer` - Vertical scroll, no spatial layout
- `tag_browser_mobile` - Hierarchical drill-down vs tree view

### Questions

- Should mobile have a completely separate entry point?
- Or detect platform and show appropriate containers?
- What subset of features makes sense on mobile vs desktop?
- Is editing on mobile important, or primarily consumption?

---

## 💭 Rich Text Editing

### Beyond Markdown

Markdown is good but limited. WYSIWYG editing could be valuable:

- ContentEditable with formatting toolbar
- Inline images, videos, embeds
- Tables, diagrams
- But: how to preserve editability when viewing on different devices?

### Hybrid Approach

- Store as structured data (not HTML)
- Render appropriately per platform
- Preserve editing capability

### Libraries to Consider

- ProseMirror (structured editing)
- TipTap (built on ProseMirror)
- Quill
- Slate

**Trade-off:** Complexity vs capability. Markdown is simple and portable. Rich text editors are complex and fragile.

---

## 💭 Bidirectional Links

### Concept

When note A links to note B, automatically create backlink from B to A:

- Note B shows "Linked from: Note A"
- Click to navigate back
- Discover connections you didn't explicitly create

### Implementation

**Option A: Computed on render**
- When rendering note B, scan all items for references to B
- Display dynamically
- No data changes needed

**Option B: Relationship items**
- Links create relationship items
- Backlinks query relationship items
- More explicit, easier queries

**Option C: Hybrid**
- Markdown links remain casual (Option A)
- Explicit relationship items for important connections
- Best of both worlds

### Questions

- Do backlinks clutter the UI?
- Should backlinks be contextual (show surrounding text)?
- How to handle backlink removal when link is deleted?

---

## 💭 Version History

### Concept

Track changes to items over time:

- Every edit creates a version
- View history, diff changes
- Revert to previous versions
- See who changed what (if collaborative)

### Implementation Challenges

**Storage:**
- Full copies of each version (simple but wasteful)
- Deltas (efficient but complex)
- Periodic snapshots + recent deltas (hybrid)

**UI:**
- Timeline view
- Diff visualization
- Blame/attribution
- Branching (multiple versions)?

### Questions

- Is this worth the complexity for personal use?
- Or only valuable for collaboration?
- What's the retention policy (keep forever? auto-prune old versions)?

---

## 💭 Scripting and Automation

### Beyond Manual Interaction

Automate workflows:

- "Every morning, create a daily note"
- "When a note is tagged 'urgent', send a notification"
- "Automatically tag notes based on content"
- "Generate weekly summary of completed tasks"

### Approaches

**Option A: Scheduled scripts**
- Items with type "scheduled_script"
- Run at specified times
- Access full API

**Option B: Event triggers**
- "On item created with tag X, do Y"
- Lifecycle hooks at system level
- More powerful but more complex

**Option C: REPL macros**
- Save frequently-used REPL commands
- Bind to keyboard shortcuts
- Simpler, less powerful

### Questions

- How to prevent runaway scripts?
- Error handling and logging?
- Should scripts be able to modify themselves (self-modifying code)?

---

## 💭 Plugin System

### Concept

Third-party extensions without modifying kernel:

- Install plugins from external sources
- Plugins add new types, renderers, field editors
- Sandboxed execution
- Permission model

### Challenges

**Security:**
- How to sandbox untrusted code?
- What API surface to expose?
- How to prevent malicious plugins?

**Distribution:**
- Plugin registry?
- Manual installation (paste code)?
- Update mechanism?

**Complexity:**
- Is this needed for personal use?
- Or only if Hobson becomes multi-user platform?

### Current Thinking

**Defer.** The item system already enables "plugins" - just create items with new types/renderers. No special plugin infrastructure needed for personal use.

---

## 💭 Import/Export Strategies

### Beyond JSON Dump

Import from various sources:

- Obsidian vaults (markdown files)
- Notion databases (API export)
- Email (IMAP, mbox files)
- Calendar (ics files)
- Browser bookmarks (HTML export)
- Twitter archive
- GitHub issues

### Export to Various Formats

- Markdown files (for backup, portability)
- HTML site (publish notes as website)
- PDF (for sharing)
- Obsidian format (migrate if needed)

### Questions

- One-time import or continuous sync?
- How to preserve relationships during import?
- What's the canonical format for backup (JSON? Something else)?

---

## 💭 Graph Visualization

### Concept

Visualize relationships between items:

- Nodes = items
- Edges = relationships or links
- Interactive (click to navigate)
- Filters (show only certain types)

### Libraries to Consider

- D3.js force-directed graph
- Cytoscape.js
- Vis.js network

### Questions

- Is graph view useful for personal information?
- Or just pretty but not practical?
- What insights would it provide that search/tags don't?

---

## 💭 Full-Text Search

### Beyond Simple String Matching

More sophisticated search:

- Fuzzy matching (typo-tolerant)
- Stemming (find "running" when searching "run")
- Boolean queries ("work AND urgent NOT completed")
- Search within specific fields
- Ranking/relevance scoring

### Implementation

**Option A: Build it**
- Indexing strategy
- Query parser
- Ranking algorithm
- Lots of work

**Option B: Library**
- Lunr.js (client-side)
- FlexSearch
- MiniSearch

**Option C: Keep it simple**
- Current string matching is probably fine
- Add features only when need is clear

### Current Thinking

Simple string matching is sufficient for MVP. Add sophistication only when it becomes a pain point.

---

## 💭 Calendar Integration

### Concept

Items with dates become calendar events:

- Notes tagged with dates show on calendar
- Tasks with due dates
- Meeting items with start/end times
- Recurring events

### Questions

- Is calendar view valuable for notes, or just tasks?
- How to handle all-day vs timed events?
- Recurring events (complex to implement properly)?

---

## 💭 Task Management

### Beyond Notes

Dedicated task items:

- Title, description, due date, priority
- Status (todo, in-progress, done)
- Subtasks (hierarchical)
- Tags and contexts
- Time tracking

### Relationship to Notes

Are tasks a separate type, or just notes with specific properties?

**Option A: Separate type**
- Dedicated task renderer
- Task-specific features (recurring, reminders)
- More complex

**Option B: Notes with task properties**
- Tags like "todo", "done"
- Due dates in content
- Simpler, more flexible

### Questions

- Is dedicated task management in scope?
- Or is this a separate app built within Hobson?
- Many task management patterns exist - which one?

---

## Cross-References

- For tags implementation plan, see Tags_and_Classification.md
- For rendering/editing architecture, see Rendering_and_Editing.md
- For mobile container approach, see Spatial_Windowing.md
- For current implementation status, see Design_Decisions_Log.md
