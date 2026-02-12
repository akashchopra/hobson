// Symbol Browser view — searchable UI for browsing _symbols across all code items

export async function render(browser, api) {
  const container = api.createElement('div', {
    class: 'symbol-browser-view',
    style: 'width: 100%; max-width: 800px; margin: 0 auto; padding: 20px; box-sizing: border-box;'
  }, []);

  // Header
  const header = api.createElement('div', {
    style: 'margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid var(--color-border-light);'
  }, []);

  const title = api.createElement('h2', {
    style: 'margin: 0; font-size: 1.25rem;'
  }, [browser.name || 'Symbol Browser']);
  header.appendChild(title);
  container.appendChild(header);

  // Search input
  const searchBox = api.createElement('div', {
    style: 'margin-bottom: 12px;'
  }, []);

  const input = api.createElement('input', {
    type: 'text',
    placeholder: 'Search symbols...',
    value: browser.content?.query || '',
    style: 'width: 100%; padding: 12px 16px; font-size: 1rem; border: 2px solid var(--color-border); border-radius: 8px; outline: none; transition: border-color 0.2s; box-sizing: border-box;'
  }, []);

  input.onfocus = () => { input.style.borderColor = 'var(--color-primary)'; };
  input.onblur = () => { input.style.borderColor = 'var(--color-border)'; };

  searchBox.appendChild(input);
  container.appendChild(searchBox);

  // Gather all symbols from all items (moved up so module dropdown can use codeItems)
  const allItems = await api.getAll();
  const codeItems = allItems.filter(item => item.content?._symbols);

  let totalSymbols = 0;
  for (const item of codeItems) {
    totalSymbols += Object.keys(item.content._symbols).length;
  }

  // Module filter dropdown
  const sortedModules = codeItems
    .map(item => ({ id: item.id, name: item.name || item.id.substring(0, 8) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  let activeModule = browser.content?.moduleFilter || null;

  const moduleRow = api.createElement('div', {
    style: 'margin-bottom: 12px;'
  }, []);

  const moduleSelect = api.createElement('select', {
    style: 'width: 100%; padding: 8px 12px; font-size: 0.875rem; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-bg-surface); color: var(--color-text); outline: none; cursor: pointer;'
  }, []);

  const allOpt = api.createElement('option', { value: '' }, ['All modules (' + codeItems.length + ')']);
  moduleSelect.appendChild(allOpt);

  for (const mod of sortedModules) {
    const symCount = Object.keys(codeItems.find(i => i.id === mod.id).content._symbols).length;
    const opt = api.createElement('option', { value: mod.id }, [mod.name + ' (' + symCount + ')']);
    if (mod.id === activeModule) opt.selected = true;
    moduleSelect.appendChild(opt);
  }

  moduleSelect.onchange = () => {
    activeModule = moduleSelect.value || null;
    executeSearch(input.value);
  };

  moduleRow.appendChild(moduleSelect);
  container.appendChild(moduleRow);

  // Kind filter chips
  const KINDS = [
    { label: 'All', value: null },
    { label: 'Functions', value: 'function' },
    { label: 'Classes', value: 'class' },
    { label: 'Methods', value: 'method' },
    { label: 'Properties', value: 'property' }
  ];
  // Merge property-function, field-function into "Functions"
  const FUNCTION_KINDS = new Set(['function', 'property-function', 'field-function']);

  const saved = browser.content?.kindFilter;
  let activeKinds = new Set(Array.isArray(saved) ? saved : []);

  const updateChipStyles = () => {
    const allActive = activeKinds.size === 0;
    chipEls.forEach((c, i) => {
      const isAll = KINDS[i].value === null;
      c.style.cssText = chipStyle(isAll ? allActive : activeKinds.has(KINDS[i].value));
    });
  };

  const chipBar = api.createElement('div', {
    style: 'display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;'
  }, []);

  const chipEls = [];
  for (const kind of KINDS) {
    const chip = api.createElement('button', {
      style: chipStyle(kind.value === null ? activeKinds.size === 0 : activeKinds.has(kind.value))
    }, [kind.label]);
    chip.onclick = () => {
      if (kind.value === null) {
        activeKinds.clear();
      } else if (activeKinds.has(kind.value)) {
        activeKinds.delete(kind.value);
      } else {
        activeKinds.add(kind.value);
      }
      updateChipStyles();
      executeSearch(input.value);
    };
    chipEls.push(chip);
    chipBar.appendChild(chip);
  }
  container.appendChild(chipBar);

  // Results area
  const resultsArea = api.createElement('div', {}, []);
  container.appendChild(resultsArea);

  // Search + render
  const renderResults = (query) => {
    resultsArea.innerHTML = '';
    const q = (query || '').trim().toLowerCase();

    // Apply module filter
    const filteredItems = activeModule
      ? codeItems.filter(i => i.id === activeModule)
      : codeItems;

    if (!q && !activeModule) {
      // Empty state: show stats
      const stats = api.createElement('div', {
        style: 'padding: 40px; text-align: center; color: var(--color-text-secondary); font-style: italic;'
      }, [codeItems.length + ' code items, ' + totalSymbols + ' total symbols']);
      resultsArea.appendChild(stats);
      return;
    }

    // Collect matches grouped by item
    const groups = []; // { item, matches: [sym] }
    for (const item of filteredItems) {
      const syms = item.content._symbols;
      const matches = [];
      for (const sym of Object.values(syms)) {
        if (q && !sym.name.toLowerCase().includes(q)) continue;
        if (activeKinds.size > 0) {
          let matched = false;
          if (activeKinds.has('function') && FUNCTION_KINDS.has(sym.kind)) matched = true;
          if (activeKinds.has('property') && (sym.kind === 'property' || sym.kind === 'field')) matched = true;
          if (activeKinds.has('class') && sym.kind === 'class') matched = true;
          if (activeKinds.has('method') && sym.kind === 'method') matched = true;
          if (!matched) continue;
        }
        matches.push(sym);
      }
      if (matches.length > 0) {
        matches.sort((a, b) => a.line - b.line);
        groups.push({ item, matches });
      }
    }

    if (groups.length === 0) {
      const noResults = api.createElement('div', {
        style: 'padding: 40px; text-align: center; color: var(--color-text-secondary); font-style: italic;'
      }, ['No symbols matching "' + query + '"']);
      resultsArea.appendChild(noResults);
      return;
    }

    // Match count header
    const total = groups.reduce((n, g) => n + g.matches.length, 0);
    const countHeader = api.createElement('div', {
      style: 'margin-bottom: 15px; font-size: 0.875rem; color: var(--color-text-secondary); font-weight: 500;'
    }, [total + ' symbol' + (total === 1 ? '' : 's') + ' across ' + groups.length + ' item' + (groups.length === 1 ? '' : 's')]);
    resultsArea.appendChild(countHeader);

    // Render groups
    for (const group of groups) {
      const groupEl = api.createElement('div', {
        style: 'margin-bottom: 16px; background: var(--color-bg-surface-alt); border-radius: var(--border-radius); overflow: hidden;'
      }, []);

      // Item header row
      const itemHeader = api.createElement('div', {
        style: 'display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--color-border-light); cursor: pointer; transition: background 0.15s;'
      }, []);
      itemHeader.onmouseover = () => { itemHeader.style.background = 'var(--color-border-light)'; };
      itemHeader.onmouseout = () => { itemHeader.style.background = ''; };
      itemHeader.onclick = () => api.openItem(group.item.id);

      const itemName = api.createElement('span', {
        style: 'font-weight: 600; font-size: 0.875rem; color: var(--color-text);'
      }, [group.item.name || group.item.id.substring(0, 8)]);
      itemHeader.appendChild(itemName);

      const arrow = api.createElement('span', {
        style: 'color: var(--color-text-secondary); font-size: 0.75rem;'
      }, ['\u2197']);
      itemHeader.appendChild(arrow);

      groupEl.appendChild(itemHeader);

      // Symbol rows
      for (const sym of group.matches) {
        const row = api.createElement('div', {
          style: 'display: flex; align-items: center; gap: 8px; padding: 7px 14px; cursor: pointer; transition: all 0.15s; border-bottom: 1px solid var(--color-border-light);'
        }, []);
        row.onmouseover = () => { row.style.background = 'var(--color-border-light)'; row.style.transform = 'translateX(4px)'; };
        row.onmouseout = () => { row.style.background = ''; row.style.transform = ''; };
        row.onclick = () => api.openItem(group.item.id, { symbol: sym.name });

        // Name + signature
        const nameEl = api.createElement('span', {
          style: 'font-family: monospace; font-size: 0.8125rem; color: var(--color-text); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
        }, [sym.name + (sym.signature || '')]);
        row.appendChild(nameEl);

        // Kind badge
        const kindLabel = kindShort(sym.kind);
        const badge = api.createElement('span', {
          style: 'font-size: 0.6875rem; padding: 1px 6px; border-radius: var(--border-radius); background: ' + kindColor(sym.kind) + '; color: white; flex-shrink: 0;'
        }, [kindLabel]);
        row.appendChild(badge);

        // Line number
        const lineEl = api.createElement('span', {
          style: 'font-size: 0.75rem; color: var(--color-text-secondary); font-family: monospace; min-width: 36px; text-align: right; flex-shrink: 0;'
        }, [':' + sym.line]);
        row.appendChild(lineEl);

        groupEl.appendChild(row);

        // JSDoc details (description + params + returns)
        if (sym.description || sym.params || sym.returns) {
          const detailEl = api.createElement('div', {
            style: 'padding: 2px 14px 6px 22px; font-size: 0.75rem; color: var(--color-text-secondary); border-bottom: 1px solid var(--color-border-light); line-height: 1.4;'
          }, []);
          if (sym.description) {
            detailEl.appendChild(api.createElement('div', {}, [sym.description.split('\n')[0]]));
          }
          if (sym.params) {
            for (const p of sym.params) {
              const paramLine = api.createElement('div', {
                style: 'padding-left: 8px; font-family: monospace; font-size: 0.6875rem;'
              }, []);
              const paramName = api.createElement('span', {
                style: 'color: var(--color-text);'
              }, [p.name]);
              paramLine.appendChild(paramName);
              if (p.type) {
                paramLine.appendChild(api.createElement('span', {
                  style: 'color: var(--color-text-secondary); opacity: 0.7;'
                }, [' : ' + p.type]));
              }
              if (p.description) {
                paramLine.appendChild(api.createElement('span', {}, [' \u2014 ' + p.description]));
              }
              detailEl.appendChild(paramLine);
            }
          }
          if (sym.returns) {
            const retLine = api.createElement('div', {
              style: 'padding-left: 8px; font-family: monospace; font-size: 0.6875rem;'
            }, []);
            retLine.appendChild(api.createElement('span', {
              style: 'color: var(--color-text); opacity: 0.7;'
            }, ['\u2192 ']));
            if (sym.returns.type) {
              retLine.appendChild(api.createElement('span', {
                style: 'color: var(--color-text-secondary); opacity: 0.7;'
              }, [sym.returns.type]));
            }
            if (sym.returns.description) {
              retLine.appendChild(api.createElement('span', {}, [' \u2014 ' + sym.returns.description]));
            }
            detailEl.appendChild(retLine);
          }
          groupEl.appendChild(detailEl);
        }
      }

      resultsArea.appendChild(groupEl);
    }
  };

  // Debounced search
  let searchTimeout = null;
  const executeSearch = (query) => {
    // Persist query + kind filter
    browser.content = { ...browser.content, query, kindFilter: [...activeKinds], moduleFilter: activeModule };
    browser.modified = Date.now();
    api.set(browser);
    renderResults(query);
  };

  input.oninput = (e) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => executeSearch(e.target.value), 300);
  };

  // Initial render
  renderResults(browser.content?.query || '');

  // Auto-focus
  setTimeout(() => input.focus(), 0);

  return container;
}

function chipStyle(active) {
  const base = 'padding: 5px 14px; font-size: 0.8125rem; border-radius: 16px; cursor: pointer; transition: all 0.15s; border: 1px solid; ';
  return active
    ? base + 'background: var(--color-primary); color: white; border-color: var(--color-primary);'
    : base + 'background: transparent; color: var(--color-text-secondary); border-color: var(--color-border);';
}

function kindShort(kind) {
  const map = {
    'function': 'fn', 'property-function': 'fn', 'field-function': 'fn',
    'class': 'class', 'method': 'method',
    'property': 'prop', 'field': 'prop', 'variable': 'var'
  };
  return map[kind] || kind;
}

function kindColor(kind) {
  const map = {
    'function': '#3b82f6', 'property-function': '#3b82f6', 'field-function': '#3b82f6',
    'class': '#8b5cf6', 'method': '#06b6d4',
    'property': '#f59e0b', 'field': '#f59e0b', 'variable': '#6b7280'
  };
  return map[kind] || '#6b7280';
}
