# Kernel Minimization Plan

## Executive Summary

This document establishes the principle that **the kernel should provide only essential infrastructure**, with all application-level features implemented as userland items. This separation clarifies the system's architecture, improves maintainability, and demonstrates Hobson's extensibility to users.

**Current state**: Kernel includes styling, REPL initialization, keyboard shortcuts, help dialogs, and item search.

**Target state**: Kernel provides only storage, events, rendering, modules, and recovery. Everything else moves to userland libraries.

**First implementation**: Theming system (see `Theming_System_Design.md`)

---

## Guiding Principles

### The Kernel's Essential Responsibility

The kernel is **infrastructure**, not application. Its job is to:

1. **Provide mechanisms**, not policies
2. **Enable extension**, not provide features
3. **Be minimal**, not comprehensive
4. **Be stable**, not frequently modified

The kernel should be the foundation that makes everything else possible, not the thing that does everything.

### What Belongs in the Kernel

A feature belongs in the kernel if and only if:

1. **Required for bootstrap**: Cannot be loaded as a regular item (e.g., storage, module system)
2. **Required for recovery**: Needed when userland code is broken (e.g., safe mode)
3. **Required for security**: Must be trusted code that cannot be bypassed (currently: none)
4. **Required for correctness**: System invariants that must always hold (e.g., type chain validation)

Everything else belongs in userland, even if it feels "system-level" or "essential."

### Benefits of Minimal Kernel

**For Users:**
- Clear separation: kernel vs application features
- Everything inspectable and modifiable
- System demonstrates its own extensibility
- Reduced coupling = easier to understand

**For Developers:**
- Smaller kernel = easier to audit
- Features developed as libraries = easier to test
- Clear extension patterns for users to follow
- Reduced breaking changes (userland can evolve independently)

**For the System:**
- Kernel stability (rarely changes)
- Progressive enhancement (features added without kernel modifications)
- Self-documenting (users see how features are built)
- True "everything is an item" philosophy

---

## Current Kernel Responsibilities

### Analysis of `kernel-core.boot()`

Here's what currently happens during boot:

```javascript
async boot() {
  // Phase 1: Infrastructure Setup
  await this.storage.initialize();           // ✓ ESSENTIAL
  await this.ensureSeedItems();              // ✓ ESSENTIAL
  await this.applyStyles();                  // ✗ APPLICATION
  
  // Phase 2: Mode Detection
  const params = new URLSearchParams(window.location.search);
  this._safeMode = params.get('safe') === '1';
  
  if (this._safeMode) {
    this.safeMode.render(...);               // ✓ ESSENTIAL (recovery)
  } else {
    // Phase 3: Userland Setup
    await this.viewport.restore();           // ✓ ESSENTIAL
    
    const replContainer = this.repl.createContainer();
    this.rootElement.appendChild(replContainer);  // ✗ APPLICATION
    
    // Phase 4: Global Handlers
    window._globalErrorHandler = ...         // ✓ ESSENTIAL (robustness)
    window.addEventListener('error', ...);
    
    window._replKeyboardHandler = ...        // ✗ APPLICATION
    document.addEventListener('keydown', ...);
    
    window._popstateHandler = ...            // ✓ ESSENTIAL (navigation)
    window.addEventListener('popstate', ...);
    
    // Phase 5: Event System
    this.setupDeclarativeWatches();          // ✓ ESSENTIAL
    
    // Phase 6: Initial Render
    const rootId = await this.getStartingRoot();
    if (rootId) {
      await this.navigateToItem(rootId);     // ✓ ESSENTIAL
    }
  }
}
```

### Also in Kernel (but not in boot())

**UI Methods:**
- `showItemList()` - Modal item search (Cmd+K)
- `hideItemList()` - Close search modal
- `showHelp()` - Keyboard shortcut help
- `hideHelp()` - Close help modal
- `editItemRaw()` - Raw JSON editor modal

**REPL Methods:**
- `createREPLAPI()` - API object for scripting
- REPL toggle, run, history management

---

## Essential vs Application Features

### ✓ Essential (Must Stay in Kernel)

#### Storage System
- **Why essential**: Required for bootstrap, cannot be loaded as item
- **Responsibilities**: CRUD operations, type chain validation, cycle detection
- **Modules**: `kernel-storage`

#### Module System  
- **Why essential**: Required to load any code, including userland libraries
- **Responsibilities**: Dynamic import, caching, circular dependency detection
- **Modules**: `kernel-module-system`

#### Rendering System
- **Why essential**: Required to display anything, including userland UI
- **Responsibilities**: View lookup, DOM creation, render instance registry
- **Modules**: `kernel-rendering`

#### Event System
- **Why essential**: Required for declarative watches to work
- **Responsibilities**: Pub/sub, wildcard events, event dispatch
- **Component**: `EventBus` class in `kernel-core`

#### Declarative Watches
- **Why essential**: Core extension mechanism, enables userland event handlers
- **Responsibilities**: Parse watches, evaluate filters, dispatch to handlers
- **Methods**: `setupDeclarativeWatches()`, `dispatchToWatchers()`

#### Viewport Management
- **Why essential**: Required for navigation, state persistence
- **Responsibilities**: Root tracking, selection state, persistence
- **Modules**: `kernel-viewport`

#### Error Capture
- **Why essential**: System robustness, errors must never disappear
- **Responsibilities**: Emit `system:error` events, fallback UI if no handlers
- **Methods**: `captureError()`, `showFallbackErrorUI()`

#### Global Error Handlers
- **Why essential**: Catch uncaught errors before they're lost
- **Responsibilities**: `window.onerror`, `unhandledrejection` listeners
- **Note**: These emit events; actual handling is userland

#### Browser Navigation
- **Why essential**: Required for URL-based navigation and back/forward
- **Responsibilities**: `popstate` listener, URL updates, history management
- **Methods**: `navigateToItem()`, `getStartingRoot()`

#### Safe Mode
- **Why essential**: Recovery when userland code is broken
- **Responsibilities**: Minimal UI, item list, raw editing, import/export
- **Modules**: `kernel-safe-mode`

#### Core API Methods
- **Why essential**: Required for any userland code to function
- **Methods**: `saveItem()`, `deleteItem()`, `createREPLAPI()`, `createRendererAPI()`

### ✗ Application (Should Move to Userland)

#### 1. Styling System
- **Current**: `applyStyles()` in boot, `kernel-styles` loaded once
- **Why application**: Visual presentation, user preference, not infrastructure
- **Should be**: Userland library watching `kernel-styles` item
- **Status**: **PRIORITY 1** - Design complete (see `Theming_System_Design.md`)
- **Migration path**: Remove `applyStyles()`, create `theme-hot-reload` library

#### 2. REPL Initialization
- **Current**: `repl.createContainer()` in boot, appended to DOM
- **Why application**: UI component, user preference to enable/disable
- **Should be**: Userland library that creates UI on demand
- **Note**: Keep `kernel-repl` module as infrastructure (API creation), but move initialization
- **Migration path**: 
  - Keep `createREPLAPI()` in kernel (essential for scripting)
  - Move `createContainer()` to userland library
  - Move `toggle()`, `run()`, transcript management to userland

#### 3. Keyboard Shortcuts
- **Current**: Hardcoded Escape, Ctrl+\, Cmd+Shift+?, Cmd+K
- **Why application**: User preferences, different users want different bindings
- **Should be**: Userland library with configurable key mappings
- **Migration path**: Create `keyboard-shortcuts` library
```javascript
{
  name: "keyboard-shortcuts",
  type: "library",
  content: {
    bindings: [
      { keys: "Escape", action: "toggle-repl" },
      { keys: "Cmd+K", action: "show-palette" },
      { keys: "Cmd+Shift+?", action: "show-help" }
    ],
    code: `
      export function activate(api, bindings) {
        document.addEventListener('keydown', async (e) => {
          // Check bindings, call appropriate api methods
        });
      }
    `
  }
}
```

#### 4. Item Search/Palette
- **Current**: `showItemList()` modal, activated by Cmd+K
- **Why application**: Search UI, user preference for search style
- **Should be**: Userland library, potentially multiple implementations
- **Migration path**: Create `item-palette` library
```javascript
{
  name: "item-palette",
  type: "library",
  content: {
    code: `
      export async function show(api) {
        // Create search modal
        // Fuzzy search through items
        // Navigate on selection
      }
    `
  }
}
```

#### 5. Help Dialog
- **Current**: `showHelp()` creates hardcoded modal
- **Why application**: Help content should be data, not code
- **Should be**: Help item with a view, or dedicated help browser
- **Migration path**: 
  - Create help item(s) with keyboard shortcut documentation
  - Create help view that renders the documentation
  - Keyboard shortcut library navigates to help item

#### 6. Raw Editor
- **Current**: `editItemRaw()` creates inline/modal JSON editor
- **Why application**: Editing UI, user might want different editors
- **Should be**: Editor view(s) for items
- **Note**: Safe mode still needs minimal raw editing for recovery
- **Migration path**:
  - Keep minimal raw editor in `kernel-safe-mode` (recovery only)
  - Move user-facing editor to userland library or view

---

## Migration Strategy

### Phase 1: Styling (Immediate - Design Complete)

**Goal**: Demonstrate the pattern with complete implementation

**Implementation**: See `Theming_System_Design.md`

**Steps**:
1. Define CSS variables in `kernel-styles`
2. Create `theme-hot-reload` library with watch on `kernel-styles`
3. Remove `applyStyles()` from `kernel-core.boot()`
4. Add minimal fallback styles to `bootstrap.html`
5. Document usage pattern

**Success criteria**:
- Kernel boots without applying styles
- Theme applies when library is imported
- Theme updates live when `kernel-styles` is edited
- System usable with bootstrap fallback if theme library missing

**Benefits**:
- Proves the pattern works
- Shows users how to build system-level features
- Reduces kernel code by ~30 lines
- Establishes "userland first" culture

### Phase 2: REPL Infrastructure (Short-term)

**Goal**: Separate REPL infrastructure (essential) from UI (application)

**Keep in kernel**:
- `createREPLAPI()` - API object creation
- API methods for script execution

**Move to userland**:
- `createContainer()` - UI creation
- `toggle()`, `run()`, history - UI behavior
- Transcript management

**Implementation**:
```javascript
// kernel-core: Keep only API creation
createREPLAPI() {
  return {
    get: (id) => this.storage.get(id),
    set: (item) => this.saveItem(item),
    // ... all the REPL-accessible methods
  };
}

// New userland library: repl-ui
{
  name: "repl-ui",
  type: "library",
  content: {
    code: `
      export function activate(api) {
        // Create REPL container
        // Append to DOM
        // Handle keyboard shortcuts for toggle
        // Manage history and transcript
      }
    `
  }
}
```

**Migration steps**:
1. Extract REPL UI to library
2. Remove REPL container creation from boot
3. Create startup pattern for auto-initialization
4. Update documentation

### Phase 3: Keyboard Shortcuts (Short-term)

**Goal**: Make keyboard bindings configurable data

**Implementation**:
```javascript
{
  name: "keyboard-shortcuts",
  type: "library",
  content: {
    code: `
      // Export default bindings as data
      export const defaultBindings = [
        { keys: "Escape", action: "toggle-repl", description: "Show/hide REPL" },
        { keys: "Cmd+K", action: "show-palette", description: "Search items" },
        { keys: "Cmd+Shift+?", action: "show-help", description: "Show help" }
      ];
      
      export function activate(api, customBindings = []) {
        const bindings = [...defaultBindings, ...customBindings];
        
        document.addEventListener('keydown', async (e) => {
          const binding = findBinding(e, bindings);
          if (binding) {
            e.preventDefault();
            await executeAction(binding.action, api);
          }
        });
      }
      
      function findBinding(event, bindings) {
        // Match key combination
      }
      
      async function executeAction(action, api) {
        switch (action) {
          case "toggle-repl":
            // Call REPL library
            break;
          case "show-palette":
            const palette = await api.require('item-palette');
            await palette.show(api);
            break;
          case "show-help":
            await api.navigate(api.IDS.HELP_ITEM);
            break;
        }
      }
    `
  }
}
```

**Migration steps**:
1. Create keyboard shortcuts library
2. Remove keyboard handlers from `kernel-core.boot()`
3. Create bindings config item type
4. Update documentation

### Phase 4: UI Components (Medium-term)

**Goal**: Move remaining UI to userland

**Components to migrate**:
- Item palette (`showItemList()`)
- Help dialog (`showHelp()`)
- Raw editor (`editItemRaw()` - keep minimal version in safe mode)

**Pattern for each**:
1. Create userland library or view
2. Remove kernel method
3. Update keyboard shortcuts to call new library
4. Document usage

### Phase 5: Bootstrap Hardening (Long-term)

**Goal**: Ensure system degrades gracefully when userland features missing

**Enhancements**:
- Expand bootstrap fallback styles to be more usable
- Add "feature not loaded" messages when features invoked but missing
- Create "starter pack" library that auto-loads common features
- Document minimal vs full system configurations

---

## Minimal Kernel Boot Sequence

After full migration, the kernel boot would look like this:

```javascript
async boot() {
  // 1. Initialize core infrastructure
  await this.storage.initialize();
  await this.ensureSeedItems();
  
  // 2. Check for safe mode
  const params = new URLSearchParams(window.location.search);
  this._safeMode = params.get('safe') === '1';
  
  if (this._safeMode) {
    // Recovery mode: minimal UI for fixing broken code
    this.safeMode.render(this.rootElement.querySelector('#main-view'));
    return;
  }
  
  // 3. Restore viewport state
  await this.viewport.restore();
  
  // 4. Setup event infrastructure
  this.setupDeclarativeWatches();
  
  // 5. Setup essential global handlers
  this.setupGlobalErrorHandlers();    // Robustness
  this.setupBrowserNavigation();      // URL navigation
  
  // 6. Render initial view
  const rootId = await this.getStartingRoot();
  if (rootId) {
    await this.navigateToItem(rootId);
  } else {
    await this.renderViewport();
  }
  
  // That's it! Everything else is userland.
}
```

**Removed from boot**:
- `applyStyles()` - Now userland library
- `repl.createContainer()` - Now userland library  
- Keyboard handlers - Now userland library
- No hardcoded UI components

**Total reduction**: ~150 lines removed from kernel-core, ~200 lines from kernel-repl

---

## Userland Initialization Pattern

### Pattern 1: Manual Initialization

User runs once in REPL to activate features:

```javascript
// Activate theming
const theme = await api.require('theme-hot-reload');
await theme.applyStyles(api);

// Activate REPL UI
const replUI = await api.require('repl-ui');
await replUI.activate(api);

// Activate keyboard shortcuts
const shortcuts = await api.require('keyboard-shortcuts');
shortcuts.activate(api);
```

### Pattern 2: Startup Script

Create a startup script that auto-initializes:

```javascript
{
  name: "system-startup",
  type: "library",
  content: {
    watches: [
      { event: "system:boot-complete" }  // If we add this event
    ],
    code: `
      export async function onSystemBootComplete({ }, api) {
        // Auto-initialize common features
        const theme = await api.require('theme-hot-reload');
        await theme.applyStyles(api);
        
        const replUI = await api.require('repl-ui');
        await replUI.activate(api);
        
        const shortcuts = await api.require('keyboard-shortcuts');
        shortcuts.activate(api);
        
        const palette = await api.require('item-palette');
        // Register with shortcuts
      }
    `
  }
}
```

Run startup script once to register its watch. On future boots, it auto-initializes.

### Pattern 3: Feature Pack

Create "batteries included" library that loads everything:

```javascript
{
  name: "standard-features",
  type: "library",
  content: {
    code: `
      export async function activate(api) {
        await activateFeature('theme-hot-reload', api);
        await activateFeature('repl-ui', api);
        await activateFeature('keyboard-shortcuts', api);
        await activateFeature('item-palette', api);
      }
      
      async function activateFeature(name, api) {
        try {
          const lib = await api.require(name);
          if (lib.activate) await lib.activate(api);
          if (lib.applyStyles) await lib.applyStyles(api);
        } catch (e) {
          console.warn(\`Feature \${name} not available:\`, e.message);
        }
      }
    `
  }
}
```

Single command to load everything: `await (await api.require('standard-features')).activate(api)`

---

## Implementation Checklist

### Phase 1: Theming ✓ (Design Complete)
- [ ] Define CSS variables in `kernel-styles`
- [ ] Create `theme-hot-reload` library
- [ ] Remove `applyStyles()` from kernel
- [ ] Add fallback styles to bootstrap
- [ ] Test: boot without theme, apply theme, edit colors
- [ ] Document: theming guide, pattern explanation

### Phase 2: REPL Infrastructure
- [ ] Audit `kernel-repl` - separate essential from UI
- [ ] Keep `createREPLAPI()` in kernel-core
- [ ] Create `repl-ui` library with container, toggle, history
- [ ] Remove REPL initialization from boot
- [ ] Test: boot without REPL, manually activate, verify functionality
- [ ] Document: REPL architecture, usage patterns

### Phase 3: Keyboard Shortcuts
- [ ] Create `keyboard-shortcuts` library
- [ ] Define default bindings as data
- [ ] Implement action dispatcher
- [ ] Remove keyboard handlers from kernel
- [ ] Test: boot, activate shortcuts, verify all actions work
- [ ] Document: customization guide, adding new shortcuts

### Phase 4: Item Palette
- [ ] Create `item-palette` library
- [ ] Implement search UI (fuzzy matching)
- [ ] Remove `showItemList()` from kernel
- [ ] Integrate with keyboard shortcuts
- [ ] Test: search, filter, navigate
- [ ] Document: usage, customization

### Phase 5: Help System
- [ ] Create help item(s) with content
- [ ] Create help view
- [ ] Remove `showHelp()` from kernel
- [ ] Integrate with keyboard shortcuts
- [ ] Test: open help, navigate sections
- [ ] Document: adding help content

### Phase 6: Raw Editor
- [ ] Create `json-editor` library (user-facing)
- [ ] Keep minimal editor in safe mode (recovery)
- [ ] Remove `editItemRaw()` from kernel
- [ ] Integrate with context menus
- [ ] Test: edit items, save, verify changes
- [ ] Document: editor features, alternatives

### Phase 7: Startup Patterns
- [ ] Create example startup script
- [ ] Create `standard-features` pack
- [ ] Add feature detection/loading helpers
- [ ] Document: initialization patterns, feature management
- [ ] Create "minimal" vs "full" configuration examples

---

## Benefits Realization

### For Users

**Discovery and Learning**:
- Users see how system features are built
- Can inspect, modify, or replace any feature
- Learn extension patterns by examining existing code
- System teaches itself through examples

**Customization**:
- Don't like the REPL? Replace it
- Want different keyboard shortcuts? Configure them
- Prefer different search UI? Build your own
- Every feature is optional and replaceable

**Simplicity**:
- Clear separation: kernel does infrastructure, everything else is application
- Smaller kernel = easier to understand essential concepts
- Features are just items, like everything else

### For Developers

**Maintainability**:
- Kernel changes infrequently (stable foundation)
- Features evolve independently in userland
- Clear boundaries reduce coupling
- Easier to test (userland doesn't need kernel modifications)

**Extensibility**:
- New features don't require kernel changes
- Pattern is established and documented
- Users can contribute features as libraries
- System grows through composition, not kernel bloat

**Correctness**:
- Smaller kernel = easier to audit
- Critical paths are shorter
- Fewer moving parts during boot
- Safe mode always works (no userland dependencies)

### For the System

**Philosophy**:
- "Everything is an item" - even system features
- Self-documenting - system demonstrates its own capabilities
- Self-modifying - every feature can be changed from within
- Humane Dozen alignment - transparent, modifiable, inspectable

**Architecture**:
- Clean layering: bootstrap → kernel → userland
- Kernel provides mechanisms, userland provides policies
- Progressive enhancement: system works at each layer
- Graceful degradation: missing features don't break system

**Future-proofing**:
- Kernel stays stable as needs evolve
- New paradigms can coexist (different REPL styles, editors, etc.)
- Users customize without forking
- System can adapt to different use cases (development, production, teaching, etc.)

---

## Success Metrics

### Kernel Simplicity
- **Lines of code**: Target 500-line reduction in kernel-core
- **Boot complexity**: Target 50-line `boot()` method
- **Method count**: Target 50% reduction in kernel-core methods
- **Module count**: Stay at 8 modules (reorganize, don't add)

### Userland Growth
- **Feature libraries**: Target 6+ new libraries
- **User-contributed**: Enable users to share feature libraries
- **Documentation**: Every feature has usage guide
- **Examples**: Demonstrate multiple implementation styles

### User Experience
- **Boot time**: No regression (should improve slightly)
- **Usability**: System remains fully functional
- **Discoverability**: Features easier to find and understand
- **Customization**: Users can modify/replace features

---

## Risks and Mitigations

### Risk: Bootstrap Experience Degradation
**Concern**: New users see unstyled system, no features
**Mitigation**:
- Improve bootstrap fallback styles (usable without theme)
- Create "Quick Start" import that includes standard features
- Document expected initialization flow
- Provide import bundles: minimal, standard, full

### Risk: Feature Discovery Problem
**Concern**: Users don't know what features exist or how to enable
**Mitigation**:
- Create feature catalog item type
- Build feature browser view
- Standard features are well-documented
- Startup scripts show activation patterns

### Risk: Initialization Complexity
**Concern**: Users need to run many commands to set up system
**Mitigation**:
- Provide feature pack libraries (one-command activation)
- Document startup script pattern (auto-initialization)
- Include examples in initial-kernel.json
- Create initialization wizard (future)

### Risk: Safe Mode Dependency
**Concern**: Safe mode needs to be bulletproof if features can break
**Mitigation**:
- Safe mode has no userland dependencies
- Safe mode provides minimal editing for all items
- Safe mode can enable/disable features
- Bootstrap always shows import UI if kernel missing

---

## Conclusion

Moving to a minimal kernel is not just a refactoring—it's a philosophical commitment to the idea that **Hobson is a platform for building applications, not an application itself**.

The kernel provides **mechanisms** (storage, events, rendering), while userland provides **policies** (what to render, how to style, which shortcuts to use).

This separation:
- Makes the system more understandable
- Demonstrates Hobson's extensibility 
- Enables user customization
- Reduces kernel complexity
- Aligns with the Humane Dozen principles

**The theming system (Phase 1) proves this pattern works.** Each subsequent phase builds confidence and establishes conventions.

By the end, Hobson will have a minimal, stable kernel that provides essential infrastructure, with a rich ecosystem of userland features that demonstrate what's possible.

**The kernel becomes the potter's wheel. Userland is where we make the bowls.**
