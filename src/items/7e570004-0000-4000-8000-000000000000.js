const NOTE_TYPE = '871ae771-b9b1-4f40-8c7f-d9038bfb69c3';

export async function run(api) {
  const { createSuite, assert, assertEquals } = await api.require('test-lib');
  const { testAsync, getResults } = createSuite('Storage');
  const created = [];

  async function createsAnItem() {
    const id = crypto.randomUUID();
    const item = await api.set({
      id,
      type: NOTE_TYPE,
      content: { description: 'Test note for storage-tests' }
    });
    created.push(id);
    assert(item, 'set() should return the item');
    assertEquals(item.id, id, 'Returned item should have correct id');
    assert(item.created, 'Returned item should have created timestamp');
    assert(item.modified, 'Returned item should have modified timestamp');
  }

  async function retrievesAnItem() {
    const id = created[0];
    assert(id, 'Need a previously created item');
    const item = await api.get(id);
    assert(item, 'get() should return the item');
    assertEquals(item.id, id);
    assertEquals(item.type, NOTE_TYPE);
    assertEquals(item.content.description, 'Test note for storage-tests');
  }

  async function updatesAnItem() {
    const id = created[0];
    const before = await api.get(id);
    await new Promise(r => setTimeout(r, 10));
    const updated = await api.set({
      ...before,
      content: { ...before.content, description: 'Updated description' }
    });
    assert(updated.modified >= before.modified, 'modified should be >= original');
    assertEquals(updated.content.description, 'Updated description');
  }

  async function queriesByType() {
    const results = await api.query({ type: NOTE_TYPE });
    assert(Array.isArray(results), 'query() should return an array');
    const found = results.find(i => i.id === created[0]);
    assert(found, 'Query results should include the created item');
  }

  async function overwritesAnItem() {
    const id = created[0];
    const replaced = await api.set({
      id,
      type: NOTE_TYPE,
      content: { description: 'Completely replaced' }
    });
    assertEquals(replaced.id, id, 'Should keep the same id');
    assertEquals(replaced.content.description, 'Completely replaced');
  }

  await testAsync('creates an item via set()', createsAnItem);
  await testAsync('retrieves an item via get()', retrievesAnItem);
  await testAsync('updates an item', updatesAnItem);
  await testAsync('queries items by type', queriesByType);
  await testAsync('overwrites an item via set()', overwritesAnItem);

  return getResults();
}
