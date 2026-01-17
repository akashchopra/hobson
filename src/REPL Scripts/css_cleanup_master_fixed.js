// REPL Script: CSS Cleanup - Master Script (Fixed for REPL API)
// Runs all CSS cleanup steps in order

console.log('=== CSS Cleanup Master Script ===\n');

// Step 1: Create CSS infrastructure
console.log('Step 1: Creating CSS infrastructure...');

// Create CSS type definition using helper
const cssTypeId = crypto.randomUUID();
await api.set({
  id: cssTypeId,
  name: 'css',
  type: '00000000-0000-0000-0000-000000000001', // type_definition
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    description: 'Cascading Style Sheets - defines visual styling that can be loaded by renderers',
    required_fields: ['code']
  }
});

// Create css_loader_lib using helper
const cssLoaderLibId = crypto.randomUUID();
await api.set({
  id: cssLoaderLibId,
  name: 'css_loader_lib',
  type: '00000000-0000-0000-0000-000000000004', // library
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    description: 'Library for loading CSS items into the document head',
    code: `
/**
 * CSS Loader Library
 * Loads CSS items into the document head
 */

/**
 * Load a CSS item by name
 * @param {string} name - Name of the CSS item to load
 * @param {object} api - Hobson API
 * @returns {Promise<void>}
 */
export async function loadCSS(name, api) {
  const styleId = 'hobson-css-' + name;

  // Check if already loaded (idempotent)
  if (document.getElementById(styleId)) {
    return; // Already loaded
  }

  // Fetch CSS item by name
  const items = await api.query({ name });
  const cssItem = items.length > 0 ? items[0] : null;

  if (!cssItem) {
    throw new Error('CSS item not found: ' + name);
  }

  // Inject CSS into document head
  const styleTag = document.createElement('style');
  styleTag.id = styleId;
  styleTag.textContent = cssItem.content.code || '';
  document.head.appendChild(styleTag);

  console.log('Loaded CSS:', name);
}

/**
 * Unload a CSS item by name (useful for hot-reloading)
 * @param {string} name - Name of the CSS item to unload
 * @returns {boolean} - True if unloaded, false if not found
 */
export function unloadCSS(name) {
  const styleId = 'hobson-css-' + name;
  const styleTag = document.getElementById(styleId);

  if (styleTag) {
    styleTag.remove();
    console.log('Unloaded CSS:', name);
    return true;
  }

  return false;
}

/**
 * Reload a CSS item (unload + load)
 * @param {string} name - Name of the CSS item to reload
 * @param {object} api - Hobson API
 * @returns {Promise<void>}
 */
export async function reloadCSS(name, api) {
  unloadCSS(name);
  await loadCSS(name, api);
}
`
  }
});

// Create context_menu_css
const contextMenuCssId = crypto.randomUUID();
await api.set({
  id: contextMenuCssId,
  name: 'context_menu_css',
  type: cssTypeId,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    description: 'Standard context menu styling for viewport and other UI components',
    code: `/* Context Menu Styles */
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 180px;
  padding: 4px 0;
  z-index: 10000;
  display: none;
}

.context-menu.visible {
  display: block;
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.context-menu-item:hover {
  background: #f0f0f0;
}

.context-menu-item.disabled {
  color: #999;
  cursor: default;
}

.context-menu-item.disabled:hover {
  background: transparent;
}

.context-menu-item.selected {
  font-weight: 500;
  color: #0066cc;
}

.context-menu-separator {
  height: 1px;
  background: #e0e0e0;
  margin: 4px 0;
}

.context-menu-submenu {
  position: relative;
}

.context-menu-submenu::after {
  content: '\\25b6';
  font-size: 10px;
  margin-left: auto;
  color: #666;
}

.context-menu-submenu-items {
  position: absolute;
  left: 100%;
  top: 0;
  background: white;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 160px;
  padding: 4px 0;
  display: none;
}

.context-menu-submenu:hover .context-menu-submenu-items {
  display: block;
}
`
  }
});

console.log('✓ CSS infrastructure created');
console.log('  - CSS Type ID:', cssTypeId);
console.log('  - css_loader_lib ID:', cssLoaderLibId);
console.log('  - context_menu_css ID:', contextMenuCssId);
console.log();

// Step 2: Update container_renderer
console.log('Step 2: Updating container_renderer...');
const containerRendererResults = await api.query({ name: 'container_renderer' });
const containerRenderer = containerRendererResults.length > 0 ? containerRendererResults[0] : null;

if (!containerRenderer) {
  throw new Error('container_renderer not found');
}

containerRenderer.content.code = containerRenderer.content.code.replace(
  "api.createElement('div', { class: 'container-view' }, [])",
  "api.createElement('div', { style: 'flex: 1; display: flex; flex-direction: column; min-height: 0;' }, [])"
);
containerRenderer.modified = Date.now();
await api.set(containerRenderer);
console.log('✓ container_renderer updated (inline styles)');
console.log();

// Step 3: Update default_renderer
console.log('Step 3: Updating default_renderer...');
const defaultRendererResults = await api.query({ name: 'default_renderer' });
const defaultRenderer = defaultRendererResults.length > 0 ? defaultRendererResults[0] : null;

if (!defaultRenderer) {
  throw new Error('default_renderer not found');
}

defaultRenderer.content.code = defaultRenderer.content.code.replace(
  "['pre', { class: 'json-view' }, [",
  "['pre', { style: 'background: #f8f8f8; padding: 15px; border-radius: 4px; overflow-x: auto; font-family: \"SF Mono\", Monaco, \"Courier New\", monospace; font-size: 13px; line-height: 1.5;' }, ["
);
defaultRenderer.modified = Date.now();
await api.set(defaultRenderer);
console.log('✓ default_renderer updated (inline styles)');
console.log();

// Step 4: Update viewport_renderer
console.log('Step 4: Updating viewport_renderer...');
const viewportRendererResults = await api.query({ name: 'viewport_renderer' });
const viewportRenderer = viewportRendererResults.length > 0 ? viewportRendererResults[0] : null;

if (!viewportRenderer) {
  throw new Error('viewport_renderer not found');
}

// Check if it already has the CSS loader (idempotent)
if (viewportRenderer.content.code.includes('css_loader_lib')) {
  console.log('⚠ viewport_renderer already uses css_loader_lib, skipping update');
} else {
  // Insert CSS loader code after the function declaration
  viewportRenderer.content.code = viewportRenderer.content.code.replace(
    'export async function render(item, api) {',
    `export async function render(item, api) {
  // Load standard context menu CSS
  const cssLoader = await api.require('css_loader_lib');
  await cssLoader.loadCSS('context_menu_css', api);
`
  );
  viewportRenderer.modified = Date.now();
  await api.set(viewportRenderer);
  console.log('✓ viewport_renderer updated (CSS loader integration)');
}
console.log();

// Summary
console.log('=== CSS Cleanup Complete ===');
console.log();
console.log('Changes made:');
console.log('  1. Created CSS type definition for future CSS items');
console.log('  2. Created css_loader_lib for loading CSS from items');
console.log('  3. Created context_menu_css as the first CSS item');
console.log('  4. Updated viewport_renderer to load context_menu_css');
console.log('  5. Updated container_renderer to use inline styles');
console.log('  6. Updated default_renderer to use inline styles');
console.log();
console.log('The kernel (hobson.html) has been manually updated to remove:');
console.log('  - .container-view CSS');
console.log('  - .json-view CSS');
console.log('  - Context menu CSS');
console.log();
console.log('Next: Reload the page to test the changes!');
