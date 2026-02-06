// Item: window-menu-lib
// ID: f2bf33dc-3b41-4c9a-b0e5-62011eff239c
// Type: 66666666-0000-0000-0000-000000000000
//
// Window context menu dropdown for spatial-canvas-view.

function createMenuItem(api, menu, label, onClick) {
  const menuItemEl = api.createElement('div', {
    style: 'padding: 8px 12px; cursor: pointer;'
  }, [label]);
  menuItemEl.addEventListener('mouseenter', () => { menuItemEl.style.background = 'var(--color-bg-body)'; });
  menuItemEl.addEventListener('mouseleave', () => { menuItemEl.style.background = 'transparent'; });
  menuItemEl.addEventListener('click', (clickE) => {
    clickE.stopPropagation();
    menu.remove();
    onClick();
  });
  return menuItemEl;
}

function createSeparator(api) {
  return api.createElement('div', {
    style: 'height: 1px; background: var(--color-border-light); margin: 4px 0;'
  }, []);
}

// Show the window context menu
export function showWindowMenu(menuBtn, api, options) {
  const {
    isAnchored, isCornerAnchored, isEdgeAnchored,
    wrapper, effectiveView,
    onPin, onUnpin, onUndock, onDock
  } = options;

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

  // Pin option (only for floating windows)
  if (!isAnchored) {
    menu.appendChild(createMenuItem(api, menu, 'Pin', async () => {
      await onPin(wrapper);
    }));

    menu.appendChild(createSeparator(api));

    // Dock options
    const dockPositions = [
      { label: 'Dock Left', pos: 'left' },
      { label: 'Dock Right', pos: 'right' },
      { label: 'Dock Top', pos: 'top' },
      { label: 'Dock Bottom', pos: 'bottom' }
    ];

    for (const { label, pos } of dockPositions) {
      menu.appendChild(createMenuItem(api, menu, label, async () => {
        await onDock(pos, wrapper);
      }));
    }
  }

  // Unpin option (for corner-anchored windows)
  if (isCornerAnchored) {
    menu.appendChild(createMenuItem(api, menu, 'Unpin', async () => {
      await onUnpin(wrapper);
    }));
  }

  // Undock option (for edge-anchored windows)
  if (isEdgeAnchored) {
    menu.appendChild(createMenuItem(api, menu, 'Undock', async () => {
      await onUndock(wrapper);
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
}

// Helper: create a dropdown menu (reusable)
export function createDropdownMenu(anchorEl, items, api) {
  const rect = anchorEl.getBoundingClientRect();
  const menu = api.createElement('div', {
    class: 'window-menu',
    style: `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.bottom + 2}px;
      background: var(--color-bg-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-md);
      z-index: 100000;
      min-width: 120px;
      font-size: 13px;
    `
  }, []);

  for (const item of items) {
    if (item.separator) {
      menu.appendChild(createSeparator(api));
    } else {
      menu.appendChild(createMenuItem(api, menu, item.label, item.onClick));
    }
  }

  document.body.appendChild(menu);

  const closeMenu = () => {
    menu.remove();
    document.removeEventListener('mousedown', onMouseDown, true);
  };
  const onMouseDown = (evt) => {
    if (!menu.contains(evt.target) && evt.target !== anchorEl) closeMenu();
  };
  setTimeout(() => document.addEventListener('mousedown', onMouseDown, true), 0);

  return menu;
}

