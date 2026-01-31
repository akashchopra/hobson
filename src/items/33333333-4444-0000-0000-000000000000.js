// Item: kernel:module-system
// ID: 33333333-4444-0000-0000-000000000000
// Type: 33333333-0000-0000-0000-000000000000

// kernel-module-system module
export class ModuleSystem {
  constructor(kernel) {
    this.kernel = kernel;
    this.moduleCache = new Map(); // itemId -> { module, timestamp }
    this.loadingPromises = new Map(); // itemId -> Promise (tracks in-flight loads)
  }

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
    const loadPromise = this.evaluateCodeItem(item, callStack)
      .then(module => {
        // Update cache on success
        this.moduleCache.set(itemId, {
          module,
          timestamp: item.modified
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

  // Capability check: is this item a code item?
  // Uses bounded type chain walking (stops at type_definition boundary)
  async isCodeItem(item) {
    return await this.typeChainIncludes(item.type, this.kernel.IDS.CODE);
  }

  // Walk type chain for capability/subtype detection.
  // Stops at type_definition boundary to avoid crossing into meta-level.
  // e.g., note_view → view → code (stop here, code.type = type_definition)
  // So "is note_view code?" = yes, but "is note_view type_definition?" = no
  async typeChainIncludes(typeId, targetId) {
    let current = typeId;
    const visited = new Set();

    while (current && !visited.has(current)) {
      if (current === targetId) return true;
      visited.add(current);

      if (current === this.kernel.IDS.ATOM) break;

      try {
        const typeItem = await this.kernel.storage.get(current);

        // Stop at type_definition boundary: if this item IS a type definition
        // (its type is TYPE_DEFINITION), don't walk further into meta-level
        if (typeItem.type === this.kernel.IDS.TYPE_DEFINITION) break;

        current = typeItem.type;
      } catch {
        break;
      }
    }

    return false;
  }

  clearCache() {
    this.moduleCache.clear();
    this.loadingPromises.clear();
  }
}
