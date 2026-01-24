// Phase 3: Create Core Field Views
// Run this in the Hobson REPL after Phase 2

(async function() {
  const IDS = api.IDS;
  const FIELD_VIEW_TYPE = "cccccccc-0000-0000-0000-000000000000";

  console.log("Phase 3: Creating core field views...");

  // 1. field_view_text - Single-line text input
  const fieldViewText = {
    id: crypto.randomUUID(),
    name: "field_view_text",
    type: FIELD_VIEW_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Simple text field supporting readonly and editable modes",
      code: `
export function render(value, options, api) {
  const { mode, onChange, label, placeholder } = options;

  const wrapper = api.createElement('div', { className: 'field-text' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  if (mode === 'editable' && onChange) {
    const input = api.createElement('input', {
      type: 'text',
      style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;'
    });
    input.value = value || '';
    input.placeholder = placeholder || '';
    input.oninput = (e) => onChange(e.target.value);
    wrapper.appendChild(input);
  } else {
    const span = api.createElement('span');
    span.textContent = value || '';
    span.style.cssText = 'padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 14px;';
    wrapper.appendChild(span);
  }

  return wrapper;
}
`
    }
  };

  // 2. field_view_textarea - Multi-line text
  const fieldViewTextarea = {
    id: crypto.randomUUID(),
    name: "field_view_textarea",
    type: FIELD_VIEW_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Multi-line text field supporting readonly and editable modes",
      code: `
export function render(value, options, api) {
  const { mode, onChange, label, placeholder, rows = 5 } = options;

  const wrapper = api.createElement('div', { className: 'field-textarea' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  if (mode === 'editable' && onChange) {
    const textarea = api.createElement('textarea', {
      style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; font-family: inherit; resize: vertical;',
      rows: rows
    });
    textarea.value = value || '';
    textarea.placeholder = placeholder || '';
    textarea.oninput = (e) => onChange(e.target.value);
    wrapper.appendChild(textarea);
  } else {
    const pre = api.createElement('pre');
    pre.textContent = value || '';
    pre.style.cssText = 'padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 14px; white-space: pre-wrap; margin: 0; font-family: inherit;';
    wrapper.appendChild(pre);
  }

  return wrapper;
}
`
    }
  };

  // 3. field_view_number - Numeric input with validation
  const fieldViewNumber = {
    id: crypto.randomUUID(),
    name: "field_view_number",
    type: FIELD_VIEW_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Numeric field supporting readonly and editable modes with validation",
      code: `
export function render(value, options, api) {
  const { mode, onChange, label, placeholder, min, max, step } = options;

  const wrapper = api.createElement('div', { className: 'field-number' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  if (mode === 'editable' && onChange) {
    const input = api.createElement('input', {
      type: 'number',
      style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; width: 150px;'
    });
    input.value = value ?? '';
    input.placeholder = placeholder || '';
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (step !== undefined) input.step = step;
    input.oninput = (e) => {
      const numVal = e.target.value === '' ? null : Number(e.target.value);
      onChange(numVal);
    };
    wrapper.appendChild(input);
  } else {
    const span = api.createElement('span');
    span.textContent = value ?? '';
    span.style.cssText = 'padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 14px;';
    wrapper.appendChild(span);
  }

  return wrapper;
}
`
    }
  };

  // 4. field_view_checkbox - Boolean values
  const fieldViewCheckbox = {
    id: crypto.randomUUID(),
    name: "field_view_checkbox",
    type: FIELD_VIEW_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Checkbox field for boolean values",
      code: `
export function render(value, options, api) {
  const { mode, onChange, label } = options;

  const wrapper = api.createElement('div', { className: 'field-checkbox' });
  wrapper.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  if (mode === 'editable' && onChange) {
    const input = api.createElement('input', {
      type: 'checkbox',
      style: 'width: 18px; height: 18px; cursor: pointer;'
    });
    input.checked = !!value;
    input.onchange = (e) => onChange(e.target.checked);
    wrapper.appendChild(input);
  } else {
    const indicator = api.createElement('span');
    indicator.textContent = value ? '\\u2713' : '\\u2717';
    indicator.style.cssText = 'font-size: 18px; color: ' + (value ? '#28a745' : '#dc3545') + ';';
    wrapper.appendChild(indicator);
  }

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  return wrapper;
}
`
    }
  };

  // 5. field_view_timestamp - Date/time display
  const fieldViewTimestamp = {
    id: crypto.randomUUID(),
    name: "field_view_timestamp",
    type: FIELD_VIEW_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Timestamp field for date/time values (readonly by default)",
      code: `
export function render(value, options, api) {
  const { mode, onChange, label, format = 'full' } = options;

  const wrapper = api.createElement('div', { className: 'field-timestamp' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  // Format timestamp for display
  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    if (format === 'date') {
      return date.toLocaleDateString();
    } else if (format === 'time') {
      return date.toLocaleTimeString();
    } else if (format === 'relative') {
      const now = Date.now();
      const diff = now - ts;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      if (days > 0) return days + ' day' + (days > 1 ? 's' : '') + ' ago';
      if (hours > 0) return hours + ' hour' + (hours > 1 ? 's' : '') + ' ago';
      if (minutes > 0) return minutes + ' minute' + (minutes > 1 ? 's' : '') + ' ago';
      return 'just now';
    }
    return date.toLocaleString();
  };

  if (mode === 'editable' && onChange) {
    const input = api.createElement('input', {
      type: 'datetime-local',
      style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;'
    });
    if (value) {
      // Convert timestamp to datetime-local format
      const date = new Date(value);
      input.value = date.toISOString().slice(0, 16);
    }
    input.onchange = (e) => {
      const newTs = e.target.value ? new Date(e.target.value).getTime() : null;
      onChange(newTs);
    };
    wrapper.appendChild(input);
  } else {
    const span = api.createElement('span');
    span.textContent = formatTimestamp(value);
    span.style.cssText = 'padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 14px; color: #666;';
    wrapper.appendChild(span);
  }

  return wrapper;
}
`
    }
  };

  // 6. field_view_json - Fallback for unknown types
  const fieldViewJson = {
    id: crypto.randomUUID(),
    name: "field_view_json",
    type: FIELD_VIEW_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Fallback field view that displays/edits values as JSON",
      code: `
export function render(value, options, api) {
  const { mode, onChange, label } = options;

  const wrapper = api.createElement('div', { className: 'field-json' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  const jsonStr = JSON.stringify(value, null, 2);

  if (mode === 'editable' && onChange) {
    const textarea = api.createElement('textarea', {
      style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; font-family: monospace; resize: vertical; min-height: 100px;'
    });
    textarea.value = jsonStr;

    const errorEl = api.createElement('div');
    errorEl.style.cssText = 'color: #dc3545; font-size: 12px; min-height: 16px;';

    textarea.oninput = (e) => {
      try {
        const parsed = JSON.parse(e.target.value);
        onChange(parsed);
        errorEl.textContent = '';
        textarea.style.borderColor = '#ccc';
      } catch (err) {
        errorEl.textContent = 'Invalid JSON: ' + err.message;
        textarea.style.borderColor = '#dc3545';
      }
    };
    wrapper.appendChild(textarea);
    wrapper.appendChild(errorEl);
  } else {
    const pre = api.createElement('pre');
    pre.textContent = jsonStr;
    pre.style.cssText = 'padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 13px; font-family: monospace; white-space: pre-wrap; margin: 0; overflow: auto; max-height: 300px;';
    wrapper.appendChild(pre);
  }

  return wrapper;
}
`
    }
  };

  // 7. field_view_select - Dropdown selection
  const fieldViewSelect = {
    id: crypto.randomUUID(),
    name: "field_view_select",
    type: FIELD_VIEW_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Dropdown select field for choosing from predefined options",
      code: `
export function render(value, options, api) {
  const { mode, onChange, label, choices = [] } = options;

  const wrapper = api.createElement('div', { className: 'field-select' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  if (mode === 'editable' && onChange) {
    const select = api.createElement('select', {
      style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; background: white;'
    });

    // Add empty option
    const emptyOpt = api.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '-- Select --';
    select.appendChild(emptyOpt);

    // Add choices
    for (const choice of choices) {
      const opt = api.createElement('option');
      if (typeof choice === 'object') {
        opt.value = choice.value;
        opt.textContent = choice.label || choice.value;
      } else {
        opt.value = choice;
        opt.textContent = choice;
      }
      if (opt.value === value) opt.selected = true;
      select.appendChild(opt);
    }

    select.onchange = (e) => onChange(e.target.value || null);
    wrapper.appendChild(select);
  } else {
    const span = api.createElement('span');
    // Find label for value
    const choice = choices.find(c => (typeof c === 'object' ? c.value : c) === value);
    span.textContent = choice ? (typeof choice === 'object' ? choice.label : choice) : value || '';
    span.style.cssText = 'padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 14px;';
    wrapper.appendChild(span);
  }

  return wrapper;
}
`
    }
  };

  // Save all field views
  const fieldViews = [
    fieldViewText,
    fieldViewTextarea,
    fieldViewNumber,
    fieldViewCheckbox,
    fieldViewTimestamp,
    fieldViewJson,
    fieldViewSelect
  ];

  for (const fv of fieldViews) {
    console.log("Creating " + fv.name + "...");
    await api.set(fv);
  }

  console.log("\\nPhase 3 complete! Created " + fieldViews.length + " field views:");
  for (const fv of fieldViews) {
    console.log("  - " + fv.name + " (" + fv.id + ")");
  }

  return fieldViews;
})();
