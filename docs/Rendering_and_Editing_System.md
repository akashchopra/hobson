# Rendering and Editing System

**Last Updated:** 2026-01-13

---

## Overview

Hobson separates the concerns of displaying items (rendering) from modifying items (editing) through distinct but parallel systems. Both renderers and editors are items themselves, enabling users to extend and customize how any type is displayed or edited without modifying the types themselves.

---

## Core Principles

### Separation of Concerns

Three orthogonal aspects of item handling:

1. **Types** - Define what an item IS
2. **Renderers** - Define how to DISPLAY an item
3. **Editors** - Define how to EDIT an item

Each can be modified independently without affecting the others.

### Extensibility Without Modification

Adding a new way to view or edit an item doesn't require changing existing renderers/editors:

- Want a compact note view? Add `note_compact_renderer`
- Want a simple note editor? Add `note_simple_editor`
- Existing renderers and editors continue working unchanged

This embodies the principle: "extend without breaking."

---

## Renderers

### What is a Renderer?

A renderer is a code item that displays an item of a particular type. Renderers:

- Are items with type `renderer`
- Contain executable code (JavaScript modules)
- Export a `render(item, api)` function
- Return DOM nodes representing the item
- Receive a read-capable API (query, get, renderItem, etc)

### Renderer Structure
```javascript
{
  id: "note_full_renderer",
  type: "00000000-0000-0000-0000-000000000003",  // renderer
  name: "note_full_renderer",
  content: {
    for_type: "note_type_id",
    code: `
      export async function render(item, api) {
        // Return DOM node displaying the item
        return api.createElement('div', {}, [
          ['h1', {}, [item.content.title]],
          ['div', {}, [item.content.description]]
        ]);
      }
    `
  }
}
```

### Multiple Renderers Per Type

A single type can have multiple renderers:

- `note_full_renderer` - Full markdown display
- `note_compact_renderer` - Title and preview only  
- `note_card_renderer` - Visual card layout
- `note_inline_renderer` - Minimal read-only view

**Why allow multiple renderers?**

Not allowing multiple renderers would violate extensibility - users couldn't add new views without modifying existing renderers. Multiple renderers enable:

- Different levels of detail (compact vs full)
- Different contexts (embedded vs standalone)  
- Different platforms (mobile vs desktop)
- User preference (cards vs lists)

### Default Renderer Selection

When `api.renderItem(itemId)` is called without specifying a renderer, the system must choose one:

**Current approach (MVP):**
- Walk the type chain looking for a renderer
- Use the first one found
- Fall back to default_renderer (JSON view)

**Future approaches:**
- Renderers have `is_default: true` flag
- Per-instance preferred renderer
- Context-based selection

### Renderer API
```javascript
// Render with default renderer
await api.renderItem(itemId)

// Render with specific renderer  
await api.renderItem(itemId, rendererId)

// Query available renderers
await api.getRenderers(typeId)

// Get default renderer
await api.getDefaultRenderer(typeId)
```

---

## Editors

### What is an Editor?

An editor defines how to modify an item. Editors are parallel to renderers but serve a different purpose.

**Two kinds of editors:**

1. **Declarative editors** - Specifications (UI hints) consumed by a generic editor renderer
2. **Custom editors** - Code items with imperative editing logic

### Why Separate Editors from Renderers?

**Flexibility:**
- Multiple editors per type (simple, advanced, mobile)
- Change editing experience without changing display
- Users can create custom editors

**Separation of concerns:**
- Display (renderer) vs modification (editor) are different operations
- Some renderers are editable, others read-only
- Editors can be invoked in different contexts (inline, modal, full-screen)

### Editor Specifications (Declarative)

For most types, editors are **specification items** containing UI hints:
```javascript
{
  id: "note_editor",
  type: "00000000-0000-0000-0000-000000000009",  // editor type
  name: "note_editor",
  content: {
    for_type: "note_type_id",
    is_default: true,
    ui_hints: {
      id: { hidden: true },
      type: { hidden: true },
      created: { readonly: true, label: "Created" },
      modified: { readonly: true, label: "Last Modified" },
      "content.title": {
        editor: "text",
        label: "Title",
        placeholder: "Untitled Note"
      },
      "content.description": {
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

### Generic Editor Renderer

A **generic editor renderer** (code item) reads editor specifications and constructs appropriate editing UI:

1. Loads the editor spec for the item's type
2. Iterates through ui_hints
3. For each field, loads the appropriate field editor (text, markdown, tag_selector, etc)
4. Renders the complete form
5. Saves changes back to the item

### Field Editors

Field editors are library items that render specific types of input:

- `field_editor_text` - Simple text input
- `field_editor_markdown` - Markdown editor with preview
- `field_editor_tag_selector` - Tag selection UI
- `field_editor_date_picker` - Date/time picker

The generic editor loads these via `api.require()`:
```javascript
const editorCode = await api.require(`field_editor_${fieldType}`);
const widget = editorCode.render(value, onChange, api);
```

### Custom Editors (Imperative)

For complex editing needs, write custom editor code:
```javascript
{
  id: "kanban_editor",
  type: "editor_type_id",
  name: "kanban_editor",
  content: {
    for_type: "kanban_board_type",
    code: `
      export async function render(item, api) {
        // Custom editing UI with drag-drop, etc
        return complexEditingInterface;
      }
    `
  }
}
```

### Editor API
```javascript
// Edit with default editor
await api.editItem(itemId)

// Edit with specific editor
await api.editItem(itemId, editorId)

// Query available editors
await api.getEditors(typeId)

// Get default editor
await api.getDefaultEditor(typeId)
```

---

## Editable Renderers

Some renderers include editing capability - they both display AND allow modification. The current markdown note renderer is an example.

This is valid and often convenient:

- **Simple types** - Editable renderer is easiest
- **Inline editing** - Edit-in-place without mode switching
- **Immediate feedback** - See changes as you type

Separate editors provide alternatives when:

- You want different editing experiences (simple vs advanced)
- The editing UI is significantly different from display UI
- You want to share editing logic across types

**Both patterns coexist:** Types can have editable renderers AND separate editor items.

---

## Edit/View Mode Transition

### Current Pattern (Editable Renderers)

Renderers that include editing capability handle their own transitions:
- Display markdown with "Edit" button
- Click to show textarea
- Save to store changes

### Future Pattern (Separate Editors)

When using separate editor items:

**Renderer provides edit affordance:**
```javascript
const editBtn = api.createElement('button', {
  onclick: async () => {
    await api.editItem(item.id);  // Default editor
  }
}, ['Edit']);
```

**With editor selection:**
```javascript
const editBtn = api.createElement('button', {
  onclick: async () => {
    const editorId = await api.selectEditor(item.type);
    await api.editItem(item.id, editorId);
  }
}, ['Edit ▼']);
```

### Edit Transition Patterns

Several patterns are possible:

**In-place replacement:**
- Renderer unmounts, editor renders in same location
- Save/cancel returns to renderer

**Modal/overlay:**
- Editor appears as modal over renderer
- Renderer remains visible underneath

**Navigation:**
- Navigate to edit URL (`?root=item-id&mode=edit`)
- Browser back returns to view mode

**Split view:**
- Renderer and editor side-by-side
- Live preview while editing

Different renderers/editors can choose different patterns based on their needs.

---

## Renderer/Editor Discovery

### Finding Renderers

Walk the type chain looking for renderer items:
```javascript
async findRenderer(typeId) {
  let currentType = typeId;
  
  while (currentType) {
    const renderers = await storage.query({ type: RENDERER_TYPE });
    const renderer = renderers.find(r => r.content.for_type === currentType);
    
    if (renderer) return renderer;
    
    // Try parent type
    const typeItem = await storage.get(currentType);
    currentType = typeItem.type;
    
    if (currentType === ATOM_ID) break;
  }
  
  // Fall back to default renderer
  return await storage.get(DEFAULT_RENDERER_ID);
}
```

### Finding Editors

Same algorithm as renderers:
```javascript
async findEditor(typeId) {
  // Walk type chain looking for editor
  // Fall back to generic editor (always works)
}
```

### Multiple Matches

If multiple renderers/editors exist for a type:

**Current (MVP):**
- Use first one found
- Or first one with `is_default: true`

**Future:**
- User preference (per-type or global)
- Context-based selection
- Most recently used
- Explicit choice via UI

---

## Container Rendering

When a container renders its children, it can specify how each child is rendered:
```javascript
// Positioned children with optional renderer
children: [
  { 
    id: "note-1", 
    x: 20, y: 20, width: 400, height: 300, z: 0,
    renderer: "note_compact_renderer"  // Optional
  },
  { 
    id: "note-2",
    x: 450, y: 20, width: 400, height: 300, z: 0
    // Uses default renderer for note-2's type
  }
]
```

This allows different visualizations within the same container - useful for spatial layouts where you might want some notes displayed compactly and others in full.

---

## Implementation Status

### Currently Implemented

- ✅ Single renderer per type (default lookup)
- ✅ Renderer type chain walking
- ✅ Default fallback renderer
- ✅ Editable renderers (like markdown note renderer)

### Decided But Not Implemented

- 📋 Editor items as separate from renderers
- 📋 Multiple renderers per type (architecture supports it)
- 📋 Generic editor renderer
- 📋 Field editor plugins
- 📋 UI hints in editor specifications

### Future Considerations

- 🤔 Context-based renderer selection
- 🤔 Per-instance renderer preferences
- 🤔 Edit mode transitions (in-place, modal, navigation)
- 🤔 Split view editing
- 🤔 Renderer/editor selection UI

---

## Design Rationale

### Why Not Bundle Editors with Types?

**Considered:** Putting UI hints directly in type definitions.

**Rejected:** Ties data model to presentation. Types should describe what an item IS, not how to edit it. Separate editor items maintain clean separation and enable multiple editing experiences per type.

### Why Not Bundle Editors with Renderers?

**Considered:** Renderers could include editing capability (some do).

**Rejected for universal approach:** Would force all renderers to be editable, or require complex mode switching. Separate editors allow read-only renderers and provide alternative editing experiences without modifying renderers.

**Accepted for specific cases:** Some renderers ARE editable (like markdown note renderer). This is fine - it's one choice among many. Separate editors provide alternatives.

### Why Allow Multiple Renderers?

**Prevents modification to extend:** Without multiple renderers, adding a new view requires modifying the existing renderer, which violates "extend without breaking" and risks introducing bugs.

**Enables specialization:** Different contexts benefit from different visualizations. Spatial canvas might use compact renderers, while focused reading uses full renderers.

---

## Cross-References

- For renderer implementation patterns, see Technical_Implementation_Notes.md Section 5
- For container rendering of children, see Spatial_Windowing.md
- For generic editor design, see Future_Directions.md
- For current implementation status, see Design_Decisions_Log.md
