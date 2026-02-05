// Module System - See [Core Concepts - Code as Data](item://a0a0a0a0-d0c0-4000-8000-000000000002#description?region=Code)

// [BEGIN:ModuleSystem]
export class ModuleSystem {
  constructor(kernel) {
    this.kernel = kernel;
    this.moduleCache = new Map(); // itemId -> { module, timestamp, name }
    this.nameCache = new Map(); // name -> itemId (cached name resolution)
    this.loadingPromises = new Map(); // itemId -> Promise (tracks in-flight loads)
  }

  // Initialize event listeners for cache invalidation
  // Called by kernel after event system is ready
  initEventListeners() {
    // Listen for item updates to invalidate module cache
    this.kernel.events.on(this.kernel.EVENT_IDS.ITEM_UPDATED, (event) => {
      const id = event.content?.id;
      if (!id) return;

      // Invalidate module cache for changed item
      if (this.moduleCache.has(id)) {
        this.moduleCache.delete(id);
      }
      // Invalidate name cache if this item's name was cached
      for (const [name, cachedId] of this.nameCache) {
        if (cachedId === id) {
          this.nameCache.delete(name);
          break;
        }
      }
    });
  }

  // [BEGIN:require]
  // Load a code item as an ES module
  // See [Core Concepts - The Module System](item://a0a0a0a0-d0c0-4000-8000-000000000002#The-Module-System)
  async require(nameOrId, callStack = new Set()) {
    // Resolve name to ID if necessary
    let itemId = nameOrId;

    // Check if it's a name (not a UUID pattern)
    if (!nameOrId.includes("-") || nameOrId.length < 36) {
      // Check name cache first (avoids storage.query)
      const cachedId = this.nameCache.get(nameOrId);
      if (cachedId) {
        itemId = cachedId;
      } else {
        const items = await this.kernel.storage.query({ name: nameOrId });
        if (items.length === 0) {
          throw new Error(`Code item not found: ${nameOrId}`);
        }
        itemId = items[0].id;
        this.nameCache.set(nameOrId, itemId);
      }
    }

    // Check for circular dependencies
    if (callStack.has(itemId)) {
      const chain = Array.from(callStack).join(" -> ");
      throw new Error(`Circular dependency detected: ${chain} -> ${itemId}`);
    }

    // Check module cache first (avoids storage.get for cached modules)
    // Cache is invalidated via item:updated events, so we trust it
    const cached = this.moduleCache.get(itemId);
    if (cached) {
      return cached.module;
    }

    // Check if this module is already being loaded (prevents race condition)
    // This handles the case where multiple concurrent calls try to load the same module
    const inFlight = this.loadingPromises.get(itemId);
    if (inFlight) {
      return inFlight;
    }

    // Create the loading promise immediately to prevent race conditions
    // Other concurrent requires will hit the inFlight check above
    callStack.add(itemId);
    const loadPromise = (async () => {
      const item = await this.kernel.storage.get(itemId);
      const originalName = nameOrId !== itemId ? nameOrId : item.name;
      const module = await this.evaluateCodeItem(item, callStack);
      // Update cache on success
      this.moduleCache.set(itemId, {
        module,
        timestamp: item.modified,
        name: originalName
      });
      return module;
    })().finally(() => {
      // Always clean up in-flight tracking
      this.loadingPromises.delete(itemId);
      callStack.delete(itemId);
    });

    this.loadingPromises.set(itemId, loadPromise);
    return loadPromise;
  }
  // [END:require]

  // [BEGIN:evaluateCodeItem]
  // Compile and execute a code item as an ES module via blob URL
  async evaluateCodeItem(item) {
    if (!item.content?.code) {
      throw new Error(`Item ${item.id} has no code to evaluate`);
    }

    const code = `
      "use strict";
      ${item.content.code}
      //# sourceURL=${item.name || item.id}.js
    `;

    const blob = new Blob([code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);

    try {
      const module = await import(url);
      return module;
    } catch (error) {
      const wrappedError = new Error(`Failed to evaluate code item ${item.id} (${item.name}): ${error.message}`, { cause: error });
      wrappedError.stack = error.stack;

      // Capture error for logging/notification
      await this.kernel.captureError(wrappedError, {
        operation: 'require',
        itemId: item.id,
        itemName: item.name
      });

      throw wrappedError;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  // [END:evaluateCodeItem]

  // Capability check: is this item a code item?
  // Walks the extends chain of the item's type
  async isCodeItem(item) {
    return await this.typeChainIncludes(item.type, this.kernel.IDS.CODE);
  }

  // Build the extends chain for a type (for inheritance/capability checking)
  // Returns array of type IDs from the given type up to ITEM (root)
  // Falls back to walking 'type' field if 'extends' is not present (backwards compat)
  async buildExtendsChain(typeId) {
    const chain = [];
    let current = typeId;
    const visited = new Set();

    while (current && !visited.has(current)) {
      chain.push(current);
      visited.add(current);

      // Stop at ITEM (root)
      if (current === this.kernel.IDS.ITEM) break;

      try {
        const typeItem = await this.kernel.storage.get(current);
        
        // Prefer 'extends' field (new model)
        if (typeItem.extends !== undefined) {
          // null means root reached
          if (typeItem.extends === null) break;
          current = typeItem.extends;
        } else {
          // Fallback to 'type' field (old model) for backwards compatibility
          // Stop at TYPE_DEFINITION boundary to avoid meta-level (old heuristic)
          if (typeItem.type === this.kernel.IDS.TYPE_DEFINITION) break;
          current = typeItem.type;
        }
      } catch {
        break;
      }
    }

    return chain;
  }

  // [BEGIN:typeChainIncludes]
  // Check if a type's extends chain includes the target type
  // Used for capability detection (e.g., "is this item's type a code type?")
  async typeChainIncludes(typeId, targetId) {
    const chain = await this.buildExtendsChain(typeId);
    return chain.includes(targetId);
  }
  // [END:typeChainIncludes]

  // Get a cached module synchronously (returns null if not cached)
  // Use this for synchronous code paths that can't await require()
  getCached(nameOrId) {
    // For name lookups, we can't do async storage query, so only works with IDs
    // or if we've seen this name before in the cache (stored during require)
    for (const [itemId, cached] of this.moduleCache) {
      // Check if this cache entry matches by name (from previous load) or ID
      if (cached.name === nameOrId || itemId === nameOrId) {
        return cached.module;
      }
    }
    return null;
  }

  clearCache() {
    this.moduleCache.clear();
    this.nameCache.clear();
    this.loadingPromises.clear();
  }
}
// [END:ModuleSystem]
