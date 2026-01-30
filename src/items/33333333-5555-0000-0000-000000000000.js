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

  // Partial re-render: update specific item(s) in place without full viewport re-render (Phase 3)
  async rerenderItem(itemId) {
    // Find existing instance(s) for this item
    const instances = this.registry.getByItemId(itemId);

    if (instances.length === 0) {
      // Not currently rendered - nothing to update
      return { updated: 0, notFound: true };
    }

    let updated = 0;
    for (const instance of instances) {
      try {
        // Look up current view from parent's children array (may have changed via setChildView)
        let currentViewId = instance.viewId;
        if (instance.parentId) {
          const parent = await this.kernel.storage.get(instance.parentId);
          const childEntry = parent?.children?.find(c => c.id === itemId);
          if (childEntry?.view?.type !== undefined) {
            currentViewId = childEntry.view.type;
          }
        }

        // Re-render with current view and parent context
        const newDom = await this.renderItem(itemId, currentViewId, {}, {
          parentId: instance.parentId
        });

        // Replace content in existing container
        const oldDom = instance.domNode;
        if (oldDom && oldDom.parentNode) {
          // Unregister all instances in the old DOM subtree (including nested children)
          const nestedInstances = oldDom.querySelectorAll('[data-render-instance]');
          for (const el of nestedInstances) {
            this.registry.unregister(parseInt(el.dataset.renderInstance, 10));
          }
          // Unregister the root instance itself
          this.registry.unregister(instance.instanceId);

          oldDom.parentNode.replaceChild(newDom, oldDom);
          updated++;
        } else {
          // DOM not in document, just unregister
          this.registry.unregister(instance.instanceId);
        }
      } catch (error) {
        console.error(`[Partial Re-render Error] Item ${itemId}:`, error);
        // Continue with other instances even if one fails
      }
    }

    return { updated, total: instances.length };
  }

  // Re-render all items using a specific view (useful when view code changes)
  async rerenderByView(viewId) {
    const instances = this.registry.getByViewId(viewId);

    if (instances.length === 0) {
      return { updated: 0, notFound: true };
    }

    // Track which items we've already processed to avoid duplicate re-renders
    // (same item can have multiple instances if rendered in multiple places)
    const processedItems = new Set();
    let updated = 0;

    for (const instance of instances) {
      if (processedItems.has(instance.itemId)) continue;
      processedItems.add(instance.itemId);

      try {
        const result = await this.rerenderItem(instance.itemId);
        updated += result.updated;
      } catch (error) {
        console.error(`[rerenderByView] Error re-rendering item ${instance.itemId}:`, error);
      }
    }

    return { updated, items: processedItems.size };
  }

  // Re-render all items of a given type (for when type preference changes)
  async rerenderByType(typeId) {
    const instances = this.registry.getAll();
    let updated = 0;

    for (const instance of instances) {
      try {
        const item = await this.kernel.storage.get(instance.itemId);
        // Only re-render if item is of this type AND doesn't have its own preference
        if (item.type === typeId && !item.preferredView) {
          await this.rerenderItem(instance.itemId);
          updated++;
        }
      } catch (e) {
        // Item may have been deleted - skip
      }
    }

    return { updated };
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

    // Use specified view or find default via preference hierarchy
    let view;
    if (viewId) {
      // Explicit view specified by caller (highest priority)
      view = await this.kernel.storage.get(viewId);
    } else {
      // Use preference hierarchy: item.preferredView → type.preferredView → type chain
      view = await this.resolveView(item);
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

  // Resolve view using preference hierarchy: item.preferredView → type.preferredView → type chain
  async resolveView(item) {
    // 1. Check item's preferred view
    if (item.preferredView) {
      try {
        const view = await this.kernel.storage.get(item.preferredView);
        if (view) return view;
      } catch (e) {
        console.warn(`Preferred view ${item.preferredView} not found for item ${item.id}, checking type preference`);
      }
    }

    // 2. Check type definition's preferred view
    try {
      const typeItem = await this.kernel.storage.get(item.type);
      if (typeItem.preferredView) {
        try {
          const view = await this.kernel.storage.get(typeItem.preferredView);
          if (view) return view;
        } catch (e) {
          console.warn(`Preferred view ${typeItem.preferredView} not found for type ${typeItem.name}, using type chain lookup`);
        }
      }
    } catch (e) {
      // Type not found - fall through to type chain lookup
    }

    // 3. Fall back to type chain lookup
    return await this.findView(item.type);
  }

  // Find view for a type (walks up type chain)
  async findView(typeId) {
    const IDS = this.kernel.IDS;

    // Query all views once at the beginning (not per type in chain)
    const allViews = await this.kernel.storage.query({ type: IDS.VIEW });
    const allViewSpecs = await this.kernel.storage.query({ type: IDS.VIEW_SPEC });

    let currentType = typeId;
    const visited = new Set();

    while (currentType && !visited.has(currentType)) {
      visited.add(currentType);

      // Look for VIEW items (filter locally)
      const view = allViews.find(v => v.content?.for_type === currentType);
      if (view) {
        return view;
      }

      // Look for VIEW_SPEC items (declarative views)
      const viewSpec = allViewSpecs.find(v => v.content?.for_type === currentType);
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

    // Query all views once at the beginning (not per type in chain)
    const allViews = await this.kernel.storage.query({ type: IDS.VIEW });
    const allViewSpecs = await this.kernel.storage.query({ type: IDS.VIEW_SPEC });

    let currentType = typeId;
    const visited = new Set();

    while (currentType && !visited.has(currentType)) {
      visited.add(currentType);

      // Include views (filter locally)
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

  // Get the view that would be used for a specific item (full preference hierarchy)
  async getEffectiveView(itemId) {
    const item = await this.kernel.storage.get(itemId);
    return await this.resolveView(item);
  }

  // Get the type-level preferred view (for showing in modal)
  async getTypePreferredView(typeId) {
    try {
      const typeItem = await this.kernel.storage.get(typeId);
      if (typeItem.preferredView) {
        return await this.kernel.storage.get(typeItem.preferredView);
      }
    } catch (e) {
      // Fall through
    }
    return await this.findView(typeId);
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
        // siblingContainer: if explicitly passed in options, use that; otherwise pass through from context
        const siblingContainer = options?.siblingContainer !== undefined
          ? options.siblingContainer
          : context.siblingContainer;
        // navigateTo: if explicitly passed in options, use that; otherwise pass through from context
        const navigateTo = options?.navigateTo !== undefined
          ? options.navigateTo
          : context.navigateTo;
        const mergedContext = {
          ...context,
          decorator,
          viewConfig,
          parentId: containerItem.id,  // Pass parent ID for updateViewConfig
          siblingContainer,  // Pass sibling container for openSibling
          navigateTo  // Pass navigation params for scroll-to-line/region
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

      // Get navigation params passed from parent (for scroll-to-line/region)
      // Returns { field, line, region } or null
      getNavigateTo: () => context.navigateTo || null,

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

      // Preferred view management
      setPreferredView: async (itemId, viewId) => {
        const item = await kernel.storage.get(itemId);
        if (viewId) {
          item.preferredView = viewId;
        } else {
          delete item.preferredView;
        }
        item.modified = Date.now();
        await kernel.saveItem(item);

        // If this is a type definition, re-render all items of this type
        if (item.type === kernel.IDS.TYPE_DEFINITION) {
          await rendering.rerenderByType(itemId);
        } else {
          await rendering.rerenderItem(itemId);
        }
      },

      getPreferredView: async (itemId) => {
        const item = await kernel.storage.get(itemId);
        return item.preferredView || null;
      },

      // Convenience method: set preferred view for an item's type
      setTypePreferredView: async (itemId, viewId) => {
        const item = await kernel.storage.get(itemId);
        const typeItem = await kernel.storage.get(item.type);
        if (viewId) {
          typeItem.preferredView = viewId;
        } else {
          delete typeItem.preferredView;
        }
        typeItem.modified = Date.now();
        await kernel.saveItem(typeItem);
        await rendering.rerenderByType(item.type);
      },

      getTypePreferredView: async (itemId) => {
        const item = await kernel.storage.get(itemId);
        const typeItem = await kernel.storage.get(item.type);
        return typeItem.preferredView || null;
      },

      // Get the effective view for an item (full hierarchy)
      getEffectiveView: (itemId) => rendering.getEffectiveView(itemId),

      // Get the type name for an item (for modal labels)
      getTypeName: async (itemId) => {
        const item = await kernel.storage.get(itemId);
        const typeItem = await kernel.storage.get(item.type);
        return typeItem.name || typeItem.id.slice(0, 8);
      },

      // Get contextual view override (from parent's child spec)
      getContextualView: async (itemId, parentId) => {
        if (!parentId) return null;
        try {
          const parent = await kernel.storage.get(parentId);
          const childSpec = parent.children?.find(c =>
            (typeof c === 'string' ? c : c.id) === itemId
          );
          if (childSpec && typeof childSpec === 'object' && childSpec.view?.type) {
            return childSpec.view.type;
          }
        } catch (e) {
          // Parent not found
        }
        return null;
      },

      // Navigation (params: { field, line, col } for line highlighting)
      navigate: (itemId, params) => kernel.navigateToItem(itemId, params),
      getCurrentRoot: () => kernel.currentRoot,

      // Sibling container object (provided by container views like container_view)
      // Use api.siblingContainer.addSibling(itemId) to add items to the current container
      get siblingContainer() {
        return context.siblingContainer || null;
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

      // Partial re-render (Phase 3) - update specific item in place
      rerenderItem: (itemId) => rendering.rerenderItem(itemId),

      // Re-render all items using a specific view (useful when view code changes)
      rerenderByView: (viewId) => rendering.rerenderByView(viewId),

      // Re-render all items of a given type (useful when type preference changes)
      rerenderByType: (typeId) => rendering.rerenderByType(typeId),

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
