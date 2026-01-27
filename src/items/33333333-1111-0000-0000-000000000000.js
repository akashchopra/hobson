// Item: kernel-core
// ID: 33333333-1111-0000-0000-000000000000
// Type: 33333333-0000-0000-0000-000000000000

// kernel-core
export async function loadKernel(require, storageBackend) {
  // Event system
  class EventBus {
    constructor() {
      this.listeners = new Map();
    }

    on(event, handler) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event).add(handler);
      return () => this.off(event, handler);
    }

    off(event, handler) {
      const handlers = this.listeners.get(event);
      if (handlers) {
        handlers.delete(handler);
      }
    }

    emit(event, data) {
      const handlers = this.listeners.get(event);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(data);
          } catch (e) {
            console.error(`Event handler error for ${event}:`, e);
          }
        }
      }

      const [namespace] = event.split(':');
      const wildcardHandlers = this.listeners.get(`${namespace}:*`);
      if (wildcardHandlers) {
        for (const handler of wildcardHandlers) {
          try {
            handler({ ...data, event });
          } catch (e) {
            console.error(`Wildcard handler error for ${event}:`, e);
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
    KERNEL_VIEWPORT: "33333333-3333-0000-0000-000000000000",
    KERNEL_MODULE_SYSTEM: "33333333-4444-0000-0000-000000000000",
    KERNEL_RENDERING_SYSTEM: "33333333-5555-0000-0000-000000000000",
    KERNEL_REPL: "33333333-6666-0000-0000-000000000000",
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
    VIEW_SPEC: "bbbbbbbb-0000-0000-0000-000000000000",
    FIELD_VIEW: "cccccccc-0000-0000-0000-000000000000"
  };
// [END:SEED_IDS]

  const { Storage } = await require(IDS.KERNEL_STORAGE);
  const { Viewport } = await require(IDS.KERNEL_VIEWPORT);
  const { ModuleSystem } = await require(IDS.KERNEL_MODULE_SYSTEM);
  const { RenderingSystem } = await require(IDS.KERNEL_RENDERING_SYSTEM);
  const { REPL } = await require(IDS.KERNEL_REPL);
  const { SafeMode } = await require(IDS.KERNEL_SAFE_MODE);

  class Kernel {
    constructor() {
      this.IDS = IDS;
      this.storage = new Storage(storageBackend);
      this.viewport = new Viewport(this.storage);
      this.moduleSystem = new ModuleSystem(this);
      this.rendering = new RenderingSystem(this);
      this.repl = new REPL(this);
      this.safeMode = new SafeMode(this);
      this.events = new EventBus();

      this.currentRoot = null;
      this._safeMode = false;

      this.rootElement = document.createElement('div');
      this.rootElement.id = 'app';
      this.rootElement.innerHTML = '<div id="main-view"></div>';
    }

    async boot() {
      await this.storage.initialize();
      await this.ensureSeedItems();
      await this.applyStyles();

      // Check for safe mode
      const params = new URLSearchParams(window.location.search);
      this._safeMode = params.get('safe') === '1';

      if (this._safeMode) {
        this.safeMode.render(this.rootElement.querySelector('#main-view'));
      } else {
        await this.viewport.restore();

        // Add REPL container
        const replContainer = this.repl.createContainer();
        this.rootElement.appendChild(replContainer);

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

        // Handle keyboard shortcuts (use window.kernel so listener survives reloads)
        if (!window._replKeyboardHandler) {
          window._replKeyboardHandler = async (e) => {
            if (e.key === 'Escape') {
              await window.kernel?.repl?.toggle();
            } else if (e.ctrlKey && e.key === '\\') {
              await window.kernel?.repl?.toggle();
            } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '?') {
              e.preventDefault();
              window.kernel?.showHelp();
            }
          };
          document.addEventListener('keydown', window._replKeyboardHandler);
        }

        // Handle browser back/forward navigation
        if (!window._popstateHandler) {
          window._popstateHandler = async (e) => {
            const params = new URLSearchParams(window.location.search);
            const rootId = params.get('root');
            if (rootId && window.kernel) {
              // Update viewport without pushing new history entry
              window.kernel.currentRoot = rootId;
              window.kernel.viewport.setRoot(rootId);
              await window.kernel.viewport.persist();
              await window.kernel.renderRoot(rootId);
            }
          };
          window.addEventListener('popstate', window._popstateHandler);
        }

        // Setup declarative event watches BEFORE first render
        // so error handlers are active during boot
        this.setupDeclarativeWatches();

        const rootId = await this.getStartingRoot();
        if (rootId) {
          await this.navigateToItem(rootId);
        } else {
          // No root - render the viewport anyway, it will show empty state
          await this.renderViewport();
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

    async applyStyles() {
      try {
        const stylesItem = await this.storage.get(IDS.KERNEL_STYLES);
        const style = document.createElement('style');
        style.textContent = stylesItem.content.code;
        document.head.appendChild(style);
      } catch (e) {
        // Fallback to minimal styles
        const style = document.createElement('style');
        style.textContent = `
          * { box-sizing: border-box; }
          html, body { height: 100%; margin: 0; }
          body { font-family: system-ui, sans-serif; padding: 20px; background: #f5f5f5; }
          #app { height: 100%; display: flex; flex-direction: column; }
          #main-view { flex: 1; background: white; border-radius: 8px; padding: 20px; overflow: auto; }
        `;
        document.head.appendChild(style);
      }
    }

    async getStartingRoot() {
      const params = new URLSearchParams(window.location.search);
      const urlRoot = params.get("root");
      if (urlRoot) {
        try {
          await this.storage.get(urlRoot);
          return urlRoot;
        } catch {
          return null;
        }
      }

      if (this.viewport.rootId) {
        return this.viewport.rootId;
      }

      return null;
    }

    async navigateToItem(itemId, params = {}) {
      // Clear view override and view config when navigating to a different item
      // (but not on initial load when currentRoot is null)
      if (this.currentRoot && this.currentRoot !== itemId) {
        this.viewport.setRootView(null);
        this.viewport.rootViewConfig = {};  // Clear view config for new root
      }

      this.currentRoot = itemId;
      this.viewport.setRoot(itemId);

      // Update URL for browser back/forward navigation
      const url = new URL(window.location);
      url.searchParams.set('root', itemId);

      // Clear previous navigation params
      url.searchParams.delete('field');
      url.searchParams.delete('line');
      url.searchParams.delete('col');

      // Add optional navigation params (for line highlighting, etc.)
      if (params.field) url.searchParams.set('field', params.field);
      if (params.line) url.searchParams.set('line', params.line);
      if (params.col) url.searchParams.set('col', params.col);

      window.history.pushState({ itemId, ...params }, '', url);

      await this.viewport.persist();
      await this.renderRoot(itemId);
    }

    async renderViewport() {
      const mainView = this.rootElement.querySelector('#main-view');
      if (!mainView) return;

      try {
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

    async renderRoot(itemId) {
      // If no itemId, just render the viewport (which will show empty state)
      if (!itemId) {
        return this.renderViewport();
      }

      const mainView = this.rootElement.querySelector('#main-view');
      if (!mainView) return;

      try {
        // Render the viewport item itself (not the root directly)
        // The viewport renderer will create navigation and render the root inside
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

    // -------------------------------------------------------------------------
    // Item List and Raw Editor
    // -------------------------------------------------------------------------

    async showItemList() {
      // Remove existing modal if present
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
        z-index: 10000;
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
          row.onclick = () => {
            kernel.hideItemList();
            kernel.navigateToItem(item.id);
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

    showHelp() {
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
        z-index: 10000;
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
          if (kernel.viewport.rootId) {
            await kernel.renderRoot(kernel.viewport.rootId);
          } else {
            await kernel.showItemList();
          }
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
        if (kernel.viewport.rootId) {
          await kernel.renderRoot(kernel.viewport.rootId);
        } else {
          await kernel.showItemList();
        }
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

      return {
        // Storage operations
        get: (id) => kernel.storage.get(id),
        set: async (item) => {
          // Save without triggering re-render
          await kernel.saveItem(item);
          return item.id;
        },
        update: async (item) => {
          // Save and trigger re-render if there's a current root
          await kernel.saveItem(item);
          if (kernel.currentRoot) {
            await kernel.renderRoot(kernel.currentRoot);
          }
          return item.id;
        },
        delete: (id) => kernel.deleteItem(id),
        query: (filter) => kernel.storage.query(filter),
        getAll: () => kernel.storage.getAll(),
        getAllRaw: () => kernel.storage.getAllRaw(),

        // Code operations
        require: (name) => kernel.moduleSystem.require(name),

        // Rendering operations
        renderItem: (itemId, viewId) => kernel.rendering.renderItem(itemId, viewId),
        getViews: (typeId) => kernel.rendering.getViews(typeId),
        getDefaultView: (typeId) => kernel.rendering.getDefaultView(typeId),
        findView: (typeId) => kernel.rendering.findView(typeId),

        // Parent-child operations
        setChildView: (parentId, childId, viewId) => kernel.setChildView(parentId, childId, viewId),
        findParentOf: (childId) => kernel.findParentOf(childId),
        addChild: (parentId, childId) => kernel.addChild(parentId, childId),
        removeChild: (parentId, childId) => kernel.removeChild(parentId, childId),

        // Cycle detection (advisory - for UIs that want to warn before creating cycles)
        wouldCreateCycle: (parentId, childId) => kernel.wouldCreateCycle(parentId, childId),
        hasCycle: (itemId) => kernel.hasCycle(itemId),

        // Navigation (params: { field, line, col } for line highlighting)
        navigate: (id, params) => kernel.navigateToItem(id, params),

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

                resolve({ created, updated, skipped });
              } catch (error) {
                reject(error);
              }
            };
            input.click();
          });
        },

        // Well-known IDs
        IDS,

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
              children: [],
              content: { description }
            });
            return id;
          }
        },

        // Viewport
        viewport: {
          select: (itemId, parentId) => kernel.viewport.select(itemId, parentId),
          clearSelection: () => kernel.viewport.clearSelection(),
          getSelection: () => kernel.viewport.getSelection(),
          getSelectionParent: () => kernel.viewport.getSelectionParent(),
          getRoot: () => kernel.viewport.rootId,
          getRootView: () => kernel.viewport.getRootView(),
          setRootView: async (viewId) => {
            kernel.viewport.setRootView(viewId);
            await kernel.viewport.persist();
          }
        },

        // Events
        events: {
          on: (event, handler) => kernel.events.on(event, handler),
          off: (event, handler) => kernel.events.off(event, handler),
          emit: (event, data) => kernel.events.emit(event, data),
          list: () => kernel.events.getRegisteredEvents()
        }
      };
    }

    // -------------------------------------------------------------------------
    // Parent-child operations
    // -------------------------------------------------------------------------

    async addChild(parentId, childId) {
      // Note: Cycles are now allowed in the item graph.
      // Cycle detection happens at render time, not at data modification time.
      // Use wouldCreateCycle() if you want to check/warn before adding.

      const parent = await this.storage.get(parentId);
      if (!parent.children) parent.children = [];

      // Check if child already exists
      if (parent.children.some(c => c.id === childId)) {
        return; // Already a child
      }

      // Append minimal child object - views add layout properties as needed
      const updated = {
        ...parent,
        children: [...parent.children, { id: childId }]
      };

      // Save silently without triggering re-render
      await this.saveItem(updated);
    }

    async removeChild(parentId, childId) {
      const parent = await this.storage.get(parentId);
      const updated = {
        ...parent,
        children: parent.children.filter(c => c.id !== childId)
      };
      await this.saveItem(updated);
      await this.renderRoot(this.currentRoot);
    }

    async setChildView(parentId, childId, viewId) {
      const parent = await this.storage.get(parentId);
      const childIndex = parent.children.findIndex(c => c.id === childId);

      if (childIndex < 0) {
        const error = new Error(`Child ${childId} not found in parent ${parentId}`);
        await this.captureError(error, {
          operation: 'setChildView',
          itemId: parentId,
          childId: childId
        });
        throw error;
      }

      // Update the child's view - preserve existing view properties, change type
      const updatedChildren = [...parent.children];
      const currentChild = updatedChildren[childIndex];
      const currentView = currentChild.view;
      
      // Store previous view (complete snapshot)
      const newChild = {
        ...currentChild,
        previousView: currentView ? { ...currentView } : null,
        view: { ...(currentView || {}), type: viewId }
      };
      updatedChildren[childIndex] = newChild;

      const updated = {
        ...parent,
        children: updatedChildren
      };

      await this.saveItem(updated);
    }

    async findParentOf(childId) {
      const allItems = await this.storage.getAll();
      for (const item of allItems) {
        if (item.children && item.children.some(c => c.id === childId)) {
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
          for (const child of (item.children || [])) {
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
          for (const child of (item.children || [])) {
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
      // Get the item before deleting (for event)
      const item = await this.storage.get(itemId);

      // Find all parents
      const allItems = await this.storage.getAll();
      const parents = allItems.filter(parentItem => {
        if (!parentItem.children) return false;
        return parentItem.children.some(child => child.id === itemId);
      });

      // Remove from all parents
      for (const parent of parents) {
        await this.removeChild(parent.id, itemId);
      }

      // Delete the item
      await this.storage.delete(itemId);

      // Emit deletion event
      this.events.emit('item:deleted', { id: itemId, item });

      // Clear module cache
      this.moduleSystem.clearCache();

      // Re-render if we deleted from current root
      if (parents.some(p => p.id === this.currentRoot)) {
        await this.renderRoot(this.currentRoot);
      }
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

      // Clear module cache if this is a code item (ensures fresh code on next require)
      if (await this.isCodeItem(item)) {
        this.moduleSystem.clearCache();
      }

      if (!silent) {
        if (exists) {
          this.events.emit('item:updated', { id: item.id, item, previous });
        } else {
          this.events.emit('item:created', { id: item.id, item });
        }
      }

      return item;
    }

    // -------------------------------------------------------------------------
    // Declarative Event Watches
    // -------------------------------------------------------------------------

    setupDeclarativeWatches() {
      // Register wildcard listener for all item events
      this.events.on('item:*', async ({ event, ...data }) => {
        await this.dispatchToWatchers(event, data);
      });

      // Register wildcard listener for system events (error handling, etc.)
      this.events.on('system:*', async ({ event, ...data }) => {
        await this.dispatchToSystemWatchers(event, data);
      });
    }

    async dispatchToWatchers(eventType, eventData) {
      try {
        // Query all code items that have watches (use getAll to get local items only)
        const allItems = await this.storage.getAll();
        const watcherItems = allItems.filter(i =>
          i.content?.watches && Array.isArray(i.content.watches)
        );

        // Find watchers for this event type
        for (const watcherItem of watcherItems) {
          const matchingWatches = watcherItem.content.watches.filter(w =>
            w.event === eventType
          );

          for (const watch of matchingWatches) {
            // Evaluate filter against the event's item
            const matches = await this.evaluateWatchFilter(watch, eventData.item);

            if (matches) {
              await this.callWatchHandler(watcherItem, eventType, eventData);
              break; // Only call handler once per watcher item, even if multiple watches match
            }
          }
        }
      } catch (error) {
        console.error('Error dispatching to declarative watchers:', error);
      }
    }

    async evaluateWatchFilter(watch, item) {
      if (!item) return false;

      // Check exact type match
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

      // All filters passed (or no filters specified)
      return true;
    }

    async callWatchHandler(watcherItem, eventType, eventData) {
      try {
        // Convert event type to handler name: "item:deleted" -> "onItemDeleted"
        const handlerName = this.eventToHandlerName(eventType);

        // Load the watcher module
        const module = await this.moduleSystem.require(watcherItem.id);

        if (typeof module[handlerName] !== 'function') {
          console.warn(`Watcher ${watcherItem.name || watcherItem.id} has no ${handlerName} handler`);
          return;
        }

        // Create API for the handler (similar to renderer API)
        const api = this.rendering.createRendererAPI(watcherItem);

        // Call the handler
        await module[handlerName](eventData, api);
      } catch (error) {
        console.error(`Error calling watch handler on ${watcherItem.name || watcherItem.id}:`, error);
      }
    }

    eventToHandlerName(eventType) {
      // "item:deleted" -> "onItemDeleted"
      // "item:created" -> "onItemCreated"
      // "custom:something" -> "onCustomSomething"
      // "system:error" -> "onSystemError"
      const parts = eventType.split(':');
      const camelParts = parts.map((part, i) =>
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      );
      return 'on' + camelParts.join('');
    }

    // -------------------------------------------------------------------------
    // System Event Dispatching (for error handling, etc.)
    // -------------------------------------------------------------------------

    async dispatchToSystemWatchers(eventType, eventData) {
      try {
        // Find all items watching this system event
        const handlers = await this.findSystemEventHandlers(eventType);

        if (handlers.length === 0 && eventType === 'system:error') {
          // No handlers for errors - show fallback UI
          this.showFallbackErrorUI(eventData.error, eventData.context);
          return;
        }

        // Call ALL matching handlers (unlike item events which call first match)
        const results = await Promise.allSettled(
          handlers.map(handler => this.callWatchHandler(handler, eventType, eventData))
        );

        // Log any handler failures (but don't re-emit as errors to avoid loops)
        for (const result of results) {
          if (result.status === 'rejected') {
            console.error('System event handler failed:', result.reason);
          }
        }
      } catch (error) {
        console.error('Error dispatching system event:', error);
        // If this was an error event and dispatch failed, show fallback
        if (eventType === 'system:error') {
          this.showFallbackErrorUI(eventData.error, eventData.context);
        }
      }
    }

    async findSystemEventHandlers(eventType) {
      const allItems = await this.storage.getAll();
      return allItems.filter(item => {
        if (!item.content?.watches || !Array.isArray(item.content.watches)) {
          return false;
        }
        return item.content.watches.some(w => w.event === eventType);
      });
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
        // Emit system:error event - user handlers will process
        this.events.emit('system:error', {
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
          },
          timestamp: Date.now()
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
        z-index: 10000;
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
      if (window._popstateHandler) {
        window.removeEventListener('popstate', window._popstateHandler);
        delete window._popstateHandler;
      }
      
      window.postMessage({type: 'reload-kernel'}, '*');
    }
  }

  return Kernel;
}
