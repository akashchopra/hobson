// Update kernel-storage to add getAllRaw and queryRaw methods
const item = await kernel.storage.get('33333333-2222-0000-0000-000000000000');

item.content.code = `// kernel-storage module
export class Storage {
  constructor(backend) {
    this.backend = backend;

    // Direct IndexedDB mode (when no backend provided)
    if (!backend) {
      this.db = null;
      this.dbName = "hobson";
      this.storeName = "items";
    }
  }

  async initialize() {
    // If using a backend adapter, no initialization needed
    if (this.backend) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 2);

      request.onerror = () => reject(new Error("Failed to open database"));

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("type", "type", { unique: false });
          store.createIndex("modified", "modified", { unique: false });
          store.createIndex("name", "name", { unique: false });
        }
      };
    });
  }

  async get(id) {
    if (this.backend) {
      return this.backend.get(id);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onerror = () => reject(new Error(\`Failed to get item: \${id}\`));
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          reject(new Error(\`Item not found: \${id}\`));
        }
      };
    });
  }

  async set(item, kernel) {
    // Validation before saving
    await this._validateItem(item, kernel);

    if (this.backend) {
      return this.backend.set(item);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(item);

      request.onerror = () => reject(new Error(\`Failed to save item: \${item.id}\`));
      request.onsuccess = () => resolve();
    });
  }

  async delete(id) {
    if (this.backend) {
      return this.backend.delete(id);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onerror = () => reject(new Error(\`Failed to delete item: \${id}\`));
      request.onsuccess = () => resolve();
    });
  }

  async query(filter) {
    if (this.backend) {
      return this.backend.query(filter);
    }

    const all = await this.getAll();
    return all.filter(item => {
      for (const [key, value] of Object.entries(filter)) {
        if (item[key] !== value) return false;
      }
      return true;
    });
  }

  async queryRaw(filter) {
    if (this.backend?.queryRaw) {
      return this.backend.queryRaw(filter);
    }
    // Fall back to query if no backend or no queryRaw
    return this.query(filter);
  }

  async getAll() {
    if (this.backend) {
      return this.backend.getAll();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(new Error("Failed to get all items"));
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async getAllRaw() {
    if (this.backend?.getAllRaw) {
      return this.backend.getAllRaw();
    }
    // Fall back to getAll if no backend or no getAllRaw
    return this.getAll();
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
    const IDS = {
      ATOM: "00000000-0000-0000-0000-000000000000",
      TYPE_DEFINITION: "11111111-0000-0000-0000-000000000000",
      CODE: "22222222-0000-0000-0000-000000000000"
    };

    // 1. Validate type chain (must reach atom, no cycles)
    await this._validateTypeChain(item.type, new Set(), IDS.ATOM);

    // 2. If code item, validate name uniqueness within the same namespace
    if (kernel && await kernel.isCodeItem(item)) {
      if (!item.name) {
        throw new Error(\`Code item \${item.id} must have a name\`);
      }

      // Extract namespace from item ID (everything before first colon, or empty if no colon)
      const itemNamespace = item.id.includes(':') ? item.id.split(':')[0] : '';

      const existing = await this.query({ name: item.name });
      const conflict = existing.find(i => {
        if (i.id === item.id) return false; // Same item, not a conflict

        // Extract namespace from existing item
        const existingNamespace = i.id.includes(':') ? i.id.split(':')[0] : '';

        // Only conflict if in same namespace
        return existingNamespace === itemNamespace;
      });

      if (conflict) {
        throw new Error(\`Code item named '\${item.name}' already exists in this namespace (id: \${conflict.id})\`);
      }
    }
  }

  async _validateTypeChain(typeId, visited, ATOM_ID) {
    if (visited.has(typeId)) {
      throw new Error(\`Circular type chain detected at: \${typeId}\`);
    }

    visited.add(typeId);

    // Self-referential atom is valid
    if (typeId === ATOM_ID) {
      return;
    }

    try {
      const typeItem = await this.get(typeId);
      await this._validateTypeChain(typeItem.type, visited, ATOM_ID);
    } catch (error) {
      if (error.message.includes("not found")) {
        throw new Error(\`Type chain broken - item '\${typeId}' not found\`);
      }
      throw error;
    }
  }
}
`;

item.modified = Date.now();
await kernel.storage.set(item, kernel);
console.log('Updated kernel-storage with getAllRaw and queryRaw methods');
