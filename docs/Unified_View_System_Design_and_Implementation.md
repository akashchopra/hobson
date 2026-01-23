# Unified View System: Design and Implementation Plan

**Status:** Design Complete, Implementation Pending  
**Date:** 2026-01-23  
**Supersedes:** Rendering_and_Editing_System.md (sections on editors)

---

## Executive Summary

This document describes the unified view system that replaces the renderer/editor distinction with a single "view" concept. Views can be read-only, editable, or mixed-mode, with capabilities declared rather than implied by type.

**Key Changes:**
- Renderers and editors merge into **views**
- Field editors become **field views** that support multiple modes
- **View specifications** (declarative) and **view code** (imperative) as two patterns
- Generic editor becomes **generic view** that interprets specifications
- Per-property mode control (readonly/editable in same view)

---

## Part 1: Design

### 1.1 Core Concepts

#### Views

A **view** is code or specification that displays and/or allows interaction with an item. Views replace both renderers and editors.

**Two kinds of views:**

1. **View Code (Imperative)**
   - Code items with `type: view`
   - Export `render(item, api)` function
   - Return DOM representing the item
   - Declare capabilities they support

2. **View Specifications (Declarative)**
   - Data items with `type: view-spec`
   - Contain `ui_hints` describing structure
   - Consumed by generic view
   - Specify per-property modes

#### Field Views

**Field views** are reusable components that render individual properties. They are library items that can support multiple rendering modes.

**Modes:**
- `readonly` - Display value without interaction
- `editable` - Allow modification via onChange callback
- Future: `compact`, `preview`, `detailed`, etc.

**Pattern:** Field views can support modes in two ways:

1. **Unified** (simple cases like text, number):
```javascript
export function render(value, options, api) {
  const { mode, onChange } = options;
  
  if (mode === 'editable' && onChange) {
    return api.createElement('input', { 
      value, 
      oninput: e => onChange(e.target.value) 
    });
  }
  
  return api.createElement('span', {}, [value]);
}
```

2. **Separate** (complex cases like markdown):
   - `field_view_markdown_readonly` - Display parsed markdown
   - `field_view_markdown_editable` - Rich editing interface
   - Author creates separate implementations for each mode

**Why allow both?** Matches the complexity of the use case. Simple field views naturally support toggling; complex ones benefit from separation and independent extension.

#### Generic View

The **generic view** is a library item that:
1. Reads view specifications
2. Determines item's type
3. Iterates through ui_hints
4. Loads appropriate field views
5. Passes mode and callbacks to each field view
6. Assembles complete interface
7. Handles save/cancel

---

### 1.2 Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Item (note, container, tag, etc)                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
      ┌───────────────────────────────────┐
      │  View Lookup (type chain walk)    │
      └───────────────────────────────────┘
                          │
           ┌──────────────┴──────────────┐
           ↓                             ↓
  ┌────────────────┐           ┌────────────────┐
  │  View Code     │           │  View Spec     │
  │  (imperative)  │           │  (declarative) │
  └────────────────┘           └────────────────┘
           │                             │
           │                             ↓
           │                   ┌──────────────────┐
           │                   │  Generic View    │
           │                   └──────────────────┘
           │                             │
           │                             ↓
           │                   ┌──────────────────────┐
           │                   │  Field Views         │
           │                   │  - text              │
           │                   │  - markdown_readonly │
           │                   │  - markdown_editable │
           │                   │  - timestamp         │
           │                   │  - tag_selector      │
           │                   │  - item_reference    │
           │                   └──────────────────────┘
           │                             │
           └─────────────┬───────────────┘
                         ↓
                   ┌──────────┐
                   │   DOM    │
                   └──────────┘
```

---

### 1.3 Item Structures

#### View Code (Imperative)

```javascript
{
  id: "note_view_markdown",
  name: "note_view_markdown",
  type: "00000000-0000-0000-0000-000000000010", // view type
  created: 1737590400000,
  modified: 1737590400000,
  children: [],
  content: {
    for_type: "note_type_id",
    capabilities: ["read", "write"],
    description: "Full markdown note view with inline editing",
    code: `
      export async function render(item, api) {
        // Custom implementation
        // Has full control over UI and interaction
        return domNode;
      }
    `
  }
}
```

#### View Specification (Declarative)

```javascript
{
  id: "note_view_form",
  name: "note_view_form",
  type: "00000000-0000-0000-0000-000000000011", // view-spec type
  created: 1737590400000,
  modified: 1737590400000,
  children: [],
  content: {
    for_type: "note_type_id",
    description: "Form-based note view",
    ui_hints: {
      "id": { 
        field_view: "text",
        mode: "readonly",
        hidden: true
      },
      "type": { 
        field_view: "text",
        mode: "readonly",
        hidden: true 
      },
      "created": { 
        field_view: "timestamp",
        mode: "readonly",
        label: "Created"
      },
      "modified": { 
        field_view: "timestamp",
        mode: "readonly",
        label: "Last Modified"
      },
      "content.title": { 
        field_view: "text",
        mode: "editable",
        label: "Title",
        placeholder: "Untitled Note"
      },
      "content.body": { 
        field_view: "markdown_editable",
        mode: "editable",
        label: "Content"
      },
      "content.tags": { 
        field_view: "tag_selector",
        mode: "editable",
        label: "Tags"
      }
    }
  }
}
```

**Capabilities inference:** If any ui_hint has `mode: "editable"`, the view has write capability.

#### Field View (Library)

```javascript
{
  id: "field_view_text",
  name: "field_view_text",
  type: "00000000-0000-0000-0000-000000000004", // library type
  created: 1737590400000,
  modified: 1737590400000,
  children: [],
  content: {
    description: "Simple text field supporting readonly and editable modes",
    code: `
      export function render(value, options, api) {
        const { mode, onChange, label, placeholder } = options;
        
        const wrapper = api.createElement('div', { 
          className: 'field-text' 
        });
        
        if (label) {
          wrapper.appendChild(
            api.createElement('label', {}, [label])
          );
        }
        
        if (mode === 'editable' && onChange) {
          const input = api.createElement('input', {
            type: 'text',
            value: value || '',
            placeholder: placeholder || '',
            oninput: (e) => onChange(e.target.value)
          });
          wrapper.appendChild(input);
        } else {
          wrapper.appendChild(
            api.createElement('span', {}, [value || ''])
          );
        }
        
        return wrapper;
      }
    `
  }
}
```

---

### 1.4 Generic View Implementation

The generic view is a library item that interprets view specifications:

```javascript
{
  id: "generic_view",
  name: "generic_view",
  type: "library",
  content: {
    code: `
      export async function render(item, viewSpec, api) {
        const form = api.createElement('div', { 
          className: 'generic-view' 
        });
        
        // Clone item for editing
        let editedItem = JSON.parse(JSON.stringify(item));
        
        // Render each field according to ui_hints
        for (const [path, hint] of Object.entries(viewSpec.content.ui_hints)) {
          if (hint.hidden) continue;
          
          // Get current value from item
          const value = getNestedValue(item, path);
          
          // Load field view
          const fieldView = await api.require(
            \`field_view_\${hint.field_view}\`
          );
          
          // Create onChange handler if editable
          const onChange = hint.mode === 'editable' 
            ? (newValue) => {
                setNestedValue(editedItem, path, newValue);
              }
            : null;
          
          // Render field
          const fieldElement = fieldView.render(value, {
            mode: hint.mode || 'readonly',
            onChange,
            label: hint.label,
            placeholder: hint.placeholder
          }, api);
          
          form.appendChild(fieldElement);
        }
        
        // Add save/cancel buttons if any field is editable
        const hasEditableFields = Object.values(viewSpec.content.ui_hints)
          .some(hint => hint.mode === 'editable');
          
        if (hasEditableFields) {
          const actions = api.createElement('div', { 
            className: 'view-actions' 
          });
          
          const saveBtn = api.createElement('button', {
            onclick: async () => {
              await api.update(editedItem);
            }
          }, ['Save']);
          
          const cancelBtn = api.createElement('button', {
            onclick: () => {
              api.renderItem(item.id); // Re-render original
            }
          }, ['Cancel']);
          
          actions.appendChild(saveBtn);
          actions.appendChild(cancelBtn);
          form.appendChild(actions);
        }
        
        return form;
      }
      
      function getNestedValue(obj, path) {
        return path.split('.').reduce((curr, key) => curr?.[key], obj);
      }
      
      function setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((curr, key) => {
          if (!curr[key]) curr[key] = {};
          return curr[key];
        }, obj);
        target[lastKey] = value;
      }
    `
  }
}
```

---

### 1.5 View Lookup and API

#### View Discovery

Same algorithm as current renderer lookup:

```javascript
async function findView(typeId) {
  let currentType = typeId;
  
  while (currentType) {
    // Check for view code
    const views = await storage.query({ type: VIEW_TYPE });
    const view = views.find(v => v.content.for_type === currentType);
    if (view) return view;
    
    // Check for view specs
    const specs = await storage.query({ type: VIEW_SPEC_TYPE });
    const spec = specs.find(s => s.content.for_type === currentType);
    if (spec) return spec;
    
    // Walk up type chain
    const typeItem = await storage.get(currentType);
    currentType = typeItem.type;
    if (currentType === ATOM_ID) break;
  }
  
  // Fall back to default view (JSON)
  return await storage.get(DEFAULT_VIEW_ID);
}
```

#### Kernel API

```javascript
// Show item with default view
await api.showView(itemId)

// Show item with specific view
await api.showView(itemId, viewId)

// Show item with mode override (forces all fields to that mode)
await api.showView(itemId, viewId, { mode: 'readonly' })

// Query available views for a type
await api.getViews(typeId)

// Get default view for a type
await api.getDefaultView(typeId)
```

---

### 1.6 Context Menu and User Interaction

**Right-click context menu:**

1. **Display As...**
   - Lists available views for the item's type
   - User selects a view
   - Parent container's child specification updated
   - Item re-renders with chosen view

2. **Edit Display**
   - Opens the view code/spec for editing
   - Changes affect all items using this view
   - Direct editing in MVP; versioning deferred

**Mode switching:**

"Switching to edit mode" is now just switching to a different view. For example:
- `note_view_readonly` → `note_view_editable` 
- Or using a view spec that has all fields in readonly mode vs editable mode

Alternatively, if using a mixed-mode view spec, the generic view could accept mode override at runtime.

---

### 1.7 Mixed-Mode Views

A powerful feature: the same view can show some fields readonly and others editable:

```javascript
{
  content: {
    for_type: "article",
    ui_hints: {
      "id": { 
        field_view: "text", 
        mode: "readonly",
        hidden: true 
      },
      "created": { 
        field_view: "timestamp", 
        mode: "readonly" 
      },
      "modified": { 
        field_view: "timestamp", 
        mode: "readonly" 
      },
      "content.title": { 
        field_view: "text", 
        mode: "editable" 
      },
      "content.body": { 
        field_view: "markdown_editable", 
        mode: "editable" 
      },
      "content.published": { 
        field_view: "checkbox", 
        mode: "editable" 
      },
      "content.published_date": { 
        field_view: "timestamp", 
        mode: "readonly"  // Can't edit, auto-set
      }
    }
  }
}
```

This is more flexible than the old renderer/editor split where the entire item was in one mode or the other.

---

### 1.8 Type Hierarchy

New seed types:

```
atom (00000000-...-000000000000)
├─ type_definition (00000000-...-000000000001)
│  ├─ view (00000000-...-000000000010)
│  └─ view-spec (00000000-...-000000000011)
└─ code (00000000-...-000000000002)
   └─ library (00000000-...-000000000004)
      └─ field_view (new, needs GUID)
```

**Migration notes:**
- `renderer` (00000000-...-000000000003) becomes `view`
- `editor` (00000000-...-000000000009) becomes obsolete
- Existing renderers migrate to `view` type
- Existing editor specs migrate to `view-spec` type

---

## Part 2: Implementation Plan

### 2.1 Overview

The implementation follows a phased approach to minimize disruption and allow testing at each stage.

**Phases:**
1. Add new types and kernel support
2. Implement generic view and core field views
3. Create field view implementations
4. Migrate existing items
5. Update kernel rendering system
6. Remove deprecated types

**Estimated effort:** 3-5 days for core implementation, 1-2 days for migration and testing.

---

### 2.2 Phase 1: Add New Types

**Goal:** Establish the new type hierarchy without breaking existing functionality.

#### Task 1.1: Define New Seed Types

Create three new seed items with memorable GUIDs:

```javascript
// view type (replaces renderer)
{
  id: "00000000-0000-0000-0000-000000000010",
  name: "view",
  type: "00000000-0000-0000-0000-000000000002", // code
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    description: "Code that displays and/or allows interaction with an item. Replaces renderer and editor types.",
    required_fields: ["for_type", "code", "capabilities"]
  }
}

// view-spec type
{
  id: "00000000-0000-0000-0000-000000000011",
  name: "view-spec",
  type: "00000000-0000-0000-0000-000000000001", // type_definition
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    description: "Declarative specification for how to view/edit an item. Contains ui_hints consumed by generic_view.",
    required_fields: ["for_type", "ui_hints"]
  }
}

// field_view type
{
  id: "00000000-0000-0000-0000-000000000012",
  name: "field_view",
  type: "00000000-0000-0000-0000-000000000004", // library
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    description: "Reusable component for rendering individual properties. Supports multiple modes (readonly, editable)."
  }
}
```

**How to implement:**
1. Add these items to `initial-kernel.json`
2. Update kernel IDS constant with new GUIDs
3. Test by importing into a fresh Hobson instance

**Testing:**
- Can create items with new types
- Type chain validation accepts new types
- No existing functionality broken

---

### 2.3 Phase 2: Implement Generic View

**Goal:** Create the generic view library that interprets view specifications.

#### Task 2.1: Create Generic View Library

```javascript
{
  id: "generic_view",
  name: "generic_view",
  type: "00000000-0000-0000-0000-000000000004", // library
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    description: "Interprets view-spec items and constructs appropriate UI by loading field views.",
    code: `
      // Full implementation from section 1.4
      // With proper error handling, validation, etc.
    `
  }
}
```

**Implementation details:**
- Handle missing field views gracefully (show error, not crash)
- Support nested property paths (e.g., "content.nested.value")
- Validate ui_hints structure
- Handle arrays and complex values
- Provide sensible defaults (label from property name, etc.)

**Testing:**
- Create simple view spec
- Render with generic view
- Verify correct field views loaded
- Test save/cancel functionality
- Test mode switching

---

### 2.4 Phase 3: Create Field Views

**Goal:** Implement core field views to support common data types.

#### Task 3.1: Simple Field Views (Unified Pattern)

Create these field views that support both modes:

**field_view_text:**
```javascript
{
  id: "field_view_text",
  name: "field_view_text",
  type: "00000000-0000-0000-0000-000000000012", // field_view
  content: {
    description: "Simple text field",
    code: `
      export function render(value, options, api) {
        const { mode, onChange, label, placeholder } = options;
        // Implementation from section 1.3
      }
    `
  }
}
```

**field_view_textarea:**
- Multi-line text input
- Readonly: shows text with preserved line breaks
- Editable: textarea element

**field_view_number:**
- Numeric input with validation
- Readonly: formatted number
- Editable: number input

**field_view_checkbox:**
- Boolean values
- Readonly: ✓ or ✗ symbol
- Editable: checkbox input

**field_view_timestamp:**
- Date/time display
- Readonly: formatted date
- Editable: date/time picker (could defer advanced editor)

#### Task 3.2: Complex Field Views (Separate Pattern)

Create paired readonly/editable field views:

**field_view_markdown_readonly:**
```javascript
{
  id: "field_view_markdown_readonly",
  name: "field_view_markdown_readonly",
  type: "00000000-0000-0000-0000-000000000012",
  content: {
    description: "Displays parsed markdown content",
    code: `
      export function render(value, options, api) {
        // Use markdown parsing library
        // Return rendered HTML
      }
    `
  }
}
```

**field_view_markdown_editable:**
```javascript
{
  id: "field_view_markdown_editable",
  name: "field_view_markdown_editable",
  type: "00000000-0000-0000-0000-000000000012",
  content: {
    description: "Rich markdown editor",
    code: `
      export function render(value, options, api) {
        // Use existing markdown editor code from note renderer
        // Add onChange integration
      }
    `
  }
}
```

**field_view_tag_selector:**
- Editable only (no readonly needed initially)
- Tag picking UI
- Multi-select

**field_view_item_reference:**
- Display: show linked item name, maybe preview
- Edit: item picker/search

#### Task 3.3: Fallback Field View

```javascript
{
  id: "field_view_json",
  name: "field_view_json",
  type: "00000000-0000-0000-0000-000000000012",
  content: {
    description: "Fallback for unknown types, shows JSON",
    code: `
      export function render(value, options, api) {
        // Display JSON.stringify(value, null, 2)
        // In editable mode, allow editing raw JSON
      }
    `
  }
}
```

**Testing for each field view:**
- Render in readonly mode
- Render in editable mode
- Verify onChange callback works
- Test with null/undefined values
- Test with invalid values

---

### 2.5 Phase 4: Update Kernel

**Goal:** Modify kernel to support view lookup and rendering.

#### Task 4.1: Update kernel-rendering Module

Current structure:
```javascript
// kernel-rendering looks for renderer items
async findRenderer(typeId) {
  // Walk type chain looking for items with type === RENDERER_TYPE
}
```

New structure:
```javascript
// kernel-rendering looks for view or view-spec items
async findView(typeId) {
  let currentType = typeId;
  
  while (currentType) {
    // Look for view code first
    const views = await this.storage.query({ type: IDS.VIEW });
    const view = views.find(v => v.content.for_type === currentType);
    if (view) return { type: 'code', item: view };
    
    // Look for view spec
    const specs = await this.storage.query({ type: IDS.VIEW_SPEC });
    const spec = specs.find(s => s.content.for_type === currentType);
    if (spec) return { type: 'spec', item: spec };
    
    // Walk type chain
    const typeItem = await this.storage.get(currentType);
    currentType = typeItem.type;
    if (currentType === IDS.ATOM) break;
  }
  
  // Fall back to default view
  return { type: 'code', item: await this.storage.get(IDS.DEFAULT_VIEW) };
}

async renderView(item, viewResult, api) {
  if (viewResult.type === 'code') {
    // Execute view code directly
    const viewCode = await this.moduleSystem.require(viewResult.item.id);
    return await viewCode.render(item, api);
  } else if (viewResult.type === 'spec') {
    // Use generic view to interpret spec
    const genericView = await this.moduleSystem.require('generic_view');
    return await genericView.render(item, viewResult.item, api);
  }
}
```

#### Task 4.2: Update API Methods

```javascript
// Rename/alias methods
api.showView = api.renderItem; // Alias for clarity
api.getViews = api.getRenderers; // Updated implementation
api.getDefaultView = api.getDefaultRenderer; // Updated implementation
```

#### Task 4.3: Update kernel-core

- Update IDS constant with new GUIDs
- Ensure compatibility layer for existing code

**Testing:**
- Boot kernel successfully
- Can lookup views for types
- Can render with view code
- Can render with view spec + generic view
- Fallback to default view works

---

### 2.6 Phase 5: Migration

**Goal:** Convert existing items to new system.

#### Task 5.1: Migration Script

Create a script item to perform migration:

```javascript
{
  id: "migration_to_views",
  name: "migration_to_views",
  type: "script",
  content: {
    description: "Migrates renderer and editor items to unified view system",
    code: `
      async function migrate() {
        // 1. Find all renderer items
        const renderers = await api.query({ type: api.IDS.RENDERER });
        
        for (const renderer of renderers) {
          // Convert to view
          const view = {
            ...renderer,
            type: api.IDS.VIEW,
            content: {
              ...renderer.content,
              capabilities: ["read", "write"] // Most renderers are editable
            }
          };
          
          await api.set(view);
          console.log(\`Migrated renderer: \${renderer.name}\`);
        }
        
        // 2. Find all editor items
        const editors = await api.query({ type: api.IDS.EDITOR });
        
        for (const editor of editors) {
          if (editor.content.code) {
            // Imperative editor → view code
            const view = {
              ...editor,
              type: api.IDS.VIEW,
              content: {
                ...editor.content,
                capabilities: ["read", "write"]
              }
            };
            await api.set(view);
          } else if (editor.content.ui_hints) {
            // Declarative editor → view spec
            const viewSpec = {
              ...editor,
              type: api.IDS.VIEW_SPEC,
              content: {
                ...editor.content
                // ui_hints stay as-is
                // Add mode: "editable" to each hint if missing
              }
            };
            
            // Ensure all ui_hints have mode specified
            for (const hint of Object.values(viewSpec.content.ui_hints)) {
              if (!hint.mode) {
                hint.mode = hint.readonly ? "readonly" : "editable";
              }
              delete hint.readonly; // Remove old property
            }
            
            await api.set(viewSpec);
          }
          
          console.log(\`Migrated editor: \${editor.name}\`);
        }
        
        console.log("Migration complete!");
        console.log(\`Converted \${renderers.length} renderers and \${editors.length} editors\`);
      }
      
      migrate();
    `
  }
}
```

#### Task 5.2: Verify Migration

After running migration:
1. Check that all views render correctly
2. Test editable views save properly
3. Verify no broken references
4. Backup before and after migration

#### Task 5.3: Update References

Update any documentation items that reference:
- "renderer" → "view"
- "editor" → "view" or "view spec"
- "edit mode" → "editable view"

---

### 2.7 Phase 6: Cleanup

**Goal:** Remove deprecated concepts.

#### Task 6.1: Mark Deprecated Types

Update seed items:

```javascript
{
  id: "00000000-0000-0000-0000-000000000003",
  name: "renderer",
  type: "00000000-0000-0000-0000-000000000002",
  content: {
    description: "DEPRECATED: Use 'view' type instead. Code that renders an item type.",
    deprecated: true,
    superseded_by: "00000000-0000-0000-0000-000000000010"
  }
}

{
  id: "00000000-0000-0000-0000-000000000009",
  name: "editor",
  type: "00000000-0000-0000-0000-000000000002",
  content: {
    description: "DEPRECATED: Use 'view' or 'view-spec' type instead. Code that edits an item.",
    deprecated: true,
    superseded_by: "00000000-0000-0000-0000-000000000010"
  }
}
```

#### Task 6.2: Create Compatibility Shims (Optional)

If desired, keep backward compatibility:

```javascript
// In kernel-rendering
async findRenderer(typeId) {
  console.warn("findRenderer is deprecated, use findView");
  return this.findView(typeId);
}
```

---

### 2.8 Testing Strategy

#### Unit Tests

For each component:
- Field views: test both modes, edge cases
- Generic view: test with various specs
- View lookup: test type chain walking
- API methods: test all parameters

#### Integration Tests

End-to-end workflows:
1. Create new item → view with default view → verify display
2. Right-click → "Display As..." → switch view → verify re-render
3. Edit item via view spec → save → verify persistence
4. Create custom view → assign to type → verify usage

#### Regression Tests

Verify existing functionality:
1. Note rendering still works
2. Container spatial layout still works
3. Tag browser still works
4. REPL still works
5. Navigation still works

---

### 2.9 Documentation Updates

Update these documents:

1. **Technical_Overview.md**
   - Replace "Renderer System" with "View System"
   - Update examples
   - Add field view section

2. **Rendering_and_Editing_System.md**
   - Mark as superseded
   - Add redirect to new documentation

3. **Bootstrap_Architecture.md**
   - Update seed item list
   - Note new GUIDs

4. **Design_Decisions_Log.md**
   - Add entry for unified view system decision

---

### 2.10 Rollout Plan

#### Step 1: Implement in Parallel
- Keep existing renderer/editor system running
- Build view system alongside
- Test thoroughly in isolation

#### Step 2: Soft Migration
- Run migration script on development instance
- Verify all functionality works
- Keep renderer/editor types marked deprecated but functional

#### Step 3: Full Migration
- Apply migration to production instances
- Remove renderer/editor lookup code (or keep as shims)
- Update all documentation

#### Step 4: Future Cleanup
- After stable period, can fully remove deprecated types
- Or keep indefinitely for historical reference

---

## Part 3: Design Rationale

### 3.1 Why Unify?

**Problem:** The renderer/editor distinction created conceptual overhead:
- Some renderers were editable (violating separation)
- "Edit mode" was really just another view
- Parallel systems for essentially the same thing (showing items)

**Solution:** Views are views, whether they allow editing or not. Capabilities declared, not implied by type.

### 3.2 Why Allow Both Imperative and Declarative?

**Problem:** One-size-fits-all doesn't work:
- Simple types (notes, tasks) benefit from declarative specs
- Complex types (kanban boards, spatial canvases) need imperative control

**Solution:** Support both patterns. Authors choose based on needs.

### 3.3 Why Hybrid Field View Pattern?

**Problem:** Forcing all field views to support all modes OR forcing separation for all:
- Unified: Simple becomes complex (text fields don't need separation)
- Separate: Complex becomes tedious (now you have 2x items for everything)

**Solution:** Let field view authors decide. Simple cases are simple; complex cases can separate.

### 3.4 Why Generic View?

**Problem:** Writing imperative view code for every type is tedious for simple cases.

**Solution:** Generic view interprets declarative specs, making simple types trivial to support.

### 3.5 Why Per-Property Modes?

**Problem:** All-readonly or all-editable limits flexibility.

**Solution:** Mixed-mode views (some fields readonly, others editable) are more powerful and match real use cases (e.g., show created/modified dates as readonly while editing content).

---

## Part 4: Future Enhancements

### 4.1 Context-Based View Selection

Allow views to declare context preferences:
```javascript
content: {
  for_type: "note",
  contexts: ["embedded", "standalone"],
  capabilities: ["read"]
}
```

System selects view based on rendering context.

### 4.2 Additional Modes

Beyond readonly/editable:
- `compact` - Minimal display
- `preview` - Quick glance
- `detailed` - Extended information
- `comparison` - Side-by-side comparison mode

### 4.3 View Composition

Allow views to compose other views:
```javascript
content: {
  for_type: "article",
  layout: "two-column",
  left_view: "article_content_view",
  right_view: "article_metadata_view"
}
```

### 4.4 View Versioning and Forking

- Fork view before editing (safety)
- Version history for views
- Rollback to previous versions

### 4.5 View Marketplace

- Share views across Hobson instances
- Import/export view packages
- Community-contributed field views

---

## Part 5: Open Questions

### 5.1 Default View Selection

When multiple views exist for a type, how to choose default?
- First one found (current approach)
- `is_default: true` flag
- Most recently used
- User preference setting

**Recommendation:** Start with `is_default` flag, add user preferences later.

### 5.2 View Permission Model

Should views have different API access levels?
- Read-only views get limited API
- Editable views get full API
- Or trust all views equally

**Recommendation:** Trust model for MVP (all views get full API), add permissions later if needed.

### 5.3 Field View Fallbacks

What if specified field_view doesn't exist?
- Use field_view_json as fallback
- Show error in UI
- Skip field entirely

**Recommendation:** Use json fallback with warning in console.

### 5.4 Nested Objects

How to handle deeply nested content?
```javascript
"content.author.address.street": { ... }
```

**Recommendation:** Support unlimited nesting via recursive getNestedValue/setNestedValue.

### 5.5 Array Fields

How to edit arrays of values?
```javascript
"content.tags": ["tag1", "tag2", "tag3"]
```

**Recommendation:** Create specialized field_view_array or field_view_tag_list. Each element can use its own field view.

---

## Appendix A: Migration Checklist

- [ ] Create new seed types (view, view-spec, field_view)
- [ ] Add GUIDs to kernel IDS constant
- [ ] Implement generic_view library
- [ ] Create core field views (text, textarea, number, checkbox, timestamp)
- [ ] Create markdown field views (readonly + editable)
- [ ] Update kernel-rendering module
- [ ] Test view lookup with new types
- [ ] Test rendering with view code
- [ ] Test rendering with view spec + generic view
- [ ] Create migration script
- [ ] Backup current system
- [ ] Run migration script
- [ ] Verify all items render correctly
- [ ] Test editing via views
- [ ] Update documentation
- [ ] Mark renderer/editor types as deprecated
- [ ] Create compatibility shims if needed

---

## Appendix B: Example Conversions

### Before: Markdown Note Renderer

```javascript
{
  id: "note_renderer",
  name: "note_renderer",
  type: "00000000-0000-0000-0000-000000000003", // renderer
  content: {
    for_type: "note",
    code: `
      export async function render(item, api) {
        // Editable markdown renderer
      }
    `
  }
}
```

### After: Markdown Note View

```javascript
{
  id: "note_view_markdown",
  name: "note_view_markdown",
  type: "00000000-0000-0000-0000-000000000010", // view
  content: {
    for_type: "note",
    capabilities: ["read", "write"],
    code: `
      export async function render(item, api) {
        // Same code, now explicitly declares capabilities
      }
    `
  }
}
```

### Before: Note Editor Spec

```javascript
{
  id: "note_editor",
  name: "note_editor",
  type: "00000000-0000-0000-0000-000000000009", // editor
  content: {
    for_type: "note",
    ui_hints: {
      "content.title": { 
        editor: "text",
        readonly: false,
        label: "Title" 
      }
    }
  }
}
```

### After: Note View Spec

```javascript
{
  id: "note_view_form",
  name: "note_view_form",
  type: "00000000-0000-0000-0000-000000000011", // view-spec
  content: {
    for_type: "note",
    ui_hints: {
      "content.title": { 
        field_view: "text",
        mode: "editable",
        label: "Title"
      }
    }
  }
}
```

---

## Appendix C: API Reference

### Kernel API - View Methods

```javascript
// Render item with default view
await api.showView(itemId: string): Promise<HTMLElement>

// Render item with specific view
await api.showView(itemId: string, viewId: string): Promise<HTMLElement>

// Render with mode override
await api.showView(
  itemId: string, 
  viewId: string, 
  options: { mode: 'readonly' | 'editable' }
): Promise<HTMLElement>

// Query available views for a type
await api.getViews(typeId: string): Promise<Item[]>

// Get default view for a type
await api.getDefaultView(typeId: string): Promise<Item>
```

### Field View Interface

```javascript
export function render(
  value: any,
  options: {
    mode: 'readonly' | 'editable',
    onChange?: (newValue: any) => void,
    label?: string,
    placeholder?: string,
    [key: string]: any  // Custom options
  },
  api: KernelAPI
): HTMLElement
```

### View Code Interface

```javascript
export async function render(
  item: Item,
  api: KernelAPI
): Promise<HTMLElement>
```

---

**END OF DOCUMENT**
