// Rename renderer properties to view and add restorePreviousView functionality
// This script updates:
// 1. Viewport: rootRendererId → rootViewId, add previousRootViewId
// 2. Child specs: renderer → view, add previousView
// 3. API methods: setChildRenderer → setChildView, etc.
// 4. Adds restorePreviousView() API method
// 5. Updates generic_view Cancel button
//
// Run this in the Hobson REPL

(async function() {
  const IDS = api.IDS;

  console.log("Renaming renderer → view and adding restore functionality...\n");

  // =========================================================================
  // 1. Update kernel-viewport
  // =========================================================================

  console.log("1. Updating kernel-viewport...");

  const kernelViewport = await api.get(IDS.KERNEL_VIEWPORT);
  let viewportCode = kernelViewport.content.code;

  // Check if already updated
  if (viewportCode.includes('rootViewId')) {
    console.log("   Already updated - skipping");
  } else {
    // Rename rootRendererId to rootViewId
    viewportCode = viewportCode.replace(/rootRendererId/g, 'rootViewId');
    viewportCode = viewportCode.replace(/getRootRenderer/g, 'getRootView');
    viewportCode = viewportCode.replace(/setRootRenderer/g, 'setRootView');

    // Add previousRootViewId support
    // Find the constructor or initialization and add the property
    viewportCode = viewportCode.replace(
      /(this\.rootViewId = (?:null|data\.rootViewId[^;]*);)/,
      '$1\n    this.previousRootViewId = data.previousRootViewId || null;'
    );

    // Update persist/serialize to include previousRootViewId
    viewportCode = viewportCode.replace(
      /(rootViewId: this\.rootViewId)/,
      '$1,\n        previousRootViewId: this.previousRootViewId'
    );

    // Add setPreviousRootView method if setRootView exists
    if (viewportCode.includes('setRootView(')) {
      // Modify setRootView to store previous before setting new
      viewportCode = viewportCode.replace(
        /setRootView\(viewId\)\s*\{([^}]*)\}/,
        `setRootView(viewId, storePrevious = true) {
    if (storePrevious && this.rootViewId) {
      this.previousRootViewId = this.rootViewId;
    }
    this.rootViewId = viewId;
  }

  restorePreviousRootView() {
    if (this.previousRootViewId) {
      this.rootViewId = this.previousRootViewId;
      this.previousRootViewId = null;
      return true;
    }
    return false;
  }`
      );
    }

    kernelViewport.content.code = viewportCode;
    kernelViewport.modified = Date.now();
    await api.set(kernelViewport);
    console.log("   Updated kernel-viewport");
  }

  // =========================================================================
  // 2. Update kernel-rendering (API methods)
  // =========================================================================

  console.log("2. Updating kernel-rendering API...");

  const kernelRendering = await api.get(IDS.KERNEL_RENDERING_SYSTEM);
  let renderingCode = kernelRendering.content.code;

  // Check if already has setChildView
  if (renderingCode.includes('setChildView:')) {
    console.log("   Already has view methods - checking for restorePreviousView...");
  } else {
    // In createRendererAPI, rename setChildRenderer references
    renderingCode = renderingCode.replace(
      /setChildRenderer:/g,
      'setChildView:'
    );
    renderingCode = renderingCode.replace(
      /kernel\.setChildRenderer/g,
      'kernel.setChildView'
    );
  }

  // Add restorePreviousView to the API if not present
  if (!renderingCode.includes('restorePreviousView:')) {
    // Find a good insertion point in createRendererAPI - after setChildView or setChildRenderer
    const insertPattern = /(setChildView:[^}]+\},)/s;

    if (renderingCode.match(insertPattern)) {
      const restoreMethod = `$1

      // Restore previous view for an item
      restorePreviousView: async (itemId) => {
        // Check if this item is the root
        if (itemId === kernel.viewport.rootId) {
          if (kernel.viewport.restorePreviousRootView()) {
            await kernel.viewport.persist();
            await kernel.renderRoot(kernel.currentRoot);
            return true;
          }
          return false;
        }

        // Otherwise, find parent and restore from child spec
        const parent = await kernel.findParentOf(itemId);
        if (!parent) return false;

        const childIndex = parent.children.findIndex(c => c.id === itemId);
        if (childIndex < 0) return false;

        const childSpec = parent.children[childIndex];
        if (childSpec.previousView) {
          // Restore previous view
          const updatedChildren = [...parent.children];
          updatedChildren[childIndex] = {
            ...childSpec,
            view: childSpec.previousView,
            previousView: null
          };

          const updated = { ...parent, children: updatedChildren };
          await kernel.saveItem(updated);
          await kernel.renderRoot(kernel.currentRoot);
          return true;
        }
        return false;
      },`;

      renderingCode = renderingCode.replace(insertPattern, restoreMethod);
      console.log("   Added restorePreviousView to API");
    } else {
      console.warn("   Could not find insertion point for restorePreviousView");
    }
  }

  // Update viewport API references
  renderingCode = renderingCode.replace(/getRootRenderer:/g, 'getRootView:');
  renderingCode = renderingCode.replace(/setRootRenderer:/g, 'setRootView:');
  renderingCode = renderingCode.replace(/viewport\.getRootRenderer\(\)/g, 'viewport.getRootView()');
  renderingCode = renderingCode.replace(/viewport\.setRootRenderer\(/g, 'viewport.setRootView(');

  kernelRendering.content.code = renderingCode;
  kernelRendering.modified = Date.now();
  await api.set(kernelRendering);
  console.log("   Updated kernel-rendering");

  // =========================================================================
  // 3. Update kernel-core (setChildRenderer → setChildView, add method)
  // =========================================================================

  console.log("3. Updating kernel-core...");

  const kernelCore = await api.get(IDS.KERNEL_CORE);
  let coreCode = kernelCore.content.code;

  // Rename setChildRenderer to setChildView
  coreCode = coreCode.replace(/setChildRenderer/g, 'setChildView');

  // Update child spec property name from renderer to view
  // This is in the setChildView method
  coreCode = coreCode.replace(
    /renderer: rendererId/g,
    'view: viewId'
  );
  coreCode = coreCode.replace(
    /renderer: optionalRendererId/g,
    'view: optionalViewId'
  );

  // Update parameter names in setChildView
  coreCode = coreCode.replace(
    /setChildView\(parentId, childId, rendererId\)/g,
    'setChildView(parentId, childId, viewId)'
  );
  coreCode = coreCode.replace(
    /async setChildView\(childIdOrParentId, rendererIdOrChildId, optionalRendererId\)/g,
    'async setChildView(childIdOrParentId, viewIdOrChildId, optionalViewId)'
  );

  // Update the internal setChildView method to store previousView
  const setChildViewPattern = /(async setChildView\(parentId, childId, viewId\)\s*\{[\s\S]*?)(view: viewId)/;
  if (coreCode.match(setChildViewPattern)) {
    coreCode = coreCode.replace(
      setChildViewPattern,
      '$1previousView: updatedChildren[childIndex].view || null,\n        view: viewId'
    );
    console.log("   Added previousView storage to setChildView");
  }

  kernelCore.content.code = coreCode;
  kernelCore.modified = Date.now();
  await api.set(kernelCore);
  console.log("   Updated kernel-core");

  // =========================================================================
  // 4. Update generic_view Cancel button
  // =========================================================================

  console.log("4. Updating generic_view...");

  const genericView = await api.helpers.findByName('generic_view');
  if (genericView) {
    let gvCode = genericView.content.code;

    // Update Cancel button to use restorePreviousView
    if (gvCode.includes('api.navigate(item.id)')) {
      gvCode = gvCode.replace(
        /cancelBtn\.onclick = \(\) => \{[\s\S]*?api\.navigate\(item\.id\);[\s\S]*?\};/,
        `cancelBtn.onclick = async () => {
      // Try to restore previous view
      const restored = await api.restorePreviousView(item.id);
      if (!restored) {
        // No previous view, just re-render current root
        api.navigate(api.viewport.getRoot());
      }
    };`
      );

      genericView.content.code = gvCode;
      genericView.modified = Date.now();
      await api.set(genericView);
      console.log("   Updated generic_view Cancel button");
    } else if (gvCode.includes('restorePreviousView')) {
      console.log("   generic_view already uses restorePreviousView");
    } else {
      console.warn("   Could not find Cancel button pattern in generic_view");
    }
  } else {
    console.warn("   generic_view not found");
  }

  // =========================================================================
  // 5. Update viewport-renderer Display As menu
  // =========================================================================

  console.log("5. Updating viewport-renderer...");

  const viewportRenderer = await api.helpers.findByName('viewport-renderer');
  if (viewportRenderer) {
    let vrCode = viewportRenderer.content.code;

    // Update renderer references to view
    vrCode = vrCode.replace(/\.renderer(?=\s*[,\}\)])/g, '.view');
    vrCode = vrCode.replace(/setChildRenderer/g, 'setChildView');
    vrCode = vrCode.replace(/getRootRenderer/g, 'getRootView');
    vrCode = vrCode.replace(/setRootRenderer/g, 'setRootView');
    vrCode = vrCode.replace(/getRenderers/g, 'getViews');
    vrCode = vrCode.replace(/getDefaultRenderer/g, 'getDefaultView');
    vrCode = vrCode.replace(/findRenderer/g, 'findView');

    // Keep backward compat: also check for .renderer when reading
    // (in case old child specs haven't been migrated)

    viewportRenderer.content.code = vrCode;
    viewportRenderer.modified = Date.now();
    await api.set(viewportRenderer);
    console.log("   Updated viewport-renderer");
  } else {
    console.warn("   viewport-renderer not found");
  }

  // =========================================================================
  // 6. Migrate existing child specs from renderer to view
  // =========================================================================

  console.log("6. Migrating existing child specs...");

  const allItems = await api.getAll();
  let migratedCount = 0;

  for (const item of allItems) {
    if (!item.children || item.children.length === 0) continue;

    let needsUpdate = false;
    const updatedChildren = item.children.map(child => {
      if (child.renderer && !child.view) {
        needsUpdate = true;
        return {
          ...child,
          view: child.renderer,
          renderer: undefined // Remove old property
        };
      }
      return child;
    });

    if (needsUpdate) {
      // Clean up undefined properties
      const cleanedChildren = updatedChildren.map(c => {
        const cleaned = { ...c };
        delete cleaned.renderer;
        return cleaned;
      });

      item.children = cleanedChildren;
      await api.set(item);
      migratedCount++;
    }
  }

  console.log("   Migrated " + migratedCount + " items with child specs");

  // =========================================================================
  // Summary
  // =========================================================================

  console.log("\n" + "=".repeat(60));
  console.log("Rename and restore functionality complete!");
  console.log("=".repeat(60));
  console.log("\nChanges made:");
  console.log("  - Viewport: rootRendererId → rootViewId, added previousRootViewId");
  console.log("  - Child specs: renderer → view, added previousView support");
  console.log("  - API: setChildRenderer → setChildView, added restorePreviousView");
  console.log("  - generic_view: Cancel now calls restorePreviousView");
  console.log("  - Migrated " + migratedCount + " existing child specs");
  console.log("\nReload kernel to apply changes.");

  return { migratedCount };
})();
