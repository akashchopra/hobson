// Item: context-menu-lib
// ID: a1b2c3d4-ctx0-menu-0000-000000000000
// Type: 66666666-0000-0000-0000-000000000000

// Context menu library — builds context menu DOM for items.
// Supports interactive mode (with handlers) and inert mode (for documentation).

// Default window dimensions for new spatial children
const DEFAULT_WINDOW_WIDTH = 600;
const DEFAULT_WINDOW_HEIGHT = 500;

// Internal: add a new child item to a parent
// parentId: the item to add a child to
// clickCoords: {x, y} if adding from a spatial context, null otherwise
async function addChildToItem(api, parentId, clickCoords) {
  // Re-require to pick up any edits (see docs/Hot-Reloading Libraries.md)
  const typePicker = await api.require('type-picker-lib');
  const selectedType = await typePicker.showTypePicker(api);
  if (!selectedType) return;

  const newItem = {
    id: crypto.randomUUID(),
    name: new Date().toISOString(),
    type: selectedType,
    created: Date.now(),
    modified: Date.now(),
    attachments: [],
    content: {}
  };

  await api.set(newItem);

  // Get parent and determine if it's being rendered spatially
  const parent = await api.get(parentId);
  const attachments = parent.attachments || [];

  // Check if parent is rendered spatially by looking at existing attachments
  // If attachments have position data (view.x, view.y), it's spatial
  const isSpatial = attachments.length > 0
    ? attachments.some(c => c.view?.x !== undefined || c.view?.y !== undefined)
    : false;

  if (isSpatial || clickCoords) {
    // Spatial: add with position in view object
    const maxZ = attachments.length > 0 ? Math.max(...attachments.map(c => c.view?.z || 1000)) : 999;
    const x = clickCoords?.x || 50;
    const y = clickCoords?.y || 50;

    attachments.push({
      id: newItem.id,
      view: {
        x: x,
        y: y,
        width: DEFAULT_WINDOW_WIDTH,
        height: DEFAULT_WINDOW_HEIGHT,
        z: maxZ + 1
      }
    });
  } else {
    // Non-spatial: just add the ID reference
    attachments.push({ id: newItem.id });
  }

  parent.attachments = attachments;
  parent.modified = Date.now();
  await api.update(parent);
  api.viewport.select(newItem.id, parentId);

  // Scroll new item into view after DOM updates
  setTimeout(() => {
    const el = document.querySelector(`[data-item-id="${newItem.id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 0);
}

// Internal: add an existing item as child to a parent
async function addExistingChildToItem(api, parentId, childId, clickCoords) {
  const parent = await api.get(parentId);
  const attachments = parent.attachments || [];

  // Check if already a child
  if (attachments.some(c => c.id === childId)) {
    alert('This item is already attached.');
    return;
  }

  // Check if parent is rendered spatially
  const isSpatial = attachments.length > 0
    ? attachments.some(c => c.view?.x !== undefined || c.view?.y !== undefined)
    : false;

  if (isSpatial || clickCoords) {
    const maxZ = attachments.length > 0 ? Math.max(...attachments.map(c => c.view?.z || 1000)) : 999;
    const x = clickCoords?.x || 50;
    const y = clickCoords?.y || 50;

    attachments.push({
      id: childId,
      view: {
        x: x,
        y: y,
        width: DEFAULT_WINDOW_WIDTH,
        height: DEFAULT_WINDOW_HEIGHT,
        z: maxZ + 1
      }
    });
  } else {
    attachments.push({ id: childId });
  }

  parent.attachments = attachments;
  parent.modified = Date.now();
  await api.update(parent);
  api.viewport.select(childId, parentId);

  // Scroll new item into view after DOM updates
  setTimeout(() => {
    const el = document.querySelector(`[data-item-id="${childId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 0);
}

// Internal: show item picker modal for adding existing item
async function showExistingItemPicker(api, parentId, clickCoords) {
  // Re-require to pick up any edits (see docs/Hot-Reloading Libraries.md)
  const modalLib = await api.require('modal-lib');
  const searchLib = await api.require('item-search-lib');

  const searchContainer = api.createElement('div', {}, []);

  const { close } = modalLib.showModal({
    title: 'Add Existing Item',
    width: '600px',
    maxHeight: '80vh',
    api,
    content: searchContainer
  });

  // createSearchUI called after modal is in DOM so autoFocus works
  searchLib.createSearchUI(
    searchContainer,
    async (selectedItem) => {
      close();
      await addExistingChildToItem(api, parentId, selectedItem.id, clickCoords);
    },
    api,
    { placeholder: 'Search for items to add...', autoFocus: true }
  );
}

/**
 * Build "Add Child" submenu with "New Item..." and "Existing Item..." options.
 * When context is null, items are inert (no onclick) — used in documentation.
 */
export function buildAddChildSubmenu(api, itemId, context) {
  const frag = document.createDocumentFragment();
  const addChildItem = api.createElement('div', { class: 'context-menu-item context-menu-submenu' }, ['Add Child']);
  const addChildSubmenu = api.createElement('div', { class: 'context-menu-submenu-items' }, []);

  if (context) {
    const newItemOption = api.createElement('div', { class: 'context-menu-item' }, ['New Item...']);
    newItemOption.onclick = async () => {
      context.onDismiss();
      await addChildToItem(api, itemId, context.getClickCoords());
    };
    addChildSubmenu.appendChild(newItemOption);

    const existingItemOption = api.createElement('div', { class: 'context-menu-item' }, ['Existing Item...']);
    existingItemOption.onclick = () => {
      context.onDismiss();
      showExistingItemPicker(api, itemId, context.getClickCoords());
    };
    addChildSubmenu.appendChild(existingItemOption);
  }

  addChildItem.appendChild(addChildSubmenu);
  frag.appendChild(addChildItem);
  return frag;
}

/**
 * Build simple action menu items.
 * When context is null, items are inert (no onclick) — used in documentation.
 */
export function buildSimpleActions(api, itemId, context) {
  const frag = document.createDocumentFragment();

  // Copy ID
  const copyIdEl = api.createElement('div', { class: 'context-menu-item' }, ['Copy ID']);
  if (context) {
    copyIdEl.onclick = async () => {
      context.onDismiss();
      await navigator.clipboard.writeText(itemId);
      console.log('Copied ID:', itemId);
    };
  }
  frag.appendChild(copyIdEl);

  // Duplicate
  const duplicateEl = api.createElement('div', { class: 'context-menu-item' }, ['Duplicate']);
  if (context) {
    duplicateEl.onclick = async () => {
      context.onDismiss();
      const original = await api.get(itemId);
      const newContent = { ...original.content };
      if (newContent.title) newContent.title += ' (copy)';
      const duplicate = {
        id: crypto.randomUUID(),
        name: original.name ? original.name + ' (copy)' : undefined,
        type: original.type,
        created: Date.now(),
        modified: Date.now(),
        attachments: [],
        content: newContent
      };
      await api.set(duplicate);
      const instances = api.instances.getByItemId(itemId);
      const siblingContainer = instances?.[0]?.siblingContainer;
      if (siblingContainer) {
        siblingContainer.addSibling(duplicate.id);
      } else {
        await api.navigate(duplicate.id);
      }
    };
  }
  frag.appendChild(duplicateEl);

  // Make Root
  const makeRootEl = api.createElement('div', { class: 'context-menu-item' }, ['Make Root']);
  if (context) {
    makeRootEl.onclick = async () => {
      context.onDismiss();
      let viewConfig = null;
      if (context.parentId) {
        const parent = await api.get(context.parentId);
        const childSpec = parent.attachments?.find(c => c.id === itemId);
        viewConfig = childSpec?.view || null;
      }
      await api.navigate(itemId);
      if (viewConfig) {
        if (viewConfig.type) {
          await api.viewport.setRootView(viewConfig.type);
        }
        const { type, ...otherConfig } = viewConfig;
        if (Object.keys(otherConfig).length > 0 && api.viewport.updateRootViewConfig) {
          await api.viewport.updateRootViewConfig(otherConfig);
        }
        await window.kernel.renderViewport();
      }
    };
  }
  frag.appendChild(makeRootEl);

  // Export as JSON
  const exportEl = api.createElement('div', { class: 'context-menu-item' }, ['Export as JSON']);
  if (context) {
    exportEl.onclick = async () => {
      context.onDismiss();
      const itemData = await api.get(itemId);
      const json = JSON.stringify(itemData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (itemData.name || itemData.content?.title || itemId.slice(0, 8)) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
  }
  frag.appendChild(exportEl);

  // Separator + Delete
  frag.appendChild(api.createElement('div', { class: 'context-menu-separator' }, []));
  const deleteEl = api.createElement('div', { class: 'context-menu-item', style: 'color: var(--color-danger);' }, ['Delete']);
  if (context) {
    deleteEl.onclick = async () => {
      context.onDismiss();
      const itemData = await api.get(itemId);
      const itemLabel = itemData.name || itemData.content?.title || itemId.slice(0, 8);
      if (confirm('Delete "' + itemLabel + '"? This cannot be undone.')) {
        await api.delete(itemId);
        const WORKSPACE_ID = '00000000-0000-0000-0000-000000000006';
        if (itemId === context.rootId) {
          await api.navigate(WORKSPACE_ID);
        } else {
          await api.navigate(context.rootId);
        }
      }
    };
  }
  frag.appendChild(deleteEl);

  return frag;
}

/**
 * Build the full item context menu.
 * Phase 2b: Add Child submenu + simple actions. Later phases add View As, etc.
 */
export async function buildItemMenu(api, paramsOrItemId, context) {
  const itemId = typeof paramsOrItemId === 'string' ? paramsOrItemId : paramsOrItemId.itemId;

  // Load CSS for documentation/transclusion mode
  if (!context) {
    const cssLoader = await api.require('css-loader-lib');
    await cssLoader.loadCSS('context-menu-css', api);
  }

  const container = api.createElement('div', {
    class: 'context-menu',
    style: 'position: static; display: block; box-shadow: none; max-width: 220px;'
  });

  container.appendChild(buildAddChildSubmenu(api, itemId, context));
  container.appendChild(api.createElement('div', { class: 'context-menu-separator' }, []));
  container.appendChild(buildSimpleActions(api, itemId, context));
  return container;
}
