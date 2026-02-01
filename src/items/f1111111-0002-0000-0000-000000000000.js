// Viewport Manager Library
// Owns all viewport state: root, view preferences, URL sync, navigation

const VIEWPORT_ID = "88888888-0000-0000-0000-000000000000";
const EVENT_IDS = {
  VIEWPORT_ROOT_CHANGED: "e0e00000-0003-0002-0000-000000000000",
  VIEWPORT_SELECTION_CHANGED: "e0e00000-0003-0001-0000-000000000000"
};

// State
let currentRoot = null;
let rootViewId = null;
let rootViewConfig = {};
let previousRootViewId = null;
let previousRootViewConfig = {};
let hasPreviousRootView = false;
let api = null;
let popstateHandlerRegistered = false;

// Called at boot
export async function onSystemBootComplete({ safeMode, rootId }, _api) {
  if (safeMode) return;

  api = _api;

  // Restore state from viewport item
  await restoreState();

  // Sync with URL if present (URL takes precedence)
  const urlRoot = getUrlRoot();
  if (urlRoot && urlRoot !== currentRoot) {
    // URL has different root - navigate to it (silently, no pushState)
    await navigateInternal(urlRoot, {}, { pushState: false, initial: true });
  }

  // Register popstate handler for browser back/forward
  if (!popstateHandlerRegistered) {
    window.addEventListener('popstate', handlePopstate);
    popstateHandlerRegistered = true;
  }
}

// Restore state from viewport item
async function restoreState() {
  try {
    const viewport = await api.get(VIEWPORT_ID);
    const child = viewport.children?.[0];
    if (child) {
      currentRoot = child.id;
      // Support new view.type format and old flat format
      rootViewId = child.view?.type || child.view || child.renderer || null;

      // Extract additional view config (everything except type)
      if (child.view && typeof child.view === 'object') {
        const { type, ...config } = child.view;
        rootViewConfig = config;
      } else {
        rootViewConfig = {};
      }

      // Restore previous view state
      previousRootViewId = child.previousView?.type || child.previousView || null;
      if (child.previousView && typeof child.previousView === 'object') {
        const { type, ...prevConfig } = child.previousView;
        previousRootViewConfig = prevConfig;
      } else {
        previousRootViewConfig = {};
      }
      hasPreviousRootView = !!child.previousView;
    }
  } catch (e) {
    console.warn('[viewport-manager] Failed to restore state:', e);
  }
}

// Get root from URL
function getUrlRoot() {
  const params = new URLSearchParams(window.location.search);
  return params.get('root');
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

// Handle browser back/forward
async function handlePopstate(e) {
  const urlRoot = getUrlRoot();
  if (urlRoot && api) {
    await navigateInternal(urlRoot, getUrlParams(), { pushState: false, popstate: true });
  }
}

// Internal navigation (used by navigate and popstate)
async function navigateInternal(itemId, params = {}, options = {}) {
  const { pushState: doPushState = true, initial = false, popstate = false } = options;
  const previous = currentRoot;

  // Clear view override when navigating to different item
  if (currentRoot && currentRoot !== itemId) {
    rootViewId = null;
    rootViewConfig = {};
    previousRootViewId = null;
    previousRootViewConfig = {};
    hasPreviousRootView = false;
  }

  currentRoot = itemId;

  // Update URL
  if (doPushState) {
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

    window.history.pushState({ itemId, ...params }, '', url);
  }

  // Emit viewport:root-changed event
  api.events.emit({
    type: EVENT_IDS.VIEWPORT_ROOT_CHANGED,
    content: {
      rootId: itemId,
      previous,
      initial,
      popstate
    }
  });

  // Persist to viewport item
  await persist();

  // Trigger re-render
  await api.renderViewport();
}

// Persist viewport state to viewport item
async function persist() {
  if (!api) return;

  try {
    const viewport = await api.get(VIEWPORT_ID);
    const childSpec = { id: currentRoot };

    // Store full view config (type + additional properties)
    const viewConfig = getRootViewConfig();
    if (viewConfig) {
      childSpec.view = viewConfig;
    }

    // Store previous view for restore functionality
    if (hasPreviousRootView) {
      const prevConfig = {
        ...(previousRootViewId ? { type: previousRootViewId } : {}),
        ...previousRootViewConfig
      };
      if (Object.keys(prevConfig).length > 0) {
        childSpec.previousView = prevConfig;
      }
    }

    viewport.children = currentRoot ? [childSpec] : [];
    viewport.modified = Date.now();
    await api.set(viewport);
  } catch (e) {
    console.warn('[viewport-manager] Failed to persist:', e);
  }
}

// ============================================================================
// Public API
// ============================================================================

// Navigate to an item
export async function navigate(itemId, params = {}) {
  if (!api) {
    console.warn('[viewport-manager] Not initialized, cannot navigate');
    return;
  }
  await navigateInternal(itemId, params);
}

// Get current root
export function getRoot() {
  return currentRoot;
}

// Get root view ID
export function getRootView() {
  return rootViewId;
}

// Set root view
export function setRootView(viewId, storePrevious = true) {
  if (storePrevious) {
    previousRootViewId = rootViewId;
    previousRootViewConfig = { ...rootViewConfig };
    hasPreviousRootView = true;
  }
  rootViewId = viewId;
}

// Get the full view config for root (type + additional config)
export function getRootViewConfig() {
  if (!rootViewId && Object.keys(rootViewConfig).length === 0) {
    return null;
  }
  return {
    ...(rootViewId ? { type: rootViewId } : {}),
    ...rootViewConfig
  };
}

// Update root view config (merges with existing config)
export function updateRootViewConfig(updates) {
  rootViewConfig = { ...rootViewConfig, ...updates };
}

// Restore previous root view
export function restorePreviousRootView() {
  if (hasPreviousRootView) {
    rootViewId = previousRootViewId;
    rootViewConfig = { ...previousRootViewConfig };
    previousRootViewId = null;
    previousRootViewConfig = {};
    hasPreviousRootView = false;
    return true;
  }
  return false;
}

// Check if there's a previous view to restore
export function hasPreviousView() {
  return hasPreviousRootView;
}

// Force persist (for manual save)
export async function forcePersist() {
  await persist();
}
