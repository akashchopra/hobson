
export async function render(item, api) {
  // Load dependencies
  const cssLoader = await api.require('css-loader-lib');
  await cssLoader.loadCSS('context-menu-css', api);
  const typePicker = await api.require('type-picker-lib');
  const searchLib = await api.require('item-search-lib');

  // The viewport item stores rootId in children[0]
  const rootSpec = item.children?.[0];
  const rootId = rootSpec?.id || rootSpec;
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
    const selectedType = await typePicker.showTypePicker(api);
    if (!selectedType) return;

    const newItem = {
      id: crypto.randomUUID(),
      name: new Date().toISOString(),
      type: selectedType,
      created: Date.now(),
      modified: Date.now(),
      children: [],
      content: {}
    };

    await api.set(newItem);

    // Get parent and determine if it's being rendered spatially
    const parent = await api.get(parentId);
    const children = parent.children || [];
    
    // Check if parent is rendered spatially by looking at existing children
    // If children have position data (view.x, view.y), it's spatial
    const isSpatial = children.length > 0 
      ? children.some(c => c.view?.x !== undefined || c.view?.y !== undefined)
      : false;

    if (isSpatial || clickCoords) {
      // Spatial: add with position in view object
      const maxZ = children.length > 0 ? Math.max(...children.map(c => c.view?.z || 1000)) : 999;
      const x = clickCoords?.x || 50;
      const y = clickCoords?.y || 50;
      
      children.push({
        id: newItem.id,
        view: {
          x: x,
          y: y,
          width: 400,
          height: 300,
          z: maxZ + 1
        }
      });
    } else {
      // Non-spatial: just add the ID reference
      children.push({ id: newItem.id });
    }

    parent.children = children;
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
    const children = parent.children || [];

    // Check if already a child
    if (children.some(c => c.id === childId)) {
      alert('This item is already a child.');
      return;
    }

    // Check if parent is rendered spatially
    const isSpatial = children.length > 0
      ? children.some(c => c.view?.x !== undefined || c.view?.y !== undefined)
      : false;

    if (isSpatial || clickCoords) {
      const maxZ = children.length > 0 ? Math.max(...children.map(c => c.view?.z || 1000)) : 999;
      const x = clickCoords?.x || 50;
      const y = clickCoords?.y || 50;

      children.push({
        id: childId,
        view: {
          x: x,
          y: y,
          width: 400,
          height: 300,
          z: maxZ + 1
        }
      });
    } else {
      children.push({ id: childId });
    }

    parent.children = children;
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
  const showExistingItemPicker = (parentId, clickCoords) => {
    const overlay = api.createElement('div', {
      style: 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;'
    }, []);

    const modal = api.createElement('div', {
      style: 'background: white; border-radius: 8px; width: 90%; max-width: 600px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 4px 20px rgba(0,0,0,0.3);'
    }, []);

    const modalHeader = api.createElement('div', {
      style: 'display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #ddd;'
    }, []);

    const modalTitle = api.createElement('h3', { style: 'margin: 0;' }, ['Add Existing Item']);

    const closeBtn = api.createElement('button', {
      style: 'padding: 4px 10px; cursor: pointer; background: transparent; border: none; font-size: 24px; color: #666;',
      onclick: () => document.body.removeChild(overlay)
    }, ['\u00d7']);

    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeBtn);
    modal.appendChild(modalHeader);

    const searchContainer = api.createElement('div', {
      style: 'padding: 20px; flex: 1; overflow: auto;'
    }, []);
    modal.appendChild(searchContainer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    searchLib.createSearchUI(
      searchContainer,
      async (selectedItem) => {
        document.body.removeChild(overlay);
        await addExistingChildToItem(parentId, selectedItem.id, clickCoords);
      },
      api,
      { placeholder: 'Search for items to add...', autoFocus: true }
    );

    overlay.onclick = (e) => {
      if (e.target === overlay) document.body.removeChild(overlay);
    };
    modal.onclick = (e) => e.stopPropagation();
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
      await window.kernel?.repl?.toggle();
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
      style: 'padding: 40px; text-align: center; color: #666; flex: 1;'
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

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node === container || node.contains?.(container)) {
            document.removeEventListener('keydown', globalKeyHandler);
            contextMenu.remove();
            observer.disconnect();
            return;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return container;
  }

  // Decorator for rendered items - adds data-item-id and tooltip
  // This is viewport-specific; users can customize by modifying this function
  const itemDecorator = async (dom, itemId, item) => {
    dom.setAttribute('data-item-id', itemId);
    
    // Add tooltip with item name and type
    const itemName = item.name || item.content?.title || itemId.slice(0, 8);
    let typeName = item.type.slice(0, 8);
    try {
      const typeItem = await api.get(item.type);
      typeName = typeItem.name || typeName;
    } catch {}
    dom.setAttribute('title', itemName + ' (' + typeName + ')');
  };

  // Render the root item with decorator for viewport integration
  // Pass the full view config object so the renderer can access and update its view state
  let rootNode;
  try {
    rootNode = await api.renderItem(rootId, rootSpec?.view || null, { decorator: itemDecorator });
  } catch (error) {
    rootNode = api.createElement('div', {
      style: 'padding: 20px; color: #c00; background: #fff0f0; border: 1px solid #fcc; border-radius: 4px;'
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
    await api.setChildView(parentId, childId, viewId);
  };

  // Helper: set root view
  const setRootView = async (viewId) => {
    await api.viewport.setRootView(viewId);
  };

  // Helper: get root view ID
  const getRootView = () => {
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

    // Create modal overlay
    const overlay = api.createElement('div', {
      class: 'view-settings-overlay',
      style: 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10001;'
    }, []);

    const modal = api.createElement('div', {
      class: 'view-settings-modal',
      style: 'background: var(--bg-primary, white); border: 1px solid var(--border-color, #ddd); border-radius: 8px; width: 420px; max-width: 90vw; box-shadow: 0 4px 20px rgba(0,0,0,0.3);'
    }, []);

    // Header
    const itemName = item.name || item.content?.title || item.id.slice(0, 8);
    const header = api.createElement('div', {
      style: 'display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color, #ddd);'
    }, []);
    header.innerHTML = '<h3 style="margin: 0; font-size: 16px;">View Settings for "' + itemName + '"</h3>';
    const closeBtn = api.createElement('button', {
      style: 'background: none; border: none; font-size: 20px; cursor: pointer; color: #666; padding: 0 4px;',
      onclick: () => overlay.remove()
    }, ['\u00d7']);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Body
    const body = api.createElement('div', { style: 'padding: 20px;' }, []);

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
      overlay.remove();
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
          await api.setChildView(parentId, itemId, null);
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

    modal.appendChild(body);
    overlay.appendChild(modal);

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };
    modal.onclick = (e) => e.stopPropagation();

    // Close on Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(overlay);
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

    // Get current view override
    let currentViewId = null;
    if (selectedParentId) {
      const parent = await api.get(selectedParentId);
      const childSpec = parent.children?.find(c => c.id === itemId);
      currentViewId = childSpec?.view?.type || null;
    } else {
      currentViewId = getRootView();
    }

    if (views.length === 0) {
      const noViews = api.createElement('div', { class: 'context-menu-item disabled' }, ['(No views available)']);
      displayAsSubmenu.appendChild(noViews);
    } else {
      // Sort views alphabetically by display name
      const sortedViews = [...views].sort((a, b) => {
        const nameA = a.view.content?.displayName || a.view.name || a.view.id.slice(0, 8);
        const nameB = b.view.content?.displayName || b.view.name || b.view.id.slice(0, 8);
        return nameA.localeCompare(nameB);
      });

      for (const { view, forType, inherited } of sortedViews) {
        const isActive = currentViewId === view.id;
        const viewOption = api.createElement('div', {
          class: 'context-menu-item' + (isActive ? ' selected' : '')
        }, []);

        let label = view.content?.displayName || view.name || view.id.slice(0, 8);
        if (isActive) label += ' ✓';
        viewOption.textContent = label;

        viewOption.onclick = async () => {
          hideContextMenu();
          if (selectedParentId) {
            await setChildView(selectedParentId, itemId, view.id);
            // Re-render just this item (preserves sibling scroll positions)
            await api.rerenderItem(itemId);
          } else {
            await setRootView(view.id);
            // Root view change needs full re-render
            await api.navigate(api.viewport.getRoot());
          }
        };
        displayAsSubmenu.appendChild(viewOption);
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

    // Make Root
    const makeRootItem = api.createElement('div', { class: 'context-menu-item' }, ['Make Root']);
    makeRootItem.onclick = async () => {
      hideContextMenu();
      // Preserve the current view config when making this item the root
      let viewConfig = null;
      if (selectedParentId) {
        // Get the view config from the parent's children array
        const parent = await api.get(selectedParentId);
        const childSpec = parent.children?.find(c => c.id === itemId);
        viewConfig = childSpec?.view || null;
      }
      await api.navigate(itemId);
      // Set the preserved view config as the root view config
      if (viewConfig) {
        // Set view type if present
        if (viewConfig.type) {
          await setRootView(viewConfig.type);
        }
        // Set other view config properties (bannerPosition, etc.)
        const { type, ...otherConfig } = viewConfig;
        if (Object.keys(otherConfig).length > 0 && api.viewport.updateRootViewConfig) {
          await api.viewport.updateRootViewConfig(otherConfig);
        }
        await api.navigate(itemId);  // Re-render with the view
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
    const deleteItem = api.createElement('div', { class: 'context-menu-item', style: 'color: #d33;' }, ['Delete']);
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
  
  // Clean up global listener when container is removed
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        if (node === container || node.contains?.(container)) {
          document.removeEventListener('keydown', globalKeyHandler);
          contextMenu.remove();
          observer.disconnect();
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  container.setAttribute('tabindex', '0');
  return container;
}
