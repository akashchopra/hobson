

export async function render(search, api) {
  const searchLib = await api.require('item-search-lib');

  const container = api.createElement('div', {
    class: 'item-search-view',
    style: 'width: 100%; max-width: 800px; margin: 0 auto; padding: 20px; box-sizing: border-box;'
  }, []);

  // Header
  const header = api.createElement('div', {
    style: 'margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid var(--color-border-light);'
  }, []);

  const title = api.createElement('h2', {
    style: 'margin: 0; font-size: 20px;'
  }, [search.name || 'Search']);
  header.appendChild(title);
  container.appendChild(header);

  // Search input
  const searchBox = api.createElement('div', {
    style: 'margin-bottom: 20px;'
  }, []);

  const input = api.createElement('input', {
    type: 'text',
    placeholder: 'Search for items...',
    value: search.content?.currentQuery || '',
    style: 'width: 100%; padding: 12px 16px; font-size: 16px; border: 2px solid var(--color-border); border-radius: 8px; outline: none; transition: border-color 0.2s;'
  }, []);

  input.onfocus = () => { input.style.borderColor = 'var(--color-primary)'; };
  input.onblur = () => { input.style.borderColor = 'var(--color-border)'; };

  searchBox.appendChild(input);
  container.appendChild(searchBox);

  // Results area
  const resultsArea = api.createElement('div', {}, []);
  container.appendChild(resultsArea);

  // Find compact_card_view for rendering results (default view)
  const compactViews = await api.query({ name: 'compact-card-view' });
  const compactViewId = compactViews[0]?.id || null;

  // Cycle handler - returns a clickable card for items in render path
  const onCycle = (cycleItem) => {
    const card = api.createElement('div', {
      'data-item-id': cycleItem.id,
      style: 'padding: 12px; margin-bottom: 8px; background: var(--color-warning-light); border: 1px dashed var(--color-warning); border-radius: var(--border-radius); cursor: pointer; transition: all 0.2s;'
    }, []);

    const titleRow = api.createElement('div', {
      style: 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;'
    }, []);

    const icon = api.createElement('span', {
      style: 'color: var(--color-warning);'
    }, ['\u21bb']);
    titleRow.appendChild(icon);

    const name = api.createElement('span', {
      style: 'font-weight: 500; color: var(--color-text);'
    }, [cycleItem.name || cycleItem.id.substring(0, 8)]);
    titleRow.appendChild(name);

    const badge = api.createElement('span', {
      style: 'font-size: 11px; color: #92400e; background: #fef3c7; padding: 2px 6px; border-radius: var(--border-radius);'
    }, ['in current view']);
    titleRow.appendChild(badge);

    card.appendChild(titleRow);

    const meta = api.createElement('div', {
      style: 'font-size: 12px; color: var(--color-border-dark);'
    }, ['Click to open']);
    card.appendChild(meta);

    card.onmouseover = () => {
      card.style.background = '#fef3c7';
      card.style.borderColor = '#d97706';
      card.style.transform = 'translateX(4px)';
    };
    card.onmouseout = () => {
      card.style.background = 'var(--color-warning-light)';
      card.style.borderColor = 'var(--color-warning)';
      card.style.transform = 'translateX(0)';
    };

    card.onclick = (e) => {
      e.stopPropagation();
      api.siblingContainer?.addSibling(cycleItem.id);
    };

    return card;
  };

  // Render current results from attachments
  const renderResults = async () => {
    resultsArea.innerHTML = '';

    const query = search.content?.currentQuery || '';
    const attachments = search.attachments || [];

    if ((!query || query.trim().length === 0) && attachments.length === 0) {
      const emptyMsg = api.createElement('div', {
        style: 'padding: 40px; text-align: center; color: var(--color-border-dark); font-style: italic;'
      }, ['Type to search...']);
      resultsArea.appendChild(emptyMsg);
    } else if (attachments.length === 0) {
      // No results - show create option
      const noResults = api.createElement('div', {
        style: 'text-align: center; padding: 40px;'
      }, []);

      const msg = api.createElement('div', {
        style: 'margin-bottom: 20px; color: var(--color-text-secondary);'
      }, ['No items found matching "' + query + '"']);
      noResults.appendChild(msg);

      /*
      const createBtn = api.createElement('button', {
        style: 'padding: 10px 20px; background: var(--color-primary); color: white; border: none; border-radius: var(--border-radius); cursor: pointer; font-size: 14px;',
        onclick: async () => {
          const noteTypes = await api.query({ name: 'note' });
          const noteTypeId = noteTypes[0]?.id || api.IDS.ATOM;

          const newItem = {
            id: crypto.randomUUID(),
            name: query.toLowerCase().replace(/\s+/g, '_'),
            type: noteTypeId,
            created: Date.now(),
            modified: Date.now(),
            attachments: [],
            content: {
              title: query,
              description: ''
            }
          };

          await api.set(newItem);
          api.openSibling(newItem.id);
        }
      }, ['Create New: ' + query]);

      createBtn.onmouseover = () => { createBtn.style.background = 'var(--color-primary-hover)'; };
      createBtn.onmouseout = () => { createBtn.style.background = 'var(--color-primary)'; };

      noResults.appendChild(createBtn); */
      resultsArea.appendChild(noResults);
    } else {
      // Has results - render attachments with their specified view or compact view
      const isStarred = !query || query.trim().length === 0;
      const headerText = isStarred
        ? '\u2605 Starred'
        : 'Found ' + attachments.length + ' item' + (attachments.length === 1 ? '' : 's');
      const countHeader = api.createElement('div', {
        style: 'margin-bottom: 15px; font-size: 14px; color: var(--color-text-secondary); font-weight: 500;'
      }, [headerText]);
      resultsArea.appendChild(countHeader);

      const resultsList = api.createElement('div', {}, []);

      for (const childSpec of attachments) {
        const childId = typeof childSpec === 'string' ? childSpec : childSpec.id;
        // Respect per-child view override (from "Display As..."), fall back to compact view
        const childViewId = (typeof childSpec === 'object' && childSpec.view?.type) ? childSpec.view.type : compactViewId;

        try {
          const childNode = await api.renderItem(childId, childViewId, { onCycle });
          // data-item-id is set automatically by api.renderItem()
          childNode.setAttribute('data-parent-id', search.id);

          // Starred items navigate to root instead of opening as siblings
          if (isStarred) {
            childNode.addEventListener('click', (e) => {
              e.stopPropagation();
              e.preventDefault();
              document.getElementById('item-palette-overlay')?.remove();
              api.navigate(childId);
            }, true);
          }

          resultsList.appendChild(childNode);
        } catch (err) {
          const errorNode = api.createElement('div', {
            style: 'padding: 12px; margin-bottom: 8px; color: var(--color-danger); border: 1px solid var(--color-danger); border-radius: var(--border-radius); background: var(--color-danger-light);'
          }, ['Error loading item: ' + childId]);
          resultsList.appendChild(errorNode);
        }
      }

      resultsArea.appendChild(resultsList);
    }
  };

  // Search execution with debouncing
  let searchTimeout = null;

  const executeSearch = async (query) => {
    const targetContainer = search.content?.target_container || null;
    let matches;
    if (!query || query.trim().length === 0) {
      matches = await searchLib.getStarredItems(api, { targetContainer });
    } else {
      matches = await searchLib.searchItems(query, api, { targetContainer });
    }

    search.attachments = matches.map(m => ({ id: m.id }));
    search.content = { ...search.content, currentQuery: query };
    search.modified = Date.now();
    await api.set(search);
    await renderResults();
  };

  // Initial render — fetch starred items if no saved query, otherwise render saved results
  if (!search.content?.currentQuery) {
    await executeSearch('');
  } else {
    await renderResults();
  }

  input.oninput = (e) => {
    const query = e.target.value;

    // Show searching indicator
    if (query && query.trim().length > 0) {
      resultsArea.innerHTML = '';
      const searching = api.createElement('div', {
        style: 'padding: 40px; text-align: center; color: var(--color-border-dark); font-style: italic;'
      }, ['Searching...']);
      resultsArea.appendChild(searching);
    }

    // Debounce actual search
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => executeSearch(query), 300);
  };

  // Auto-focus if no query yet
  if (!search.content?.currentQuery) {
    setTimeout(() => input.focus(), 0);
  }

  return container;
}
