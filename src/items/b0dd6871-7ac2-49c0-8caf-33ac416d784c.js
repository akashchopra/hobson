// Item: field-view-item-ref
// ID: b0dd6871-7ac2-49c0-8caf-33ac416d784c
// Type: cccccccc-0000-0000-0000-000000000000


export async function render(value, options, api) {
  const { mode, onChange, label } = options;
  const wrapper = api.createElement('div', { class: 'field-item-ref' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  const itemId = value || '';
  const isEditable = mode === 'editable' && onChange;

  // Helper to navigate to item
  const navigateToItem = async (id) => {
    try {
      if (api.siblingContainer) {
        await api.siblingContainer.addSibling(id);
      } else {
        await api.navigate(id);
      }
    } catch (err) {
      console.error('item_ref navigation error:', err);
    }
  };

  // Helper to show item picker modal
  const showItemPicker = async () => {
    const searchLib = await api.require('item-search-lib');

    const overlay = api.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';

    const modal = api.createElement('div');
    modal.style.cssText = 'background: white; border-radius: 8px; width: 90%; max-width: 500px; max-height: 70vh; display: flex; flex-direction: column; box-shadow: 0 4px 20px rgba(0,0,0,0.3);';

    const header = api.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #ddd;';
    
    const title = api.createElement('h3');
    title.style.cssText = 'margin: 0; font-size: 16px;';
    title.textContent = 'Select Item';
    header.appendChild(title);

    const closeBtn = api.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText = 'background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 0 4px;';
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const searchContainer = api.createElement('div');
    searchContainer.style.cssText = 'padding: 16px; flex: 1; overflow: auto;';
    modal.appendChild(searchContainer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };
    modal.onclick = (e) => e.stopPropagation();

    // Close on Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Create search UI
    searchLib.createSearchUI(
      searchContainer,
      (selectedItem) => {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
        onChange(selectedItem.id);
      },
      api,
      { placeholder: 'Search for items...', autoFocus: true }
    );
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
    pickerBtn.style.cssText = 'flex: 1; padding: 8px 12px; text-align: left; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px;';
    
    const nameSpan = api.createElement('span');
    nameSpan.style.cssText = 'flex: 1;';
    nameSpan.textContent = currentName;
    pickerBtn.appendChild(nameSpan);

    const chevron = api.createElement('span');
    chevron.textContent = '\u25BC';
    chevron.style.cssText = 'font-size: 10px; color: #666;';
    pickerBtn.appendChild(chevron);

    pickerBtn.onclick = showItemPicker;
    row.appendChild(pickerBtn);

    // Navigate button (if item exists)
    if (itemExists) {
      const navBtn = api.createElement('button');
      navBtn.textContent = '\u2192';
      navBtn.title = 'Go to item';
      navBtn.style.cssText = 'padding: 8px 12px; background: #e9ecef; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 14px;';
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
      clearBtn.style.cssText = 'padding: 8px 12px; background: #e9ecef; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 14px; color: #666;';
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
      link.style.cssText = 'color: #007bff; text-decoration: none; cursor: pointer; padding: 8px; background: #f5f5f5; border-radius: 4px; display: inline-block;';
      link.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await navigateToItem(itemId);
      };
      wrapper.appendChild(link);
    } else if (itemId) {
      const span = api.createElement('span');
      span.textContent = currentName;
      span.style.cssText = 'padding: 8px; background: #fff3cd; border-radius: 4px; font-size: 14px; color: #856404;';
      wrapper.appendChild(span);
    } else {
      const span = api.createElement('span');
      span.textContent = '(none)';
      span.style.cssText = 'padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 14px; color: #999;';
      wrapper.appendChild(span);
    }
  }

  return wrapper;
}
