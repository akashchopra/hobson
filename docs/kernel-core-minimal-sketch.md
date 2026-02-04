# Kernel:core Minimal Sketch (IMPLEMENTED)

**Status:** Completed

**Actual reduction:** 273 lines, ~9.3KB removed from kernel:core

## Current vs Minimal Comparison

| Component | Current | Minimal | Notes |
|-----------|---------|---------|-------|
| EventBus | Keep | Keep | Core infrastructure |
| IDS/EVENT_IDS | Keep | Keep | Seed constants |
| boot() | Keep | Keep | Initialization |
| ensureSeedItems() | Keep | Keep | Bootstrap |
| buildEventTypeCache() | Keep | Keep | Event dispatch |
| getTypeChain() | Keep | Keep | Type hierarchy |
| applyStyles() | Keep | Keep | CSS loading |
| renderViewport() | Keep | Keep | Main render entry |
| **showItemList()** | ~85 lines | **Remove** | Userland `item-palette` only |
| **hideItemList()** | ~5 lines | **Remove** | - |
| **showHelp()** | ~60 lines | **Remove** | Userland `help-dialog` only |
| **hideHelp()** | ~5 lines | **Remove** | - |
| **editItemRaw()** | ~70 lines | **Remove** | Userland `json-editor` library |
| saveJson() | Keep | Keep | Used by export |
| export() | Keep | Keep | Data export |
| createREPLAPI() | Keep | Slim | Remove showItemList/showHelp/editItemRaw refs |
| attach/detach | Keep | Keep | Graph operations |
| setAttachmentView | Keep | Keep | View management |
| findContainerOf | Keep | Keep | Graph query |
| wouldCreateCycle/hasCycle | Keep | Keep | Cycle detection |
| deleteItem | Keep | Keep | CRUD |
| isCodeItem | Keep | Keep | Type check |
| saveItem | Keep | Keep | CRUD + events |
| setupDeclarativeWatches | Keep | Keep | Event system |
| dispatchToWatchers | Keep | Keep | Event system |
| evaluateWatchFilter | Keep | Keep | Event system |
| callWatchHandler | Keep | Keep | Event system |
| eventToHandlerName | Keep | Keep | Event system |
| dispatchToSystemWatchers | Keep | Keep | Error handling |
| findSystemEventHandlers | Keep | Keep | Error handling |
| captureError | Keep | Keep | Error capture |
| **showFallbackErrorUI** | Keep | Keep | **Must stay** - ultimate fallback |
| reloadKernel | Keep | Keep | Hot reload |

**Estimated reduction**: ~225 lines removed

---

## Minimal Kernel:core Sketch

```javascript
export async function loadKernel(require, storageBackend) {
  // EventBus class - unchanged
  class EventBus { /* ... same ... */ }

  // IDS, EVENT_IDS - unchanged
  const IDS = { /* ... same ... */ };
  const EVENT_IDS = { /* ... same ... */ };

  // Load kernel modules - unchanged
  const { Storage } = await require(IDS.KERNEL_STORAGE);
  const { ModuleSystem } = await require(IDS.KERNEL_MODULE_SYSTEM);
  const { RenderingSystem } = await require(IDS.KERNEL_RENDERING_SYSTEM);
  const { REPL } = await require(IDS.KERNEL_REPL);
  const { SafeMode } = await require(IDS.KERNEL_SAFE_MODE);

  class Kernel {
    constructor() {
      // Same initialization
      this.IDS = IDS;
      this.EVENT_IDS = EVENT_IDS;
      this.storage = new Storage(storageBackend);
      this.moduleSystem = new ModuleSystem(this);
      this.rendering = new RenderingSystem(this);
      this.repl = new REPL(this);
      this.safeMode = new SafeMode(this);
      this.events = new EventBus(this);

      this._safeMode = false;
      this.debugMode = false;

      this.rootElement = document.createElement('div');
      this.rootElement.id = 'app';
      this.rootElement.innerHTML = '<div id="main-view"></div>';
    }

    async boot() { /* ... unchanged ... */ }
    async ensureSeedItems() { /* ... unchanged ... */ }
    async buildEventTypeCache() { /* ... unchanged ... */ }
    async getTypeChain(itemId) { /* ... unchanged ... */ }
    async applyStyles() { /* ... unchanged ... */ }
    async renderViewport() { /* ... unchanged ... */ }

    // REMOVED: showItemList(), hideItemList()
    // REMOVED: showHelp(), hideHelp()
    // REMOVED: editItemRaw()

    saveJson(thing, filename) { /* ... unchanged ... */ }
    async export(singleFile = true) { /* ... unchanged ... */ }

    // -------------------------------------------------------------------------
    // REPL API - slimmed down
    // -------------------------------------------------------------------------

    createREPLAPI() {
      const kernel = this;

      return {
        // Storage operations - unchanged
        get: (id) => kernel.storage.get(id),
        set: async (item) => { /* ... */ },
        update: async (item) => { /* ... */ },
        delete: (id) => kernel.deleteItem(id),
        query: (filter) => kernel.storage.query(filter),
        getAll: () => kernel.storage.getAll(),
        getAllRaw: () => kernel.storage.getAllRaw(),

        // Code operations - unchanged
        require: (name) => kernel.moduleSystem.require(name),
        typeChainIncludes: (typeId, targetId) => kernel.moduleSystem.typeChainIncludes(typeId, targetId),

        // Rendering operations - unchanged
        renderItem: (itemId, viewId) => kernel.rendering.renderItem(itemId, viewId),
        rerenderItem: (itemId) => kernel.rendering.rerenderItem(itemId),
        rerenderByView: (viewId) => kernel.rendering.rerenderByView(viewId),
        rerenderByType: (typeId) => kernel.rendering.rerenderByType(typeId),
        getViews: (typeId) => kernel.rendering.getViews(typeId),
        getDefaultView: (typeId) => kernel.rendering.getDefaultView(typeId),
        findView: (typeId) => kernel.rendering.findView(typeId),
        getEffectiveView: (itemId) => kernel.rendering.getEffectiveView(itemId),

        // Preferred view management - unchanged
        setPreferredView: async (itemId, viewId) => { /* ... */ },
        getPreferredView: async (itemId) => { /* ... */ },

        // Parent-child operations - unchanged
        setAttachmentView: (parentId, childId, viewId) => kernel.setAttachmentView(parentId, childId, viewId),
        findContainerOf: (childId) => kernel.findContainerOf(childId),
        attach: (parentId, childId) => kernel.attach(parentId, childId),
        detach: (parentId, childId) => kernel.detach(parentId, childId),
        wouldCreateCycle: (parentId, childId) => kernel.wouldCreateCycle(parentId, childId),
        hasCycle: (itemId) => kernel.hasCycle(itemId),

        // Navigation - unchanged (delegates to viewport-manager)
        navigate: async (id, params) => { /* ... */ },

        // Render viewport - unchanged
        renderViewport: () => kernel.renderViewport(),

        // Export/Import - unchanged
        export: async (singleFile = true) => kernel.export(singleFile),
        import: async () => { /* ... unchanged file picker logic ... */ },

        // Well-known IDs - unchanged
        IDS,
        EVENT_IDS,

        // Helper functions - unchanged
        helpers: { /* ... */ },

        // Viewport - unchanged (delegates to userland)
        viewport: { /* ... */ },

        // Events - unchanged
        events: { /* ... */ },

        // Render instances - unchanged
        instances: { /* ... */ }
      };
    }

    // Parent-child operations - unchanged
    async attach(parentId, childId) { /* ... */ }
    async detach(parentId, childId) { /* ... */ }
    async setAttachmentView(parentId, childId, viewId) { /* ... */ }
    async findContainerOf(childId) { /* ... */ }
    async wouldCreateCycle(parentId, newChildId) { /* ... */ }
    async hasCycle(itemId) { /* ... */ }
    async deleteItem(itemId) { /* ... */ }
    async isCodeItem(item) { /* ... */ }

    // Item Save with Events - unchanged
    async saveItem(item, options = {}) { /* ... */ }

    // Declarative Event Watches - unchanged
    setupDeclarativeWatches() { /* ... */ }
    async dispatchToWatchers(event) { /* ... */ }
    async evaluateWatchFilter(watch, item) { /* ... */ }
    async callWatchHandler(watcherItem, event) { /* ... */ }
    eventToHandlerName(eventName) { /* ... */ }

    // System Event Dispatching - unchanged
    async dispatchToSystemWatchers(event) { /* ... */ }
    async findSystemEventHandlers(eventTypeId) { /* ... */ }

    // Error Capture - unchanged
    async captureError(error, context = {}) { /* ... */ }
    showFallbackErrorUI(error, context = {}) { /* ... KEEP - ultimate fallback */ }

    reloadKernel() { /* ... unchanged ... */ }
  }

  return Kernel;
}
```

---

## Userland Requirements

For this to work, these userland libraries become **required** (not optional):

### 1. `item-palette` (already exists)
- Provides item search/navigation modal
- Invoked by keyboard shortcut (Cmd+K)
- No kernel fallback - if missing, shortcut does nothing

### 2. `help-dialog` (already exists)
- Provides keyboard shortcuts help
- Invoked by keyboard shortcut (Cmd+?)
- No kernel fallback - if missing, shortcut does nothing

### 3. `json-editor` (NEW - needs creation)
- Provides raw JSON editing for items
- Could be a view for any item type
- Or a library with `show(itemId)` function
- Current `editItemRaw()` logic moves here

### 4. `keyboard-shortcuts` (already exists)
- Already handles Cmd+K, Cmd+?, etc.
- Would need to gracefully handle missing `item-palette`/`help-dialog`

---

## Migration Path

1. **Create `json-editor` library** - port `editItemRaw()` logic
2. **Update `keyboard-shortcuts`** - add try/catch for missing libraries
3. **Remove from kernel:core**:
   - `showItemList()`, `hideItemList()`
   - `showHelp()`, `hideHelp()`
   - `editItemRaw()`
4. **Test safe mode** - ensure it still works without these

---

## What Stays in Kernel (Final List)

**Infrastructure:**
- EventBus (event dispatch)
- Storage integration
- ModuleSystem integration
- RenderingSystem integration
- REPL core (evaluation, not UI)
- SafeMode renderer

**Boot:**
- boot() sequence
- ensureSeedItems()
- applyStyles()
- renderViewport()

**Type System:**
- buildEventTypeCache()
- getTypeChain()

**Graph Operations:**
- attach(), detach()
- setAttachmentView()
- findContainerOf()
- wouldCreateCycle(), hasCycle()

**CRUD:**
- saveItem() (with events)
- deleteItem()
- isCodeItem()

**Events:**
- setupDeclarativeWatches()
- dispatchToWatchers()
- dispatchToSystemWatchers()
- evaluateWatchFilter()
- callWatchHandler()
- eventToHandlerName()
- findSystemEventHandlers()

**Error Handling:**
- captureError()
- showFallbackErrorUI() - **only UI that stays**

**Utilities:**
- saveJson()
- export()
- reloadKernel()

**API Surface:**
- createREPLAPI() - exposes everything above

---

## Open Question

Should `export()` and the `import()` logic in createREPLAPI also move to userland?

**Arguments for moving:**
- File picker UI is UI code
- Could be an `import-export` library

**Arguments for keeping:**
- Essential for backup/restore
- Tightly coupled with storage and module cache clearing
- Safe mode might want export capability

Recommendation: Keep for now. The file picker is minimal browser API, not custom UI.
