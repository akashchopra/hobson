// Fix viewport-renderer after broken rename script
// This restores proper functionality while supporting both old and new naming
// Run in REPL (or safe mode if needed)

(async function() {
  console.log("Fixing viewport-renderer...\n");

  const viewportRenderer = await api.helpers.findByName('viewport-renderer');
  if (!viewportRenderer) {
    console.error("viewport-renderer not found!");
    return;
  }

  // The key changes needed:
  // 1. Use api.getRenderers (it still exists and now includes views)
  // 2. Use api.setChildRenderer OR api.setChildView (with fallback)
  // 3. Use api.viewport.setRootRenderer OR setRootView (with fallback)
  // 4. Read child.renderer OR child.view from child specs

  viewportRenderer.content.code = `
export async function render(item, api) {
  // Load standard context menu CSS
  const cssLoader = await api.require('css-loader-lib');
  await cssLoader.loadCSS('context-menu-css', api);

  // The viewport item stores rootId in children[0]
  const rootSpec = item.children?.[0];
  const rootId = rootSpec?.id || rootSpec;
  // Support both old 'renderer' and new 'view' property names
  const rootViewId = rootSpec?.view || rootSpec?.renderer || null;

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

  // New Item button
  if (rootId) {
    const newItemBtn = api.createElement('button', {
      style: 'padding: 4px 12px; cursor: pointer; background: #4a90e2; color: white; border: none; border-radius: 3px;',
      onclick: async () => {
        const CONTAINER_TYPE = '5c3f2631-cd4d-403a-be9c-e3a3c5ebdce9';

        // Helper: Show type picker modal
        const showTypePicker = () => {
          return new Promise(async (resolve) => {
            const allItems = await api.getAll();
            const types = allItems.filter(i => i.type === api.IDS.TYPE_DEFINITION);

            const overlay = api.createElement('div', {
              style: 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;'
            }, []);

            const modal = api.createElement('div', {
              style: 'background: white; border-radius: 8px; padding: 24px; max-width: 500px; max-height: 600px; overflow: auto;'
            }, []);

            const title = api.createElement('h3', { style: 'margin-top: 0;' }, ['Select Item Type']);
            modal.appendChild(title);

            const typeList = api.createElement('div', {
              style: 'display: flex; flex-direction: column; gap: 8px;'
            }, []);

            for (const type of types) {
              const typeBtn = api.createElement('button', {
                style: 'padding: 12px; text-align: left; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer;',
                onclick: () => {
                  document.body.removeChild(overlay);
                  resolve(type.id);
                }
              }, []);

              const typeName = api.createElement('div', { style: 'font-weight: bold;' }, [type.name || type.id.slice(0, 8)]);
              typeBtn.appendChild(typeName);

              if (type.content?.description) {
                const typeDesc = api.createElement('div', { style: 'font-size: 12px; color: #666; margin-top: 4px;' }, [type.content.description]);
                typeBtn.appendChild(typeDesc);
              }

              typeList.appendChild(typeBtn);
            }

            modal.appendChild(typeList);

            const cancelBtn = api.createElement('button', {
              style: 'margin-top: 16px; padding: 8px 16px; cursor: pointer;',
              onclick: () => {
                document.body.removeChild(overlay);
                resolve(null);
              }
            }, ['Cancel']);
            modal.appendChild(cancelBtn);

            overlay.appendChild(modal);
            overlay.onclick = (e) => {
              if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(null);
              }
            };

            document.body.appendChild(overlay);
          });
        };

        const rootItem = await api.get(rootId);
        const isContainer = await api.typeChainIncludes(rootItem.type, CONTAINER_TYPE);
        const selectedType = await showTypePicker();
        if (!selectedType) return;

        const newItem = {
          id: crypto.randomUUID(),
          name: (new Date(Date.now())).toISOString(),
          type: selectedType,
          created: Date.now(),
          modified: Date.now(),
          children: [],
          content: {}
        };

        await api.set(newItem);

        if (isContainer) {
          const updatedRoot = await api.get(rootId);
          const children = updatedRoot.children || [];
          const maxZ = children.length > 0 ? Math.max(...children.map(c => c.z || 1000)) : 999;

          children.push({
            id: newItem.id,
            x: 0, y: 0,
            width: 400, height: 300,
            z: maxZ + 1
          });

          updatedRoot.children = children;
          updatedRoot.modified = Date.now();
          await api.set(updatedRoot);
          await api.navigate(rootId);
          await api.editItem(newItem.id);
        } else {
          // Simple modal editor for non-container case
          const overlay = api.createElement('div', {
            style: 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;'
          }, []);

          const modal = api.createElement('div', {
            style: 'background: white; border-radius: 8px; padding: 24px; max-width: 600px; width: 90%; max-height: 80%; display: flex; flex-direction: column;'
          }, []);

          const header = api.createElement('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;' }, []);
          const modalTitle = api.createElement('h3', { style: 'margin: 0;' }, ['Edit New Item']);
          const closeBtn = api.createElement('button', {
            style: 'padding: 4px 8px; cursor: pointer;',
            onclick: async () => {
              await api.delete(newItem.id);
              document.body.removeChild(overlay);
            }
          }, ['×']);
          header.appendChild(modalTitle);
          header.appendChild(closeBtn);
          modal.appendChild(header);

          const textarea = api.createElement('textarea', {
            style: 'flex: 1; font-family: monospace; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 300px;'
          }, []);
          textarea.value = JSON.stringify(newItem, null, 2);
          modal.appendChild(textarea);

          const buttonContainer = api.createElement('div', { style: 'display: flex; gap: 8px; margin-top: 16px;' }, []);
          const saveAndCloseBtn = api.createElement('button', {
            style: 'padding: 8px 16px; cursor: pointer; background: #4a90e2; color: white; border: none; border-radius: 3px;',
            onclick: async () => {
              try {
                const updated = JSON.parse(textarea.value);
                updated.modified = Date.now();
                await api.set(updated);
                document.body.removeChild(overlay);
                await api.navigate(rootId);
              } catch (e) { alert('Invalid JSON: ' + e.message); }
            }
          }, ['Save and Close']);
          const saveAndViewBtn = api.createElement('button', {
            style: 'padding: 8px 16px; cursor: pointer; background: #27ae60; color: white; border: none; border-radius: 3px;',
            onclick: async () => {
              try {
                const updated = JSON.parse(textarea.value);
                updated.modified = Date.now();
                await api.set(updated);
                document.body.removeChild(overlay);
                await api.navigate(updated.id);
              } catch (e) { alert('Invalid JSON: ' + e.message); }
            }
          }, ['Save and View as Root']);
          buttonContainer.appendChild(saveAndCloseBtn);
          buttonContainer.appendChild(saveAndViewBtn);
          modal.appendChild(buttonContainer);

          overlay.appendChild(modal);
          document.body.appendChild(overlay);
        }
      }
    }, ['+ New Item']);
    navBar.appendChild(newItemBtn);
  }

  // Current item info
  if (rootId) {
    const rootItem = await api.get(rootId);
    const itemName = rootItem?.content?.title || rootItem?.name || rootId.slice(0, 8);
    const itemInfo = api.createElement('span', { style: 'margin-left: 10px; color: #666;' }, ['Viewing: ' + itemName]);
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
    rootNode = await api.renderItem(rootId, rootViewId);
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

  // Context menu
  const contextMenu = api.createElement('div', {
    id: 'context-menu',
    class: 'context-menu',
    style: 'display: none;'
  }, []);
  container.appendChild(contextMenu);

  let selectedItemId = null;
  let selectedParentId = null;

  const updateSelectionVisual = () => {
    container.querySelectorAll('[data-item-id].item-selected').forEach(el => el.classList.remove('item-selected'));
    if (selectedItemId) {
      const el = container.querySelector('[data-item-id="' + selectedItemId + '"]');
      if (el) el.classList.add('item-selected');
    }
  };

  const selectItem = (itemId, itemElement) => {
    selectedItemId = itemId;
    selectedParentId = itemElement?.getAttribute('data-parent-id') || null;
    api.viewport.select(itemId, selectedParentId);
    updateSelectionVisual();
  };

  const clearSelection = () => {
    selectedItemId = null;
    selectedParentId = null;
    api.viewport.clearSelection();
    updateSelectionVisual();
  };

  const hideContextMenu = () => {
    contextMenu.style.display = 'none';
    contextMenu.innerHTML = '';
  };

  // Helper: set child view (supports both old and new API)
  const setChildView = async (parentId, childId, viewId) => {
    if (api.setChildView) {
      await api.setChildView(parentId, childId, viewId);
    } else if (api.setChildRenderer) {
      await api.setChildRenderer(parentId, childId, viewId);
    }
  };

  // Helper: set root view (supports both old and new API)
  const setRootView = async (viewId) => {
    if (api.viewport.setRootView) {
      await api.viewport.setRootView(viewId);
    } else if (api.viewport.setRootRenderer) {
      await api.viewport.setRootRenderer(viewId);
    }
  };

  // Helper: get root view ID
  const getRootView = () => {
    if (api.viewport.getRootView) {
      return api.viewport.getRootView();
    } else if (api.viewport.getRootRenderer) {
      return api.viewport.getRootRenderer();
    }
    return null;
  };

  const showContextMenu = async (x, y, itemId) => {
    const menuItem = await api.get(itemId);
    contextMenu.innerHTML = '';

    // "Display As..." submenu
    const displayAsItem = api.createElement('div', { class: 'context-menu-item context-menu-submenu' }, ['Display As...']);
    const displayAsSubmenu = api.createElement('div', { class: 'context-menu-submenu-items' }, []);

    // Get available renderers/views (api.getRenderers includes views now)
    const renderers = await api.getRenderers(menuItem.type);

    // Get current view override
    let currentViewId = null;
    if (selectedParentId) {
      const parent = await api.get(selectedParentId);
      const childSpec = parent.children?.find(c => c.id === itemId);
      currentViewId = childSpec?.view || childSpec?.renderer || null;
    } else {
      currentViewId = getRootView();
    }

    if (renderers.length === 0) {
      const noRenderers = api.createElement('div', { class: 'context-menu-item disabled' }, ['(No views available)']);
      displayAsSubmenu.appendChild(noRenderers);
    } else {
      // Default option
      const defaultOption = api.createElement('div', {
        class: 'context-menu-item' + (currentViewId === null ? ' selected' : '')
      }, ['Default' + (currentViewId === null ? ' ✓' : '')]);
      defaultOption.onclick = async () => {
        hideContextMenu();
        if (selectedParentId) {
          await setChildView(selectedParentId, itemId, null);
        } else {
          await setRootView(null);
        }
        await api.navigate(api.viewport.getRoot());
      };
      displayAsSubmenu.appendChild(defaultOption);

      const sep = api.createElement('div', { class: 'context-menu-separator' }, []);
      displayAsSubmenu.appendChild(sep);

      for (const { renderer, forType, inherited } of renderers) {
        const isActive = currentViewId === renderer.id;
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
            await setChildView(selectedParentId, itemId, renderer.id);
          } else {
            await setRootView(renderer.id);
          }
          await api.navigate(api.viewport.getRoot());
        };
        displayAsSubmenu.appendChild(rendererOption);
      }
    }

    displayAsItem.appendChild(displayAsSubmenu);
    contextMenu.appendChild(displayAsItem);

    // "Edit With..." submenu
    const editWithItem = api.createElement('div', { class: 'context-menu-item context-menu-submenu' }, ['Edit With...']);
    const editWithSubmenu = api.createElement('div', { class: 'context-menu-submenu-items' }, []);

    const editors = await api.getEditors(menuItem.type);

    if (editors.length === 0) {
      const noEditors = api.createElement('div', { class: 'context-menu-item disabled' }, ['(No editors available)']);
      editWithSubmenu.appendChild(noEditors);
    } else {
      for (const { editor, forType, inherited } of editors) {
        const editorOption = api.createElement('div', { class: 'context-menu-item' }, []);
        let label = editor.name || editor.id.slice(0, 8);
        if (inherited) {
          const typeItem = await api.get(forType);
          label += ' (from ' + (typeItem?.name || forType.slice(0, 8)) + ')';
        }
        editorOption.textContent = label;
        editorOption.onclick = async () => {
          hideContextMenu();
          await api.editItem(itemId, editor.id);
        };
        editWithSubmenu.appendChild(editorOption);
      }
    }

    editWithItem.appendChild(editWithSubmenu);
    contextMenu.appendChild(editWithItem);

    // Separator
    contextMenu.appendChild(api.createElement('div', { class: 'context-menu-separator' }, []));

    // Edit Raw JSON
    const editRawItem = api.createElement('div', { class: 'context-menu-item' }, ['Edit Raw JSON']);
    editRawItem.onclick = () => { hideContextMenu(); api.editRaw(itemId); };
    contextMenu.appendChild(editRawItem);

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
    makeRootItem.onclick = async () => { hideContextMenu(); await api.navigate(itemId); };
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

    // Dock submenu (for items in containers)
    if (selectedParentId) {
      const dockItem = api.createElement('div', { class: 'context-menu-item context-menu-submenu' }, ['Dock']);
      const dockSubmenu = api.createElement('div', { class: 'context-menu-submenu-items' }, []);

      const dockPositions = ['Left', 'Right', 'Top', 'Bottom'];
      for (const pos of dockPositions) {
        const dockPosItem = api.createElement('div', { class: 'context-menu-item' }, ['Dock ' + pos]);
        dockPosItem.onclick = async (e) => {
          e.stopPropagation();
          hideContextMenu();
          const parent = await api.get(selectedParentId);
          const childSpec = parent.children?.find(c => c.id === itemId);
          if (!childSpec) return;

          const anyChild = document.querySelector('[data-parent-id="' + selectedParentId + '"]');
          const canvas = anyChild?.parentElement;
          const canvasWidth = canvas ? canvas.clientWidth : 1000;
          const canvasHeight = canvas ? canvas.clientHeight : 600;
          const width = childSpec.width || 400;
          const height = childSpec.height || 300;

          let newSpec = { ...childSpec, minimized: false, maximized: false };
          if (pos === 'Left') { newSpec.x = 0; newSpec.y = 0; newSpec.height = canvasHeight; }
          else if (pos === 'Right') { newSpec.x = canvasWidth - width; newSpec.y = 0; newSpec.height = canvasHeight; }
          else if (pos === 'Top') { newSpec.x = 0; newSpec.y = 0; newSpec.width = canvasWidth; }
          else if (pos === 'Bottom') { newSpec.x = 0; newSpec.y = canvasHeight - height; newSpec.width = canvasWidth; }

          parent.children = parent.children.map(c => c.id === itemId ? newSpec : c);
          parent.modified = Date.now();
          await api.set(parent);
          await api.navigate(api.viewport.getRoot());
        };
        dockSubmenu.appendChild(dockPosItem);
      }

      dockItem.appendChild(dockSubmenu);
      contextMenu.appendChild(dockItem);
    }

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
    const menuWidth = 180, menuHeight = 350;
    let menuX = x, menuY = y;
    if (x + menuWidth > window.innerWidth) menuX = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) menuY = window.innerHeight - menuHeight - 10;
    contextMenu.style.left = menuX + 'px';
    contextMenu.style.top = menuY + 'px';
    contextMenu.style.display = 'block';
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
    const itemElement = findItemElement(e.target);
    if (itemElement) {
      e.preventDefault();
      const itemId = itemElement.getAttribute('data-item-id');
      selectItem(itemId, itemElement);
      showContextMenu(e.clientX, e.clientY, itemId);
    }
  });

  container.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (contextMenu.style.display !== 'none') hideContextMenu();
      else clearSelection();
    }
  });

  container.setAttribute('tabindex', '0');
  return container;
}
`;

  viewportRenderer.modified = Date.now();
  await api.set(viewportRenderer);

  console.log("viewport-renderer fixed!");
  console.log("Reload kernel to apply changes.");

  return viewportRenderer;
})();
