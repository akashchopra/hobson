const TEST_TAG_ID = 'c0c0c0c0-0070-0000-0000-000000000000';

export async function onKernelBootComplete(event, api) {
  // Only activate in nested instances
  const instanceId = api.getInstanceId();
  if (!instanceId) return;

  // Auto-run tests immediately on boot
  try {
    window.parent.postMessage({ type: 'test-instance-ready', instanceId }, '*');
    await runAllTests(api, instanceId);
  } catch (err) {
    window.parent.postMessage({ type: 'test-error', error: err.message, instanceId }, '*');
  }
}

async function runAllTests(api, instanceId) {
  const allItems = await api.getAll();
  const testItems = allItems.filter(i =>
    i.content?.tags?.includes(TEST_TAG_ID) && i.name && i.content?.code
  );

  // Hidden area for test viewports
  const testArea = document.createElement('div');
  testArea.style.cssText = 'position:absolute; left:-9999px; top:-9999px; width:800px; height:600px; overflow:hidden;';
  document.body.appendChild(testArea);

  let totalPassed = 0;
  let totalFailed = 0;
  const suites = [];

  for (const testItem of testItems) {
    let suite;
    try {
      const results = await runTestItem(testItem, api, testArea);
      const passed = results.filter(r => r.passed).length;
      const failed = results.filter(r => !r.passed).length;
      totalPassed += passed;
      totalFailed += failed;
      suite = { testItemId: testItem.id, testItemName: testItem.name, passed, failed, results };
    } catch (e) {
      totalFailed += 1;
      const results = [{ name: testItem.name, passed: false, error: e.message }];
      suite = { testItemId: testItem.id, testItemName: testItem.name, passed: 0, failed: 1, results };
    }
    suites.push(suite);
    window.parent.postMessage({ type: 'test-progress', suite, instanceId }, '*');
  }

  const lastRun = { timestamp: Date.now(), totalPassed, totalFailed, suites };
  window.parent.postMessage({ type: 'test-complete', lastRun, instanceId }, '*');

  testArea.remove();
}

async function runTestItem(testItem, api, testArea) {
  const testApi = {
    set: async (item) => {
      const id = await api.set(item, { silent: true });
      return api.get(id);
    },
    get: async (id) => {
      try { return await api.get(id); }
      catch { return null; }
    },
    query: (filter) => api.query(filter),
    getAll: () => api.getAll(),
    delete: async (id) => {
      try { await api.delete(id); } catch { /* item may not exist */ }
    },
    require: (name) => api.require(name),
    typeChainIncludes: (typeId, targetId) => api.typeChainIncludes(typeId, targetId),
    attach: (parentId, itemId) => api.attach(parentId, itemId),
    detach: (parentId, itemId) => api.detach(parentId, itemId),
    findContainerOf: (itemId) => api.findContainerOf(itemId),
    events: api.events,

    openViewport: async (itemId, viewId) => {
      const viewport = document.createElement('div');
      viewport.className = 'test-viewport';
      viewport.style.cssText = 'width:800px; height:600px;';
      testArea.appendChild(viewport);
      const dom = await api.renderItem(itemId, viewId || null);
      if (dom) viewport.appendChild(dom);
      return viewport;
    },

    closeViewport: (el) => {
      if (el && el.parentNode) el.remove();
    }
  };

  const mod = await api.require(testItem.name);
  if (!mod || typeof mod.run !== 'function') {
    throw new Error(`Test item "${testItem.name}" does not export a run() function`);
  }

  const ITEM_TIMEOUT = 30000;
  const results = await Promise.race([
    mod.run(testApi),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Test item "${testItem.name}" timed out after ${ITEM_TIMEOUT / 1000}s`)), ITEM_TIMEOUT)
    )
  ]);

  if (!Array.isArray(results)) {
    throw new Error(`Test item "${testItem.name}" run() must return an array of results`);
  }

  return results;
}
