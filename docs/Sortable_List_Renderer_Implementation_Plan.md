# Sortable List Container Renderer - Implementation Plan

## Overview

Create a new renderer for containers that displays children as a vertically sortable list with drag-and-drop reordering and an item picker for adding existing items.

## Architecture Analysis

### Current Container Model

The existing **container renderer** uses a 2D spatial canvas model where:
- Children have `{id, x, y, width, height, z, minimized, maximized}` properties
- Positioning is absolute and explicit
- Drag-and-drop moves items in 2D space
- Items can overlap and have z-order

A sortable list is fundamentally different - it's about **sequential order** rather than **spatial position**.

### Data Model Decision

**Chosen Approach: Array Order Only**
```javascript
children: [
  {id: "item-1", renderer: null},
  {id: "item-2", renderer: "compact"},
  {id: "item-3", renderer: null}
]
// Order in array = order in list
```

**Rationale**:
- Simple, minimal data
- Already supported by existing child spec format
- Spatial properties (x, y, etc.) ignored by list renderer
- Maintains compatibility: switching renderers works naturally

### Philosophy Alignment

**Humane Dozen Principles**:
- ✅ **Self-revealing**: Drag handles make affordance clear
- ✅ **Direct manipulation**: Drag to reorder is intuitive
- ✅ **Always on**: List is always editable, no separate "edit mode"
- ✅ **Unified**: Uses same item/renderer architecture as spatial containers

**Use Cases**:
- To-do lists / task lists
- Reading lists / bookmarks
- Ordered steps in a process
- Table of contents
- Playlists / queues
- Sequential workflows

---

## Phase 1: Basic List Display

### 1.1 Create the List Renderer Item

**New Item**: `sortable_list_renderer`
- **Type**: `00000000-0000-0000-0000-000000000003` (renderer)
- **Content**:
  - `for_type`: `5c3f2631-cd4d-403a-be9c-e3a3c5ebdce9` (container type)
  - `code`: See below

### 1.2 Basic Structure

```javascript
export async function render(item, api) {
  const container = api.createElement('div', {
    style: 'display: flex; flex-direction: column; height: 100%; background: #fafafa;'
  }, []);

  // Header section
  const header = createHeader(item, api);
  container.appendChild(header);

  // List container
  const listContainer = api.createElement('div', {
    class: 'sortable-list-container',
    style: 'flex: 1; overflow-y: auto; padding: 16px;'
  }, []);

  const children = item.children || [];

  if (children.length === 0) {
    const empty = api.createElement('div', {
      style: 'text-align: center; color: #999; padding: 60px 20px; font-style: italic;'
    }, ['This list is empty. Click "+ Add Item" to add items.']);
    listContainer.appendChild(empty);
  } else {
    await renderChildren(listContainer, children, item, api);
  }

  container.appendChild(listContainer);
  
  return container;
}

function createHeader(item, api) {
  const header = api.createElement('div', {
    style: 'padding: 16px; border-bottom: 2px solid #e0e0e0; background: white;'
  }, []);

  const titleRow = api.createElement('div', {
    style: 'display: flex; justify-content: space-between; align-items: center;'
  }, []);

  const title = api.createElement('h2', {
    style: 'margin: 0; font-size: 20px;'
  }, [item.name || 'Untitled List']);

  const addButton = api.createElement('button', {
    style: 'padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;',
    onclick: () => showItemPicker(item, api)
  }, ['+ Add Item']);

  titleRow.appendChild(title);
  titleRow.appendChild(addButton);
  header.appendChild(titleRow);

  return header;
}

async function renderChildren(listContainer, children, parentItem, api) {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const childId = typeof child === 'string' ? child : child.id;
    
    const listItem = await createListItem(childId, i, child.renderer || null, parentItem, api);
    listContainer.appendChild(listItem);
  }
}

async function createListItem(childId, index, rendererId, parentItem, api) {
  const listItem = api.createElement('div', {
    'data-item-id': childId,
    'data-index': index,
    class: 'sortable-list-item',
    style: `
      display: flex;
      align-items: stretch;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 8px;
      overflow: hidden;
    `
  }, []);

  // Drag handle
  const dragHandle = api.createElement('div', {
    class: 'drag-handle',
    style: `
      width: 32px;
      background: #f5f5f5;
      border-right: 1px solid #ddd;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      user-select: none;
      flex-shrink: 0;
    `
  }, ['≡']);

  // Content area
  const contentArea = api.createElement('div', {
    style: 'flex: 1; padding: 12px; min-width: 0;'
  }, []);

  // Render the child item
  try {
    const childNode = await api.renderItem(childId, rendererId);
    contentArea.appendChild(childNode);
  } catch (error) {
    const errorMsg = api.createElement('div', {
      style: 'color: #c00; font-style: italic;'
    }, ['Error rendering item: ' + error.message]);
    contentArea.appendChild(errorMsg);
  }

  listItem.appendChild(dragHandle);
  listItem.appendChild(contentArea);

  return listItem;
}

function showItemPicker(parentItem, api) {
  // Placeholder for Phase 2
  alert('Item picker coming in Phase 2');
}
```

### 1.3 Visual Design

```
┌─────────────────────────────────┐
│ List Title          [+ Add Item]│ ← Header with button
├─────────────────────────────────┤
│                                 │
│  ┌──┬─────────────────────────┐│
│  │≡ │ Item 1 Content          ││ ← Drag handle + content
│  └──┴─────────────────────────┘│
│                                 │
│  ┌──┬─────────────────────────┐│
│  │≡ │ Item 2 Content          ││
│  └──┴─────────────────────────┘│
│                                 │
│  ┌──┬─────────────────────────┐│
│  │≡ │ Item 3 Content          ││
│  └──┴─────────────────────────┘│
│                                 │
└─────────────────────────────────┘
```

**Deliverable**: Basic list renderer that displays children vertically with drag handles (non-functional initially).

---

## Phase 2: Item Picker Modal

### 2.1 Item Picker UI Implementation

```javascript
function showItemPicker(parentItem, api) {
  // Create overlay
  const overlay = api.createElement('div', {
    style: `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `
  }, []);

  // Create modal
  const modal = api.createElement('div', {
    style: `
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `
  }, []);

  // Modal header
  const modalHeader = api.createElement('div', {
    style: 'padding: 20px; border-bottom: 1px solid #ddd;'
  }, []);

  const modalTitle = api.createElement('h3', {
    style: 'margin: 0 0 12px 0;'
  }, ['Add Item to List']);

  const searchInput = api.createElement('input', {
    type: 'text',
    placeholder: 'Search items...',
    style: `
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    `
  });

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(searchInput);

  // Results area
  const resultsArea = api.createElement('div', {
    style: 'flex: 1; overflow-y: auto; padding: 16px;'
  }, []);

  // Modal footer
  const modalFooter = api.createElement('div', {
    style: 'padding: 16px; border-top: 1px solid #ddd; text-align: right;'
  }, []);

  const cancelButton = api.createElement('button', {
    style: `
      padding: 8px 16px;
      background: #e0e0e0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 8px;
    `,
    onclick: () => document.body.removeChild(overlay)
  }, ['Cancel']);

  modalFooter.appendChild(cancelButton);

  modal.appendChild(modalHeader);
  modal.appendChild(resultsArea);
  modal.appendChild(modalFooter);
  overlay.appendChild(modal);

  // Load and display items
  loadItemsForPicker(resultsArea, searchInput, parentItem, api, overlay);

  // Close on overlay click
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  };

  document.body.appendChild(overlay);
  searchInput.focus();
}
```

### 2.2 Item Loading and Filtering

```javascript
async function loadItemsForPicker(resultsArea, searchInput, parentItem, api, overlay) {
  const updateResults = async () => {
    const searchTerm = searchInput.value.toLowerCase();
    
    // Get all items
    const allItems = await api.query({});
    
    // Filter out items already in this list
    const existingIds = (parentItem.children || []).map(c => 
      typeof c === 'string' ? c : c.id
    );
    
    const availableItems = allItems.filter(item => {
      // Exclude current parent and its children
      if (item.id === parentItem.id || existingIds.includes(item.id)) {
        return false;
      }
      
      // Apply search filter
      if (searchTerm) {
        const name = (item.name || '').toLowerCase();
        const title = (item.content?.title || '').toLowerCase();
        return name.includes(searchTerm) || title.includes(searchTerm);
      }
      
      return true;
    });

    // Sort by modified date (most recent first)
    availableItems.sort((a, b) => (b.modified || 0) - (a.modified || 0));

    // Clear results
    resultsArea.innerHTML = '';

    if (availableItems.length === 0) {
      const noResults = api.createElement('div', {
        style: 'text-align: center; color: #999; padding: 40px;'
      }, ['No items found']);
      resultsArea.appendChild(noResults);
      return;
    }

    // Display results (limit to 50)
    for (const item of availableItems.slice(0, 50)) {
      const resultItem = await createPickerResultItem(item, parentItem, api, overlay);
      resultsArea.appendChild(resultItem);
    }
  };

  // Initial load
  await updateResults();

  // Update on search
  searchInput.oninput = updateResults;
}
```

### 2.3 Result Item Display

```javascript
async function createPickerResultItem(item, parentItem, api, overlay) {
  const resultItem = api.createElement('div', {
    style: `
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: background 0.2s;
    `,
    onmouseenter: function() { this.style.background = '#f5f5f5'; },
    onmouseleave: function() { this.style.background = 'white'; },
    onclick: async () => {
      await addItemToList(parentItem, item.id, api);
      document.body.removeChild(overlay);
    }
  }, []);

  // Get type name
  const typeItem = await api.get(item.type);
  const typeName = typeItem?.name || 'unknown';

  const itemName = api.createElement('div', {
    style: 'font-weight: 500; margin-bottom: 4px;'
  }, [item.name || item.content?.title || item.id.slice(0, 8)]);

  const itemMeta = api.createElement('div', {
    style: 'font-size: 12px; color: #666;'
  }, [`Type: ${typeName}`]);

  resultItem.appendChild(itemName);
  resultItem.appendChild(itemMeta);

  return resultItem;
}
```

### 2.4 Adding Items to List

```javascript
async function addItemToList(parentItem, itemId, api) {
  // Get fresh parent data
  const fresh = await api.get(parentItem.id);
  
  // Normalize children to object format
  const children = (fresh.children || []).map(c => 
    typeof c === 'string' ? { id: c, renderer: null } : c
  );

  // Add new item at the end
  children.push({
    id: itemId,
    renderer: null
  });

  // Update parent
  const updated = {
    ...fresh,
    children: children,
    modified: Date.now()
  };

  await api.set(updated);
  
  // Re-render to show the new item
  await api.navigate(api.viewport.getRoot());
}
```

**Deliverable**: Working item picker that allows adding existing items to the list.

---

## Phase 3: Drag-and-Drop Reordering

### 3.1 Setup Drag System

```javascript
async function renderChildren(listContainer, children, parentItem, api) {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const childId = typeof child === 'string' ? child : child.id;
    
    const listItem = await createListItem(childId, i, child.renderer || null, parentItem, api);
    listContainer.appendChild(listItem);
  }
  
  // Setup drag-and-drop after all items are rendered
  setupDragAndDrop(listContainer, parentItem, api);
}
```

### 3.2 Drag-and-Drop Implementation

```javascript
function setupDragAndDrop(listContainer, parentItem, api) {
  let draggedItem = null;
  let draggedIndex = null;
  let dropIndicator = null;

  // Create drop indicator (invisible by default)
  dropIndicator = api.createElement('div', {
    class: 'drop-indicator',
    style: `
      height: 3px;
      background: #3498db;
      margin: 4px 0;
      border-radius: 2px;
      display: none;
    `
  });

  const items = listContainer.querySelectorAll('.sortable-list-item');
  
  items.forEach((item, index) => {
    const dragHandle = item.querySelector('.drag-handle');
    
    // Make item draggable via handle
    dragHandle.onmousedown = (e) => {
      e.preventDefault();
      startDrag(item, index, e);
    };
  });

  function startDrag(item, index, e) {
    draggedItem = item;
    draggedIndex = index;
    
    // Visual feedback
    item.style.opacity = '0.5';
    item.style.cursor = 'grabbing';
    const handle = item.querySelector('.drag-handle');
    handle.style.cursor = 'grabbing';

    // Insert drop indicator after the dragged item
    item.parentNode.insertBefore(dropIndicator, item.nextSibling);

    document.onmousemove = handleDrag;
    document.onmouseup = endDrag;
  }

  function handleDrag(e) {
    if (!draggedItem) return;

    const items = Array.from(listContainer.querySelectorAll('.sortable-list-item'));
    const mouseY = e.clientY;

    // Find where to show the drop indicator
    let targetIndex = null;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === draggedItem) continue;

      const rect = item.getBoundingClientRect();
      const itemMiddle = rect.top + rect.height / 2;

      if (mouseY < itemMiddle) {
        targetIndex = i;
        break;
      }
    }

    // If no target found, place at end
    if (targetIndex === null) {
      targetIndex = items.length;
    }

    // Show drop indicator at target position
    dropIndicator.style.display = 'block';
    
    if (targetIndex < items.length) {
      const targetItem = items[targetIndex];
      listContainer.insertBefore(dropIndicator, targetItem);
    } else {
      listContainer.appendChild(dropIndicator);
    }
  }

  async function endDrag(e) {
    if (!draggedItem) return;

    const items = Array.from(listContainer.querySelectorAll('.sortable-list-item'));
    const mouseY = e.clientY;

    // Calculate new index
    let newIndex = null;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === draggedItem) continue;

      const rect = item.getBoundingClientRect();
      const itemMiddle = rect.top + rect.height / 2;

      if (mouseY < itemMiddle) {
        newIndex = i;
        break;
      }
    }

    if (newIndex === null) {
      newIndex = items.length - 1;
    }

    // Adjust for removal of dragged item
    if (newIndex > draggedIndex) {
      newIndex--;
    }

    // Only update if position changed
    if (newIndex !== draggedIndex) {
      await updateChildOrder(parentItem, draggedIndex, newIndex, api);
    }

    // Cleanup
    draggedItem.style.opacity = '1';
    draggedItem.style.cursor = '';
    const handle = draggedItem.querySelector('.drag-handle');
    handle.style.cursor = 'grab';
    dropIndicator.style.display = 'none';
    
    draggedItem = null;
    draggedIndex = null;
    
    document.onmousemove = null;
    document.onmouseup = null;
  }
}
```

### 3.3 Order Update Logic

```javascript
async function updateChildOrder(parentItem, fromIndex, toIndex, api) {
  // Get fresh data
  const fresh = await api.get(parentItem.id);
  
  // Normalize children
  let children = (fresh.children || []).map(c => 
    typeof c === 'string' ? { id: c, renderer: null } : c
  );

  // Move item
  const [movedItem] = children.splice(fromIndex, 1);
  children.splice(toIndex, 0, movedItem);

  // Update silently to avoid re-render during interaction
  const updated = {
    ...fresh,
    children: children,
    modified: Date.now()
  };

  await api.set(updated);
  
  // Trigger re-render after a brief delay to show final state
  setTimeout(async () => {
    await api.navigate(api.viewport.getRoot());
  }, 100);
}
```

**Deliverable**: Full drag-and-drop reordering with visual feedback.

---

## Phase 4: Polish & Integration

### 4.1 Context Menu Integration

Update the list item to support context menu (right-click):

```javascript
async function createListItem(childId, index, rendererId, parentItem, api) {
  const listItem = api.createElement('div', {
    'data-item-id': childId,
    'data-parent-id': parentItem.id,  // Important for context menu
    'data-index': index,
    class: 'sortable-list-item',
    style: `...`
  }, []);
  
  // ... rest of implementation
}
```

This allows the existing viewport context menu system to work with list items.

### 4.2 Remove Button

```javascript
async function createListItem(childId, index, rendererId, parentItem, api) {
  // ... existing code for dragHandle and contentArea ...

  // Actions area
  const actions = api.createElement('div', {
    style: `
      width: 32px;
      border-left: 1px solid #ddd;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `
  }, []);

  const removeButton = api.createElement('button', {
    style: `
      background: none;
      border: none;
      color: #c00;
      cursor: pointer;
      font-size: 18px;
      padding: 4px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    onclick: async (e) => {
      e.stopPropagation();
      if (confirm('Remove this item from the list?')) {
        await removeItemFromList(parentItem, childId, api);
      }
    },
    title: 'Remove from list'
  }, ['×']);

  actions.appendChild(removeButton);

  listItem.appendChild(dragHandle);
  listItem.appendChild(contentArea);
  listItem.appendChild(actions);

  return listItem;
}

async function removeItemFromList(parentItem, childId, api) {
  const fresh = await api.get(parentItem.id);
  
  const children = (fresh.children || []).filter(c => {
    const id = typeof c === 'string' ? c : c.id;
    return id !== childId;
  });

  const updated = {
    ...fresh,
    children: children,
    modified: Date.now()
  };

  await api.set(updated);
  await api.navigate(api.viewport.getRoot());
}
```

### 4.3 Keyboard Shortcuts (Optional Enhancement)

```javascript
// In setupDragAndDrop or main render function
listContainer.onkeydown = async (e) => {
  const selected = listContainer.querySelector('.sortable-list-item.item-selected');
  if (!selected) return;

  const items = Array.from(listContainer.querySelectorAll('.sortable-list-item'));
  const currentIndex = items.indexOf(selected);

  if (e.key === 'ArrowUp' && e.metaKey && currentIndex > 0) {
    e.preventDefault();
    await updateChildOrder(parentItem, currentIndex, currentIndex - 1, api);
  } else if (e.key === 'ArrowDown' && e.metaKey && currentIndex < items.length - 1) {
    e.preventDefault();
    await updateChildOrder(parentItem, currentIndex, currentIndex + 1, api);
  }
};
```

### 4.4 CSS Styles

Create a CSS item for better styling:

**New Item**: `sortable_list_styles`
- **Type**: CSS type ID
- **Content**:

```css
.sortable-list-item:hover .drag-handle {
  background: #e8e8e8;
}

.sortable-list-item.item-selected {
  box-shadow: 0 0 0 2px #3498db;
}

.drag-handle:active {
  cursor: grabbing !important;
}

.drop-indicator {
  animation: pulse 0.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## Phase 5: Testing & Edge Cases

### 5.1 Test Scenarios

| Scenario | Expected Behavior | Status |
|----------|------------------|--------|
| Empty list | Shows empty state message | ⏳ |
| Add single item | Item appears at end | ⏳ |
| Add multiple items | All appear in order | ⏳ |
| Drag item up | Order updates correctly | ⏳ |
| Drag item down | Order updates correctly | ⏳ |
| Remove item | Item removed, others stay in order | ⏳ |
| Switch to spatial renderer | Items get default positions | ⏳ |
| Switch back to list renderer | Order preserved | ⏳ |
| Item already in list | Hidden from picker | ⏳ |
| Search in picker | Filters correctly | ⏳ |

### 5.2 Edge Cases

**Case 1: Mixed child format (string vs object)**
- **Issue**: Children might be stored as strings or objects
- **Solution**: Normalize on read: `typeof c === 'string' ? { id: c, renderer: null } : c`

**Case 2: Switching from spatial to list renderer**
- **Behavior**: Array order is preserved, spatial properties ignored
- **Action**: No action needed

**Case 3: Switching from list to spatial renderer**
- **Issue**: Items have no x/y/z properties
- **Solution**: Spatial renderer already handles this with default positioning

**Case 4: Item deleted while in list**
- **Issue**: Will error on render
- **Solution**: Add try-catch around `renderItem` (already present in Phase 1)

**Case 5: Circular references**
- **Issue**: Could create cycles
- **Solution**: Protected by kernel's `addChild` cycle detection ✓

**Case 6: Performance with large lists**
- **Issue**: 100+ items might be slow
- **Solution**: Defer virtualization until proven necessary

---

## Implementation Checklist

### Phase 1: Basic Display
- [ ] Create `sortable_list_renderer` item
- [ ] Implement header with title
- [ ] Implement empty state
- [ ] Implement list item rendering
- [ ] Add drag handle (visual only)
- [ ] Test with existing container items

### Phase 2: Item Picker
- [ ] Implement modal overlay
- [ ] Implement search input
- [ ] Implement item filtering logic
- [ ] Implement result display
- [ ] Implement item selection
- [ ] Test adding items to list

### Phase 3: Drag-and-Drop
- [ ] Implement drag start
- [ ] Implement drag move with indicator
- [ ] Implement drop logic
- [ ] Implement order update
- [ ] Test reordering items

### Phase 4: Polish
- [ ] Add context menu integration
- [ ] Add remove button
- [ ] Create CSS styles item
- [ ] Add keyboard shortcuts (optional)
- [ ] Test all interactions

### Phase 5: Testing
- [ ] Run full test suite
- [ ] Test edge cases
- [ ] Test renderer switching
- [ ] Document usage
- [ ] Update project documentation

---

## Success Criteria

1. ✅ Users can create a container and switch to "sortable list" renderer
2. ✅ Users can add existing items via picker modal
3. ✅ Users can drag-and-drop to reorder items
4. ✅ Users can remove items from list
5. ✅ Order persists across sessions
6. ✅ Renderer switching works correctly (list ↔ spatial)
7. ✅ Context menu works on list items
8. ✅ No crashes or data corruption

---

## Technical Notes

### Key Patterns Used

1. **Normalization Pattern**: Always normalize children format when reading:
   ```javascript
   const children = (item.children || []).map(c => 
     typeof c === 'string' ? { id: c, renderer: null } : c
   );
   ```

2. **Silent Updates During Interaction**: Use `api.set()` during drag to avoid flashing, then trigger re-render on completion

3. **Fresh Data Pattern**: Always fetch fresh data before updates to avoid stale closure bugs:
   ```javascript
   const fresh = await api.get(parentItem.id);
   // Work with fresh.children
   ```

4. **Context Menu Integration**: Add `data-parent-id` attribute to enable viewport context menu

5. **Error Boundaries**: Wrap child rendering in try-catch to handle missing/broken items gracefully

### API Methods Used

- `api.createElement(tag, props, children)` - Create DOM elements
- `api.renderItem(itemId, rendererId)` - Render child items
- `api.get(itemId)` - Fetch item data
- `api.set(item)` - Save without triggering re-render
- `api.query(filter)` - Query for items
- `api.navigate(itemId)` - Navigate to trigger re-render

---

## Future Enhancements

### Possible Variations

1. **Compact List Renderer**: Minimal padding, smaller text
2. **Numbered List Renderer**: Shows position numbers
3. **Checklist Renderer**: Adds checkbox to each item
4. **Tree List Renderer**: Hierarchical with collapse/expand

### Advanced Features

1. **Multi-select**: Shift+click to select range, Cmd+click for individual
2. **Bulk operations**: Delete/move multiple items at once
3. **Nested lists**: Lists within lists
4. **Virtualization**: Render only visible items for performance
5. **Quick add**: Inline form to create new items directly
6. **Sorting options**: Alphabetical, by date, by type, etc.
7. **Filtering**: Show/hide items by type or tag

---

## Notes for Implementation

- Start with Phase 1 to establish the basic structure
- Test thoroughly before moving to next phase
- Keep the code modular - each function should be self-contained
- Follow existing patterns from spatial container renderer
- Preserve the ability to switch between renderers
- Don't modify kernel - work within existing architecture
- Document any deviations from this plan
