// Item: field-view-text
// ID: c116c28d-0903-4fc7-8534-e1c4f245f55d
// Type: cccccccc-0000-0000-0000-000000000000


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
    const input = api.createElement('input', { type: 'text', style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;' });
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
