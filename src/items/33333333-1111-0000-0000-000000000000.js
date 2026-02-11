export async function loadKernel(require, storageBackend) {
  /** Event bus with hierarchical type dispatch.
   * Subscribing to a parent event type (e.g., ITEM_EVENT) receives all child events. */
  class EventBus {
    constructor(kernel) {
      this.kernel = kernel;  // Reference for eventTypeCache access
      this.listeners = new Map();
    }

    /** Subscribe to an event type. Returns an unsubscribe function.
     * @param {string} eventTypeId - Event type GUID to subscribe to
     * @param {Function} handler - Called with event object {type, content, timestamp}
     * @returns {Function} Unsubscribe function
     */
    on(eventTypeId, handler) {
      // Subscribe to an event type GUID
      // Subscribing to a parent type (e.g., ITEM_EVENT) will receive all child events
      if (!this.listeners.has(eventTypeId)) {
        this.listeners.set(eventTypeId, new Set());
      }
      this.listeners.get(eventTypeId).add(handler);
      return () => this.off(eventTypeId, handler);
    }

    /** Unsubscribe a handler from an event type.
     * @param {string} eventTypeId - Event type GUID
     * @param {Function} handler - The handler to remove
     */
    off(eventTypeId, handler) {
      const handlers = this.listeners.get(eventTypeId);
      if (handlers) {
        handlers.delete(handler);
      }
    }

    /** Emit an event, dispatching to all matching subscribers (including parent types).
     * @param {Object} event - Event object with {type: eventTypeGUID, content: {...}}
     */
    emit(event) {
      // event = { type: eventTypeId, content: {...} }
      // Add timestamp if not present
      const eventWithTimestamp = {
        ...event,
        timestamp: event.timestamp || Date.now()
      };

      const emittedType = event.type;

      // Get the type chain for this event (includes ancestors)
      // If cache not ready yet (during early boot), just dispatch to exact matches
      const cacheEntry = this.kernel?.eventTypeCache?.get(emittedType);
      const typeChain = cacheEntry?.ancestors || new Set([emittedType]);

      // Dispatch to all listeners whose subscribed type is in the emitted event's type chain
      for (const [subscribedType, handlers] of this.listeners) {
        if (typeChain.has(subscribedType)) {
          for (const handler of handlers) {
            try {
              const result = handler(eventWithTimestamp);
              // Handle async handlers - catch promise rejections
              if (result && typeof result.catch === 'function') {
                result.catch(e => {
                  console.error(`Async event handler error for ${subscribedType}:`, e);
                });
              }
            } catch (e) {
              console.error(`Event handler error for ${subscribedType}:`, e);
            }
          }
        }
      }
    }

    /** Get all event type GUIDs that have active listeners.
     * @returns {string[]} Array of event type GUIDs
     */
    async emitAsync(event) {
      const eventWithTimestamp = {
        ...event,
        timestamp: event.timestamp || Date.now()
      };

      const emittedType = event.type;
      const cacheEntry = this.kernel?.eventTypeCache?.get(emittedType);
      const typeChain = cacheEntry?.ancestors || new Set([emittedType]);

      const promises = [];
      for (const [subscribedType, handlers] of this.listeners) {
        if (typeChain.has(subscribedType)) {
          for (const handler of handlers) {
            try {
              const result = handler(eventWithTimestamp);
              if (result && typeof result.then === 'function') {
                promises.push(result);
              }
            } catch (e) {
              console.error(`Event handler error for ${subscribedType}:`, e);
            }
          }
        }
      }

      await Promise.allSettled(promises);
    }

    getRegisteredEvents() {
      return [...this.listeners.keys()];
    }
  }
// [BEGIN:SEED_IDS]
  // ID constants
  const IDS = {
    // Self-referential base type
    ITEM: "00000000-0000-0000-0000-000000000000",
    // Synonym for ITEM. Sometimes useful to have a distinct name in contexts where "item" is being used generically.
    ATOM: "00000000-0000-0000-0000-000000000000",
    // Type for defining types
    TYPE_DEFINITION: "11111111-0000-0000-0000-000000000000",
    // Base type for executable items
    CODE: "22222222-0000-0000-0000-000000000000",
    // Base type for kernel modules
    KERNEL_MODULE: "33333333-0000-0000-0000-000000000000",
    KERNEL_CORE: "33333333-1111-0000-0000-000000000000",
    KERNEL_STORAGE: "33333333-2222-0000-0000-000000000000",
    KERNEL_MODULE_SYSTEM: "33333333-4444-0000-0000-000000000000",
    KERNEL_RENDERING_SYSTEM: "33333333-5555-0000-0000-000000000000",
    KERNEL_SAFE_MODE: "33333333-7777-0000-0000-000000000000",
    KERNEL_STYLES: "33333333-8888-0000-0000-000000000000",
    // Base type for reusable code modules
    LIBRARY: "66666666-0000-0000-0000-000000000000",
    // Type for the viewport
    VIEWPORT_TYPE: "77777777-0000-0000-0000-000000000000",
    VIEWPORT: "88888888-0000-0000-0000-000000000000",
    // Unified view system
    VIEW: "aaaaaaaa-0000-0000-0000-000000000000",
    DEFAULT_VIEW: "aaaaaaaa-1111-0000-0000-000000000000",
    // VIEW_SPEC removed - rendering system discovers by name
    // FIELD_VIEW removed - not used by kernel, userland items use the GUID directly
    // Event definition types
    EVENT_DEFINITION: "e0e00000-0000-0000-0000-000000000000"
  };

  // Event IDs - for subscribing and emitting events
  const EVENT_IDS = {
    // Base type (subscribe to this for ALL events)
    EVENT_DEFINITION: "e0e00000-0000-0000-0000-000000000000",

    // Event group types (subscribe to these for categories)
    ITEM_EVENT:   "e0e00000-0001-0000-0000-000000000000",
    SYSTEM_EVENT: "e0e00000-0002-0000-0000-000000000000",
    // VIEWPORT_EVENT removed - defined by userland viewport-manager

    // Specific item events
    ITEM_CREATED: "e0e00000-0001-0001-0000-000000000000",
    ITEM_UPDATED: "e0e00000-0001-0002-0000-000000000000",
    ITEM_DELETED: "e0e00000-0001-0003-0000-000000000000",

    // Specific system events
    SYSTEM_ERROR:         "e0e00000-0002-0001-0000-000000000000",
    SYSTEM_BOOT_COMPLETE: "e0e00000-0002-0002-0000-000000000000"
    // VIEWPORT_* events removed - defined by userland viewport-manager
  };
// [END:SEED_IDS]

  const { Storage } = await require(IDS.KERNEL_STORAGE);
  // KERNEL_VIEWPORT removed - viewport state now managed by userland viewport-manager
  const { ModuleSystem } = await require(IDS.KERNEL_MODULE_SYSTEM);
  const { RenderingSystem } = await require(IDS.KERNEL_RENDERING_SYSTEM);
  const { SafeMode } = await require(IDS.KERNEL_SAFE_MODE);

  /** Sort items in dependency order for import (types before their instances).
   * Uses topological sort based on type and extends fields.
   * @param {Object[]} items - Items to sort
   * @returns {Object[]} Sorted items
   */
  function sortItemsForImport(items) {
    const itemMap = new Map(items.map(i => [i.id, i]));
    const itemIds = new Set(items.map(i => i.id));

    // Build dependency graph
    // dependsOn[A] = [B, C] means A depends on B and C (they must be saved first)
    const dependsOn = new Map();

    for (const item of items) {
      const deps = [];

      // Type dependency (required for validation)
      if (item.type && itemIds.has(item.type) && item.type !== item.id) {
        deps.push(item.type);
      }

      // Extends dependency (for completeness)
      if (item.extends && itemIds.has(item.extends) && item.extends !== item.id) {
        deps.push(item.extends);
      }

      dependsOn.set(item.id, deps);
    }

    // Topological sort using Kahn's algorithm
    // Build reverse graph: mustComeBefore[B] = [A, D] means B must come before A and D
    const mustComeBefore = new Map();
    const inDegree = new Map();

    for (const item of items) {
      inDegree.set(item.id, dependsOn.get(item.id).length);

      for (const dep of dependsOn.get(item.id)) {
        if (!mustComeBefore.has(dep)) mustComeBefore.set(dep, []);
        mustComeBefore.get(dep).push(item.id);
      }
    }

    // Start with items that have no dependencies in the import set
    const queue = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const result = [];
    while (queue.length > 0) {
      const id = queue.shift();
      result.push(itemMap.get(id));

      for (const dependent of (mustComeBefore.get(id) || [])) {
        const newDegree = inDegree.get(dependent) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    // Handle cycles: append remaining items (they may fail validation)
    if (result.length < items.length) {
      const resultIds = new Set(result.map(i => i.id));
      for (const item of items) {
        if (!resultIds.has(item.id)) {
          result.push(item);
        }
      }
      console.warn(`[import] Circular dependencies detected - some items may fail validation`);
    }

    return result;
  }

  /** Core kernel — manages storage, events, rendering, and the unified API. */
  class Kernel {
    constructor() {
      this.IDS = IDS;
      this.EVENT_IDS = EVENT_IDS;
      this.storage = new Storage(storageBackend);
      // viewport instance removed - state managed by userland viewport-manager
      this.moduleSystem = new ModuleSystem(this);
      this.rendering = new RenderingSystem(this);
      this.safeMode = new SafeMode(this);
      this.events = new EventBus(this);

      // Initialize module system event listeners for cache invalidation
      this.moduleSystem.initEventListeners();

      // currentRoot removed - managed by userland viewport-manager
      this._safeMode = false;
      this.debugMode = false;

      // Index of item IDs that have watches (for efficient event dispatch)
      this.watcherIndex = new Set();

      this.rootElement = document.createElement('div');
      this.rootElement.id = 'app';
      this.rootElement.innerHTML = '<div id="main-view"></div>';
    }

    /** Initialize the kernel: storage, seed items, event cache, watches, and first render. */
    async boot() {
      const perf = window.hobsonPerf;
      perf?.mark('storage-init-start');
      await this.storage.initialize();
      perf?.mark('storage-init-end');
      perf?.measure('storage-init', 'storage-init-start', 'storage-init-end');

      perf?.mark('seed-items-start');
      await this.ensureSeedItems();
      perf?.mark('seed-items-end');
      perf?.measure('seed-items-check', 'seed-items-start', 'seed-items-end');

      // Check for safe mode and debug mode
      const params = new URLSearchParams(window.location.search);
      this._safeMode = params.get('safe') === '1';
      this.debugMode = params.has('debug');

      // Hardcoded safe-mode escape hatch (Ctrl+Shift+S) - always works even if userland is broken
      if (!window._safeModeShortcut) {
        window._safeModeShortcut = (e) => {
          if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            const params = new URLSearchParams(window.location.search);
            params.set('safe', '1');
            window.location.href = window.location.pathname + '?' + params.toString();
          }
        };
        document.addEventListener('keydown', window._safeModeShortcut);
      }

      if (this._safeMode) {
        // In safe mode, apply styles directly (userland libraries don't run)
        await this.applyStyles();
        this.safeMode.render(this.rootElement.querySelector('#main-view'));
      } else {
        // REPL container is now created by userland repl-ui library via kernel:boot-complete

        // Global error handlers for uncaught errors and promise rejections
        if (!window._globalErrorHandler) {
          window._globalErrorHandler = (event) => {
            window.kernel?.captureError(event.error || new Error(event.message), {
              operation: 'uncaught',
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno
            });
          };
          window.addEventListener('error', window._globalErrorHandler);
        }

        if (!window._unhandledRejectionHandler) {
          window._unhandledRejectionHandler = (event) => {
            const error = event.reason instanceof Error
              ? event.reason
              : new Error(String(event.reason));
            window.kernel?.captureError(error, {
              operation: 'unhandled-rejection'
            });
          };
          window.addEventListener('unhandledrejection', window._unhandledRejectionHandler);
        }

        // Keyboard shortcuts are handled by userland keyboard-shortcuts library
        // Only safe-mode shortcut (Ctrl+Shift+S) remains hardcoded in kernel

        // Popstate handler removed - managed by userland viewport-manager

        // Build event type cache for hierarchical event dispatch (Phase 1 prep)
        perf?.mark('event-cache-start');
        await this.buildEventTypeCache();
        perf?.mark('event-cache-end');
        perf?.measure('event-cache-build', 'event-cache-start', 'event-cache-end');

        // Setup declarative event watches BEFORE first render
        // so error handlers are active during boot
        perf?.mark('watches-start');
        this.setupDeclarativeWatches();
        perf?.mark('watches-end');
        perf?.measure('watches-setup', 'watches-start', 'watches-end');

        // Emit kernel:boot-complete BEFORE rendering so userland libraries
        // (especially viewport-manager) are initialized before any code tries
        // to call navigate() during render
        perf?.mark('boot-complete-emit-start');
        this.events.emit({
          type: EVENT_IDS.SYSTEM_BOOT_COMPLETE,
          content: {
            safeMode: this._safeMode,
            debugMode: this.debugMode,
            lateActivation: false
          }
        });
        perf?.mark('boot-complete-emit-end');
        perf?.measure('boot-complete-emit', 'boot-complete-emit-start', 'boot-complete-emit-end');

        // Render the viewport - viewport-view handles URL reading and root display
        perf?.mark('render-viewport-start');
        await this.renderViewport();
        perf?.mark('render-viewport-end');
        perf?.measure('render-viewport', 'render-viewport-start', 'render-viewport-end');

        // Auto-activate element inspector in debug mode
        if (this.debugMode) {
          try {
            const inspectorModule = await this.moduleSystem.require('element-inspector');
            const api = this.createAPI();
            this._elementInspector = inspectorModule.activate(api);
          } catch (e) {
            console.warn('Could not load element-inspector:', e.message);
          }
        }
      }
    }

    /** Verify seed items exist in storage (warns if missing). */
    async ensureSeedItems() {
      // Check if seeds exist
      try {
        await this.storage.get(IDS.ATOM);
      } catch (e) {
        // Seeds missing - should have been imported via initial-kernel.json
        console.warn('Seed items not found. Please import initial-kernel.json');
      }
    }

    // -------------------------------------------------------------------------
    // Event Type Cache (for hierarchical event dispatch)
    // -------------------------------------------------------------------------

    /** Build a cache mapping event type IDs to their ancestor chains and names.
     * Also builds the watcher index for efficient event dispatch. */
    async buildEventTypeCache() {
      // Build a cache mapping each event definition ID to:
      // - ancestors: Set of all type IDs in the chain (for type hierarchy dispatch)
      // - name: The event's name string (for handler name derivation in declarative watches)
      // This enables O(1) lookups during emit().
      // Also builds the watcher index for efficient event dispatch.
      this.eventTypeCache = new Map();
      this.watcherIndex = new Set();

      try {
        // Load all items once, then do sync lookups (avoids O(N×M) async calls)
        const allItems = await this.storage.getAll();
        const itemMap = new Map(allItems.map(i => [i.id, i]));
        const eventDefs = [];

        for (const item of allItems) {
          if (this._typeChainIncludesSync(item.type, EVENT_IDS.EVENT_DEFINITION, itemMap)) {
            eventDefs.push(item);
          }
          // Also include the event-definition type itself
          if (item.id === EVENT_IDS.EVENT_DEFINITION) {
            eventDefs.push(item);
          }

          // Build watcher index: items with top-level watches array
          if (item.watches && Array.isArray(item.watches) && item.watches.length > 0) {
            this.watcherIndex.add(item.id);
          }
        }

        // For each event definition, compute its full type chain and cache name
        for (const eventDef of eventDefs) {
          const ancestors = this._getTypeChainSync(eventDef.id, itemMap);
          this.eventTypeCache.set(eventDef.id, {
            ancestors: new Set(ancestors),
            name: eventDef.name  // e.g., "item:created", "error-event"
          });
        }
      } catch (e) {
        // If event definitions don't exist yet, cache will be empty
        // This is fine during early boot
        console.debug('Event type cache: no event definitions found yet');
      }
    }

    // Sync version of moduleSystem.typeChainIncludes using pre-loaded itemMap
    _typeChainIncludesSync(typeId, targetId, itemMap) {
      const chain = [];
      let current = typeId;
      const visited = new Set();

      while (current && !visited.has(current)) {
        chain.push(current);
        visited.add(current);
        if (current === IDS.ITEM) break;

        const typeItem = itemMap.get(current);
        if (!typeItem) break;

        if (typeItem.extends) {
          current = typeItem.extends;
        } else {
          if (typeItem.type === IDS.TYPE_DEFINITION) break;
          current = typeItem.type;
        }
      }

      return chain.includes(targetId);
    }

    // Sync version of getTypeChain using pre-loaded itemMap
    _getTypeChainSync(itemId, itemMap) {
      const chain = [itemId];
      let currentId = itemId;
      const visited = new Set();

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const item = itemMap.get(currentId);
        if (!item) break;
        if (item.type && item.type !== currentId) {
          chain.push(item.type);
          currentId = item.type;
        } else {
          break;
        }
      }

      return chain;
    }

    /** Get the full type chain from an item up to atom.
     * @param {string} itemId - Starting item GUID
     * @returns {Promise<string[]>} Array of type GUIDs
     */
    async getTypeChain(itemId) {
      // Returns array of all type IDs from this item up to atom (inclusive)
      const chain = [itemId];
      let currentId = itemId;
      const visited = new Set();

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);

        try {
          const item = await this.storage.get(currentId);
          if (item.type && item.type !== currentId) {
            chain.push(item.type);
            currentId = item.type;
          } else {
            break; // Reached atom (self-referential) or no type
          }
        } catch {
          break; // Item not found
        }
      }

      return chain;
    }

    /** Load and apply kernel CSS styles from the kernel:styles item. */
    async applyStyles() {
      // Remove existing kernel styles if present (allows hot-reload)
      const existing = document.getElementById('kernel-styles');
      if (existing) existing.remove();

      const style = document.createElement('style');
      style.id = 'kernel-styles';

      try {
        const stylesItem = await this.storage.get(IDS.KERNEL_STYLES);
        style.textContent = stylesItem.content.code;
      } catch (e) {
        // Fallback to minimal styles
        style.textContent = `
          * { box-sizing: border-box; }
          html, body { height: 100%; margin: 0; }
          body { font-family: system-ui, sans-serif; padding: 20px; background: #f5f5f5; }
          #app { height: 100%; display: flex; flex-direction: column; }
          #main-view { flex: 1; background: white; border-radius: 8px; padding: 20px; overflow: auto; }
        `;
      }

      document.head.appendChild(style);
    }

    // getStartingRoot() removed - viewport-view reads URL directly
    // navigateToItem() removed - use userland viewport-manager.navigate()

    /** Render the viewport item into #main-view. Re-entrant safe. */
    async renderViewport() {
      const mainView = this.rootElement.querySelector('#main-view');
      if (!mainView) return;

      // Re-entrancy guard: if already rendering, queue a single re-render
      if (this._renderingViewport) {
        this._pendingViewportRender = true;
        return;
      }

      this._renderingViewport = true;
      try {
        do {
          this._pendingViewportRender = false;

          try {
            // Clean up resources in existing DOM tree before removing it
            this.rendering.cleanupDOMTree(mainView);

            // Clear stale render instances before full re-render
            this.rendering.registry.clear();

            // Render the viewport item itself
            // The viewport renderer will show the root or empty state
            const dom = await this.rendering.renderItem(IDS.VIEWPORT);
            mainView.innerHTML = '';
            mainView.appendChild(dom);
          } catch (error) {
            mainView.innerHTML = `
              <div class="render-error">
                <h3>Render Error</h3>
                <pre>${error.message}</pre>
                <pre>${error.stack}</pre>
              </div>
            `;
          }
        } while (this._pendingViewportRender);
      } finally {
        this._renderingViewport = false;
      }
    }

    // renderRoot() removed - renderViewport() handles everything
    // Userland calls api.renderViewport() to trigger re-render

    // -------------------------------------------------------------------------
    // Item List and Raw Editor
    // -------------------------------------------------------------------------

    /** Show the searchable item palette (delegates to userland item-palette if available). */
    async showItemList() {
      // Try userland library first
      try {
        const itemPalette = await this.moduleSystem.require('item-palette');
        if (itemPalette?.show) {
          await itemPalette.show(this.createAPI());
          return;
        }
      } catch {
        // Fall back to kernel implementation
      }

      // Kernel fallback implementation
      this.hideItemList();

      const kernel = this;

      const overlay = document.createElement("div");
      overlay.id = "item-list-overlay";
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 10vh;
        z-index: 10000000;
      `;

      const modal = document.createElement("div");
      modal.style.cssText = `
        background: white;
        border-radius: 8px;
        width: 600px;
        max-width: 90vw;
        max-height: 70vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      `;

      // Search input
      const searchContainer = document.createElement("div");
      searchContainer.style.cssText = "padding: 16px; border-bottom: 1px solid #ddd;";

      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.placeholder = "Search items...";
      searchInput.style.cssText = "width: 100%; padding: 8px 12px; font-size: 16px; border: 1px solid #ddd; border-radius: 4px; outline: none;";
      searchContainer.appendChild(searchInput);
      modal.appendChild(searchContainer);

      // Item list container
      const listContainer = document.createElement("div");
      listContainer.style.cssText = "flex: 1; overflow: auto; padding: 8px;";
      modal.appendChild(listContainer);

      const items = await this.storage.getAll();
      items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

      const renderList = (filter = "") => {
        listContainer.innerHTML = "";
        const filtered = filter
          ? items.filter(i => (i.name || i.id).toLowerCase().includes(filter.toLowerCase()))
          : items;

        for (const item of filtered) {
          const row = document.createElement("div");
          row.style.cssText = "padding: 8px 12px; cursor: pointer; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;";
          row.onmouseenter = () => row.style.background = "#f0f0f0";
          row.onmouseleave = () => row.style.background = "";

          const info = document.createElement("div");
          const name = document.createElement("div");
          name.style.fontWeight = "500";
          name.textContent = item.name || item.id.slice(0, 8);
          info.appendChild(name);

          const typeLine = document.createElement("div");
          typeLine.style.cssText = "font-size: 12px; color: #666;";
          typeLine.textContent = item.type.slice(0, 8);
          info.appendChild(typeLine);

          row.appendChild(info);

          // Click to navigate
          row.onclick = async () => {
            kernel.hideItemList();
            try {
              const vpMgr = await kernel.moduleSystem.require('viewport-manager');
              await vpMgr.navigate(item.id);
            } catch (e) {
              console.error('Navigation failed:', e);
            }
          };

          listContainer.appendChild(row);
        }

        if (filtered.length === 0) {
          const empty = document.createElement("div");
          empty.style.cssText = "padding: 20px; text-align: center; color: #666;";
          empty.textContent = "No items found";
          listContainer.appendChild(empty);
        }
      };

      renderList();

      searchInput.oninput = () => renderList(searchInput.value);

      overlay.appendChild(modal);

      // Close on overlay click
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          kernel.hideItemList();
        }
      };

      // Close on Escape, focus search on open
      const escHandler = (e) => {
        if (e.key === "Escape") {
          kernel.hideItemList();
          document.removeEventListener("keydown", escHandler);
        }
      };
      document.addEventListener("keydown", escHandler);

      document.body.appendChild(overlay);
      searchInput.focus();
    }

    /** Remove the item list overlay if present. */
    hideItemList() {
      const existing = document.getElementById("item-list-overlay");
      if (existing) {
        existing.remove();
      }
    }

    /** Show the keyboard shortcuts help dialog. */
    async showHelp() {
      // Try userland library first
      try {
        const helpDialog = await this.moduleSystem.require('help-dialog');
        if (helpDialog?.show) {
          helpDialog.show();
          return;
        }
      } catch {
        // Fall back to kernel implementation
      }

      // Kernel fallback implementation
      this.hideHelp();

      const overlay = document.createElement("div");
      overlay.id = "help-overlay";
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000000;
      `;

      const modal = document.createElement("div");
      modal.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 400px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      `;

      modal.innerHTML = `
        <h2 style="margin-top: 0; margin-bottom: 16px;">Keyboard Shortcuts</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 16px 8px 0;"><kbd style="background: #f0f0f0; padding: 2px 8px; border-radius: 3px; border: 1px solid #ccc;">Ctrl+\\</kbd></td><td>Toggle REPL</td></tr>
          <tr><td style="padding: 8px 16px 8px 0;"><kbd style="background: #f0f0f0; padding: 2px 8px; border-radius: 3px; border: 1px solid #ccc;">Cmd+K</kbd></td><td>Search items</td></tr>
          <tr><td style="padding: 8px 16px 8px 0;"><kbd style="background: #f0f0f0; padding: 2px 8px; border-radius: 3px; border: 1px solid #ccc;">Ctrl+E</kbd></td><td>Edit selected item</td></tr>
          <tr><td style="padding: 8px 16px 8px 0;"><kbd style="background: #f0f0f0; padding: 2px 8px; border-radius: 3px; border: 1px solid #ccc;">Cmd+?</kbd></td><td>Show this help</td></tr>
        </table>
        <h3 style="margin-top: 20px; margin-bottom: 12px;">Mouse</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 16px 8px 0;">Right-click</td><td>Context menu</td></tr>
          <tr><td style="padding: 8px 16px 8px 0;">Shift+Right-click</td><td>Browser menu</td></tr>
        </table>
        <div style="margin-top: 20px; text-align: right;">
          <button onclick="window.kernel.hideHelp()" style="padding: 8px 16px; cursor: pointer;">Close</button>
        </div>
      `;

      overlay.appendChild(modal);

      overlay.onclick = (e) => {
        if (e.target === overlay) {
          this.hideHelp();
        }
      };

      const escHandler = (e) => {
        if (e.key === "Escape") {
          this.hideHelp();
          document.removeEventListener("keydown", escHandler);
        }
      };
      document.addEventListener("keydown", escHandler);

      document.body.appendChild(overlay);
    }

    /** Remove the help overlay if present. */
    hideHelp() {
      const existing = document.getElementById("help-overlay");
      if (existing) {
        existing.remove();
      }
    }

    /** Open an inline or full-page raw JSON editor for an item.
     * @param {string} itemId - Item GUID to edit
     */
    async editItemRaw(itemId) {
      const item = await this.storage.get(itemId);
      const json = JSON.stringify(item, null, 2);

      // Try inline editing first
      const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
      const isInline = !!itemElement;

      // Create editor UI
      const container = document.createElement("div");
      container.className = "raw-editor";
      container.style.cssText = isInline
        ? "height: 100%; display: flex; flex-direction: column;"
        : "max-width: 800px; margin: 20px auto; padding: 20px; display: flex; flex-direction: column;";

      const heading = document.createElement("h2");
      heading.textContent = `Editing: ${item.name || item.id}`;
      heading.style.cssText = "margin: 0 0 10px 0; font-size: 16px;";
      container.appendChild(heading);

      const textarea = document.createElement("textarea");
      textarea.id = "raw-json";
      textarea.value = json;
      textarea.style.cssText = "flex: 1; min-height: 300px; font-family: monospace; font-size: 13px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; resize: vertical;";
      container.appendChild(textarea);

      const actions = document.createElement("div");
      actions.className = "actions";
      actions.style.cssText = "display: flex; gap: 10px; margin-top: 10px;";

      const kernel = this;

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "Save";
      saveBtn.style.cssText = "padding: 8px 16px; cursor: pointer;";
      saveBtn.onclick = async () => {
        try {
          const updated = JSON.parse(textarea.value);
          await kernel.saveItem(updated);

          // Clear cache if code item
          if (await kernel.isCodeItem(updated)) {
            kernel.moduleSystem.clearCache();
          }

          // Return to previous view
          await kernel.renderViewport();
        } catch (error) {
          alert(`Error: ${error.message}`);
        }
      };
      actions.appendChild(saveBtn);

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText = "padding: 8px 16px; cursor: pointer;";
      cancelBtn.onclick = async () => {
        // Return to previous view
        await kernel.renderViewport();
      };
      actions.appendChild(cancelBtn);

      container.appendChild(actions);

      if (isInline) {
        // Inline mode: replace item content
        const originalStyles = itemElement.style.cssText;
        itemElement.innerHTML = "";
        itemElement.style.cssText = originalStyles + " padding: 15px; overflow: auto;";
        itemElement.appendChild(container);
      } else {
        // Full page mode
        const mainView = this.rootElement.querySelector('#main-view');
        mainView.innerHTML = "";
        mainView.appendChild(container);
      }
    }

    /** Download an object as a JSON file.
     * @param {*} thing - Object to serialize
     * @param {string} filename - Download filename
     */
    saveJson(thing, filename) {
        const json = JSON.stringify(thing, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    /** Export all items as JSON download(s).
     * @param {boolean} [singleFile=true] - Single backup file or one per item
     * @returns {Promise<number>} Number of items exported
     */
    async export(singleFile = true) {
        console.log("api.export:", singleFile);
        const items = await this.storage.getAllRaw();
        if (singleFile) {
          this.saveJson(items, `backup-${Date.now()}.json`);
        } else {
          for (const item of items) {
            this.saveJson(item, `${item.id}.json`);
          }
        }

        return items.length;
    }

    // -------------------------------------------------------------------------
    // Unified API
    // -------------------------------------------------------------------------

    /** Create the unified API object. When containerItem is provided, adds context-specific methods.
     * @param {Object|null} [containerItem] - The item being rendered (adds context methods)
     * @param {Object} [context] - Render context (parentId, viewId, viewConfig, etc.)
     * @returns {Object} The API object
     */
    createAPI(containerItem = null, context = {}) {
      const kernel = this;
      const rendering = this.rendering;

      const api = {
        /** Create a DOM element with JSX-like syntax.
         * @param {string} tag - HTML tag name
         * @param {Object} [props] - Attributes, event handlers (onXxx), class, style
         * @param {Array} [children] - Child nodes, strings, or [tag, props, children] arrays
         * @returns {HTMLElement}
         */
        createElement(tag, props = {}, children = []) {
          const element = document.createElement(tag);

          // Debug attribution (only when containerItem present)
          if (containerItem) {
            const debugActive = context.debug || kernel.debugMode;
            if (debugActive) {
              if (context.viewId) {
                element.setAttribute('data-view-id', context.viewId);
              }
              element.setAttribute('data-for-item', containerItem.id);
              try {
                const stack = new Error().stack;
                const location = rendering.parseSourceLocation(stack);
                if (location) {
                  element.setAttribute('data-source', location.itemName);
                  element.setAttribute('data-source-line', String(location.line));
                }
              } catch (e) { /* ignore */ }
            }
          }

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

        // --- Storage operations ---

        /** Retrieve an item by ID from storage.
         * @param {string} id - Item GUID
         * @returns {Promise<Object>} The item
         */
        get: (id) => kernel.storage.get(id),

        /** Save or insert an item. Emits item:created or item:updated events.
         * @param {Object} item - The item to save (must have an id)
         * @param {Object} [options] - Save options
         * @param {boolean} [options.silent] - If true, suppress events and re-render
         * @returns {Promise<string>} The item's id
         */
        set: async (item, options) => {
          await kernel.saveItem(item, options);
          return item.id;
        },
        /** Save an item and re-render the viewport.
         * @param {Object} item - The item to save
         * @returns {Promise<string>} The item's id
         */
        update: async (item) => {
          await kernel.saveItem(item);
          await kernel.renderViewport();
          return item.id;
        },

        /** Save without events or re-render (for layout/position saves).
         * @deprecated Use set(item, {silent: true}) instead
         * @param {Object} item - The item to save
         * @returns {Promise<string>} The item's id
         */
        updateSilent: async (item) => {
          await kernel.saveItem(item, { silent: true });
          return item.id;
        },

        /** Delete an item, detaching from all parents. Emits item:deleted.
         * @param {string} id - Item GUID to delete
         */
        delete: (id) => kernel.deleteItem(id),

        /** Batch-delete all items whose ID starts with prefix.
         * Skips per-item events — does one cache clear + render at the end.
         * @param {string} prefix - ID prefix to match (e.g., nested instance prefix)
         * @returns {Promise<number>} Number of items deleted
         */
        deleteByPrefix: async (prefix) => {
          const count = await kernel.storage.deleteByPrefix(prefix);
          if (count > 0) {
            kernel.moduleSystem.clearCache();
            await kernel.renderViewport();
          }
          return count;
        },
        /** Find items matching a filter object (key-value pairs matched against item fields).
         * @param {Object} filter - Filter object, e.g. {type: "...", name: "..."}
         * @returns {Promise<Object[]>} Matching items
         */
        query: (filter) => kernel.storage.query(filter),

        /** Get all items (excludes nested instance items).
         * @returns {Promise<Object[]>}
         */
        getAll: () => kernel.storage.getAll(),

        /** Get all items including nested instance items.
         * @returns {Promise<Object[]>}
         */
        getAllRaw: () => kernel.storage.getAllRaw(),

        // --- Code operations ---

        /** Load a library or code module by name or ID.
         * @param {string} name - Item name (e.g. 'markdown-it') or GUID
         * @returns {Promise<Object>} The module's exports
         */
        require: (name) => kernel.moduleSystem.require(name),

        /** Check if a type's inheritance chain includes a target type.
         * @param {string} typeId - The type to check
         * @param {string} targetId - The target type to look for in the chain
         * @returns {Promise<boolean>}
         */
        typeChainIncludes: (typeId, targetId) => kernel.moduleSystem.typeChainIncludes(typeId, targetId),

        // --- Rendering operations ---

        /** Render an item as a DOM element using a specific view.
         * @param {string} itemId - Item GUID to render
         * @param {string|Object|null} [viewIdOrConfig] - View GUID, config object {type, ...}, or null for default
         * @param {Object} [options] - Render options (decorator, siblingContainer, navigateTo, onCycle)
         * @returns {Promise<HTMLElement>}
         */
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
          const siblingContainer = options?.siblingContainer !== undefined
            ? options.siblingContainer
            : context.siblingContainer;
          const navigateTo = options?.navigateTo !== undefined
            ? options.navigateTo
            : context.navigateTo;
          const mergedContext = {
            ...context,
            decorator,
            viewConfig,
            parentId: containerItem ? containerItem.id : null,
            siblingContainer,
            navigateTo
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

        /** Re-render all visible instances of an item in place.
         * @param {string} itemId - Item GUID to re-render
         */
        rerenderItem: (itemId) => rendering.rerenderItem(itemId),

        /** Re-render all items currently using a specific view.
         * @param {string} viewId - View GUID
         */
        rerenderByView: (viewId) => rendering.rerenderByView(viewId),

        /** Re-render all items of a specific type (that don't have their own preferred view).
         * @param {string} typeId - Type GUID
         */
        rerenderByType: (typeId) => rendering.rerenderByType(typeId),

        /** Trigger a full viewport re-render. */
        renderViewport: () => kernel.renderViewport(),

        // --- View discovery ---

        /** Get all available views for a type (including inherited from extends chain).
         * @param {string} typeId - Type GUID
         * @returns {Promise<Array<{view, forType, inherited, isDefault?}>>}
         */
        getViews: (typeId) => rendering.getViews(typeId),

        /** Get the first view found for a type.
         * @param {string} typeId - Type GUID
         * @returns {Promise<Object|null>} The view item, or null
         */
        getDefaultView: (typeId) => rendering.getDefaultView(typeId),

        /** Find a renderable view for a type, walking the extends chain.
         * @param {string} typeId - Type GUID
         * @returns {Promise<Object>} The view item (falls back to default-view)
         */
        findView: (typeId) => rendering.findView(typeId),

        /** Get the view that would be used for a specific item (respects preferred view hierarchy).
         * @param {string} itemId - Item GUID
         * @returns {Promise<Object>} The resolved view item
         */
        getEffectiveView: (itemId) => rendering.getEffectiveView(itemId),

        /** Get the view configured by a parent's attachment spec for a child item.
         * @param {string} itemId - Child item GUID
         * @param {string} parentId - Parent item GUID
         * @returns {Promise<string|null>} View GUID from parent's attachment config, or null
         */
        getContextualView: async (itemId, parentId) => {
          if (!parentId) return null;
          try {
            const parent = await kernel.storage.get(parentId);
            const childSpec = parent.attachments?.find(c =>
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
        /** Get the human-readable type name for an item.
         * @param {string} itemId - Item GUID
         * @returns {Promise<string>} Type name or truncated GUID
         */
        getTypeName: async (itemId) => {
          const item = await kernel.storage.get(itemId);
          const typeItem = await kernel.storage.get(item.type);
          return typeItem.name || typeItem.id.slice(0, 8);
        },

        // --- Preferred view management ---

        /** Set an item's preferred view. Pass null to clear.
         * @param {string} itemId - Item GUID
         * @param {string|null} viewId - View GUID, or null to clear
         */
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
          if (item.type === IDS.TYPE_DEFINITION) {
            await rendering.rerenderByType(itemId);
          } else {
            await rendering.rerenderItem(itemId);
          }
        },
        /** Get an item's preferred view.
         * @param {string} itemId - Item GUID
         * @returns {Promise<string|null>} View GUID or null
         */
        getPreferredView: async (itemId) => {
          const item = await kernel.storage.get(itemId);
          return item.preferredView || null;
        },

        /** Set the preferred view for an item's type. Affects all items of that type.
         * @param {string} itemId - Any item of the type to update
         * @param {string|null} viewId - View GUID, or null to clear
         */
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
        /** Get the preferred view for an item's type.
         * @param {string} itemId - Any item of the type to query
         * @returns {Promise<string|null>} View GUID or null
         */
        getTypePreferredView: async (itemId) => {
          const item = await kernel.storage.get(itemId);
          const typeItem = await kernel.storage.get(item.type);
          return typeItem.preferredView || null;
        },

        // --- Parent-child operations (arity-detecting) ---

        /** Attach a child item to a parent.
         * 1-arg form (in view context): attach(itemId) — uses containerItem as parent.
         * 2-arg form: attach(parentId, itemId).
         * @param {...string} args - (itemId) or (parentId, itemId)
         */
        attach: async (...args) => {
          if (args.length === 1 && containerItem) {
            // 1-param: attach(itemId) — uses containerItem
            await kernel.attach(containerItem.id, args[0]);
          } else {
            // 2-param: attach(parentId, itemId) — explicit
            await kernel.attach(args[0], args[1]);
          }
        },
        /** Detach a child from a parent.
         * 1-arg form (in view context): detach(itemId) — uses containerItem as parent.
         * 2-arg form: detach(parentId, itemId).
         * @param {...string} args - (itemId) or (parentId, itemId)
         */
        detach: async (...args) => {
          if (args.length === 1 && containerItem) {
            // 1-param: detach(itemId) — uses containerItem
            await kernel.detach(containerItem.id, args[0]);
          } else {
            // 2-param: detach(parentId, itemId) — explicit
            await kernel.detach(args[0], args[1]);
          }
        },
        /** Set the view config for an attachment.
         * 2-arg form (in view context): setAttachmentView(itemId, viewId).
         * 3-arg form: setAttachmentView(parentId, itemId, viewId).
         * @param {...string} args - (itemId, viewId) or (parentId, itemId, viewId)
         */
        setAttachmentView: async (...args) => {
          if (args.length === 2 && containerItem) {
            // 2-param: setAttachmentView(itemId, viewId) — uses containerItem
            await kernel.setAttachmentView(containerItem.id, args[0], args[1]);
          } else {
            // 3-param: setAttachmentView(parentId, itemId, viewId)
            await kernel.setAttachmentView(args[0], args[1], args[2]);
          }
        },
        /** Find the parent item that contains a given item in its attachments.
         * @param {string} itemId - Child item GUID
         * @returns {Promise<Object|null>} The parent item, or null if not attached
         */
        findContainerOf: (itemId) => kernel.findContainerOf(itemId),

        /** Check if attaching an item as a child would create a cycle.
         * @param {string} parentId - Prospective parent GUID
         * @param {string} attachmentId - Prospective child GUID
         * @returns {Promise<boolean>}
         */
        wouldCreateCycle: (parentId, attachmentId) => kernel.wouldCreateCycle(parentId, attachmentId),

        /** Check if an item's descendant graph contains any cycles.
         * @param {string} itemId - Item GUID to check
         * @returns {Promise<boolean>}
         */
        hasCycle: (itemId) => kernel.hasCycle(itemId),

        // --- Navigation ---

        /** Navigate to an item, updating the URL and re-rendering the viewport.
         * @param {string} id - Item GUID to navigate to
         * @param {Object} [params] - URL parameters to set
         */
        navigate: async (id, params) => {
          const vpMgr = await kernel.moduleSystem.require('viewport-manager');
          return vpMgr.navigate(id, params);
        },
        /** Open an item contextually: as a sibling if inside a container, otherwise navigate.
         * @param {string} id - Item GUID to open
         * @param {Object} [navigateTo] - Scroll target hint (field, symbol, line, region)
         */
        openItem: async (id, navigateTo) => {
          if (context.siblingContainer) {
            await context.siblingContainer.addSibling(id, navigateTo);
            const selMgr = await kernel.moduleSystem.require('selection-manager');
            selMgr.select(id, context.siblingContainer.id);
          } else {
            const vpMgr = await kernel.moduleSystem.require('viewport-manager');
            await vpMgr.navigate(id, navigateTo);
          }
        },
        /** Get the current viewport root item ID.
         * @returns {string|null} Root item GUID, or null
         */
        getCurrentRoot: () => {
          const vpMgr = kernel.moduleSystem.getCached('viewport-manager');
          return vpMgr?.getRoot() || null;
        },

        // --- Import/Export ---

        /** Export all items as JSON download(s).
         * @param {boolean} [singleFile=true] - If true, one backup file; if false, one file per item
         * @returns {Promise<number>} Number of items exported
         */
        export: async (singleFile = true) => {
          console.log("api.export:", singleFile);
          return kernel.export(singleFile);
        },
        /** Import items from JSON file(s) with smart refresh.
         * Opens a file picker, then imports items with dependency-order sorting.
         * @returns {Promise<{created: number, updated: number, skipped: number, action: string}>}
         */
        import: async () => {
          return new Promise((resolve, reject) => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.setAttribute("multiple", "");
            input.onchange = async (e) => {
              const files = Array.from(e.target.files);
              if (files.length === 0) {
                reject(new Error("No file selected"));
                return;
              }

              try {
                // Combine items from all selected files
                let items = [];
                for (const file of files) {
                  const text = await file.text();
                  const data = JSON.parse(text);
                  const fileItems = Array.isArray(data) ? data : [data];
                  items = items.concat(fileItems);
                }

                // Sort items in dependency order (types/extends before their dependents)
                items = sortItemsForImport(items);

                let created = 0;
                let updated = 0;
                let skipped = 0;

                for (const item of items) {
                  if (!item.id) {
                    item.id = crypto.randomUUID();
                  }

                  try {
                    const exists = await kernel.storage.exists(item.id);

                    // Ensure created timestamp for new items
                    if (!exists && !item.created) item.created = Date.now();

                    await kernel.saveItem(item);

                    // Clear module cache if it's a code item
                    if (await kernel.isCodeItem(item)) {
                      kernel.moduleSystem.clearCache();
                    }

                    if (exists) {
                      updated++;
                    } else {
                      created++;
                    }
                  } catch (error) {
                    console.warn(`Failed to import item ${item.id}: ${error.message}`);
                    skipped++;
                  }
                }

                // Smart refresh based on what was imported
                const result = { created, updated, skipped };

                // Check for kernel modules - requires full reload
                const hasKernelModule = items.some(i => i.type === IDS.KERNEL_MODULE);
                if (hasKernelModule) {
                  result.action = 'reload';
                  resolve(result);
                  kernel.reloadKernel();
                  return;
                }

                // Check for styles - hot-reload CSS
                const hasStyles = items.some(i => i.id === IDS.KERNEL_STYLES);
                if (hasStyles) {
                  await kernel.applyStyles();
                }

                // Check for libraries - requires full re-render (dependencies not tracked)
                const hasLibrary = items.some(i => i.type === IDS.LIBRARY);
                if (hasLibrary) {
                  result.action = 'full-rerender';
                  await kernel.renderViewport();
                  resolve(result);
                  return;
                }

                // Check for views - partial re-render for each
                const viewItems = items.filter(i => i.type === IDS.VIEW);
                for (const viewItem of viewItems) {
                  await kernel.rendering.rerenderByView(viewItem.id);
                }

                // For data items, re-render if currently visible
                const codeTypes = [IDS.VIEW, IDS.LIBRARY, IDS.KERNEL_MODULE];
                const dataItems = items.filter(i =>
                  !codeTypes.includes(i.type) && i.id !== IDS.KERNEL_STYLES
                );
                for (const item of dataItems) {
                  const instances = kernel.rendering.registry.getByItemId(item.id);
                  if (instances.length > 0) {
                    await kernel.rendering.rerenderItem(item.id);
                  }
                }

                result.action = viewItems.length > 0 || dataItems.length > 0
                  ? 'partial-rerender'
                  : (hasStyles ? 'styles-only' : 'none');
                resolve(result);
              } catch (error) {
                reject(error);
              }
            };
            input.click();
          });
        },

        /** Event system — subscribe, unsubscribe, emit, and list events. */
        events: {
          /** Subscribe to an event type. Returns an unsubscribe function.
           * @param {string} eventTypeId - Event type GUID
           * @param {Function} handler - Called with {type, content, timestamp}
           * @returns {Function} Unsubscribe function
           */
          on: (eventTypeId, handler) => kernel.events.on(eventTypeId, handler),

          /** Unsubscribe a handler from an event type.
           * @param {string} eventTypeId - Event type GUID
           * @param {Function} handler - The handler to remove
           */
          off: (eventTypeId, handler) => kernel.events.off(eventTypeId, handler),

          /** Emit an event to all matching subscribers.
           * @param {Object} event - {type: eventTypeGUID, content: {...}}
           */
          emit: (event) => kernel.events.emit(event),

          /** List all event type GUIDs that have active listeners.
           * @returns {string[]}
           */
          list: () => kernel.events.getRegisteredEvents()
        },

        /** Render instance registry — query what's currently rendered on screen. */
        instances: {
          /** Get all render instances for an item.
           * @param {string} itemId - Item GUID
           * @returns {Array} Instance info objects
           */
          getByItemId: (itemId) => rendering.registry.getByItemId(itemId),

          /** Get all render instances using a specific view.
           * @param {string} viewId - View GUID
           * @returns {Array} Instance info objects
           */
          getByViewId: (viewId) => rendering.registry.getByViewId(viewId),

          /** Get a specific render instance by ID.
           * @param {number} instanceId - Instance ID
           * @returns {Object|null} Instance info or null
           */
          get: (instanceId) => rendering.registry.get(instanceId),

          /** Get all render instances.
           * @returns {Array} All instance info objects
           */
          getAll: () => rendering.registry.getAll(),

          /** Get a summary of render state (counts of instances, items, views, parents).
           * @returns {{totalInstances, uniqueItems, uniqueViews, uniqueParents}}
           */
          getSummary: () => rendering.registry.getSummary(),

          /** Clear all render instances. */
          clear: () => rendering.registry.clear()
        },

        // --- UI operations ---

        /** Open the raw JSON editor for an item.
         * @param {string} itemId - Item GUID to edit
         */
        editRaw: (itemId) => kernel.editItemRaw(itemId),

        /** Show the searchable item palette. */
        showItemList: () => kernel.showItemList(),

        /** Create a context-free API object (for REPL use).
         * @returns {Object} API without containerItem context
         */
        createREPLContext: () => kernel.createAPI(),

        /** Well-known item GUIDs (ITEM, TYPE_DEFINITION, CODE, VIEW, etc.). */
        IDS,

        /** Well-known event type GUIDs (ITEM_CREATED, ITEM_UPDATED, SYSTEM_ERROR, etc.). */
        EVENT_IDS,

        /** Get the nested instance ID (null for main instance).
         * @returns {string|null}
         */
        getInstanceId: () => kernel.storage.instanceId,

        /** Check if debug mode is active.
         * @returns {boolean}
         */
        isDebugMode: () => context.debug || kernel.debugMode,

        /** Convenience helpers for common item operations. */
        helpers: {
          /** Find an item by name.
           * @param {string} name - Item name to search for
           * @returns {Promise<Object|null>} The first matching item, or null
           */
          findByName: async (name) => {
            const items = await kernel.storage.query({ name });
            return items.length > 0 ? items[0] : null;
          },
          /** List all items of a given type.
           * @param {string} typeId - Type GUID
           * @returns {Promise<Object[]>}
           */
          listByType: async (typeId) => {
            return await kernel.storage.query({ type: typeId });
          },

          /** Create a new type definition item.
           * @param {string} name - Type name
           * @param {string} [description] - Type description
           * @returns {Promise<string>} The new type's GUID
           */
          createType: async (name, description) => {
            const id = crypto.randomUUID();
            await kernel.saveItem({
              id,
              name,
              type: IDS.TYPE_DEFINITION,
              attachments: [],
              content: { description }
            });
            return id;
          }
        },

        /** Viewport state — selection, root item, root view management. */
        viewport: {
          /** Select an item in the viewport.
           * @param {string} itemId - Item GUID to select
           * @param {string} [parentId] - Parent context for the selection
           */
          select: async (itemId, parentId) => {
            const selMgr = await kernel.moduleSystem.require('selection-manager');
            selMgr.select(itemId, parentId);
          },
          /** Clear the current selection. */
          clearSelection: async () => {
            const selMgr = await kernel.moduleSystem.require('selection-manager');
            selMgr.clearSelection();
          },
          /** Get the currently selected item ID.
           * @returns {string|null}
           */
          getSelection: () => {
            const selMgr = kernel.moduleSystem.getCached('selection-manager');
            return selMgr?.getSelection() || null;
          },
          /** Get the parent context of the current selection.
           * @returns {string|null}
           */
          getSelectionParent: () => {
            const selMgr = kernel.moduleSystem.getCached('selection-manager');
            return selMgr?.getSelectionParent() || null;
          },
          /** Get the current viewport root item ID from the URL.
           * @returns {string|null}
           */
          getRoot: () => {
            const params = new URLSearchParams(window.location.search);
            return params.get('root');
          },
          /** Get the current root view GUID.
           * @returns {Promise<string|null>}
           */
          getRootView: async () => {
            const vpMgr = await kernel.moduleSystem.require('viewport-manager');
            return await vpMgr.getRootView();
          },
          /** Set the root view for the current viewport root.
           * @param {string} viewId - View GUID to set
           */
          setRootView: async (viewId) => {
            const vpMgr = await kernel.moduleSystem.require('viewport-manager');
            await vpMgr.setRootView(viewId);
          },
          /** Get the full view config object for the root item.
           * @returns {Promise<Object|null>}
           */
          getRootViewConfig: async () => {
            const vpMgr = await kernel.moduleSystem.require('viewport-manager');
            return await vpMgr.getRootViewConfig();
          },
          /** Merge updates into the root view config.
           * @param {Object} updates - Key-value pairs to merge
           */
          updateRootViewConfig: async (updates) => {
            const vpMgr = await kernel.moduleSystem.require('viewport-manager');
            await vpMgr.updateRootViewConfig(updates);
          },
          /** Restore the previous root view (undo the last setRootView).
           * @returns {Promise<boolean>} True if a previous view was restored
           */
          restorePreviousRootView: async () => {
            const vpMgr = await kernel.moduleSystem.require('viewport-manager');
            return await vpMgr.restorePreviousRootView();
          }
        }
      };

      // --- Context layer (only when containerItem provided) ---
      if (containerItem) {
        /** Get the view config for this item (from parent's attachment spec or viewport).
         * @returns {Promise<Object|null>} View config object or null
         */
        api.getViewConfig = async () => {
          if (context.viewConfig) {
            return context.viewConfig;
          }
          if (context.parentId === IDS.VIEWPORT) {
            const vpMgr = await kernel.moduleSystem.require('viewport-manager');
            if (vpMgr.getRoot() === containerItem.id) {
              return await vpMgr.getRootViewConfig();
            }
          }
          return null;
        };

        /** Update the view config for this item (merges into parent's attachment spec).
         * @param {Object} updates - Key-value pairs to merge into the config
         * @returns {Promise<boolean>} True if update succeeded
         */
        api.updateViewConfig = async (updates) => {
          const parentId = context.parentId;

          if (parentId === IDS.VIEWPORT) {
            const vpMgr = await kernel.moduleSystem.require('viewport-manager');
            if (vpMgr.getRoot() === containerItem.id) {
              await vpMgr.updateRootViewConfig(updates);
              return true;
            }
          }

          if (!parentId) {
            console.warn('updateViewConfig: no parent ID in context');
            return false;
          }

          const parent = await kernel.storage.get(parentId);
          const childIndex = parent.attachments?.findIndex(c => c.id === containerItem.id);
          if (childIndex < 0) {
            console.warn('updateViewConfig: item not found in parent attachments');
            return false;
          }

          const currentChild = parent.attachments[childIndex];
          parent.attachments[childIndex] = {
            ...currentChild,
            view: { ...(currentChild.view || {}), ...updates }
          };
          parent.modified = Date.now();

          await kernel.saveItem(parent);
          return true;
        };

        /** Get the parent item ID in the current render context.
         * @returns {string|null}
         */
        api.getParentId = () => context.parentId || null;

        /** Get the view ID used to render this item.
         * @returns {string|null}
         */
        api.getViewId = () => context.viewId || null;

        /** Get the navigateTo target (item GUID to navigate on click, set by parent).
         * @returns {string|null}
         */
        api.getNavigateTo = () => context.navigateTo || null;

        /** Get the item being rendered.
         * @returns {Object} The container item
         */
        api.getCurrentItem = () => containerItem;

        Object.defineProperty(api, 'siblingContainer', {
          get: () => context.siblingContainer || null
        });

        /** Create a new item, optionally attaching it as a child of the current item.
         * @param {Object} item - Item data (id auto-generated if missing)
         * @param {boolean} [addAsChild=false] - If true, attach to current item
         * @returns {Promise<string>} The new item's GUID
         */
        api.create = async (item, addAsChild = false) => {
          const newItem = {
            ...item,
            id: item.id || crypto.randomUUID(),
            attachments: item.attachments || []
          };

          await kernel.saveItem(newItem);

          if (addAsChild) {
            await kernel.attach(containerItem.id, newItem.id);
          }

          return newItem.id;
        };

        /** Create a child item of a given type, attach it, and re-render.
         * @param {string} type - Type GUID for the new item
         * @param {Object} [content] - Initial content for the new item
         * @returns {Promise<string>} The new item's GUID
         */
        api.createChild = async (type, content = {}) => {
          const newItem = {
            type,
            content,
            attachments: []
          };
          const id = await api.create(newItem, true);
          await kernel.renderViewport();
          return id;
        };

        /** Restore the previous view for an item (undo setAttachmentView or setRootView).
         * @param {string} itemId - Item GUID to restore
         * @returns {Promise<boolean>} True if a previous view was restored
         */
        api.restorePreviousView = async (itemId) => {
          const vpMgr = kernel.moduleSystem.getCached('viewport-manager');
          const isViewportRoot = vpMgr && vpMgr.getRoot() === itemId;

          if (isViewportRoot) {
            if (vpMgr.restorePreviousRootView) {
              const restored = await vpMgr.restorePreviousRootView();
              if (restored) {
                await kernel.renderViewport();
                return true;
              }
            }
            if (await vpMgr.getRootView()) {
              await vpMgr.setRootView(null, false);
              await kernel.renderViewport();
              return true;
            }
            return false;
          }

          const renderingParentId = context.parentId;
          const parent = renderingParentId
            ? await kernel.storage.get(renderingParentId)
            : await kernel.findContainerOf(itemId);
          if (!parent) {
            return false;
          }

          const childIndex = parent.attachments.findIndex(c => c.id === itemId);
          if (childIndex < 0) return false;

          const childSpec = parent.attachments[childIndex];
          if (childSpec.previousView) {
            parent.attachments[childIndex] = {
              ...childSpec,
              view: { ...childSpec.previousView },
              previousView: undefined
            };
          } else if (childSpec.view && 'type' in childSpec.view) {
            const { type, ...viewWithoutType } = childSpec.view;
            parent.attachments[childIndex] = {
              ...childSpec,
              view: Object.keys(viewWithoutType).length > 0 ? viewWithoutType : undefined,
              previousView: undefined
            };
          } else {
            return false;
          }
          await kernel.saveItem(parent);
          await kernel.renderViewport();
          return true;
        };
      }

      return api;
    }

    // -------------------------------------------------------------------------
    // Parent-child operations
    // -------------------------------------------------------------------------

    /** Attach a child item to a parent's attachments array.
     * @param {string} parentId - Parent item GUID
     * @param {string} itemId - Child item GUID to attach
     */
    async attach(parentId, itemId) {
      // Note: Cycles are now allowed in the item graph.
      // Cycle detection happens at render time, not at data modification time.
      // Use wouldCreateCycle() if you want to check/warn before adding.

      const parent = await this.storage.get(parentId);
      if (!parent.attachments) parent.attachments = [];

      // Check if child already exists
      if (parent.attachments.some(c => c.id === itemId)) {
        return; // Already a child
      }

      // Append minimal child object - views add layout properties as needed
      const updated = {
        ...parent,
        attachments: [...parent.attachments, { id: itemId }]
      };

      // Save silently without triggering re-render
      await this.saveItem(updated, { silent: true });
    }

    /** Detach a child item from a parent's attachments array.
     * @param {string} parentId - Parent item GUID
     * @param {string} itemId - Child item GUID to detach
     */
    async detach(parentId, itemId) {
      const parent = await this.storage.get(parentId);
      const updated = {
        ...parent,
        attachments: parent.attachments.filter(c => c.id !== itemId)
      };
      // Save silently without triggering re-render (consistent with attach)
      await this.saveItem(updated, { silent: true });
    }

    /** Set the view type for an attachment, preserving previous view for undo.
     * @param {string} parentId - Parent item GUID
     * @param {string} itemId - Child item GUID
     * @param {string} viewId - View GUID to set
     */
    async setAttachmentView(parentId, itemId, viewId) {
      const parent = await this.storage.get(parentId);
      const childIndex = parent.attachments.findIndex(c => c.id === itemId);

      if (childIndex < 0) {
        const error = new Error(`Item ${itemId} not found in container ${parentId}`);
        await this.captureError(error, {
          operation: 'setAttachmentView',
          itemId: parentId,
          itemId: itemId
        });
        throw error;
      }

      // Update the child's view - preserve existing view properties, change type
      const updatedAttachments = [...parent.attachments];
      const currentChild = updatedAttachments[childIndex];
      const currentView = currentChild.view;
      
      // Store previous view (complete snapshot)
      const newChild = {
        ...currentChild,
        previousView: currentView ? { ...currentView } : null,
        view: { ...(currentView || {}), type: viewId }
      };
      updatedAttachments[childIndex] = newChild;

      const updated = {
        ...parent,
        attachments: updatedAttachments
      };

      await this.saveItem(updated);
    }

    /** Find the parent item that contains a given item in its attachments.
     * @param {string} itemId - Child item GUID
     * @returns {Promise<Object|null>} The parent item, or null
     */
    async findContainerOf(itemId) {
      const allItems = await this.storage.getAll();
      for (const item of allItems) {
        if (item.attachments && item.attachments.some(c => c.id === itemId)) {
          return item;
        }
      }
      return null;
    }

    /** Check if attaching newChildId under parentId would create a cycle.
     * @param {string} parentId - Prospective parent
     * @param {string} newChildId - Prospective child
     * @returns {Promise<boolean>}
     */
    async wouldCreateCycle(parentId, newChildId) {
      const canReach = async (fromId, toId, visited = new Set()) => {
        if (fromId === toId) return true;
        if (visited.has(fromId)) return false;

        visited.add(fromId);

        try {
          const item = await this.storage.get(fromId);
          for (const child of (item.attachments || [])) {
            if (await canReach(child.id, toId, visited)) {
              return true;
            }
          }
        } catch {
          // Item doesn't exist
        }

        return false;
      };

      return await canReach(newChildId, parentId);
    }

    /** Check if an item's descendant graph contains any cycles.
     * @param {string} itemId - Item GUID to check
     * @returns {Promise<boolean>}
     */
    async hasCycle(itemId) {
      const visited = new Set();
      const recursionStack = new Set();

      const detectCycle = async (id) => {
        if (recursionStack.has(id)) {
          return true; // Found a cycle
        }
        if (visited.has(id)) {
          return false; // Already fully explored this branch
        }

        visited.add(id);
        recursionStack.add(id);

        try {
          const item = await this.storage.get(id);
          for (const child of (item.attachments || [])) {
            if (await detectCycle(child.id)) {
              return true;
            }
          }
        } catch {
          // Item doesn't exist
        }

        recursionStack.delete(id);
        return false;
      };

      return await detectCycle(itemId);
    }

    /** Delete an item: detach from all parents, remove from storage, emit item:deleted.
     * @param {string} itemId - Item GUID to delete
     */
    async deleteItem(itemId) {
      // Protect seed items from deletion
      const seedIds = Object.values(IDS);
      if (seedIds.includes(itemId)) {
        const error = new Error(`Cannot delete seed item ${itemId}. Seed items are protected.`);
        await this.captureError(error, { operation: 'delete', itemId });
        throw error;
      }

      // Get the item before deleting (for event)
      const item = await this.storage.get(itemId);

      // Find all parents
      const allItems = await this.storage.getAll();
      const parents = allItems.filter(parentItem => {
        if (!parentItem.attachments) return false;
        return parentItem.attachments.some(child => child.id === itemId);
      });

      // Remove from all parents
      for (const parent of parents) {
        await this.detach(parent.id, itemId);
      }

      // Delete the item
      await this.storage.delete(itemId);

      // Remove from watcher index
      this.watcherIndex.delete(itemId);

      // Emit deletion event — await so cascade-delete watchers complete before re-render
      await this.events.emitAsync({ type: EVENT_IDS.ITEM_DELETED, content: { id: itemId, item } });

      // Clear module cache only if this was a code item
      if (await this.isCodeItem(item)) {
        this.moduleSystem.clearCache();
      }

      // Re-render viewport (userland will handle navigation if needed)
      await this.renderViewport();
    }

    /** Check if an item is a code item (its type chain includes CODE).
     * @param {Object} item - The item to check
     * @returns {Promise<boolean>}
     */
    async isCodeItem(item) {
      return await this.moduleSystem.isCodeItem(item);
    }

    // -------------------------------------------------------------------------
    // Item Save with Events
    // -------------------------------------------------------------------------

    /** Save an item to storage, emitting created/updated events.
     * @param {Object} item - The item to save
     * @param {Object} [options]
     * @param {boolean} [options.silent] - Suppress events and late-activation
     * @returns {Promise<Object>} The saved item
     */
    async saveItem(item, options = {}) {
      const { silent = false } = options;

      const exists = await this.storage.exists(item.id);
      const previous = exists ? await this.storage.get(item.id) : null;

      item.modified = Date.now();
      if (!exists && !item.created) {
        item.created = Date.now();
      }

      await this.storage.set(item, this);

      // Update watcher index
      if (item.watches && Array.isArray(item.watches) && item.watches.length > 0) {
        this.watcherIndex.add(item.id);
      } else {
        this.watcherIndex.delete(item.id);
      }

      // Clear module cache if this is a code item (ensures fresh code on next require)
      if (await this.isCodeItem(item)) {
        this.moduleSystem.clearCache();
      }

      if (!silent) {
        if (exists) {
          this.events.emit({ type: EVENT_IDS.ITEM_UPDATED, content: { id: item.id, item, previous } });
        } else {
          this.events.emit({ type: EVENT_IDS.ITEM_CREATED, content: { id: item.id, item } });
        }

        // If item watches kernel:boot-complete, call its handler now
        // This enables newly-created/edited libraries to activate without reload
        if (item.watches?.some(w => w.event === EVENT_IDS.SYSTEM_BOOT_COMPLETE)) {
          try {
            const bootEvent = {
              type: EVENT_IDS.SYSTEM_BOOT_COMPLETE,
              content: {
                // rootId removed - userland reads from viewport item or URL
                safeMode: this._safeMode,
                debugMode: this.debugMode,
                lateActivation: true
              },
              timestamp: Date.now()
            };
            await this.callWatchHandler(item, bootEvent);
          } catch (e) {
            console.warn(`Boot handler for ${item.name || item.id} failed:`, e);
          }
        }
      }

      return item;
    }

    // -------------------------------------------------------------------------
    // Declarative Event Watches (Phase 2: Type hierarchy based)
    // -------------------------------------------------------------------------

    /** Subscribe a single root listener that dispatches all events to declarative watchers. */
    setupDeclarativeWatches() {
      // Single subscription to root event type — receives ALL events
      // (item, system, viewport, userland, etc.)
      this.events.on(EVENT_IDS.EVENT_DEFINITION, async (event) => {
        await this.dispatchToWatchers(event);
      });
    }

    /** Dispatch an event to all matching declarative watch handlers.
     * @param {Object} event - {type, content, timestamp}
     */
    async dispatchToWatchers(event) {
      // event = { type: eventTypeId, content: {...}, timestamp }
      try {
        // Get watcher items from index (O(k) where k = number of watchers)
        const watcherItems = await Promise.all(
          [...this.watcherIndex].map(id => this.storage.get(id).catch(() => null))
        );

        // Get the emitted event's type chain for matching
        const eventTypeChain = this.eventTypeCache?.get(event.type)?.ancestors || new Set([event.type]);

        // Find and call all matching watchers
        let handled = false;
        for (const watcherItem of watcherItems) {
          if (!watcherItem || !watcherItem.watches) continue;

          // A watch matches if the emitted event's type chain includes the watch's event field
          const matchingWatches = watcherItem.watches.filter(w =>
            eventTypeChain.has(w.event)
          );

          for (const watch of matchingWatches) {
            // Evaluate filter against the event's item (from content)
            const matches = await this.evaluateWatchFilter(watch, event.content?.item);

            if (matches) {
              await this.callWatchHandler(watcherItem, event);
              handled = true;
              break; // Only call handler once per watcher item, even if multiple watches match
            }
          }
        }

        // Fallback for unhandled system errors
        if (!handled && event.type === EVENT_IDS.SYSTEM_ERROR) {
          this.showFallbackErrorUI(event.content?.error, event.content?.context);
        }
      } catch (error) {
        console.error('Error dispatching to declarative watchers:', error);
        if (event.type === EVENT_IDS.SYSTEM_ERROR) {
          this.showFallbackErrorUI(event.content?.error, event.content?.context);
        }
      }
    }

    /** Evaluate a watch's filter conditions against an item.
     * @param {Object} watch - Watch spec {event, type?, typeExtends?, id?}
     * @param {Object|null} item - The item affected by the event
     * @returns {Promise<boolean>} True if all filters match
     */
    async evaluateWatchFilter(watch, item) {
      // No filters specified — always match (works for all event types)
      if (!watch.type && !watch.typeExtends && !watch.id) return true;

      // Filters require an item to evaluate against
      if (!item) return false;

      // Check exact type match (against the item being affected, not the event type)
      if (watch.type && item.type !== watch.type) {
        return false;
      }

      // Check type chain (typeExtends)
      if (watch.typeExtends) {
        const inChain = await this.moduleSystem.typeChainIncludes(item.type, watch.typeExtends);
        if (!inChain) {
          return false;
        }
      }

      // Check specific item ID
      if (watch.id && item.id !== watch.id) {
        return false;
      }

      // All filters passed
      return true;
    }

    /** Load a watcher's module and call the derived handler (e.g., onItemUpdated).
     * @param {Object} watcherItem - The item with watches array
     * @param {Object} event - {type, content, timestamp}
     */
    async callWatchHandler(watcherItem, event) {
      // event = { type: eventTypeId, content: {...}, timestamp }
      try {
        // Get event name from cache for handler name derivation
        const eventName = this.eventTypeCache?.get(event.type)?.name;
        if (!eventName) {
          console.warn(`Unknown event type ${event.type} - no cached name for handler derivation`);
          return;
        }

        // Convert event name to handler name: "item:deleted" -> "onItemDeleted"
        const handlerName = this.eventToHandlerName(eventName);

        // Load the watcher module
        const module = await this.moduleSystem.require(watcherItem.id);

        if (typeof module[handlerName] !== 'function') {
          console.warn(`Watcher ${watcherItem.name || watcherItem.id} has no ${handlerName} handler`);
          return;
        }

        // Use full REPL API for watch handlers (libraries need full access)
        // Renderer API is too limited - it lacks import, export, etc.
        const api = this.createAPI();

        // Call the handler with event content (preserves existing handler signatures)
        await module[handlerName](event.content, api);
      } catch (error) {
        console.error(`Error calling watch handler on ${watcherItem.name || watcherItem.id}:`, error);
      }
    }

    /** Convert an event name to a handler function name (e.g., "item:deleted" → "onItemDeleted").
     * @param {string} eventName - Event name (e.g., "item:deleted", "kernel:boot-complete")
     * @returns {string} Handler name (e.g., "onItemDeleted")
     */
    eventToHandlerName(eventName) {
      // "item:deleted" -> "onItemDeleted"
      // "item:created" -> "onItemCreated"
      // "error-event" -> "onErrorEvent"
      // "kernel:boot-complete" -> "onKernelBootComplete"
      // Split by : and - then capitalize each part
      const parts = eventName.split(/[:-]/);
      const camelParts = parts.map(part =>
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      );
      return 'on' + camelParts.join('');
    }

    // -------------------------------------------------------------------------
    // Error Capture System
    // -------------------------------------------------------------------------

    /** Capture an error and emit it as a system error event.
     * @param {Error} error - The error to capture
     * @param {Object} [context] - Additional context (operation, itemId, itemName, etc.)
     */
    async captureError(error, context = {}) {
      // Don't capture errors in safe mode
      if (this._safeMode) {
        console.error('[Safe Mode] Error:', error);
        return;
      }

      try {
        // Emit error-event event - user handlers will process
        this.events.emit({
          type: EVENT_IDS.SYSTEM_ERROR,
          content: {
            error: {
              name: error.name || 'Error',
              message: error.message || String(error),
              stack: error.stack || ''
            },
            context: {
              operation: context.operation || 'unknown',
              itemId: context.itemId,
              itemName: context.itemName,
              rendererId: context.rendererId,
              ...context
            }
          }
        });
      } catch (eventError) {
        // Ultimate fallback if event system fails
        console.error('Error capture failed:', eventError);
        console.error('Original error:', error);
        this.showFallbackErrorUI(error, context);
      }
    }

    /** Show a persistent error banner at the top of the page (last-resort fallback). */
    showFallbackErrorUI(error, context = {}) {
      // Remove any existing fallback banners
      const existing = document.querySelector('.kernel-error-fallback');
      if (existing) existing.remove();

      // Create persistent error banner at top of viewport
      const banner = document.createElement('div');
      banner.className = 'kernel-error-fallback';
      banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #ffebee;
        border-bottom: 2px solid #c62828;
        padding: 12px 20px;
        z-index: 10000000;
        font-family: system-ui, sans-serif;
      `;

      const contextInfo = context.itemName ? ` in ${context.itemName}` : '';
      const errorMessage = error?.message || String(error);

      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 20px;">⚠️</span>
          <div style="flex: 1;">
            <strong>System Error</strong>${contextInfo}: ${errorMessage}
          </div>
          <button onclick="this.closest('.kernel-error-fallback').remove()"
                  style="padding: 4px 12px; cursor: pointer; border: 1px solid #999; background: white; border-radius: 4px;">
            Dismiss
          </button>
        </div>
      `;

      document.body.insertBefore(banner, document.body.firstChild);
    }

    /** Clean up global handlers and trigger a full kernel reload via postMessage. */
    reloadKernel() {
      // Clean up global handlers before reload
      if (window._globalErrorHandler) {
        window.removeEventListener('error', window._globalErrorHandler);
        delete window._globalErrorHandler;
      }
      if (window._unhandledRejectionHandler) {
        window.removeEventListener('unhandledrejection', window._unhandledRejectionHandler);
        delete window._unhandledRejectionHandler;
      }
      if (window._replKeyboardHandler) {
        document.removeEventListener('keydown', window._replKeyboardHandler);
        delete window._replKeyboardHandler;
      }
      if (window._userKeyboardHandler) {
        document.removeEventListener('keydown', window._userKeyboardHandler);
        delete window._userKeyboardHandler;
      }
      if (window._hobsonPopstateHandler) {
        window.removeEventListener('popstate', window._hobsonPopstateHandler);
        delete window._hobsonPopstateHandler;
      }
      if (window._safeModeShortcut) {
        document.removeEventListener('keydown', window._safeModeShortcut);
        delete window._safeModeShortcut;
      }
      
      window.postMessage({type: 'reload-kernel'}, '*');
    }
  }

  return Kernel;
}
