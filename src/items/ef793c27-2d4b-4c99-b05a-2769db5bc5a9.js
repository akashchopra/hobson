// Item: spatial-canvas-view
// ID: ef793c27-2d4b-4c99-b05a-2769db5bc5a9
// Type: aaaaaaaa-0000-0000-0000-000000000000

// Item: spatial-canvas-view
// ID: ef793c27-2d4b-4c99-b05a-2769db5bc5a9
// Type: aaaaaaaa-0000-0000-0000-000000000000

// Item: spatial-canvas-view
// ID: ef793c27-2d4b-4c99-b05a-2769db5bc5a9
// Type: aaaaaaaa-0000-0000-0000-000000000000

// Item: spatial-canvas-view
// ID: ef793c27-2d4b-4c99-b05a-2769db5bc5a9
// Type: aaaaaaaa-0000-0000-0000-000000000000
//
// A "wrapper view" that provides spatial layout for any item type.
// Renders an optional inner view as the background, with children as floating windows above.

// Default window dimensions
const DEFAULT_WINDOW_WIDTH = 600;
const DEFAULT_WINDOW_HEIGHT = 500;

// Minimum resize constraints
const MIN_WINDOW_WIDTH = 200;
const MIN_WINDOW_HEIGHT = 150;
const MIN_DOCKED_WIDTH = 100;
const MIN_DOCKED_HEIGHT = 50;

// Contributes submenu items to the "View As..." menu when this view is active
export async function getViewMenuItems(item, api) {
  const SPATIAL_CANVAS_ID = 'ef793c27-2d4b-4c99-b05a-2769db5bc5a9';

  // Get current view config to determine current background
  const viewConfig = await api.getViewConfig() || {};
  const currentInnerViewId = viewConfig.innerView?.type || null;

  // Get available views for this item's type
  const views = await api.getViews(item.type);

  // Filter out this view itself and debug views
  const availableViews = views.filter(v =>
    v.view.id !== SPATIAL_CANVAS_ID &&
    v.view.content?.category !== 'debug' &&
    v.view.content?.category !== 'hidden'
  );

  // Sort views alphabetically
  const sortedViews = [...availableViews].sort((a, b) => {
    const nameA = a.view.content?.displayName || a.view.name || a.view.id.slice(0, 8);
    const nameB = b.view.content?.displayName || b.view.name || b.view.id.slice(0, 8);
    return nameA.localeCompare(nameB);
  });

  const items = [];

  // View options (no "None" option - background view is required)
  for (const { view } of sortedViews) {
    const isActive = view.id === currentInnerViewId;
    items.push({
      label: (view.content?.displayName || view.name || view.id.slice(0, 8)) + (isActive ? ' ✓' : ''),
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
  // SCROLL PRESERVATION: Save scroll positions from existing DOM before re-render
  const scrollStates = new Map();
  const existingWindows = document.querySelectorAll(`[data-parent-id="${item.id}"]`);
  existingWindows.forEach(wrapper => {
    const childId = wrapper.getAttribute('data-item-id');
    const content = wrapper.querySelector('.window-content');
    if (content && childId) {
      scrollStates.set(childId, {
        scrollTop: content.scrollTop,
        scrollLeft: content.scrollLeft
      });
    }
  });

  // Main container - position relative for absolute children
  // overflow: auto allows scrolling to off-screen floating windows
  const container = api.createElement('div', {
    'data-container-id': item.id,
    style: 'position: relative; width: 100%; height: 100%; overflow: auto;'
  }, []);

  // Get view config for inner view (persisted in parent's child entry or viewport root)
  const viewConfig = await api.getViewConfig() || {};
  const innerViewConfig = viewConfig.innerView || null;

  // === BACKGROUND LAYER ===
  // Renders an optional inner view as full-bleed background at z-index 0
  const background = api.createElement('div', {
    class: 'spatial-background',
    style: 'position: absolute; inset: 0; z-index: 0; overflow: auto; display: flex; flex-direction: column;'
  }, []);

  // Start inner view rendering as a promise (will be awaited later with children for parallelism)
  let innerViewPromise = null;
  if (innerViewConfig && innerViewConfig.type) {
    const innerViewId = innerViewConfig.type;
    innerViewPromise = (async () => {
      try {
        // BYPASS api.renderItem() to avoid cycle detection
        // The wrapper pattern intentionally renders the same item with a different view.
        // This is NOT a cycle - it's a deliberate composition pattern.
        // We directly load and call the inner view's render function.

        // Load the inner view module
        const innerViewModule = await api.require(innerViewId);

        if (innerViewModule && typeof innerViewModule.render === 'function') {
          // Create a modified api for the inner view
          // The inner view's config is stored inside innerViewConfig (minus the 'type' field which is for spatial-canvas)
          const { type: _viewType, ...innerViewOwnConfig } = innerViewConfig;
          const hasOwnConfig = Object.keys(innerViewOwnConfig).length > 0;

          const innerApi = Object.create(api);
          // Return the inner view's own config (if any), not the wrapper config
          innerApi.getViewConfig = () => hasOwnConfig ? innerViewOwnConfig : null;
          innerApi.updateViewConfig = async (updates) => {
            const currentConfig = await api.getViewConfig() || {};
            await api.updateViewConfig({
              innerView: { ...(currentConfig.innerView || {}), ...updates }
            });
          };
          // Override getCurrentItem to return the item being rendered, not the spatial container
          innerApi.getCurrentItem = () => item;
          // Override getViewId to return the inner view's ID
          innerApi.getViewId = () => innerViewId;

          // Call the inner view's render function directly
          return await innerViewModule.render(item, innerApi);
        } else {
          throw new Error(`Inner view ${innerViewId} has no render function`);
        }
      } catch (error) {
        const errorDiv = api.createElement('div', {
          style: 'padding: 20px; color: var(--color-danger); background: var(--color-danger-light); border: 1px solid var(--color-danger); margin: 10px;'
        }, ['Error rendering inner view: ' + error.message]);
        return errorDiv;
      }
    })();
  }

  container.appendChild(background);

  // === ANCHOR-BASED POSITIONING HELPERS ===

  // Convert anchor-relative position to absolute CSS values
  const calculateAbsolutePosition = (view, containerWidth, containerHeight) => {
    const anchor = view.anchor || 'top-left';
    const isEdgeH = anchor === 'top' || anchor === 'bottom';
    const isEdgeV = anchor === 'left' || anchor === 'right';

    // Edge anchors fill perpendicular axis
    const width = isEdgeH ? containerWidth : (view.width || DEFAULT_WINDOW_WIDTH);
    const height = isEdgeV ? containerHeight : (view.height || DEFAULT_WINDOW_HEIGHT);

    let left, top;
    switch (anchor) {
      case 'top-left':
      default:
        left = view.x || 0;
        top = view.y || 0;
        break;
      case 'top-right':
        left = containerWidth - (view.x || 0) - width;
        top = view.y || 0;
        break;
      case 'bottom-left':
        left = view.x || 0;
        top = containerHeight - (view.y || 0) - height;
        break;
      case 'bottom-right':
        left = containerWidth - (view.x || 0) - width;
        top = containerHeight - (view.y || 0) - height;
        break;
      case 'left':
        left = view.x || 0;
        top = 0;
        break;
      case 'right':
        left = containerWidth - (view.x || 0) - width;
        top = 0;
        break;
      case 'top':
        left = 0;
        top = view.y || 0;
        break;
      case 'bottom':
        left = 0;
        top = containerHeight - (view.y || 0) - height;
        break;
    }
    return { left, top, width, height };
  };

  // Calculate nearest corner and convert absolute position to anchor-relative
  const pinToNearestCorner = (view, containerWidth, containerHeight) => {
    const x = view.x || 0;
    const y = view.y || 0;
    const width = view.width || DEFAULT_WINDOW_WIDTH;
    const height = view.height || DEFAULT_WINDOW_HEIGHT;

    const centerX = x + width / 2;
    const centerY = y + height / 2;

    const anchorX = centerX < containerWidth / 2 ? 'left' : 'right';
    const anchorY = centerY < containerHeight / 2 ? 'top' : 'bottom';
    const anchor = `${anchorY}-${anchorX}`;

    const newX = anchorX === 'left' ? x : containerWidth - x - width;
    const newY = anchorY === 'top' ? y : containerHeight - y - height;

    return { anchor, x: newX, y: newY };
  };

  // Check anchor type
  const isCornerAnchor = (anchor) => {
    return anchor === 'top-right' || anchor === 'bottom-left' || anchor === 'bottom-right';
  };

  const isEdgeAnchor = (anchor) => {
    return anchor === 'left' || anchor === 'right' || anchor === 'top' || anchor === 'bottom';
  };

  const isAnchored = (anchor) => {
    return isCornerAnchor(anchor) || isEdgeAnchor(anchor);
  };

  // Children (windows)
  const children = item.attachments || [];

  if (children.length === 0 && !innerViewConfig) {
    // Show empty message only when no children AND no background view
    const empty = api.createElement('div', {
      style: 'position: absolute; left: 40px; top: 40px; color: var(--color-border-dark); font-style: italic; z-index: 1;'
    }, [
      'No items yet. Use View As > Spatial Canvas to set a background view, or add children via REPL.'
    ]);
    container.appendChild(empty);
  } else if (children.length === 0 && innerViewPromise) {
    // Inner view but no children - await inner view now
    const innerDom = await innerViewPromise;
    if (innerDom) {
      innerDom.style.flex = '1';
      innerDom.style.minHeight = '0';
      background.appendChild(innerDom);
    }
  } else if (children.length > 0) {
    // Function to update child view properties (silent - no re-render)
    const updateChild = async (childId, viewUpdates) => {
      // Get fresh children from database (not stale closure)
      const freshItem = await api.get(item.id);
      const freshChildren = freshItem.attachments || [];

      const updatedChildren = freshChildren.map(c => {
        if (c.id === childId) {
          // Merge updates into child.view, preserving existing view properties
          return {
            ...c,
            view: { ...(c.view || {}), ...viewUpdates }
          };
        }
        return c;
      });

      const updated = {
        ...freshItem,
        attachments: updatedChildren,
        modified: Date.now()
      };

      await api.updateSilent(updated);
    };

    // Separate children by state (read from view object)
    const normalChildren = children.filter(c => !c.view?.minimized && !c.view?.maximized);
    const maximizedChildren = children.filter(c => c.view?.maximized && !c.view?.minimized);
    const minimizedChildren = children.filter(c => c.view?.minimized);

    // Render normal and maximized children
    const childrenToRender = [...normalChildren, ...maximizedChildren];
    // Base z-index: background is 0, windows start at 1+
    const baseZ = 1;

    // Helper: Get current max z-index from both database and DOM
    const getMaxZ = async () => {
      const freshItem = await api.get(item.id);
      const freshChildren = freshItem.attachments || [];
      // Exclude anchored windows from max z calculation
      const floating = freshChildren.filter(c => !isAnchored(c.view?.anchor) && !c.view?.minimized);
      const maxDbZ = Math.max(...floating.map(c => c.view?.z || 0), 0);

      const siblingWrappers = document.querySelectorAll(`[data-parent-id="${item.id}"]`);
      let maxDomZ = baseZ;
      siblingWrappers.forEach(w => {
        const z = parseInt(w.style.zIndex) || 0;
        if (z > maxDomZ) maxDomZ = z;
      });

      return Math.max(maxDbZ + baseZ, maxDomZ);
    };

    // Helper: Bring a window to front
    // Checks both database AND DOM z-values to ensure window goes on top
    const bringToFront = async (childIdToFront) => {
      const freshItem = await api.get(item.id);
      const freshChildren = freshItem.attachments || [];

      // Get max z from database (floating, non-minimized - exclude anchored)
      const floating = freshChildren.filter(c => !isAnchored(c.view?.anchor) && !c.view?.minimized);
      const maxDbZ = Math.max(...floating.map(c => c.view?.z || 0), 0);

      // Get max z from DOM (sibling windows may have higher z from previous interactions)
      const siblingWrappers = document.querySelectorAll(`[data-parent-id="${item.id}"]`);
      let maxDomZ = baseZ;
      siblingWrappers.forEach(w => {
        const z = parseInt(w.style.zIndex) || 0;
        if (z > maxDomZ) maxDomZ = z;
      });

      // Find target in floating list
      const targetChild = floating.find(c => c.id === childIdToFront);
      if (!targetChild) return null; // Anchored or minimized

      // Get actual DOM z-index of target (may differ from database)
      const targetWrapper = document.querySelector(`[data-parent-id="${item.id}"][data-item-id="${childIdToFront}"]`);
      const currentDomZ = targetWrapper ? (parseInt(targetWrapper.style.zIndex) || 0) : (targetChild.view?.z || 0) + baseZ;

      // Max z considering both database and DOM
      const maxZ = Math.max(maxDbZ + baseZ, maxDomZ);

      // If already at or above max, no change needed
      if (currentDomZ >= maxZ) return null;

      // New z is max + 1
      const newDomZ = maxZ + 1;
      const newStoredZ = newDomZ - baseZ;

      await updateChild(childIdToFront, { z: newStoredZ });

      // Return the DOM z-index (with baseZ included)
      return newDomZ;
    };

    // Cycle handler for when a child item is already being rendered in the ancestor chain
    const onCycle = (cycleItem) => api.createElement('div', {
      class: 'cycle-marker',
      style: 'padding: 12px; color: var(--color-text-tertiary); font-style: italic; border: 1px dashed var(--color-border); border-radius: var(--border-radius); background: var(--color-bg-surface-alt); text-align: center;'
    }, ['↻ ' + (cycleItem.name || cycleItem.id.substring(0, 8)) + ' (already shown above)']);

    // Forward declaration for siblingContainer (needed by createWindowForChild)
    let siblingContainer;

    // Helper: Create a window wrapper for a child item
    // This is extracted so addSibling can create windows without full re-render
    const createWindowForChild = async (childId, childView = {}, navigateTo = null) => {
      console.log('[spatial-canvas] createWindowForChild:', childId, 'navigateTo:', navigateTo);
      // Get container dimensions for anchor calculations
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width || 1000;
      const containerHeight = containerRect.height || 600;

      // Determine anchor state
      const anchor = childView.anchor || null;
      const windowIsAnchored = isAnchored(anchor);
      const windowIsCornerAnchored = isCornerAnchor(anchor);
      const windowIsEdgeAnchored = isEdgeAnchor(anchor);

      // Migration: convert old pinned property to anchor
      let effectiveView = { ...childView };
      if (childView.pinned && !anchor) {
        // Migrate pinned window to nearest corner anchor
        const pinResult = pinToNearestCorner(childView, containerWidth, containerHeight);
        effectiveView = {
          ...childView,
          anchor: pinResult.anchor,
          x: pinResult.x,
          y: pinResult.y,
          pinned: undefined // Remove old property
        };
        // Persist the migration
        await updateChild(childId, {
          anchor: pinResult.anchor,
          x: pinResult.x,
          y: pinResult.y,
          pinned: null // Delete old property
        });
      }

      // Calculate position based on anchor
      let x, y, width, height;
      if (windowIsAnchored || effectiveView.anchor) {
        const pos = calculateAbsolutePosition(effectiveView, containerWidth, containerHeight);
        // Add scroll offset so anchored windows stay in viewport
        x = pos.left + container.scrollLeft;
        y = pos.top + container.scrollTop;
        width = pos.width;
        height = pos.height;
      } else {
        x = effectiveView.x || 0;
        y = effectiveView.y || 0;
        width = effectiveView.width || DEFAULT_WINDOW_WIDTH;
        height = effectiveView.height || DEFAULT_WINDOW_HEIGHT;
      }

      // Anchored windows get z=1 (same as baseZ, above background at z=0)
      const z = windowIsAnchored || effectiveView.anchor
        ? baseZ
        : (effectiveView.z !== undefined ? effectiveView.z + baseZ : (await getMaxZ()) + 1);
      const isMaximized = effectiveView.maximized || false;

      const childItem = await api.get(childId);
      const childNode = await api.renderItem(childId, effectiveView.type ? effectiveView : null, { onCycle, siblingContainer, navigateTo });

      // Base styles - override if maximized
      let wrapperStyle = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: ${width}px;
        height: ${height}px;
        z-index: ${z};
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
        background: var(--color-bg-surface-alt);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      `;

      if (isMaximized) {
        wrapperStyle = `
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          z-index: 1000000;
          border: 1px solid var(--color-border-light);
          border-radius: var(--border-radius);
          background: var(--color-bg-surface-alt);
          overflow: hidden;
          box-shadow: var(--shadow-md);
        `;
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

      // Click anywhere on wrapper to bring to front (only for floating, non-maximized windows)
      if (!windowIsAnchored && !effectiveView.anchor && !isMaximized) {
        wrapper.addEventListener('mousedown', async (e) => {
          // Only if not clicking titlebar or resize handle (they have their own handlers)
          // Also skip links - clicking a link opens a sibling, not focuses this window
          if (!e.target.classList.contains('titlebar') &&
              !e.target.classList.contains('resize-handle') &&
              !e.target.closest('a')) {
            const newZ = await bringToFront(childId);
            if (newZ !== null) {
              // Update DOM immediately (newZ already includes baseZ)
              wrapper.style.zIndex = newZ;
            }
          }
        });
      }

      // Determine if window can be dragged
      const canDrag = !windowIsAnchored && !effectiveView.anchor && !isMaximized;

      // Titlebar
      const titlebar = api.createElement('div', {
        class: 'titlebar',
        style: `
          height: 24px;
          background: var(--color-bg-hover);
          border-bottom: 1px solid var(--color-border);
          padding: 0 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 500;
          cursor: ${canDrag ? 'move' : 'default'};
          user-select: none;
        `
      }, []);

      // Menu button (left side)
      const menuBtn = api.createElement('button', {
        style: `
          width: 20px;
          height: 18px;
          padding: 0;
          margin-right: 6px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 12px;
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
        `,
        title: 'Window menu'
      }, ['≡']);

      // Menu dropdown
      const showWindowMenu = (e) => {
        e.stopPropagation();

        // Remove any existing window menu
        const existingMenu = document.querySelector('.window-menu');
        if (existingMenu) existingMenu.remove();

        const btnRect = menuBtn.getBoundingClientRect();
        const menu = api.createElement('div', {
          class: 'window-menu',
          style: `
            position: fixed;
            left: ${btnRect.left}px;
            top: ${btnRect.bottom + 2}px;
            background: var(--color-bg-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-md);
            z-index: 100000;
            min-width: 120px;
            font-size: 13px;
          `
        }, []);

        const createMenuItem = (label, onClick) => {
          const menuItemEl = api.createElement('div', {
            style: `
              padding: 8px 12px;
              cursor: pointer;
            `
          }, [label]);
          menuItemEl.addEventListener('mouseenter', () => { menuItemEl.style.background = 'var(--color-bg-body)'; });
          menuItemEl.addEventListener('mouseleave', () => { menuItemEl.style.background = 'transparent'; });
          menuItemEl.addEventListener('click', (clickE) => {
            clickE.stopPropagation();
            menu.remove();
            onClick();
          });
          return menuItemEl;
        };

        const createSeparator = () => {
          return api.createElement('div', {
            style: 'height: 1px; background: var(--color-border-light); margin: 4px 0;'
          }, []);
        };

        // Pin option (only for floating windows)
        if (!windowIsAnchored && !effectiveView.anchor) {
          menu.appendChild(createMenuItem('Pin', async () => {
            const containerEl = wrapper.parentElement;
            const cWidth = containerEl ? containerEl.clientWidth : 1000;
            const cHeight = containerEl ? containerEl.clientHeight : 600;

            // Get current position from DOM
            const currentX = parseInt(wrapper.style.left) || 0;
            const currentY = parseInt(wrapper.style.top) || 0;
            const currentWidth = parseInt(wrapper.style.width) || DEFAULT_WINDOW_WIDTH;
            const currentHeight = parseInt(wrapper.style.height) || DEFAULT_WINDOW_HEIGHT;

            const pinResult = pinToNearestCorner({
              x: currentX,
              y: currentY,
              width: currentWidth,
              height: currentHeight
            }, cWidth, cHeight);

            await updateChild(childId, {
              anchor: pinResult.anchor,
              x: pinResult.x,
              y: pinResult.y,
              z: 0,
              pinned: null // Remove old property if present
            });
            await api.navigate(api.getCurrentRoot());
          }));

          menu.appendChild(createSeparator());

          // Dock options
          const dockPositions = [
            { label: 'Dock Left', pos: 'left' },
            { label: 'Dock Right', pos: 'right' },
            { label: 'Dock Top', pos: 'top' },
            { label: 'Dock Bottom', pos: 'bottom' }
          ];

          for (const { label, pos } of dockPositions) {
            menu.appendChild(createMenuItem(label, async () => {
              const currentWidth = parseInt(wrapper.style.width) || DEFAULT_WINDOW_WIDTH;
              const currentHeight = parseInt(wrapper.style.height) || DEFAULT_WINDOW_HEIGHT;

              await updateChild(childId, {
                anchor: pos,
                x: 0,
                y: 0,
                width: currentWidth,
                height: currentHeight,
                z: 0,
                minimized: false,
                maximized: false,
                pinned: null
              });
              await api.navigate(api.getCurrentRoot());
            }));
          }
        }

        // Unpin option (for corner-anchored windows)
        if (windowIsCornerAnchored || isCornerAnchor(effectiveView.anchor)) {
          menu.appendChild(createMenuItem('Unpin', async () => {
            const containerEl = wrapper.parentElement;
            const cWidth = containerEl ? containerEl.clientWidth : 1000;
            const cHeight = containerEl ? containerEl.clientHeight : 600;

            // Convert anchor-relative position back to absolute
            const absPos = calculateAbsolutePosition(effectiveView, cWidth, cHeight);

            // Get max z for bringing to front
            const maxZ = await getMaxZ();

            await updateChild(childId, {
              anchor: null,
              x: absPos.left,
              y: absPos.top,
              width: absPos.width,
              height: absPos.height,
              z: maxZ - baseZ + 1
            });
            await api.navigate(api.getCurrentRoot());
          }));
        }

        // Undock option (for edge-anchored windows)
        if (windowIsEdgeAnchored || isEdgeAnchor(effectiveView.anchor)) {
          menu.appendChild(createMenuItem('Undock', async () => {
            const containerEl = wrapper.parentElement;
            const cWidth = containerEl ? containerEl.clientWidth : 1000;
            const cHeight = containerEl ? containerEl.clientHeight : 600;

            // Get current rendered dimensions from DOM
            const currentLeft = parseInt(wrapper.style.left) || 0;
            const currentTop = parseInt(wrapper.style.top) || 0;
            const currentWidth = parseInt(wrapper.style.width) || DEFAULT_WINDOW_WIDTH;
            const currentHeight = parseInt(wrapper.style.height) || DEFAULT_WINDOW_HEIGHT;

            // Get max z for bringing to front
            const maxZ = await getMaxZ();

            await updateChild(childId, {
              anchor: null,
              x: currentLeft,
              y: currentTop,
              width: currentWidth,
              height: currentHeight,
              z: maxZ - baseZ + 1
            });
            await api.navigate(api.getCurrentRoot());
          }));
        }

        document.body.appendChild(menu);

        // Close menu on click outside
        const closeMenu = () => {
          menu.remove();
          document.removeEventListener('mousedown', onMenuMouseDown, true);
        };
        const onMenuMouseDown = (evt) => {
          if (!menu.contains(evt.target) && evt.target !== menuBtn) closeMenu();
        };
        setTimeout(() => document.addEventListener('mousedown', onMenuMouseDown, true), 0);
      };

      menuBtn.addEventListener('click', showWindowMenu);
      titlebar.appendChild(menuBtn);

      // Title text
      const titleText = api.createElement('span', {
        style: 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
      }, [childItem.content?.title || childItem.name || childItem.id]);
      titlebar.appendChild(titleText);

      // Button container (right side)
      const buttonContainer = api.createElement('div', {
        style: 'display: flex; gap: 4px; align-items: center;'
      }, []);

      // Anchor indicator (shown for anchored windows - clicking unpins/undocks)
      if (windowIsAnchored || effectiveView.anchor) {
        const anchorIndicator = api.createElement('button', {
          style: `
            width: 18px;
            height: 18px;
            padding: 0;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 12px;
            color: var(--color-text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
          `,
          title: windowIsEdgeAnchored || isEdgeAnchor(effectiveView.anchor) ? 'Undock' : 'Unpin',
          onclick: async (clickE) => {
            clickE.stopPropagation();
            const containerEl = wrapper.parentElement;
            const cWidth = containerEl ? containerEl.clientWidth : 1000;
            const cHeight = containerEl ? containerEl.clientHeight : 600;

            // Get current rendered position/dimensions
            const currentLeft = parseInt(wrapper.style.left) || 0;
            const currentTop = parseInt(wrapper.style.top) || 0;
            const currentWidth = parseInt(wrapper.style.width) || DEFAULT_WINDOW_WIDTH;
            const currentHeight = parseInt(wrapper.style.height) || DEFAULT_WINDOW_HEIGHT;

            // Get max z for bringing to front
            const maxZ = await getMaxZ();

            await updateChild(childId, {
              anchor: null,
              x: currentLeft,
              y: currentTop,
              width: currentWidth,
              height: currentHeight,
              z: maxZ - baseZ + 1
            });
            await api.navigate(api.getCurrentRoot());
          }
        }, ['📌']);
        buttonContainer.appendChild(anchorIndicator);
      }

      // Minimize button (not for anchored windows)
      if (!windowIsAnchored && !effectiveView.anchor) {
        const minimizeBtn = api.createElement('button', {
          style: `
            width: 18px;
            height: 18px;
            padding: 0;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            color: var(--color-text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
          `,
          title: 'Minimize',
          onclick: async (clickE) => {
            clickE.stopPropagation();

            // Immediate DOM update for responsiveness
            wrapper.style.display = 'none';

            // Create minimized box immediately
            const existingMinimized = container.querySelectorAll('[data-minimized="true"]');
            const minIndex = existingMinimized.length;
            const minBox = api.createElement('div', {
              'data-item-id': childId,
              'data-parent-id': item.id,
              'data-minimized': 'true',
              style: `
                position: absolute;
                bottom: 8px;
                left: ${8 + minIndex * 158}px;
                width: 150px;
                height: 32px;
                background: var(--color-bg-hover);
                border: 1px solid var(--color-border);
                border-radius: var(--border-radius);
                display: flex;
                align-items: center;
                padding: 0 8px;
                cursor: pointer;
                z-index: 10000;
              `,
              onclick: async () => {
                // Restore: remove this box, show wrapper
                minBox.remove();
                wrapper.style.display = '';
                // Reposition other minimized boxes
                const remaining = container.querySelectorAll('[data-minimized="true"]');
                remaining.forEach((box, i) => { box.style.left = `${8 + i * 158}px`; });
                // Persist
                updateChild(childId, { minimized: false });
              }
            }, [childItem.content?.title || childItem.name || childId.slice(0,8)]);
            container.appendChild(minBox);

            // Persist to DB (fire and forget)
            updateChild(childId, { minimized: true, maximized: false });
          }
        }, ['−']);
        buttonContainer.appendChild(minimizeBtn);
      }

      // Maximize/Restore button (not for anchored windows)
      if (!windowIsAnchored && !effectiveView.anchor) {
        const maxBtn = api.createElement('button', {
          style: `
            width: 18px;
            height: 18px;
            padding: 0;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 12px;
            color: var(--color-text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
          `,
          title: isMaximized ? 'Restore' : 'Maximize',
          onclick: async (clickE) => {
            clickE.stopPropagation();
            const currentlyMaximized = wrapper.dataset.maximized === 'true';

            if (currentlyMaximized) {
              // Restore - apply original position from data attributes
              wrapper.style.left = `${wrapper.dataset.origX}px`;
              wrapper.style.top = `${wrapper.dataset.origY}px`;
              wrapper.style.width = `${wrapper.dataset.origWidth}px`;
              wrapper.style.height = `${wrapper.dataset.origHeight}px`;
              wrapper.style.right = '';
              wrapper.style.bottom = '';
              wrapper.style.zIndex = wrapper.dataset.origZ;
              wrapper.dataset.maximized = 'false';
              maxBtn.textContent = '□';
              maxBtn.title = 'Maximize';
              updateChild(childId, { maximized: false });
            } else {
              // Maximize - fill container
              wrapper.style.left = '0';
              wrapper.style.top = '0';
              wrapper.style.right = '0';
              wrapper.style.bottom = '0';
              wrapper.style.width = 'auto';
              wrapper.style.height = 'auto';
              wrapper.style.zIndex = '1000000';
              wrapper.dataset.maximized = 'true';
              maxBtn.textContent = '❐';
              maxBtn.title = 'Restore';
              updateChild(childId, { maximized: true });
            }
          }
        }, [isMaximized ? '❐' : '□']);
        buttonContainer.appendChild(maxBtn);
      }

      // Close button (only for floating windows)
      if (!windowIsAnchored && !effectiveView.anchor) {
        const closeBtn = api.createElement('button', {
          style: `
            width: 18px;
            height: 18px;
            padding: 0;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            color: var(--color-text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
          `,
          title: 'Close',
          onclick: async (clickE) => {
            clickE.stopPropagation();
            await api.detach(childId);
            wrapper.remove();
          }
        }, ['×']);
        buttonContainer.appendChild(closeBtn);
      }

      titlebar.appendChild(buttonContainer);

      // Drag handler (only for floating, non-maximized windows)
      if (canDrag) {
        titlebar.addEventListener('mousedown', async (e) => {
          // Don't drag if clicking buttons
          if (e.target.tagName === 'BUTTON') {
            return;
          }

          e.preventDefault();
          e.stopPropagation();

          // Bring to front immediately on titlebar click
          const newZ = await bringToFront(childId);
          if (newZ !== null) {
            wrapper.style.zIndex = newZ;
          }

          const startX = e.clientX;
          const startY = e.clientY;

          // Read current position from DOM (use isNaN check, not || fallback)
          const leftPx = parseInt(wrapper.style.left);
          const topPx = parseInt(wrapper.style.top);
          const startLeft = isNaN(leftPx) ? x : leftPx;
          const startTop = isNaN(topPx) ? y : topPx;

          const onMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            const newX = startLeft + deltaX;
            // Constrain Y so title bar can't go above container top
            const newY = Math.max(0, startTop + deltaY);

            // Update DOM immediately for smooth dragging
            wrapper.style.left = newX + 'px';
            wrapper.style.top = newY + 'px';
          };

          const onMouseUp = async (upEvent) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            const deltaX = upEvent.clientX - startX;
            const deltaY = upEvent.clientY - startY;

            const finalX = startLeft + deltaX;
            // Constrain Y so title bar can't go above container top
            const finalY = Math.max(0, startTop + deltaY);

            // Update position (z already handled by bringToFront)
            await updateChild(childId, {
              x: finalX,
              y: finalY,
              width: parseInt(wrapper.style.width) || width,
              height: parseInt(wrapper.style.height) || height,
              anchor: null
            });
          };

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        });
      }

      wrapper.appendChild(titlebar);

      // Resize handles (only for floating, non-maximized windows)
      if (canDrag) {
        // Helper function to create resize handler
        const createResizeHandle = (corner, cursorStyle) => {
          const positions = {
            'tl': { top: '0', left: '0' },
            'tr': { top: '0', right: '0' },
            'bl': { bottom: '0', left: '0' },
            'br': { bottom: '0', right: '0' }
          };

          const handle = api.createElement('div', {
            class: 'resize-handle',
            style: `
              position: absolute;
              ${positions[corner].top !== undefined ? 'top: ' + positions[corner].top + ';' : ''}
              ${positions[corner].bottom !== undefined ? 'bottom: ' + positions[corner].bottom + ';' : ''}
              ${positions[corner].left !== undefined ? 'left: ' + positions[corner].left + ';' : ''}
              ${positions[corner].right !== undefined ? 'right: ' + positions[corner].right + ';' : ''}
              width: 8px;
              height: 8px;
              background: var(--color-border-dark);
              cursor: ${cursorStyle};
              z-index: 10;
            `
          }, []);

          handle.addEventListener('mousedown', async (handleE) => {
            handleE.preventDefault();
            handleE.stopPropagation();

            // Bring to front on resize
            const newZ = await bringToFront(childId);
            if (newZ !== null) {
              wrapper.style.zIndex = newZ;
            }

            const startX = handleE.clientX;
            const startY = handleE.clientY;

            // Read current dimensions from DOM
            const startWidth = parseInt(wrapper.style.width) || width;
            const startHeight = parseInt(wrapper.style.height) || height;
            const leftPx = parseInt(wrapper.style.left);
            const topPx = parseInt(wrapper.style.top);
            const startLeft = isNaN(leftPx) ? x : leftPx;
            const startTop = isNaN(topPx) ? y : topPx;

            const onMouseMove = (moveEvent) => {
              const deltaX = moveEvent.clientX - startX;
              const deltaY = moveEvent.clientY - startY;

              // Calculate new dimensions based on corner
              let newWidth = startWidth;
              let newHeight = startHeight;
              let newLeft = startLeft;
              let newTop = startTop;

              if (corner === 'br') {
                // Bottom-right: increase width and height
                newWidth = Math.max(MIN_WINDOW_WIDTH, startWidth + deltaX);
                newHeight = Math.max(MIN_WINDOW_HEIGHT, startHeight + deltaY);
              } else if (corner === 'bl') {
                // Bottom-left: change x and width, increase height
                newWidth = Math.max(MIN_WINDOW_WIDTH, startWidth - deltaX);
                newHeight = Math.max(MIN_WINDOW_HEIGHT, startHeight + deltaY);
                newLeft = startLeft + (startWidth - newWidth);
              } else if (corner === 'tr') {
                // Top-right: change y and height, increase width
                newWidth = Math.max(MIN_WINDOW_WIDTH, startWidth + deltaX);
                newHeight = Math.max(MIN_WINDOW_HEIGHT, startHeight - deltaY);
                newTop = startTop + (startHeight - newHeight);
              } else if (corner === 'tl') {
                // Top-left: change x, y, width, and height
                newWidth = Math.max(MIN_WINDOW_WIDTH, startWidth - deltaX);
                newHeight = Math.max(MIN_WINDOW_HEIGHT, startHeight - deltaY);
                newLeft = startLeft + (startWidth - newWidth);
                newTop = startTop + (startHeight - newHeight);
              }

              // Update DOM immediately for smooth resizing
              wrapper.style.width = newWidth + 'px';
              wrapper.style.height = newHeight + 'px';
              wrapper.style.left = newLeft + 'px';
              wrapper.style.top = newTop + 'px';
            };

            const onMouseUp = async () => {
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);

              // Save final dimensions (z already handled by bringToFront)
              const finalWidth = parseInt(wrapper.style.width);
              const finalHeight = parseInt(wrapper.style.height);
              const finalLeft = parseInt(wrapper.style.left);
              const finalTop = parseInt(wrapper.style.top);

              await updateChild(childId, {
                x: finalLeft,
                y: finalTop,
                width: finalWidth,
                height: finalHeight,
                anchor: null
              });
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          });

          return handle;
        };

        // Add all 4 corner handles
        wrapper.appendChild(createResizeHandle('tl', 'nwse-resize'));
        wrapper.appendChild(createResizeHandle('tr', 'nesw-resize'));
        wrapper.appendChild(createResizeHandle('bl', 'nesw-resize'));
        wrapper.appendChild(createResizeHandle('br', 'nwse-resize'));
      }

      // Edge resize handles for docked windows (edge-anchored)
      if (windowIsEdgeAnchored || isEdgeAnchor(effectiveView.anchor)) {
        const edgeAnchor = effectiveView.anchor;
        // For docked windows, allow resizing only on the non-docked edge
        const createEdgeResizeHandle = (edge, cursorStyle) => {
          let handleStyle = 'position: absolute; background: transparent;';
          if (edge === 'right') {
            handleStyle += ' right: 0; top: 0; bottom: 0; width: 6px;';
          } else if (edge === 'left') {
            handleStyle += ' left: 0; top: 0; bottom: 0; width: 6px;';
          } else if (edge === 'bottom') {
            handleStyle += ' bottom: 0; left: 0; right: 0; height: 6px;';
          } else if (edge === 'top') {
            handleStyle += ' top: 0; left: 0; right: 0; height: 6px;';
          }

          const handle = api.createElement('div', {
            class: 'resize-handle',
            style: handleStyle + ` cursor: ${cursorStyle};`
          }, []);

          handle.addEventListener('mouseenter', () => {
            handle.style.background = 'rgba(0, 0, 0, 0.1)';
          });
          handle.addEventListener('mouseleave', () => {
            handle.style.background = 'transparent';
          });

          handle.addEventListener('mousedown', async (handleE) => {
            handleE.preventDefault();
            handleE.stopPropagation();

            const startX = handleE.clientX;
            const startY = handleE.clientY;
            const startWidth = parseInt(wrapper.style.width) || width;
            const startHeight = parseInt(wrapper.style.height) || height;
            const startLeft = parseInt(wrapper.style.left) || 0;
            const startTop = parseInt(wrapper.style.top) || 0;

            const onMouseMove = (moveEvent) => {
              const deltaX = moveEvent.clientX - startX;
              const deltaY = moveEvent.clientY - startY;

              if (edge === 'right' && edgeAnchor === 'left') {
                wrapper.style.width = Math.max(MIN_DOCKED_WIDTH, startWidth + deltaX) + 'px';
              } else if (edge === 'left' && edgeAnchor === 'right') {
                const newWidth = Math.max(MIN_DOCKED_WIDTH, startWidth - deltaX);
                wrapper.style.width = newWidth + 'px';
                wrapper.style.left = (startLeft + startWidth - newWidth) + 'px';
              } else if (edge === 'bottom' && edgeAnchor === 'top') {
                wrapper.style.height = Math.max(MIN_DOCKED_HEIGHT, startHeight + deltaY) + 'px';
              } else if (edge === 'top' && edgeAnchor === 'bottom') {
                const newHeight = Math.max(MIN_DOCKED_HEIGHT, startHeight - deltaY);
                wrapper.style.height = newHeight + 'px';
                wrapper.style.top = (startTop + startHeight - newHeight) + 'px';
              }
            };

            const onMouseUp = async () => {
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);

              const finalWidth = parseInt(wrapper.style.width);
              const finalHeight = parseInt(wrapper.style.height);

              await updateChild(childId, {
                width: finalWidth,
                height: finalHeight
              });
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          });

          return handle;
        };

        // Add appropriate resize handle based on dock position
        if (edgeAnchor === 'left') {
          wrapper.appendChild(createEdgeResizeHandle('right', 'ew-resize'));
        } else if (edgeAnchor === 'right') {
          wrapper.appendChild(createEdgeResizeHandle('left', 'ew-resize'));
        } else if (edgeAnchor === 'top') {
          wrapper.appendChild(createEdgeResizeHandle('bottom', 'ns-resize'));
        } else if (edgeAnchor === 'bottom') {
          wrapper.appendChild(createEdgeResizeHandle('top', 'ns-resize'));
        }
      }

      // Content area
      const contentArea = api.createElement('div', {
        class: 'window-content',
        style: 'padding: 15px; overflow: auto; height: calc(100% - 24px);'
      }, []);
      contentArea.appendChild(childNode);
      wrapper.appendChild(contentArea);

      return wrapper;
    };

    // Sibling container object - passed to children so they can add siblings
    siblingContainer = {
      id: item.id,
      addSibling: async (childId, navigateTo = null) => {
        const freshItem = await api.get(item.id);
        const freshChildren = freshItem.attachments || [];
        const existingChild = freshChildren.find(c => c.id === childId);

        if (existingChild) {
          // Item already exists - bring to front and unminimize
          const wasMinimized = existingChild.view?.minimized;

          // Update to unminimize if needed
          if (wasMinimized) {
            await updateChild(childId, { minimized: false });
          }

          // Bring to front (handles z-index) - only for non-anchored windows
          if (!isAnchored(existingChild.view?.anchor)) {
            const newZ = await bringToFront(childId);

            // Update DOM immediately if we got a new z value
            if (newZ !== null) {
              const wrapper = document.querySelector(`[data-parent-id="${item.id}"][data-item-id="${childId}"]`);
              if (wrapper) {
                wrapper.style.zIndex = newZ;
              }
            }
          }

          // Re-render if was minimized (need to show the window)
          if (wasMinimized) {
            await api.navigate(api.getCurrentRoot());
          }
        } else {
          // Item doesn't exist - add as new child and create window directly
          await api.attach(childId);

          // Calculate position for new window (offset from existing windows)
          const existingWrappers = document.querySelectorAll(`[data-parent-id="${item.id}"]`);
          let newX = 50;
          let newY = 50;
          if (existingWrappers.length > 0) {
            // Offset from last window
            const lastWrapper = existingWrappers[existingWrappers.length - 1];
            const lastLeft = parseInt(lastWrapper.style.left) || 0;
            const lastTop = parseInt(lastWrapper.style.top) || 0;
            newX = lastLeft + 30;
            newY = lastTop + 30;
          }

          // Get next z-index
          const maxZ = await getMaxZ();
          const newZ = maxZ + 1;

          // Update the child's view in the database with position and z
          await updateChild(childId, { x: newX, y: newY, z: newZ - baseZ });

          // Create window wrapper and append to container
          const wrapper = await createWindowForChild(childId, {
            x: newX,
            y: newY,
            width: DEFAULT_WINDOW_WIDTH,
            height: DEFAULT_WINDOW_HEIGHT,
            z: newZ - baseZ
          }, navigateTo);

          // Find the container element in the DOM and append
          const containerEl = document.querySelector(`[data-container-id="${item.id}"]`);
          if (containerEl) {
            containerEl.appendChild(wrapper);
          }
        }
      }
    };

    // Render children in parallel for better performance
    // Also await inner view promise (started earlier) in parallel with children
    const childRenderPromises = childrenToRender.map(async (child) => {
      try {
        // Pass navigateTo from view config if present (used by inspector and other external openers)
        return await createWindowForChild(child.id, child.view || {}, child.view?.navigateTo);
      } catch (error) {
        const childView = child.view || {};
        const xPos = childView.x || 0;
        const yPos = childView.y || 0;
        const widthVal = childView.width || DEFAULT_WINDOW_WIDTH;
        const zVal = (childView.z || 0) + baseZ;
        return api.createElement('div', {
          style: `
            position: absolute;
            left: ${xPos}px;
            top: ${yPos}px;
            width: ${widthVal}px;
            padding: 15px;
            border: 1px solid var(--color-danger);
            border-radius: var(--border-radius);
            background: var(--color-danger-light);
            color: var(--color-danger);
            z-index: ${zVal};
          `
        }, [
          'Error rendering child: ' + child.id + ' - ' + error.message
        ]);
      }
    });

    // Await inner view and children in parallel
    const allPromises = innerViewPromise
      ? [innerViewPromise, ...childRenderPromises]
      : childRenderPromises;
    const allResults = await Promise.all(allPromises);

    // If we had an inner view, append it to background
    if (innerViewPromise) {
      const innerDom = allResults[0];
      if (innerDom) {
        innerDom.style.flex = '1';
        innerDom.style.minHeight = '0';
        background.appendChild(innerDom);
      }
      // Child wrappers are the rest of the results
      allResults.slice(1).forEach(wrapper => container.appendChild(wrapper));
    } else {
      allResults.forEach(wrapper => container.appendChild(wrapper));
    }

    // Render minimized windows at bottom
    for (let index = 0; index < minimizedChildren.length; index++) {
      const child = minimizedChildren[index];
      const childId = child.id;

      try {
        const childItem = await api.get(childId);
        const itemName = childItem.content?.title || childItem.name || childItem.id;

        const minimizedBox = api.createElement('div', {
          'data-item-id': childId,
          'data-parent-id': item.id,
          'data-minimized': 'true',
          style: `
            position: absolute;
            bottom: 8px;
            left: ${8 + (index * 158)}px;
            width: 150px;
            height: 32px;
            background: var(--color-bg-hover);
            border: 1px solid var(--color-border);
            border-radius: var(--border-radius);
            display: flex;
            align-items: center;
            padding: 0 8px;
            cursor: pointer;
            z-index: 9999;
            box-shadow: var(--shadow-sm);
          `,
          title: itemName,
          onclick: async () => {
            // Restore window and bring to front using normalized z-indices
            const freshItem = await api.get(item.id);
            const freshChildren = freshItem.attachments || [];

            // Get floating, non-minimized children sorted by z
            const floating = freshChildren
              .filter(c => !isAnchored(c.view?.anchor) && !c.view?.minimized && c.id !== childId)
              .map(c => ({ id: c.id, z: c.view?.z || 0 }))
              .sort((a, b) => a.z - b.z);

            // Add restored window at the end (front)
            floating.push({ id: childId, z: floating.length });

            // Build map of new z-values
            const newZValues = new Map();
            floating.forEach((c, idx) => {
              newZValues.set(c.id, idx);
            });

            // Update all children
            const updatedChildren = freshChildren.map(c => {
              if (c.id === childId) {
                return {
                  ...c,
                  view: { ...(c.view || {}), minimized: false, z: newZValues.get(c.id) }
                };
              }
              if (newZValues.has(c.id)) {
                return {
                  ...c,
                  view: { ...(c.view || {}), z: newZValues.get(c.id) }
                };
              }
              return c;
            });

            const updated = {
              ...freshItem,
              attachments: updatedChildren,
              modified: Date.now()
            };

            await api.updateSilent(updated);
            await api.rerenderItem(item.id);
          }
        }, []);

        const text = api.createElement('span', {
          style: 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px;'
        }, [itemName]);

        minimizedBox.appendChild(text);
        container.appendChild(minimizedBox);
      } catch (error) {
        console.error('Error rendering minimized item:', childId, error);
      }
    }

    // Update anchored window positions on container resize or scroll
    // Anchored windows stay in the viewport (sticky behavior) - scroll offset is added
    const updateAnchoredWindowPositions = (containerWidth, containerHeight, scrollLeft, scrollTop) => {
      const windowWrappers = container.querySelectorAll('[data-anchor]');
      windowWrappers.forEach(wrapper => {
        const anchorAttr = wrapper.getAttribute('data-anchor');
        if (!anchorAttr || anchorAttr === 'top-left' || anchorAttr === '') return;

        const childIdAttr = wrapper.getAttribute('data-item-id');
        const childEntry = children.find(c => c.id === childIdAttr);
        if (!childEntry) return;

        const view = childEntry.view || {};
        const pos = calculateAbsolutePosition({ ...view, anchor: anchorAttr }, containerWidth, containerHeight);

        // Add scroll offset so anchored windows stay in viewport
        wrapper.style.left = (pos.left + scrollLeft) + 'px';
        wrapper.style.top = (pos.top + scrollTop) + 'px';
        wrapper.style.width = pos.width + 'px';
        wrapper.style.height = pos.height + 'px';
      });
    };

    // Track container dimensions for scroll handler
    let lastContainerWidth = container.clientWidth || 1000;
    let lastContainerHeight = container.clientHeight || 600;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        lastContainerWidth = entry.contentRect.width;
        lastContainerHeight = entry.contentRect.height;
        updateAnchoredWindowPositions(
          lastContainerWidth,
          lastContainerHeight,
          container.scrollLeft,
          container.scrollTop
        );
      }
    });
    resizeObserver.observe(container);

    // Scroll handler to keep anchored windows in viewport
    container.addEventListener('scroll', () => {
      updateAnchoredWindowPositions(
        lastContainerWidth,
        lastContainerHeight,
        container.scrollLeft,
        container.scrollTop
      );
    });
  }

  // SCROLL PRESERVATION: Restore scroll positions after DOM is created
  // Use double-RAF to ensure layout is complete before setting scroll positions
  if (scrollStates.size > 0) {
    const restoreScroll = () => {
      const newWindows = document.querySelectorAll(`[data-parent-id="${item.id}"]`);
      newWindows.forEach(wrapper => {
        const childId = wrapper.getAttribute('data-item-id');
        const saved = scrollStates.get(childId);
        if (saved) {
          const content = wrapper.querySelector('.window-content');
          if (content) {
            content.scrollTop = saved.scrollTop;
            content.scrollLeft = saved.scrollLeft;
          }
        }
      });
    };
    requestAnimationFrame(() => requestAnimationFrame(restoreScroll));
  }

  return container;
}
