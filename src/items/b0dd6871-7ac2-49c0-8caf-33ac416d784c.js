
export async function render(value, options, api) {
  const { mode, onChange, label } = options;
  const wrapper = api.createElement('div', { class: 'field-item-ref' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 0.875rem; color: var(--color-text);';
    wrapper.appendChild(labelEl);
  }

  const itemId = value || '';
  const isEditable = mode === 'editable' && onChange;

  // Reference to name display element (set later, used by showItemPicker)
  let nameSpan = null;

  // Helper to navigate to item
  const navigateToItem = async (id) => {
    try {
      await api.openItem(id);
    } catch (err) {
      console.error('item_ref navigation error:', err);
    }
  };

  // Helper to show item picker modal
  const showItemPicker = async () => {
    const searchLib = await api.require('item-search-lib');
    const modalLib = await api.require('modal-lib');

    const { close } = modalLib.showModal({
      title: 'Select Item',
      width: '500px',
      maxHeight: '70vh',
      api,
      content: ({ close: closeModal }) => {
        const searchContainer = api.createElement('div');
        searchContainer.style.cssText = 'min-height: 200px;';

        // Create search UI
        searchLib.createSearchUI(
          searchContainer,
          (selectedItem) => {
            closeModal();
            onChange(selectedItem.id);
            // Update display immediately
            if (nameSpan) {
              nameSpan.textContent = selectedItem.name || selectedItem.id;
            }
          },
          api,
          { placeholder: 'Search for items...', autoFocus: true }
        );

        return searchContainer;
      }
    });
  };

  // Get current item name
  let currentName = itemId ? itemId.slice(0, 8) + '...' : '(none)';
  let itemExists = false;
  if (itemId) {
    try {
      const refItem = await api.get(itemId);
      currentName = refItem.name || refItem.id;
      itemExists = true;
    } catch (e) {
      currentName = itemId.slice(0, 8) + '... (not found)';
    }
  }

  if (isEditable) {
    // Editable: show picker button with current value
    const row = api.createElement('div');
    row.style.cssText = 'display: flex; gap: 8px; align-items: center;';

    const pickerBtn = api.createElement('button');
    pickerBtn.style.cssText = 'flex: 1; padding: 8px 12px; text-align: left; background: var(--color-bg-surface-alt); border: 1px solid var(--color-border-light); border-radius: var(--border-radius); cursor: pointer; font-size: 0.875rem; display: flex; align-items: center; gap: 8px;';
    
    nameSpan = api.createElement('span');
    nameSpan.style.cssText = 'flex: 1;';
    nameSpan.textContent = currentName;
    pickerBtn.appendChild(nameSpan);

    const chevron = api.createElement('span');
    chevron.textContent = '\u25BC';
    chevron.style.cssText = 'font-size: 0.625rem; color: var(--color-text-secondary);';
    pickerBtn.appendChild(chevron);

    pickerBtn.onclick = showItemPicker;
    row.appendChild(pickerBtn);

    // Navigate button (if item exists)
    if (itemExists) {
      const navBtn = api.createElement('button');
      navBtn.textContent = '\u2192';
      navBtn.title = 'Go to item';
      navBtn.style.cssText = 'padding: 8px 12px; background: var(--color-bg-hover); border: 1px solid var(--color-border-light); border-radius: var(--border-radius); cursor: pointer; font-size: 0.875rem;';
      navBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await navigateToItem(itemId);
      };
      row.appendChild(navBtn);
    }

    // Clear button
    if (itemId) {
      const clearBtn = api.createElement('button');
      clearBtn.textContent = '\u00d7';
      clearBtn.title = 'Clear';
      clearBtn.style.cssText = 'padding: 8px 12px; background: var(--color-bg-hover); border: 1px solid var(--color-border-light); border-radius: var(--border-radius); cursor: pointer; font-size: 0.875rem; color: var(--color-text-secondary);';
      clearBtn.onclick = () => onChange('');
      row.appendChild(clearBtn);
    }

    wrapper.appendChild(row);
  } else {
    // Readonly: show clickable link with item name
    if (itemId && itemExists) {
      const link = api.createElement('a');
      link.textContent = currentName;
      link.href = '#';
      link.style.cssText = 'color: var(--color-primary); text-decoration: none; cursor: pointer; padding: 8px; background: var(--color-bg-body); border-radius: var(--border-radius); display: inline-block;';
      link.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await navigateToItem(itemId);
      };
      wrapper.appendChild(link);
    } else if (itemId) {
      const span = api.createElement('span');
      span.textContent = currentName;
      span.style.cssText = 'padding: 8px; background: var(--color-warning-light); border-radius: var(--border-radius); font-size: 0.875rem; color: var(--color-text);';
      wrapper.appendChild(span);
    } else {
      const span = api.createElement('span');
      span.textContent = '(none)';
      span.style.cssText = 'padding: 8px; background: var(--color-bg-body); border-radius: var(--border-radius); font-size: 0.875rem; color: var(--color-border-dark);';
      wrapper.appendChild(span);
    }
  }

  return wrapper;
}
