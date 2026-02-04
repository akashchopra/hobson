// Item: css-loader-lib
// ID: c3cebc22-4a33-4182-b9a7-166316ba004e
// Type: 66666666-0000-0000-0000-000000000000


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
