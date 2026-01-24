// Emergency fix for broken kernel-viewport
// Run this in SAFE MODE (?safe=1) REPL, or in browser console if kernel won't boot
//
// If running in browser console, use this wrapper:
// (async () => { ... paste the code inside ... })();

(async function() {
  // Open IndexedDB directly
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('hobson', 2);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // Get the viewport item
  const getItem = (id) => new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readonly');
    const request = tx.objectStore('items').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // Save an item
  const setItem = (item) => new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite');
    const request = tx.objectStore('items').put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  const VIEWPORT_ID = "33333333-3333-0000-0000-000000000000";

  console.log("Fixing kernel-viewport...");

  const viewport = await getItem(VIEWPORT_ID);

  // Restore correct code with view naming and previousView support
  viewport.content.code = `// kernel-viewport module
export class Viewport {
  constructor(storage) {
    this.storage = storage;
    this.rootId = null;              // Currently viewed root item
    this.rootViewId = null;          // View override for root
    this.previousRootViewId = null;  // Previous view (for restore)
    this.selectedItemId = null;      // Currently selected item (runtime only)
    this.selectedParentId = null;    // Visual parent of selected item (runtime only)

    this.VIEWPORT_ID = "88888888-0000-0000-0000-000000000000";
  }

  // Set the current root item (runtime only - call persist() to save)
  setRoot(itemId) {
    this.rootId = itemId;
    this.selectedItemId = null;
    this.selectedParentId = null;
  }

  // Get view override for current root
  getRootView() {
    return this.rootViewId;
  }

  // Set view override for current root (call persist() to save)
  setRootView(viewId, storePrevious = true) {
    if (storePrevious && this.rootViewId) {
      this.previousRootViewId = this.rootViewId;
    }
    this.rootViewId = viewId;
  }

  // Restore previous root view
  restorePreviousRootView() {
    if (this.previousRootViewId) {
      this.rootViewId = this.previousRootViewId;
      this.previousRootViewId = null;
      return true;
    }
    return false;
  }

  // Deprecated: use getRootView
  getRootRenderer() {
    return this.getRootView();
  }

  // Deprecated: use setRootView
  setRootRenderer(viewId) {
    this.setRootView(viewId);
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
    viewport.children = this.rootId
      ? [{
          id: this.rootId,
          view: this.rootViewId,
          previousView: this.previousRootViewId
        }]
      : [];
    viewport.modified = Date.now();
    await this.storage.set(viewport);
  }

  // Restore state from persisted viewport item
  async restore() {
    const viewport = await this.storage.get(this.VIEWPORT_ID);
    const child = viewport.children[0];
    if (child) {
      this.rootId = child.id;
      // Support both old 'renderer' and new 'view' property names
      this.rootViewId = child.view || child.renderer || null;
      this.previousRootViewId = child.previousView || null;
    }
  }
}
`;

  viewport.modified = Date.now();
  await setItem(viewport);

  console.log("kernel-viewport fixed!");
  console.log("Refresh the page (without ?safe=1) to boot normally.");

  db.close();
  return "Done";
})();
