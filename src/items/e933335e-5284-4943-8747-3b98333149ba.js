// Item: field_view_textarea
// ID: e933335e-5284-4943-8747-3b98333149ba
// Type: cccccccc-0000-0000-0000-000000000000


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
    const textarea = api.createElement('textarea', { style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; font-family: inherit; resize: vertical;', rows: rows });
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
