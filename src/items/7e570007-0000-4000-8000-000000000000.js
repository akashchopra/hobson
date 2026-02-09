const NOTE_TYPE = '871ae771-b9b1-4f40-8c7f-d9038bfb69c3';
const STARRED_TAG = 'c0c0c0c0-0060-0000-0000-000000000000';

export async function run(api) {
  const { createSuite, assert, assertEquals } = await api.require('test-lib');
  const { testAsync, getResults } = createSuite('Tags & Attachments');

  async function storesAndRetrievesTags() {
    const id = crypto.randomUUID();
    await api.set({
      id,
      type: NOTE_TYPE,
      content: { description: 'Tagged item', tags: [STARRED_TAG] }
    });
    const item = await api.get(id);
    assert(Array.isArray(item.content.tags), 'Tags should be an array');
    assertEquals(item.content.tags.length, 1);
    assertEquals(item.content.tags[0], STARRED_TAG);
  }

  async function findsTaggedViaGetAll() {
    const id = crypto.randomUUID();
    await api.set({
      id,
      type: NOTE_TYPE,
      content: { description: 'Findable by tag', tags: [STARRED_TAG] }
    });
    const all = await api.getAll();
    const tagged = all.filter(i => i.content?.tags?.includes(STARRED_TAG));
    const found = tagged.find(i => i.id === id);
    assert(found, 'Should find the tagged item via getAll + filter');
  }

  async function untaggedItemHasNoTags() {
    const id = crypto.randomUUID();
    await api.set({
      id,
      type: NOTE_TYPE,
      content: { description: 'No tags here' }
    });
    const item = await api.get(id);
    const tags = item.content?.tags;
    assert(!tags || tags.length === 0, 'Untagged item should have no tags');
  }

  async function attachesChild() {
    const parentId = crypto.randomUUID();
    const childId = crypto.randomUUID();
    await api.set({ id: parentId, type: NOTE_TYPE, content: { description: 'Parent' }, attachments: [] });
    await api.set({ id: childId, type: NOTE_TYPE, content: { description: 'Child' } });

    await api.attach(parentId, childId);

    const parent = await api.get(parentId);
    assert(Array.isArray(parent.attachments), 'Parent should have attachments array');
    const found = parent.attachments.find(a => a.id === childId);
    assert(found, 'Parent attachments should include the child');
  }

  async function detachesChild() {
    const parentId = crypto.randomUUID();
    const childId = crypto.randomUUID();
    await api.set({ id: parentId, type: NOTE_TYPE, content: { description: 'Parent' }, attachments: [] });
    await api.set({ id: childId, type: NOTE_TYPE, content: { description: 'Child' } });

    await api.attach(parentId, childId);
    await api.detach(parentId, childId);

    const parent = await api.get(parentId);
    const found = parent.attachments.find(a => a.id === childId);
    assert(!found, 'Child should be removed from parent attachments after detach');
  }

  async function attachIsIdempotent() {
    const parentId = crypto.randomUUID();
    const childId = crypto.randomUUID();
    await api.set({ id: parentId, type: NOTE_TYPE, content: { description: 'Parent' }, attachments: [] });
    await api.set({ id: childId, type: NOTE_TYPE, content: { description: 'Child' } });

    await api.attach(parentId, childId);
    await api.attach(parentId, childId);

    const parent = await api.get(parentId);
    const count = parent.attachments.filter(a => a.id === childId).length;
    assertEquals(count, 1, 'Child should appear exactly once even after double attach');
  }

  async function findContainerOfFindsParent() {
    const parentId = crypto.randomUUID();
    const childId = crypto.randomUUID();
    await api.set({ id: parentId, type: NOTE_TYPE, content: { description: 'Parent' }, attachments: [] });
    await api.set({ id: childId, type: NOTE_TYPE, content: { description: 'Child' } });

    await api.attach(parentId, childId);

    const container = await api.findContainerOf(childId);
    assert(container, 'findContainerOf should return the parent');
    assertEquals(container.id, parentId);
  }

  await testAsync('stores and retrieves tags', storesAndRetrievesTags);
  await testAsync('finds tagged items via getAll + filter', findsTaggedViaGetAll);
  await testAsync('item with no tags has empty/missing tags', untaggedItemHasNoTags);
  await testAsync('attaches a child to a parent', attachesChild);
  await testAsync('detaches a child from a parent', detachesChild);
  await testAsync('attach is idempotent', attachIsIdempotent);
  await testAsync('findContainerOf finds parent', findContainerOfFindsParent);

  return getResults();
}
