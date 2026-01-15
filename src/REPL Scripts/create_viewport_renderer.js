// REPL Script: Create viewport_renderer
// This renderer wraps the displayed item with UI chrome (selection, context menu)

const viewportRendererId = crypto.randomUUID();

const viewportRendererCode = `
export async function render(item, api) {
  // The viewport item stores rootId in children[0] (as an object with id)
  // and rootRendererId in content.rootRendererId
  const rootSpec = item.children?.[0];
  const rootId = rootSpec?.id || rootSpec;
  const rootRendererId = rootSpec?.renderer || null;

  // Create main container
  const container = api.createElement('div', {
    class: 'viewport-container',
    style: 'display: flex; flex-direction: column; height: 100%; position: relative;'
  }, []);

  // Create navigation bar
  const navBar = api.createElement('div', {
    class: 'nav-bar',
    style: 'display: flex; align-items: center; padding: 8px 15px; background: #f5f5f5; border-bottom: 1px solid #ddd; gap: 10px;'
  }, []);

  // Back button
  const backBtn = api.createElement('button', {
    style: 'padding: 4px 12px; cursor: pointer;',
    onclick: () => window.history.back()
  }, ['← Back']);
  navBar.appendChild(backBtn);

  // All Items button
  const allItemsBtn = api.createElement('button', {
    style: 'padding: 4px 12px; cursor: pointer;',
    onclick: async () => await api.showItemList()
  }, ['All Items']);
  navBar.appendChild(allItemsBtn);

  // Clear View button - returns to empty viewport state
  if (rootId) {
    const clearBtn = api.createElement('button', {
      style: 'padding: 4px 12px; cursor: pointer;',
      onclick: async () => {
        // Clear the viewport's root
        const vp = await api.get(api.IDS.VIEWPORT);
        vp.children = [];
        vp.modified = Date.now();
        await api.set(vp);
        // Clear last location from localStorage
        localStorage.removeItem('hobson:lastLocation');
        // Reload without URL params
        window.location.href = window.location.pathname;
      }
    }, ['Clear View']);
    navBar.appendChild(clearBtn);
  }

  // Import JSON button
  const importBtn = api.createElement('button', {
    style: 'padding: 4px 12px; cursor: pointer;',
    onclick: () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const result = await api.import(text);
          alert('Import complete!\\n\\nCreated: ' + result.created + '\\nUpdated: ' + result.updated + '\\nSkipped: ' + result.skipped);
          await api.navigate(api.viewport.getRoot());
        } catch (error) {
          alert('Import failed: ' + error.message);
        }
      };
      input.click();
    }
  }, ['Import JSON']);
  navBar.appendChild(importBtn);

  // Current item info
  if (rootId) {
    const rootItem = await api.get(rootId);
    const itemName = rootItem?.content?.title || rootItem?.name || rootId.slice(0, 8);
    const itemInfo = api.createElement('span', {
      style: 'margin-left: 10px; color: #666;'
    }, ['Viewing: ' + itemName]);
    navBar.appendChild(itemInfo);
  }

  container.appendChild(navBar);

  // If no root, show empty state
  if (!rootId) {
    const empty = api.createElement('div', {
      style: 'padding: 40px; text-align: center; color: #666;'
    }, ['No item selected. Use the REPL to navigate: api.navigate(itemId)']);
    container.appendChild(empty);
    return container;
  }

  // Render the root item
  let rootNode;
  try {
    rootNode = await api.renderItem(rootId, rootRendererId);
  } catch (error) {
    rootNode = api.createElement('div', {
      style: 'padding: 20px; color: #c00; background: #fff0f0; border: 1px solid #fcc; border-radius: 4px;'
    }, ['Error rendering item: ' + error.message]);
  }

  // Wrap root in a content area with data-item-id for selection
  const contentArea = api.createElement('div', {
    'data-item-id': rootId,
    class: 'viewport-content',
    style: 'flex: 1; overflow: auto; display: flex; flex-direction: column; min-height: 0;'
  }, [rootNode]);

  container.appendChild(contentArea);

  // Create context menu element (hidden by default)
  const contextMenu = api.createElement('div', {
    id: 'context-menu',
    class: 'context-menu',
    style: 'display: none;'
  }, []);
  container.appendChild(contextMenu);

  // Track selected item
  let selectedItemId = null;
  let selectedParentId = null;

  // Helper: update selection visual
  const updateSelectionVisual = () => {
    container.querySelectorAll('[data-item-id].item-selected').forEach(el => {
      el.classList.remove('item-selected');
    });
    if (selectedItemId) {
      const el = container.querySelector('[data-item-id="' + selectedItemId + '"]');
      if (el) el.classList.add('item-selected');
    }
  };

  // Helper: select item
  const selectItem = (itemId, itemElement) => {
    selectedItemId = itemId;
    selectedParentId = itemElement?.getAttribute('data-parent-id') || null;
    // Update viewport state
    api.viewport.select(itemId, selectedParentId);
    updateSelectionVisual();
  };

  // Helper: clear selection
  const clearSelection = () => {
    selectedItemId = null;
    selectedParentId = null;
    api.viewport.clearSelection();
    updateSelectionVisual();
  };

  // Helper: hide context menu
  const hideContextMenu = () => {
    contextMenu.style.display = 'none';
    contextMenu.innerHTML = '';
  };

  // Helper: show context menu
  const showContextMenu = async (x, y, itemId) => {
    const menuItem = await api.get(itemId);
    contextMenu.innerHTML = '';

    // "Display As..." submenu
    const displayAsItem = api.createElement('div', {
      class: 'context-menu-item context-menu-submenu'
    }, ['Display As...']);

    const displayAsSubmenu = api.createElement('div', {
      class: 'context-menu-submenu-items'
    }, []);

    // Get available renderers
    const renderers = await api.getRenderers(menuItem.type);

    // Get current renderer override
    let currentRendererId = null;
    if (selectedParentId) {
      const parent = await api.get(selectedParentId);
      const childSpec = parent.children?.find(c => c.id === itemId);
      currentRendererId = childSpec?.renderer || null;
    }

    if (renderers.length === 0) {
      const noRenderers = api.createElement('div', {
        class: 'context-menu-item disabled'
      }, ['(No renderers available)']);
      displayAsSubmenu.appendChild(noRenderers);
    } else {
      // Default option
      const defaultOption = api.createElement('div', {
        class: 'context-menu-item' + (currentRendererId === null ? ' selected' : '')
      }, ['Default' + (currentRendererId === null ? ' ✓' : '')]);
      defaultOption.onclick = async () => {
        hideContextMenu();
        if (selectedParentId) {
          await api.setChildRenderer(selectedParentId, itemId, null);
          await api.navigate(api.viewport.getRoot());
        }
      };
      displayAsSubmenu.appendChild(defaultOption);

      // Separator
      const sep = api.createElement('div', { class: 'context-menu-separator' }, []);
      displayAsSubmenu.appendChild(sep);

      // Each renderer
      for (const { renderer, forType, inherited } of renderers) {
        const isActive = currentRendererId === renderer.id;
        const rendererOption = api.createElement('div', {
          class: 'context-menu-item' + (isActive ? ' selected' : '')
        }, []);

        let label = renderer.name || renderer.id.slice(0, 8);
        if (inherited) {
          const typeItem = await api.get(forType);
          label += ' (from ' + (typeItem?.name || forType.slice(0, 8)) + ')';
        }
        if (isActive) label += ' ✓';
        rendererOption.textContent = label;

        rendererOption.onclick = async () => {
          hideContextMenu();
          if (selectedParentId) {
            await api.setChildRenderer(selectedParentId, itemId, renderer.id);
          } else {
            await api.viewport.setRootRenderer(renderer.id);
          }
          await api.navigate(api.viewport.getRoot());
        };
        displayAsSubmenu.appendChild(rendererOption);
      }
    }

    displayAsItem.appendChild(displayAsSubmenu);
    contextMenu.appendChild(displayAsItem);

    // Separator
    const separator = api.createElement('div', { class: 'context-menu-separator' }, []);
    contextMenu.appendChild(separator);

    // Edit Raw JSON
    const editRawItem = api.createElement('div', { class: 'context-menu-item' }, ['Edit Raw JSON']);
    editRawItem.onclick = () => {
      hideContextMenu();
      api.editRaw(itemId);
    };
    contextMenu.appendChild(editRawItem);

    // Copy ID
    const copyIdItem = api.createElement('div', { class: 'context-menu-item' }, ['Copy ID']);
    copyIdItem.onclick = async () => {
      hideContextMenu();
      await navigator.clipboard.writeText(itemId);
      console.log('Copied ID:', itemId);
    };
    contextMenu.appendChild(copyIdItem);

    // Position menu
    const menuWidth = 180;
    const menuHeight = 200;
    let menuX = x;
    let menuY = y;
    if (x + menuWidth > window.innerWidth) menuX = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) menuY = window.innerHeight - menuHeight - 10;

    contextMenu.style.left = menuX + 'px';
    contextMenu.style.top = menuY + 'px';
    contextMenu.style.display = 'block';
  };

  // Event: click to select
  container.addEventListener('click', (e) => {
    // Close context menu on any click
    hideContextMenu();

    const itemElement = e.target.closest('[data-item-id]');
    if (itemElement) {
      const itemId = itemElement.getAttribute('data-item-id');
      selectItem(itemId, itemElement);
      e.stopPropagation();
    } else {
      clearSelection();
    }
  });

  // Event: right-click for context menu
  container.addEventListener('contextmenu', (e) => {
    const itemElement = e.target.closest('[data-item-id]');
    if (itemElement) {
      e.preventDefault();
      const itemId = itemElement.getAttribute('data-item-id');
      selectItem(itemId, itemElement);
      showContextMenu(e.clientX, e.clientY, itemId);
    }
  });

  // Event: Escape to clear selection or close menu
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (contextMenu.style.display !== 'none') {
        hideContextMenu();
      } else {
        clearSelection();
      }
    }
  });

  // Make container focusable for keyboard events
  container.setAttribute('tabindex', '0');

  return container;
}
`;

const viewportRenderer = {
  id: viewportRendererId,
  name: "viewport_renderer",
  type: api.IDS.RENDERER,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    for_type: api.IDS.VIEWPORT_TYPE,
    code: viewportRendererCode
  }
};

await kernel.storage.set(viewportRenderer, kernel);
console.log("Created viewport_renderer:", viewportRendererId);
console.log("This renderer handles selection and context menus for the viewport.");
console.log("Note: The kernel needs to be updated to render the viewport item instead of the root directly.");
