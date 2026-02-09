const NOTE_TYPE = '871ae771-b9b1-4f40-8c7f-d9038bfb69c3';

export async function run(api) {
  const { createSuite, assert, waitFor } = await api.require('test-lib');
  const { testAsync, getResults } = createSuite('Note Rendering');

  await testAsync('renders a note without crashing', async () => {
    const id = crypto.randomUUID();
    await api.set({
      id,
      type: NOTE_TYPE,
      content: { description: 'Render test note' }
    });
    const el = await api.openViewport(id);
    try {
      assert(el, 'openViewport should return a DOM element');
      assert(el.children.length > 0, 'Rendered note should have child elements');
    } finally {
      api.closeViewport(el);
      await api.delete(id);
    }
  });

  await testAsync('renders note title', async () => {
    const id = crypto.randomUUID();
    await api.set({
      id,
      name: 'Test Title XYZ',
      type: NOTE_TYPE,
      content: { description: 'Body text here' }
    });
    const el = await api.openViewport(id);
    try {
      const found = await waitFor(() => {
        // Title could be in h1, h2, or element with contenteditable
        return el.querySelector('[data-field="name"], h1, h2');
      });
      assert(found, 'Should find a title element');
      assert(
        found.textContent.includes('Test Title XYZ'),
        'Title element should contain the note name'
      );
    } finally {
      api.closeViewport(el);
      await api.delete(id);
    }
  });

  await testAsync('renders markdown body', async () => {
    const id = crypto.randomUUID();
    await api.set({
      id,
      type: NOTE_TYPE,
      content: { description: 'This has **bold text** in it' }
    });
    const el = await api.openViewport(id);
    try {
      const found = await waitFor(() => {
        // Look for rendered markdown — should contain <strong> or <b>
        return el.querySelector('strong, b');
      });
      assert(found, 'Markdown should render bold text as <strong> or <b>');
      assert(
        found.textContent.includes('bold text'),
        'Bold element should contain the expected text'
      );
    } finally {
      api.closeViewport(el);
      await api.delete(id);
    }
  });

  return getResults();
}
