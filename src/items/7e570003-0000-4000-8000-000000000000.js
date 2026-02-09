const TEST_TAG_ID = 'c0c0c0c0-0070-0000-0000-000000000000';

export async function render(item, api) {
  const container = document.createElement('div');
  container.style.cssText = 'display:flex; flex-direction:column; height:100%; font-family:var(--font-sans, system-ui, sans-serif); font-size:14px;';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border-color, #e5e7eb);';

  const title = document.createElement('h2');
  title.textContent = 'Test Runner';
  title.style.cssText = 'margin:0; font-size:18px; font-weight:600;';
  header.appendChild(title);

  const runAllBtn = document.createElement('button');
  runAllBtn.textContent = 'Run All';
  runAllBtn.style.cssText = 'padding:6px 16px; background:#22c55e; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:14px; font-weight:500;';
  runAllBtn.onmouseenter = () => runAllBtn.style.background = '#16a34a';
  runAllBtn.onmouseleave = () => runAllBtn.style.background = '#22c55e';
  header.appendChild(runAllBtn);
  container.appendChild(header);

  // Summary bar
  const summaryBar = document.createElement('div');
  summaryBar.style.cssText = 'padding:8px 16px; font-size:13px; color:var(--text-secondary, #6b7280); border-bottom:1px solid var(--border-color, #e5e7eb);';
  summaryBar.textContent = 'Discovering tests...';
  container.appendChild(summaryBar);

  // Results area
  const resultsArea = document.createElement('div');
  resultsArea.style.cssText = 'flex:1; overflow-y:auto; padding:8px 0;';
  container.appendChild(resultsArea);

  // Hidden test viewport area (for openViewport rendering)
  const testArea = document.createElement('div');
  testArea.style.cssText = 'position:absolute; left:-9999px; top:-9999px; width:800px; height:600px; overflow:hidden;';
  container.appendChild(testArea);

  // Discover test items
  const allItems = await api.getAll();
  const testItems = allItems.filter(i => i.content?.tags?.includes(TEST_TAG_ID));
  summaryBar.textContent = `${testItems.length} test${testItems.length === 1 ? '' : 's'} found`;

  // Build test item rows
  const rows = [];
  for (const testItem of testItems) {
    const row = createTestRow(testItem);
    rows.push(row);
    resultsArea.appendChild(row.el);
  }

  // Run all handler
  runAllBtn.addEventListener('click', async () => {
    runAllBtn.disabled = true;
    runAllBtn.style.opacity = '0.6';
    runAllBtn.style.cursor = 'default';

    // Clear previous results
    testArea.innerHTML = '';
    for (const row of rows) row.reset();

    let totalPassed = 0;
    let totalFailed = 0;

    for (const row of rows) {
      row.setStatus('running');
      try {
        const results = await runTestItem(row.testItem, api, testArea);
        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;
        totalPassed += passed;
        totalFailed += failed;
        row.setResults(results, passed, failed);
      } catch (e) {
        totalFailed += 1;
        row.setResults([{ name: row.testItem.name, passed: false, error: e.message }], 0, 1);
      }
    }

    // Update summary
    const total = totalPassed + totalFailed;
    if (totalFailed === 0) {
      summaryBar.textContent = `All ${total} passed`;
      summaryBar.style.color = '#22c55e';
    } else {
      summaryBar.textContent = `${totalPassed}/${total} passed, ${totalFailed} failed`;
      summaryBar.style.color = '#ef4444';
    }

    runAllBtn.disabled = false;
    runAllBtn.style.opacity = '1';
    runAllBtn.style.cursor = 'pointer';
  });

  return container;
}

function createTestRow(testItem) {
  const el = document.createElement('div');
  el.style.cssText = 'padding:6px 16px;';

  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'display:flex; align-items:center; gap:8px; cursor:default;';

  const indicator = document.createElement('span');
  indicator.style.cssText = 'width:20px; text-align:center; flex-shrink:0;';
  indicator.textContent = '\u25CB'; // circle
  indicator.style.color = '#9ca3af';

  const nameSpan = document.createElement('span');
  nameSpan.textContent = testItem.name || testItem.id;
  nameSpan.style.cssText = 'font-weight:500;';

  const countSpan = document.createElement('span');
  countSpan.style.cssText = 'margin-left:auto; font-size:12px; color:var(--text-secondary, #6b7280);';

  headerRow.appendChild(indicator);
  headerRow.appendChild(nameSpan);
  headerRow.appendChild(countSpan);
  el.appendChild(headerRow);

  const detailsContainer = document.createElement('div');
  detailsContainer.style.cssText = 'margin-left:28px; margin-top:4px;';
  el.appendChild(detailsContainer);

  return {
    el,
    testItem,
    reset() {
      indicator.textContent = '\u25CB';
      indicator.style.color = '#9ca3af';
      countSpan.textContent = '';
      detailsContainer.innerHTML = '';
    },
    setStatus(status) {
      if (status === 'running') {
        indicator.textContent = '\u25CF';
        indicator.style.color = '#f59e0b';
        countSpan.textContent = 'running...';
        countSpan.style.color = '#f59e0b';
      }
    },
    setResults(results, passed, failed) {
      if (failed === 0) {
        indicator.textContent = '\u2713';
        indicator.style.color = '#22c55e';
        countSpan.textContent = `${passed}/${passed} passed`;
        countSpan.style.color = '#22c55e';
      } else {
        indicator.textContent = '\u2717';
        indicator.style.color = '#ef4444';
        countSpan.textContent = `${passed}/${passed + failed} passed`;
        countSpan.style.color = '#ef4444';
      }

      // Show details for failures
      detailsContainer.innerHTML = '';
      for (const r of results) {
        if (!r.passed) {
          const failLine = document.createElement('div');
          failLine.style.cssText = 'padding:3px 0; font-size:12px;';

          const failName = document.createElement('div');
          failName.style.cssText = 'color:#ef4444;';
          failName.textContent = '\u2717 ' + r.name;
          failLine.appendChild(failName);

          if (r.error) {
            const errMsg = document.createElement('div');
            errMsg.style.cssText = 'color:#9ca3af; padding-left:16px; font-family:var(--font-mono, monospace); font-size:11px; white-space:pre-wrap; word-break:break-all;';
            errMsg.textContent = r.error;
            failLine.appendChild(errMsg);
          }

          detailsContainer.appendChild(failLine);
        }
      }
    }
  };
}

async function runTestItem(testItem, api, testArea) {
  // Build the testApi that wraps the renderer API with test helpers.
  // Key differences from the raw renderer API:
  //  - set() returns the full saved item (renderer api.set returns just the ID)
  //  - get() returns null on missing items (renderer api.get throws)
  //  - delete() uses silent deletion to avoid viewport re-render
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
      // Use silent set-then-delete pattern to avoid renderViewport
      // api.events won't trigger viewport re-render when we use the
      // low-level approach through set with silent option
      try { await api.get(id); } catch { return; }
      // We can't avoid kernel.deleteItem's renderViewport call,
      // so we do a silent save of a tombstone then the storage-level delete
      await api.set({ id, type: '00000000-0000-0000-0000-000000000000', content: {}, attachments: [] }, { silent: true });
      // The item is overwritten; now we just leave it. Tests that check
      // deletion should use get() which returns null for missing items.
    },
    require: (name) => api.require(name),

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

  // Run with a timeout so a hanging test can't block the entire runner
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
