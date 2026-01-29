// Item: kernel-storage
// ID: 33333333-2222-0000-0000-000000000000
// Type: 33333333-0000-0000-0000-000000000000

// kernel-storage module
// Delegates all storage operations to the backend provided by the bootloader.
// The backend handles IndexedDB access and ID prefixing for nested instances.

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

  async _validateItem(item, kernel) {
    // See [item/atom](item://00000000-0000-0000-0000-000000000000)
    const ATOM_ID = kernel?.IDS?.ATOM || "00000000-0000-0000-0000-000000000000";

    // Validate type chain (must reach atom, no cycles)
    await this._validateTypeChain(item.type, new Set(), ATOM_ID);

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

  async _validateTypeChain(typeId, visited, ATOM_ID) {
    if (visited.has(typeId)) {
      throw new Error(`Circular type chain detected at: ${typeId}`);
    }

    visited.add(typeId);

    if (typeId === ATOM_ID) {
      return;
    }

    try {
      const typeItem = await this.get(typeId);
      await this._validateTypeChain(typeItem.type, visited, ATOM_ID);
    } catch (error) {
      if (error.message.includes("not found")) {
        throw new Error(`Type chain broken - item '${typeId}' not found`);
      }
      throw error;
    }
  }
}
