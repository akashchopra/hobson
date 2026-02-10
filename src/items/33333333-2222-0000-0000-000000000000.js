// kernel-storage module
// See [Architecture Overview - Storage Architecture](item://a0a0a0a0-d0c0-4000-8000-000000000003#Storage-Architecture)
// Delegates all storage operations to the backend provided by the bootloader.
// The backend handles IndexedDB access and ID prefixing for nested instances.

// [BEGIN:Storage]
/** Storage layer — delegates to the IndexedDB backend, with in-memory caching. */
export class Storage {
  constructor(backend) {
    this.backend = backend;
    this._cache = new Map();
    this._allCached = false;
  }

  /** Get the nested instance ID (null for main instance).
   * @returns {string|null}
   */
  get instanceId() {
    return this.backend.instanceId || null;
  }

  /** Initialize storage (no-op — backend is initialized by bootloader). */
  async initialize() {
    // Backend is already initialized by the bootloader
  }

  /** Retrieve an item by ID. Throws if not found.
   * @param {string} id - Item GUID
   * @returns {Promise<Object>} The item
   */
  async get(id) {
    const cached = this._cache.get(id);
    if (cached) return cached;
    const result = await this.backend.get(id);
    if (!result) {
      throw new Error(`Item not found: ${id}`);
    }
    this._cache.set(id, result);
    return result;
  }

  /** Validate and persist an item.
   * @param {Object} item - The item to save
   * @param {Object} [kernel] - Kernel reference for validation context
   */
  async set(item, kernel) {
    await this._validateItem(item, kernel);
    await this.backend.set(item);
    this._cache.set(item.id, item);
  }

  /** Delete an item from storage and cache.
   * @param {string} id - Item GUID to delete
   */
  async delete(id) {
    this._cache.delete(id);
    return this.backend.delete(id);
  }

  /** Find items matching a filter object (key-value pairs matched against item fields).
   * @param {Object} filter - e.g. {type: "...", name: "..."}
   * @returns {Promise<Object[]>} Matching items (excludes nested instance items)
   */
  async query(filter) {
    if (this._allCached) {
      // Match backend behavior: exclude nested instance items (have ':' in ID)
      const items = [];
      for (const item of this._cache.values()) {
        if (!item.id.includes(':')) items.push(item);
      }
      return items.filter(item => {
        for (const [key, value] of Object.entries(filter)) {
          if (item[key] !== value) return false;
        }
        return true;
      });
    }
    return this.backend.query(filter);
  }

  /** Get all items (excludes nested instance items). Populates cache on first call.
   * @returns {Promise<Object[]>}
   */
  async getAll() {
    if (this._allCached) {
      const items = [];
      for (const item of this._cache.values()) {
        if (!item.id.includes(':')) items.push(item);
      }
      return items;
    }
    const items = await this.backend.getAll();
    for (const item of items) {
      this._cache.set(item.id, item);
    }
    this._allCached = true;
    return items;
  }

  /** Get all items including nested instance items.
   * @returns {Promise<Object[]>}
   */
  async getAllRaw() {
    if (this.backend.getAllRaw) {
      return this.backend.getAllRaw();
    }
    return this.backend.getAll();
  }

  /** Delete all items whose ID starts with a prefix.
   * @param {string} prefix - ID prefix to match
   * @returns {Promise<number>} Number of items deleted
   */
  async deleteByPrefix(prefix) {
    const allItems = await this.getAllRaw();
    const toDelete = allItems.filter(item => item.id.startsWith(prefix));
    for (const item of toDelete) {
      await this.delete(item.id);
    }
    return toDelete.length;
  }

  /** Check if an item exists in storage.
   * @param {string} id - Item GUID
   * @returns {Promise<boolean>}
   */
  async exists(id) {
    if (this._cache.has(id)) return true;
    try {
      await this.get(id);
      return true;
    } catch {
      return false;
    }
  }

  // [BEGIN:validateItem]
  /** Validate an item before storage — checks type chain and code name uniqueness.
   * @param {Object} item - The item to validate
   * @param {Object} [kernel] - Kernel reference for code item checks
   */
  async _validateItem(item, kernel) {
    // See [item/atom](item://00000000-0000-0000-0000-000000000000)
    const ITEM_ID = kernel?.IDS?.ITEM || "00000000-0000-0000-0000-000000000000";
    const TYPE_DEFINITION_ID = kernel?.IDS?.TYPE_DEFINITION || "11111111-0000-0000-0000-000000000000";

    // Validate type chain (must reach a valid root, no unexpected cycles)
    await this._validateTypeChain(item.type, new Set(), ITEM_ID, TYPE_DEFINITION_ID);

    // If code item, validate name uniqueness within the same namespace
    if (kernel && await kernel.isCodeItem(item)) {
      if (!item.name) {
        throw new Error(`Code item ${item.id} must have a name`);
      }

      const itemNamespace = item.id.includes(':') ? item.id.split(':')[0] : '';
      const existing = await this.query({ name: item.name });
      const conflict = existing.find(i => {
        if (i.id === item.id) return false;
        const existingNamespace = i.id.includes(':') ? i.id.split(':')[0] : '';
        return existingNamespace === itemNamespace;
      });

      if (conflict) {
        throw new Error(`Code item named '${item.name}' already exists in this namespace (id: ${conflict.id})`);
      }
    }
  }
  // [END:validateItem]

  // [BEGIN:validateTypeChain]
  async _validateTypeChain(typeId, visited, ITEM_ID, TYPE_DEFINITION_ID) {
    // Valid termination points:
    // - ITEM (old model: atom.type = atom)
    // - TYPE_DEFINITION (new model: type-definition.type = type-definition)
    if (typeId === ITEM_ID || typeId === TYPE_DEFINITION_ID) {
      return;
    }

    if (visited.has(typeId)) {
      throw new Error(`Circular type chain detected at: ${typeId}`);
    }

    visited.add(typeId);

    try {
      const typeItem = await this.get(typeId);
      await this._validateTypeChain(typeItem.type, visited, ITEM_ID, TYPE_DEFINITION_ID);
    } catch (error) {
      if (error.message.includes("not found")) {
        throw new Error(`Type chain broken - item '${typeId}' not found`);
      }
      throw error;
    }
  }
  // [END:validateTypeChain]
}
// [END:Storage]
