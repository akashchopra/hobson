export async function loadKernel(require, storageBackend) {
  // Event system - Phase 2: Object-based emit with type hierarchy dispatch
  class EventBus {
    constructor(kernel) {
      this.kernel = kernel;  // Reference for eventTypeCache access
      this.listeners = new Map();
    }

    on(eventTypeId, handler) {
      // Subscribe to an event type GUID
      // Subscribing to a parent type (e.g., ITEM_EVENT) will receive all child events
      if (!this.listeners.has(eventTypeId)) {
        this.listeners.set(eventTypeId, new Set());
      }
      this.listeners.get(eventTypeId).add(handler);
      return () => this.off(eventTypeId, handler);
    }

    off(eventTypeId, handler) {
      const handlers = this.listeners.get(eventTypeId);
      if (handlers) {
        handlers.delete(handler);
      }
    }

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
            window.location.href = window.location.pathname + '?safe=1';
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
            const api = this.createREPLAPI();
            this._elementInspector = inspectorModule.activate(api);
          } catch (e) {
            console.warn('Could not load element-inspector:', e.message);
          }
        }
      }
    }

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

    async buildEventTypeCache() {
      // Build a cache mapping each event definition ID to:
      // - ancestors: Set of all type IDs in the chain (for type hierarchy dispatch)
      // - name: The event's name string (for handler name derivation in declarative watches)
      // This enables O(1) lookups during emit().
      // Also builds the watcher index for efficient event dispatch.
      this.eventTypeCache = new Map();
      this.watcherIndex = new Set();

      try {
        // Find all items that extend event-definition
        const allItems = await this.storage.getAll();
        const eventDefs = [];

        for (const item of allItems) {
          if (await this.moduleSystem.typeChainIncludes(item.type, EVENT_IDS.EVENT_DEFINITION)) {
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
          const ancestors = await this.getTypeChain(eventDef.id);
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

    async renderViewport() {
      const mainView = this.rootElement.querySelector('#main-view');
      if (!mainView) return;

      try {
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
    }

    // renderRoot() removed - renderViewport() handles everything
    // Userland calls api.renderViewport() to trigger re-render

    // -------------------------------------------------------------------------
    // Item List and Raw Editor
    // -------------------------------------------------------------------------

    async showItemList() {
      // Try userland library first
      try {
        const itemPalette = await this.moduleSystem.require('item-palette');
        if (itemPalette?.show) {
          await itemPalette.show(this.createREPLAPI());
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

    hideItemList() {
      const existing = document.getElementById("item-list-overlay");
      if (existing) {
        existing.remove();
      }
    }

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
          <tr><td style="padding: 8px 16px 8px 0;"><kbd style="background: #f0f0f0; padding: 2px 8px; border-radius: 3px; border: 1px solid #ccc;">Esc</kbd></td><td>Toggle REPL</td></tr>
          <tr><td style="padding: 8px 16px 8px 0;"><kbd style="background: #f0f0f0; padding: 2px 8px; border-radius: 3px; border: 1px solid #ccc;">Cmd+K</kbd></td><td>Search items</td></tr>
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

    hideHelp() {
      const existing = document.getElementById("help-overlay");
      if (existing) {
        existing.remove();
      }
    }

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

    // Export
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
    // REPL API
    // -------------------------------------------------------------------------

    createREPLAPI() {
      const kernel = this;

      // Sort items in dependency order for import (types before their instances)
      // Uses topological sort based on type and extends fields
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

      return {
        // Storage operations
        get: (id) => kernel.storage.get(id),
        set: async (item) => {
          // Save without triggering re-render
          await kernel.saveItem(item);
          return item.id;
        },
        update: async (item) => {
          // Save and trigger re-render
          await kernel.saveItem(item);
          await kernel.renderViewport();
          return item.id;
        },
        delete: (id) => kernel.deleteItem(id),
        query: (filter) => kernel.storage.query(filter),
        getAll: () => kernel.storage.getAll(),
        getAllRaw: () => kernel.storage.getAllRaw(),

        // Code operations
        require: (name) => kernel.moduleSystem.require(name),
        typeChainIncludes: (typeId, targetId) => kernel.moduleSystem.typeChainIncludes(typeId, targetId),

        // Rendering operations
        renderItem: (itemId, viewId) => kernel.rendering.renderItem(itemId, viewId),
        rerenderItem: (itemId) => kernel.rendering.rerenderItem(itemId),
        rerenderByView: (viewId) => kernel.rendering.rerenderByView(viewId),
        rerenderByType: (typeId) => kernel.rendering.rerenderByType(typeId),
        getViews: (typeId) => kernel.rendering.getViews(typeId),
        getDefaultView: (typeId) => kernel.rendering.getDefaultView(typeId),
        findView: (typeId) => kernel.rendering.findView(typeId),
        getEffectiveView: (itemId) => kernel.rendering.getEffectiveView(itemId),

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
          await kernel.renderViewport();
          return item.preferredView || null;
        },

        getPreferredView: async (itemId) => {
          const item = await kernel.storage.get(itemId);
          return item.preferredView || null;
        },

        // Parent-child operations
        setAttachmentView: (parentId, itemId, viewId) => kernel.setAttachmentView(parentId, itemId, viewId),
        findContainerOf: (itemId) => kernel.findContainerOf(itemId),
        attach: (parentId, itemId) => kernel.attach(parentId, itemId),
        detach: (parentId, itemId) => kernel.detach(parentId, itemId),

        // Cycle detection (advisory - for UIs that want to warn before creating cycles)
        wouldCreateCycle: (parentId, attachmentId) => kernel.wouldCreateCycle(parentId, attachmentId),
        hasCycle: (itemId) => kernel.hasCycle(itemId),

        // Navigation (params: { field, line, col } for line highlighting)
        // Delegates to userland viewport-manager
        navigate: async (id, params) => {
          const vpMgr = await kernel.moduleSystem.require('viewport-manager');
          return vpMgr.navigate(id, params);
        },

        // Render viewport (for userland to trigger re-renders)
        renderViewport: () => kernel.renderViewport(),

        // Export
        export: async (singleFile = true) => {
          console.log("api.export:", singleFile);
          return kernel.export(singleFile);
        },

        // Import
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

        // Well-known IDs
        IDS,
        EVENT_IDS,

        // Helper functions
        helpers: {
          findByName: async (name) => {
            const items = await kernel.storage.query({ name });
            return items.length > 0 ? items[0] : null;
          },
          listByType: async (typeId) => {
            return await kernel.storage.query({ type: typeId });
          },
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

        // Viewport - fully delegates to userland libraries (no kernel fallback)
        viewport: {
          select: async (itemId, parentId) => {
            const selMgr = await kernel.moduleSystem.require('selection-manager');
            selMgr.select(itemId, parentId);
          },
          clearSelection: async () => {
            const selMgr = await kernel.moduleSystem.require('selection-manager');
            selMgr.clearSelection();
          },
          getSelection: () => {
            const selMgr = kernel.moduleSystem.getCached('selection-manager');
            return selMgr?.getSelection() || null;
          },
          getSelectionParent: () => {
            const selMgr = kernel.moduleSystem.getCached('selection-manager');
            return selMgr?.getSelectionParent() || null;
          },
          getRoot: () => {
            // Sync: reads from URL (authoritative source for root)
            const params = new URLSearchParams(window.location.search);
            return params.get('root');
          },
          getRootView: async () => {
            const vpMgr = await kernel.moduleSystem.require('viewport-manager');
            return await vpMgr.getRootView();
          },
          setRootView: async (viewId) => {
            const vpMgr = await kernel.moduleSystem.require('viewport-manager');
            await vpMgr.setRootView(viewId);
          },
          getRootViewConfig: async () => {
            const vpMgr = await kernel.moduleSystem.require('viewport-manager');
            return await vpMgr.getRootViewConfig();
          },
          updateRootViewConfig: async (updates) => {
            const vpMgr = await kernel.moduleSystem.require('viewport-manager');
            await vpMgr.updateRootViewConfig(updates);
          },
          restorePreviousRootView: async () => {
            const vpMgr = await kernel.moduleSystem.require('viewport-manager');
            return await vpMgr.restorePreviousRootView();
          }
        },

        // Events (Phase 2: object-based emit, type hierarchy dispatch)
        // on(eventTypeId, handler) - subscribe to event type GUID
        // emit({ type: eventTypeId, content: {...} }) - emit event object
        events: {
          on: (eventTypeId, handler) => kernel.events.on(eventTypeId, handler),
          off: (eventTypeId, handler) => kernel.events.off(eventTypeId, handler),
          emit: (event) => kernel.events.emit(event),
          list: () => kernel.events.getRegisteredEvents()
        },

        // Render instances (Phase 2)
        instances: {
          getByItemId: (itemId) => kernel.rendering.registry.getByItemId(itemId),
          getByViewId: (viewId) => kernel.rendering.registry.getByViewId(viewId),
          get: (instanceId) => kernel.rendering.registry.get(instanceId),
          getAll: () => kernel.rendering.registry.getAll(),
          getSummary: () => kernel.rendering.registry.getSummary(),
          clear: () => kernel.rendering.registry.clear()
        }
      };
    }

    // -------------------------------------------------------------------------
    // Parent-child operations
    // -------------------------------------------------------------------------

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
      await this.saveItem(updated);
    }

    async detach(parentId, itemId) {
      const parent = await this.storage.get(parentId);
      const updated = {
        ...parent,
        attachments: parent.attachments.filter(c => c.id !== itemId)
      };
      // Save silently without triggering re-render (consistent with addChild)
      await this.saveItem(updated);
    }

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

    async findContainerOf(itemId) {
      const allItems = await this.storage.getAll();
      for (const item of allItems) {
        if (item.attachments && item.attachments.some(c => c.id === itemId)) {
          return item;
        }
      }
      return null;
    }

    // Advisory: Check if adding a child would create a cycle
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

    // Advisory: Check if an item's descendant graph contains any cycles
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

      // Emit deletion event
      this.events.emit({ type: EVENT_IDS.ITEM_DELETED, content: { id: itemId, item } });

      // Clear module cache
      this.moduleSystem.clearCache();

      // Re-render viewport (userland will handle navigation if needed)
      await this.renderViewport();
    }

    async isCodeItem(item) {
      return await this.moduleSystem.isCodeItem(item);
    }

    // -------------------------------------------------------------------------
    // Item Save with Events
    // -------------------------------------------------------------------------

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

    setupDeclarativeWatches() {
      // Single subscription to root event type — receives ALL events
      // (item, system, viewport, userland, etc.)
      this.events.on(EVENT_IDS.EVENT_DEFINITION, async (event) => {
        await this.dispatchToWatchers(event);
      });
    }

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
        const api = this.createREPLAPI();

        // Call the handler with event content (preserves existing handler signatures)
        await module[handlerName](event.content, api);
      } catch (error) {
        console.error(`Error calling watch handler on ${watcherItem.name || watcherItem.id}:`, error);
      }
    }

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
      // _popstateHandler removed - now managed by userland viewport-manager
      if (window._safeModeShortcut) {
        document.removeEventListener('keydown', window._safeModeShortcut);
        delete window._safeModeShortcut;
      }
      
      window.postMessage({type: 'reload-kernel'}, '*');
    }
  }

  return Kernel;
}
