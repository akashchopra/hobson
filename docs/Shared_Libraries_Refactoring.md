# Shared Libraries Refactoring

## Problem

As identified in the code review, there was significant code duplication between `note_renderer` and `tag_browser_renderer`:

1. **Tag Tree Building** (~50 lines duplicated)
   - Both renderers had nearly identical `buildTree`/`buildTagTree` functions
   - Both implemented the same logic for creating hierarchical trees from flat tag lists
   - Both sorted tags by name and handled parent-child relationships identically

2. **Tag Rendering** (~80 lines duplicated)
   - Both renderers rendered hierarchical tag trees with expand/collapse
   - Both implemented color dots, tag names, and click handlers
   - Both managed expanded state in the same way

## Solution

Created two new library items to extract and share the common code:

### 1. `tag_tree_builder` Library

**Purpose:** Builds hierarchical tree structures from flat tag lists

**Exports:**
- `buildTagTree(tags)` - Converts flat array to hierarchical tree
- `getTagName(tagNode)` - Gets display name from tag node
- `getTagColor(tagNode)` - Gets color from tag node

**Features:**
- Creates map for O(1) lookup
- Handles parent-child relationships
- Treats orphaned tags (with missing parents) as roots
- Sorts all nodes alphabetically by name

### 2. `tag_picker_ui` Library

**Purpose:** Provides UI components for tag trees

**Exports:**
- `renderTagPicker(config, api)` - For selecting tags (edit mode)
- `renderTagBrowser(config, api)` - For browsing tags (view mode)

**Features:**
- Hierarchical rendering with expand/collapse
- Color dots and styled nodes
- Callback-based event handling
- Manages depth-based indentation
- Shows selected state with opacity

## Changes

### tag_browser_renderer
**Before:** 279 lines with embedded tree building and rendering
**After:** 154 lines using shared libraries
**Reduction:** ~125 lines (~45% reduction)

Key changes:
- Imports `tag_tree_builder` and `tag_picker_ui`
- Uses `treeBuilder.buildTagTree()` instead of inline `buildTree()`
- Uses `tagPickerUI.renderTagBrowser()` instead of inline rendering
- Kept only browser-specific logic (showing tagged items)

### note_renderer
**Before:** 570 lines with embedded tree building and tag picker
**After:** ~490 lines using shared libraries
**Reduction:** ~80 lines (~14% reduction)

Key changes:
- Imports `tag_tree_builder` and `tag_picker_ui`
- Uses `treeBuilder.buildTagTree()` instead of inline `buildTagTree()`
- Uses `tagPickerUI.renderTagPicker()` instead of inline `renderTagPicker()`
- Kept only note-specific logic (editing, saving tags)

## Benefits

1. **DRY Principle:** Tag logic now exists in one place
2. **Maintainability:** Bug fixes and improvements apply to both renderers
3. **Testability:** Shared logic can be tested independently
4. **Reusability:** Other renderers can use these libraries
5. **Clarity:** Renderer code focuses on renderer-specific concerns

## Migration

To apply these changes, run these scripts in the REPL in order:

1. `create_tag_tree_builder.js` - Creates the tree builder library
2. `create_tag_picker_ui.js` - Creates the UI component library
3. `update_renderers_to_use_libraries.js` - Updates both renderers

## Future Opportunities

Other candidates for extraction:
- Search/filter logic (appears in multiple renderers)
- Markdown rendering setup (if used by multiple renderers)
- Common UI patterns (buttons, forms, dialogs)
