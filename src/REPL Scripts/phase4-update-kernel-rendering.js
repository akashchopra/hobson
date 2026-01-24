// Phase 4: Update Kernel Rendering System
// Run this in the Hobson REPL after Phase 3

(async function() {
  const IDS = api.IDS;

  console.log("Phase 4: Updating kernel-rendering module with view support...");

  const kernelRendering = await api.get(IDS.KERNEL_RENDERING_SYSTEM);

  // New code with view support
  const newCode = `// kernel-rendering module
export class RenderingSystem {
  constructor(kernel) {
    this.kernel = kernel;
  }

  // -------------------------------------------------------------------------
  // View System (new unified approach)
  // -------------------------------------------------------------------------

  // Find a view for the given type, walking up the type chain
  async findView(typeId) {
    const IDS = this.kernel.IDS;
    let currentType = typeId;
    const visited = new Set();

    while (currentType && !visited.has(currentType)) {
      visited.add(currentType);

      // Look for view code first (imperative)
      if (IDS.VIEW) {
        const views = await this.kernel.storage.query({ type: IDS.VIEW });
        const view = views.find(v => v.content?.for_type === currentType);
        if (view) {
          return { kind: 'code', item: view };
        }
      }

      // Look for view spec (declarative)
      if (IDS.VIEW_SPEC) {
        const specs = await this.kernel.storage.query({ type: IDS.VIEW_SPEC });
        const spec = specs.find(s => s.content?.for_type === currentType);
        if (spec) {
          return { kind: 'spec', item: spec };
        }
      }

      // Move up the type chain
      if (currentType === IDS.ATOM) {
        break;
      }

      try {
        const typeItem = await this.kernel.storage.get(currentType);
        currentType = typeItem.type;
      } catch {
        break;
      }
    }

    // Fall back to default view
    if (IDS.DEFAULT_VIEW) {
      try {
        const defaultView = await this.kernel.storage.get(IDS.DEFAULT_VIEW);
        return { kind: 'code', item: defaultView };
      } catch {
        // Default view doesn't exist yet
      }
    }

    return null;
  }

  // Render an item using the view system
  async renderView(item, viewResult, api) {
    if (viewResult.kind === 'code') {
      // Execute view code directly
      const viewCode = await this.kernel.moduleSystem.require(viewResult.item.id);
      return await viewCode.render(item, api);
    } else if (viewResult.kind === 'spec') {
      // Use generic view to interpret spec
      const genericView = await this.kernel.moduleSystem.require('generic_view');
      return await genericView.render(item, viewResult.item, api);
    }
    throw new Error('Unknown view kind: ' + viewResult.kind);
  }

  // Get all views for a type (including inherited from type chain)
  async getViews(typeId) {
    const IDS = this.kernel.IDS;
    const result = [];
    const seenIds = new Set();

    // Collect all views and view-specs
    let allViews = [];
    let allSpecs = [];

    if (IDS.VIEW) {
      allViews = await this.kernel.storage.query({ type: IDS.VIEW });
    }
    if (IDS.VIEW_SPEC) {
      allSpecs = await this.kernel.storage.query({ type: IDS.VIEW_SPEC });
    }

    let currentType = typeId;
    const visited = new Set();

    while (currentType && !visited.has(currentType)) {
      visited.add(currentType);

      // Find all views for this type
      const viewsForType = allViews.filter(v => v.content?.for_type === currentType);
      for (const view of viewsForType) {
        if (!seenIds.has(view.id)) {
          seenIds.add(view.id);
          result.push({
            view,
            kind: 'code',
            forType: currentType,
            inherited: currentType !== typeId
          });
        }
      }

      // Find all view-specs for this type
      const specsForType = allSpecs.filter(s => s.content?.for_type === currentType);
      for (const spec of specsForType) {
        if (!seenIds.has(spec.id)) {
          seenIds.add(spec.id);
          result.push({
            view: spec,
            kind: 'spec',
            forType: currentType,
            inherited: currentType !== typeId
          });
        }
      }

      // Move up the type chain
      if (currentType === IDS.ATOM) {
        break;
      }

      try {
        const typeItem = await this.kernel.storage.get(currentType);
        currentType = typeItem.type;
      } catch {
        break;
      }
    }

    // Always include default view as fallback option
    if (IDS.DEFAULT_VIEW) {
      try {
        const defaultView = await this.kernel.storage.get(IDS.DEFAULT_VIEW);
        if (!seenIds.has(defaultView.id)) {
          result.push({
            view: defaultView,
            kind: 'code',
            forType: IDS.ATOM,
            inherited: true,
            isDefault: true
          });
        }
      } catch {
        // Default view doesn't exist yet
      }
    }

    return result;
  }

  // Get the default view for a type
  async getDefaultView(typeId) {
    const viewResult = await this.findView(typeId);
    return viewResult ? viewResult.item : null;
  }

  // -------------------------------------------------------------------------
  // Renderer System (legacy, now also checks views as fallback)
  // -------------------------------------------------------------------------

  async renderItem(itemId, rendererId = null) {
    const IDS = this.kernel.IDS;
    const item = await this.kernel.storage.get(itemId);

    // Use specified renderer or find default for item's type
    let renderer;
    if (rendererId) {
      renderer = await this.kernel.storage.get(rendererId);
    } else {
      renderer = await this.findRenderer(item.type);
    }

    // Load and execute renderer
    try {
      const rendererModule = await this.kernel.moduleSystem.require(renderer.id);
      const api = this.createRendererAPI(item);
      const domNode = await rendererModule.render(item, api);
      return domNode;
    } catch (error) {
      return this.createErrorView(error, itemId);
    }
  }

  async findRenderer(typeId) {
    const IDS = this.kernel.IDS;
    let currentType = typeId;
    const visited = new Set();

    while (currentType && !visited.has(currentType)) {
      visited.add(currentType);

      // Look for a renderer for this type
      const renderers = await this.kernel.storage.query({ type: IDS.RENDERER });
      const renderer = renderers.find(r => r.content?.for_type === currentType);

      if (renderer) {
        return renderer;
      }

      // Also check for views as fallback (unified view system)
      if (IDS.VIEW) {
        const views = await this.kernel.storage.query({ type: IDS.VIEW });
        const view = views.find(v => v.content?.for_type === currentType);
        if (view) {
          return view;
        }
      }

      // Move up the type chain
      if (currentType === IDS.ATOM) {
        break;
      }

      try {
        const typeItem = await this.kernel.storage.get(currentType);
        currentType = typeItem.type;
      } catch {
        break;
      }
    }

    // Fall back to default renderer, or default view if available
    try {
      return await this.kernel.storage.get(IDS.DEFAULT_RENDERER);
    } catch {
      // Try default view as ultimate fallback
      if (IDS.DEFAULT_VIEW) {
        try {
          return await this.kernel.storage.get(IDS.DEFAULT_VIEW);
        } catch {
          throw new Error('No default renderer or view found');
        }
      }
      throw new Error('No default renderer found');
    }
  }

  // Get all renderers for a type (including inherited from type chain)
  async getRenderers(typeId) {
    const IDS = this.kernel.IDS;
    const allRenderers = await this.kernel.storage.query({ type: IDS.RENDERER });
    const result = [];
    const seenTypes = new Set();

    let currentType = typeId;
    const visited = new Set();

    while (currentType && !visited.has(currentType)) {
      visited.add(currentType);

      // Find all renderers for this type
      const renderersForType = allRenderers.filter(r => r.content?.for_type === currentType);
      for (const renderer of renderersForType) {
        if (!seenTypes.has(renderer.id)) {
          seenTypes.add(renderer.id);
          result.push({
            renderer,
            forType: currentType,
            inherited: currentType !== typeId
          });
        }
      }

      // Also include views as renderers (unified view system)
      if (IDS.VIEW) {
        const views = await this.kernel.storage.query({ type: IDS.VIEW });
        const viewsForType = views.filter(v => v.content?.for_type === currentType);
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

      // Move up the type chain
      if (currentType === IDS.ATOM) {
        break;
      }

      try {
        const typeItem = await this.kernel.storage.get(currentType);
        currentType = typeItem.type;
      } catch {
        break;
      }
    }

    // Always include default renderer as fallback option
    const defaultRenderer = await this.kernel.storage.get(IDS.DEFAULT_RENDERER);
    if (!seenTypes.has(defaultRenderer.id)) {
      result.push({
        renderer: defaultRenderer,
        forType: IDS.ATOM,
        inherited: true,
        isDefault: true
      });
    }

    return result;
  }

  // Get the default renderer for a type
  async getDefaultRenderer(typeId) {
    const renderers = await this.getRenderers(typeId);
    return renderers.length > 0 ? renderers[0].renderer : null;
  }

  createRendererAPI(containerItem) {
    const kernel = this.kernel;
    const IDS = kernel.IDS;

    const api = {
      // Create DOM elements
      createElement(tag, props = {}, children = []) {
        const element = document.createElement(tag);

        for (const [key, value] of Object.entries(props)) {
          if (key.startsWith("on") && typeof value === "function") {
            const eventName = key.substring(2).toLowerCase();
            element.addEventListener(eventName, value);
          } else if (key === "class") {
            element.className = value;
          } else if (key === "style" && typeof value === "string") {
            element.style.cssText = value;
          } else {
            element.setAttribute(key, value);
          }
        }

        for (const child of children) {
          if (typeof child === "string") {
            element.appendChild(document.createTextNode(child));
          } else if (child instanceof Node) {
            element.appendChild(child);
          } else if (Array.isArray(child)) {
            // Handle array shorthand: [tag, props, children]
            const [childTag, childProps = {}, childChildren = []] = child;
            const childElement = api.createElement(childTag, childProps, childChildren);
            element.appendChild(childElement);
          }
        }

        return element;
      },

      // Query items (read-only)
      query: (filter) => kernel.storage.query(filter),

      // Get single item (read-only)
      get: (itemId) => kernel.storage.get(itemId),

      // Get all items
      getAll: () => kernel.storage.getAll(),

      // Get all items including nested instance items
      getAllRaw: () => kernel.storage.getAllRaw(),

      // Load code module
      require: (nameOrId) => kernel.moduleSystem.require(nameOrId),

      // Render another item (for containers)
      renderItem: (itemId, rendererId) => kernel.rendering.renderItem(itemId, rendererId),

      // Renderer discovery
      getRenderers: (typeId) => kernel.rendering.getRenderers(typeId),
      getDefaultRenderer: (typeId) => kernel.rendering.getDefaultRenderer(typeId),
      findRenderer: (typeId) => kernel.rendering.findRenderer(typeId),

      // View discovery (new unified view system)
      findView: (typeId) => kernel.rendering.findView(typeId),
      getViews: (typeId) => kernel.rendering.getViews(typeId),
      getDefaultView: (typeId) => kernel.rendering.getDefaultView(typeId),

      // Editors
      getEditors: (typeId) => kernel.getEditors(typeId),
      getDefaultEditor: (typeId) => kernel.getDefaultEditor(typeId),
      editItem: (itemId, editorId) => kernel.editItem(itemId, editorId),
      getEditingContext: () => kernel._editingContext,

      // Navigation
      navigate: (itemId) => kernel.navigateToItem(itemId),
      getCurrentRoot: () => kernel.currentRoot,

      // Open item as sibling window in current container
      openSibling: async (itemId) => {
        const currentRoot = kernel.currentRoot;
        if (!currentRoot) {
          throw new Error('No current root container');
        }
        await kernel.addChild(currentRoot, itemId);
        // Trigger re-render to show the new child
        await kernel.renderRoot(currentRoot);
      },

      // Create new item
      create: async (item, addAsChild = false) => {
        const newItem = {
          ...item,
          id: item.id || crypto.randomUUID(),
          children: item.children || []
        };

        await kernel.saveItem(newItem);

        if (addAsChild) {
          await kernel.addChild(containerItem.id, newItem.id);
        }

        return newItem.id;
      },

      // Simplified child creation
      createChild: async (type, content = {}) => {
        const newItem = {
          type,
          content,
          children: []
        };
        const id = await api.create(newItem, true);
        // Trigger re-render to show the new child (re-render the root, not necessarily this container)
        await kernel.renderRoot(kernel.currentRoot);
        return id;
      },

      // Save without triggering re-render
      set: async (item) => {
        await kernel.saveItem(item);
        return item.id;
      },

      // Save and trigger re-render
      update: async (item) => {
        await kernel.saveItem(item);
        await kernel.renderRoot(kernel.currentRoot);
        return item.id;
      },

      // Deprecated: use set() instead
      updateSilent: async (item) => {
        await kernel.saveItem(item);
        return item.id;
      },

      // Add child to current container
      addChild: async (childId) => {
        await kernel.addChild(containerItem.id, childId);
      },

      // Remove child from current container
      removeChild: async (childId) => {
        await kernel.removeChild(containerItem.id, childId);
      },

      // Set renderer for a child in current container (2 params)
      // or in any container (3 params: parentId, childId, rendererId)
      setChildRenderer: async (childIdOrParentId, rendererIdOrChildId, optionalRendererId) => {
        if (optionalRendererId !== undefined) {
          // 3-parameter version: setChildRenderer(parentId, childId, rendererId)
          await kernel.setChildRenderer(childIdOrParentId, rendererIdOrChildId, optionalRendererId);
        } else {
          // 2-parameter version: setChildRenderer(childId, rendererId)
          await kernel.setChildRenderer(containerItem.id, childIdOrParentId, rendererIdOrChildId);
        }
      },

      // Find parent of an item
      findParentOf: (itemId) => kernel.findParentOf(itemId),

      // Delete item entirely
      delete: async (itemId) => {
        await kernel.deleteItem(itemId);
      },

      // Get the current container item
      getCurrentItem: () => containerItem,

      // Type chain utilities
      typeChainIncludes: (typeId, targetId) => kernel.moduleSystem.typeChainIncludes(typeId, targetId),

      // UI operations
      editRaw: (itemId) => kernel.editItemRaw(itemId),
      showItemList: () => kernel.showItemList(),

      // For script execution - returns REPL API for code evaluation
      createREPLContext: () => kernel.createREPLAPI(),

      // Well-known IDs
      IDS,

      // Instance ID (for nested Hobson instances)
      getInstanceId: () => kernel.storage.instanceId,

      // Helper functions (same as REPL API)
      helpers: {
        findByName: async (name) => {
          const items = await kernel.storage.query({ name });
          return items.length > 0 ? items[0] : null;
        },
        listByType: async (typeId) => {
          return await kernel.storage.query({ type: typeId });
        },
        createType: async (name, description) => {
          const IDS = kernel.IDS;
          const id = crypto.randomUUID();
          await kernel.saveItem({
            id,
            name,
            type: IDS.TYPE_DEFINITION,
            children: [],
            content: { description }
          });
          return id;
        }
      },

      // Viewport API for view state management
      viewport: {
        select: (itemId, parentId) => kernel.viewport.select(itemId, parentId),
        clearSelection: () => kernel.viewport.clearSelection(),
        getSelection: () => kernel.viewport.getSelection(),
        getSelectionParent: () => kernel.viewport.getSelectionParent(),
        getRoot: () => kernel.viewport.rootId,
        getRootRenderer: () => kernel.viewport.getRootRenderer(),
        setRootRenderer: async (rendererId) => {
          kernel.viewport.setRootRenderer(rendererId);
          await kernel.viewport.persist();
        }
      },

      // Events API (read-only for renderers - can subscribe but not emit)
      events: {
        on: (event, handler) => kernel.events.on(event, handler),
        off: (event, handler) => kernel.events.off(event, handler)
      }
    };

    return api;
  }

  createErrorView(error, itemId) {
    const container = document.createElement("div");
    container.className = "render-error";

    const heading = document.createElement("h3");
    heading.textContent = \`Error rendering: \${itemId}\`;
    container.appendChild(heading);

    const message = document.createElement("pre");
    message.textContent = error.message;
    container.appendChild(message);

    const stack = document.createElement("pre");
    stack.textContent = error.stack || "(no stack trace)";
    container.appendChild(stack);

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit Item";
    editBtn.onclick = () => this.kernel.editItemRaw(itemId);
    container.appendChild(editBtn);

    return container;
  }
}
`;

  kernelRendering.content.code = newCode;
  kernelRendering.modified = Date.now();
  await api.set(kernelRendering);

  console.log("\\nPhase 4 complete! Updated kernel-rendering module with:");
  console.log("  - findView(typeId) - returns { kind: 'code'|'spec', item }");
  console.log("  - renderView(item, viewResult, api) - renders using view system");
  console.log("  - getViews(typeId) - returns all views for a type");
  console.log("  - getDefaultView(typeId) - returns default view for a type");
  console.log("  - Updated findRenderer() to also check for views as fallback");
  console.log("  - Added view methods to renderer API");
  console.log("\\nReload the kernel to apply changes.");

  return kernelRendering;
})();
