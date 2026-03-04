// Hob Integration Tests
// Tests item operations and REPL integration using a mock API

export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals } = await api.require('test-lib');
  const { testAsync, getResults } = createSuite('Hob Integration');
  const hob = await api.require('hob-interpreter');

  // Mock item store
  function createMockApi() {
    const store = new Map();

    // Pre-populate with a test item
    store.set('test-note-id', {
      id: 'test-note-id',
      name: 'Test Note',
      type: '871ae771-b9b1-4f40-8c7f-d9038bfb69c3',
      content: { description: 'Hello from test' },
      attachments: []
    });

    return {
      get: async (id) => {
        const item = store.get(id);
        if (!item) throw new Error(`Item not found: ${id}`);
        return JSON.parse(JSON.stringify(item));
      },
      set: async (item) => {
        store.set(item.id, JSON.parse(JSON.stringify(item)));
        return item.id;
      },
      delete: async (id) => {
        store.delete(id);
      },
      getAll: async () => {
        return [...store.values()].map(i => JSON.parse(JSON.stringify(i)));
      },
      query: async (filter) => {
        const all = [...store.values()];
        if (filter.name) {
          return all.filter(i => i.name === filter.name).map(i => JSON.parse(JSON.stringify(i)));
        }
        return all.map(i => JSON.parse(JSON.stringify(i)));
      },
      _store: store
    };
  }

  // --- Item Operations ---

  async function getItem() {
    const mockApi = createMockApi();
    const interp = hob.createInterpreter(mockApi);
    const result = await interp.eval('(get-item "test-note-id")');
    assert(result !== null, 'Should return an item');
    assertEquals(result.name, 'Test Note');
    assertEquals(result.id, 'test-note-id');
  }

  async function setItem() {
    const mockApi = createMockApi();
    const interp = hob.createInterpreter(mockApi);
    // Use string keys (not keywords) so the JS object has "id", "name" etc.
    const result = await interp.eval('(set-item! {"id" "new-item" "name" "New Item" "type" "871ae771-b9b1-4f40-8c7f-d9038bfb69c3" "content" {"description" "Created from Hob"} "attachments" []})');
    assert(result !== null, 'Should return the item');
    // Verify it was stored
    const stored = await mockApi.get('new-item');
    assert(stored !== null, 'Item should be in store');
  }

  async function deleteItem() {
    const mockApi = createMockApi();
    const interp = hob.createInterpreter(mockApi);
    await interp.eval('(delete-item! "test-note-id")');
    let caught = false;
    try { await mockApi.get('test-note-id'); } catch { caught = true; }
    assert(caught, 'Item should be deleted');
  }

  async function getAll() {
    const mockApi = createMockApi();
    const interp = hob.createInterpreter(mockApi);
    const result = await interp.eval('(get-all)');
    assert(Array.isArray(result), 'Should return array');
    assert(result.length >= 1, 'Should have at least one item');
  }

  async function findItems() {
    const mockApi = createMockApi();
    const interp = hob.createInterpreter(mockApi);
    const result = await interp.eval('(find-items {:name "Test Note"})');
    assert(Array.isArray(result), 'Should return array');
    assertEquals(result.length, 1);
    assertEquals(result[0].name, 'Test Note');
  }

  // --- Item Reference Resolution ---

  async function itemRefByName() {
    const mockApi = createMockApi();
    const interp = hob.createInterpreter(mockApi);
    // @Test Note should be resolved by name query... but item refs use symbol-like names
    // Let's add an item with a simple name
    await mockApi.set({ id: 'simple-id', name: 'simple-item', type: 'test', content: {}, attachments: [] });
    const result = await interp.eval('@simple-item');
    assert(result !== null, 'Should resolve item ref');
    assertEquals(result.name, 'simple-item');
  }

  async function itemRefByUUID() {
    const mockApi = createMockApi();
    const interp = hob.createInterpreter(mockApi);
    // Add an item with a UUID-format id and resolve it by UUID
    await mockApi.set({ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'UUID Item', type: 'test', content: {}, attachments: [] });
    const result = await interp.eval('@a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    assert(result !== null, 'Should resolve UUID item ref');
    assertEquals(result.name, 'UUID Item');
  }

  async function itemRefUnresolvable() {
    const mockApi = createMockApi();
    const interp = hob.createInterpreter(mockApi);
    let caught = false;
    try { await interp.eval('@nonexistent-item'); } catch (e) { caught = true; assert(e.message.includes('resolve'), 'Should mention resolve'); }
    assert(caught, 'Should throw on unresolvable item ref');
  }

  // --- Printer round-trip ---

  async function printerRoundTrip() {
    assertEquals(hob.prStr(42), '42');
    assertEquals(hob.prStr('hello'), '"hello"');
    assertEquals(hob.prStr(null), 'nil');
    assertEquals(hob.prStr(true), 'true');
    assertEquals(hob.prStr([1, 2, 3]), '[1 2 3]');
    assertEquals(hob.prStr(hob.keyword('foo')), ':foo');
  }

  // --- REPL eval entry point ---

  async function replEvalEntryPoint() {
    const mockApi = createMockApi();
    const interp = hob.createInterpreter(mockApi);
    // Test the main eval entry point that REPL uses
    const result = await interp.eval('(+ 1 2)');
    assertEquals(result, 3);
  }

  async function replEvalMultipleExpressions() {
    const mockApi = createMockApi();
    const interp = hob.createInterpreter(mockApi);
    // Multiple expressions — returns last
    const result = await interp.eval('(def x 10) (def y 20) (+ x y)');
    assertEquals(result, 30);
  }

  // --- Run all tests ---

  await testAsync('get-item', getItem);
  await testAsync('set-item!', setItem);
  await testAsync('delete-item!', deleteItem);
  await testAsync('get-all', getAll);
  await testAsync('find-items', findItems);
  await testAsync('item ref by name', itemRefByName);
  await testAsync('item ref by UUID', itemRefByUUID);
  await testAsync('unresolvable item ref', itemRefUnresolvable);
  await testAsync('printer round-trip', printerRoundTrip);
  await testAsync('REPL eval entry point', replEvalEntryPoint);
  await testAsync('REPL eval multiple expressions', replEvalMultipleExpressions);

  return getResults();
}
