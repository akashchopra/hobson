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
      // Remove all highlight classes
      document.querySelectorAll('.hobson-inspect-highlight').forEach(el => {
        el.classList.remove('hobson-inspect-highlight');
      });
    }
  }

  // Click handler when active — logs info to console for REPL use
  const clickHandler = async (e) => {
    if (!active) return;

    e.preventDefault();
    e.stopPropagation();

    const info = collectElementInfo(e.target);
    console.log('Element inspection:', info);
  };
  document.addEventListener('click', clickHandler, true);

  // Hover highlight when active
  const mouseoverHandler = (e) => {
    if (!active) return;
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
    _handlers: { clickHandler, mouseoverHandler, mouseoutHandler }
  };

  return inspectorState;
}

export function deactivate() {
  if (inspectorState) {
    // Remove all event listeners
    if (inspectorState._handlers) {
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

export function collectElementInfo(element) {
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
      if (el.dataset.sourceLine) entry.sourceLine = el.dataset.sourceLine;
      if (el.dataset.sourceLang) entry.sourceLang = el.dataset.sourceLang;
      if (el.dataset.sourceBinding) entry.sourceBinding = el.dataset.sourceBinding;
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

/**
 * Enter inspect mode, wait for one click, return collected info.
 * Resolves with element info on click, or null if cancelled (Escape).
 */
export function inspectOnce(api) {
  return new Promise((resolve) => {
    document.body.classList.add('hobson-inspect-mode');

    function cleanup() {
      document.removeEventListener('click', clickHandler, true);
      document.removeEventListener('mouseover', mouseoverHandler, true);
      document.removeEventListener('mouseout', mouseoutHandler, true);
      document.removeEventListener('keydown', escHandler);
      document.body.classList.remove('hobson-inspect-mode');
      document.querySelectorAll('.hobson-inspect-highlight').forEach(el => {
        el.classList.remove('hobson-inspect-highlight');
      });
    }

    const mouseoverHandler = (e) => {
      e.target.classList.add('hobson-inspect-highlight');
    };
    const mouseoutHandler = (e) => {
      e.target.classList.remove('hobson-inspect-highlight');
    };
    const clickHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
      resolve(collectElementInfo(e.target));
    };
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    };

    document.addEventListener('click', clickHandler, true);
    document.addEventListener('mouseover', mouseoverHandler, true);
    document.addEventListener('mouseout', mouseoutHandler, true);
    document.addEventListener('keydown', escHandler);
  });
}

/**
 * Resolve an inspector link target and navigate to it.
 * Opens as sibling on spatial canvas if available.
 */
export async function resolveAndNavigate(api, { id, name, line, lang, binding }) {
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
      return;
    }
  }

  if (!targetId) return;

  // Build navigation params for scroll-to-line or scroll-to-symbol support
  const field = lang === 'hob' ? 'hob' : 'code';
  let navigateTo = null;
  if (binding && lang === 'hob') {
    // Hob: navigate to symbol (binding name) in structural editor
    navigateTo = { field, symbol: binding };
  } else if (line) {
    navigateTo = { field, lines: line };
  }

  // Open as sibling on spatial canvas if possible
  const currentRoot = api.viewport.getRoot();
  if (currentRoot && currentRoot !== targetId) {
    try {
      const rootItem = await api.get(currentRoot);
      const existingChild = rootItem.attachments?.find(c => c.id === targetId);

      if (existingChild) {
        const updatedChildren = rootItem.attachments.map(c => {
          if (c.id === targetId) {
            return { ...c, view: { ...(c.view || {}), navigateTo, minimized: false } };
          }
          return c;
        });
        await api.set({ ...rootItem, attachments: updatedChildren, modified: Date.now() });
      } else {
        const newChild = { id: targetId, view: { navigateTo } };
        await api.set({
          ...rootItem,
          attachments: [...(rootItem.attachments || []), newChild],
          modified: Date.now()
        });
      }
      await api.navigate(currentRoot);
    } catch (err) {
      console.error('Error opening as sibling:', err);
      await api.navigate(targetId, navigateTo);
    }
  } else {
    await api.navigate(targetId, navigateTo);
  }
}

// Export for manual activation via REPL
export function inspect(element, api) {
  const info = collectElementInfo(element);
  console.log('Element inspection:', info);
  return info;
}
