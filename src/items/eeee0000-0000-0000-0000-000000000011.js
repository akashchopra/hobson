// Element Inspector View
// Renders controls and results for the element inspector item.

const INSPECTOR_LIB_NAME = 'element-inspector';

const STYLES = {
  container: `
    display: flex; flex-direction: column;
    height: 100%;
    font-size: 0.8125rem;
    overflow: hidden;
  `,
  controlsWrapper: `
    flex-shrink: 0;
    padding: 16px 16px 0 16px;
  `,
  resultsWrapper: `
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    padding-top: 8px;
  `,
  section: `
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: var(--border-radius, 6px);
    overflow: hidden;
  `,
  sectionHeader: `
    padding: 8px 12px;
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-border-dark, #6b7280);
    background: var(--color-bg-surface-alt, #f9fafb);
    border-bottom: 1px solid var(--color-border-light, #e5e7eb);
  `,
  sectionBody: `
    padding: 12px;
  `,
  controlRow: `
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 8px;
  `,
  badge: `
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.6875rem;
    font-weight: 600;
  `,
  badgeOn: `
    background: #dcfce7; color: #166534;
  `,
  badgeOff: `
    background: #fee2e2; color: #991b1b;
  `,
  btn: `
    padding: 6px 16px;
    font-size: 0.8125rem;
    cursor: pointer;
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: var(--border-radius, 6px);
    background: var(--color-bg-surface, #fff);
    color: var(--color-link, #2563eb);
    font-weight: 500;
    transition: background 0.15s;
  `,
  btnPrimary: `
    padding: 6px 16px;
    font-size: 0.8125rem;
    cursor: pointer;
    border: none;
    border-radius: var(--border-radius, 6px);
    background: var(--color-link, #2563eb);
    color: #fff;
    font-weight: 500;
    transition: background 0.15s;
  `,
  inspectingMsg: `
    padding: 8px 12px;
    background: #fef3c7; color: #92400e;
    border-radius: var(--border-radius, 6px);
    font-weight: 500;
    margin-top: 8px;
  `,
  emptyState: `
    color: var(--color-border-dark, #6b7280);
    font-style: italic;
    padding: 8px 0;
  `,
  card: `
    margin-bottom: 8px;
    padding: 8px 12px;
    background: var(--color-bg-surface-alt, #f9fafb);
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: var(--border-radius, 6px);
  `,
  cardTag: `
    font-family: monospace;
    color: var(--color-border-dark, #6b7280);
    margin-bottom: 4px;
    font-size: 0.75rem;
  `,
  cardRow: `
    font-size: 0.8125rem;
    margin-bottom: 2px;
  `,
  link: `
    color: var(--color-link, #2563eb);
    cursor: pointer;
    text-decoration: none;
  `,
  viaRow: `
    color: var(--color-border-dark, #6b7280);
    font-size: 0.75rem;
  `,
};

export async function render(item, api) {
  const lib = await api.require(INSPECTOR_LIB_NAME);

  let inspecting = false;
  let results = item.content?.lastResults || null; // Restore from item content

  const container = api.createElement('div', { style: STYLES.container }, []);

  // --- Controls Section (pinned at top) ---
  const controlsWrapper = api.createElement('div', { style: STYLES.controlsWrapper }, []);
  const controlsSection = api.createElement('div', { style: STYLES.section }, []);
  controlsSection.appendChild(api.createElement('div', { style: STYLES.sectionHeader }, ['Controls']));
  const controlsBody = api.createElement('div', { style: STYLES.sectionBody }, []);
  controlsSection.appendChild(controlsBody);
  controlsWrapper.appendChild(controlsSection);
  container.appendChild(controlsWrapper);

  // --- Results Section (scrollable) ---
  const resultsWrapper = api.createElement('div', { style: STYLES.resultsWrapper }, []);
  const resultsSection = api.createElement('div', { style: STYLES.section }, []);
  resultsSection.appendChild(api.createElement('div', { style: STYLES.sectionHeader }, ['Results']));
  const resultsBody = api.createElement('div', { style: STYLES.sectionBody }, []);
  resultsSection.appendChild(resultsBody);
  resultsWrapper.appendChild(resultsSection);
  container.appendChild(resultsWrapper);

  // --- Inspect action (shared by both buttons) ---
  async function doInspect() {
    inspecting = true;
    buildControls();

    const info = await lib.inspectOnce(api);

    inspecting = false;
    if (info) {
      results = { chain: info.chain };
      await api.set({ ...item, content: { ...item.content, lastResults: results }, modified: Date.now() });
    }
    buildControls();
    await buildResults();
  }

  // --- Build Controls ---
  function buildControls() {
    controlsBody.innerHTML = '';

    // Debug mode row
    const debugRow = api.createElement('div', { style: STYLES.controlRow }, []);
    debugRow.appendChild(api.createElement('span', {}, ['Debug Mode:']));

    const isDebug = window.kernel?.debugMode || false;
    const badge = api.createElement('span', {
      style: STYLES.badge + (isDebug ? STYLES.badgeOn : STYLES.badgeOff)
    }, [isDebug ? 'ON' : 'OFF']);
    debugRow.appendChild(badge);

    const toggleBtn = api.createElement('button', { style: STYLES.btn }, [isDebug ? 'Disable' : 'Enable']);
    toggleBtn.onclick = async () => {
      window.kernel.debugMode = !isDebug;
      await api.navigate(api.viewport.getRoot());
    };
    debugRow.appendChild(toggleBtn);
    controlsBody.appendChild(debugRow);

    // Inspect button
    const inspectBtn = api.createElement('button', {
      style: inspecting ? STYLES.btn : STYLES.btnPrimary
    }, [inspecting ? 'Inspecting...' : 'Inspect Element']);

    if (inspecting) {
      inspectBtn.disabled = true;
      inspectBtn.style.opacity = '0.6';
      inspectBtn.style.cursor = 'default';
    } else {
      inspectBtn.onclick = async () => {
        // Auto-enable debug mode if needed
        if (!window.kernel?.debugMode) {
          window.kernel.debugMode = true;
          // Re-render to apply data-* attributes (rebuilds our view)
          await api.navigate(api.viewport.getRoot());
          return;
        }
        await doInspect();
      };
    }
    controlsBody.appendChild(inspectBtn);

    // Inspecting indicator
    if (inspecting) {
      controlsBody.appendChild(api.createElement('div', { style: STYLES.inspectingMsg }, [
        'Click any element to inspect it... (Escape to cancel)'
      ]));
    }
  }

  // --- Build Results ---
  async function buildResults() {
    resultsBody.innerHTML = '';

    if (!results || results.chain.length === 0) {
      if (results && results.chain.length === 0) {
        resultsBody.appendChild(api.createElement('div', { style: STYLES.emptyState }, [
          'No attribution found. Elements need debug mode active during render. Try enabling debug mode and refreshing the page.'
        ]));
      } else {
        resultsBody.appendChild(api.createElement('div', { style: STYLES.emptyState }, [
          'Click "Inspect Element" above, then click any element on the page to see its rendering chain.'
        ]));
      }
      return;
    }

    // Name cache for resolving IDs to display names
    const nameCache = {};
    const getName = async (id) => {
      if (!id) return null;
      if (nameCache[id]) return nameCache[id];
      try {
        const it = await api.get(id);
        nameCache[id] = it.name || id.slice(0, 8) + '...';
      } catch (e) {
        nameCache[id] = id.slice(0, 8) + '...';
      }
      return nameCache[id];
    };

    // Pre-fetch all names
    for (const entry of results.chain) {
      if (entry.viewId) await getName(entry.viewId);
      if (entry.forItem) await getName(entry.forItem);
      if (entry.itemId) await getName(entry.itemId);
    }

    // Render chain as cards
    for (const entry of results.chain) {
      const card = api.createElement('div', { style: STYLES.card }, []);

      // Element tag
      card.appendChild(api.createElement('div', { style: STYLES.cardTag }, [
        '<' + entry.tagName + '>' + (entry.className ? '.' + entry.className.split(' ')[0] : '')
      ]));

      // Item link
      if (entry.forItem) {
        const row = api.createElement('div', { style: STYLES.cardRow }, []);
        row.appendChild(api.createElement('strong', {}, ['Item: ']));
        const link = api.createElement('a', { style: STYLES.link }, [nameCache[entry.forItem]]);
        link.onclick = () => lib.resolveAndNavigate(api, { id: entry.forItem });
        row.appendChild(link);
        card.appendChild(row);
      }

      // Source link
      if (entry.source) {
        const row = api.createElement('div', { style: STYLES.cardRow }, []);
        row.appendChild(api.createElement('strong', {}, ['Source: ']));
        const label = entry.source + (entry.sourceLine ? ':' + entry.sourceLine : '');
        const link = api.createElement('a', { style: STYLES.link }, [label]);
        link.onclick = () => lib.resolveAndNavigate(api, { name: entry.source, line: entry.sourceLine });
        row.appendChild(link);
        card.appendChild(row);
      }

      // View link (only if different from source)
      if (entry.viewId && nameCache[entry.viewId] !== entry.source) {
        const row = api.createElement('div', { style: STYLES.cardRow }, []);
        row.appendChild(api.createElement('strong', {}, ['View: ']));
        const link = api.createElement('a', { style: STYLES.link }, [nameCache[entry.viewId]]);
        link.onclick = () => lib.resolveAndNavigate(api, { id: entry.viewId });
        row.appendChild(link);
        card.appendChild(row);
      }

      // Via link (secondary item)
      if (entry.itemId && entry.itemId !== entry.forItem) {
        const row = api.createElement('div', { style: STYLES.viaRow }, []);
        row.appendChild(api.createElement('span', {}, ['via ']));
        const link = api.createElement('a', { style: STYLES.link }, [nameCache[entry.itemId]]);
        link.onclick = () => lib.resolveAndNavigate(api, { id: entry.itemId });
        row.appendChild(link);
        card.appendChild(row);
      }

      resultsBody.appendChild(card);
    }

    // Inspect Again button
    const againBtn = api.createElement('button', { style: STYLES.btn }, ['Inspect Again']);
    againBtn.onclick = () => doInspect();
    resultsBody.appendChild(api.createElement('div', { style: 'margin-top: 12px;' }, [againBtn]));
  }

  // Init
  buildControls();
  await buildResults();

  return container;
}
