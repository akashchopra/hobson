// Item: viewport-manager
// ID: f1111111-0002-0000-0000-000000000000
// Type: 66666666-0000-0000-0000-000000000000

// Viewport Manager Library
// Handles view preferences and persistence, replacing kernel viewport view management

const VIEWPORT_ID = "88888888-0000-0000-0000-000000000000";

let rootViewId = null;
let rootViewConfig = {};
let previousRootViewId = null;
let previousRootViewConfig = {};
let hasPreviousRootView = false;
let api = null;

// Called at boot
export async function onSystemBootComplete({ safeMode, rootId }, _api) {
  if (safeMode) return;

  api = _api;

  // Restore view preferences from viewport item
  try {
    const viewport = await api.get(VIEWPORT_ID);
    const child = viewport.children?.[0];
    if (child) {
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

  // Listen for root changes to persist and clear view prefs
  api.events.on(api.EVENT_IDS.VIEWPORT_ROOT_CHANGED, async ({ rootId, previous, initial, popstate }) => {
    // Don't persist on initial load or popstate (already persisted)
    if (initial || popstate) return;

    // Persist current state
    await persist(rootId);

    // Clear view prefs for new root (unless it's same root)
    if (previous !== rootId) {
      rootViewId = null;
      rootViewConfig = {};
      previousRootViewId = null;
      previousRootViewConfig = {};
      hasPreviousRootView = false;
    }
  });
}

// Persist viewport state
async function persist(rootId) {
  if (!api) return;

  try {
    const viewport = await api.get(VIEWPORT_ID);
    const childSpec = { id: rootId };

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

    viewport.children = rootId ? [childSpec] : [];
    viewport.modified = Date.now();
    await api.set(viewport);
  } catch (e) {
    console.warn('[viewport-manager] Failed to persist:', e);
  }
}

// Public API
export function getRootView() {
  return rootViewId;
}

export function setRootView(viewId, storePrevious = true) {
  if (storePrevious) {
    previousRootViewId = rootViewId;
    previousRootViewConfig = { ...rootViewConfig };
    hasPreviousRootView = true;
  }
  rootViewId = viewId;
}

export function getRootViewConfig() {
  if (!rootViewId && Object.keys(rootViewConfig).length === 0) {
    return null;
  }
  return {
    ...(rootViewId ? { type: rootViewId } : {}),
    ...rootViewConfig
  };
}

export function updateRootViewConfig(updates) {
  rootViewConfig = { ...rootViewConfig, ...updates };
}

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

export function hasPreviousView() {
  return hasPreviousRootView;
}

// Force persist (for manual save)
export async function forcePersist() {
  if (api) {
    const rootId = api.viewport.getRoot();
    await persist(rootId);
  }
}
