
export function render(value, options, api) {
  const { mode, onChange, label } = options;
  const wrapper = api.createElement('div', { className: 'field-json' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: var(--color-text);';
    wrapper.appendChild(labelEl);
  }

  const jsonStr = JSON.stringify(value, null, 2);

  if (mode === 'editable' && onChange) {
    const textarea = api.createElement('textarea', { style: 'padding: 8px; border: 1px solid var(--color-border); border-radius: var(--border-radius); font-size: 13px; font-family: monospace; resize: vertical; min-height: 100px;' });
    textarea.value = jsonStr;
    const errorEl = api.createElement('div');
    errorEl.style.cssText = 'color: var(--color-danger); font-size: 12px; min-height: 16px;';
    textarea.oninput = (e) => {
      try {
        onChange(JSON.parse(e.target.value));
        errorEl.textContent = '';
        textarea.style.borderColor = 'var(--color-border)';
      } catch (err) {
        errorEl.textContent = 'Invalid JSON';
        textarea.style.borderColor = 'var(--color-danger)';
      }
    };
    wrapper.appendChild(textarea);
    wrapper.appendChild(errorEl);
  } else {
    const pre = api.createElement('pre');
    pre.textContent = jsonStr;
    pre.style.cssText = 'padding: 8px; background: var(--color-bg-surface-alt); border-radius: var(--border-radius); font-size: 13px; font-family: monospace; white-space: pre-wrap; margin: 0;';
    wrapper.appendChild(pre);
  }
  return wrapper;
}
