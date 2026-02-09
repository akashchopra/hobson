// Sortable List View - Phases 1-3: Display, Item Picker, Drag-and-Drop

const INLINE_CARD_VIEW_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

export async function render(item, api) {
  const container = api.createElement('div', {
    class: 'sortable-list-view',
    style: 'display: flex; flex-direction: column; height: 100%; background: var(--color-bg-surface-alt);'
  }, []);

  // List container (created first so header can reference it)
  const listContainer = api.createElement('div', {
    class: 'sortable-list-items',
    style: 'flex: 1; overflow-y: auto; padding-left: 2px; padding-top: 4px; padding-bottom: 10px; padding-right: 2px;'
  }, []);

  // Header section
  //const header = createHeader(item, api, listContainer);
  //container.appendChild(header);
  container.appendChild(listContainer);

  // Initial render
  await renderChildren(listContainer, item, api);

  return container;
}

function createHeader(item, api, listContainer) {
  const header = api.createElement('div', {
    style: 'padding: 2px; border-bottom: 2px solid var(--color-border-light); background: var(--color-bg-surface);'
  }, []);

  const titleRow = api.createElement('div', {
    style: 'display: flex; justify-content: space-between; align-items: center;'
  }, []);

  const title = api.createElement('h2', {
    style: 'margin: 0; font-size: 20px;'
  }, [item.name || 'Untitled List']);

  titleRow.appendChild(title);
  header.appendChild(titleRow);

  return header;
}

async function renderChildren(listContainer, parentItem, api) {
  listContainer.innerHTML = '';
  const attachments = parentItem.attachments || [];

  if (attachments.length === 0) {
    const empty = api.createElement('div', {
      style: 'text-align: center; color: var(--color-border-dark); padding: 60px 20px; font-style: italic;'
    }, ['This list is empty. Click "+ Add Item" to add items.']);
    listContainer.appendChild(empty);
    return;
  }

  const inlineViews = await api.query({ name: 'inline-card-view' });
  const defaultViewId = inlineViews[0]?.id || INLINE_CARD_VIEW_ID;

  for (let i = 0; i < attachments.length; i++) {
    const childSpec = attachments[i];
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
    style: 'display: flex; align-items: center; margin-bottom: 4px;'
  }, []);

  const dragHandle = api.createElement('div', {
    class: 'drag-handle',
    style: 'width: 24px; display: flex; align-items: center; justify-content: center; cursor: grab; user-select: none; flex-shrink: 0; color: var(--color-border-dark);',
    title: 'Drag to reorder'
  }, ['\u2261']);
  dragHandle.onmouseover = () => { dragHandle.style.color = 'var(--color-text-secondary)'; };
  dragHandle.onmouseout = () => { dragHandle.style.color = 'var(--color-border-dark)'; };

  const contentArea = api.createElement('div', {
    style: 'flex: 1; padding: 2px 4px; min-width: 0;'
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
    style: 'width: 24px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;'
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
    (parentItem.attachments || []).map(c => typeof c === 'string' ? c : c.id)
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
  const attachments = (fresh.attachments || []).map(c => typeof c === 'string' ? { id: c } : c);
  attachments.push({ id: itemId });

  const updated = { ...fresh, attachments, modified: Date.now() };
  await api.set(updated);
  parentItem.attachments = updated.attachments;

  // Re-render list
  await renderChildren(listContainer, parentItem, api);
}

async function removeItemFromList(parentItem, childId, api, listContainer) {
  const fresh = await api.get(parentItem.id);
  const attachments = (fresh.attachments || []).filter(c => {
    const id = typeof c === 'string' ? c : c.id;
    return id !== childId;
  });

  const updated = { ...fresh, attachments, modified: Date.now() };
  await api.set(updated);
  parentItem.attachments = updated.attachments;

  const itemElement = listContainer.querySelector(`[data-item-id="${childId}"]`);
  if (itemElement) itemElement.remove();

  listContainer.querySelectorAll('.sortable-list-item').forEach((el, i) => {
    el.setAttribute('data-index', i);
  });

  if (attachments.length === 0) {
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
  let attachments = (fresh.attachments || []).map(c => typeof c === 'string' ? { id: c } : c);

  const [movedItem] = attachments.splice(fromIndex, 1);
  attachments.splice(toIndex, 0, movedItem);

  const updated = { ...fresh, attachments, modified: Date.now() };
  await api.set(updated);
  parentItem.attachments = updated.attachments;

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
