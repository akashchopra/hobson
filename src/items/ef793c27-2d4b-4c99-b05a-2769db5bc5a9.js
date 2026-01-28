// Item: container_view
// ID: ef793c27-2d4b-4c99-b05a-2769db5bc5a9
// Type: aaaaaaaa-0000-0000-0000-000000000000



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
  const container = api.createElement('div', {
    'data-container-id': item.id,
    style: 'position: relative; width: 100%; height: 100%; overflow: hidden;'
  }, []);

  // Get view config for banner state (persisted in parent's child entry)
  const viewConfig = api.getViewConfig() || {};
  let bannerPosition = viewConfig.bannerPosition || 'left';
  let bannerSize = viewConfig.bannerSize || 200;
  const minBannerSize = 20;

  // Calculate banner styles based on position
  const getBannerStyles = (pos, size) => {
    const base = 'position: absolute; z-index: 0; background: #f5f5f5; overflow: auto; display: flex; flex-direction: column;';
    switch (pos) {
      case 'left':
        return base + ` left: 0; top: 0; bottom: 0; width: ${size}px; border-right: 1px solid #ddd;`;
      case 'right':
        return base + ` right: 0; top: 0; bottom: 0; width: ${size}px; border-left: 1px solid #ddd;`;
      case 'top':
        return base + ` left: 0; right: 0; top: 0; height: ${size}px; border-bottom: 1px solid #ddd;`;
      case 'bottom':
        return base + ` left: 0; right: 0; bottom: 0; height: ${size}px; border-top: 1px solid #ddd;`;
      default:
        return base + ` left: 0; top: 0; bottom: 0; width: ${size}px; border-right: 1px solid #ddd;`;
    }
  };

  // Get resize handle styles based on position
  const getResizeHandleStyles = (pos) => {
    const base = 'position: absolute; background: transparent;';
    switch (pos) {
      case 'left':
        return base + ' right: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize;';
      case 'right':
        return base + ' left: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize;';
      case 'top':
        return base + ' left: 0; right: 0; bottom: 0; height: 6px; cursor: ns-resize;';
      case 'bottom':
        return base + ' left: 0; right: 0; top: 0; height: 6px; cursor: ns-resize;';
      default:
        return base + ' right: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize;';
    }
  };

  // Banner element
  const banner = api.createElement('div', {
    class: 'container-banner',
    style: getBannerStyles(bannerPosition, bannerSize)
  }, []);

  // Banner content
  const bannerContent = api.createElement('div', {
    style: 'flex: 1; padding: 16px; overflow: auto;'
  }, []);

  const description = item.content?.description;
  if (description) {
    // Render description as markdown with Hobson extensions (links, transclusions)
    const hobsonMarkdown = await api.require('hobson-markdown');
    const descDiv = await hobsonMarkdown.render(description, api);
    descDiv.style.lineHeight = '1.6';
    descDiv.style.color = '#333';
    bannerContent.appendChild(descDiv);
  } else {
    const placeholder = api.createElement('div', {
      style: 'color: #999; font-style: italic;'
    }, ['No description - consider adding one']);
    bannerContent.appendChild(placeholder);
  }

  banner.appendChild(bannerContent);

  // Resize handle
  const resizeHandle = api.createElement('div', {
    style: getResizeHandleStyles(bannerPosition)
  }, []);

  // Resize handle hover effect
  resizeHandle.addEventListener('mouseenter', () => {
    resizeHandle.style.background = 'rgba(0, 0, 0, 0.1)';
  });
  resizeHandle.addEventListener('mouseleave', () => {
    resizeHandle.style.background = 'transparent';
  });

  // Resize drag handler
  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startSize = bannerSize;
    const containerRect = container.getBoundingClientRect();
    const isHorizontal = bannerPosition === 'left' || bannerPosition === 'right';
    const maxSize = isHorizontal ? containerRect.width * 0.5 : containerRect.height * 0.5;

    const onMouseMove = (moveEvent) => {
      let delta;
      if (bannerPosition === 'left') {
        delta = moveEvent.clientX - startX;
      } else if (bannerPosition === 'right') {
        delta = startX - moveEvent.clientX;
      } else if (bannerPosition === 'top') {
        delta = moveEvent.clientY - startY;
      } else {
        delta = startY - moveEvent.clientY;
      }
      const newSize = Math.max(minBannerSize, Math.min(maxSize, startSize + delta));
      bannerSize = newSize;
      if (isHorizontal) {
        banner.style.width = newSize + 'px';
      } else {
        banner.style.height = newSize + 'px';
      }
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // Persist the new banner size
      await api.updateViewConfig({ bannerSize });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  banner.appendChild(resizeHandle);

  // Context menu for banner position
  banner.addEventListener('contextmenu', async (e) => {
    if (e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();

    // Remove any existing context menu
    const existingMenu = document.querySelector('.banner-context-menu');
    if (existingMenu) existingMenu.remove();

    const menu = api.createElement('div', {
      class: 'banner-context-menu',
      style: `
        position: fixed;
        left: ${e.clientX}px;
        top: ${e.clientY}px;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 100000;
        min-width: 120px;
      `
    }, []);

    const positions = ['left', 'right', 'top', 'bottom'];
    for (const pos of positions) {
      const isActive = pos === bannerPosition;
      const menuItem = api.createElement('div', {
        style: `
          padding: 8px 16px;
          cursor: pointer;
          font-size: 13px;
          ${isActive ? 'font-weight: bold; background: #f0f0f0;' : ''}
        `
      }, [pos.charAt(0).toUpperCase() + pos.slice(1) + (isActive ? ' \u2713' : '')]);
      menuItem.addEventListener('mouseenter', () => { if (!isActive) menuItem.style.background = '#f5f5f5'; });
      menuItem.addEventListener('mouseleave', () => { if (!isActive) menuItem.style.background = 'transparent'; });
      menuItem.addEventListener('click', async () => {
        menu.remove();
        if (pos !== bannerPosition) {
          await api.updateViewConfig({ bannerPosition: pos });
          await api.navigate(api.getCurrentRoot());
        }
      });
      menu.appendChild(menuItem);
    }

    document.body.appendChild(menu);

    // Close menu on click outside
    const closeMenu = () => {
      menu.remove();
      document.removeEventListener('mousedown', onMouseDown, true);
    };
    const onMouseDown = (evt) => {
      if (!menu.contains(evt.target)) closeMenu();
    };
    setTimeout(() => document.addEventListener('mousedown', onMouseDown, true), 0);
  });

  container.appendChild(banner);

  // Children (windows)
  const children = item.children || [];

  if (children.length === 0) {
    // Position empty message based on banner position
    let emptyStyle = 'position: absolute; color: #999; font-style: italic;';
    if (bannerPosition === 'left') emptyStyle += ` left: ${bannerSize + 40}px; top: 40px;`;
    else if (bannerPosition === 'right') emptyStyle += ' left: 40px; top: 40px;';
    else if (bannerPosition === 'top') emptyStyle += ` left: 40px; top: ${bannerSize + 40}px;`;
    else emptyStyle += ' left: 40px; top: 40px;';
    const empty = api.createElement('div', { style: emptyStyle }, [
      'No items yet. Use the REPL to add children.'
    ]);
    container.appendChild(empty);
  } else {
    // Function to update child view properties (silent - no re-render)
    const updateChild = async (childId, viewUpdates) => {
      // Get fresh children from database (not stale closure)
      const freshItem = await api.get(item.id);
      const freshChildren = freshItem.children || [];

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
        children: updatedChildren,
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
    // Base z-index is now 2 (banner is 0, windows start at 2+)
    const baseZ = 2;

    // Helper: Get current max z-index from both database and DOM
    const getMaxZ = async () => {
      const freshItem = await api.get(item.id);
      const freshChildren = freshItem.children || [];
      const unpinned = freshChildren.filter(c => !c.view?.pinned && !c.view?.minimized);
      const maxDbZ = Math.max(...unpinned.map(c => c.view?.z || 0), 0);

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
      const freshChildren = freshItem.children || [];

      // Get max z from database (unpinned, non-minimized)
      const unpinned = freshChildren.filter(c => !c.view?.pinned && !c.view?.minimized);
      const maxDbZ = Math.max(...unpinned.map(c => c.view?.z || 0), 0);

      // Get max z from DOM (sibling windows may have higher z from previous interactions)
      const siblingWrappers = document.querySelectorAll(`[data-parent-id="${item.id}"]`);
      let maxDomZ = baseZ;
      siblingWrappers.forEach(w => {
        const z = parseInt(w.style.zIndex) || 0;
        if (z > maxDomZ) maxDomZ = z;
      });

      // Find target in unpinned list
      const targetChild = unpinned.find(c => c.id === childIdToFront);
      if (!targetChild) return null; // Pinned or minimized

      // Current z of target (database value + baseZ)
      const currentDbZ = (targetChild.view?.z || 0) + baseZ;

      // Max z considering both database and DOM
      const maxZ = Math.max(maxDbZ + baseZ, maxDomZ);

      // If already at or above max, no change needed
      if (currentDbZ >= maxZ) return null;

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
      style: 'padding: 12px; color: #888; font-style: italic; border: 1px dashed #ccc; border-radius: 4px; background: #f9f9f9; text-align: center;'
    }, ['↻ ' + (cycleItem.name || cycleItem.id.substring(0, 8)) + ' (already shown above)']);

    // Forward declaration for siblingContainer (needed by createWindowForChild)
    let siblingContainer;

    // Helper: Create a window wrapper for a child item
    // This is extracted so addSibling can create windows without full re-render
    const createWindowForChild = async (childId, childView = {}) => {
      const x = childView.x || 0;
      const y = childView.y || 0;
      const width = childView.width || 500;
      const height = childView.height || 400;
      const z = childView.z !== undefined ? childView.z + baseZ : (await getMaxZ()) + 1;
      const isPinned = childView.pinned || false;
      const isMaximized = childView.maximized || false;

      const childItem = await api.get(childId);
      const childNode = await api.renderItem(childId, childView.type ? childView : null, { onCycle, siblingContainer });

      // Base styles - override if maximized
      let wrapperStyle = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: ${width}px;
        height: ${height}px;
        z-index: ${z};
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #fafafa;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      `;

      if (isMaximized) {
        wrapperStyle = `
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          z-index: 1000000;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: #fafafa;
          overflow: hidden;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        `;
      }

      const wrapper = api.createElement('div', {
        'data-item-id': childId,
        'data-parent-id': item.id,
        style: wrapperStyle
      }, []);

      // Click anywhere on wrapper to bring to front (only for unpinned, non-maximized windows)
      if (!isPinned && !isMaximized) {
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

      // Titlebar
      const titlebar = api.createElement('div', {
        class: 'titlebar',
        style: `
          height: 24px;
          background: #e8e8e8;
          border-bottom: 1px solid #ccc;
          padding: 0 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 500;
          cursor: ${isPinned || isMaximized ? 'default' : 'move'};
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
          color: #666;
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
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 100000;
            min-width: 120px;
            font-size: 13px;
          `
        }, []);

        const createMenuItem = (label, onClick) => {
          const item = api.createElement('div', {
            style: `
              padding: 8px 12px;
              cursor: pointer;
            `
          }, [label]);
          item.addEventListener('mouseenter', () => { item.style.background = '#f5f5f5'; });
          item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.remove();
            onClick();
          });
          return item;
        };

        const createSeparator = () => {
          return api.createElement('div', {
            style: 'height: 1px; background: #ddd; margin: 4px 0;'
          }, []);
        };

        // Pin/Unpin option
        menu.appendChild(createMenuItem(isPinned ? 'Unpin' : 'Pin', async () => {
          if (isPinned) {
            // Unpinning: bring to front
            const freshItem = await api.get(item.id);
            const freshChildren = freshItem.children || [];

            const unpinned = freshChildren
              .filter(c => !c.view?.pinned && !c.view?.minimized)
              .map(c => ({ id: c.id, z: c.view?.z || 0 }))
              .sort((a, b) => a.z - b.z);

            unpinned.push({ id: childId, z: unpinned.length });

            const newZValues = new Map();
            unpinned.forEach((c, index) => {
              newZValues.set(c.id, index);
            });

            const updatedChildren = freshChildren.map(c => {
              if (c.id === childId) {
                return {
                  ...c,
                  view: { ...(c.view || {}), pinned: false, z: newZValues.get(c.id) }
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
              children: updatedChildren,
              modified: Date.now()
            };

            await api.updateSilent(updated);
          } else {
            // Pinning: move to bottom
            await updateChild(childId, { pinned: true, z: 0 });
          }
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
            const containerEl = wrapper.parentElement;
            const canvasWidth = containerEl ? containerEl.clientWidth : 1000;
            const canvasHeight = containerEl ? containerEl.clientHeight : 600;
            const currentWidth = parseInt(wrapper.style.width) || 400;
            const currentHeight = parseInt(wrapper.style.height) || 300;

            let newView = { minimized: false, maximized: false, pinned: false };
            if (pos === 'left') {
              newView.x = 0;
              newView.y = 0;
              newView.width = currentWidth;
              newView.height = canvasHeight;
            } else if (pos === 'right') {
              newView.x = canvasWidth - currentWidth;
              newView.y = 0;
              newView.width = currentWidth;
              newView.height = canvasHeight;
            } else if (pos === 'top') {
              newView.x = 0;
              newView.y = 0;
              newView.width = canvasWidth;
              newView.height = currentHeight;
            } else if (pos === 'bottom') {
              newView.x = 0;
              newView.y = canvasHeight - currentHeight;
              newView.width = canvasWidth;
              newView.height = currentHeight;
            }

            await updateChild(childId, newView);
            await api.navigate(api.getCurrentRoot());
          }));
        }

        document.body.appendChild(menu);

        // Close menu on click outside
        const closeMenu = () => {
          menu.remove();
          document.removeEventListener('mousedown', onMouseDown, true);
        };
        const onMouseDown = (evt) => {
          if (!menu.contains(evt.target) && evt.target !== menuBtn) closeMenu();
        };
        setTimeout(() => document.addEventListener('mousedown', onMouseDown, true), 0);
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

      // Pin indicator (only shown when pinned - clicking unpins)
      if (isPinned) {
        const pinIndicator = api.createElement('button', {
          style: `
            width: 18px;
            height: 18px;
            padding: 0;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 12px;
            color: #666;
            display: flex;
            align-items: center;
            justify-content: center;
          `,
          title: 'Unpin (make moveable)',
          onclick: async (e) => {
            e.stopPropagation();
            // Unpinning: bring to front
            const freshItem = await api.get(item.id);
            const freshChildren = freshItem.children || [];

            const unpinned = freshChildren
              .filter(c => !c.view?.pinned && !c.view?.minimized)
              .map(c => ({ id: c.id, z: c.view?.z || 0 }))
              .sort((a, b) => a.z - b.z);

            unpinned.push({ id: childId, z: unpinned.length });

            const newZValues = new Map();
            unpinned.forEach((c, index) => {
              newZValues.set(c.id, index);
            });

            const updatedChildren = freshChildren.map(c => {
              if (c.id === childId) {
                return {
                  ...c,
                  view: { ...(c.view || {}), pinned: false, z: newZValues.get(c.id) }
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
              children: updatedChildren,
              modified: Date.now()
            };

            await api.updateSilent(updated);
            await api.navigate(api.getCurrentRoot());
          }
        }, ['📌']);
        buttonContainer.appendChild(pinIndicator);
      }

      // Minimize button (not for pinned windows)
      if (!isPinned) {
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
            color: #666;
            display: flex;
            align-items: center;
            justify-content: center;
          `,
          title: 'Minimize',
          onclick: async (e) => {
            e.stopPropagation();
            await updateChild(childId, { minimized: true, maximized: false });
            await api.navigate(api.getCurrentRoot());
          }
        }, ['−']);
        buttonContainer.appendChild(minimizeBtn);
      }

      // Maximize/Restore button (not for pinned windows)
      if (!isPinned) {
        const maxBtn = api.createElement('button', {
          style: `
            width: 18px;
            height: 18px;
            padding: 0;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 12px;
            color: #666;
            display: flex;
            align-items: center;
            justify-content: center;
          `,
          title: isMaximized ? 'Restore' : 'Maximize',
          onclick: async (e) => {
            e.stopPropagation();
            if (isMaximized) {
              // Restore
              await updateChild(childId, { maximized: false });
            } else {
              // Maximize
              await updateChild(childId, { maximized: true });
            }
            await api.navigate(api.getCurrentRoot());
          }
        }, [isMaximized ? '❐' : '□']);
        buttonContainer.appendChild(maxBtn);
      }

      // Close button (only for unpinned windows)
      if (!isPinned) {
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
            color: #666;
            display: flex;
            align-items: center;
            justify-content: center;
          `,
          title: 'Close',
          onclick: async (e) => {
            e.stopPropagation();
            await api.removeChild(childId);
            wrapper.remove();
          }
        }, ['×']);
        buttonContainer.appendChild(closeBtn);
      }

      titlebar.appendChild(buttonContainer);

      // Drag handler (only for unpinned, non-maximized windows)
      if (!isPinned && !isMaximized) {
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
            const newY = startTop + deltaY;

            // Update DOM immediately for smooth dragging
            wrapper.style.left = newX + 'px';
            wrapper.style.top = newY + 'px';
          };

          const onMouseUp = async (upEvent) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            const deltaX = upEvent.clientX - startX;
            const deltaY = upEvent.clientY - startY;

            const newX = startLeft + deltaX;
            const newY = startTop + deltaY;

            // Update position (z already handled by bringToFront)
            await updateChild(childId, {
              x: newX,
              y: newY,
              width: parseInt(wrapper.style.width) || width,
              height: parseInt(wrapper.style.height) || height,
              pinned: false
            });
          };

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        });
      }

      wrapper.appendChild(titlebar);

      // Resize handles (only for unpinned, non-maximized windows)
      if (!isPinned && !isMaximized) {
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
              background: #999;
              cursor: ${cursorStyle};
              z-index: 10;
            `
          }, []);

          handle.addEventListener('mousedown', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Bring to front on resize
            const newZ = await bringToFront(childId);
            if (newZ !== null) {
              wrapper.style.zIndex = newZ;
            }

            const startX = e.clientX;
            const startY = e.clientY;

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
                newWidth = Math.max(200, startWidth + deltaX);
                newHeight = Math.max(150, startHeight + deltaY);
              } else if (corner === 'bl') {
                // Bottom-left: change x and width, increase height
                newWidth = Math.max(200, startWidth - deltaX);
                newHeight = Math.max(150, startHeight + deltaY);
                newLeft = startLeft + (startWidth - newWidth);
              } else if (corner === 'tr') {
                // Top-right: change y and height, increase width
                newWidth = Math.max(200, startWidth + deltaX);
                newHeight = Math.max(150, startHeight - deltaY);
                newTop = startTop + (startHeight - newHeight);
              } else if (corner === 'tl') {
                // Top-left: change x, y, width, and height
                newWidth = Math.max(200, startWidth - deltaX);
                newHeight = Math.max(150, startHeight - deltaY);
                newLeft = startLeft + (startWidth - newWidth);
                newTop = startTop + (startHeight - newHeight);
              }

              // Update DOM immediately for smooth resizing
              wrapper.style.width = newWidth + 'px';
              wrapper.style.height = newHeight + 'px';
              wrapper.style.left = newLeft + 'px';
              wrapper.style.top = newTop + 'px';
            };

            const onMouseUp = async (upEvent) => {
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
                pinned: false
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
      addSibling: async (childId) => {
        const freshItem = await api.get(item.id);
        const freshChildren = freshItem.children || [];
        const existingChild = freshChildren.find(c => c.id === childId);

        if (existingChild) {
          // Item already exists - bring to front and unminimize
          const wasMinimized = existingChild.view?.minimized;

          // Update to unminimize if needed
          if (wasMinimized) {
            await updateChild(childId, { minimized: false });
          }

          // Bring to front (handles z-index)
          const newZ = await bringToFront(childId);

          // Update DOM immediately if we got a new z value
          if (newZ !== null) {
            const wrapper = document.querySelector(`[data-parent-id="${item.id}"][data-item-id="${childId}"]`);
            if (wrapper) {
              wrapper.style.zIndex = newZ;
            }
          }

          // Re-render if was minimized (need to show the window)
          if (wasMinimized) {
            await api.navigate(api.getCurrentRoot());
          }
        } else {
          // Item doesn't exist - add as new child and create window directly
          await api.addChild(childId);

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
            width: 500,
            height: 400,
            z: newZ - baseZ
          });

          // Find the container element in the DOM and append
          const containerEl = document.querySelector(`[data-container-id="${item.id}"]`);
          if (containerEl) {
            containerEl.appendChild(wrapper);
          }
        }
      }
    };

    // Render children using the helper
    for (const child of childrenToRender) {
      try {
        const wrapper = await createWindowForChild(child.id, child.view || {});
        container.appendChild(wrapper);
      } catch (error) {
        const childView = child.view || {};
        const x = childView.x || 0;
        const y = childView.y || 0;
        const width = childView.width || 500;
        const z = (childView.z || 0) + baseZ;
        const errorNode = api.createElement('div', {
          style: `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: ${width}px;
            padding: 15px;
            border: 1px solid #ffcccc;
            border-radius: 6px;
            background: #fff0f0;
            color: #cc0000;
            z-index: ${z};
          `
        }, [
          'Error rendering child: ' + child.id + ' - ' + error.message
        ]);
        container.appendChild(errorNode);
      }
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
          style: `
            position: absolute;
            bottom: 8px;
            left: ${8 + (index * 158)}px;
            width: 150px;
            height: 32px;
            background: #e5e5e5;
            border: 1px solid #ccc;
            border-radius: 4px;
            display: flex;
            align-items: center;
            padding: 0 8px;
            cursor: pointer;
            z-index: 9999;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          `,
          title: itemName,
          onclick: async () => {
            // Restore window and bring to front using normalized z-indices
            const freshItem = await api.get(item.id);
            const freshChildren = freshItem.children || [];

            // Get unpinned, non-minimized children sorted by z
            const unpinned = freshChildren
              .filter(c => !c.view?.pinned && !c.view?.minimized && c.id !== childId)
              .map(c => ({ id: c.id, z: c.view?.z || 0 }))
              .sort((a, b) => a.z - b.z);

            // Add restored window at the end (front)
            unpinned.push({ id: childId, z: unpinned.length });

            // Build map of new z-values
            const newZValues = new Map();
            unpinned.forEach((c, index) => {
              newZValues.set(c.id, index);
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
              children: updatedChildren,
              modified: Date.now()
            };

            await api.updateSilent(updated);
            await api.navigate(api.getCurrentRoot());
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
