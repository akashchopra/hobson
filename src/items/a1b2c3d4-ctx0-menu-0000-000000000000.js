// Item: context-menu-lib
// ID: a1b2c3d4-ctx0-menu-0000-000000000000
// Type: 66666666-0000-0000-0000-000000000000

// Context menu library — builds context menu DOM for items.
// Supports interactive mode (with handlers) and inert mode (for documentation).

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
 * Phase 2a: simple actions only. Later phases add Add Child, View As, etc.
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

  container.appendChild(buildSimpleActions(api, itemId, context));
  return container;
}
