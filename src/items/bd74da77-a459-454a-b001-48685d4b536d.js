// Item: viewport-view
// ID: bd74da77-a459-454a-b001-48685d4b536d
// Type: aaaaaaaa-0000-0000-0000-000000000000

export async function render(item, api) {
  // Load dependencies
  // Note: Libraries under active development should be required where used, not here.
  // See docs/Hot-Reloading Libraries.md for the pattern.
  const cssLoader = await api.require('css-loader-lib');
  await cssLoader.loadCSS('context-menu-css', api);

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
      // Silent to avoid triggering watcher dispatch and re-render loop
      const updatedViewport = { ...item, attachments: [{ id: urlRoot }], modified: Date.now() };
      await api.set(updatedViewport, { silent: true });
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

  const showContextMenu = async (x, y, itemId) => {
    const menuItem = await api.get(itemId);
    contextMenu.innerHTML = '';
    lastContextMenuCoords = { x, y };

    const menuLib = await api.require('context-menu-lib');

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

    // Add Child submenu
    contextMenu.appendChild(menuLib.buildAddChildSubmenu(api, itemId, {
      onDismiss: hideContextMenu, getClickCoords
    }));
    contextMenu.appendChild(api.createElement('div', { class: 'context-menu-separator' }, []));

    // View As submenu
    const { fragment: viewAsFragment, viewState } = await menuLib.buildViewAsSubmenu(api, itemId, {
      onDismiss: hideContextMenu, parentId: selectedParentId
    });
    contextMenu.appendChild(viewAsFragment);

    // View Settings
    contextMenu.appendChild(menuLib.buildViewSettingsItem(api, itemId, {
      onDismiss: hideContextMenu, parentId: selectedParentId
    }));
    contextMenu.appendChild(api.createElement('div', { class: 'context-menu-separator' }, []));

    // Simple actions
    contextMenu.appendChild(menuLib.buildSimpleActions(api, itemId, {
      onDismiss: hideContextMenu, parentId: selectedParentId, rootId
    }));
    contextMenu.appendChild(api.createElement('div', { class: 'context-menu-separator' }, []));

    // Debug submenu
    contextMenu.appendChild(await menuLib.buildDebugSubmenu(api, itemId, {
      onDismiss: hideContextMenu, parentId: selectedParentId, ...viewState
    }));

    // Position menu
    const menuWidth = 180, menuHeight = 400, submenuWidth = 160;
    let menuX = x, menuY = y;
    if (x + menuWidth > window.innerWidth) menuX = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) menuY = window.innerHeight - menuHeight - 10;
    contextMenu.style.left = menuX + 'px';
    contextMenu.style.top = menuY + 'px';
    contextMenu.style.display = 'block';

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
