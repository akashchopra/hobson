// Complete fix for view/renderer naming mismatch
// This updates ALL kernel components to use consistent naming
// Run in REPL

(async function() {
  const IDS = api.IDS;

  console.log("=== COMPLETE VIEW/RENDERER FIX ===\n");

  // =========================================================================
  // 1. Fix kernel-viewport to support BOTH method names
  // =========================================================================

  console.log("1. Fixing kernel-viewport...");

  const kernelViewport = await api.get(IDS.KERNEL_VIEWPORT);

  // Replace with version that supports both old and new naming
  kernelViewport.content.code = `// kernel-viewport module
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

  // Get view override for current root (new name)
  getRootView() {
    return this.rootViewId;
  }

  // Set view override for current root (new name)
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

  // BACKWARD COMPAT: old method names
  getRootRenderer() {
    return this.getRootView();
  }

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
          // Also store as 'renderer' for backward compat with old code
          renderer: this.rootViewId,
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

  kernelViewport.modified = Date.now();
  await api.set(kernelViewport);
  console.log("   Done - now has both setRootView AND setRootRenderer");

  // =========================================================================
  // 2. Fix kernel-rendering API to have both method names
  // =========================================================================

  console.log("2. Fixing kernel-rendering API...");

  const kernelRendering = await api.get(IDS.KERNEL_RENDERING_SYSTEM);
  let code = kernelRendering.content.code;

  // Find and replace the viewport API section
  const viewportApiPattern = /viewport: \{[\s\S]*?\n      \}/;

  const newViewportApi = `viewport: {
        select: (itemId, parentId) => kernel.viewport.select(itemId, parentId),
        clearSelection: () => kernel.viewport.clearSelection(),
        getSelection: () => kernel.viewport.getSelection(),
        getSelectionParent: () => kernel.viewport.getSelectionParent(),
        getRoot: () => kernel.viewport.rootId,

        // New naming
        getRootView: () => kernel.viewport.getRootView(),
        setRootView: async (viewId) => {
          kernel.viewport.setRootView(viewId);
          await kernel.viewport.persist();
        },
        restorePreviousRootView: async () => {
          const restored = kernel.viewport.restorePreviousRootView();
          if (restored) {
            await kernel.viewport.persist();
          }
          return restored;
        },

        // Backward compat (old naming)
        getRootRenderer: () => kernel.viewport.getRootView(),
        setRootRenderer: async (rendererId) => {
          kernel.viewport.setRootView(rendererId);
          await kernel.viewport.persist();
        }
      }`;

  if (code.match(viewportApiPattern)) {
    code = code.replace(viewportApiPattern, newViewportApi);
    console.log("   Updated viewport API section");
  } else {
    console.error("   ERROR: Could not find viewport API pattern");
  }

  // Also add setChildView alias if not present
  if (!code.includes('setChildView:')) {
    const setChildRendererPattern = /(setChildRenderer: async \(childIdOrParentId, rendererIdOrChildId, optionalRendererId\) => \{[\s\S]*?\},)/;

    if (code.match(setChildRendererPattern)) {
      code = code.replace(setChildRendererPattern, `$1

      // Alias with new naming
      setChildView: async (childIdOrParentId, viewIdOrChildId, optionalViewId) => {
        if (optionalViewId !== undefined) {
          await kernel.setChildRenderer(childIdOrParentId, viewIdOrChildId, optionalViewId);
        } else {
          await kernel.setChildRenderer(containerItem.id, childIdOrParentId, viewIdOrChildId);
        }
      },`);
      console.log("   Added setChildView alias");
    }
  }

  kernelRendering.content.code = code;
  kernelRendering.modified = Date.now();
  await api.set(kernelRendering);
  console.log("   Done");

  // =========================================================================
  // 3. Verify current viewport item has correct structure
  // =========================================================================

  console.log("3. Checking viewport item...");
  const viewportItem = await api.get("88888888-0000-0000-0000-000000000000");
  console.log("   Current children: " + JSON.stringify(viewportItem.children));

  // =========================================================================
  // 4. Quick test
  // =========================================================================

  console.log("\n4. Testing (will be verified after reload)...");
  console.log("   Setting test view ID...");

  // We can't test the new code until reload, but we can verify persistence
  // by directly manipulating the viewport item
  const testViewId = "test-" + Date.now();
  if (viewportItem.children && viewportItem.children[0]) {
    viewportItem.children[0].view = testViewId;
    viewportItem.children[0].renderer = testViewId;
    viewportItem.modified = Date.now();
    await api.set(viewportItem);

    // Read back
    const check = await api.get("88888888-0000-0000-0000-000000000000");
    console.log("   After setting: " + JSON.stringify(check.children[0]));

    // Reset
    viewportItem.children[0].view = null;
    viewportItem.children[0].renderer = null;
    viewportItem.modified = Date.now();
    await api.set(viewportItem);
    console.log("   Reset to null");
  }

  // =========================================================================
  // Summary
  // =========================================================================

  console.log("\n" + "=".repeat(50));
  console.log("FIX COMPLETE");
  console.log("=".repeat(50));
  console.log("\nChanges made:");
  console.log("  1. kernel-viewport: has BOTH setRootView AND setRootRenderer");
  console.log("  2. kernel-rendering API: has BOTH naming conventions");
  console.log("  3. Viewport persistence: saves BOTH 'view' and 'renderer' properties");
  console.log("\nRELOAD THE KERNEL NOW (refresh page)");
  console.log("\nAfter reload, try Display As... on a note.");

  return "Done";
})();
