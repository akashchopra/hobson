
export function render(value, options, api) {
  const { mode, onChange, label, placeholder } = options;
  const wrapper = api.createElement('div', { className: 'field-text' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 0.875rem; color: var(--color-text);';
    wrapper.appendChild(labelEl);
  }

  if (mode === 'editable' && onChange) {
    const input = api.createElement('input', { type: 'text', style: 'padding: 8px; border: 1px solid var(--color-border); border-radius: var(--border-radius); font-size: 0.875rem;' });
    input.value = value || '';
    input.placeholder = placeholder || '';
    input.oninput = (e) => onChange(e.target.value);
    wrapper.appendChild(input);
  } else {
    const span = api.createElement('span');
    span.textContent = value || '';
    span.style.cssText = 'padding: 8px; background: var(--color-bg-surface-alt); border-radius: var(--border-radius); font-size: 0.875rem;';
    wrapper.appendChild(span);
  }
  return wrapper;
}
