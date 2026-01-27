// Item: field_view_number
// ID: da0b96ad-5a69-4d38-952d-6ff76b851023
// Type: cccccccc-0000-0000-0000-000000000000


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
    const input = api.createElement('input', { type: 'number', style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; width: 150px;' });
    input.value = value ?? '';
    input.placeholder = placeholder || '';
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (step !== undefined) input.step = step;
    input.oninput = (e) => onChange(e.target.value === '' ? null : Number(e.target.value));
    wrapper.appendChild(input);
  } else {
    const span = api.createElement('span');
    span.textContent = value ?? '';
    span.style.cssText = 'padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 14px;';
    wrapper.appendChild(span);
  }
  return wrapper;
}
