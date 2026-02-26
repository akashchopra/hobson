// Item: context-menu-lib
// ID: 2cc0a1c5-5c09-49bd-834a-eaa2d0183b6c
// Type: 66666666-0000-0000-0000-000000000000

// Context menu library — builds context menu DOM for items.
// Supports interactive mode (with handlers) and inert mode (for documentation).

// Default window dimensions for new spatial children
const DEFAULT_WINDOW_WIDTH = 600;
const DEFAULT_WINDOW_HEIGHT = 500;
const STARRED_TAG_ID = 'c0c0c0c0-0060-0000-0000-000000000000';

// Internal: add a new child item to a parent
// parentId: the item to add a child to
// clickCoords: {x, y} if adding from a spatial context, null otherwise
async function addChildToItem(api, parentId, clickCoords) {
  // Re-require to pick up any edits (see docs/Hot-Reloading Libraries.md)
  const typePicker = await api.require('type-picker-lib');
  const selectedType = await typePicker.showTypePicker(api);
  if (!selectedType) return;

  // Find editable view so new items open in edit mode
  const editView = await findEditableView(api, selectedType);

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

    const view = {
      x: x,
      y: y,
      width: DEFAULT_WINDOW_WIDTH,
      height: DEFAULT_WINDOW_HEIGHT,
      z: maxZ + 1
    };
    if (editView) view.type = editView.id;

    attachments.push({ id: newItem.id, view });
  } else {
    // Non-spatial: just add the ID reference, with edit view if available
    const spec = { id: newItem.id };
    if (editView) spec.view = { type: editView.id };
    attachments.push(spec);
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

// Internal: show related items for an item in a modal
const MODAL_FRAME_ID = 'b0b0b0b0-0002-0000-0000-000000000000';
const MODAL_FRAME_VIEW_ID = 'b0b0b0b0-0001-0000-0000-000000000000';
const RELATED_WIDGET_TYPE_ID = '1e9ffc8d-0e0d-4020-9865-b4ca6a05cbae';

async function showRelatedItemsModal(api, targetItemId) {
  // Remove existing modal if present
  const existing = document.getElementById('related-items-modal-overlay');
  if (existing) existing.remove();

  // Create a transient related-items-widget with targetId set
  const widgetId = 'b0b0b0b0-f001-0000-0000-000000000000';
  const targetItem = await api.get(targetItemId);
  await api.set({
    id: widgetId,
    name: 'Related: ' + (targetItem.name || targetItemId.substring(0, 8)),
    type: RELATED_WIDGET_TYPE_ID,
    created: Date.now(),
    modified: Date.now(),
    attachments: [],
    content: { targetId: targetItemId }
  });

  // Set as Modal Frame's attachment
  const frame = await api.get(MODAL_FRAME_ID);
  frame.attachments = [{ id: widgetId }];
  frame.modified = Date.now();
  await api.set(frame);

  // Render and append to body
  const overlayNode = await api.renderItem(MODAL_FRAME_ID, MODAL_FRAME_VIEW_ID);
  overlayNode.id = 'related-items-modal-overlay';
  document.body.appendChild(overlayNode);
}

/**
 * Find the editable view for a given type.
 * Returns the view item if found, or null.
 * Prefers direct (non-inherited) matches over inherited ones.
 * Skips debug/hidden category views.
 */
export async function findEditableView(api, typeId) {
  const views = await api.getViews(typeId);
  let bestMatch = null;
  let bestIsDirect = false;

  for (const { view, inherited } of views) {
    // Skip debug/hidden views
    const category = view.content?.category;
    if (category === 'debug' || category === 'hidden') continue;

    // Check if any field in ui_hints has mode: "editable"
    const hints = view.content?.ui_hints;
    if (!hints) continue;

    const hasEditable = Object.values(hints).some(h => h.mode === 'editable');
    if (!hasEditable) continue;

    const isDirect = !inherited;
    // Prefer direct match over inherited
    if (!bestMatch || (isDirect && !bestIsDirect)) {
      bestMatch = view;
      bestIsDirect = isDirect;
    }
  }

  return bestMatch;
}

/**
 * Build "Add Child" submenu with "New Item..." and "Existing Item..." options.
 * When context is null, items are inert (no onclick) — used in documentation.
 */
export function buildAddChildSubmenu(api, itemId, context) {
  const frag = document.createDocumentFragment();
  const addChildItem = api.createElement('div', { class: 'context-menu-item context-menu-submenu' }, ['Add Child']);
  const addChildSubmenu = api.createElement('div', { class: 'context-menu-submenu-items' }, []);

  const newItemOption = api.createElement('div', { class: 'context-menu-item' }, ['New Item...']);
  if (context) {
    newItemOption.onclick = async () => {
      context.onDismiss();
      await addChildToItem(api, itemId, context.getClickCoords());
    };
  }
  addChildSubmenu.appendChild(newItemOption);

  const existingItemOption = api.createElement('div', { class: 'context-menu-item' }, ['Existing Item...']);
  if (context) {
    existingItemOption.onclick = () => {
      context.onDismiss();
      showExistingItemPicker(api, itemId, context.getClickCoords());
    };
  }
  addChildSubmenu.appendChild(existingItemOption);

  addChildItem.appendChild(addChildSubmenu);
  frag.appendChild(addChildItem);
  return frag;
}

/**
 * Build simple action menu items.
 * When context is null, items are inert (no onclick) — used in documentation.
 */
export async function buildSimpleActions(api, itemId, context) {
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
      
      const duplicate = {
        id: crypto.randomUUID(),
        name: original.name ? original.name + ' (copy)' : undefined,
        type: original.type,
        created: Date.now(),
        modified: Date.now(),
        attachments: [...(original.attachments || [])],
        content: newContent
      };
      await api.set(duplicate);
      const parentId = api.getParentId();
      if (parentId) {
        await api.attach(parentId, duplicate.id);
      } else {
        api.navigate(duplicate.id);
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

  // Star / Unstar
  const itemData = await api.get(itemId);
  const isStarred = (itemData.content?.tags || []).includes(STARRED_TAG_ID);
  const starEl = api.createElement('div', { class: 'context-menu-item' }, [isStarred ? 'Unstar' : 'Star']);
  if (context) {
    starEl.onclick = async () => {
      context.onDismiss();
      const item = await api.get(itemId);
      if (!item.content) item.content = {};
      if (!item.content.tags) item.content.tags = [];
      const tags = item.content.tags;
      const idx = tags.indexOf(STARRED_TAG_ID);
      if (idx >= 0) {
        tags.splice(idx, 1);
      } else {
        tags.push(STARRED_TAG_ID);
      }
      item.modified = Date.now();
      await api.set(item);
    };
  }
  frag.appendChild(starEl);

  // Related Items
  const relatedEl = api.createElement('div', { class: 'context-menu-item' }, ['Related Items...']);
  if (context) {
    relatedEl.onclick = async () => {
      context.onDismiss();
      await showRelatedItemsModal(api, itemId);
    };
  }
  frag.appendChild(relatedEl);

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
 * Build "View As..." submenu showing available views for an item.
 * Returns { fragment, viewState } where viewState contains debugViews,
 * currentViewId, and effectiveViewId for use by buildDebugSubmenu.
 * When context is null, items are inert (no onclick) — used in documentation.
 */
export async function buildViewAsSubmenu(api, itemId, context) {
  const menuItem = await api.get(itemId);
  const frag = document.createDocumentFragment();

  const displayAsItem = api.createElement('div', { class: 'context-menu-item context-menu-submenu' }, ['View As...']);
  const displayAsSubmenu = api.createElement('div', { class: 'context-menu-submenu-items' }, []);

  // Get available views for this type
  const views = await api.getViews(menuItem.type);

  // Get current view override (for checkmark display)
  let currentViewId = null;
  if (context) {
    if (context.parentId) {
      const parent = await api.get(context.parentId);
      const childSpec = parent.attachments?.find(c => c.id === itemId);
      currentViewId = childSpec?.view?.type || null;
    } else {
      currentViewId = await api.viewport.getRootView();
    }
  }

  // Get effective view from preferences (fallback if no contextual override)
  const effectiveView = await api.getEffectiveView(itemId);
  const effectiveViewId = effectiveView?.id || null;

  // The view to use as background when switching to a wrapper view:
  // Prefer the explicit contextual override (currentViewId), fall back to effective view
  const currentlyRenderedViewId = currentViewId || effectiveViewId;

  // Separate normal views from debug views
  const normalViews = views.filter(v => v.view.content?.category !== 'debug' && v.view.content?.category !== 'hidden');
  const debugViews = views.filter(v => v.view.content?.category === 'debug');

  if (normalViews.length === 0) {
    const noViews = api.createElement('div', { class: 'context-menu-item disabled' }, ['(No views available)']);
    displayAsSubmenu.appendChild(noViews);
  } else {
    // Sort views alphabetically by display name
    const sortedViews = [...normalViews].sort((a, b) => {
      const nameA = a.view.content?.displayName || a.view.name || a.view.id.slice(0, 8);
      const nameB = b.view.content?.displayName || b.view.name || b.view.id.slice(0, 8);
      return nameA.localeCompare(nameB);
    });

    for (const { view } of sortedViews) {
      const isActive = (currentViewId || effectiveViewId) === view.id;
      let label = view.content?.displayName || view.name || view.id.slice(0, 8);
      if (isActive) label += ' \u2713';

      // Check if active view has submenu items to contribute
      let viewMenuItems = null;
      if (isActive && context) {
        try {
          const viewModule = await api.require(view.id);
          if (viewModule && typeof viewModule.getViewMenuItems === 'function') {
            // Create wrapped API with correct context for the nested item
            const wrappedApi = {
              ...api,
              getViewConfig: async () => {
                if (context.parentId) {
                  const parent = await api.get(context.parentId);
                  const childSpec = parent.attachments?.find(c => c.id === itemId);
                  return childSpec?.view || null;
                } else {
                  return await api.viewport.getRootViewConfig();
                }
              },
              updateViewConfig: async (updates) => {
                if (context.parentId) {
                  const parent = await api.get(context.parentId);
                  const childIndex = parent.attachments?.findIndex(c => c.id === itemId);
                  if (childIndex >= 0) {
                    const currentChild = parent.attachments[childIndex];
                    parent.attachments[childIndex] = {
                      ...currentChild,
                      view: { ...(currentChild.view || {}), ...updates }
                    };
                    parent.modified = Date.now();
                    await api.set(parent);
                    return true;
                  }
                } else {
                  await api.viewport.updateRootViewConfig(updates);
                  return true;
                }
                return false;
              },
              getParentId: () => context.parentId || null
            };
            viewMenuItems = await viewModule.getViewMenuItems(menuItem, wrappedApi);
          }
        } catch (e) {
          // View module doesn't export getViewMenuItems or failed to load
        }
      }

      if (viewMenuItems && viewMenuItems.length > 0) {
        // Active view with submenu items - create submenu
        const viewOption = api.createElement('div', {
          class: 'context-menu-item context-menu-submenu' + (isActive ? ' selected' : '')
        }, [label]);

        const viewSubmenu = api.createElement('div', { class: 'context-menu-submenu-items' }, []);

        for (const menuItemDef of viewMenuItems) {
          const subItem = api.createElement('div', {
            class: 'context-menu-item' + (menuItemDef.checked ? ' selected' : '')
          }, [menuItemDef.label]);

          if (context) {
            subItem.onclick = async () => {
              context.onDismiss();
              if (menuItemDef.onClick) {
                await menuItemDef.onClick();
              }
            };
          }
          viewSubmenu.appendChild(subItem);
        }

        viewOption.appendChild(viewSubmenu);
        displayAsSubmenu.appendChild(viewOption);
      } else {
        // Normal view option - click to switch
        const viewOption = api.createElement('div', {
          class: 'context-menu-item' + (isActive ? ' selected' : '')
        }, []);

        viewOption.textContent = label;

        if (context) {
          viewOption.onclick = async () => {
            context.onDismiss();
            if (context.parentId) {
              const parent = await api.get(context.parentId);
              const childIndex = parent.attachments.findIndex(c => c.id === itemId);
              if (childIndex >= 0) {
                const currentChild = parent.attachments[childIndex];
                const currentView = currentChild.view || {};

                const newView = {
                  ...currentView,
                  type: view.id,
                  innerView: currentlyRenderedViewId ? { type: currentlyRenderedViewId } : undefined
                };

                parent.attachments[childIndex] = {
                  ...currentChild,
                  previousView: currentView.type ? { ...currentView } : null,
                  view: newView
                };
                parent.modified = Date.now();
                await api.set(parent);
              }
              await api.rerenderItem(itemId);
            } else {
              await api.viewport.updateRootViewConfig({
                type: view.id,
                innerView: currentlyRenderedViewId ? { type: currentlyRenderedViewId } : undefined
              });
              await api.rerenderItem(itemId);
            }
          };
        }
        displayAsSubmenu.appendChild(viewOption);
      }
    }
  }

  displayAsItem.appendChild(displayAsSubmenu);
  frag.appendChild(displayAsItem);

  return {
    fragment: frag,
    viewState: { debugViews, currentViewId, effectiveViewId }
  };
}

// Internal: Build the view settings panel content (three-level preference UI).
// When onRefresh is provided, selects and clear buttons are interactive.
// When onRefresh is null (inert/documentation mode), selects are disabled and no handlers attached.
async function buildViewSettingsPanelContent(api, itemId, parentId, onRefresh) {
  const item = await api.get(itemId);
  const typeItem = await api.get(item.type);
  const typeName = typeItem.name || 'item';
  const views = await api.getViews(item.type);
  const effectiveView = await api.getEffectiveView(itemId);

  // Get current values at each level
  const contextualViewId = await api.getContextualView(itemId, parentId);
  const itemPreferredViewId = item.preferredView || null;
  const typePreferredViewId = typeItem.preferredView || null;

  // Helper to get view name by ID
  const getViewName = async (viewId) => {
    if (!viewId) return 'None';
    try {
      const v = await api.get(viewId);
      return v.content?.displayName || v.name || viewId.slice(0, 8);
    } catch {
      return viewId.slice(0, 8) + ' (missing)';
    }
  };

  const body = api.createElement('div', {}, []);

  // Current effective view
  const effectiveName = await getViewName(effectiveView?.id);
  const currentSection = api.createElement('div', { style: 'margin-bottom: 16px; padding: 12px; background: var(--bg-secondary, #f5f5f5); border-radius: 6px;' }, []);
  currentSection.innerHTML = 'Currently showing: <strong>' + effectiveName + '</strong>';
  body.appendChild(currentSection);

  // Helper to create a section with a select dropdown
  const createSection = (label, description, currentViewId, onSelect, onClear) => {
    const section = api.createElement('div', { style: 'margin-bottom: 20px;' }, []);

    const labelEl = api.createElement('div', { style: 'font-weight: 600; margin-bottom: 4px;' }, [label]);
    section.appendChild(labelEl);

    const descEl = api.createElement('div', { style: 'font-size: 0.8125rem; color: var(--text-secondary, #666); margin-bottom: 8px;' }, [description]);
    section.appendChild(descEl);

    const controlRow = api.createElement('div', { style: 'display: flex; gap: 8px; align-items: center;' }, []);

    const selectAttrs = { style: 'flex: 1; padding: 6px 8px; border: 1px solid var(--border-color, #ccc); border-radius: 4px;' };
    if (!onRefresh) selectAttrs.disabled = true;
    const select = api.createElement('select', selectAttrs, []);

    const noneOpt = api.createElement('option', { value: '' }, ['None']);
    if (!currentViewId) noneOpt.selected = true;
    select.appendChild(noneOpt);

    const sortedViews = [...views].sort((a, b) => {
      const nameA = a.view.content?.displayName || a.view.name || a.view.id.slice(0, 8);
      const nameB = b.view.content?.displayName || b.view.name || b.view.id.slice(0, 8);
      return nameA.localeCompare(nameB);
    });
    for (const { view } of sortedViews) {
      const opt = api.createElement('option', { value: view.id }, []);
      opt.textContent = view.content?.displayName || view.name || view.id.slice(0, 8);
      if (view.id === currentViewId) opt.selected = true;
      select.appendChild(opt);
    }

    if (onSelect) select.onchange = () => onSelect(select.value || null);
    controlRow.appendChild(select);

    if (currentViewId && onClear) {
      const clearBtn = api.createElement('button', {
        style: 'padding: 6px 12px; border: 1px solid var(--border-color, #ccc); border-radius: 4px; background: var(--bg-primary, white); cursor: pointer;',
        onclick: onClear
      }, ['Clear']);
      controlRow.appendChild(clearBtn);
    }

    section.appendChild(controlRow);
    return section;
  };

  // Helper to create read-only section (for contextual override)
  const createReadOnlySection = (label, description, currentViewId, onClear) => {
    const section = api.createElement('div', { style: 'margin-bottom: 20px;' }, []);

    const labelEl = api.createElement('div', { style: 'font-weight: 600; margin-bottom: 4px;' }, [label]);
    section.appendChild(labelEl);

    const descEl = api.createElement('div', { style: 'font-size: 0.8125rem; color: var(--text-secondary, #666); margin-bottom: 8px;' }, [description]);
    section.appendChild(descEl);

    const controlRow = api.createElement('div', { style: 'display: flex; gap: 8px; align-items: center;' }, []);

    const valueEl = api.createElement('span', { style: 'flex: 1; padding: 6px 8px; background: var(--bg-secondary, #f0f0f0); border-radius: 4px;' }, []);
    getViewName(currentViewId).then(name => { valueEl.textContent = name; });
    controlRow.appendChild(valueEl);

    if (currentViewId && onClear) {
      const clearBtn = api.createElement('button', {
        style: 'padding: 6px 12px; border: 1px solid var(--border-color, #ccc); border-radius: 4px; background: var(--bg-primary, white); cursor: pointer;',
        onclick: onClear
      }, ['Clear']);
      controlRow.appendChild(clearBtn);
    }

    section.appendChild(controlRow);
    return section;
  };

  // Section 1: In this context (read-only, set via View As menu)
  const contextSection = createReadOnlySection(
    'In this context',
    'Override for this location only (set via "View As..." menu)',
    contextualViewId,
    (contextualViewId && onRefresh) ? async () => {
      if (parentId) {
        await api.setAttachmentView(parentId, itemId, null);
        await api.rerenderItem(itemId);
      } else {
        await api.viewport.setRootView(null);
        await api.navigate(api.viewport.getRoot());
      }
      await onRefresh();
    } : null
  );
  body.appendChild(contextSection);

  // Divider
  body.appendChild(api.createElement('hr', { style: 'border: none; border-top: 1px solid var(--border-color, #ddd); margin: 16px 0;' }, []));

  // Section 2: For this item
  const itemSection = createSection(
    'For this item',
    'Default view wherever this item appears',
    itemPreferredViewId,
    onRefresh ? async (viewId) => {
      await api.setPreferredView(itemId, viewId);
      await onRefresh();
    } : null,
    (itemPreferredViewId && onRefresh) ? async () => {
      await api.setPreferredView(itemId, null);
      await onRefresh();
    } : null
  );
  body.appendChild(itemSection);

  // Divider
  body.appendChild(api.createElement('hr', { style: 'border: none; border-top: 1px solid var(--border-color, #ddd); margin: 16px 0;' }, []));

  // Section 3: For all [Type]s
  const typeDisplayName = typeName.charAt(0).toUpperCase() + typeName.slice(1);
  const typeSection = createSection(
    'For all ' + typeDisplayName + 's',
    'Default view for items of this type',
    typePreferredViewId,
    onRefresh ? async (viewId) => {
      await api.setPreferredView(item.type, viewId);
      await onRefresh();
    } : null,
    (typePreferredViewId && onRefresh) ? async () => {
      await api.setPreferredView(item.type, null);
      await onRefresh();
    } : null
  );
  body.appendChild(typeSection);

  // Resolution note
  const noteEl = api.createElement('div', {
    style: 'margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color, #ddd); font-size: 0.75rem; color: var(--text-secondary, #888); text-align: center;'
  }, ['Resolution order: context \u2192 item \u2192 type \u2192 system']);
  body.appendChild(noteEl);

  return body;
}

// Internal: Show the view settings modal (wraps the panel in modal-lib)
async function showViewSettingsModal(api, itemId, parentId) {
  const modalLib = await api.require('modal-lib');
  let closeModal;

  const onRefresh = async () => {
    closeModal();
    await showViewSettingsModal(api, itemId, parentId);
  };

  const body = await buildViewSettingsPanelContent(api, itemId, parentId, onRefresh);
  const item = await api.get(itemId);
  const itemName = item.name || item.content?.title || item.id.slice(0, 8);

  const { close } = modalLib.showModal({
    title: 'View Settings for "' + itemName + '"',
    width: '420px',
    api,
    content: body
  });
  closeModal = close;
}

/**
 * Build a "View Settings..." menu item that opens the view settings modal.
 * When context is null, item is inert (no onclick) — used in documentation.
 */
export function buildViewSettingsItem(api, itemId, context) {
  const el = api.createElement('div', { class: 'context-menu-item' }, ['View Settings...']);
  if (context) {
    el.onclick = async () => {
      context.onDismiss();
      await showViewSettingsModal(api, itemId, context.parentId);
    };
  }
  return el;
}

const CODE_TYPE = '22222222-0000-0000-0000-000000000000';

/**
 * Build "Edit View" menu item — opens the active view's code in an editable view.
 * viewState: { currentViewId, effectiveViewId } from buildViewAsSubmenu.
 */
export function buildEditViewItem(api, itemId, context, viewState) {
  const activeViewId = viewState?.currentViewId || viewState?.effectiveViewId;
  const el = api.createElement('div', { class: 'context-menu-item' + (!activeViewId ? ' disabled' : '') }, ['Edit View']);

  if (context && activeViewId) {
    el.onclick = async () => {
      context.onDismiss();
      const editView = await findEditableView(api, CODE_TYPE);
      const parentId = api.getParentId();
      if (parentId) {
        await api.attach(parentId, activeViewId);
      } else {
        api.navigate(activeViewId);
      }
      if (editView && context.parentId) {
        await api.setAttachmentView(context.parentId, activeViewId, editView.id);
      } else if (editView) {
        await api.viewport.setRootView(editView.id);
      }
    };
  }
  return el;
}

/**
 * Build the view settings panel as a standalone DOM node.
 * Used for functional transclusion: item://2cc0a1c5-5c09-49bd-834a-eaa2d0183b6c?call=buildViewSettingsPanel&itemId=...
 * Shows current view preferences in inert mode (disabled selects, no handlers).
 */
export async function buildViewSettingsPanel(api, params) {
  const itemId = typeof params === 'string' ? params : params.itemId;
  const parentId = (typeof params === 'object' && params.parentId) || null;
  return buildViewSettingsPanelContent(api, itemId, parentId, null);
}

/**
 * Build "Debug" submenu with debug views and system debug tools.
 * When context is null, items are inert (no onclick) — used in documentation.
 * context.debugViews, context.currentViewId, context.effectiveViewId come from viewState.
 */
export async function buildDebugSubmenu(api, itemId, context) {
  const frag = document.createDocumentFragment();
  const debugItem = api.createElement('div', { class: 'context-menu-item context-menu-submenu' }, ['Debug']);
  const debugSubmenu = api.createElement('div', { class: 'context-menu-submenu-items' }, []);

  const debugViews = context?.debugViews || [];
  const currentViewId = context?.currentViewId || null;
  const effectiveViewId = context?.effectiveViewId || null;

  // Debug views (Raw JSON, etc.)
  if (debugViews.length > 0) {
    const sortedDebugViews = [...debugViews].sort((a, b) => {
      const nameA = a.view.content?.displayName || a.view.name || a.view.id.slice(0, 8);
      const nameB = b.view.content?.displayName || b.view.name || b.view.id.slice(0, 8);
      return nameA.localeCompare(nameB);
    });

    for (const { view } of sortedDebugViews) {
      const isActive = (currentViewId || effectiveViewId) === view.id;
      const viewOption = api.createElement('div', {
        class: 'context-menu-item' + (isActive ? ' selected' : '')
      }, []);

      let label = view.content?.displayName || view.name || view.id.slice(0, 8);
      if (isActive) label += ' \u2713';
      viewOption.textContent = label;

      if (context?.onDismiss) {
        viewOption.onclick = async () => {
          context.onDismiss();
          if (context.parentId) {
            await api.setAttachmentView(context.parentId, itemId, view.id);
            await api.rerenderItem(itemId);
          } else {
            await api.viewport.setRootView(view.id);
            await api.navigate(api.viewport.getRoot());
          }
        };
      }
      debugSubmenu.appendChild(viewOption);
    }

    // Separator between debug views and debug options
    debugSubmenu.appendChild(api.createElement('div', { class: 'context-menu-separator' }, []));
  }

  // Open Inspector option
  const INSPECTOR_ITEM_ID = 'eeee0000-0000-0000-0000-000000000002';
  const openInspectorOption = api.createElement('div', { class: 'context-menu-item' }, ['Open Inspector']);
  if (context?.onDismiss) {
    openInspectorOption.onclick = async () => {
      context.onDismiss();
      const rootId = api.viewport.getRoot();
      const hasSpatialCanvas = !!document.querySelector(`[data-container-id="${rootId}"]`);
      if (hasSpatialCanvas) {
        await api.attach(rootId, INSPECTOR_ITEM_ID);
        await api.rerenderItem(rootId);
      } else {
        await api.navigate(INSPECTOR_ITEM_ID);
      }
    };
  }
  debugSubmenu.appendChild(openInspectorOption);

  debugItem.appendChild(debugSubmenu);
  frag.appendChild(debugItem);
  return frag;
}

/**
 * Build the background/empty context menu (Search Items, Open REPL).
 * When context is null, items are inert (no onclick) — used in documentation.
 */
export function buildEmptyMenu(api, context) {
  const frag = document.createDocumentFragment();

  // Search Items
  const searchItem = api.createElement('div', { class: 'context-menu-item' }, ['Search Items (Cmd+K)']);
  if (context) {
    searchItem.onclick = () => {
      context.onDismiss();
      api.showItemList();
    };
  }
  frag.appendChild(searchItem);

  // Open REPL
  const replItem = api.createElement('div', { class: 'context-menu-item' }, ['Open REPL (Ctrl+\)']);
  if (context) {
    replItem.onclick = async () => {
      context.onDismiss();
      try {
        const replUi = await api.require('repl-ui');
        await replUi.toggle();
      } catch {
        await window.kernel?.repl?.toggle();
      }
    };
  }
  frag.appendChild(replItem);

  return frag;
}

/**
 * Build the full item context menu.
 * Includes all sections: Add Child, View As, View Settings, simple actions, Debug.
 */
export async function buildItemMenu(api, paramsOrItemId, context) {
  const itemId = typeof paramsOrItemId === 'string' ? paramsOrItemId : paramsOrItemId.itemId;

  // Load CSS for documentation/transclusion mode
  if (!context) {
    const cssLoader = await api.require('css-loader-lib');
    await cssLoader.loadCSS('context-menu-css', api);
  }

  const sep = () => api.createElement('div', { class: 'context-menu-separator' }, []);

  const container = api.createElement('div', {
    class: 'context-menu',
    style: 'position: static; display: block; box-shadow: none; max-width: 220px;'
  });

  container.appendChild(buildAddChildSubmenu(api, itemId, context));
  container.appendChild(sep());
  const { fragment, viewState } = await buildViewAsSubmenu(api, itemId, context);
  container.appendChild(fragment);
  container.appendChild(buildViewSettingsItem(api, itemId, context));
  container.appendChild(buildEditViewItem(api, itemId, context, viewState));
  container.appendChild(sep());
  container.appendChild(await buildSimpleActions(api, itemId, context));
  container.appendChild(sep());
  container.appendChild(await buildDebugSubmenu(api, itemId, { ...context, ...viewState }));
  return container;
}
