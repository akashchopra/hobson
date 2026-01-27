// Item: item_search_view
// ID: 9428203f-c088-4a54-bbcb-fdbef244189e
// Type: aaaaaaaa-0000-0000-0000-000000000000


export async function render(search, api) {
  const searchLib = await api.require('item-search-lib');

  const container = api.createElement('div', {
    class: 'item-search-view',
    style: 'max-width: 800px; margin: 0 auto; padding: 20px;'
  }, []);

  // Header
  const header = api.createElement('div', {
    style: 'margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0;'
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
    style: 'width: 100%; padding: 12px 16px; font-size: 16px; border: 2px solid #d0d0d0; border-radius: 8px; outline: none; transition: border-color 0.2s;'
  }, []);

  input.onfocus = () => { input.style.borderColor = '#3b82f6'; };
  input.onblur = () => { input.style.borderColor = '#d0d0d0'; };

  searchBox.appendChild(input);
  container.appendChild(searchBox);

  // Results area
  const resultsArea = api.createElement('div', {}, []);
  container.appendChild(resultsArea);

  // Find compact_card_view for rendering results (default view)
  const compactViews = await api.query({ name: 'compact_card_view' });
  const compactViewId = compactViews[0]?.id || null;

  // Cycle handler - returns a clickable card for items in render path
  const onCycle = (cycleItem) => {
    const card = api.createElement('div', {
      'data-item-id': cycleItem.id,
      style: 'padding: 12px; margin-bottom: 8px; background: #fffbeb; border: 1px dashed #f59e0b; border-radius: 6px; cursor: pointer; transition: all 0.2s;'
    }, []);

    const titleRow = api.createElement('div', {
      style: 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;'
    }, []);

    const icon = api.createElement('span', {
      style: 'color: #f59e0b;'
    }, ['↻']);
    titleRow.appendChild(icon);

    const name = api.createElement('span', {
      style: 'font-weight: 500; color: #333;'
    }, [cycleItem.name || cycleItem.id.substring(0, 8)]);
    titleRow.appendChild(name);

    const badge = api.createElement('span', {
      style: 'font-size: 11px; color: #92400e; background: #fef3c7; padding: 2px 6px; border-radius: 4px;'
    }, ['in current view']);
    titleRow.appendChild(badge);

    card.appendChild(titleRow);

    const meta = api.createElement('div', {
      style: 'font-size: 12px; color: #999;'
    }, ['Click to open']);
    card.appendChild(meta);

    card.onmouseover = () => {
      card.style.background = '#fef3c7';
      card.style.borderColor = '#d97706';
      card.style.transform = 'translateX(4px)';
    };
    card.onmouseout = () => {
      card.style.background = '#fffbeb';
      card.style.borderColor = '#f59e0b';
      card.style.transform = 'translateX(0)';
    };

    card.onclick = (e) => {
      e.stopPropagation();
      api.siblingContainer?.addSibling(cycleItem.id);
    };

    return card;
  };

  // Render current results from children
  const renderResults = async () => {
    resultsArea.innerHTML = '';

    const query = search.content?.currentQuery || '';
    const children = search.children || [];

    if (!query || query.trim().length === 0) {
      const emptyMsg = api.createElement('div', {
        style: 'padding: 40px; text-align: center; color: #999; font-style: italic;'
      }, ['Type to search...']);
      resultsArea.appendChild(emptyMsg);
    } else if (children.length === 0) {
      // No results - show create option
      const noResults = api.createElement('div', {
        style: 'text-align: center; padding: 40px;'
      }, []);

      const msg = api.createElement('div', {
        style: 'margin-bottom: 20px; color: #666;'
      }, ['No items found matching "' + query + '"']);
      noResults.appendChild(msg);

      /*
      const createBtn = api.createElement('button', {
        style: 'padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;',
        onclick: async () => {
          const noteTypes = await api.query({ name: 'note' });
          const noteTypeId = noteTypes[0]?.id || api.IDS.ATOM;

          const newItem = {
            id: crypto.randomUUID(),
            name: query.toLowerCase().replace(/\s+/g, '_'),
            type: noteTypeId,
            created: Date.now(),
            modified: Date.now(),
            children: [],
            content: {
              title: query,
              description: ''
            }
          };

          await api.set(newItem);
          api.openSibling(newItem.id);
        }
      }, ['Create New: ' + query]);

      createBtn.onmouseover = () => { createBtn.style.background = '#2563eb'; };
      createBtn.onmouseout = () => { createBtn.style.background = '#3b82f6'; };

      noResults.appendChild(createBtn); */
      resultsArea.appendChild(noResults);
    } else {
      // Has results - render children with their specified view or compact view
      const countHeader = api.createElement('div', {
        style: 'margin-bottom: 15px; font-size: 14px; color: #666; font-weight: 500;'
      }, ['Found ' + children.length + ' item' + (children.length === 1 ? '' : 's')]);
      resultsArea.appendChild(countHeader);

      const resultsList = api.createElement('div', {}, []);

      for (const childSpec of children) {
        const childId = typeof childSpec === 'string' ? childSpec : childSpec.id;
        // Respect per-child view override (from "Display As..."), fall back to compact view
        const childViewId = (typeof childSpec === 'object' && childSpec.view?.type) ? childSpec.view.type : compactViewId;

        try {
          const childNode = await api.renderItem(childId, childViewId, { onCycle });
          // data-item-id is set automatically by api.renderItem()
          childNode.setAttribute('data-parent-id', search.id);
          resultsList.appendChild(childNode);
        } catch (err) {
          const errorNode = api.createElement('div', {
            style: 'padding: 12px; margin-bottom: 8px; color: #c00; border: 1px solid #fcc; border-radius: 6px; background: #fff5f5;'
          }, ['Error loading item: ' + childId]);
          resultsList.appendChild(errorNode);
        }
      }

      resultsArea.appendChild(resultsList);
    }
  };

  // Initial render of existing results
  await renderResults();

  // Search execution with debouncing
  let searchTimeout = null;

  const executeSearch = async (query) => {
    // Update children with search results
    const targetContainer = search.content?.target_container || null;
    const matches = await searchLib.searchItems(query, api, { targetContainer });

    // Store results as children and save query
    const updated = {
      ...search,
      children: matches.map(m => ({ id: m.id })),
      content: {
        ...search.content,
        currentQuery: query
      }
    };

    await api.set(updated);

    // Update local reference and re-render results
    search.children = updated.children;
    search.content = updated.content;
    await renderResults();
  };

  input.oninput = (e) => {
    const query = e.target.value;

    // Show searching indicator
    if (query && query.trim().length > 0) {
      resultsArea.innerHTML = '';
      const searching = api.createElement('div', {
        style: 'padding: 40px; text-align: center; color: #999; font-style: italic;'
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
