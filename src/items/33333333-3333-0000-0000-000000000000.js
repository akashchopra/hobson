// Item: kernel-viewport
// ID: 33333333-3333-0000-0000-000000000000
// Type: 33333333-0000-0000-0000-000000000000

// kernel-viewport module
export class Viewport {
  constructor(storage) {
    this.storage = storage;
    this.rootId = null;              // Currently viewed root item
    this.rootViewId = null;          // View override for root (the view type ID)
    this.rootViewConfig = {};        // Additional view config for root (bannerPosition, etc.)
    this.previousRootViewId = null;  // Previous view (for restore)
    this.previousRootViewConfig = {}; // Previous view config (for restore)
    this._hasPreviousRootView = false; // Flag to track if previous view is stored
    this.selectedItemId = null;      // Currently selected item (runtime only)
    this.selectedParentId = null;    // Visual parent of selected item (runtime only)

    this.VIEWPORT_ID = "88888888-0000-0000-0000-000000000000";
  }

  // Set the current root item (runtime only - call persist() to save)
  setRoot(itemId) {
    // Clear view config when changing roots (but rootViewConfig is cleared by caller)
    this.rootId = itemId;
    this.selectedItemId = null;
    this.selectedParentId = null;
  }

  // Get view override for current root (new name)
  getRootView() {
    return this.rootViewId;
  }

  // Set view override for current root (new name)
  setRootView(viewId, storePrevious = true) {
    if (storePrevious) {
      // Store previous view even if null (null means "use default")
      this.previousRootViewId = this.rootViewId;
      this.previousRootViewConfig = { ...this.rootViewConfig };
      this._hasPreviousRootView = true;
    }
    this.rootViewId = viewId;
  }

  // Get the full view config for root (type + additional config)
  getRootViewConfig() {
    if (!this.rootViewId && Object.keys(this.rootViewConfig).length === 0) {
      return null;
    }
    return {
      ...(this.rootViewId ? { type: this.rootViewId } : {}),
      ...this.rootViewConfig
    };
  }

  // Update root view config (merges with existing config)
  updateRootViewConfig(updates) {
    this.rootViewConfig = { ...this.rootViewConfig, ...updates };
  }

  // Restore previous root view
  restorePreviousRootView() {
    if (this._hasPreviousRootView) {
      this.rootViewId = this.previousRootViewId;
      this.rootViewConfig = { ...this.previousRootViewConfig };
      this.previousRootViewId = null;
      this.previousRootViewConfig = {};
      this._hasPreviousRootView = false;
      return true;
    }
    return false;
  }

  // Select an item (runtime state only, not persisted)
  select(itemId, parentId = null) {
    this.selectedItemId = itemId;
    this.selectedParentId = parentId;
  }

  // Clear selection
  clearSelection() {
    this.selectedItemId = null;
    this.selectedParentId = null;
  }

  // Get the visual parent of the selected item
  getSelectionParent() {
    return this.selectedParentId;
  }

  // Get currently selected item
  getSelection() {
    return this.selectedItemId;
  }

  // Persist current state to viewport item
  async persist() {
    const viewport = await this.storage.get(this.VIEWPORT_ID);
    const childSpec = { id: this.rootId };
    // Store full view config (type + additional properties like bannerPosition)
    const viewConfig = this.getRootViewConfig();
    if (viewConfig) {
      childSpec.view = viewConfig;
    }
    // Store previous view for restore functionality
    if (this._hasPreviousRootView) {
      const prevConfig = {
        ...(this.previousRootViewId ? { type: this.previousRootViewId } : {}),
        ...this.previousRootViewConfig
      };
      if (Object.keys(prevConfig).length > 0) {
        childSpec.previousView = prevConfig;
      }
    }
    viewport.children = this.rootId ? [childSpec] : [];
    viewport.modified = Date.now();
    await this.storage.set(viewport);
  }

  // Restore state from persisted viewport item
  async restore() {
    const viewport = await this.storage.get(this.VIEWPORT_ID);
    const child = viewport.children[0];
    if (child) {
      this.rootId = child.id;
      // Support new view.type format and old flat format for backward compat
      this.rootViewId = child.view?.type || child.view || child.renderer || null;
      // Extract additional view config (everything except type)
      if (child.view && typeof child.view === 'object') {
        const { type, ...config } = child.view;
        this.rootViewConfig = config;
      } else {
        this.rootViewConfig = {};
      }
      // Restore previous view state
      this.previousRootViewId = child.previousView?.type || child.previousView || null;
      if (child.previousView && typeof child.previousView === 'object') {
        const { type, ...prevConfig } = child.previousView;
        this.previousRootViewConfig = prevConfig;
      } else {
        this.previousRootViewConfig = {};
      }
      this._hasPreviousRootView = !!child.previousView;
    }
  }
}
