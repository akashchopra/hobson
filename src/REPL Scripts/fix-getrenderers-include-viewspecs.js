// Fix: Include VIEW_SPEC items in getRenderers() and handle them in renderItem()
// This allows view-specs to appear in the "Display As..." menu and render correctly
// Run this in the Hobson REPL

(async function() {
  const IDS = api.IDS;

  console.log("Updating kernel-rendering for full view-spec support...\n");

  // Check if VIEW_SPEC IDS exists
  if (!IDS.VIEW_SPEC) {
    console.error("ERROR: VIEW_SPEC not found in IDS. Run phase1-add-view-types.js first and reload kernel.");
    return;
  }

  const kernelRendering = await api.get(IDS.KERNEL_RENDERING_SYSTEM);
  let code = kernelRendering.content.code;

  let changes = [];

  // =========================================================================
  // Part 1: Update getRenderers() to include VIEW and VIEW_SPEC items
  // =========================================================================

  if (!code.includes('IDS.VIEW_SPEC')) {
    console.log("1. Adding VIEW_SPEC support to getRenderers()...");

    // Find the spot in getRenderers where we loop through types
    // We need to add VIEW and VIEW_SPEC queries inside the while loop

    const renderersForTypePattern = /(\/\/ Find all renderers for this type\s*\n\s*const renderersForType = allRenderers\.filter.*?\n\s*for \(const renderer of renderersForType\) \{[\s\S]*?\n\s*\}\s*\})/;

    if (code.match(renderersForTypePattern)) {
      const viewSupportBlock = `$1

      // Also include views (unified view system)
      if (IDS.VIEW) {
        const allViews = await this.kernel.storage.query({ type: IDS.VIEW });
        const viewsForType = allViews.filter(v => v.content?.for_type === currentType);
        for (const view of viewsForType) {
          if (!seenTypes.has(view.id)) {
            seenTypes.add(view.id);
            result.push({
              renderer: view,
              forType: currentType,
              inherited: currentType !== typeId,
              isView: true
            });
          }
        }
      }

      // Also include view-specs (declarative views)
      if (IDS.VIEW_SPEC) {
        const allViewSpecs = await this.kernel.storage.query({ type: IDS.VIEW_SPEC });
        const viewSpecsForType = allViewSpecs.filter(v => v.content?.for_type === currentType);
        for (const viewSpec of viewSpecsForType) {
          if (!seenTypes.has(viewSpec.id)) {
            seenTypes.add(viewSpec.id);
            result.push({
              renderer: viewSpec,
              forType: currentType,
              inherited: currentType !== typeId,
              isViewSpec: true
            });
          }
        }
      }`;

      code = code.replace(renderersForTypePattern, viewSupportBlock);
      changes.push("Added VIEW and VIEW_SPEC to getRenderers()");
    } else {
      console.warn("  Could not find insertion point for getRenderers(). Trying alternative...");

      // Try alternative: look for the "Move up the type chain" comment
      const altPattern = /(\n\s*)(\/\/ Move up the type chain\s*\n\s*if \(currentType === IDS\.ATOM\))/;

      if (code.match(altPattern)) {
        const altBlock = `$1// Also include views (unified view system)
      if (IDS.VIEW) {
        const allViews = await this.kernel.storage.query({ type: IDS.VIEW });
        const viewsForType = allViews.filter(v => v.content?.for_type === currentType);
        for (const view of viewsForType) {
          if (!seenTypes.has(view.id)) {
            seenTypes.add(view.id);
            result.push({
              renderer: view,
              forType: currentType,
              inherited: currentType !== typeId,
              isView: true
            });
          }
        }
      }

      // Also include view-specs (declarative views)
      if (IDS.VIEW_SPEC) {
        const allViewSpecs = await this.kernel.storage.query({ type: IDS.VIEW_SPEC });
        const viewSpecsForType = allViewSpecs.filter(v => v.content?.for_type === currentType);
        for (const viewSpec of viewSpecsForType) {
          if (!seenTypes.has(viewSpec.id)) {
            seenTypes.add(viewSpec.id);
            result.push({
              renderer: viewSpec,
              forType: currentType,
              inherited: currentType !== typeId,
              isViewSpec: true
            });
          }
        }
      }

      $2`;

        code = code.replace(altPattern, altBlock);
        changes.push("Added VIEW and VIEW_SPEC to getRenderers() (alt method)");
      } else {
        console.error("  ERROR: Could not patch getRenderers()");
      }
    }
  } else {
    console.log("1. VIEW_SPEC already in getRenderers() - skipping");
  }

  // =========================================================================
  // Part 2: Update renderItem() to handle VIEW_SPEC by using generic_view
  // =========================================================================

  if (!code.includes('generic_view')) {
    console.log("2. Adding VIEW_SPEC handling to renderItem()...");

    // Find the renderItem method and add handling for view-specs
    // Current code does: const rendererModule = await this.kernel.moduleSystem.require(renderer.id);
    // We need to check if the renderer is a VIEW_SPEC and use generic_view instead

    const requireRendererPattern = /(async renderItem\(itemId, rendererId = null\) \{[\s\S]*?)(const rendererModule = await this\.kernel\.moduleSystem\.require\(renderer\.id\);)/;

    if (code.match(requireRendererPattern)) {
      const viewSpecHandling = `$1// Check if renderer is actually a view-spec (needs generic_view to interpret)
      const isViewSpec = IDS.VIEW_SPEC && renderer.type === IDS.VIEW_SPEC;

      let rendererModule;
      let viewSpecItem = null;
      if (isViewSpec) {
        // Load generic_view to interpret the view-spec
        rendererModule = await this.kernel.moduleSystem.require('generic_view');
        viewSpecItem = renderer;
      } else {
        rendererModule = await this.kernel.moduleSystem.require(renderer.id);
      }`;

      code = code.replace(requireRendererPattern, viewSpecHandling);

      // Now update the render call to pass viewSpec if needed
      const renderCallPattern = /(const domNode = await rendererModule\.render\()item, api\)/;

      if (code.match(renderCallPattern)) {
        code = code.replace(renderCallPattern, '$1item, isViewSpec ? viewSpecItem : api, isViewSpec ? api : undefined)');
        changes.push("Added VIEW_SPEC handling to renderItem()");
      } else {
        // Try alternative pattern
        const altRenderPattern = /const domNode = await rendererModule\.render\(item, api\);/;
        if (code.match(altRenderPattern)) {
          code = code.replace(altRenderPattern,
            'const domNode = isViewSpec ? await rendererModule.render(item, viewSpecItem, api) : await rendererModule.render(item, api);');
          changes.push("Added VIEW_SPEC handling to renderItem() (alt)");
        } else {
          console.error("  ERROR: Could not patch renderItem() render call");
        }
      }
    } else {
      console.error("  ERROR: Could not find renderItem() pattern");
    }
  } else {
    console.log("2. generic_view handling already present - skipping");
  }

  // =========================================================================
  // Save changes
  // =========================================================================

  if (changes.length > 0) {
    kernelRendering.content.code = code;
    kernelRendering.modified = Date.now();
    await api.set(kernelRendering);

    console.log("\n" + "=".repeat(50));
    console.log("Changes applied:");
    changes.forEach(c => console.log("  - " + c));
    console.log("=".repeat(50));
    console.log("\nReload the kernel to apply changes.");
    console.log("After reload, view-specs should appear in 'Display As...' menu and render correctly.");
  } else {
    console.log("\nNo changes needed - kernel-rendering already has full view-spec support.");
  }

  return kernelRendering;
})();
