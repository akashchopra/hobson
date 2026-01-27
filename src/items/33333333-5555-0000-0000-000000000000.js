// Item: kernel-rendering
// ID: 33333333-5555-0000-0000-000000000000
// Type: 33333333-0000-0000-0000-000000000000

// Render Instance Registry - tracks what's currently rendered
class RenderInstanceRegistry {
  constructor() {
    this.instances = new Map();      // instanceId -> InstanceInfo
    this.byItemId = new Map();       // itemId -> Set<instanceId>
    this.byViewId = new Map();       // viewId -> Set<instanceId>
    this.byParentId = new Map();     // parentId -> Set<instanceId>
    this.nextId = 1;
  }

  register(domNode, itemId, viewId, parentId) {
    const instanceId = this.nextId++;

    const info = {
      instanceId,
      domNode,
      itemId,
      viewId,
      parentId,
      timestamp: Date.now()
    };

    this.instances.set(instanceId, info);

    // Index by itemId
    if (!this.byItemId.has(itemId)) {
      this.byItemId.set(itemId, new Set());
    }
    this.byItemId.get(itemId).add(instanceId);

    // Index by viewId
    if (!this.byViewId.has(viewId)) {
      this.byViewId.set(viewId, new Set());
    }
    this.byViewId.get(viewId).add(instanceId);

    // Index by parentId
    const parentKey = parentId || '__root__';
    if (!this.byParentId.has(parentKey)) {
      this.byParentId.set(parentKey, new Set());
    }
    this.byParentId.get(parentKey).add(instanceId);

    // Add data attribute to DOM for debugging and Phase 3 lookup
    if (domNode && domNode.setAttribute) {
      domNode.setAttribute('data-render-instance', instanceId);
    }

    return instanceId;
  }

  unregister(instanceId) {
    const info = this.instances.get(instanceId);
    if (!info) return false;

    // Remove from all indexes
    this.instances.delete(instanceId);

    const itemSet = this.byItemId.get(info.itemId);
    if (itemSet) {
      itemSet.delete(instanceId);
      if (itemSet.size === 0) this.byItemId.delete(info.itemId);
    }

    const viewSet = this.byViewId.get(info.viewId);
    if (viewSet) {
      viewSet.delete(instanceId);
      if (viewSet.size === 0) this.byViewId.delete(info.viewId);
    }

    const parentKey = info.parentId || '__root__';
    const parentSet = this.byParentId.get(parentKey);
    if (parentSet) {
      parentSet.delete(instanceId);
      if (parentSet.size === 0) this.byParentId.delete(parentKey);
    }

    return true;
  }

  unregisterByParent(parentId) {
    const parentKey = parentId || '__root__';
    const instanceIds = this.byParentId.get(parentKey);
    if (!instanceIds) return 0;

    let count = 0;
    for (const instanceId of [...instanceIds]) {
      if (this.unregister(instanceId)) count++;
    }
    return count;
  }

  clear() {
    const count = this.instances.size;
    this.instances.clear();
    this.byItemId.clear();
    this.byViewId.clear();
    this.byParentId.clear();
    return count;
  }

  get(instanceId) {
    return this.instances.get(instanceId) || null;
  }

  getByItemId(itemId) {
    const instanceIds = this.byItemId.get(itemId);
    if (!instanceIds) return [];
    return [...instanceIds].map(id => this.instances.get(id)).filter(Boolean);
  }

  getByViewId(viewId) {
    const instanceIds = this.byViewId.get(viewId);
    if (!instanceIds) return [];
    return [...instanceIds].map(id => this.instances.get(id)).filter(Boolean);
  }

  getByParentId(parentId) {
    const parentKey = parentId || '__root__';
    const instanceIds = this.byParentId.get(parentKey);
    if (!instanceIds) return [];
    return [...instanceIds].map(id => this.instances.get(id)).filter(Boolean);
  }

  getAll() {
    return [...this.instances.values()];
  }

  // For debugging: summary of current state
  getSummary() {
    return {
      totalInstances: this.instances.size,
      uniqueItems: this.byItemId.size,
      uniqueViews: this.byViewId.size,
      uniqueParents: this.byParentId.size
    };
  }
}

// kernel-rendering module
export class RenderingSystem {
  constructor(kernel) {
    this.kernel = kernel;
    this.registry = new RenderInstanceRegistry();
  }

  // Clear all render instances (called before full re-render)
  clearInstances() {
    return this.registry.clear();
  }

  async renderItem(itemId, viewId = null, options = {}, context = {}) {
    const IDS = this.kernel.IDS;
    const renderPath = context.renderPath || [];

    // Cycle detection
    if (renderPath.includes(itemId)) {
      if (options.onCycle) {
        const item = await this.kernel.storage.get(itemId);
        return options.onCycle(item);
      } else {
        throw new Error(
          `Cycle detected rendering item ${itemId}. ` +
          `Render path: ${renderPath.join(' → ')} → ${itemId}. ` +
          `Provide onCycle callback to handle cycles.`
        );
      }
    }

    const item = await this.kernel.storage.get(itemId);

    // Use specified view or find default for item's type
    let view;
    if (viewId) {
      view = await this.kernel.storage.get(viewId);
    } else {
      view = await this.findView(item.type);
    }

    // Build new context with updated render path
    const newContext = {
      ...context,
      renderPath: [...renderPath, itemId]
    };

    // Load and execute view
    try {
      // Check if view is actually a view-spec (needs generic_view to interpret)
      const isViewSpec = IDS.VIEW_SPEC && view.type === IDS.VIEW_SPEC;

      let viewModule;
      let viewSpecItem = null;
      if (isViewSpec) {
        // Load generic_view to interpret the view-spec
        viewModule = await this.kernel.moduleSystem.require('generic_view');
        viewSpecItem = view;
      } else {
        viewModule = await this.kernel.moduleSystem.require(view.id);
      }
      const api = this.createRendererAPI(item, newContext);
      const domNode = await viewModule.render(item, isViewSpec ? viewSpecItem : api, isViewSpec ? api : undefined);

      // Register render instance (Phase 2)
      if (domNode) {
        const parentId = context.parentId || null;
        this.registry.register(domNode, itemId, view.id, parentId);
      }

      return domNode;
    } catch (error) {
      // Log to console for full async stack trace (dev tools show more than error.stack)
      console.error('[Render Error]', error);

      // Capture error for logging/notification
      await this.kernel.captureError(error, {
        operation: 'render',
        itemId,
        itemName: item?.name,
        viewId: view?.id,
        viewName: view?.name
      });
      return this.createErrorView(error, itemId);
    }
  }

  // Find view for a type (walks up type chain)
  async findView(typeId) {
    const IDS = this.kernel.IDS;
    let currentType = typeId;
    const visited = new Set();

    while (currentType && !visited.has(currentType)) {
      visited.add(currentType);

      // Look for VIEW items
      const views = await this.kernel.storage.query({ type: IDS.VIEW });
      const view = views.find(v => v.content?.for_type === currentType);
      if (view) {
        return view;
      }

      // Look for VIEW_SPEC items (declarative views)
      const viewSpecs = await this.kernel.storage.query({ type: IDS.VIEW_SPEC });
      const viewSpec = viewSpecs.find(v => v.content?.for_type === currentType);
      if (viewSpec) {
        return viewSpec;
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
    return await this.kernel.storage.get(IDS.DEFAULT_VIEW);
  }

  // Get all views for a type (including inherited from type chain)
  async getViews(typeId) {
    const IDS = this.kernel.IDS;
    const result = [];
    const seenIds = new Set();

    let currentType = typeId;
    const visited = new Set();

    while (currentType && !visited.has(currentType)) {
      visited.add(currentType);

      // Include views
      const allViews = await this.kernel.storage.query({ type: IDS.VIEW });
      const viewsForType = allViews.filter(v => v.content?.for_type === currentType);
      for (const view of viewsForType) {
        if (!seenIds.has(view.id)) {
          seenIds.add(view.id);
          result.push({
            view,
            forType: currentType,
            inherited: currentType !== typeId
          });
        }
      }

      // Include view-specs (declarative views)
      const allViewSpecs = await this.kernel.storage.query({ type: IDS.VIEW_SPEC });
      const viewSpecsForType = allViewSpecs.filter(v => v.content?.for_type === currentType);
      for (const viewSpec of viewSpecsForType) {
        if (!seenIds.has(viewSpec.id)) {
          seenIds.add(viewSpec.id);
          result.push({
            view: viewSpec,
            forType: currentType,
            inherited: currentType !== typeId,
            isViewSpec: true
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
    const defaultView = await this.kernel.storage.get(IDS.DEFAULT_VIEW);
    if (defaultView && !seenIds.has(defaultView.id)) {
      result.push({
        view: defaultView,
        forType: IDS.ATOM,
        inherited: true,
        isDefault: true
      });
    }

    return result;
  }

  // Get the default view for a type
  async getDefaultView(typeId) {
    const views = await this.getViews(typeId);
    return views.length > 0 ? views[0].view : null;
  }

  createRendererAPI(containerItem, context = {}) {
    const kernel = this.kernel;
    const IDS = kernel.IDS;
    const rendering = this;

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

      // Render another item (for containers) - passes context for cycle detection
      // Supports optional decorator for viewport-specific attributes (data-item-id, tooltips)
      // viewIdOrConfig can be: null, string (view GUID), or object { type, ...viewProps }
      renderItem: async (itemId, viewIdOrConfig, options) => {
        // Extract view ID and config from the parameter
        let viewId = null;
        let viewConfig = null;
        if (typeof viewIdOrConfig === 'string') {
          viewId = viewIdOrConfig;
        } else if (viewIdOrConfig && typeof viewIdOrConfig === 'object') {
          viewId = viewIdOrConfig.type || null;
          viewConfig = viewIdOrConfig;
        }

        // Merge decorator and viewConfig into context for propagation
        const decorator = options?.decorator || context.decorator;
        const mergedContext = {
          ...context,
          decorator,
          viewConfig,
          parentId: containerItem.id  // Pass parent ID for updateViewConfig
        };

        const domNode = await rendering.renderItem(itemId, viewId, options || {}, mergedContext);

        // Apply decorator if present (from options or inherited context)
        if (domNode && decorator) {
          try {
            const item = await kernel.storage.get(itemId);
            await decorator(domNode, itemId, item);
          } catch (e) {
            console.warn('Decorator error:', e);
          }
        }
        return domNode;
      },

      // Get the view config for the current item (passed from parent via renderItem)
      // For root items (rendered by viewport), returns the viewport's root view config
      getViewConfig: () => {
        // If we have a viewConfig from context (nested item), use that
        if (context.viewConfig) {
          return context.viewConfig;
        }
        // For viewport root items (parent is the viewport itself), get config from viewport
        if (context.parentId === IDS.VIEWPORT && kernel.viewport.rootId === containerItem.id) {
          return kernel.viewport.getRootViewConfig();
        }
        return null;
      },

      // Get the parent ID that rendered this item
      getParentId: () => context.parentId || null,

      // Update the view config for the current item in the parent's children array
      // This persists view-specific state like banner position, sort order, etc.
      // For root items (rendered by viewport), updates the viewport's root view config instead.
      updateViewConfig: async (updates) => {
        const parentId = context.parentId;

        // For viewport root items (parent is the viewport itself), update viewport's root view config
        if (parentId === IDS.VIEWPORT && kernel.viewport.rootId === containerItem.id) {
          kernel.viewport.updateRootViewConfig(updates);
          await kernel.viewport.persist();
          return true;
        }

        if (!parentId) {
          console.warn('updateViewConfig: no parent ID in context');
          return false;
        }

        const parent = await kernel.storage.get(parentId);
        const childIndex = parent.children?.findIndex(c => c.id === containerItem.id);
        if (childIndex < 0) {
          console.warn('updateViewConfig: item not found in parent children');
          return false;
        }

        // Merge updates into existing view config
        const currentChild = parent.children[childIndex];
        parent.children[childIndex] = {
          ...currentChild,
          view: { ...(currentChild.view || {}), ...updates }
        };
        parent.modified = Date.now();

        await kernel.saveItem(parent);
        return true;
      },

      // View discovery
      getViews: (typeId) => kernel.rendering.getViews(typeId),
      getDefaultView: (typeId) => kernel.rendering.getDefaultView(typeId),
      findView: (typeId) => kernel.rendering.findView(typeId),

      // Navigation (params: { field, line, col } for line highlighting)
      navigate: (itemId, params) => kernel.navigateToItem(itemId, params),
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

      // Set view for a child in current container (2 params)
      // or in any container (3 params: parentId, childId, viewId)
      setChildView: async (childIdOrParentId, viewIdOrChildId, optionalViewId) => {
        if (optionalViewId !== undefined) {
          // 3-parameter version: setChildView(parentId, childId, viewId)
          await kernel.setChildView(childIdOrParentId, viewIdOrChildId, optionalViewId);
        } else {
          // 2-parameter version: setChildView(childId, viewId)
          await kernel.setChildView(containerItem.id, childIdOrParentId, viewIdOrChildId);
        }
      },

      // Restore previous view for an item
      restorePreviousView: async (itemId) => {
        // Check if item is the viewport root FIRST (regardless of data hierarchy)
        const isViewportRoot = kernel.viewport.rootId === itemId;

        if (isViewportRoot) {
          // It's the viewport root - restore from viewport
          if (kernel.viewport.restorePreviousRootView) {
            const restored = kernel.viewport.restorePreviousRootView();
            if (restored) {
              await kernel.viewport.persist();
              await kernel.renderRoot(kernel.currentRoot);
              return true;
            }
          }
          // No previous view, but we can still clear the current view override
          if (kernel.viewport.rootViewId) {
            kernel.viewport.setRootView(null, false);  // Don't store previous
            await kernel.viewport.persist();
            await kernel.renderRoot(kernel.currentRoot);
            return true;
          }
          return false;
        }

        // Not the viewport root - use rendering parent from context, fall back to data hierarchy
        const renderingParentId = context.parentId;
        const parent = renderingParentId
          ? await kernel.storage.get(renderingParentId)
          : await kernel.findParentOf(itemId);
        if (!parent) {
          return false;
        }

        // Find the child spec
        const childIndex = parent.children.findIndex(c => c.id === itemId);
        if (childIndex < 0) return false;

        const childSpec = parent.children[childIndex];
        if (childSpec.previousView) {
          // Restore previous view (complete snapshot)
          parent.children[childIndex] = {
            ...childSpec,
            view: { ...childSpec.previousView },
            previousView: undefined
          };
        } else if (childSpec.view && 'type' in childSpec.view) {
          // No previous view stored, but there's a current view override
          // Remove the type to revert to default view, keeping spatial props
          const { type, ...viewWithoutType } = childSpec.view;
          parent.children[childIndex] = {
            ...childSpec,
            view: Object.keys(viewWithoutType).length > 0 ? viewWithoutType : undefined,
            previousView: undefined
          };
        } else {
          // No view override to restore from
          return false;
        }
        await kernel.saveItem(parent);
        await kernel.renderRoot(kernel.currentRoot);
        return true;
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
        // Get full view config for root (type + additional config)
        getRootViewConfig: () => kernel.viewport.getRootViewConfig(),
        // Update root view config (for banner position, etc.)
        updateRootViewConfig: async (updates) => {
          kernel.viewport.updateRootViewConfig(updates);
          await kernel.viewport.persist();
        }
      },

      // Events API (read-only for renderers - can subscribe but not emit)
      events: {
        on: (event, handler) => kernel.events.on(event, handler),
        off: (event, handler) => kernel.events.off(event, handler)
      },

      // Render instances API (read-only for renderers)
      instances: {
        getByItemId: (itemId) => rendering.registry.getByItemId(itemId),
        getAll: () => rendering.registry.getAll(),
        getSummary: () => rendering.registry.getSummary()
      }
    };

    return api;
  }

  createErrorView(error, itemId) {
    const container = document.createElement("div");
    container.className = "render-error";

    const heading = document.createElement("h3");
    heading.textContent = `Error rendering: ${itemId}`;
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
