# CSS Cleanup Implementation

## Overview

This document describes the implementation of the CSS cleanup plan, which moved renderer-specific CSS out of the kernel and into a new CSS item system.

## What Was Done

### 1. Created CSS Infrastructure

**New Type Definition:**
- `css` type - A new type definition for CSS items, similar to `library` and `renderer`
- Type: `type_definition`
- Required fields: `['code']`

**New Library:**
- `css_loader_lib` - A library for loading CSS items into the document head
- Exports: `loadCSS(name, api)`, `unloadCSS(name)`, `reloadCSS(name, api)`
- Idempotent loading (won't duplicate if called multiple times)

**New CSS Item:**
- `context_menu_css` - The first CSS item, containing context menu styles
- Type: `css`
- Contains all the context menu CSS classes previously in the kernel

### 2. Updated Renderers

**viewport_renderer:**
- Now loads `context_menu_css` at render time using `css_loader_lib`
- This makes context menu styles available as a "standard UI library"

**container_renderer:**
- Replaced `.container-view` class with inline styles
- Styles: `flex: 1; display: flex; flex-direction: column; min-height: 0;`

**default_renderer:**
- Replaced `.json-view` class with inline styles
- Styles: `background: #f8f8f8; padding: 15px; border-radius: 4px; overflow-x: auto; font-family: "SF Mono", Monaco, "Courier New", monospace; font-size: 13px; line-height: 1.5;`

### 3. Updated Kernel

**Removed from hobson.html:**
- `.container-view` CSS (lines 46-52)
- `.json-view` CSS (lines 54-62)
- Context menu CSS (lines 98-174, ~76 lines)

**Total reduction:** ~95 lines of CSS removed from kernel

## Architecture

### CSS Loading Flow

```
viewport_renderer.render()
  ↓
await api.require('css_loader_lib')
  ↓
await cssLoader.loadCSS('context_menu_css', api)
  ↓
Fetch CSS item by name
  ↓
Inject <style> tag into document.head
  ↓
Context menu classes now available
```

### Key Design Decisions

**CSS as Items:**
- CSS is now stored as items, just like code and data
- CSS items are discoverable, searchable, and editable through the system
- Follows Hobson's "everything is an item" philosophy

**Zero Kernel Pollution:**
- CSS loading logic is in a library item, not kernel code
- Kernel has no knowledge of CSS loading
- Maintains minimal kernel principle

**Shared UI Library Pattern:**
- `context_menu_css` provides standard UI components
- Any renderer can load it to use context menu styling
- Other shared CSS can follow the same pattern

## Benefits

1. **Cleaner Separation:** Renderer-specific CSS lives with renderers, not in kernel
2. **Live Editing:** Modify CSS items → reload renderer → see changes (without kernel restart)
3. **Discoverability:** CSS is searchable and navigable like any item
4. **Extensibility:** Easy to add new CSS items for different UI components
5. **Type Safety:** CSS items have their own type for semantic clarity
6. **Minimal Kernel:** Kernel stays focused on bootstrap functionality

## How to Use

### Loading CSS in a Renderer

```javascript
export async function render(item, api) {
  // Load CSS item
  const cssLoader = await api.require('css_loader_lib');
  await cssLoader.loadCSS('context_menu_css', api);

  // Now can use .context-menu classes
  const menu = api.createElement('div', {
    class: 'context-menu'
  }, [...]);

  return menu;
}
```

### Creating a New CSS Item

```javascript
// Via REPL
await api.create({
  name: 'my_component_css',
  type: '<css-type-id>', // Use the CSS type created above
  children: [],
  content: {
    description: 'CSS for my custom component',
    code: `
      .my-component {
        /* styles here */
      }
    `
  }
});
```

### Hot-Reloading CSS

```javascript
const cssLoader = await api.require('css_loader_lib');
await cssLoader.reloadCSS('context_menu_css', api);
```

## Testing Checklist

After running the master script:

- [ ] Page loads without errors
- [ ] Viewport renders correctly
- [ ] Navigation buttons work
- [ ] Right-click context menu appears and is styled correctly
- [ ] Context menu hover effects work
- [ ] Context menu submenus work
- [ ] Container items display correctly (if you have any)
- [ ] Default renderer (JSON view) displays correctly
- [ ] Selection indicators work
- [ ] No CSS classes are missing or broken

## Files Modified

**Kernel:**
- `src/hobson.html` - Removed 3 CSS sections (~95 lines)

**REPL Scripts Created:**
- `src/REPL Scripts/create_css_infrastructure.js`
- `src/REPL Scripts/update_viewport_renderer.js`
- `src/REPL Scripts/update_container_renderer_css.js`
- `src/REPL Scripts/update_default_renderer_css.js`
- `src/REPL Scripts/css_cleanup_master.js` (master script)

## Execution Instructions

1. Open Hobson in your browser
2. Open the REPL (Ctrl+`)
3. Run the master script:

```javascript
// Copy and paste the contents of css_cleanup_master.js
// Or load it if you have a script loading mechanism
```

4. Reload the page to see the changes
5. Test all functionality from the checklist above

## Future Enhancements

- Create more CSS items for other UI components (tooltips, modals, forms, etc.)
- Add CSS versioning/theming support
- Create a CSS item browser/editor
- Add CSS validation/linting in css_loader_lib
- Support CSS preprocessing (variables, nesting, etc.)

## Rollback Plan

If issues occur, you can rollback by:

1. Restore the original `hobson.html` from git
2. Delete the new items (css type, css_loader_lib, context_menu_css)
3. Restore original renderer code from `item_backup.json`

Alternatively, you can run in Safe Mode (?safe=1) which only loads the kernel, not user code items.
