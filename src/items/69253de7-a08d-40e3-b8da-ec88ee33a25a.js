// Item: system:sortable-list-view
// ID: 69253de7-a08d-40e3-b8da-ec88ee33a25a
// Type: aaaaaaaa-0000-0000-0000-000000000000

// Sortable List View - Phases 1-3: Display, Item Picker, Drag-and-Drop

const COMPACT_CARD_VIEW_ID = 'd4e5f6a7-b8c9-4d0e-a1b2-c3d4e5f6a7b8';

export async function render(item, api) {
  const container = api.createElement('div', {
    class: 'sortable-list-view',
    style: 'display: flex; flex-direction: column; height: 100%; background: var(--color-bg-surface-alt);'
  }, []);

  // List container (created first so header can reference it)
  const listContainer = api.createElement('div', {
    class: 'sortable-list-items',
    style: 'flex: 1; overflow-y: auto; padding: 16px;'
  }, []);

  // Header section
  const header = createHeader(item, api, listContainer);
  container.appendChild(header);
  container.appendChild(listContainer);

  // Initial render
  await renderChildren(listContainer, item, api);

  return container;
}

function createHeader(item, api, listContainer) {
  const header = api.createElement('div', {
    style: 'padding: 16px; border-bottom: 2px solid var(--color-border-light); background: var(--color-bg-surface);'
  }, []);

  const titleRow = api.createElement('div', {
    style: 'display: flex; justify-content: space-between; align-items: center;'
  }, []);

  const title = api.createElement('h2', {
    style: 'margin: 0; font-size: 20px;'
  }, [item.name || 'Untitled List']);

  //const addButton = api.createElement('button', {
  //  style: 'padding: 8px 16px; background: var(--color-primary); color: white; border: none; border-radius: var(--border-radius); cursor: pointer; font-size: 14px;',
  //  onclick: () => showItemPicker(item, api, listContainer)
  //}, ['+ Add Item']);
  //addButton.onmouseover = () => { addButton.style.background = 'var(--color-primary-hover)'; };
  //addButton.onmouseout = () => { addButton.style.background = 'var(--color-primary)'; };

  titleRow.appendChild(title);
  //titleRow.appendChild(addButton);
  header.appendChild(titleRow);

  return header;
}

async function renderChildren(listContainer, parentItem, api) {
  listContainer.innerHTML = '';
  const children = parentItem.children || [];

  if (children.length === 0) {
    const empty = api.createElement('div', {
      style: 'text-align: center; color: var(--color-border-dark); padding: 60px 20px; font-style: italic;'
    }, ['This list is empty. Click "+ Add Item" to add items.']);
    listContainer.appendChild(empty);
    return;
  }

  const compactViews = await api.query({ name: 'system:compact-card-view' });
  const defaultViewId = compactViews[0]?.id || COMPACT_CARD_VIEW_ID;

  for (let i = 0; i < children.length; i++) {
    const childSpec = children[i];
    const childId = typeof childSpec === 'string' ? childSpec : childSpec.id;
    const childViewId = typeof childSpec === 'string' ? defaultViewId : (childSpec.view?.type || defaultViewId);

    const childItem = await api.get(childId);
    if (!childItem) continue;

    const listItem = await createListItem(childId, i, childViewId, parentItem, api, listContainer);
    listContainer.appendChild(listItem);
  }

  // Setup drag-and-drop
  setupDragAndDrop(listContainer, parentItem, api);
}

async function createListItem(childId, index, viewId, parentItem, api, listContainer) {
  const listItem = api.createElement('div', {
    'data-item-id': childId,
    'data-parent-id': parentItem.id,
    'data-index': index,
    class: 'sortable-list-item',
    style: 'display: flex; align-items: stretch; background: var(--color-bg-surface); border: 1px solid var(--color-border-light); border-radius: var(--border-radius); margin-bottom: 8px; overflow: hidden;'
  }, []);

  const dragHandle = api.createElement('div', {
    class: 'drag-handle',
    style: 'width: 32px; background: var(--color-bg-body); border-right: 1px solid var(--color-border-light); display: flex; align-items: center; justify-content: center; cursor: grab; user-select: none; flex-shrink: 0; color: var(--color-border-dark);',
    title: 'Drag to reorder'
  }, ['\u2261']);
  dragHandle.onmouseover = () => { dragHandle.style.background = 'var(--color-bg-hover)'; };
  dragHandle.onmouseout = () => { dragHandle.style.background = 'var(--color-bg-body)'; };

  const contentArea = api.createElement('div', {
    style: 'flex: 1; padding: 12px; min-width: 0;'
  }, []);

  try {
    const childNode = await api.renderItem(childId, viewId);
    contentArea.appendChild(childNode);
  } catch (error) {
    const errorMsg = api.createElement('div', {
      style: 'color: var(--color-danger); font-style: italic;'
    }, ['Error rendering item']);
    contentArea.appendChild(errorMsg);
  }

  const actions = api.createElement('div', {
    style: 'width: 32px; border-left: 1px solid var(--color-border-light); display: flex; align-items: center; justify-content: center; flex-shrink: 0;'
  }, []);

  const removeButton = api.createElement('button', {
    style: 'background: none; border: none; color: var(--color-border-dark); cursor: pointer; font-size: 18px; padding: 4px;',
    onclick: async (e) => {
      e.stopPropagation();
      await removeItemFromList(parentItem, childId, api, listContainer);
    },
    title: 'Remove from list'
  }, ['\u00d7']);
  removeButton.onmouseover = () => { removeButton.style.color = 'var(--color-danger)'; };
  removeButton.onmouseout = () => { removeButton.style.color = 'var(--color-border-dark)'; };

  actions.appendChild(removeButton);
  listItem.appendChild(dragHandle);
  listItem.appendChild(contentArea);
  listItem.appendChild(actions);

  return listItem;
}

// Phase 2: Item Picker
async function showItemPicker(parentItem, api, listContainer) {
  const overlay = api.createElement('div', {
    style: 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;'
  }, []);

  const modal = api.createElement('div', {
    style: 'background: var(--color-bg-surface); border-radius: 8px; width: 90%; max-width: 600px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: var(--shadow-md);'
  }, []);

  const modalHeader = api.createElement('div', {
    style: 'display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid var(--color-border-light);'
  }, []);

  const modalTitle = api.createElement('h3', { style: 'margin: 0;' }, ['Add Item to List']);

  const closeBtn = api.createElement('button', {
    style: 'padding: 4px 10px; cursor: pointer; background: transparent; border: none; font-size: 24px; color: var(--color-text-secondary);',
    onclick: () => document.body.removeChild(overlay)
  }, ['\u00d7']);

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeBtn);
  modal.appendChild(modalHeader);

  const searchContainer = api.createElement('div', {
    style: 'padding: 20px; flex: 1; overflow: auto;'
  }, []);
  modal.appendChild(searchContainer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const searchLib = await api.require('item-search-lib');

  const existingIds = new Set(
    (parentItem.children || []).map(c => typeof c === 'string' ? c : c.id)
  );
  existingIds.add(parentItem.id);

  searchLib.createSearchUI(
    searchContainer,
    async (selectedItem) => {
      if (existingIds.has(selectedItem.id)) {
        alert('This item is already in the list.');
        return;
      }
      await addItemToList(parentItem, selectedItem.id, api, listContainer);
      document.body.removeChild(overlay);
    },
    api,
    { placeholder: 'Search for items to add...', autoFocus: true }
  );

  overlay.onclick = (e) => {
    if (e.target === overlay) document.body.removeChild(overlay);
  };
  modal.onclick = (e) => e.stopPropagation();
}

async function addItemToList(parentItem, itemId, api, listContainer) {
  const fresh = await api.get(parentItem.id);
  const children = (fresh.children || []).map(c => typeof c === 'string' ? { id: c } : c);
  children.push({ id: itemId });

  const updated = { ...fresh, children, modified: Date.now() };
  await api.set(updated);
  parentItem.children = updated.children;

  // Re-render list
  await renderChildren(listContainer, parentItem, api);
}

async function removeItemFromList(parentItem, childId, api, listContainer) {
  const fresh = await api.get(parentItem.id);
  const children = (fresh.children || []).filter(c => {
    const id = typeof c === 'string' ? c : c.id;
    return id !== childId;
  });

  const updated = { ...fresh, children, modified: Date.now() };
  await api.set(updated);
  parentItem.children = updated.children;

  const itemElement = listContainer.querySelector(`[data-item-id="${childId}"]`);
  if (itemElement) itemElement.remove();

  listContainer.querySelectorAll('.sortable-list-item').forEach((el, i) => {
    el.setAttribute('data-index', i);
  });

  if (children.length === 0) {
    listContainer.innerHTML = '';
    const empty = api.createElement('div', {
      style: 'text-align: center; color: var(--color-border-dark); padding: 60px 20px; font-style: italic;'
    }, ['This list is empty. Click "+ Add Item" to add items.']);
    listContainer.appendChild(empty);
  }
}

// Phase 3: Drag-and-Drop
function setupDragAndDrop(listContainer, parentItem, api) {
  let draggedItem = null;
  let draggedIndex = null;
  let dropIndicator = null;

  dropIndicator = api.createElement('div', {
    class: 'drop-indicator',
    style: 'height: 3px; background: var(--color-primary); margin: 4px 0; border-radius: 2px; display: none;'
  }, []);

  const items = listContainer.querySelectorAll('.sortable-list-item');

  items.forEach((item, index) => {
    const dragHandle = item.querySelector('.drag-handle');

    dragHandle.onmousedown = (e) => {
      e.preventDefault();
      draggedItem = item;
      draggedIndex = parseInt(item.getAttribute('data-index'), 10);

      item.style.opacity = '0.5';
      dragHandle.style.cursor = 'grabbing';

      item.parentNode.insertBefore(dropIndicator, item.nextSibling);

      document.onmousemove = handleDrag;
      document.onmouseup = endDrag;
    };
  });

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
    let newIndex = items.length;  // Position after last item

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === draggedItem) continue;
      const rect = item.getBoundingClientRect();
      if (mouseY < rect.top + rect.height / 2) {
        newIndex = i;
        break;
      }
    }

    // Adjust for the dragged item being removed before insertion
    if (newIndex > draggedIndex) newIndex--;

    if (newIndex !== draggedIndex) {
      await updateChildOrder(parentItem, draggedIndex, newIndex, api, listContainer);
    }

    draggedItem.style.opacity = '1';
    draggedItem.querySelector('.drag-handle').style.cursor = 'grab';
    dropIndicator.style.display = 'none';
    if (dropIndicator.parentNode) dropIndicator.parentNode.removeChild(dropIndicator);

    draggedItem = null;
    draggedIndex = null;
    document.onmousemove = null;
    document.onmouseup = null;
  }
}

async function updateChildOrder(parentItem, fromIndex, toIndex, api, listContainer) {
  const fresh = await api.get(parentItem.id);
  let children = (fresh.children || []).map(c => typeof c === 'string' ? { id: c } : c);

  const [movedItem] = children.splice(fromIndex, 1);
  children.splice(toIndex, 0, movedItem);

  const updated = { ...fresh, children, modified: Date.now() };
  await api.set(updated);
  parentItem.children = updated.children;

  // Move element in DOM
  const items = Array.from(listContainer.querySelectorAll('.sortable-list-item'));
  const movedElement = items[fromIndex];

  if (toIndex >= items.length - 1) {
    listContainer.appendChild(movedElement);
  } else {
    const targetElement = toIndex > fromIndex ? items[toIndex + 1] : items[toIndex];
    listContainer.insertBefore(movedElement, targetElement);
  }

  listContainer.querySelectorAll('.sortable-list-item').forEach((el, i) => {
    el.setAttribute('data-index', i);
  });
}
