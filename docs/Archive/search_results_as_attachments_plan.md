# Implementation Plan: Search Results as Children

## Overview

Treat search results and tag browser matches as actual attachments of their parent items. This enables consistent interaction patterns (context menus, selection, Display As) without introducing new concepts.

**Prerequisite**: Cycle-safe rendering (implemented) - a search widget may find its own container as a result, which is now handled gracefully via `onCycle` callbacks.

## Phase 1: Create Compact Card View ✓ COMPLETED

**Purpose**: A reusable view for displaying items in a condensed list format.

**Location**: New view item
- **Name**: `compact_card_view`
- **Type**: `aaaaaaaa-0000-0000-0000-000000000000` (VIEW)
- **For Type**: `00000000-0000-0000-0000-000000000000` (atom - works for any item)

**Functionality**:
```javascript
export async function render(item, api) {
  // Note: data-item-id is set automatically by api.renderItem()
  const card = api.createElement('div', {
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

**Alternative**: This could be a declarative view-spec instead of imperative code.

## Phase 2: Update Item Search View ✓ COMPLETED

**Note**: Instead of modifying `item-search-lib`, we updated `item_search_view` directly to store results as attachments. The view handles search execution and child management.

**Changes to `item_search_view`**:

Modify the search execution to update the parent item's attachments:

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

  // Update parent item's attachments with results (debounced)
  const parentItem = await api.get(parentItemId);
  parentItem.attachments = matches.map(m => ({ id: m.id }));
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

## Phase 3: Create Item Search View ✓ COMPLETED

**Note**: `item_search_view` already existed; it was updated in Phase 2 to store results as attachments and render them with `compact_card_view`.

**Purpose**: Replace the custom rendering in `item-search-lib` with a proper view that displays attachments.

**New view**:
- **Name**: `item_search_view`
- **Type**: VIEW (`aaaaaaaa-0000-0000-0000-000000000000`)
- **For Type**: Item search type (needs to be created or identified)

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

      // Update attachments
      item.attachments = results.map(r => ({ id: r.id }));
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
  } else if (!item.attachments || item.attachments.length === 0) {
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
        // Create new item logic
        const noteTypes = await api.query({ name: 'note' });
        const noteTypeId = noteTypes[0]?.id || api.IDS.ATOM;

        const newItem = {
          id: crypto.randomUUID(),
          name: item.content.query.toLowerCase().replace(/\s+/g, '_'),
          type: noteTypeId,
          created: Date.now(),
          modified: Date.now(),
          attachments: [],
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
    // Has results - render each child with compact view
    const header = api.createElement('div', {
      style: 'margin-bottom: 15px; font-size: 14px; color: #666; font-weight: 500;'
    }, ['Found ' + item.attachments.length + ' item' + (item.attachments.length === 1 ? '' : 's')]);
    resultsArea.appendChild(header);

    const resultsList = api.createElement('div', {}, []);

    // Find the compact_card_view ID (or use default view)
    const compactViews = await api.query({ name: 'compact_card_view' });
    const compactViewId = compactViews[0]?.id || null;

    // Cycle handler - search may find its own container
    const onCycle = (cycleItem) => api.createElement('div', {
      style: 'padding: 12px; color: #888; font-style: italic; border: 1px dashed #ccc; border-radius: 4px;'
    }, ['↻ ' + (cycleItem.name || cycleItem.id.substring(0, 8)) + ' (current container)']);

    for (const childSpec of item.attachments) {
      const childId = typeof childSpec === 'string' ? childSpec : childSpec.id;

      // Render with compact card view, handling cycles
      const childNode = await api.renderItem(childId, compactViewId, { onCycle });

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

## Phase 4: Update Tag Browser View ✓ COMPLETED

**Changes to `tag_browser_view`**:

Similar approach - when a tag is clicked, update the browser item's attachments:

```javascript
const showTaggedItems = async (tag) => {
  // Find tagged items
  const allItems = await api.getAll();
  const taggedItems = allItems.filter(item =>
    item.tags && item.tags.includes(tag.id)
  );

  // Update browser item's attachments
  browser.attachments = taggedItems.map(item => ({ id: item.id }));
  browser.content.selectedTag = tag.id; // Track which tag is selected
  await api.set(browser);

  // Trigger re-render
  await api.navigate(api.viewport.getRoot());
};
```

Then render attachments using the compact view in the results section, with `onCycle` handler.

## Phase 5: Testing Checklist

- [x] Create `compact_card_view` item
- [x] Test compact view displays item info correctly
- [x] Update `item_search_view` with debounced child updates
- [x] Test search updates attachments correctly
- [x] Test context menu works on search results
- [x] Test "Display As..." works on search results
- [x] Test search results persist across sessions
- [x] Update tag browser view with child updates
- [x] Test tag browser context menus work
- [ ] Test performance with 100+ search results
- [x] Verify no unwanted re-renders during typing (debouncing works)
- [x] Test cycle handling (search widget finding its own container)

## Benefits Achieved

1. **Uniform interaction**: Search results behave exactly like container attachments
2. **Context menus work**: Right-click on results accesses full item menu
3. **View flexibility**: Can use "Display As..." on individual results
4. **Persistence**: Last search results visible on reload
5. **Simplicity**: One mechanism (attachments) instead of two (children + results)
6. **Composability**: Compact view reusable anywhere
7. **Cycle safety**: Search can find its own container without infinite loops

## Potential Issues & Mitigations

**Issue**: Excessive database writes during typing
**Mitigation**: 300ms debounce, writes only when typing stops

**Issue**: Results persist across sessions (might be confusing)
**Mitigation**: This is actually useful - seeing last search. If unwanted, add "Clear Results" button

**Issue**: Large result sets (1000+ items)
**Mitigation**: Add pagination or limit results to top 100. Address if it becomes a problem.

**Issue**: Search widget finding itself in results
**Mitigation**: Handled by cycle-safe rendering with `onCycle` callback showing "(current container)"

---

## Implementation Notes

- This approach treats `attachments` as a flexible attachment mechanism rather than just permanent containment
- Performance concerns about database writes are mitigated through debouncing
- The system becomes more consistent - all items that look like attachments ARE attachments
- Context menus and viewport features work uniformly across all child items
- Cycle-safe rendering ensures no infinite loops when search results include ancestor containers

## Additional Improvements Made During Implementation

1. **Clickable cycle indicator**: When an item in the render path appears in results, it shows as a clickable amber card that opens the item as a sibling (rather than a static indicator)

2. **Display As... support**: Results respect `childSpec.view` for per-result view overrides, enabling users to change how individual results are displayed

3. **`api.renderItem()` sets `data-item-id`**: Moved this responsibility from individual views to the API layer, so context menus work automatically regardless of which view rendered the item

4. **`data-parent-id` for context menus**: Views set this attribute so the viewport can determine the parent container when handling context menu actions
