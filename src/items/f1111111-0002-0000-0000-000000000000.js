// Viewport Manager Library
// Stateless - reads from URL (root) and viewport item (view config)
// No module-level caching; sources of truth are URL + viewport item

const VIEWPORT_ID = "88888888-0000-0000-0000-000000000000";
const EVENT_IDS = {
  VIEWPORT_ROOT_CHANGED: "e0e00000-0003-0002-0000-000000000000",
  VIEWPORT_SELECTION_CHANGED: "e0e00000-0003-0001-0000-000000000000"
};

// Only state: whether we've registered the popstate handler
let popstateHandlerRegistered = false;

// Called at boot
export async function onKernelBootComplete({ safeMode }, _api) {
  if (safeMode) return;

  // Register popstate handler for browser back/forward
  if (!popstateHandlerRegistered) {
    window.addEventListener('popstate', handlePopstate);
    popstateHandlerRegistered = true;
  }

  // If URL has a root, ensure viewport item is in sync
  const urlRoot = getRoot();
  if (urlRoot) {
    const viewport = await window.kernel.storage.get(VIEWPORT_ID);
    const currentChild = viewport.attachments?.[0];

    // If URL root differs from viewport item, update viewport item
    // (URL is authoritative for root)
    if (currentChild?.id !== urlRoot) {
      await persistRootChange(urlRoot, currentChild?.id);
      await window.kernel.renderViewport();
    }
  }
}

// Handle browser back/forward
async function handlePopstate(e) {
  const urlRoot = getRoot();
  if (urlRoot) {
    // Get previous root from viewport item for event
    const viewport = await window.kernel.storage.get(VIEWPORT_ID);
    const previous = viewport.attachments?.[0]?.id;

    // Update viewport item (clear view override when navigating to different item)
    if (previous !== urlRoot) {
      await persistRootChange(urlRoot, previous);
    }

    // Emit event
    window.kernel.events.emit({
      type: EVENT_IDS.VIEWPORT_ROOT_CHANGED,
      content: {
        rootId: urlRoot,
        previous,
        initial: false,
        popstate: true
      }
    });

    await window.kernel.renderViewport();
  }
}

// Persist a root change to viewport item
// Clears view config when changing roots
async function persistRootChange(newRootId, previousRootId) {
  const viewport = await window.kernel.storage.get(VIEWPORT_ID);

  if (newRootId === previousRootId) {
    // Same root - preserve view config
    return;
  }

  // Different root - clear view config
  viewport.attachments = newRootId ? [{ id: newRootId }] : [];
  viewport.modified = Date.now();
  await window.kernel.saveItem(viewport);
}

// Get navigation params from URL
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    field: params.get('field'),
    line: params.get('line'),
    col: params.get('col')
  };
}

// ============================================================================
// Helper: read child spec from viewport item
// ============================================================================

async function getChildSpec() {
  try {
    const viewport = await window.kernel.storage.get(VIEWPORT_ID);
    return viewport.attachments?.[0] || null;
  } catch (e) {
    console.warn('[viewport-manager] Failed to read viewport item:', e);
    return null;
  }
}

async function updateChildSpec(updater) {
  try {
    const viewport = await window.kernel.storage.get(VIEWPORT_ID);
    const root = getRoot();
    if (!root) return;

    let childSpec = viewport.attachments?.[0];
    if (!childSpec || childSpec.id !== root) {
      // Child spec doesn't exist or is for different root
      childSpec = { id: root };
    }

    // Apply the update
    const updated = updater(childSpec);

    viewport.attachments = [updated];
    viewport.modified = Date.now();
    await window.kernel.saveItem(viewport);
  } catch (e) {
    console.warn('[viewport-manager] Failed to update viewport item:', e);
  }
}

// ============================================================================
// Public API
// ============================================================================

// Navigate to an item
export async function navigate(itemId, params = {}) {
  // Get previous root for event
  const viewport = await window.kernel.storage.get(VIEWPORT_ID);
  const previous = viewport.attachments?.[0]?.id;

  // Build new URL
  const url = new URL(window.location);
  url.searchParams.set('root', itemId);

  // Clear previous navigation params
  url.searchParams.delete('field');
  url.searchParams.delete('line');
  url.searchParams.delete('col');

  // Add optional navigation params
  if (params.field) url.searchParams.set('field', params.field);
  if (params.line) url.searchParams.set('line', params.line);
  if (params.col) url.searchParams.set('col', params.col);

  // Only push to history if URL is actually changing
  if (url.href !== window.location.href) {
    window.history.pushState({ itemId, ...params }, '', url);
  }

  // Persist to viewport item (clears view config if root changed)
  await persistRootChange(itemId, previous);

  // Emit viewport:root-changed event
  window.kernel.events.emit({
    type: EVENT_IDS.VIEWPORT_ROOT_CHANGED,
    content: {
      rootId: itemId,
      previous,
      initial: false,
      popstate: false
    }
  });

  // Trigger re-render
  await window.kernel.renderViewport();
}

// Get current root (sync - reads from URL)
export function getRoot() {
  const params = new URLSearchParams(window.location.search);
  return params.get('root');
}

// Get root view ID (async - reads from viewport item)
export async function getRootView() {
  const child = await getChildSpec();
  if (!child) return null;
  // Support view.type format and legacy flat format
  return child.view?.type || child.view || child.renderer || null;
}

// Set root view (async - writes to viewport item)
export async function setRootView(viewId, storePrevious = true) {
  await updateChildSpec(child => {
    const newChild = { ...child };

    if (storePrevious && child.view) {
      // Store current view as previous
      newChild.previousView = { ...child.view };
    }

    if (viewId) {
      newChild.view = { ...(child.view || {}), type: viewId };
    } else {
      delete newChild.view;
    }

    return newChild;
  });
}

// Get the full view config for root (async - reads from viewport item)
export async function getRootViewConfig() {
  const child = await getChildSpec();
  if (!child?.view) return null;

  if (typeof child.view === 'object') {
    return child.view;
  }

  // Legacy: view is just a string ID
  return { type: child.view };
}

// Update root view config (async - merges with existing config)
export async function updateRootViewConfig(updates) {
  await updateChildSpec(child => {
    const currentView = child.view || {};
    return {
      ...child,
      view: { ...currentView, ...updates }
    };
  });
}

// Restore previous root view (async)
export async function restorePreviousRootView() {
  const child = await getChildSpec();
  if (!child?.previousView) return false;

  await updateChildSpec(child => {
    const newChild = { ...child };
    newChild.view = { ...child.previousView };
    delete newChild.previousView;
    return newChild;
  });

  return true;
}

// Check if there's a previous view to restore (async)
export async function hasPreviousView() {
  const child = await getChildSpec();
  return !!child?.previousView;
}

// Force persist - no longer needed (writes happen immediately)
// Kept for API compatibility
export async function forcePersist() {
  // No-op: state is always persisted immediately now
}
