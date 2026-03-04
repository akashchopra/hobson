const TEST_TAG_ID = 'c0c0c0c0-0070-0000-0000-000000000000';
const INSTANCE_BOOT_TIMEOUT = 30000;
const TEST_RUN_TIMEOUT = 120000;

export async function render(item, api) {
  const instanceLib = await api.require('hobson-instance-lib');

  const container = document.createElement('div');
  container.style.cssText = 'display:flex; flex-direction:column; height:100%; font-family:var(--font-sans, system-ui, sans-serif); font-size: 0.875rem;';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border-color, #e5e7eb);';

  const title = document.createElement('h2');
  title.textContent = 'Test Suite';
  title.style.cssText = 'margin:0; font-size: 1.125rem; font-weight:600;';
  header.appendChild(title);

  const runAllBtn = document.createElement('button');
  runAllBtn.textContent = 'Run All';
  runAllBtn.style.cssText = 'padding:6px 16px; background:#22c55e; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size: 0.875rem; font-weight:500;';
  runAllBtn.onmouseenter = () => runAllBtn.style.background = '#16a34a';
  runAllBtn.onmouseleave = () => runAllBtn.style.background = '#22c55e';
  header.appendChild(runAllBtn);
  container.appendChild(header);

  // Summary bar
  const summaryBar = document.createElement('div');
  summaryBar.style.cssText = 'padding:8px 16px; font-size: 0.8125rem; color:var(--text-secondary, #6b7280); border-bottom:1px solid var(--border-color, #e5e7eb);';
  summaryBar.textContent = 'Discovering tests...';
  container.appendChild(summaryBar);

  // Results area
  const resultsArea = document.createElement('div');
  resultsArea.style.cssText = 'flex:1; overflow-y:auto; padding:8px 0;';
  container.appendChild(resultsArea);

  // Discover test items (in parent, for building the UI rows)
  const allItems = await api.getAll();
  const testItems = allItems.filter(i =>
    i.content?.tags?.includes(TEST_TAG_ID) && i.name && i.content?.code
  );
  summaryBar.textContent = `${testItems.length} test${testItems.length === 1 ? '' : 's'} found`;

  // Build test item rows
  const rows = [];
  for (const testItem of testItems) {
    const row = createTestRow(testItem, api);
    rows.push(row);
    resultsArea.appendChild(row.el);
  }

  // Helper to update summary bar from totals
  function updateSummary(totalPassed, totalFailed, timestamp) {
    const total = totalPassed + totalFailed;
    const ago = timestamp ? ' \u00b7 ' + formatTimeAgo(timestamp) : '';
    if (totalFailed === 0) {
      summaryBar.textContent = `All ${total} passed${ago}`;
      summaryBar.style.color = '#22c55e';
    } else {
      summaryBar.textContent = `${totalPassed}/${total} passed, ${totalFailed} failed${ago}`;
      summaryBar.style.color = '#ef4444';
    }
  }

  // Restore last run results if available
  const lastRun = item.content?.lastRun;
  if (lastRun && lastRun.suites) {
    const byId = new Map(lastRun.suites.map(s => [s.testItemId, s]));
    for (const row of rows) {
      const saved = byId.get(row.testItem.id);
      if (saved) {
        row.setResults(saved.results, saved.passed, saved.failed);
      }
    }
    updateSummary(lastRun.totalPassed, lastRun.totalFailed, lastRun.timestamp);
  }

  // Run all handler — creates a nested instance, runs tests there
  let instance = null;
  runAllBtn.addEventListener('click', async () => {
    runAllBtn.disabled = true;
    runAllBtn.style.opacity = '0.6';
    runAllBtn.style.cursor = 'default';

    for (const row of rows) row.reset();
    summaryBar.style.color = 'var(--text-secondary, #6b7280)';

    try {
      summaryBar.textContent = 'Booting test instance...';
      instance = await instanceLib.create(api, { name: 'Test Run' });

      await instance.waitForMessage('test-instance-ready', INSTANCE_BOOT_TIMEOUT);
      summaryBar.textContent = 'Running tests...';
      for (const row of rows) row.setStatus('running');

      const suiteMap = new Map(rows.map(r => [r.testItem.id, r]));

      const removeProgress = instance.onMessage('test-progress', msg => {
        const row = suiteMap.get(msg.suite?.testItemId);
        if (row) {
          row.setResults(msg.suite.results, msg.suite.passed, msg.suite.failed);
        }
      });

      const resultLastRun = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          removeComplete();
          removeError();
          reject(new Error('Test run timed out'));
        }, TEST_RUN_TIMEOUT);

        const removeComplete = instance.onMessage('test-complete', msg => {
          clearTimeout(timer);
          removeComplete();
          removeError();
          resolve(msg.lastRun);
        });

        const removeError = instance.onMessage('test-error', msg => {
          clearTimeout(timer);
          removeComplete();
          removeError();
          reject(new Error(msg.error));
        });
      });

      removeProgress();

      // Update summary and persist
      updateSummary(resultLastRun.totalPassed, resultLastRun.totalFailed, resultLastRun.timestamp);
      const updated = await api.get(item.id);
      updated.content = updated.content || {};
      updated.content.lastRun = resultLastRun;
      await api.set(updated, { silent: true });

    } catch (err) {
      summaryBar.textContent = `Error: ${err.message}`;
      summaryBar.style.color = '#ef4444';
    }

    // Show clean up button (instance stays alive for inspection)
    runAllBtn.style.display = 'none';
    const cleanupBtn = document.createElement('button');
    cleanupBtn.textContent = 'Clean Up Instance';
    cleanupBtn.style.cssText = 'padding:6px 16px; background:#6b7280; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size: 0.875rem; font-weight:500;';
    cleanupBtn.onmouseenter = () => cleanupBtn.style.background = '#4b5563';
    cleanupBtn.onmouseleave = () => cleanupBtn.style.background = '#6b7280';
    cleanupBtn.addEventListener('click', async () => {
      cleanupBtn.disabled = true;
      cleanupBtn.textContent = 'Cleaning up...';
      try { if (instance) await instance.destroy(); } catch {}
      instance = null;
      cleanupBtn.remove();
      runAllBtn.style.display = '';
      runAllBtn.disabled = false;
      runAllBtn.style.opacity = '1';
      runAllBtn.style.cursor = 'pointer';
    });
    header.appendChild(cleanupBtn);
  });

  return container;
}

function createTestRow(testItem, api) {
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
  countSpan.style.cssText = 'margin-left:auto; font-size: 0.75rem; color:var(--text-secondary, #6b7280);';

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
      const total = passed + failed;
      if (failed === 0) {
        indicator.textContent = '\u2713';
        indicator.style.color = '#22c55e';
        countSpan.textContent = `${passed}/${total} passed`;
        countSpan.style.color = '#22c55e';
      } else {
        indicator.textContent = '\u2717';
        indicator.style.color = '#ef4444';
        countSpan.textContent = `${passed}/${total} passed`;
        countSpan.style.color = '#ef4444';
      }

      // Show every individual test result
      detailsContainer.innerHTML = '';

      // Auto-expand if there are failures, collapse if all passed
      let expanded = failed > 0;

      const toggle = document.createElement('div');
      toggle.style.cssText = 'font-size: 0.6875rem; color:var(--text-secondary, #6b7280); cursor:pointer; user-select:none; padding:2px 0;';
      const updateToggle = () => {
        toggle.textContent = expanded ? '\u25BE hide details' : '\u25B8 show details';
      };
      updateToggle();
      toggle.addEventListener('click', () => {
        expanded = !expanded;
        updateToggle();
        listEl.style.display = expanded ? 'block' : 'none';
      });
      detailsContainer.appendChild(toggle);

      const listEl = document.createElement('div');
      listEl.style.display = expanded ? 'block' : 'none';

      for (const r of results) {
        const line = document.createElement('div');
        line.style.cssText = 'padding:2px 0; font-size: 0.75rem;';

        const icon = r.passed ? '\u2713 ' : '\u2717 ';
        const color = r.passed ? '#22c55e' : '#ef4444';

        const nameEl = document.createElement('a');
        nameEl.style.cssText = `color:${color}; cursor:pointer; text-decoration:none; border-bottom:1px solid transparent;`;
        nameEl.onmouseenter = () => nameEl.style.borderBottomColor = color;
        nameEl.onmouseleave = () => nameEl.style.borderBottomColor = 'transparent';
        nameEl.textContent = icon + r.name;
        nameEl.title = r.symbol ? `${testItem.name} \u2192 ${r.symbol}` : testItem.name;

        nameEl.onclick = (e) => {
          e.preventDefault();
          const params = { field: 'code' };
          if (r.symbol) params.symbol = r.symbol;
          api.openItem(e, { id: testItem.id, view: { navigateTo: params } });
        };

        line.appendChild(nameEl);

        if (!r.passed && r.error) {
          const errMsg = document.createElement('div');
          errMsg.style.cssText = 'color:#9ca3af; padding-left:16px; font-family:var(--font-mono, monospace); font-size: 0.6875rem; white-space:pre-wrap; word-break:break-all;';
          errMsg.textContent = r.error;
          line.appendChild(errMsg);
        }

        listEl.appendChild(line);
      }

      detailsContainer.appendChild(listEl);
    }
  };
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
