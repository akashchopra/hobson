// Item: viewport-view
// ID: bd74da77-a459-454a-b001-48685d4b536d
// Type: aaaaaaaa-0000-0000-0000-000000000000

// Item: viewport-view
// ID: bd74da77-a459-454a-b001-48685d4b536d
// Type: aaaaaaaa-0000-0000-0000-000000000000

// Item: viewport-view
// ID: bd74da77-a459-454a-b001-48685d4b536d
// Type: aaaaaaaa-0000-0000-0000-000000000000

// Default window dimensions for new spatial children
const DEFAULT_WINDOW_WIDTH = 600;
const DEFAULT_WINDOW_HEIGHT = 500;

export async function render(item, api) {
  // Load dependencies
  // Note: Libraries under active development should be required where used, not here.
  // See docs/Hot-Reloading Libraries.md for the pattern.
  const cssLoader = await api.require('css-loader-lib');
  await cssLoader.loadCSS('context-menu-css', api);
  const searchLib = await api.require('item-search-lib');

  // Determine root: URL takes precedence over viewport item
  // This allows direct linking and avoids flash on initial load
  const urlParams = new URLSearchParams(window.location.search);
  const urlRoot = urlParams.get('root');
  
  // The viewport item stores rootId in attachments[0]
  const storedSpec = item.attachments?.[0];
  const storedRootId = storedSpec?.id || storedSpec;
  
  // Use URL root if present and valid, otherwise use stored root
  let rootId = storedRootId;
  let rootSpec = storedSpec;
  
  if (urlRoot && urlRoot !== storedRootId) {
    // URL has different root - verify it exists
    try {
      await api.get(urlRoot);
      rootId = urlRoot;
      rootSpec = { id: urlRoot };  // No view config from URL
      
      // Update viewport item to match URL (for consistency on next render)
      // Do this silently via api.set to avoid re-render loop
      const updatedViewport = { ...item, attachments: [{ id: urlRoot }], modified: Date.now() };
      await api.set(updatedViewport);
    } catch {
      // URL root doesn't exist - fall back to stored root
      console.warn('[viewport-view] URL root not found:', urlRoot);
    }
  }
  
  // Read view type from new schema (view.type) or fall back to old flat format
  const rootViewId = rootSpec?.view?.type || rootSpec?.view || rootSpec?.renderer || null;

  // Update browser tab title
  const updateBrowserTitle = async (itemId) => {
    if (!itemId) {
      document.title = 'Hobson';
      return;
    }
    const rootItem = await api.get(itemId);
    const itemName = rootItem?.content?.title || rootItem?.name || itemId.slice(0, 8);
    document.title = itemName + ' - Hobson';
  };
  await updateBrowserTitle(rootId);

  // Create main container
  const container = api.createElement('div', {
    class: 'viewport-container',
    style: 'display: flex; flex-direction: column; height: 100%; position: relative;'
  }, []);

  // Helper: Add child item to a parent
  // parentId: the item to add a child to
  // clickCoords: {x, y} if adding from a spatial context, null otherwise
  const addChildToItem = async (parentId, clickCoords) => {
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
  };

  // Helper: Add existing item as child to a parent
  const addExistingChildToItem = async (parentId, childId, clickCoords) => {
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
  };

  // Helper: Show item picker modal for adding existing item
  const showExistingItemPicker = async (parentId, clickCoords) => {
    // Re-require to pick up any edits (see docs/Hot-Reloading Libraries.md)
    const modalLib = await api.require('modal-lib');

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
        await addExistingChildToItem(parentId, selectedItem.id, clickCoords);
      },
      api,
      { placeholder: 'Search for items to add...', autoFocus: true }
    );
  };

  // Context menu for empty/background state
  // Append to document.body so it's always above windows (which can have high z-indices)
  const contextMenu = api.createElement('div', {
    id: 'context-menu',
    class: 'context-menu',
    style: 'display: none;'
  }, []);
  document.body.appendChild(contextMenu);

  const hideContextMenu = () => {
    contextMenu.style.display = 'none';
    contextMenu.innerHTML = '';
  };

  const showEmptyContextMenu = (x, y) => {
    contextMenu.innerHTML = '';

    // Search Items
    const searchItem = api.createElement('div', { class: 'context-menu-item' }, ['Search Items (Cmd+K)']);
    searchItem.onclick = () => {
      hideContextMenu();
      api.showItemList();
    };
    contextMenu.appendChild(searchItem);

    // Open REPL
    const replItem = api.createElement('div', { class: 'context-menu-item' }, ['Open REPL (Esc)']);
    replItem.onclick = async () => {
      hideContextMenu();
      try {
        const replUi = await api.require('repl-ui');
        await replUi.toggle();
      } catch {
        // Fallback to kernel if repl-ui not available
        await window.kernel?.repl?.toggle();
      }
    };
    contextMenu.appendChild(replItem);

    // Position menu
    const menuWidth = 180, menuHeight = 100;
    let menuX = x, menuY = y;
    if (x + menuWidth > window.innerWidth) menuX = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) menuY = window.innerHeight - menuHeight - 10;
    contextMenu.style.left = menuX + 'px';
    contextMenu.style.top = menuY + 'px';
    contextMenu.style.display = 'block';
  };

  // If no root, show empty state
  if (!rootId) {
    const empty = api.createElement('div', {
      style: 'padding: 40px; text-align: center; color: var(--color-text-secondary); flex: 1;'
    }, []);
    empty.innerHTML = 'No item selected.<br><br><span style="font-size: 14px;">Cmd+K - Search items<br>Esc - Open REPL<br>Right-click - Context menu</span>';
    container.appendChild(empty);

    // Handle right-click on empty state
    container.addEventListener('contextmenu', (e) => {
      if (e.shiftKey) return;
      e.preventDefault();
      showEmptyContextMenu(e.clientX, e.clientY);
    });

    container.addEventListener('click', () => hideContextMenu());

    // Keyboard shortcuts for empty state
    const globalKeyHandler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        api.showItemList();
      }
    };
    document.addEventListener('keydown', globalKeyHandler);

    // Register cleanup for when rendering system removes this DOM tree
    container.setAttribute('data-hobson-cleanup', '');
    container.__hobsonCleanup = () => {
      document.removeEventListener('keydown', globalKeyHandler);
      contextMenu.remove();
    };

    return container;
  }

  // Decorator for rendered items - adds data-item-id and tooltip
  // This is viewport-specific; users can customize by modifying this function
  const itemDecorator = async (dom, itemId, item) => {
    dom.setAttribute('data-item-id', itemId);
    
    // Add tooltip with item name, type, and tags
    const itemName = item.name || item.content?.title || itemId.slice(0, 8);
    let typeName = item.type.slice(0, 8);
    try {
      const typeItem = await api.get(item.type);
      typeName = typeItem.name || typeName;
    } catch {}
    
    let titleText = itemName + ' (' + typeName + ')';
    
    // Add tags to tooltip if present
    if (item.tags?.length) {
      const tagNames = await Promise.all(item.tags.map(async tagId => {
        try {
          const tag = await api.get(tagId);
          return tag.content?.name || tag.name || tagId.slice(0, 8);
        } catch {
          return tagId.slice(0, 8);
        }
      }));
      titleText += '\nTags: ' + tagNames.join(', ');
    }
    
    dom.setAttribute('title', titleText);
  };

  // Render the root item with decorator for viewport integration
  // Pass the full view config object so the renderer can access and update its view state
  let rootNode;
  try {
    rootNode = await api.renderItem(rootId, rootSpec?.view || null, { decorator: itemDecorator });
  } catch (error) {
    rootNode = api.createElement('div', {
      style: 'padding: 20px; color: var(--color-danger); background: var(--color-danger-light); border: 1px solid var(--color-danger); border-radius: var(--border-radius);'
    }, ['Error rendering item: ' + error.message]);
  }

  const contentArea = api.createElement('div', {
    'data-item-id': rootId,
    class: 'viewport-content',
    style: 'flex: 1; overflow: auto; display: flex; flex-direction: column; min-height: 0;'
  }, [rootNode]);

  container.appendChild(contentArea);

  let selectedItemId = null;
  let selectedParentId = null;
  let selectedElement = null;
  let lastContextMenuCoords = { x: 0, y: 0 };

  const updateSelectionVisual = () => {
    container.querySelectorAll('[data-item-id].item-selected').forEach(el => el.classList.remove('item-selected'));
    if (selectedElement) {
      selectedElement.classList.add('item-selected');
    }
  };

  const selectItem = (itemId, itemElement) => {
    selectedItemId = itemId;
    selectedParentId = itemElement?.getAttribute('data-parent-id') || null;
    selectedElement = itemElement;
    api.viewport.select(itemId, selectedParentId);
    updateSelectionVisual();
  };

  const clearSelection = () => {
    selectedItemId = null;
    selectedParentId = null;
    selectedElement = null;
    api.viewport.clearSelection();
    updateSelectionVisual();
  };

  // Helper: set child view
  const setChildView = async (parentId, childId, viewId) => {
    await api.setAttachmentView(parentId, childId, viewId);
  };

  // Helper: set root view
  const setRootView = async (viewId) => {
    await api.viewport.setRootView(viewId);
  };

  // Helper: get root view ID (async - reads from viewport item)
  const getRootView = async () => {
    return api.viewport.getRootView();
  };

  // View Settings Modal - shows all three levels of view preferences
  const showViewSettingsModal = async (itemId, parentId) => {
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

    const itemName = item.name || item.content?.title || item.id.slice(0, 8);

    // Re-require to pick up any edits (see docs/Hot-Reloading Libraries.md)
    const modalLib = await api.require('modal-lib');
    let closeModal;

    // Body (will be passed to modal-lib as content)
    const body = api.createElement('div', {}, []);

    // Current effective view
    const effectiveName = await getViewName(effectiveView?.id);
    const currentSection = api.createElement('div', { style: 'margin-bottom: 16px; padding: 12px; background: var(--bg-secondary, #f5f5f5); border-radius: 6px;' }, []);
    currentSection.innerHTML = 'Currently showing: <strong>' + effectiveName + '</strong>';
    body.appendChild(currentSection);

    // Helper to create a section
    const createSection = (label, description, currentViewId, onSelect, onClear) => {
      const section = api.createElement('div', { style: 'margin-bottom: 20px;' }, []);
      
      const labelEl = api.createElement('div', { style: 'font-weight: 600; margin-bottom: 4px;' }, [label]);
      section.appendChild(labelEl);
      
      const descEl = api.createElement('div', { style: 'font-size: 13px; color: var(--text-secondary, #666); margin-bottom: 8px;' }, [description]);
      section.appendChild(descEl);
      
      const controlRow = api.createElement('div', { style: 'display: flex; gap: 8px; align-items: center;' }, []);
      
      const select = api.createElement('select', { style: 'flex: 1; padding: 6px 8px; border: 1px solid var(--border-color, #ccc); border-radius: 4px;' }, []);
      
      // None option
      const noneOpt = api.createElement('option', { value: '' }, ['None']);
      if (!currentViewId) noneOpt.selected = true;
      select.appendChild(noneOpt);
      
      // View options - sorted alphabetically
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
      
      select.onchange = () => onSelect(select.value || null);
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

    // Helper to create read-only section (for contextual)
    const createReadOnlySection = (label, description, currentViewId, onClear) => {
      const section = api.createElement('div', { style: 'margin-bottom: 20px;' }, []);
      
      const labelEl = api.createElement('div', { style: 'font-weight: 600; margin-bottom: 4px;' }, [label]);
      section.appendChild(labelEl);
      
      const descEl = api.createElement('div', { style: 'font-size: 13px; color: var(--text-secondary, #666); margin-bottom: 8px;' }, [description]);
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

    // Refresh modal after changes
    const refreshModal = async () => {
      closeModal();
      await showViewSettingsModal(itemId, parentId);
    };

    // Section 1: In this context (read-only, set via View As menu)
    const contextSection = createReadOnlySection(
      'In this context',
      'Override for this location only (set via "View As..." menu)',
      contextualViewId,
      contextualViewId ? async () => {
        // Clear contextual override
        if (parentId) {
          await api.setAttachmentView(parentId, itemId, null);
          await api.rerenderItem(itemId);
        } else {
          await api.viewport.setRootView(null);
          await api.navigate(api.viewport.getRoot());
        }
        await refreshModal();
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
      async (viewId) => {
        await api.setPreferredView(itemId, viewId);
        await refreshModal();
      },
      itemPreferredViewId ? async () => {
        await api.setPreferredView(itemId, null);
        await refreshModal();
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
      async (viewId) => {
        await api.setPreferredView(item.type, viewId);
        await refreshModal();
      },
      typePreferredViewId ? async () => {
        await api.setPreferredView(item.type, null);
        await refreshModal();
      } : null
    );
    body.appendChild(typeSection);

    // Resolution note
    const noteEl = api.createElement('div', {
      style: 'margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color, #ddd); font-size: 12px; color: var(--text-secondary, #888); text-align: center;'
    }, ['Resolution order: context \u2192 item \u2192 type \u2192 system']);
    body.appendChild(noteEl);

    const { close } = modalLib.showModal({
      title: 'View Settings for "' + itemName + '"',
      width: '420px',
      api,
      content: body
    });
    closeModal = close;
  };

  const showContextMenu = async (x, y, itemId) => {
    const menuItem = await api.get(itemId);
    contextMenu.innerHTML = '';
    lastContextMenuCoords = { x, y };

    // "Add Child" submenu
    const addChildItem = api.createElement('div', { class: 'context-menu-item context-menu-submenu' }, ['Add Child']);
    const addChildSubmenu = api.createElement('div', { class: 'context-menu-submenu-items' }, []);

    // Helper to get click coords for spatial layouts
    const getClickCoords = () => {
      let clickCoords = null;
      if (selectedParentId) {
        const canvas = document.querySelector('[data-parent-id="' + selectedParentId + '"]')?.parentElement;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          clickCoords = {
            x: lastContextMenuCoords.x - rect.left + canvas.scrollLeft,
            y: lastContextMenuCoords.y - rect.top + canvas.scrollTop
          };
        }
      }
      return clickCoords;
    };

    // "New Item..." option
    const newItemOption = api.createElement('div', { class: 'context-menu-item' }, ['New Item...']);
    newItemOption.onclick = async () => {
      hideContextMenu();
      await addChildToItem(itemId, getClickCoords());
    };
    addChildSubmenu.appendChild(newItemOption);

    // "Existing Item..." option
    const existingItemOption = api.createElement('div', { class: 'context-menu-item' }, ['Existing Item...']);
    existingItemOption.onclick = () => {
      hideContextMenu();
      showExistingItemPicker(itemId, getClickCoords());
    };
    addChildSubmenu.appendChild(existingItemOption);

    addChildItem.appendChild(addChildSubmenu);
    contextMenu.appendChild(addChildItem);

    // Separator
    contextMenu.appendChild(api.createElement('div', { class: 'context-menu-separator' }, []));

    // "Display As..." submenu
    const displayAsItem = api.createElement('div', { class: 'context-menu-item context-menu-submenu' }, ['View As...']);
    const displayAsSubmenu = api.createElement('div', { class: 'context-menu-submenu-items' }, []);

    // Get available views for this type
    const views = await api.getViews(menuItem.type);

    // Get current view override (for checkmark display)
    let currentViewId = null;
    if (selectedParentId) {
      const parent = await api.get(selectedParentId);
      const childSpec = parent.attachments?.find(c => c.id === itemId);
      currentViewId = childSpec?.view?.type || null;
    } else {
      currentViewId = await getRootView();
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

      for (const { view, forType, inherited } of sortedViews) {
        const isActive = (currentViewId || effectiveViewId) === view.id;
        let label = view.content?.displayName || view.name || view.id.slice(0, 8);
        if (isActive) label += ' ✓';

        // Check if active view has submenu items to contribute
        let viewMenuItems = null;
        if (isActive) {
          try {
            const viewModule = await api.require(view.id);
            if (viewModule && typeof viewModule.getViewMenuItems === 'function') {
              // Create wrapped API with correct context for the nested item
              // The view's getViewMenuItems may call updateViewConfig/getViewConfig which need proper parentId
              const wrappedApi = {
                ...api,
                // Override getViewConfig to read from the correct parent's attachments array
                getViewConfig: async () => {
                  if (selectedParentId) {
                    const parent = await api.get(selectedParentId);
                    const childSpec = parent.attachments?.find(c => c.id === itemId);
                    return childSpec?.view || null;
                  } else {
                    // Root item - get from viewport-manager
                    return await api.viewport.getRootViewConfig();
                  }
                },
                // Override updateViewConfig to update the correct parent's attachments array
                updateViewConfig: async (updates) => {
                  if (selectedParentId) {
                    const parent = await api.get(selectedParentId);
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
                    // Root item - update viewport-manager's root view config
                    await api.viewport.updateRootViewConfig(updates);
                    return true;
                  }
                  return false;
                },
                // Override getParentId to return the correct parent
                getParentId: () => selectedParentId || null
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

            subItem.onclick = async () => {
              hideContextMenu();
              if (menuItemDef.onClick) {
                await menuItemDef.onClick();
              }
            };
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

          viewOption.onclick = async () => {
            hideContextMenu();
            if (selectedParentId) {
              // For nested items, update the child's view config in parent's attachments array
              // This sets both the view type AND innerView for wrapper views in one atomic operation
              const parent = await api.get(selectedParentId);
              const childIndex = parent.attachments.findIndex(c => c.id === itemId);
              if (childIndex >= 0) {
                const currentChild = parent.attachments[childIndex];
                const currentView = currentChild.view || {};

                // Build new view config
                const newView = {
                  ...currentView,
                  type: view.id,
                  // Set innerView to current view for wrapper views (like spatial-canvas)
                  innerView: currentlyRenderedViewId ? { type: currentlyRenderedViewId } : undefined
                };

                // Store previous view for restore functionality
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
              // For root items, update viewport-manager's root view config
              // Set both view type AND innerView for wrapper views in one operation
              await api.viewport.updateRootViewConfig({
                type: view.id,
                innerView: currentlyRenderedViewId ? { type: currentlyRenderedViewId } : undefined
              });
              await api.rerenderItem(itemId);
            }
          };
          displayAsSubmenu.appendChild(viewOption);
        }
      }
    }

    displayAsItem.appendChild(displayAsSubmenu);
    contextMenu.appendChild(displayAsItem);

    // "View Settings..." option - opens modal for item/type preferences
    const viewSettingsItem = api.createElement('div', { class: 'context-menu-item' }, ['View Settings...']);
    viewSettingsItem.onclick = async () => {
      hideContextMenu();
      await showViewSettingsModal(itemId, selectedParentId);
    };
    contextMenu.appendChild(viewSettingsItem);

    // Separator
    contextMenu.appendChild(api.createElement('div', { class: 'context-menu-separator' }, []));

    // Copy ID
    const copyIdItem = api.createElement('div', { class: 'context-menu-item' }, ['Copy ID']);
    copyIdItem.onclick = async () => {
      hideContextMenu();
      await navigator.clipboard.writeText(itemId);
      console.log('Copied ID:', itemId);
    };
    contextMenu.appendChild(copyIdItem);

    // Duplicate
    const duplicateItem = api.createElement('div', { class: 'context-menu-item' }, ['Duplicate']);
    duplicateItem.onclick = async () => {
      hideContextMenu();
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

      // Open the duplicate the same way views do: via siblingContainer if in spatial context
      const instances = api.instances.getByItemId(itemId);
      const siblingContainer = instances?.[0]?.siblingContainer;
      if (siblingContainer) {
        siblingContainer.addSibling(duplicate.id);
      } else {
        await api.navigate(duplicate.id);
      }
    };
    contextMenu.appendChild(duplicateItem);

    // Make Root
    const makeRootItem = api.createElement('div', { class: 'context-menu-item' }, ['Make Root']);
    makeRootItem.onclick = async () => {
      hideContextMenu();
      // Preserve the current view config when making this item the root
      let viewConfig = null;
      if (selectedParentId) {
        // Get the view config from the parent's attachments array
        const parent = await api.get(selectedParentId);
        const childSpec = parent.attachments?.find(c => c.id === itemId);
        viewConfig = childSpec?.view || null;
      }
      await api.navigate(itemId);
      // Set the preserved view config as the root view config
      if (viewConfig) {
        // Set view type if present
        if (viewConfig.type) {
          await setRootView(viewConfig.type);
        }
        // Set other view config properties
        const { type, ...otherConfig } = viewConfig;
        if (Object.keys(otherConfig).length > 0 && api.viewport.updateRootViewConfig) {
          await api.viewport.updateRootViewConfig(otherConfig);
        }
        await window.kernel.renderViewport();  // Re-render with the view config
      }
    };
    contextMenu.appendChild(makeRootItem);

    // Export as JSON
    const exportItem = api.createElement('div', { class: 'context-menu-item' }, ['Export as JSON']);
    exportItem.onclick = async () => {
      hideContextMenu();
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
    contextMenu.appendChild(exportItem);

    // Delete
    contextMenu.appendChild(api.createElement('div', { class: 'context-menu-separator' }, []));
    const deleteItem = api.createElement('div', { class: 'context-menu-item', style: 'color: var(--color-danger);' }, ['Delete']);
    deleteItem.onclick = async () => {
      hideContextMenu();
      const itemData = await api.get(itemId);
      const itemLabel = itemData.name || itemData.content?.title || itemId.slice(0, 8);

      if (confirm('Delete "' + itemLabel + '"? This cannot be undone.')) {
        await api.delete(itemId);
        if (itemId === rootId) {
          const WORKSPACE_ID = '00000000-0000-0000-0000-000000000006';
          await api.navigate(WORKSPACE_ID);
        } else {
          await api.navigate(rootId);
        }
      }
    };
    contextMenu.appendChild(deleteItem);

    // Debug submenu (at the bottom, after Delete)
    contextMenu.appendChild(api.createElement('div', { class: 'context-menu-separator' }, []));
    const debugItem = api.createElement('div', { class: 'context-menu-item context-menu-submenu' }, ['Debug']);
    const debugSubmenu = api.createElement('div', { class: 'context-menu-submenu-items' }, []);

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

        viewOption.onclick = async () => {
          hideContextMenu();
          if (selectedParentId) {
            await setChildView(selectedParentId, itemId, view.id);
            await api.rerenderItem(itemId);
          } else {
            await setRootView(view.id);
            await api.navigate(api.viewport.getRoot());
          }
        };
        debugSubmenu.appendChild(viewOption);
      }

      // Separator between debug views and debug options
      debugSubmenu.appendChild(api.createElement('div', { class: 'context-menu-separator' }, []));
    }

    // Enable Debug Mode option
    const isDebugMode = window.kernel?.debugMode || false;
    const debugModeOption = api.createElement('div', {
      class: 'context-menu-item' + (isDebugMode ? ' selected' : '')
    }, [isDebugMode ? 'Debug Mode \u2713' : 'Enable Debug Mode']);
    debugModeOption.onclick = async () => {
      hideContextMenu();
      const kernel = window.kernel;
      if (!kernel) return;

      kernel.debugMode = !kernel.debugMode;

      if (kernel.debugMode) {
        // Activate element inspector if not already active
        if (!kernel._elementInspector) {
          try {
            const inspectorModule = await kernel.moduleSystem.require('element-inspector');
            const replApi = kernel.createREPLAPI();
            kernel._elementInspector = inspectorModule.activate(replApi);
          } catch (e) {
            console.warn('Could not load element-inspector:', e.message);
          }
        }
        // Re-render to apply debug attributes to elements
        await api.navigate(api.viewport.getRoot());
      } else {
        // Deactivate element inspector
        if (kernel._elementInspector) {
          try {
            const inspectorModule = await kernel.moduleSystem.require('element-inspector');
            inspectorModule.deactivate();
            kernel._elementInspector = null;
          } catch (e) {
            console.warn('Could not deactivate element-inspector:', e.message);
          }
        }
        // Re-render to remove debug attributes
        await api.navigate(api.viewport.getRoot());
      }
    };
    debugSubmenu.appendChild(debugModeOption);

    // Toggle Inspector option (only when debug mode is active)
    if (isDebugMode && window.kernel?._elementInspector) {
      const inspectorActive = window.kernel._elementInspector.isActive();
      const inspectorOption = api.createElement('div', {
        class: 'context-menu-item' + (inspectorActive ? ' selected' : '')
      }, [inspectorActive ? 'Inspector Mode \u2713' : 'Toggle Inspector (Ctrl+Shift+.)']);
      inspectorOption.onclick = () => {
        hideContextMenu();
        window.kernel._elementInspector.toggle();
      };
      debugSubmenu.appendChild(inspectorOption);
    }

    debugItem.appendChild(debugSubmenu);
    contextMenu.appendChild(debugItem);

    // Position menu
    const menuWidth = 180, menuHeight = 400, submenuWidth = 160;
    let menuX = x, menuY = y;
    if (x + menuWidth > window.innerWidth) menuX = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) menuY = window.innerHeight - menuHeight - 10;
    contextMenu.style.left = menuX + 'px';
    contextMenu.style.top = menuY + 'px';
    contextMenu.style.display = 'block';
    
    // Flip submenus to left if near right edge
    if (menuX + menuWidth + submenuWidth > window.innerWidth) {
      contextMenu.classList.add('submenu-left');
    } else {
      contextMenu.classList.remove('submenu-left');
    }
  };

  const findItemElement = (target) => {
    let element = target.closest('[data-parent-id][data-item-id]');
    if (!element) element = target.closest('[data-item-id]');
    return element;
  };

  container.addEventListener('click', (e) => {
    hideContextMenu();
    const itemElement = findItemElement(e.target);
    if (itemElement) {
      selectItem(itemElement.getAttribute('data-item-id'), itemElement);
      e.stopPropagation();
    } else {
      clearSelection();
    }
  });

  container.addEventListener('contextmenu', (e) => {
    // Let browser menu through if modifier key held
    if (e.shiftKey) {
      return; // Don't preventDefault, let browser handle it
    }
    e.preventDefault();
    const itemElement = findItemElement(e.target);
    if (itemElement) {
      const itemId = itemElement.getAttribute('data-item-id');
      selectItem(itemId, itemElement);
      showContextMenu(e.clientX, e.clientY, itemId);
    } else {
      // Clicked on background - show background context menu
      clearSelection();
      showEmptyContextMenu(e.clientX, e.clientY);
    }
  });

  // Keyboard shortcuts
  const handleKeydown = (e) => {
    // Cmd+K or Ctrl+K: Open item list
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      api.showItemList();
      return;
    }
    
    // Escape: Hide context menu or clear selection
    if (e.key === 'Escape') {
      if (contextMenu.style.display !== 'none') hideContextMenu();
      else clearSelection();
    }
  };

  container.addEventListener('keydown', handleKeydown);
  
  // Also listen at document level for Cmd+K (so it works even when container not focused)
  const globalKeyHandler = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      api.showItemList();
    }
  };
  document.addEventListener('keydown', globalKeyHandler);

  // Register cleanup for when rendering system removes this DOM tree
  container.setAttribute('data-hobson-cleanup', '');
  container.__hobsonCleanup = () => {
    document.removeEventListener('keydown', globalKeyHandler);
    contextMenu.remove();
  };

  container.setAttribute('tabindex', '0');
  return container;
}
