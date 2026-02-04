// Item: field-view-checkbox
// ID: 70b84e74-f079-4fa0-84c6-bb8d3ab31f61
// Type: cccccccc-0000-0000-0000-000000000000


export function render(value, options, api) {
  const { mode, onChange, label } = options;
  const wrapper = api.createElement('div', { className: 'field-checkbox' });
  wrapper.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  if (mode === 'editable' && onChange) {
    const input = api.createElement('input', { type: 'checkbox', style: 'width: 18px; height: 18px; cursor: pointer;' });
    input.checked = !!value;
    input.onchange = (e) => onChange(e.target.checked);
    wrapper.appendChild(input);
  } else {
    const indicator = api.createElement('span');
    indicator.textContent = value ? '\u2713' : '\u2717';
    indicator.style.cssText = 'font-size: 18px; color: ' + (value ? 'var(--color-success)' : 'var(--color-danger)') + ';';
    wrapper.appendChild(indicator);
  }

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 14px; color: var(--color-text);';
    wrapper.appendChild(labelEl);
  }
  return wrapper;
}
