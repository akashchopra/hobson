# Implementation Plan: Search Results as Children

## Overview

Treat search results and tag browser matches as actual children of their parent items. This enables consistent interaction patterns (context menus, selection, Display As) without introducing new concepts.

## Phase 1: Create Compact Card Renderer

**Purpose**: A reusable renderer for displaying items in a condensed list format.

**Location**: New renderer item
- **Name**: `compact-card-renderer`
- **Type**: `00000000-0000-0000-0000-000000000003` (renderer)
- **For Type**: `b9f282a6-dae0-4af2-89c0-70bd7a3b3259` (atom - works for any item)

**Functionality**:
```javascript
export async function render(item, api) {
  const card = api.createElement('div', {
    'data-item-id': item.id,
    class: 'compact-card',
    style: 'padding: 12px; margin-bottom: 8px; background: white; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; transition: all 0.2s;'
  }, []);
  
  // Title
  const title = api.createElement('div', {
    style: 'font-weight: 500; color: #333; margin-bottom: 6px;'
  }, [item.name || item.content?.title || item.id.substring(0, 8)]);
  card.appendChild(title);
  
  // Preview text
  const previewText = item.content?.body || item.content?.description || '';
  if (previewText) {
    const preview = api.createElement('div', {
      style: 'font-size: 13px; color: #666; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;'
    }, [previewText.substring(0, 200)]);
    card.appendChild(preview);
  }
  
  // Metadata
  const meta = api.createElement('div', {
    style: 'font-size: 12px; color: #999;'
  }, [
    'Type: ' + item.type.substring(0, 8) + '... | Modified: ' +
    new Date(item.modified).toLocaleDateString()
  ]);
  card.appendChild(meta);
  
  // Hover effects
  card.onmouseover = () => {
    card.style.background = '#f8f9fa';
    card.style.borderColor = '#3b82f6';
    card.style.transform = 'translateX(4px)';
  };
  card.onmouseout = () => {
    card.style.background = 'white';
    card.style.borderColor = '#ddd';
    card.style.transform = 'translateX(0)';
  };
  
  // Click to navigate
  card.onclick = (e) => {
    e.stopPropagation();
    api.openSibling(item.id);
  };
  
  return card;
}
```

## Phase 2: Update Item Search Renderer

**Changes to `item-search-lib.json`**:

Modify the search execution to update the parent item's children:

```javascript
const executeSearch = async (query) => {
  currentQuery = query;
  
  if (!query || query.trim().length === 0) {
    // Clear results
    await clearResults();
    statusDiv.style.display = 'block';
    resultsList.style.display = 'none';
    statusDiv.textContent = 'Type to search...';
    return;
  }
  
  statusDiv.style.display = 'block';
  resultsList.style.display = 'none';
  statusDiv.textContent = 'Searching...';
  
  const matches = await searchItems(query, api, { targetContainer });
  
  // Update parent item's children with results (debounced)
  const parentItem = await api.get(parentItemId);
  parentItem.children = matches.map(m => ({ id: m.id }));
  parentItem.content.query = query; // Save current query
  await api.set(parentItem);
  
  // Re-render will happen automatically via viewport
  await api.navigate(api.viewport.getRoot());
};
```

**Add debouncing**:
```javascript
let searchTimeout = null;

input.oninput = (e) => {
  const query = e.target.value;
  
  // Update UI immediately for responsiveness
  if (!query || query.trim().length === 0) {
    statusDiv.style.display = 'block';
    resultsList.style.display = 'none';
    statusDiv.textContent = 'Type to search...';
  } else {
    statusDiv.textContent = 'Searching...';
  }
  
  // Debounce the actual search and database write
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    executeSearch(query);
  }, 300);
};
```

## Phase 3: Create Item Search Renderer

**Purpose**: Replace the custom rendering in `item-search-lib` with a proper renderer that displays children.

**New renderer**:
- **Name**: `item-search-renderer`
- **Type**: Renderer
- **For Type**: Item search type (we need to identify this)

**Functionality**:
```javascript
export async function render(item, api) {
  const container = api.createElement('div', {
    style: 'max-width: 800px; margin: 0 auto; padding: 20px;'
  }, []);
  
  // Search box
  const searchBox = api.createElement('div', {
    style: 'margin-bottom: 20px;'
  }, []);
  
  const input = api.createElement('input', {
    type: 'text',
    placeholder: item.content.placeholder || 'Search for items...',
    value: item.content.query || '',
    style: 'width: 100%; padding: 12px 16px; font-size: 16px; border: 2px solid #d0d0d0; border-radius: 8px;'
  }, []);
  
  // Search logic with debouncing
  let searchTimeout;
  input.oninput = (e) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const searchLib = await api.require('item-search-lib');
      const results = await searchLib.searchItems(e.target.value, api, {
        targetContainer: item.content.targetContainer
      });
      
      // Update children
      item.children = results.map(r => ({ id: r.id }));
      item.content.query = e.target.value;
      await api.set(item);
      
      // Trigger re-render
      await api.navigate(api.viewport.getRoot());
    }, 300);
  };
  
  searchBox.appendChild(input);
  container.appendChild(searchBox);
  
  // Results area
  const resultsArea = api.createElement('div', {}, []);
  
  if (!item.content.query || item.content.query.trim().length === 0) {
    const emptyMsg = api.createElement('div', {
      style: 'padding: 40px; text-align: center; color: #999; font-style: italic;'
    }, ['Type to search...']);
    resultsArea.appendChild(emptyMsg);
  } else if (!item.children || item.children.length === 0) {
    // No results - show create new option
    const noResults = api.createElement('div', {
      style: 'text-align: center; padding: 40px;'
    }, []);
    
    const msg = api.createElement('div', {
      style: 'margin-bottom: 20px; color: #666;'
    }, ['No items found matching "' + item.content.query + '"']);
    noResults.appendChild(msg);
    
    const createBtn = api.createElement('button', {
      style: 'padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;',
      onclick: async () => {
        // Create new item logic (same as before)
        const noteTypes = await api.query({ name: 'note' });
        const noteTypeId = noteTypes[0]?.id || '871ae771-b9b1-4f40-8c7f-d9038bfb69c3';
        
        const newItem = {
          id: crypto.randomUUID(),
          name: item.content.query.toLowerCase().replace(/\s+/g, '_'),
          type: noteTypeId,
          created: Date.now(),
          modified: Date.now(),
          children: [],
          content: {
            title: item.content.query,
            description: ''
          }
        };
        
        await api.set(newItem);
        api.openSibling(newItem.id);
      }
    }, ['Create New: ' + item.content.query]);
    
    noResults.appendChild(createBtn);
    resultsArea.appendChild(noResults);
  } else {
    // Has results - render each child with compact renderer
    const header = api.createElement('div', {
      style: 'margin-bottom: 15px; font-size: 14px; color: #666; font-weight: 500;'
    }, ['Found ' + item.children.length + ' item' + (item.children.length === 1 ? '' : 's')]);
    resultsArea.appendChild(header);
    
    const resultsList = api.createElement('div', {}, []);
    
    for (const childSpec of item.children) {
      const childId = typeof childSpec === 'string' ? childSpec : childSpec.id;
      const childItem = await api.get(childId);
      
      // Render with compact card renderer
      const childNode = await api.renderItem(childId, 'compact-card-renderer');
      
      // Add parent context for viewport selection
      childNode.setAttribute('data-parent-id', item.id);
      
      resultsList.appendChild(childNode);
    }
    
    resultsArea.appendChild(resultsList);
  }
  
  container.appendChild(resultsArea);
  
  // Auto-focus input
  setTimeout(() => input.focus(), 0);
  
  return container;
}
```

## Phase 4: Update Tag Browser Renderer

**Changes to `tag-browser-renderer.json`**:

Similar approach - when a tag is clicked, update the browser item's children:

```javascript
const showTaggedItems = async (tag) => {
  // Find tagged items
  const allItems = await api.getAll();
  const taggedItems = allItems.filter(item =>
    item.tags && item.tags.includes(tag.id)
  );
  
  // Update browser item's children
  browser.children = taggedItems.map(item => ({ id: item.id }));
  browser.content.selectedTag = tag.id; // Track which tag is selected
  await api.set(browser);
  
  // Trigger re-render
  await api.navigate(api.viewport.getRoot());
};
```

Then render children using the compact renderer in the results section.

## Phase 5: Testing Checklist

- [ ] Create compact-card-renderer item
- [ ] Test compact renderer displays item info correctly
- [ ] Update item-search-lib with debounced child updates
- [ ] Create item-search-renderer
- [ ] Test search updates children correctly
- [ ] Test context menu works on search results
- [ ] Test "Display As..." works on search results
- [ ] Test search results persist across sessions
- [ ] Update tag-browser-renderer with child updates
- [ ] Test tag browser context menus work
- [ ] Test performance with 100+ search results
- [ ] Verify no unwanted re-renders during typing

## Benefits Achieved

1. **Uniform interaction**: Search results behave exactly like container children
2. **Context menus work**: Right-click on results accesses full item menu
3. **Renderer flexibility**: Can use "Display As..." on individual results
4. **Persistence**: Last search results visible on reload
5. **Simplicity**: One mechanism (children) instead of two (children + results)
6. **Composability**: Compact renderer reusable anywhere

## Potential Issues & Mitigations

**Issue**: Excessive database writes during typing
**Mitigation**: 300ms debounce, writes only when typing stops

**Issue**: Results persist across sessions (might be confusing)
**Mitigation**: This is actually useful - seeing last search. If unwanted, add "Clear Results" button

**Issue**: Large result sets (1000+ items)
**Mitigation**: Add pagination or limit results to top 100. Address if it becomes a problem.

---

## Implementation Notes

- This approach treats `children` as a flexible attachment mechanism rather than just permanent containment
- Performance concerns about database writes are mitigated through debouncing
- The system becomes more consistent - all items that look like children ARE children
- Context menus and viewport features work uniformly across all child items
