// Item: kernel-module-system
// ID: 33333333-4444-0000-0000-000000000000
// Type: 33333333-0000-0000-0000-000000000000

// kernel-module-system module
export class ModuleSystem {
  constructor(kernel) {
    this.kernel = kernel;
    this.moduleCache = new Map(); // itemId -> { module, timestamp }
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
    
    // Check cache
    const cached = this.moduleCache.get(itemId);
    const item = await this.kernel.storage.get(itemId);
    
    // Validate cache freshness
    if (cached && cached.timestamp >= item.modified) {
      return cached.module;
    }
    
    // Re-evaluate
    callStack.add(itemId);
    const module = await this.evaluateCodeItem(item, callStack);
    callStack.delete(itemId);
    
    // Update cache
    this.moduleCache.set(itemId, {
      module,
      timestamp: item.modified
    });
    
    return module;
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
  
  async isCodeItem(item) {
    return await this.typeChainIncludes(item.type, this.kernel.IDS.CODE);
  }
  
  async typeChainIncludes(typeId, targetId) {
    let current = typeId;
    const visited = new Set();
    
    while (current && !visited.has(current)) {
      if (current === targetId) return true;
      visited.add(current);
      
      if (current === this.kernel.IDS.ATOM) break;
      
      try {
        const typeItem = await this.kernel.storage.get(current);
        current = typeItem.type;
      } catch {
        break;
      }
    }
    
    return false;
  }
  
  clearCache() {
    this.moduleCache.clear();
  }
}
