// Item: kernel:storage
// ID: 33333333-2222-0000-0000-000000000000
// Type: 33333333-0000-0000-0000-000000000000

// kernel-storage module
// See [Architecture Overview - Storage Architecture](item://a0a0a0a0-d0c0-4000-8000-000000000003#Storage-Architecture)
// Delegates all storage operations to the backend provided by the bootloader.
// The backend handles IndexedDB access and ID prefixing for nested instances.

// [BEGIN:Storage]
export class Storage {
  constructor(backend) {
    this.backend = backend;
  }

  get instanceId() {
    return this.backend.instanceId || null;
  }

  async initialize() {
    // Backend is already initialized by the bootloader
  }

  async get(id) {
    const result = await this.backend.get(id);
    if (!result) {
      throw new Error(`Item not found: ${id}`);
    }
    return result;
  }

  async set(item, kernel) {
    await this._validateItem(item, kernel);
    return this.backend.set(item);
  }

  async delete(id) {
    return this.backend.delete(id);
  }

  async query(filter) {
    return this.backend.query(filter);
  }

  async getAll() {
    return this.backend.getAll();
  }

  async getAllRaw() {
    if (this.backend.getAllRaw) {
      return this.backend.getAllRaw();
    }
    return this.backend.getAll();
  }

  async deleteByPrefix(prefix) {
    const allItems = await this.getAllRaw();
    const toDelete = allItems.filter(item => item.id.startsWith(prefix));
    for (const item of toDelete) {
      await this.delete(item.id);
    }
    return toDelete.length;
  }

  async exists(id) {
    try {
      await this.get(id);
      return true;
    } catch {
      return false;
    }
  }

  // [BEGIN:validateItem]
  // Validates items before storage - type chain and name uniqueness
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
