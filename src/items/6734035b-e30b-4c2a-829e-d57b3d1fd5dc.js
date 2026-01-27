// Item: item-search-lib
// ID: 6734035b-e30b-4c2a-829e-d57b3d1fd5dc
// Type: 66666666-0000-0000-0000-000000000000


/**
 * Search items based on query string
 */
export async function searchItems(query, api, options = {}) {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const { targetContainer, allItems } = options;
  let itemsToSearch;

  if (allItems) {
    itemsToSearch = allItems;
  } else if (targetContainer) {
    try {
      const container = await api.get(targetContainer);
      const childIds = (container.children || []).map(c =>
        typeof c === 'string' ? c : c.id
      );
      itemsToSearch = await Promise.all(
        childIds.map(id => api.get(id).catch(() => null))
      );
      itemsToSearch = itemsToSearch.filter(i => i !== null);
    } catch (err) {
      console.error('Error fetching container:', err);
      itemsToSearch = [];
    }
  } else {
    itemsToSearch = await api.getAll();
  }

  const queryLower = query.toLowerCase();
  const matches = itemsToSearch.filter(item => {
    const searchableText = [
      item.id,
      item.type,
      item.name,
      item.content?.title,
      item.content?.body,
      item.content?.description,
      JSON.stringify(item.content)
    ].filter(Boolean).join(' ').toLowerCase();

    return searchableText.includes(queryLower);
  });

  matches.sort((a, b) => a.name.localeCompare(b.name));
  return matches;
}

/**
 * Create a search UI widget
 */
export function createSearchUI(containerEl, onSelect, api, options = {}) {
  const {
    placeholder = 'Search for items...',
    savedQuery = '',
    targetContainer = null,
    autoFocus = false
  } = options;

  containerEl.innerHTML = '';

  const searchBox = api.createElement('div', {
    style: 'margin-bottom: 20px;'
  }, []);

  const input = api.createElement('input', {
    type: 'text',
    placeholder,
    value: savedQuery,
    style: 'width: 100%; padding: 12px 16px; font-size: 16px; border: 2px solid #d0d0d0; border-radius: 8px; outline: none; transition: border-color 0.2s;'
  }, []);

  input.onfocus = () => { input.style.borderColor = '#3b82f6'; };
  input.onblur = () => { input.style.borderColor = '#d0d0d0'; };

  searchBox.appendChild(input);
  containerEl.appendChild(searchBox);

  const resultsContainer = api.createElement('div', {}, []);
  containerEl.appendChild(resultsContainer);

  const statusDiv = api.createElement('div', {
    style: 'padding: 40px; text-align: center; color: #999; font-style: italic;'
  }, ['Type to search...']);
  resultsContainer.appendChild(statusDiv);

  const resultsList = api.createElement('div', {
    style: 'display: none; max-height: 600px; overflow-y: auto;'
  }, []);
  resultsContainer.appendChild(resultsList);

  let searchTimeout = null;
  let currentQuery = savedQuery;

  const executeSearch = async (query) => {
    currentQuery = query;

    if (!query || query.trim().length === 0) {
      statusDiv.style.display = 'block';
      resultsList.style.display = 'none';
      statusDiv.textContent = 'Type to search...';
      return;
    }

    statusDiv.style.display = 'block';
    resultsList.style.display = 'none';
    statusDiv.textContent = 'Searching...';

    const matches = await searchItems(query, api, { targetContainer });

    if (matches.length === 0) {
      statusDiv.style.display = 'block';
      resultsList.style.display = 'none';
      statusDiv.innerHTML = '';

      // Message
      const noMatchMsg = api.createElement('div', {
        style: 'margin-bottom: 16px;'
      }, ['No items found matching "' + query + '"']);
      statusDiv.appendChild(noMatchMsg);

      // Create New button
      const createBtn = api.createElement('button', {
        style: 'padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;',
        onclick: async () => {
          try {
            // Look up note type
            const noteTypes = await api.query({ name: 'note' });
            const noteTypeId = noteTypes[0]?.id || '871ae771-b9b1-4f40-8c7f-d9038bfb69c3';

            // Create sanitized name (lowercase, underscores for spaces)
            const sanitizedName = query.toLowerCase().replace(/\s+/g, '_');

            // Create new note item
            const newItem = {
              id: crypto.randomUUID(),
              name: sanitizedName,
              type: noteTypeId,
              created: Date.now(),
              modified: Date.now(),
              children: [],
              content: {
                title: query,
                description: ''
              }
            };

            // Save and select
            await api.set(newItem);
            onSelect(newItem);
          } catch (err) {
            console.error('Failed to create item:', err);
            alert('Failed to create item: ' + err.message);
          }
        }
      }, ['Create New: ' + query]);

      // Hover effects
      createBtn.onmouseover = () => {
        createBtn.style.background = '#2563eb';
      };
      createBtn.onmouseout = () => {
        createBtn.style.background = '#3b82f6';
      };

      statusDiv.appendChild(createBtn);
    } else {
      statusDiv.style.display = 'none';
      resultsList.style.display = 'block';
      resultsList.innerHTML = '';

      const countHeader = api.createElement('div', {
        style: 'margin-bottom: 15px; font-size: 14px; color: #666; font-weight: 500;'
      }, ['Found ' + matches.length + ' item' + (matches.length === 1 ? '' : 's')]);
      resultsList.appendChild(countHeader);

      matches.forEach(item => {
        const resultDiv = api.createElement('div', {
          style: 'padding: 12px; margin-bottom: 8px; background: white; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; transition: all 0.2s;'
        }, []);

        const itemTitle = api.createElement('div', {
          style: 'font-weight: 500; color: #333; margin-bottom: 6px; font-size: 15px;'
        }, [item.name || item.content?.title || item.id]);
        resultDiv.appendChild(itemTitle);

        const previewText = item.content?.body || item.content?.description ||
                           JSON.stringify(item.content).substring(0, 150);
        const preview = api.createElement('div', {
          style: 'font-size: 13px; color: #666; margin-bottom: 6px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;'
        }, [previewText.substring(0, 200)]);
        resultDiv.appendChild(preview);

        const meta = api.createElement('div', {
          style: 'font-size: 12px; color: #999;'
        }, [
          'Type: ' + item.type.substring(0, 8) + '... | Modified: ' +
          new Date(item.modified).toLocaleDateString()
        ]);
        resultDiv.appendChild(meta);

        resultDiv.onclick = () => { onSelect(item); };

        resultDiv.onmouseover = () => {
          resultDiv.style.background = '#f8f9fa';
          resultDiv.style.borderColor = '#3b82f6';
          resultDiv.style.transform = 'translateX(4px)';
        };
        resultDiv.onmouseout = () => {
          resultDiv.style.background = 'white';
          resultDiv.style.borderColor = '#ddd';
          resultDiv.style.transform = 'translateX(0)';
        };

        resultsList.appendChild(resultDiv);
      });
    }
  };

  const performSearch = (query) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(() => {
      executeSearch(query);
    }, 300);
  };

  input.oninput = (e) => {
    performSearch(e.target.value);
  };

  if (autoFocus) {
    setTimeout(() => input.focus(), 0);
  }

  if (savedQuery && savedQuery.trim().length > 0) {
    executeSearch(savedQuery);
  }

  return {
    performSearch: executeSearch,
    getQuery: () => currentQuery,
    setQuery: (query) => {
      input.value = query;
      executeSearch(query);
    },
    destroy: () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      containerEl.innerHTML = '';
    }
  };
}
