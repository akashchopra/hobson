// Item: spatial-canvas-view
// ID: ef793c27-2d4b-4c99-b05a-2769db5bc5a9
// Type: aaaaaaaa-0000-0000-0000-000000000000
//
// Orchestrator: delegates to window-anchor-lib, window-zindex-lib,
// window-drag-resize-lib, window-minimize-lib, window-menu-lib.

// Contributes submenu items to the "View As..." menu when this view is active
export async function getViewMenuItems(item, api) {
  const SPATIAL_CANVAS_ID = 'ef793c27-2d4b-4c99-b05a-2769db5bc5a9';

  const viewConfig = await api.getViewConfig() || {};
  const currentInnerViewId = viewConfig.innerView?.type || null;

  const views = await api.getViews(item.type);

  const availableViews = views.filter(v =>
    v.view.id !== SPATIAL_CANVAS_ID &&
    v.view.content?.category !== 'debug' &&
    v.view.content?.category !== 'hidden'
  );

  const sortedViews = [...availableViews].sort((a, b) => {
    const nameA = a.view.content?.displayName || a.view.name || a.view.id.slice(0, 8);
    const nameB = b.view.content?.displayName || b.view.name || b.view.id.slice(0, 8);
    return nameA.localeCompare(nameB);
  });

  const items = [];

  for (const { view } of sortedViews) {
    const isActive = view.id === currentInnerViewId;
    items.push({
      label: (view.content?.displayName || view.name || view.id.slice(0, 8)) + (isActive ? ' \u2713' : ''),
      checked: isActive,
      onClick: async () => {
        await api.updateViewConfig({ innerView: { type: view.id } });
        await api.navigate(api.getCurrentRoot());
      }
    });
  }

  return items;
}

export async function render(item, api) {
  // Load all libraries in parallel
  const [anchorLib, zLib, dragLib, minLib, menuLib] = await Promise.all([
    api.require('window-anchor-lib'),
    api.require('window-zindex-lib'),
    api.require('window-drag-resize-lib'),
    api.require('window-minimize-lib'),
    api.require('window-menu-lib')
  ]);

  const {
    DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT,
    MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT, MIN_DOCKED_WIDTH, MIN_DOCKED_HEIGHT,
    isCornerAnchor, isEdgeAnchor, isAnchored,
    calculateAbsolutePosition, pinToNearestCorner, generateInsetStyle
  } = anchorLib;

  // SCROLL PRESERVATION: Save scroll positions before re-render
  const scrollStates = new Map();
  const existingWindows = document.querySelectorAll(`[data-parent-id="${item.id}"]`);
  existingWindows.forEach(wrapper => {
    const childId = wrapper.getAttribute('data-item-id');
    const content = wrapper.querySelector('.window-content');
    if (content && childId) {
      scrollStates.set(childId, { scrollTop: content.scrollTop, scrollLeft: content.scrollLeft });
    }
  });

  // Main container
  const container = api.createElement('div', {
    'data-container-id': item.id,
    style: 'position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--color-bg-body);'
  }, []);

  // Non-scrolling overlay for anchored/docked windows (z-index on children, not layer)
  const dockOverlay = api.createElement('div', {
    'data-dock-overlay': 'true',
    style: 'position: absolute; inset: 0; pointer-events: none; overflow: hidden;'
  }, []);
  container.appendChild(dockOverlay);

  // Scrollable area for background and floating windows
  const scrollArea = api.createElement('div', {
    'data-scroll-area': 'true',
    style: 'position: absolute; inset: 0; overflow: auto;'
  }, []);
  container.appendChild(scrollArea);

  // Inner view (background layer)
  const viewConfig = await api.getViewConfig() || {};
  const innerViewConfig = viewConfig.innerView || null;

  const background = api.createElement('div', {
    class: 'spatial-background',
    style: 'position: absolute; inset: 0; z-index: 0; overflow: auto; display: flex; flex-direction: column;'
  }, []);

  let innerViewPromise = null;
  if (innerViewConfig && innerViewConfig.type) {
    const innerViewId = innerViewConfig.type;
    innerViewPromise = (async () => {
      try {
        const innerViewModule = await api.require(innerViewId);
        if (innerViewModule && typeof innerViewModule.render === 'function') {
          const { type: _viewType, ...innerViewOwnConfig } = innerViewConfig;
          const hasOwnConfig = Object.keys(innerViewOwnConfig).length > 0;
          const innerApi = Object.create(api);
          innerApi.getViewConfig = () => hasOwnConfig ? innerViewOwnConfig : null;
          innerApi.updateViewConfig = async (updates) => {
            const currentConfig = await api.getViewConfig() || {};
            await api.updateViewConfig({ innerView: { ...(currentConfig.innerView || {}), ...updates } });
          };
          innerApi.getCurrentItem = () => item;
          innerApi.getViewId = () => innerViewId;
          return await innerViewModule.render(item, innerApi);
        } else {
          throw new Error(`Inner view ${innerViewId} has no render function`);
        }
      } catch (error) {
        return api.createElement('div', {
          style: 'padding: 20px; color: var(--color-danger); background: var(--color-danger-light); border: 1px solid var(--color-danger); margin: 10px;'
        }, ['Error rendering inner view: ' + error.message]);
      }
    })();
  }

  scrollArea.appendChild(background);

  const children = item.attachments || [];

  if (children.length === 0 && !innerViewConfig) {
    const empty = api.createElement('div', {
      style: 'position: absolute; left: 40px; top: 40px; color: var(--color-border-dark); font-style: italic; z-index: 1;'
    }, ['No items yet. Use View As > Spatial Canvas to set a background view, or add children via REPL.']);
    scrollArea.appendChild(empty);
  } else if (children.length === 0 && innerViewPromise) {
    const innerDom = await innerViewPromise;
    if (innerDom) {
      innerDom.style.flex = '1';
      innerDom.style.minHeight = '0';
      background.appendChild(innerDom);
    }
  } else if (children.length > 0) {
    // === updateChild helper ===
    const updateChild = async (childId, viewUpdates) => {
      const freshItem = await api.get(item.id);
      const freshChildren = freshItem.attachments || [];
      const updatedChildren = freshChildren.map(c => {
        if (c.id === childId) {
          return { ...c, view: { ...(c.view || {}), ...viewUpdates } };
        }
        return c;
      });
      await api.updateSilent({ ...freshItem, attachments: updatedChildren, modified: Date.now() });
    };

    // Separate children by state
    const normalChildren = children.filter(c => !c.view?.minimized && !c.view?.maximized);
    const maximizedChildren = children.filter(c => c.view?.maximized && !c.view?.minimized);
    const minimizedChildren = children.filter(c => c.view?.minimized);
    const childrenToRender = [...normalChildren, ...maximizedChildren];
    const ANCHOR_Z = 1;
    const baseZ = 2;

    // === Z-index helpers (DB-authoritative, no DOM queries) ===
    const getMaxZ = async () => {
      const freshItem = await api.get(item.id);
      return zLib.getMaxZ(freshItem.attachments || [], baseZ, isAnchored);
    };

    const bringToFront = async (childId) => {
      const freshItem = await api.get(item.id);
      const freshChildren = freshItem.attachments || [];
      const result = zLib.bringToFrontZ(childId, freshChildren, baseZ, isAnchored);
      if (!result) return null;
      await updateChild(childId, { z: result.newStoredZ });
      return result.newZ;
    };

    // Cycle handler
    const onCycle = (cycleItem) => api.createElement('div', {
      class: 'cycle-marker',
      style: 'padding: 12px; color: var(--color-text-tertiary); font-style: italic; border: 1px dashed var(--color-border); border-radius: var(--border-radius); background: var(--color-bg-surface-alt); text-align: center;'
    }, ['\u21bb ' + (cycleItem.name || cycleItem.id.substring(0, 8)) + ' (already shown above)']);

    let siblingContainer;

    // === Restore handler (shared by render-loop pills and onclick pills) ===
    const handleRestore = async (childId) => {
      const freshItem = await api.get(item.id);
      const freshChildren = freshItem.attachments || [];
      const { updatedChildren } = minLib.calculateRestore(childId, freshChildren, isAnchored);
      await api.updateSilent({ ...freshItem, attachments: updatedChildren, modified: Date.now() });
      await api.rerenderItem(item.id);
    };

    // === Create window for a child ===
    const createWindowForChild = async (childId, childView = {}, navigateTo = null) => {
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width || 1000;
      const containerHeight = containerRect.height || 600;

      const anchor = childView.anchor || null;
      const windowIsAnchored = isAnchored(anchor);
      const windowIsCornerAnchored = isCornerAnchor(anchor);
      const windowIsEdgeAnchored = isEdgeAnchor(anchor);

      // Migration: convert old pinned property to anchor
      let effectiveView = { ...childView };
      if (childView.pinned && !anchor) {
        const pinResult = pinToNearestCorner(childView, containerWidth, containerHeight);
        effectiveView = { ...childView, anchor: pinResult.anchor, x: pinResult.x, y: pinResult.y, pinned: undefined };
        await updateChild(childId, { anchor: pinResult.anchor, x: pinResult.x, y: pinResult.y, pinned: null });
      }

      // Calculate position using anchor-lib
      let x, y, width, height;
      const effectiveAnchor = effectiveView.anchor;
      const anchoredInsetStyle = generateInsetStyle(effectiveAnchor, effectiveView);

      if (anchoredInsetStyle) {
        x = 0;
        y = 0;
        width = effectiveView.width || DEFAULT_WINDOW_WIDTH;
        height = effectiveView.height || DEFAULT_WINDOW_HEIGHT;
      } else {
        x = effectiveView.x || 0;
        y = effectiveView.y || 0;
        width = effectiveView.width || DEFAULT_WINDOW_WIDTH;
        height = effectiveView.height || DEFAULT_WINDOW_HEIGHT;
      }

      const z = windowIsAnchored || effectiveAnchor
        ? ANCHOR_Z
        : (effectiveView.z !== undefined ? effectiveView.z + baseZ : (await getMaxZ()) + 1);
      const isMaximized = effectiveView.maximized || false;

      const childItem = await api.get(childId);
      const childNode = await api.renderItem(childId, effectiveView.type ? effectiveView : null, { onCycle, siblingContainer, navigateTo });

      // Wrapper style
      let wrapperStyle;
      if (isMaximized) {
        wrapperStyle = 'position: absolute; left: 0; top: 0; right: 0; bottom: 0; z-index: 1000000; border: 1px solid var(--color-border-light); border-radius: var(--border-radius); background: var(--color-bg-surface-alt); overflow: hidden; box-shadow: var(--shadow-md);';
      } else if (anchoredInsetStyle) {
        wrapperStyle = `position: absolute; ${anchoredInsetStyle} z-index: ${z}; pointer-events: auto; border: 1px solid var(--color-border-light); border-radius: var(--border-radius); background: var(--color-bg-surface-alt); overflow: hidden; box-shadow: var(--shadow-sm);`;
      } else {
        wrapperStyle = `position: absolute; left: ${x}px; top: ${y}px; width: ${width}px; height: ${height}px; z-index: ${z}; border: 1px solid var(--color-border-light); border-radius: var(--border-radius); background: var(--color-bg-surface-alt); overflow: hidden; box-shadow: var(--shadow-sm);`;
      }

      const wrapper = api.createElement('div', {
        'data-item-id': childId,
        'data-parent-id': item.id,
        'data-anchor': effectiveView.anchor || '',
        'data-maximized': isMaximized ? 'true' : 'false',
        'data-orig-x': x,
        'data-orig-y': y,
        'data-orig-width': width,
        'data-orig-height': height,
        'data-orig-z': z,
        style: wrapperStyle
      }, []);

      // Click to bring to front (floating, non-maximized only)
      if (!windowIsAnchored && !effectiveView.anchor && !isMaximized) {
        wrapper.addEventListener('mousedown', async (e) => {
          if (!e.target.closest('.titlebar') &&
              !e.target.classList.contains('resize-handle') &&
              !e.target.closest('a')) {
            const newZ = await bringToFront(childId);
            if (newZ !== null) wrapper.style.zIndex = newZ;
          }
        });
      }

      const canDrag = !windowIsAnchored && !effectiveView.anchor && !isMaximized;

      // Titlebar
      const titlebar = api.createElement('div', {
        class: 'titlebar',
        style: `height: 24px; background: var(--color-bg-hover); border-bottom: 1px solid var(--color-border); padding: 0 8px; display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; font-weight: 500; cursor: ${canDrag ? 'move' : 'default'}; user-select: none;`
      }, []);

      // Menu button
      const menuBtn = api.createElement('button', {
        style: 'width: 20px; height: 18px; padding: 0; margin-right: 6px; border: none; background: transparent; cursor: pointer; font-size: 0.75rem; color: var(--color-text-secondary); display: flex; align-items: center; justify-content: center;',
        title: 'Window menu'
      }, ['\u2261']);

      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menuLib.showWindowMenu(menuBtn, api, {
          isAnchored: windowIsAnchored || !!effectiveView.anchor,
          isCornerAnchored: windowIsCornerAnchored || isCornerAnchor(effectiveView.anchor),
          isEdgeAnchored: windowIsEdgeAnchored || isEdgeAnchor(effectiveView.anchor),
          wrapper,
          effectiveView,
          onPin: async (w) => {
            const cEl = w.parentElement;
            const cW = cEl ? cEl.clientWidth : 1000;
            const cH = cEl ? cEl.clientHeight : 600;
            const pinResult = pinToNearestCorner({
              x: parseInt(w.style.left) || 0,
              y: parseInt(w.style.top) || 0,
              width: parseInt(w.style.width) || DEFAULT_WINDOW_WIDTH,
              height: parseInt(w.style.height) || DEFAULT_WINDOW_HEIGHT
            }, cW, cH);
            await updateChild(childId, { anchor: pinResult.anchor, x: pinResult.x, y: pinResult.y, z: 0, pinned: null });
            await api.navigate(api.getCurrentRoot());
          },
          onUnpin: async (w) => {
            const cEl = w.parentElement;
            const cW = cEl ? cEl.clientWidth : 1000;
            const cH = cEl ? cEl.clientHeight : 600;
            const absPos = calculateAbsolutePosition(effectiveView, cW, cH);
            const maxZ = await getMaxZ();
            await updateChild(childId, { anchor: null, x: absPos.left, y: absPos.top, width: absPos.width, height: absPos.height, z: maxZ - baseZ + 1 });
            await api.navigate(api.getCurrentRoot());
          },
          onUndock: async (w) => {
            const cEl = w.parentElement;
            const cW = cEl ? cEl.clientWidth : 1000;
            const cH = cEl ? cEl.clientHeight : 600;
            const currentLeft = parseInt(w.style.left) || 0;
            const currentTop = parseInt(w.style.top) || 0;
            const currentWidth = parseInt(w.style.width) || DEFAULT_WINDOW_WIDTH;
            const currentHeight = parseInt(w.style.height) || DEFAULT_WINDOW_HEIGHT;
            const maxZ = await getMaxZ();
            await updateChild(childId, { anchor: null, x: currentLeft, y: currentTop, width: currentWidth, height: currentHeight, z: maxZ - baseZ + 1 });
            await api.navigate(api.getCurrentRoot());
          },
          onDock: async (pos, w) => {
            const currentWidth = parseInt(w.style.width) || DEFAULT_WINDOW_WIDTH;
            const currentHeight = parseInt(w.style.height) || DEFAULT_WINDOW_HEIGHT;
            await updateChild(childId, { anchor: pos, x: 0, y: 0, width: currentWidth, height: currentHeight, z: 0, minimized: false, maximized: false, pinned: null });
            await api.navigate(api.getCurrentRoot());
          }
        });
      });
      titlebar.appendChild(menuBtn);

      // Title text
      titlebar.appendChild(api.createElement('span', {
        style: 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
      }, [childItem.content?.title || childItem.name || childItem.id]));

      // Button container
      const buttonContainer = api.createElement('div', {
        style: 'display: flex; gap: 4px; align-items: center;'
      }, []);

      // Anchor indicator
      if (windowIsAnchored || effectiveView.anchor) {
        const anchorIndicator = api.createElement('button', {
          style: 'width: 18px; height: 18px; padding: 0; border: none; background: transparent; cursor: pointer; font-size: 0.75rem; color: var(--color-text-secondary); display: flex; align-items: center; justify-content: center;',
          title: windowIsEdgeAnchored || isEdgeAnchor(effectiveView.anchor) ? 'Undock' : 'Unpin',
          onclick: async (clickE) => {
            clickE.stopPropagation();
            const cEl = wrapper.parentElement;
            const cW = cEl ? cEl.clientWidth : 1000;
            const cH = cEl ? cEl.clientHeight : 600;
            const currentLeft = parseInt(wrapper.style.left) || 0;
            const currentTop = parseInt(wrapper.style.top) || 0;
            const currentWidth = parseInt(wrapper.style.width) || DEFAULT_WINDOW_WIDTH;
            const currentHeight = parseInt(wrapper.style.height) || DEFAULT_WINDOW_HEIGHT;
            const maxZ = await getMaxZ();
            await updateChild(childId, { anchor: null, x: currentLeft, y: currentTop, width: currentWidth, height: currentHeight, z: maxZ - baseZ + 1 });
            await api.navigate(api.getCurrentRoot());
          }
        }, ['\ud83d\udccc']);
        buttonContainer.appendChild(anchorIndicator);
      }

      // Minimize button (not for anchored)
      if (!windowIsAnchored && !effectiveView.anchor) {
        const minimizeBtn = api.createElement('button', {
          style: 'width: 18px; height: 18px; padding: 0; border: none; background: transparent; cursor: pointer; font-size: 0.875rem; font-weight: bold; color: var(--color-text-secondary); display: flex; align-items: center; justify-content: center;',
          title: 'Minimize',
          onclick: async (clickE) => {
            clickE.stopPropagation();
            // Optimistic DOM update
            wrapper.style.display = 'none';
            // Create pill using minimize-lib (single code path)
            const existingPills = container.querySelectorAll('[data-minimized="true"]');
            minLib.createMinimizedPill(childId, childItem.content?.title || childItem.name || childId.slice(0, 8), container, existingPills.length, api, { onRestore: handleRestore });
            // Persist (awaited, not fire-and-forget)
            await updateChild(childId, { minimized: true, maximized: false });
          }
        }, ['\u2212']);
        buttonContainer.appendChild(minimizeBtn);
      }

      // Maximize/Restore button (not for anchored)
      if (!windowIsAnchored && !effectiveView.anchor) {
        const maxBtn = api.createElement('button', {
          style: 'width: 18px; height: 18px; padding: 0; border: none; background: transparent; cursor: pointer; font-size: 0.75rem; color: var(--color-text-secondary); display: flex; align-items: center; justify-content: center;',
          title: isMaximized ? 'Restore' : 'Maximize',
          onclick: async (clickE) => {
            clickE.stopPropagation();
            const currentlyMaximized = wrapper.dataset.maximized === 'true';
            if (currentlyMaximized) {
              wrapper.style.left = `${wrapper.dataset.origX}px`;
              wrapper.style.top = `${wrapper.dataset.origY}px`;
              wrapper.style.width = `${wrapper.dataset.origWidth}px`;
              wrapper.style.height = `${wrapper.dataset.origHeight}px`;
              wrapper.style.right = '';
              wrapper.style.bottom = '';
              wrapper.style.zIndex = wrapper.dataset.origZ;
              wrapper.dataset.maximized = 'false';
              maxBtn.textContent = '\u25a1';
              maxBtn.title = 'Maximize';
              updateChild(childId, { maximized: false });
            } else {
              wrapper.style.left = '0';
              wrapper.style.top = '0';
              wrapper.style.right = '0';
              wrapper.style.bottom = '0';
              wrapper.style.width = 'auto';
              wrapper.style.height = 'auto';
              wrapper.style.zIndex = '1000000';
              wrapper.dataset.maximized = 'true';
              maxBtn.textContent = '\u274f';
              maxBtn.title = 'Restore';
              updateChild(childId, { maximized: true });
            }
          }
        }, [isMaximized ? '\u274f' : '\u25a1']);
        buttonContainer.appendChild(maxBtn);
      }

      // Close button (floating only)
      if (!windowIsAnchored && !effectiveView.anchor) {
        buttonContainer.appendChild(api.createElement('button', {
          style: 'width: 18px; height: 18px; padding: 0; border: none; background: transparent; cursor: pointer; font-size: 0.875rem; font-weight: bold; color: var(--color-text-secondary); display: flex; align-items: center; justify-content: center;',
          title: 'Close',
          onclick: async (clickE) => {
            clickE.stopPropagation();
            await api.detach(childId);
            wrapper.remove();
          }
        }, ['\u00d7']));
      }

      titlebar.appendChild(buttonContainer);

      // Drag handler
      if (canDrag) {
        dragLib.attachDrag(titlebar, wrapper, {
          onDragStart: async () => await bringToFront(childId),
          onDragEnd: async (finalX, finalY) => {
            await updateChild(childId, {
              x: finalX, y: finalY,
              width: parseInt(wrapper.style.width) || width,
              height: parseInt(wrapper.style.height) || height,
              anchor: null
            });
          }
        });
      }

      wrapper.appendChild(titlebar);

      // Corner resize handles (floating, non-maximized)
      if (canDrag) {
        dragLib.attachCornerResize(wrapper, api, {
          onResizeStart: async () => await bringToFront(childId),
          onResizeEnd: async (finalX, finalY, finalW, finalH) => {
            await updateChild(childId, { x: finalX, y: finalY, width: finalW, height: finalH, anchor: null });
          },
          minWidth: MIN_WINDOW_WIDTH,
          minHeight: MIN_WINDOW_HEIGHT
        });
      }

      // Edge resize handle (docked windows)
      if (windowIsEdgeAnchored || isEdgeAnchor(effectiveView.anchor)) {
        dragLib.attachEdgeResize(wrapper, effectiveView.anchor, api, {
          onResizeEnd: async (finalW, finalH) => {
            await updateChild(childId, { width: finalW, height: finalH });
          },
          minWidth: MIN_DOCKED_WIDTH,
          minHeight: MIN_DOCKED_HEIGHT
        });
      }

      // Content area
      const contentArea = api.createElement('div', {
        class: 'window-content',
        style: 'padding: 1px; overflow: auto; height: calc(100% - 24px);'
      }, []);
      contentArea.appendChild(childNode);
      wrapper.appendChild(contentArea);

      return wrapper;
    };

    // === Sibling container protocol ===
    siblingContainer = {
      id: item.id,
      addSibling: async (childId, navigateTo = null) => {
        const freshItem = await api.get(item.id);
        const freshChildren = freshItem.attachments || [];
        const existingChild = freshChildren.find(c => c.id === childId);

        if (existingChild) {
          const wasMinimized = existingChild.view?.minimized;
          if (wasMinimized) await updateChild(childId, { minimized: false });

          if (!isAnchored(existingChild.view?.anchor)) {
            const newZ = await bringToFront(childId);
            if (newZ !== null) {
              const w = document.querySelector(`[data-parent-id="${item.id}"][data-item-id="${childId}"]`);
              if (w) w.style.zIndex = newZ;
            }
          }

          if (wasMinimized) await api.navigate(api.getCurrentRoot());
        } else {
          await api.attach(childId);

          const existingWrappers = document.querySelectorAll(`[data-parent-id="${item.id}"]`);
          let newX = 50, newY = 50;
          if (existingWrappers.length > 0) {
            const lastWrapper = existingWrappers[existingWrappers.length - 1];
            newX = (parseInt(lastWrapper.style.left) || 0) + 30;
            newY = (parseInt(lastWrapper.style.top) || 0) + 30;
          }

          const maxZ = await getMaxZ();
          const newZ = maxZ + 1;
          await updateChild(childId, { x: newX, y: newY, z: newZ - baseZ });

          const w = await createWindowForChild(childId, {
            x: newX, y: newY,
            width: DEFAULT_WINDOW_WIDTH, height: DEFAULT_WINDOW_HEIGHT,
            z: newZ - baseZ
          }, navigateTo);

          const containerEl = document.querySelector(`[data-container-id="${item.id}"]`);
          const scrollAreaEl = containerEl?.querySelector('[data-scroll-area]');
          if (scrollAreaEl) scrollAreaEl.appendChild(w);
        }
      }
    };

    // === Render children in parallel ===
    const childRenderPromises = childrenToRender.map(async (child) => {
      try {
        return await createWindowForChild(child.id, child.view || {}, child.view?.navigateTo);
      } catch (error) {
        const cv = child.view || {};
        return api.createElement('div', {
          style: `position: absolute; left: ${cv.x || 0}px; top: ${cv.y || 0}px; width: ${cv.width || DEFAULT_WINDOW_WIDTH}px; padding: 15px; border: 1px solid var(--color-danger); border-radius: var(--border-radius); background: var(--color-danger-light); color: var(--color-danger); z-index: ${(cv.z || 0) + baseZ};`
        }, ['Error rendering child: ' + child.id + ' - ' + error.message]);
      }
    });

    const allPromises = innerViewPromise ? [innerViewPromise, ...childRenderPromises] : childRenderPromises;
    const allResults = await Promise.all(allPromises);

    if (innerViewPromise) {
      const innerDom = allResults[0];
      if (innerDom) {
        innerDom.style.flex = '1';
        innerDom.style.minHeight = '0';
        background.appendChild(innerDom);
      }
      allResults.slice(1).forEach((w, i) => {
        const target = isAnchored(childrenToRender[i].view?.anchor) ? dockOverlay : scrollArea;
        target.appendChild(w);
      });
    } else {
      allResults.forEach((w, i) => {
        const target = isAnchored(childrenToRender[i].view?.anchor) ? dockOverlay : scrollArea;
        target.appendChild(w);
      });
    }

    // Render minimized pills using minimize-lib (single code path)
    if (minimizedChildren.length > 0) {
      const childItemCache = new Map();
      for (const child of minimizedChildren) {
        try { childItemCache.set(child.id, await api.get(child.id)); } catch (e) { /* skip */ }
      }
      minLib.renderMinimizedPills(minimizedChildren, container, api, {
        getItemName: (child) => {
          const ci = childItemCache.get(child.id);
          return ci?.content?.title || ci?.name || child.id;
        },
        onRestore: handleRestore
      });
    }
  }

  // SCROLL PRESERVATION: Restore after DOM creation
  if (scrollStates.size > 0) {
    const restoreScroll = () => {
      const newWindows = document.querySelectorAll(`[data-parent-id="${item.id}"]`);
      newWindows.forEach(w => {
        const cid = w.getAttribute('data-item-id');
        const saved = scrollStates.get(cid);
        if (saved) {
          const c = w.querySelector('.window-content');
          if (c) { c.scrollTop = saved.scrollTop; c.scrollLeft = saved.scrollLeft; }
        }
      });
    };
    requestAnimationFrame(() => requestAnimationFrame(restoreScroll));
  }

  return container;
}
