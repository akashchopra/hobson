// Item: kernel:module-system
// ID: 33333333-4444-0000-0000-000000000000
// Type: 33333333-0000-0000-0000-000000000000

// Module System - See [Core Concepts - Code as Data](item://a0a0a0a0-d0c0-4000-8000-000000000002#description?region=Code)

// [BEGIN:ModuleSystem]
export class ModuleSystem {
  constructor(kernel) {
    this.kernel = kernel;
    this.moduleCache = new Map(); // itemId -> { module, timestamp }
    this.loadingPromises = new Map(); // itemId -> Promise (tracks in-flight loads)
  }

  // [BEGIN:require]
  // Load a code item as an ES module
  // See [Core Concepts - The Module System](item://a0a0a0a0-d0c0-4000-8000-000000000002#The-Module-System)
  async require(nameOrId, callStack = new Set()) {
    // Resolve name to ID if necessary
    let itemId = nameOrId;

    // Check if it's a name (not a UUID pattern)
    if (!nameOrId.includes("-") || nameOrId.length < 36) {
      const items = await this.kernel.storage.query({ name: nameOrId });
      if (items.length === 0) {
        throw new Error(`Code item not found: ${nameOrId}`);
      }
      itemId = items[0].id;
    }

    // Check for circular dependencies
    if (callStack.has(itemId)) {
      const chain = Array.from(callStack).join(" -> ");
      throw new Error(`Circular dependency detected: ${chain} -> ${itemId}`);
    }

    // Check cache first
    const item = await this.kernel.storage.get(itemId);
    const cached = this.moduleCache.get(itemId);

    // Return cached module if fresh
    if (cached && cached.timestamp >= item.modified) {
      return cached.module;
    }

    // Check if this module is already being loaded (prevents race condition)
    // This handles the case where multiple concurrent calls try to load the same module
    const inFlight = this.loadingPromises.get(itemId);
    if (inFlight) {
      return inFlight;
    }

    // Start loading and track the promise
    callStack.add(itemId);
    const originalName = nameOrId !== itemId ? nameOrId : item.name;
    const loadPromise = this.evaluateCodeItem(item, callStack)
      .then(module => {
        // Update cache on success, including name for getCached lookups
        this.moduleCache.set(itemId, {
          module,
          timestamp: item.modified,
          name: originalName
        });
        return module;
      })
      .finally(() => {
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
    this.loadingPromises.clear();
  }
}
// [END:ModuleSystem]
