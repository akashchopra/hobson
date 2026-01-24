// Fix the API mismatch between viewport (uses view naming) and kernel-rendering (uses renderer naming)
// This updates kernel-rendering to support both naming conventions
// Run in REPL

(async function() {
  const IDS = api.IDS;

  console.log("Fixing view/renderer API mismatch...\n");

  // =========================================================================
  // 1. First, check current state of viewport
  // =========================================================================

  console.log("1. Checking viewport state...");
  const kernelViewport = await api.get(IDS.KERNEL_VIEWPORT);
  const viewportCode = kernelViewport.content.code;

  const hasRootViewId = viewportCode.includes('rootViewId');
  const hasRootRendererId = viewportCode.includes('rootRendererId');
  const hasSetRootView = viewportCode.includes('setRootView');
  const hasSetRootRenderer = viewportCode.includes('setRootRenderer');

  console.log("   Viewport uses rootViewId: " + hasRootViewId);
  console.log("   Viewport uses rootRendererId: " + hasRootRendererId);
  console.log("   Viewport has setRootView: " + hasSetRootView);
  console.log("   Viewport has setRootRenderer: " + hasSetRootRenderer);

  // =========================================================================
  // 2. Update kernel-rendering API to support both naming conventions
  // =========================================================================

  console.log("\n2. Updating kernel-rendering API...");

  const kernelRendering = await api.get(IDS.KERNEL_RENDERING_SYSTEM);
  let code = kernelRendering.content.code;

  // Find the viewport API section and replace it with one that supports both
  const viewportApiPattern = /viewport: \{[\s\S]*?\n      \}/;

  const newViewportApi = `viewport: {
        select: (itemId, parentId) => kernel.viewport.select(itemId, parentId),
        clearSelection: () => kernel.viewport.clearSelection(),
        getSelection: () => kernel.viewport.getSelection(),
        getSelectionParent: () => kernel.viewport.getSelectionParent(),
        getRoot: () => kernel.viewport.rootId,

        // Support both old (renderer) and new (view) naming
        getRootView: () => {
          if (kernel.viewport.getRootView) return kernel.viewport.getRootView();
          if (kernel.viewport.getRootRenderer) return kernel.viewport.getRootRenderer();
          return kernel.viewport.rootViewId || kernel.viewport.rootRendererId || null;
        },
        getRootRenderer: () => {
          if (kernel.viewport.getRootView) return kernel.viewport.getRootView();
          if (kernel.viewport.getRootRenderer) return kernel.viewport.getRootRenderer();
          return kernel.viewport.rootViewId || kernel.viewport.rootRendererId || null;
        },
        setRootView: async (viewId) => {
          if (kernel.viewport.setRootView) {
            kernel.viewport.setRootView(viewId);
          } else if (kernel.viewport.setRootRenderer) {
            kernel.viewport.setRootRenderer(viewId);
          } else {
            // Direct fallback
            kernel.viewport.rootViewId = viewId;
            kernel.viewport.rootRendererId = viewId;
          }
          await kernel.viewport.persist();
        },
        setRootRenderer: async (rendererId) => {
          if (kernel.viewport.setRootView) {
            kernel.viewport.setRootView(rendererId);
          } else if (kernel.viewport.setRootRenderer) {
            kernel.viewport.setRootRenderer(rendererId);
          } else {
            // Direct fallback
            kernel.viewport.rootViewId = rendererId;
            kernel.viewport.rootRendererId = rendererId;
          }
          await kernel.viewport.persist();
        }
      }`;

  if (code.match(viewportApiPattern)) {
    code = code.replace(viewportApiPattern, newViewportApi);
    console.log("   Updated viewport API section");
  } else {
    console.error("   ERROR: Could not find viewport API pattern");
    return;
  }

  // =========================================================================
  // 3. Also add setChildView as alias for setChildRenderer
  // =========================================================================

  if (!code.includes('setChildView:')) {
    console.log("\n3. Adding setChildView alias...");

    const setChildRendererPattern = /(setChildRenderer: async \(childIdOrParentId, rendererIdOrChildId, optionalRendererId\) => \{[\s\S]*?\},)/;

    if (code.match(setChildRendererPattern)) {
      const setChildViewAlias = `$1

      // Alias for setChildRenderer (new naming)
      setChildView: async (childIdOrParentId, viewIdOrChildId, optionalViewId) => {
        if (optionalViewId !== undefined) {
          await kernel.setChildRenderer(childIdOrParentId, viewIdOrChildId, optionalViewId);
        } else {
          await kernel.setChildRenderer(containerItem.id, childIdOrParentId, viewIdOrChildId);
        }
      },`;

      code = code.replace(setChildRendererPattern, setChildViewAlias);
      console.log("   Added setChildView alias");
    }
  } else {
    console.log("\n3. setChildView already exists - skipping");
  }

  // =========================================================================
  // 4. Save kernel-rendering
  // =========================================================================

  kernelRendering.content.code = code;
  kernelRendering.modified = Date.now();
  await api.set(kernelRendering);

  console.log("\n4. Saved kernel-rendering");

  // =========================================================================
  // 5. Check the actual viewport item to see what's stored
  // =========================================================================

  console.log("\n5. Checking viewport item (88888888-...)...");
  const viewportItem = await api.get("88888888-0000-0000-0000-000000000000");
  console.log("   children[0]: " + JSON.stringify(viewportItem.children?.[0]));

  // =========================================================================
  // Summary
  // =========================================================================

  console.log("\n" + "=".repeat(50));
  console.log("Fix applied!");
  console.log("=".repeat(50));
  console.log("\nThe API now supports both 'view' and 'renderer' naming.");
  console.log("Reload the kernel to apply changes.");
  console.log("\nAfter reload, try Display As... again.");

  return { viewportItem };
})();
