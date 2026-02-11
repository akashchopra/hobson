const HOBSON_INSTANCE_TYPE = '99999999-0000-0000-0000-000000000000';

/**
 * Create a nested Hobson instance, populate it, open it, and return a handle.
 *
 * Item selection (pick one, checked in this order):
 *   options.items  — explicit array of items
 *   options.filter — predicate (item) => boolean applied to api.getAll()
 *   (default)      — all items from api.getAll()
 *
 * Other options:
 *   options.name    — instance item name (default: 'Hobson Instance')
 *   options.timeout — boot timeout in ms (default: 30000)
 */
export async function create(api, options = {}) {
  const id = crypto.randomUUID();
  const name = options.name || 'Hobson Instance';
  const timeout = options.timeout || 30000;

  // Resolve items to populate
  let items;
  if (options.items) {
    items = options.items;
  } else if (options.filter) {
    const all = await api.getAll();
    items = all.filter(options.filter);
  } else {
    items = await api.getAll();
  }

  // Populate IndexedDB namespace
  await populate(id, items);

  // Create the instance item and open it
  await api.set({
    id,
    name,
    type: HOBSON_INSTANCE_TYPE,
    content: {},
    attachments: []
  }, { silent: true });

  await api.openItem(id);

  // Build and return the handle
  return {
    id,

    onMessage(type, handler) {
      function listener(e) {
        if (e.data?.type === type && e.data?.instanceId === id) {
          handler(e.data);
        }
      }
      window.addEventListener('message', listener);
      return () => window.removeEventListener('message', listener);
    },

    waitForMessage(type, msgTimeout) {
      const t = msgTimeout || timeout;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          window.removeEventListener('message', listener);
          reject(new Error(`Timed out waiting for ${type}`));
        }, t);

        function listener(e) {
          if (e.data?.type === type && e.data?.instanceId === id) {
            clearTimeout(timer);
            window.removeEventListener('message', listener);
            resolve(e.data);
          }
        }

        window.addEventListener('message', listener);
      });
    },

    async destroy() {
      await api.delete(id);
    }
  };
}

/**
 * Low-level: write items into a nested instance's IndexedDB namespace.
 * Bypasses the kernel to avoid side effects.
 */
export async function populate(instanceId, items) {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('hobson');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const tx = db.transaction('items', 'readwrite');
  const store = tx.objectStore('items');
  const prefix = `${instanceId}:`;

  for (const item of items) {
    store.put({ ...item, id: prefix + item.id });
  }

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}
