// Item: field-view-json
// ID: 4a9ad08c-1dc6-4afb-9d3c-fefeaf1c13ea
// Type: cccccccc-0000-0000-0000-000000000000


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
    const textarea = api.createElement('textarea', { style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; font-family: monospace; resize: vertical; min-height: 100px;' });
    textarea.value = jsonStr;
    const errorEl = api.createElement('div');
    errorEl.style.cssText = 'color: #dc3545; font-size: 12px; min-height: 16px;';
    textarea.oninput = (e) => {
      try {
        onChange(JSON.parse(e.target.value));
        errorEl.textContent = '';
        textarea.style.borderColor = '#ccc';
      } catch (err) {
        errorEl.textContent = 'Invalid JSON';
        textarea.style.borderColor = '#dc3545';
      }
    };
    wrapper.appendChild(textarea);
    wrapper.appendChild(errorEl);
  } else {
    const pre = api.createElement('pre');
    pre.textContent = jsonStr;
    pre.style.cssText = 'padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 13px; font-family: monospace; white-space: pre-wrap; margin: 0;';
    wrapper.appendChild(pre);
  }
  return wrapper;
}
