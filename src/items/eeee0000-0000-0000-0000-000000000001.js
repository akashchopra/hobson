// Element Inspector Library
// Provides tools to inspect which view/item rendered any UI element

let inspectorState = null;

export function activate(api) {
  if (inspectorState) {
    console.warn('Element inspector already active');
    return inspectorState;
  }

  let active = false;

  function toggleInspectMode() {
    active = !active;
    document.body.classList.toggle('hobson-inspect-mode', active);
    if (!active) {
      // Remove overlay if present
      const overlay = document.getElementById('hobson-inspector-overlay');
      if (overlay) overlay.remove();
      // Remove all highlight classes
      document.querySelectorAll('.hobson-inspect-highlight').forEach(el => {
        el.classList.remove('hobson-inspect-highlight');
      });
    }
  }

  // Keyboard shortcut: Ctrl+Shift+. (key is '>' when shift is held)
  const keyHandler = (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === '>' || e.key === '.')) {
      e.preventDefault();
      toggleInspectMode();
    }
  };
  document.addEventListener('keydown', keyHandler);

  // Click handler when active
  const clickHandler = async (e) => {
    if (!active) return;

    // Don't intercept clicks on the inspector overlay itself
    const overlay = document.getElementById('hobson-inspector-overlay');
    if (overlay && overlay.contains(e.target)) {
      return;  // Let the overlay handle its own clicks
    }

    e.preventDefault();
    e.stopPropagation();

    const info = collectElementInfo(e.target);
    showInspectorOverlay(info, e.clientX, e.clientY, api);
  };
  document.addEventListener('click', clickHandler, true);

  // Hover highlight when active
  const mouseoverHandler = (e) => {
    if (!active) return;
    // Don't highlight the inspector overlay
    const overlay = document.getElementById('hobson-inspector-overlay');
    if (overlay && overlay.contains(e.target)) return;
    e.target.classList.add('hobson-inspect-highlight');
  };
  document.addEventListener('mouseover', mouseoverHandler, true);

  const mouseoutHandler = (e) => {
    if (!active) return;
    e.target.classList.remove('hobson-inspect-highlight');
  };
  document.addEventListener('mouseout', mouseoutHandler, true);

  inspectorState = {
    toggle: toggleInspectMode,
    isActive: () => active,
    // Store handlers for proper cleanup
    _handlers: { keyHandler, clickHandler, mouseoverHandler, mouseoutHandler }
  };

  return inspectorState;
}

export function deactivate() {
  if (inspectorState) {
    // Remove all event listeners
    if (inspectorState._handlers) {
      document.removeEventListener('keydown', inspectorState._handlers.keyHandler);
      document.removeEventListener('click', inspectorState._handlers.clickHandler, true);
      document.removeEventListener('mouseover', inspectorState._handlers.mouseoverHandler, true);
      document.removeEventListener('mouseout', inspectorState._handlers.mouseoutHandler, true);
    }
    
    // Exit inspect mode if active
    if (inspectorState.isActive()) {
      inspectorState.toggle();
    }
    
    // Remove any lingering highlights
    document.querySelectorAll('.hobson-inspect-highlight').forEach(el => {
      el.classList.remove('hobson-inspect-highlight');
    });
    document.body.classList.remove('hobson-inspect-mode');
    
    inspectorState = null;
  }
}

function collectElementInfo(element) {
  const info = {
    element,
    chain: []
  };

  let el = element;
  while (el && el !== document.body) {
    const entry = {};

    // Collect any attribution present
    if (el.dataset.source) {
      entry.source = el.dataset.source;
      entry.sourceLine = el.dataset.sourceLine;
    }
    if (el.dataset.viewId) {
      entry.viewId = el.dataset.viewId;
    }
    if (el.dataset.forItem) {
      entry.forItem = el.dataset.forItem;
    }
    if (el.dataset.itemId) {
      entry.itemId = el.dataset.itemId;
    }
    if (el.dataset.renderInstance) {
      entry.renderInstance = el.dataset.renderInstance;
    }

    if (Object.keys(entry).length > 0) {
      entry.tagName = el.tagName.toLowerCase();
      // Filter out inspector's own classes from display
      entry.className = el.className
        .split(' ')
        .filter(c => c && c !== 'hobson-inspect-highlight' && c !== 'hobson-inspect-mode')
        .join(' ');
      info.chain.push(entry);
    }

    el = el.parentElement;
  }

  return info;
}

async function showInspectorOverlay(info, x, y, api) {
  // Remove existing overlay
  const existing = document.getElementById('hobson-inspector-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'hobson-inspector-overlay';
  overlay.style.cssText = `
    position: fixed;
    left: ${x + 10}px;
    top: ${y + 10}px;
    max-width: 400px;
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 12px;
    z-index: 100000;
    font-size: 13px;
    font-family: system-ui, sans-serif;
  `;

  // Build content
  let html = '<div style="font-weight: 600; margin-bottom: 8px;">Element Inspector</div>';

  if (info.chain.length === 0) {
    html += '<div style="color: var(--color-text-secondary);">No attribution found. Try reloading with ?debug=1</div>';
  } else {
    // Look up item names for better display
    const nameCache = {};
    const getName = async (id) => {
      if (!id) return null;
      if (nameCache[id]) return nameCache[id];
      try {
        const item = await api.get(id);
        nameCache[id] = item.name || id.slice(0, 8) + '...';
      } catch (e) {
        nameCache[id] = id.slice(0, 8) + '...';
      }
      return nameCache[id];
    };

    // Fetch all names first
    for (const entry of info.chain) {
      if (entry.viewId) await getName(entry.viewId);
      if (entry.forItem) await getName(entry.forItem);
      if (entry.itemId) await getName(entry.itemId);
    }

    for (const entry of info.chain) {
      html += '<div style="margin-bottom: 8px; padding: 8px; background: var(--color-bg-body); border-radius: var(--border-radius);">';

      // Element tag at top - this is what we're inspecting
      html += `<div style="font-family: monospace; color: var(--color-text-secondary); margin-bottom: 4px;">&lt;${entry.tagName}&gt;${entry.className ? '.' + entry.className.split(' ')[0] : ''}</div>`;

      if (entry.forItem) {
        html += `<div><strong>Item:</strong> <a href="#" class="inspector-link" data-id="${entry.forItem}">${nameCache[entry.forItem]}</a></div>`;
      }

      if (entry.source) {
        html += `<div><strong>Source:</strong> <a href="#" class="inspector-link" data-name="${entry.source}" data-line="${entry.sourceLine || ''}">${entry.source}${entry.sourceLine ? ':' + entry.sourceLine : ''}</a></div>`;
      }

      if (entry.viewId && nameCache[entry.viewId] !== entry.source) {
        html += `<div><strong>View:</strong> <a href="#" class="inspector-link" data-id="${entry.viewId}">${nameCache[entry.viewId]}</a></div>`;
      }

      if (entry.itemId && entry.itemId !== entry.forItem) {
        html += `<div style="color: var(--color-text-tertiary); font-size: 12px;">via <a href="#" class="inspector-link" data-id="${entry.itemId}">${nameCache[entry.itemId]}</a></div>`;
      }

      html += '</div>';
    }
  }

  html += '<div style="margin-top: 8px; font-size: 11px; color: var(--color-border-dark);">Click to navigate (with line) | Ctrl+Shift+. to exit</div>';

  overlay.innerHTML = html;

  // Add click handlers for links
  overlay.querySelectorAll('.inspector-link').forEach(link => {
    link.style.cssText = 'color: var(--color-primary); cursor: pointer; text-decoration: none;';
    link.onclick = async (e) => {
      e.preventDefault();

      const id = link.dataset.id;
      const name = link.dataset.name;
      const line = link.dataset.line;

      // Resolve target item ID
      let targetId = id;
      if (!targetId && name) {
        // Look up by name, stripping .js suffix if present
        const baseName = name.replace(/\.js$/, '');
        let items = await api.query({ name: baseName });
        // Fallback: try with original name if no match
        if (items.length === 0 && baseName !== name) {
          items = await api.query({ name });
        }
        if (items.length > 0) {
          targetId = items[0].id;
        } else {
          console.warn('Element inspector: could not find item with name:', name);
          overlay.remove();
          return;
        }
      }

      if (!targetId) {
        overlay.remove();
        return;
      }

      // Build navigation params for scroll-to-line support
      // Inspector links point to code, so field is 'code'
      const navigateTo = line ? { field: 'code', lines: line } : null;

      // Follow same pattern as hobson-markdown: sibling if in container, else root
      if (api.siblingContainer) {
        api.siblingContainer.addSibling(targetId, navigateTo);
      } else {
        // Check if we're viewing a container - if so, add as sibling with navigateTo in view config
        const currentRoot = api.viewport.getRoot();
        if (currentRoot && currentRoot !== targetId) {
          try {
            const rootItem = await api.get(currentRoot);
            // Check if target is already a child
            const existingChild = rootItem.attachments?.find(c => c.id === targetId);

            if (existingChild) {
              // Already a child - update its view.navigateTo and re-render
              const updatedChildren = rootItem.attachments.map(c => {
                if (c.id === targetId) {
                  return { ...c, view: { ...(c.view || {}), navigateTo, minimized: false } };
                }
                return c;
              });
              await api.set({ ...rootItem, attachments: updatedChildren, modified: Date.now() });
            } else {
              // Add as new child with navigateTo in view config
              const newChild = { id: targetId, view: { navigateTo } };
              await api.set({
                ...rootItem,
                attachments: [...(rootItem.attachments || []), newChild],
                modified: Date.now()
              });
            }
            // Re-render to show the sibling with scroll
            await api.navigate(currentRoot);
          } catch (err) {
            console.error('Error opening as sibling:', err);
            await api.navigate(targetId, navigateTo);
          }
        } else {
          await api.navigate(targetId, navigateTo);
        }
      }

      overlay.remove();
    };
  });

  // Close on click outside
  const closeHandler = (e) => {
    if (!overlay.contains(e.target)) {
      overlay.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);

  // Close on Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(overlay);
}

// Export for manual activation via REPL
export function inspect(element, api) {
  const info = collectElementInfo(element);
  console.log('Element inspection:', info);
  return info;
}
