// Phase 7: Update Kernel Core API with View Methods
// Run this in the Hobson REPL after Phase 6

(async function() {
  const IDS = api.IDS;

  console.log("Phase 7: Updating kernel-core REPL API with view methods...");

  const kernelCore = await api.get(IDS.KERNEL_CORE);
  let code = kernelCore.content.code;

  // Find the createREPLAPI method and add view methods
  // We'll add them after the renderer operations section

  const rendererOpsMarker = "// Renderer operations";
  const editorsMarker = "// Editors";

  if (!code.includes("// View operations (unified view system)")) {
    // Add view operations section after renderer operations
    const viewOpsCode = `
        // View operations (unified view system)
        findView: (typeId) => kernel.rendering.findView(typeId),
        getViews: (typeId) => kernel.rendering.getViews(typeId),
        getDefaultView: (typeId) => kernel.rendering.getDefaultView(typeId),
        renderView: async (itemId, viewId) => {
          const item = await kernel.storage.get(itemId);
          let viewResult;
          if (viewId) {
            const viewItem = await kernel.storage.get(viewId);
            // Determine if it's a view or view-spec
            const VIEW_TYPE = "aaaaaaaa-0000-0000-0000-000000000000";
            const VIEW_SPEC_TYPE = "bbbbbbbb-0000-0000-0000-000000000000";
            if (viewItem.type === VIEW_SPEC_TYPE) {
              viewResult = { kind: 'spec', item: viewItem };
            } else {
              viewResult = { kind: 'code', item: viewItem };
            }
          } else {
            viewResult = await kernel.rendering.findView(item.type);
          }
          if (!viewResult) {
            throw new Error('No view found for type: ' + item.type);
          }
          const api = kernel.rendering.createRendererAPI(item);
          return await kernel.rendering.renderView(item, viewResult, api);
        },

`;

    // Insert after renderer operations
    if (code.includes(editorsMarker)) {
      code = code.replace(
        editorsMarker,
        viewOpsCode + "        " + editorsMarker
      );
    } else {
      console.error("Could not find Editors marker in kernel-core");
    }
  } else {
    console.log("View operations already present, skipping.");
  }

  // Add deprecation warnings to renderer methods (as comments for now)
  // We'll keep the methods working but note they're deprecated

  if (!code.includes("// DEPRECATED: use findView")) {
    code = code.replace(
      "findRenderer: (typeId) => kernel.rendering.findRenderer(typeId),",
      "findRenderer: (typeId) => kernel.rendering.findRenderer(typeId), // DEPRECATED: use findView"
    );
    code = code.replace(
      "getRenderers: (typeId) => kernel.rendering.getRenderers(typeId),",
      "getRenderers: (typeId) => kernel.rendering.getRenderers(typeId), // DEPRECATED: use getViews"
    );
    code = code.replace(
      "getDefaultRenderer: (typeId) => kernel.rendering.getDefaultRenderer(typeId),",
      "getDefaultRenderer: (typeId) => kernel.rendering.getDefaultRenderer(typeId), // DEPRECATED: use getDefaultView"
    );
  }

  kernelCore.content.code = code;
  kernelCore.modified = Date.now();
  await api.set(kernelCore);

  console.log("\\nPhase 7 complete! Added to REPL API:");
  console.log("  - api.findView(typeId) - find view for a type");
  console.log("  - api.getViews(typeId) - get all views for a type");
  console.log("  - api.getDefaultView(typeId) - get default view for a type");
  console.log("  - api.renderView(itemId, viewId?) - render item with view system");
  console.log("\\nDeprecation notes added to:");
  console.log("  - api.findRenderer (use findView)");
  console.log("  - api.getRenderers (use getViews)");
  console.log("  - api.getDefaultRenderer (use getDefaultView)");
  console.log("\\nReload the kernel to apply changes.");

  return kernelCore;
})();
