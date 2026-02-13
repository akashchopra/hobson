// System Browser View
// Multi-pane hierarchical browser for navigating items by structure.

const BROWSER_TYPE_ID = '3a36e7d0-a49c-494b-ae32-1a0c92a10c1c';

const AXES = ['Types', 'Tags', 'Views', 'Libraries'];

const IDS = {
  TYPE_DEFINITION: '11111111-0000-0000-0000-000000000000',
  VIEW: 'aaaaaaaa-0000-0000-0000-000000000000',
  LIBRARY: '66666666-0000-0000-0000-000000000000',
};

// --- Styles ---

const STYLES = {
  container: `
    display: flex; flex-direction: column;
    height: 100%; min-height: 400px;
    font-size: 0.8125rem;
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: var(--border-radius, 6px);
    overflow: hidden;
  `,
  tabBar: `
    display: flex; gap: 0;
    border-bottom: 1px solid var(--color-border-light, #e5e7eb);
    background: var(--color-bg-surface-alt, #f9fafb);
    flex-shrink: 0;
    align-items: center;
  `,
  tabSpacer: `
    flex: 1;
  `,
  refreshBtn: `
    padding: 4px 10px;
    margin-right: 8px;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: var(--border-radius, 6px);
    background: var(--color-bg-surface, #fff);
    color: var(--color-border-dark, #6b7280);
    transition: background 0.15s, color 0.15s;
  `,
  tab: `
    padding: 8px 16px;
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    border: none; background: none;
    border-bottom: 2px solid transparent;
    color: var(--color-border-dark, #6b7280);
    transition: color 0.15s, border-color 0.15s;
  `,
  tabActive: `
    padding: 8px 16px;
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 600;
    border: none; background: none;
    border-bottom: 2px solid var(--color-link, #2563eb);
    color: var(--color-link, #2563eb);
  `,
  columns: `
    display: flex; flex: 1; overflow: hidden;
  `,
  column: `
    display: flex; flex-direction: column;
    border-right: 1px solid var(--color-border-light, #e5e7eb);
    overflow: hidden;
  `,
  columnHeader: `
    padding: 6px 10px;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-border-dark, #6b7280);
    border-bottom: 1px solid var(--color-border-light, #e5e7eb);
    background: var(--color-bg-surface-alt, #f9fafb);
    flex-shrink: 0;
  `,
  columnList: `
    flex: 1; overflow-y: auto; padding: 2px 0;
  `,
  filterInput: `
    width: 100%; box-sizing: border-box;
    padding: 5px 8px;
    font-size: 0.75rem;
    border: none;
    border-bottom: 1px solid var(--color-border-light, #e5e7eb);
    outline: none;
    background: var(--color-bg-surface, #fff);
  `,
  row: `
    display: flex; align-items: baseline; gap: 6px;
    padding: 4px 10px;
    cursor: pointer;
    border-radius: 0;
    transition: background 0.1s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  rowSelected: `
    background: var(--color-bg-surface-alt, #e8eaed);
  `,
  rowName: `
    flex: 1; overflow: hidden; text-overflow: ellipsis;
    color: var(--color-link, #2563eb);
  `,
  rowCount: `
    flex-shrink: 0;
    color: var(--color-border-dark, #6b7280);
    font-size: 0.6875rem;
  `,
  detail: `
    flex: 1; overflow-y: auto; padding: 16px;
    min-width: 0;
  `,
  detailTitle: `
    margin: 0 0 8px 0;
    font-size: 1rem;
    font-weight: 600;
  `,
  detailMeta: `
    font-size: 0.75rem;
    color: var(--color-border-dark, #6b7280);
    margin-bottom: 4px;
    overflow-wrap: break-word;
  `,
  detailDesc: `
    font-size: 0.8125rem;
    margin-top: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  `,
  openBtn: `
    margin-top: 12px;
    padding: 6px 16px;
    font-size: 0.8125rem;
    cursor: pointer;
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: var(--border-radius, 6px);
    background: var(--color-bg-surface-alt, #f9fafb);
    color: var(--color-link, #2563eb);
    font-weight: 500;
  `,
  subTabBar: `
    display: flex; gap: 0;
    border-bottom: 1px solid var(--color-border-light, #e5e7eb);
    flex-shrink: 0;
  `,
  subTab: `
    padding: 4px 10px;
    cursor: pointer;
    font-size: 0.6875rem;
    font-weight: 500;
    border: none; background: none;
    border-bottom: 2px solid transparent;
    color: var(--color-border-dark, #6b7280);
  `,
  subTabActive: `
    padding: 4px 10px;
    cursor: pointer;
    font-size: 0.6875rem;
    font-weight: 600;
    border: none; background: none;
    border-bottom: 2px solid var(--color-link, #2563eb);
    color: var(--color-link, #2563eb);
  `,
  empty: `
    padding: 12px 10px;
    color: var(--color-border-dark, #6b7280);
    font-style: italic;
    font-size: 0.75rem;
  `,
};

// --- Main render ---

export async function render(item, api) {
  const lib = await api.require('related-items-lib');
  const tagTreeBuilder = await api.require('tag-tree-builder');
  await lib.ensureBuilt(api);

  const state = {
    axis: 'Types',
    col1Selection: null,
    col2Tab: 'Instances',
    col2Selection: null,
  };

  const container = api.createElement('div', { style: STYLES.container }, []);

  // Tab bar
  const tabBar = api.createElement('div', { style: STYLES.tabBar }, []);
  container.appendChild(tabBar);

  // Body: three columns
  const columnsEl = api.createElement('div', { style: STYLES.columns }, []);
  container.appendChild(columnsEl);

  const col1El = api.createElement('div', { style: STYLES.column + 'width: 25%; flex-shrink: 0;' }, []);
  const col2El = api.createElement('div', { style: STYLES.column + 'width: 30%; flex-shrink: 0;' }, []);
  const detailEl = api.createElement('div', { style: STYLES.detail }, []);

  columnsEl.appendChild(col1El);
  columnsEl.appendChild(col2El);
  columnsEl.appendChild(detailEl);

  // --- Build functions ---

  function buildTabBar() {
    tabBar.innerHTML = '';
    for (const axis of AXES) {
      const btn = api.createElement('div', {
        style: axis === state.axis ? STYLES.tabActive : STYLES.tab
      }, [axis]);
      btn.onclick = () => {
        if (state.axis === axis) return;
        state.axis = axis;
        state.col1Selection = null;
        state.col2Tab = 'Instances';
        state.col2Selection = null;
        buildTabBar();
        buildColumn1();
        buildColumn2();
        buildDetail();
      };
      tabBar.appendChild(btn);
    }

    // Spacer pushes refresh button to the right
    tabBar.appendChild(api.createElement('div', { style: STYLES.tabSpacer }, []));

    // Refresh button
    const refreshBtn = api.createElement('button', { style: STYLES.refreshBtn }, ['\u21BB Refresh']);
    refreshBtn.onmouseover = () => { refreshBtn.style.background = 'var(--color-bg-surface-alt, #f3f4f6)'; refreshBtn.style.color = 'var(--color-link, #2563eb)'; };
    refreshBtn.onmouseout = () => { refreshBtn.style.background = 'var(--color-bg-surface, #fff)'; refreshBtn.style.color = 'var(--color-border-dark, #6b7280)'; };
    refreshBtn.onclick = () => {
      state.col1Selection = null;
      state.col2Selection = null;
      buildColumn1();
      buildColumn2();
      buildDetail();
    };
    tabBar.appendChild(refreshBtn);
  }

  async function buildColumn1() {
    col1El.innerHTML = '';
    const headerLabel = state.axis === 'Types' ? 'Types'
      : state.axis === 'Tags' ? 'Tags'
      : state.axis === 'Views' ? 'Views'
      : 'Libraries';

    const header = api.createElement('div', { style: STYLES.columnHeader }, [headerLabel]);
    col1El.appendChild(header);

    // Filter input
    const filterInput = api.createElement('input', {
      style: STYLES.filterInput,
      placeholder: 'Filter\u2026',
      type: 'text'
    }, []);
    col1El.appendChild(filterInput);

    const listEl = api.createElement('div', { style: STYLES.columnList }, []);
    col1El.appendChild(listEl);

    // Gather data
    let entries = []; // [{id, name, count}]

    if (state.axis === 'Types') {
      const typeIds = lib.getInstancesOf(IDS.TYPE_DEFINITION);
      for (const id of typeIds) {
        const t = await safeGet(id, api);
        const instanceCount = lib.getInstancesOf(id).length;
        entries.push({ id, name: t?.name || id.substring(0, 8), count: instanceCount });
      }
    } else if (state.axis === 'Tags') {
      const tagIds = lib.getAllTags();
      for (const id of tagIds) {
        const fqName = await tagTreeBuilder.getFullyQualifiedName(id, api);
        const taggedCount = lib.getItemsTaggedWith(id).length;
        entries.push({ id, name: fqName || id.substring(0, 8), count: taggedCount });
      }
    } else if (state.axis === 'Views') {
      const viewIds = lib.getInstancesOf(IDS.VIEW);
      for (const id of viewIds) {
        const v = await safeGet(id, api);
        let targetName = '';
        if (v?.content?.for_type) {
          const tt = await safeGet(v.content.for_type, api);
          targetName = tt?.name || '';
        }
        entries.push({ id, name: v?.name || id.substring(0, 8), count: 0, subtitle: targetName });
      }
    } else if (state.axis === 'Libraries') {
      const libIds = lib.getInstancesOf(IDS.LIBRARY);
      for (const id of libIds) {
        const l = await safeGet(id, api);
        entries.push({ id, name: l?.name || id.substring(0, 8), count: 0 });
      }
    }

    entries.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    function renderList(filter) {
      listEl.innerHTML = '';
      const filtered = filter
        ? entries.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()))
        : entries;

      if (filtered.length === 0) {
        listEl.appendChild(api.createElement('div', { style: STYLES.empty }, ['No items']));
        return;
      }

      for (const entry of filtered) {
        const isSelected = state.col1Selection === entry.id;
        const row = api.createElement('div', {
          style: STYLES.row + (isSelected ? STYLES.rowSelected : '')
        }, []);

        const nameSpan = api.createElement('span', { style: STYLES.rowName }, [entry.name]);
        row.appendChild(nameSpan);

        if (state.axis === 'Views' && entry.subtitle) {
          const sub = api.createElement('span', { style: STYLES.rowCount }, [entry.subtitle]);
          row.appendChild(sub);
        } else if (entry.count > 0) {
          const countSpan = api.createElement('span', { style: STYLES.rowCount }, [String(entry.count)]);
          row.appendChild(countSpan);
        }

        row.onmouseover = () => { if (!isSelected) row.style.background = 'var(--color-bg-surface-alt, #f3f4f6)'; };
        row.onmouseout = () => { if (!isSelected) row.style.background = ''; };
        row.onclick = () => {
          state.col1Selection = entry.id;
          state.col2Tab = 'Instances';
          state.col2Selection = null;
          renderList(filterInput.value);
          buildColumn2();
          buildDetail();
        };
        row.ondblclick = () => { api.openItem(entry.id); };

        listEl.appendChild(row);
      }
    }

    filterInput.oninput = () => renderList(filterInput.value);
    renderList('');
  }

  async function buildColumn2() {
    col2El.innerHTML = '';

    if (!state.col1Selection) {
      col2El.appendChild(api.createElement('div', { style: STYLES.columnHeader }, ['']));
      col2El.appendChild(api.createElement('div', { style: STYLES.empty }, ['Select an item from the left']));
      return;
    }

    const selItem = await safeGet(state.col1Selection, api);
    const selName = selItem?.name || state.col1Selection.substring(0, 8);

    // Sub-tabs for Types axis
    if (state.axis === 'Types') {
      const subTabs = ['Instances', 'Subtypes', 'Views'];
      const subTabBar = api.createElement('div', { style: STYLES.subTabBar }, []);
      for (const tab of subTabs) {
        const btn = api.createElement('div', {
          style: tab === state.col2Tab ? STYLES.subTabActive : STYLES.subTab
        }, [tab]);
        btn.onclick = () => {
          if (state.col2Tab === tab) return;
          state.col2Tab = tab;
          state.col2Selection = null;
          buildColumn2();
          buildDetail();
        };
        subTabBar.appendChild(btn);
      }
      col2El.appendChild(subTabBar);
    } else {
      const header = api.createElement('div', { style: STYLES.columnHeader }, [selName]);
      col2El.appendChild(header);
    }

    // Filter
    const filterInput = api.createElement('input', {
      style: STYLES.filterInput,
      placeholder: 'Filter\u2026',
      type: 'text'
    }, []);
    col2El.appendChild(filterInput);

    const listEl = api.createElement('div', { style: STYLES.columnList }, []);
    col2El.appendChild(listEl);

    // Gather items for column 2
    let itemIds = [];

    if (state.axis === 'Types') {
      if (state.col2Tab === 'Instances') {
        itemIds = lib.getInstancesOf(state.col1Selection);
      } else if (state.col2Tab === 'Subtypes') {
        itemIds = lib.getSubtypesOf(state.col1Selection);
      } else if (state.col2Tab === 'Views') {
        itemIds = lib.getViewsFor(state.col1Selection);
      }
    } else if (state.axis === 'Tags') {
      itemIds = lib.getItemsTaggedWith(state.col1Selection);
    } else if (state.axis === 'Views') {
      // Show instances of the type this view targets
      if (selItem?.content?.for_type) {
        itemIds = lib.getInstancesOf(selItem.content.for_type);
      }
    } else if (state.axis === 'Libraries') {
      // For libraries, show description text instead of a list
      const desc = selItem?.content?.description || 'No description available.';
      const descEl = api.createElement('div', {
        style: 'padding: 10px; font-size: 0.8125rem; line-height: 1.5; white-space: pre-wrap;'
      }, [desc]);
      listEl.appendChild(descEl);
      filterInput.style.display = 'none';
      return;
    }

    // Resolve names for sorting
    const entries = [];
    for (const id of itemIds) {
      const it = await safeGet(id, api);
      entries.push({ id, name: it?.name || id.substring(0, 8) });
    }
    entries.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    function renderList(filter) {
      listEl.innerHTML = '';
      const filtered = filter
        ? entries.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()))
        : entries;

      if (filtered.length === 0) {
        listEl.appendChild(api.createElement('div', { style: STYLES.empty }, [
          itemIds.length === 0 ? 'None' : 'No matches'
        ]));
        return;
      }

      for (const entry of filtered) {
        const isSelected = state.col2Selection === entry.id;
        const row = api.createElement('div', {
          style: STYLES.row + (isSelected ? STYLES.rowSelected : '')
        }, []);

        const nameSpan = api.createElement('span', { style: STYLES.rowName }, [entry.name]);
        row.appendChild(nameSpan);

        row.onmouseover = () => { if (!isSelected) row.style.background = 'var(--color-bg-surface-alt, #f3f4f6)'; };
        row.onmouseout = () => { if (!isSelected) row.style.background = ''; };
        row.onclick = () => {
          state.col2Selection = entry.id;
          renderList(filterInput.value);
          buildDetail();
        };
        row.ondblclick = () => { api.openItem(entry.id); };

        listEl.appendChild(row);
      }
    }

    filterInput.oninput = () => renderList(filterInput.value);
    renderList('');
  }

  async function buildDetail() {
    detailEl.innerHTML = '';

    const selectedId = state.col2Selection || state.col1Selection;
    if (!selectedId) {
      detailEl.appendChild(api.createElement('div', { style: STYLES.empty }, ['Select an item to see details']));
      return;
    }

    const it = await safeGet(selectedId, api);
    if (!it) {
      detailEl.appendChild(api.createElement('div', { style: STYLES.empty }, ['Item not found']));
      return;
    }

    // Title
    const title = api.createElement('h3', { style: STYLES.detailTitle }, [it.name || selectedId.substring(0, 8)]);
    detailEl.appendChild(title);

    // Type
    const typeItem = await safeGet(it.type, api);
    const typeLine = api.createElement('div', { style: STYLES.detailMeta }, [
      'Type: ' + (typeItem?.name || it.type || 'unknown')
    ]);
    detailEl.appendChild(typeLine);

    // ID
    const idLine = api.createElement('div', { style: STYLES.detailMeta }, ['ID: ' + selectedId]);
    detailEl.appendChild(idLine);

    // Tags (fully qualified)
    if (Array.isArray(it.content?.tags) && it.content.tags.length > 0) {
      const tagNames = [];
      for (const tagId of it.content.tags) {
        tagNames.push(await tagTreeBuilder.getFullyQualifiedName(tagId, api) || tagId.substring(0, 8));
      }
      const tagsLine = api.createElement('div', { style: STYLES.detailMeta }, [
        'Tags: ' + tagNames.join(', ')
      ]);
      detailEl.appendChild(tagsLine);
    }

    // Dates
    if (it.created) {
      const created = api.createElement('div', { style: STYLES.detailMeta }, [
        'Created: ' + new Date(it.created).toLocaleDateString()
      ]);
      detailEl.appendChild(created);
    }
    if (it.modified) {
      const modified = api.createElement('div', { style: STYLES.detailMeta }, [
        'Modified: ' + new Date(it.modified).toLocaleDateString()
      ]);
      detailEl.appendChild(modified);
    }

    // Capabilities (for views)
    if (Array.isArray(it.content?.capabilities)) {
      const caps = api.createElement('div', { style: STYLES.detailMeta }, [
        'Capabilities: ' + it.content.capabilities.join(', ')
      ]);
      detailEl.appendChild(caps);
    }

    // Description snippet
    const desc = it.content?.description;
    if (desc) {
      const snippet = desc.length > 500 ? desc.substring(0, 500) + '\u2026' : desc;
      const descEl = api.createElement('div', { style: STYLES.detailDesc }, [snippet]);
      detailEl.appendChild(descEl);
    }

    // Open button
    const openBtn = api.createElement('button', { style: STYLES.openBtn }, ['Open']);
    openBtn.onclick = () => api.openItem(selectedId);
    detailEl.appendChild(openBtn);
  }

  // --- Init ---
  buildTabBar();
  await buildColumn1();
  await buildColumn2();
  await buildDetail();

  return container;
}

// --- Helpers ---

async function safeGet(id, api) {
  if (!id) return null;
  try { return await api.get(id); } catch (e) { return null; }
}

