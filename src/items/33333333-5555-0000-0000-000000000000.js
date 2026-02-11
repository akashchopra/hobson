
/** Parse a stack trace to extract the source item name and line number.
 * @param {string} stack - Error stack trace string
 * @returns {{itemName: string, line: number}|null}
 */
function parseSourceLocation(stack) {
  const lines = stack.split('\n');
  for (const line of lines) {
    const match = line.match(/\((.+?):(\d+):\d+\)/) ||  // Chrome
                  line.match(/@(.+?):(\d+):\d+/);        // Firefox/Safari
    if (match) {
      const [, itemName, lineNum] = match;
      // Strip .js suffix and skip kernel-rendering itself
      const cleanName = itemName.replace(/\.js$/, '');
      if (cleanName !== 'kernel:rendering') {
        return { itemName: cleanName, line: parseInt(lineNum, 10) };
      }
    }
  }
  return null;
}

/** Render Instance Registry — tracks what's currently rendered on screen.
 * Indexes instances by itemId, viewId, and parentId for efficient lookup. */
class RenderInstanceRegistry {
  constructor() {
    this.instances = new Map();      // instanceId -> InstanceInfo
    this.byItemId = new Map();       // itemId -> Set<instanceId>
    this.byViewId = new Map();       // viewId -> Set<instanceId>
    this.byParentId = new Map();     // parentId -> Set<instanceId>
    this.nextId = 1;
  }

  /** Register a new render instance and index it.
   * @param {HTMLElement} domNode - The rendered DOM element
   * @param {string} itemId - Item GUID
   * @param {string} viewId - View GUID used to render
   * @param {string|null} parentId - Parent item GUID (null for root)
   * @param {HTMLElement|null} [siblingContainer] - Sibling container element
   * @returns {number} The new instance ID
   */
  register(domNode, itemId, viewId, parentId, siblingContainer = null) {
    const instanceId = this.nextId++;

    const info = {
      instanceId,
      domNode,
      itemId,
      viewId,
      parentId,
      siblingContainer,
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

  /** Unregister a render instance and remove from all indexes.
   * @param {number} instanceId
   * @returns {boolean} True if found and removed
   */
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

  /** Unregister all instances belonging to a parent.
   * @param {string|null} parentId
   * @returns {number} Number removed
   */
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

  /** Clear all render instances.
   * @returns {number} Number cleared
   */
  clear() {
    const count = this.instances.size;
    this.instances.clear();
    this.byItemId.clear();
    this.byViewId.clear();
    this.byParentId.clear();
    return count;
  }

  /** Get a render instance by ID.
   * @param {number} instanceId
   * @returns {Object|null}
   */
  get(instanceId) {
    return this.instances.get(instanceId) || null;
  }

  /** Get all render instances for an item.
   * @param {string} itemId
   * @returns {Object[]}
   */
  getByItemId(itemId) {
    const instanceIds = this.byItemId.get(itemId);
    if (!instanceIds) return [];
    return [...instanceIds].map(id => this.instances.get(id)).filter(Boolean);
  }

  /** Get all render instances using a specific view.
   * @param {string} viewId
   * @returns {Object[]}
   */
  getByViewId(viewId) {
    const instanceIds = this.byViewId.get(viewId);
    if (!instanceIds) return [];
    return [...instanceIds].map(id => this.instances.get(id)).filter(Boolean);
  }

  /** Get all render instances belonging to a parent.
   * @param {string|null} parentId
   * @returns {Object[]}
   */
  getByParentId(parentId) {
    const parentKey = parentId || '__root__';
    const instanceIds = this.byParentId.get(parentKey);
    if (!instanceIds) return [];
    return [...instanceIds].map(id => this.instances.get(id)).filter(Boolean);
  }

  /** Get all render instances.
   * @returns {Object[]}
   */
  getAll() {
    return [...this.instances.values()];
  }

  /** Get a summary of current render state.
   * @returns {{totalInstances: number, uniqueItems: number, uniqueViews: number, uniqueParents: number}}
   */
  getSummary() {
    return {
      totalInstances: this.instances.size,
      uniqueItems: this.byItemId.size,
      uniqueViews: this.byViewId.size,
      uniqueParents: this.byParentId.size
    };
  }
}

/** Walk a DOM subtree calling registered cleanup functions before removal.
 * Elements opt in via data-hobson-cleanup attribute and __hobsonCleanup function.
 * @param {HTMLElement} root - Root element to walk
 */
function cleanupDOMTree(root) {
  if (!root) return;
  const cleanables = root.querySelectorAll?.('[data-hobson-cleanup]');
  if (cleanables) {
    for (const el of cleanables) {
      if (typeof el.__hobsonCleanup === 'function') {
        try { el.__hobsonCleanup(); } catch (e) { /* ignore */ }
      }
    }
  }
  if (typeof root.__hobsonCleanup === 'function') {
    try { root.__hobsonCleanup(); } catch (e) { /* ignore */ }
  }
}

/** Rendering system — resolves views, renders items to DOM, and manages re-renders. */
export class RenderingSystem {
  constructor(kernel) {
    this.kernel = kernel;
    this.registry = new RenderInstanceRegistry();
  }

  /** Parse a stack trace to extract source item name and line number.
   * @param {string} stack - Error stack trace string
   * @returns {{itemName: string, line: number}|null}
   */
  parseSourceLocation(stack) {
    return parseSourceLocation(stack);
  }

  /** Clean up resources in a DOM subtree before removal.
   * @param {HTMLElement} root - Root element to clean up
   */
  cleanupDOMTree(root) {
    cleanupDOMTree(root);
  }

  /** Clear all render instances (called before full re-render).
   * @returns {number} Number cleared
   */
  clearInstances() {
    return this.registry.clear();
  }

  /** Re-render all visible instances of an item in place (partial re-render).
   * @param {string} itemId - Item GUID to re-render
   * @returns {Promise<{updated: number, total?: number, notFound?: boolean}>}
   */
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
        // Skip orphaned instances — their DOM was removed by a concurrent re-render
        // (e.g. renderViewport or another rerenderItem). Rendering here would be wasted
        // work and can leak document-level event handlers that never get cleaned up.
        const oldDom = instance.domNode;
        if (!oldDom || !oldDom.parentNode) {
          this.registry.unregister(instance.instanceId);
          continue;
        }

        // Look up current view config from parent's attachments array (may have changed via setAttachmentView)
        // We need the FULL view config object (not just type) so views can access innerView, etc.
        let currentViewId = instance.viewId;
        let viewConfig = null;
        if (instance.parentId) {
          const parent = await this.kernel.storage.get(instance.parentId);
          const childEntry = parent?.attachments?.find(c => c.id === itemId);
          if (childEntry?.view) {
            viewConfig = childEntry.view;  // Full view config object
            currentViewId = childEntry.view.type || currentViewId;
          }
        } else {
          // For root items (no parentId), get full view config from viewport-manager
          const vpMgr = this.kernel.moduleSystem.getCached('viewport-manager');
          if (vpMgr && vpMgr.getRootViewConfig) {
            viewConfig = await vpMgr.getRootViewConfig();
            currentViewId = viewConfig?.type || currentViewId;
          }
        }

        // Re-render with current view and parent context
        // Pass viewConfig in context so views can access innerView, etc.
        const newDom = await this.renderItem(itemId, currentViewId, {}, {
          parentId: instance.parentId,
          siblingContainer: instance.siblingContainer,
          viewConfig: viewConfig
        });

        // Replace content in existing container (re-check parentNode — async work above may have changed it)
        if (oldDom.parentNode) {
          // Clean up resources (CodeMirror instances, observers, etc.) before removal
          cleanupDOMTree(oldDom);

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
          // DOM was detached during async rendering — clean up the new render's side effects
          cleanupDOMTree(newDom);
          const newInstances = newDom.querySelectorAll?.('[data-render-instance]');
          if (newInstances) {
            for (const el of newInstances) {
              this.registry.unregister(parseInt(el.dataset.renderInstance, 10));
            }
          }
          this.registry.unregister(instance.instanceId);
        }
      } catch (error) {
        console.error(`[Partial Re-render Error] Item ${itemId}:`, error);
        // Continue with other instances even if one fails
      }
    }

    return { updated, total: instances.length };
  }

  /** Re-render all items currently using a specific view.
   * @param {string} viewId - View GUID
   * @returns {Promise<{updated: number, items?: number, notFound?: boolean}>}
   */
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

  /** Re-render all items of a given type (skips items with their own preferred view).
   * @param {string} typeId - Type GUID
   * @returns {Promise<{updated: number}>}
   */
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

  /** Render an item as a DOM element using a specified or resolved view.
   * @param {string} itemId - Item GUID to render
   * @param {string|null} [viewId] - View GUID (null for auto-resolve via preference hierarchy)
   * @param {Object} [options] - Render options (onCycle callback, etc.)
   * @param {Object} [context] - Render context (parentId, renderPath, viewConfig, etc.)
   * @returns {Promise<HTMLElement>}
   */
  async renderItem(itemId, viewId = null, options = {}, context = {}) {
    const IDS = this.kernel.IDS;
    const renderPath = context.renderPath || [];
    const perf = window.hobsonPerf;
    const isRoot = renderPath.length === 0;
    const perfPrefix = isRoot ? 'root' : `child-${renderPath.length}`;

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

    if (isRoot) perf?.mark(`${perfPrefix}-item-fetch-start`);
    const item = await this.kernel.storage.get(itemId);
    if (isRoot) {
      perf?.mark(`${perfPrefix}-item-fetch-end`);
      perf?.measure(`${perfPrefix}-item-fetch`, `${perfPrefix}-item-fetch-start`, `${perfPrefix}-item-fetch-end`);
    }

    // Use specified view or find default via preference hierarchy
    let view;
    if (isRoot) perf?.mark(`${perfPrefix}-view-resolve-start`);
    if (viewId) {
      // Explicit view specified by caller (highest priority)
      view = await this.kernel.storage.get(viewId);
    } else {
      // Use preference hierarchy: item.preferredView → type.preferredView → type chain
      view = await this.resolveView(item);
    }
    if (isRoot) {
      perf?.mark(`${perfPrefix}-view-resolve-end`);
      perf?.measure(`${perfPrefix}-view-resolve`, `${perfPrefix}-view-resolve-start`, `${perfPrefix}-view-resolve-end`);
    }

    // Build new context with updated render path
    const newContext = {
      ...context,
      renderPath: [...renderPath, itemId],
      viewId: view.id,
      debug: context.debug || this.kernel.debugMode
    };

    // Load and execute view
    try {
      if (isRoot) perf?.mark(`${perfPrefix}-view-load-start`);
      const viewModule = await this.kernel.moduleSystem.require(view.id);
      if (isRoot) {
        perf?.mark(`${perfPrefix}-view-load-end`);
        perf?.measure(`${perfPrefix}-view-load`, `${perfPrefix}-view-load-start`, `${perfPrefix}-view-load-end`);
      }

      const api = this.kernel.createAPI(item, newContext);

      if (isRoot) perf?.mark(`${perfPrefix}-render-exec-start`);
      const domNode = await viewModule.render(item, api);
      if (isRoot) {
        perf?.mark(`${perfPrefix}-render-exec-end`);
        perf?.measure(`${perfPrefix}-render-exec`, `${perfPrefix}-render-exec-start`, `${perfPrefix}-render-exec-end`);
      }

      // Register render instance (Phase 2)
      if (domNode) {
        const parentId = context.parentId || null;
        const siblingContainer = context.siblingContainer || null;
        this.registry.register(domNode, itemId, view.id, parentId, siblingContainer);
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

  /** Resolve a view using the preference hierarchy: item.preferredView → type.preferredView → type chain.
   * @param {Object} item - The item to find a view for
   * @returns {Promise<Object>} The resolved view item
   */
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

    // 3. Fall back to extends chain lookup
    return await this.findView(item.type);
  }

  /** Find a view for a type, walking up the extends chain. Falls back to default-view.
   * @param {string} typeId - Type GUID
   * @returns {Promise<Object>} The view item
   */
  async findView(typeId) {
    const IDS = this.kernel.IDS;

    // Query all views once at the beginning (not per type in chain)
    const allViews = await this.kernel.storage.query({ type: IDS.VIEW });

    let currentType = typeId;
    const visited = new Set();

    while (currentType && !visited.has(currentType)) {
      visited.add(currentType);

      // Look for VIEW items
      const view = allViews.find(v => v.content?.for_type === currentType);
      if (view) {
        return view;
      }

      // Stop at ITEM (root)
      if (currentType === IDS.ITEM || currentType === IDS.ATOM) {
        break;
      }

      // Move up the extends chain (or fall back to type chain)
      try {
        const typeItem = await this.kernel.storage.get(currentType);
        
        // Prefer 'extends' field (new model)
        if (typeItem.extends !== undefined) {
          // null means root reached
          if (typeItem.extends === null) break;
          currentType = typeItem.extends;
        } else {
          // Fallback to 'type' field (old model) for backwards compatibility
          // Stop at TYPE_DEFINITION boundary to avoid meta-level (old heuristic)
          if (typeItem.type === IDS.TYPE_DEFINITION) break;
          currentType = typeItem.type;
        }
      } catch {
        break;
      }
    }

    // Fall back to default view
    return await this.kernel.storage.get(IDS.DEFAULT_VIEW);
  }

  /** Get all views for a type (including inherited from extends chain).
   * @param {string} typeId - Type GUID
   * @returns {Promise<Array<{view: Object, forType: string, inherited: boolean, isDefault?: boolean}>>}
   */
  async getViews(typeId) {
    const IDS = this.kernel.IDS;
    const result = [];
    const seenIds = new Set();

    // Query all views once at the beginning (not per type in chain)
    const allViews = await this.kernel.storage.query({ type: IDS.VIEW });

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

      // Stop at ITEM (root)
      if (currentType === IDS.ITEM || currentType === IDS.ATOM) {
        break;
      }

      // Move up the extends chain (or fall back to type chain)
      try {
        const typeItem = await this.kernel.storage.get(currentType);
        
        // Prefer 'extends' field (new model)
        if (typeItem.extends !== undefined) {
          // null means root reached
          if (typeItem.extends === null) break;
          currentType = typeItem.extends;
        } else {
          // Fallback to 'type' field (old model) for backwards compatibility
          // Stop at TYPE_DEFINITION boundary to avoid meta-level (old heuristic)
          if (typeItem.type === IDS.TYPE_DEFINITION) break;
          currentType = typeItem.type;
        }
      } catch {
        break;
      }
    }

    // Always include default view as fallback option
    const defaultView = await this.kernel.storage.get(IDS.DEFAULT_VIEW);
    if (defaultView && !seenIds.has(defaultView.id)) {
      result.push({
        view: defaultView,
        forType: IDS.ITEM,
        inherited: true,
        isDefault: true
      });
    }

    return result;
  }

  /** Get the first view found for a type.
   * @param {string} typeId - Type GUID
   * @returns {Promise<Object|null>} The view item, or null
   */
  async getDefaultView(typeId) {
    const views = await this.getViews(typeId);
    return views.length > 0 ? views[0].view : null;
  }

  /** Get the view that would be used for a specific item (full preference hierarchy).
   * @param {string} itemId - Item GUID
   * @returns {Promise<Object>} The resolved view item
   */
  async getEffectiveView(itemId) {
    const item = await this.kernel.storage.get(itemId);
    return await this.resolveView(item);
  }

  /** Get the type-level preferred view (falls back to findView).
   * @param {string} typeId - Type GUID
   * @returns {Promise<Object>} The view item
   */
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

  /** Create a DOM element showing a render error with an edit button.
   * @param {Error} error - The render error
   * @param {string} itemId - Item GUID that failed to render
   * @returns {HTMLElement}
   */
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
