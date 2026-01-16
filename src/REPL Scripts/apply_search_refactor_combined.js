// Combined script to apply search refactoring
// This creates item_search_lib and updates both renderers

console.log('=== Search Refactoring ===\n');

// Step 1: Create item_search_lib
console.log('Step 1: Creating item_search_lib library...');

const libraryCode = `
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
      item.name,
      item.content?.title,
      item.content?.body,
      item.content?.description,
      JSON.stringify(item.content)
    ].filter(Boolean).join(' ').toLowerCase();

    return searchableText.includes(queryLower);
  });

  matches.sort((a, b) => b.modified - a.modified);
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
      statusDiv.textContent = 'No items found matching "' + query + '"';
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
`;

const libId = await api.helpers.createLibrary('item_search_lib', libraryCode);
console.log('✓ Created item_search_lib:', libId, '\n');

// Step 2: Update note_search_renderer
console.log('Step 2: Updating note_search_renderer...');

const noteSearchRendererCode = `
export async function render(search, api) {
  const searchLib = await api.require('item_search_lib');

  const container = api.createElement('div', {
    class: 'note-search-view',
    style: 'max-width: 800px; margin: 0 auto;'
  }, []);

  const header = api.createElement('div', {
    style: 'margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0;'
  }, []);

  const title = api.createElement('h2', {
    style: 'margin: 0; font-size: 20px;'
  }, [search.content.title || 'Search']);
  header.appendChild(title);

  container.appendChild(header);

  const searchUIContainer = api.createElement('div', {}, []);
  container.appendChild(searchUIContainer);

  let saveTimeout = null;
  const saveQuery = async (query) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(async () => {
      const updated = {
        ...search,
        content: {
          ...search.content,
          currentQuery: query
        }
      };
      await api.update(updated);
    }, 500);
  };

  const searchController = searchLib.createSearchUI(
    searchUIContainer,
    (item) => {
      api.openSibling(item.id);
    },
    api,
    {
      placeholder: 'Search for items...',
      savedQuery: search.content.currentQuery || '',
      targetContainer: search.content.target_container || null,
      autoFocus: false
    }
  );

  const originalPerformSearch = searchController.performSearch;
  searchController.performSearch = async (query) => {
    await saveQuery(query);
    return originalPerformSearch(query);
  };

  return container;
}
`;

const noteSearchRenderers = await api.query({ name: 'note_search_renderer' });
if (noteSearchRenderers.length === 0) {
  console.log('⚠ note_search_renderer not found, skipping\n');
} else {
  const noteSearchRenderer = noteSearchRenderers[0];
  await api.update({
    ...noteSearchRenderer,
    content: {
      ...noteSearchRenderer.content,
      code: noteSearchRendererCode
    }
  });
  console.log('✓ Updated note_search_renderer\n');
}

// Step 3: Update note_renderer Insert Link
console.log('Step 3: Updating note_renderer Insert Link...');

const noteRenderers = await api.query({ name: 'note_renderer' });
if (noteRenderers.length === 0) {
  console.log('⚠ note_renderer not found, skipping\n');
} else {
  const noteRenderer = noteRenderers[0];
  let code = noteRenderer.content.code;

  const oldPickerStart = code.indexOf('const showLinkPicker = () => {');
  const insertLinkEnd = code.indexOf('await renderTags(true);', oldPickerStart);

  if (oldPickerStart === -1 || insertLinkEnd === -1) {
    console.log('⚠ Could not find link picker section, skipping\n');
  } else {
    const beforePicker = code.substring(0, oldPickerStart);
    const afterPicker = code.substring(insertLinkEnd);

    const newLinkPickerCode = `const showLinkPicker = async () => {
        pickerContainer.innerHTML = '';
        pickerContainer.style.display = 'block';

        const pickerHeader = api.createElement('div', {
          style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;'
        }, []);

        const pickerTitle = api.createElement('h4', {
          style: 'margin: 0;'
        }, ['Insert Link']);
        pickerHeader.appendChild(pickerTitle);

        const pickerClose = api.createElement('button', {
          style: 'padding: 6px 12px; cursor: pointer; background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px;',
          onclick: () => {
            pickerContainer.style.display = 'none';
            pickerContainer.innerHTML = '';
          }
        }, ['Close']);
        pickerHeader.appendChild(pickerClose);

        pickerContainer.appendChild(pickerHeader);

        const searchContainer = api.createElement('div', {}, []);
        pickerContainer.appendChild(searchContainer);

        const searchLib = await api.require('item_search_lib');

        const insertLink = (targetItem) => {
          const textarea = currentTextarea;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const targetName = targetItem.name || targetItem.content?.title || targetItem.id;
          const linkText = '[' + targetName + '](item://' + targetItem.id + ')';
          textarea.value = textarea.value.substring(0, start) + linkText + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + linkText.length;
          pickerContainer.style.display = 'none';
          pickerContainer.innerHTML = '';
          textarea.focus();
        };

        searchLib.createSearchUI(
          searchContainer,
          insertLink,
          api,
          {
            placeholder: 'Search items to link...',
            autoFocus: true
          }
        );
      };

      `;

    const updatedCode = beforePicker + newLinkPickerCode + afterPicker;

    await api.update({
      ...noteRenderer,
      content: {
        ...noteRenderer.content,
        code: updatedCode
      }
    });
    console.log('✓ Updated note_renderer Insert Link\n');
  }
}

console.log('=== Refactoring Complete ===\n');
console.log('Test by:');
console.log('1. Opening a note in edit mode');
console.log('2. Clicking "Insert Link" button');
console.log('3. You should see search instead of recent items\n');

'Done!'
