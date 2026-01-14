// Script to create note search type and renderer
// Run this in the Hobson REPL

// First, create the note_search type
const noteSearchTypeId = crypto.randomUUID();
await api.set({
  id: noteSearchTypeId,
  name: 'note_search',
  type: api.IDS.TYPE_DEFINITION,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    description: 'A search interface for finding items by text content'
  }
});

console.log('✓ Created note_search type:', noteSearchTypeId);

// Now create the note_search renderer
const noteSearchRendererCode = `
export async function render(search, api) {
  const container = api.createElement('div', {
    class: 'note-search-view',
    style: 'max-width: 800px; margin: 0 auto;'
  }, []);

  // Header
  const header = api.createElement('div', {
    style: 'margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0;'
  }, []);

  const title = api.createElement('h2', {
    style: 'margin: 0; font-size: 20px;'
  }, [search.content.title || 'Search']);
  header.appendChild(title);

  container.appendChild(header);

  // Search input
  const searchBox = api.createElement('div', {
    style: 'margin-bottom: 20px;'
  }, []);

  const input = api.createElement('input', {
    type: 'text',
    placeholder: 'Search for items...',
    style: \`
      width: 100%;
      padding: 12px 16px;
      font-size: 16px;
      border: 2px solid #d0d0d0;
      border-radius: 8px;
      outline: none;
      transition: border-color 0.2s;
    \`
  }, []);

  // Focus styling
  input.onfocus = () => { input.style.borderColor = '#3b82f6'; };
  input.onblur = () => { input.style.borderColor = '#d0d0d0'; };

  searchBox.appendChild(input);
  container.appendChild(searchBox);

  // Results container
  const resultsContainer = api.createElement('div', {}, []);
  container.appendChild(resultsContainer);

  // Status message (shown while searching or when empty)
  const statusDiv = api.createElement('div', {
    style: 'padding: 40px; text-align: center; color: #999; font-style: italic;'
  }, ['Type to search across all items...']);
  resultsContainer.appendChild(statusDiv);

  // Results list (hidden initially)
  const resultsList = api.createElement('div', {
    style: 'display: none; max-height: 600px; overflow-y: auto;'
  }, []);
  resultsContainer.appendChild(resultsList);

  // Search function with debounce
  let searchTimeout = null;
  const performSearch = async (query) => {
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Debounce: wait 300ms after user stops typing
    searchTimeout = setTimeout(async () => {
      if (!query || query.trim().length === 0) {
        // Empty query - show status message
        statusDiv.style.display = 'block';
        resultsList.style.display = 'none';
        statusDiv.textContent = 'Type to search across all items...';
        return;
      }

      // Show searching status
      statusDiv.style.display = 'block';
      resultsList.style.display = 'none';
      statusDiv.textContent = 'Searching...';

      // Get target container if specified
      const targetContainer = search.content.target_container;
      let itemsToSearch;

      if (targetContainer) {
        // Search only within target container's children
        const container = await api.get(targetContainer);
        const childIds = (container.children || []).map(c =>
          typeof c === 'string' ? c : c.id
        );
        itemsToSearch = await Promise.all(
          childIds.map(id => api.get(id).catch(() => null))
        );
        itemsToSearch = itemsToSearch.filter(i => i !== null);
      } else {
        // Search all items
        itemsToSearch = await api.getAll();
      }

      // Perform search
      const queryLower = query.toLowerCase();
      const matches = itemsToSearch.filter(item => {
        // Search in multiple fields
        const searchableText = [
          item.name,
          item.content?.title,
          item.content?.body,
          item.content?.description,
          JSON.stringify(item.content)
        ].filter(Boolean).join(' ').toLowerCase();

        return searchableText.includes(queryLower);
      });

      // Sort by modified date (most recent first)
      matches.sort((a, b) => b.modified - a.modified);

      // Display results
      if (matches.length === 0) {
        statusDiv.style.display = 'block';
        resultsList.style.display = 'none';
        statusDiv.textContent = \`No items found matching "\${query}"\`;
      } else {
        statusDiv.style.display = 'none';
        resultsList.style.display = 'block';
        resultsList.innerHTML = '';

        // Add count header
        const countHeader = api.createElement('div', {
          style: 'margin-bottom: 15px; font-size: 14px; color: #666; font-weight: 500;'
        }, [\`Found \${matches.length} item\${matches.length === 1 ? '' : 's'}\`]);
        resultsList.appendChild(countHeader);

        // Render each result
        matches.forEach(item => {
          const resultDiv = api.createElement('div', {
            style: \`
              padding: 12px;
              margin-bottom: 8px;
              background: white;
              border: 1px solid #ddd;
              border-radius: 6px;
              cursor: pointer;
              transition: all 0.2s;
            \`
          }, []);

          // Item name/title
          const itemTitle = api.createElement('div', {
            style: 'font-weight: 500; color: #333; margin-bottom: 6px; font-size: 15px;'
          }, [item.name || item.content?.title || item.id]);
          resultDiv.appendChild(itemTitle);

          // Preview text (from body or content)
          const previewText = item.content?.body || item.content?.description ||
                             JSON.stringify(item.content).substring(0, 150);
          const preview = api.createElement('div', {
            style: 'font-size: 13px; color: #666; margin-bottom: 6px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;'
          }, [previewText.substring(0, 200)]);
          resultDiv.appendChild(preview);

          // Metadata
          const meta = api.createElement('div', {
            style: 'font-size: 12px; color: #999;'
          }, [
            'Type: ' + item.type.substring(0, 8) + '... | Modified: ' +
            new Date(item.modified).toLocaleDateString()
          ]);
          resultDiv.appendChild(meta);

          // Click handler
          resultDiv.onclick = () => {
            api.openSibling(item.id);
          };

          // Hover effects
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
    }, 300); // 300ms debounce
  };

  // Attach search handler
  input.oninput = (e) => {
    performSearch(e.target.value);
  };

  return container;
}
`;

const noteSearchRendererId = crypto.randomUUID();
await api.set({
  id: noteSearchRendererId,
  name: 'note_search_renderer',
  type: api.IDS.RENDERER,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    for_type: noteSearchTypeId,
    code: noteSearchRendererCode
  }
});

console.log('✓ Created note_search_renderer:', noteSearchRendererId);

// Create a sample note search instance
const noteSearchInstanceId = crypto.randomUUID();
await api.set({
  id: noteSearchInstanceId,
  name: 'my_note_search',
  type: noteSearchTypeId,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    title: 'Search',
    target_container: null  // Search all items
  }
});

console.log('✓ Created note_search instance:', noteSearchInstanceId);
console.log('');
console.log('Summary:');
console.log('  Note Search Type:', noteSearchTypeId);
console.log('  Note Search Renderer:', noteSearchRendererId);
console.log('  Note Search Instance:', noteSearchInstanceId);
console.log('');
console.log('To view it, navigate to:', noteSearchInstanceId);
