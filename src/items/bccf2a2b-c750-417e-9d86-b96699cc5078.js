// Item: field-editor-itemref
// ID: bccf2a2b-c750-417e-9d86-b96699cc5078
// Type: 66666666-0000-0000-0000-000000000000


export function render(value, onChange, api, options = {}) {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; gap: 8px; align-items: center;';

  // Display area for current selection
  const displayArea = document.createElement('div');
  displayArea.style.cssText = 'flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; background: #f9f9f9; min-height: 36px; display: flex; align-items: center;';

  const updateDisplay = async () => {
    if (!value || value === '') {
      displayArea.textContent = '(no item selected)';
      displayArea.style.color = '#999';
      displayArea.style.fontStyle = 'italic';
    } else {
      displayArea.textContent = 'Loading...';
      displayArea.style.color = '#666';
      displayArea.style.fontStyle = 'italic';

      try {
        const item = await api.get(value);
        displayArea.textContent = item.name || item.content?.title || item.id.substring(0, 8) + '...';
        displayArea.style.color = '#333';
        displayArea.style.fontStyle = 'normal';
      } catch (e) {
        displayArea.textContent = '(invalid reference: ' + value.substring(0, 8) + '...)';
        displayArea.style.color = '#c00';
        displayArea.style.fontStyle = 'italic';
      }
    }
  };

  updateDisplay();
  container.appendChild(displayArea);

  if (!options.readonly) {
    // Select button
    const selectBtn = document.createElement('button');
    selectBtn.textContent = 'Select...';
    selectBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; font-size: 14px;';
    selectBtn.onclick = () => openModal();
    container.appendChild(selectBtn);

    // Clear button (only show if there's a value)
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '×';
    clearBtn.title = 'Clear selection';
    clearBtn.style.cssText = 'padding: 8px 12px; cursor: pointer; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 16px; font-weight: bold;';
    clearBtn.onclick = () => {
      onChange('');
      value = '';
      updateDisplay();
    };
    if (value && value !== '') {
      container.appendChild(clearBtn);
    }

    // Modal/overlay
    const openModal = async () => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
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
      `;

      const modalBox = document.createElement('div');
      modalBox.style.cssText = `
        background: white;
        padding: 24px;
        border-radius: 8px;
        width: 600px;
        max-height: 80vh;
        overflow: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      `;

      // Modal header
      const modalHeader = document.createElement('div');
      modalHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #e0e0e0;';

      const modalTitle = document.createElement('h3');
      modalTitle.textContent = options.modalTitle || 'Select Item';
      modalTitle.style.cssText = 'margin: 0; font-size: 18px;';
      modalHeader.appendChild(modalTitle);

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '×';
      closeBtn.style.cssText = 'padding: 4px 10px; cursor: pointer; background: transparent; border: none; font-size: 24px; color: #666; line-height: 1;';
      closeBtn.onclick = () => document.body.removeChild(overlay);
      modalHeader.appendChild(closeBtn);

      modalBox.appendChild(modalHeader);

      // Search UI container
      const searchContainer = document.createElement('div');
      modalBox.appendChild(searchContainer);

      overlay.appendChild(modalBox);
      document.body.appendChild(overlay);

      // Load search library and create search UI
      const searchLib = await api.require('item-search-lib');
      searchLib.createSearchUI(
        searchContainer,
        (selectedItem) => {
          onChange(selectedItem.id);
          value = selectedItem.id;
          updateDisplay();
          document.body.removeChild(overlay);
        },
        api,
        {
          placeholder: options.searchPlaceholder || 'Search for items...',
          targetContainer: options.targetContainer || null,
          autoFocus: true
        }
      );

      // Click backdrop to close
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
        }
      };

      // Stop propagation on modal box to prevent backdrop close
      modalBox.onclick = (e) => {
        e.stopPropagation();
      };

      // Escape key to close modal
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          document.body.removeChild(overlay);
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
    };
  }

  return container;
}
