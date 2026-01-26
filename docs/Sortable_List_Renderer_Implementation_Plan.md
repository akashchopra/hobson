# Sortable List View - Implementation Plan

## Overview

Create a new view that displays any item's children as a vertically sortable list with drag-and-drop reordering and an item picker for adding existing items.

## Architecture Analysis

### Universal Applicability

Any item can have children. This view provides a sequential (list) perspective on those children, complementing the spatial (2D canvas) perspective offered by the container view. The view ignores spatial properties (x, y, width, height) and uses array order exclusively.

### Data Model Decision

**Chosen Approach: Array Order Only**
```javascript
children: [
  {id: "item-1", view: null},
  {id: "item-2", view: "compact"},
  {id: "item-3", view: null}
]
// Order in array = order in list
```

**Rationale**:
- Simple, minimal data
- Already supported by existing child spec format
- Spatial properties ignored by list view
- Maintains compatibility: switching views works naturally

### Philosophy Alignment

**Humane Dozen Principles**:
- **Self-revealing**: Drag handles make affordance clear
- **Direct manipulation**: Drag to reorder is intuitive
- **Always on**: List is always editable, no separate "edit mode"
- **Unified**: Uses same item/view architecture as other views

**Use Cases**:
- To-do lists / task lists
- Reading lists / bookmarks
- Ordered steps in a process
- Table of contents
- Playlists / queues
- Sequential workflows

---

## Phase 1: Basic List Display

### 1.1 Create the List View Item

**New Item**: `sortable_list_view`
- **Type**: `aaaaaaaa-0000-0000-0000-000000000000` (renderer)
- **Content**:
  - `for_type`: `00000000-0000-0000-0000-000000000000` (atom - universal)
  - `code`: See below

### 1.2 Basic Structure

```javascript
export async function render(item, api) {
  const container = api.createElement('div', {
    class: 'sortable-list-view',
    style: 'display: flex; flex-direction: column; height: 100%; background: #fafafa;'
  }, []);

  // Header section
  const header = createHeader(item, api, container);
  container.appendChild(header);

  // List container
  const listContainer = api.createElement('div', {
    class: 'sortable-list-items',
    style: 'flex: 1; overflow-y: auto; padding: 16px;'
  }, []);

  container.appendChild(listContainer);

  // Initial render
  await renderChildren(listContainer, item, api);

  return container;
}

function createHeader(item, api, rootContainer) {
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
    onclick: () => showItemPicker(item, api, rootContainer)
  }, ['+ Add Item']);

  titleRow.appendChild(title);
  titleRow.appendChild(addButton);
  header.appendChild(titleRow);

  return header;
}

async function renderChildren(listContainer, parentItem, api) {
  listContainer.innerHTML = '';
  const children = parentItem.children || [];

  if (children.length === 0) {
    const empty = api.createElement('div', {
      style: 'text-align: center; color: #999; padding: 60px 20px; font-style: italic;'
    }, ['This list is empty. Click "+ Add Item" to add items.']);
    listContainer.appendChild(empty);
    return;
  }

  // Find compact_card_view for rendering children
  const compactViews = await api.query({ name: 'compact_card_view' });
  const defaultViewId = compactViews[0]?.id || null;

  for (let i = 0; i < children.length; i++) {
    const childSpec = children[i];
    const childId = typeof childSpec === 'string' ? childSpec : childSpec.id;
    const childViewId = (typeof childSpec === 'object' && childSpec.view) ? childSpec.view : defaultViewId;

    // Check if item exists before rendering
    const childItem = await api.get(childId);
    if (!childItem) continue;

    const listItem = await createListItem(childId, i, childViewId, parentItem, api, listContainer);
    listContainer.appendChild(listItem);
  }

  // Setup drag-and-drop after all items are rendered
  setupDragAndDrop(listContainer, parentItem, api);
}

async function createListItem(childId, index, viewId, parentItem, api, listContainer) {
  const listItem = api.createElement('div', {
    'data-item-id': childId,
    'data-parent-id': parentItem.id,
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
    const childNode = await api.renderItem(childId, viewId);
    contentArea.appendChild(childNode);
  } catch (error) {
    const errorMsg = api.createElement('div', {
      style: 'color: #c00; font-style: italic;'
    }, ['Error rendering item']);
    contentArea.appendChild(errorMsg);
  }

  // Remove button
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
      color: #999;
      cursor: pointer;
      font-size: 18px;
      padding: 4px;
    `,
    onclick: async (e) => {
      e.stopPropagation();
      await removeItemFromList(parentItem, childId, api, listContainer);
    },
    title: 'Remove from list'
  }, ['×']);
  removeButton.onmouseover = () => { removeButton.style.color = '#c00'; };
  removeButton.onmouseout = () => { removeButton.style.color = '#999'; };

  actions.appendChild(removeButton);

  listItem.appendChild(dragHandle);
  listItem.appendChild(contentArea);
  listItem.appendChild(actions);

  return listItem;
}
```

### 1.3 Visual Design

```
┌─────────────────────────────────┐
│ List Title          [+ Add Item]│ ← Header with button
├─────────────────────────────────┤
│                                 │
│  ┌──┬─────────────────────┬──┐ │
│  │≡ │ Item 1 Content      │× │ │ ← Drag handle + content + remove
│  └──┴─────────────────────┴──┘ │
│                                 │
│  ┌──┬─────────────────────┬──┐ │
│  │≡ │ Item 2 Content      │× │ │
│  └──┴─────────────────────┴──┘ │
│                                 │
└─────────────────────────────────┘
```

**Deliverable**: Basic list view that displays children vertically with drag handles and remove buttons.

---

## Phase 2: Item Picker (Reusing item-search-lib)

### 2.1 Item Picker Implementation

Reuse `item-search-lib` for the picker modal, following the pattern established by `field-editor-itemref`:

```javascript
async function showItemPicker(parentItem, api, rootContainer) {
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
    style: 'display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #ddd;'
  }, []);

  const modalTitle = api.createElement('h3', {
    style: 'margin: 0;'
  }, ['Add Item to List']);

  const closeBtn = api.createElement('button', {
    style: 'padding: 4px 10px; cursor: pointer; background: transparent; border: none; font-size: 24px; color: #666;',
    onclick: () => document.body.removeChild(overlay)
  }, ['×']);

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeBtn);
  modal.appendChild(modalHeader);

  // Search container
  const searchContainer = api.createElement('div', {
    style: 'padding: 20px; flex: 1; overflow: auto;'
  }, []);
  modal.appendChild(searchContainer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Load search library and create search UI
  const searchLib = await api.require('item-search-lib');

  // Get existing child IDs to filter them out
  const existingIds = new Set(
    (parentItem.children || []).map(c => typeof c === 'string' ? c : c.id)
  );
  existingIds.add(parentItem.id); // Also exclude self

  searchLib.createSearchUI(
    searchContainer,
    async (selectedItem) => {
      // Check if already in list
      if (existingIds.has(selectedItem.id)) {
        alert('This item is already in the list.');
        return;
      }
      await addItemToList(parentItem, selectedItem.id, api, rootContainer);
      document.body.removeChild(overlay);
    },
    api,
    {
      placeholder: 'Search for items to add...',
      autoFocus: true
    }
  );

  // Close on overlay click
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  };

  modal.onclick = (e) => e.stopPropagation();
}
```

### 2.2 Adding Items (Targeted DOM Update)

```javascript
async function addItemToList(parentItem, itemId, api, listContainer) {
  // Get fresh parent data
  const fresh = await api.get(parentItem.id);

  // Normalize children to object format
  const children = (fresh.children || []).map(c =>
    typeof c === 'string' ? { id: c } : c
  );

  // Add new item at the end
  children.push({ id: itemId });

  // Update parent
  const updated = {
    ...fresh,
    children: children,
    modified: Date.now()
  };

  await api.set(updated);

  // Update local reference
  parentItem.children = updated.children;

  // Targeted DOM update: re-render just the list items
  const itemsContainer = listContainer.querySelector('.sortable-list-items');
  if (itemsContainer) {
    await renderChildren(itemsContainer, parentItem, api);
  }
}
```

**Deliverable**: Working item picker that reuses `item-search-lib` and adds items with targeted DOM updates.

---

## Phase 3: Drag-and-Drop Reordering

### 3.1 Drag-and-Drop Implementation

```javascript
function setupDragAndDrop(listContainer, parentItem, api) {
  let draggedItem = null;
  let draggedIndex = null;
  let dropIndicator = null;

  // Create drop indicator
  dropIndicator = api.createElement('div', {
    class: 'drop-indicator',
    style: `
      height: 3px;
      background: #3498db;
      margin: 4px 0;
      border-radius: 2px;
      display: none;
    `
  }, []);

  const items = listContainer.querySelectorAll('.sortable-list-item');

  items.forEach((item, index) => {
    const dragHandle = item.querySelector('.drag-handle');

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
    item.querySelector('.drag-handle').style.cursor = 'grabbing';

    // Insert drop indicator
    item.parentNode.insertBefore(dropIndicator, item.nextSibling);

    document.onmousemove = handleDrag;
    document.onmouseup = endDrag;
  }

  function handleDrag(e) {
    if (!draggedItem) return;

    const items = Array.from(listContainer.querySelectorAll('.sortable-list-item'));
    const mouseY = e.clientY;

    let targetIndex = items.length;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === draggedItem) continue;

      const rect = item.getBoundingClientRect();
      if (mouseY < rect.top + rect.height / 2) {
        targetIndex = i;
        break;
      }
    }

    // Show drop indicator
    dropIndicator.style.display = 'block';

    if (targetIndex < items.length) {
      listContainer.insertBefore(dropIndicator, items[targetIndex]);
    } else {
      listContainer.appendChild(dropIndicator);
    }
  }

  async function endDrag(e) {
    if (!draggedItem) return;

    const items = Array.from(listContainer.querySelectorAll('.sortable-list-item'));
    const mouseY = e.clientY;

    let newIndex = items.length - 1;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === draggedItem) continue;

      const rect = item.getBoundingClientRect();
      if (mouseY < rect.top + rect.height / 2) {
        newIndex = i;
        break;
      }
    }

    // Adjust for removal of dragged item
    if (newIndex > draggedIndex) {
      newIndex--;
    }

    // Only update if position changed
    if (newIndex !== draggedIndex) {
      await updateChildOrder(parentItem, draggedIndex, newIndex, api, listContainer);
    }

    // Cleanup
    draggedItem.style.opacity = '1';
    draggedItem.style.cursor = '';
    draggedItem.querySelector('.drag-handle').style.cursor = 'grab';
    dropIndicator.style.display = 'none';
    if (dropIndicator.parentNode) {
      dropIndicator.parentNode.removeChild(dropIndicator);
    }

    draggedItem = null;
    draggedIndex = null;

    document.onmousemove = null;
    document.onmouseup = null;
  }
}
```

### 3.2 Order Update (Targeted DOM Update)

```javascript
async function updateChildOrder(parentItem, fromIndex, toIndex, api, listContainer) {
  // Get fresh data
  const fresh = await api.get(parentItem.id);

  // Normalize children
  let children = (fresh.children || []).map(c =>
    typeof c === 'string' ? { id: c } : c
  );

  // Move item in array
  const [movedItem] = children.splice(fromIndex, 1);
  children.splice(toIndex, 0, movedItem);

  // Save update
  const updated = {
    ...fresh,
    children: children,
    modified: Date.now()
  };

  await api.set(updated);

  // Update local reference
  parentItem.children = updated.children;

  // Targeted DOM update: move the element in the DOM
  const items = Array.from(listContainer.querySelectorAll('.sortable-list-item'));
  const movedElement = items[fromIndex];

  if (toIndex >= items.length - 1) {
    listContainer.appendChild(movedElement);
  } else {
    const targetElement = toIndex > fromIndex ? items[toIndex + 1] : items[toIndex];
    listContainer.insertBefore(movedElement, targetElement);
  }

  // Update data-index attributes
  listContainer.querySelectorAll('.sortable-list-item').forEach((el, i) => {
    el.setAttribute('data-index', i);
  });
}
```

**Deliverable**: Full drag-and-drop reordering with visual feedback and targeted DOM updates.

---

## Phase 4: Remove Item (Targeted DOM Update)

```javascript
async function removeItemFromList(parentItem, childId, api, listContainer) {
  // Get fresh data
  const fresh = await api.get(parentItem.id);

  // Filter out the removed child
  const children = (fresh.children || []).filter(c => {
    const id = typeof c === 'string' ? c : c.id;
    return id !== childId;
  });

  // Save update
  const updated = {
    ...fresh,
    children: children,
    modified: Date.now()
  };

  await api.set(updated);

  // Update local reference
  parentItem.children = updated.children;

  // Targeted DOM update: remove the element
  const itemElement = listContainer.querySelector(`[data-item-id="${childId}"]`);
  if (itemElement) {
    itemElement.remove();
  }

  // Update data-index attributes
  listContainer.querySelectorAll('.sortable-list-item').forEach((el, i) => {
    el.setAttribute('data-index', i);
  });

  // Show empty state if no children left
  if (children.length === 0) {
    listContainer.innerHTML = '';
    const empty = api.createElement('div', {
      style: 'text-align: center; color: #999; padding: 60px 20px; font-style: italic;'
    }, ['This list is empty. Click "+ Add Item" to add items.']);
    listContainer.appendChild(empty);
  }
}
```

**Deliverable**: Item removal with targeted DOM updates, no full re-render.

---

## Phase 5: Testing & Edge Cases

### Test Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Empty list | Shows empty state message |
| Add single item | Item appears at end |
| Add multiple items | All appear in order |
| Drag item up | Order updates, DOM moves element |
| Drag item down | Order updates, DOM moves element |
| Remove item | Item removed from DOM, others stay |
| Remove last item | Shows empty state |
| Item already in list | Picker shows alert, doesn't add |
| Switch to spatial view | Items get default positions |
| Switch back to list view | Order preserved |
| Deleted child item | Skipped gracefully |

### Edge Cases Handled

1. **Mixed child format**: Normalized on read
2. **Switching views**: Array order preserved, spatial properties ignored
3. **Deleted items**: Checked with `api.get()` before rendering
4. **Self-reference**: Parent ID excluded from picker
5. **Circular references**: Protected by kernel's cycle detection

---

## Implementation Checklist

### Phase 1: Basic Display
- [x] Create `sortable_list_view` item
- [x] Implement header with title and add button
- [x] Implement empty state
- [x] Implement list item rendering with compact cards
- [x] Add drag handle (visual)
- [x] Add remove button

### Phase 2: Item Picker
- [x] Implement modal overlay
- [x] Integrate `item-search-lib.createSearchUI()`
- [x] Filter out existing children
- [x] Implement targeted add with DOM update

### Phase 3: Drag-and-Drop
- [x] Implement drag start from handle
- [x] Implement drag move with indicator
- [x] Implement drop with targeted DOM move
- [x] Update data-index attributes

### Phase 4: Polish
- [x] Test all interactions
- [x] Handle empty state transitions
- [x] Verify context menu works (data-item-id, data-parent-id)
- [ ] Resolve "Display As..." behavior in list view (deferred - needs design thought)

---

## Success Criteria

1. Users can view any item's children as a sortable list
2. Users can add existing items via picker (reusing item-search-lib)
3. Users can drag-and-drop to reorder items
4. Users can remove items from list
5. All operations use targeted DOM updates (no full re-render)
6. Order persists across sessions
7. View switching works correctly
8. Context menu works on list items

---

## API Methods Used

- `api.createElement(tag, props, children)` - Create DOM elements
- `api.renderItem(itemId, viewId)` - Render child items
- `api.get(itemId)` - Fetch item data
- `api.set(item)` - Save item
- `api.query(filter)` - Query for items
- `api.require(name)` - Load library (item-search-lib)

---

## Future Enhancements

1. **Keyboard shortcuts**: Cmd/Ctrl+Arrow to reorder selected item
2. **Multi-select**: Shift+click to select range
3. **Inline create**: Add new item directly without picker
4. **Numbered list variant**: Shows position numbers
5. **Checklist variant**: Adds checkbox to each item
