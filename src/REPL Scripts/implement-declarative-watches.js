// Implement declarative event watches in kernel-core
const item = await kernel.storage.get('33333333-1111-0000-0000-000000000000');

let code = item.content.code;

// ============================================================================
// Step 1: Add new methods before reloadKernel()
// ============================================================================

const declarativeWatchesMethods = `
    // -------------------------------------------------------------------------
    // Declarative Event Watches
    // -------------------------------------------------------------------------

    setupDeclarativeWatches() {
      // Register wildcard listener for all item events
      this.events.on('item:*', async ({ event, ...data }) => {
        await this.dispatchToWatchers(event, data);
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
          console.warn(\`Watcher \${watcherItem.name || watcherItem.id} has no \${handlerName} handler\`);
          return;
        }

        // Create API for the handler (similar to renderer API)
        const api = this.rendering.createRendererAPI(watcherItem);

        // Call the handler
        await module[handlerName](eventData, api);
      } catch (error) {
        console.error(\`Error calling watch handler on \${watcherItem.name || watcherItem.id}:\`, error);
      }
    }

    eventToHandlerName(eventType) {
      // "item:deleted" -> "onItemDeleted"
      // "item:created" -> "onItemCreated"
      // "custom:something" -> "onCustomSomething"
      const parts = eventType.split(':');
      const camelParts = parts.map((part, i) =>
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      );
      return 'on' + camelParts.join('');
    }

`;

// Insert before reloadKernel
const reloadKernelMarker = 'reloadKernel() {\n      window.postMessage';
if (!code.includes(reloadKernelMarker)) {
  throw new Error('Could not find reloadKernel() insertion point');
}
code = code.replace(reloadKernelMarker, declarativeWatchesMethods + '    reloadKernel() {\n      window.postMessage');

// ============================================================================
// Step 2: Add setupDeclarativeWatches() call at end of boot()
// ============================================================================

// Find the last statement in the else branch of boot() (before the closing braces)
// The pattern is: after the innerHTML assignment and before "}\n    }\n    \n    async ensureSeedItems"
const bootEndMarker = '}\n      }\n    }\n    \n    async ensureSeedItems()';
if (!code.includes(bootEndMarker)) {
  throw new Error('Could not find boot() end insertion point');
}
code = code.replace(
  bootEndMarker,
  `}

        // Setup declarative event watches
        this.setupDeclarativeWatches();
      }
    }

    async ensureSeedItems()`
);

// ============================================================================
// Step 3: Save the updated code
// ============================================================================

item.content.code = code;
item.modified = Date.now();
await kernel.storage.set(item, kernel);

console.log('Successfully updated kernel-core with declarative event watches support');
console.log('Reload the kernel to activate: kernel.reloadKernel()');
