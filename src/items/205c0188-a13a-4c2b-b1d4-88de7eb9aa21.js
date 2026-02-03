// Item: field-view-object
// ID: 205c0188-a13a-4c2b-b1d4-88de7eb9aa21
// Type: cccccccc-0000-0000-0000-000000000000


export async function render(value, options, api) {
  const { mode, onChange, label, indent = 0 } = options;
  const obj = value || {};
  const isEditable = mode === 'editable' && onChange;

  const wrapper = api.createElement('div', { class: 'field-object' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  if (label) {
    const labelEl = api.createElement('div');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 600; font-size: 14px; color: var(--color-text); margin-bottom: 4px;';
    wrapper.appendChild(labelEl);
  }

  const propsContainer = api.createElement('div');
  propsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px; padding-left: ' + (indent > 0 ? '16px' : '0') + '; border-left: ' + (indent > 0 ? '2px solid var(--color-border)' : 'none') + ';';

  // Helper to update a property
  const updateProp = (key, newValue) => {
    const updated = { ...obj, [key]: newValue };
    onChange(updated);
  };

  // Helper to delete a property
  const deleteProp = (key) => {
    const updated = { ...obj };
    delete updated[key];
    onChange(updated);
  };

  // Helper to rename a property
  const renameProp = (oldKey, newKey) => {
    if (oldKey === newKey || !newKey) return;
    const updated = {};
    for (const k of Object.keys(obj)) {
      if (k === oldKey) {
        updated[newKey] = obj[oldKey];
      } else {
        updated[k] = obj[k];
      }
    }
    onChange(updated);
  };

  // Render each property
  const keys = Object.keys(obj);
  for (const key of keys) {
    const val = obj[key];
    const propRow = api.createElement('div', { class: 'field-object-prop' });
    propRow.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

    // Property header with key name and delete button
    const propHeader = api.createElement('div');
    propHeader.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    if (isEditable) {
      // Editable key name
      const keyInput = api.createElement('input', { type: 'text' });
      keyInput.value = key;
      keyInput.style.cssText = 'font-weight: 500; font-size: 13px; color: var(--color-text-secondary); background: transparent; border: 1px solid transparent; border-radius: 3px; padding: 2px 4px; width: auto; min-width: 80px;';
      keyInput.onblur = () => renameProp(key, keyInput.value.trim());
      keyInput.onkeydown = (e) => { if (e.key === 'Enter') keyInput.blur(); };
      propHeader.appendChild(keyInput);

      // Delete button
      const deleteBtn = api.createElement('button');
      deleteBtn.textContent = '\u00d7';
      deleteBtn.style.cssText = 'background: none; border: none; color: var(--color-text-tertiary); cursor: pointer; font-size: 16px; padding: 0 4px; line-height: 1;';
      deleteBtn.onclick = () => deleteProp(key);
      deleteBtn.title = 'Remove property';
      propHeader.appendChild(deleteBtn);
    } else {
      const keyLabel = api.createElement('span');
      keyLabel.textContent = key;
      keyLabel.style.cssText = 'font-weight: 500; font-size: 13px; color: var(--color-text-secondary);';
      propHeader.appendChild(keyLabel);
    }

    propRow.appendChild(propHeader);

    // Render value based on type
    const valType = Array.isArray(val) ? 'array' : typeof val;
    let fieldEl;

    try {
      if (valType === 'string') {
        // Check if it looks like a GUID (item reference)
        const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (guidPattern.test(val)) {
          const fieldView = await api.require('field-view-item-ref');
          fieldEl = await fieldView.render(val, {
            mode,
            onChange: isEditable ? (v) => updateProp(key, v) : null
          }, api);
        } else if (val.length > 100 || val.includes('\n')) {
          // Use textarea for long strings or strings with newlines
          const fieldView = await api.require('field-view-textarea');
          fieldEl = await fieldView.render(val, {
            mode,
            onChange: isEditable ? (v) => updateProp(key, v) : null
          }, api);
        } else {
          const fieldView = await api.require('field-view-text');
          fieldEl = await fieldView.render(val, {
            mode,
            onChange: isEditable ? (v) => updateProp(key, v) : null
          }, api);
        }
      } else if (valType === 'number') {
        const fieldView = await api.require('field-view-number');
        fieldEl = await fieldView.render(val, {
          mode,
          onChange: isEditable ? (v) => updateProp(key, v) : null
        }, api);
      } else if (valType === 'boolean') {
        const fieldView = await api.require('field-view-checkbox');
        fieldEl = await fieldView.render(val, {
          mode,
          onChange: isEditable ? (v) => updateProp(key, v) : null
        }, api);
      } else if (valType === 'object' && val !== null) {
        // Recursively render nested objects
        fieldEl = await render(val, {
          mode,
          onChange: isEditable ? (v) => updateProp(key, v) : null,
          indent: indent + 1
        }, api);
      } else {
        // Arrays and other types: fall back to JSON
        const fieldView = await api.require('field-view-json');
        fieldEl = await fieldView.render(val, {
          mode,
          onChange: isEditable ? (v) => updateProp(key, v) : null
        }, api);
      }
    } catch (e) {
      // Fallback if field view not found
      fieldEl = api.createElement('span');
      fieldEl.textContent = JSON.stringify(val);
      fieldEl.style.cssText = 'font-family: monospace; font-size: 13px;';
    }

    propRow.appendChild(fieldEl);
    propsContainer.appendChild(propRow);
  }

  wrapper.appendChild(propsContainer);

  // Add property button (only in editable mode)
  if (isEditable) {
    const addRow = api.createElement('div');
    addRow.style.cssText = 'margin-top: 8px;';

    const addBtn = api.createElement('button');
    addBtn.textContent = '+ Add Property';
    addBtn.style.cssText = 'padding: 4px 12px; font-size: 12px; cursor: pointer; background: var(--color-bg-surface-alt); border: 1px solid var(--color-border-light); border-radius: var(--border-radius); color: var(--color-text-secondary);';
    addBtn.onclick = () => {
      // Generate unique key name
      let newKey = 'newProperty';
      let i = 1;
      while (obj.hasOwnProperty(newKey)) {
        newKey = 'newProperty' + i++;
      }
      onChange({ ...obj, [newKey]: '' });
    };
    addRow.appendChild(addBtn);
    wrapper.appendChild(addRow);
  }

  // Show empty state
  if (keys.length === 0 && !isEditable) {
    const emptyEl = api.createElement('div');
    emptyEl.textContent = '(empty object)';
    emptyEl.style.cssText = 'color: var(--color-text-tertiary); font-style: italic; font-size: 13px;';
    propsContainer.appendChild(emptyEl);
  }

  return wrapper;
}
