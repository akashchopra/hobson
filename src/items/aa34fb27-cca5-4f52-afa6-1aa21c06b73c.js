export async function render(value, options, api) {
  const { label } = options;

  const wrapper = api.createElement('div', { className: 'field-bootloader-source' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: var(--color-text);';
    wrapper.appendChild(labelEl);
  }

  const pre = api.createElement('pre');
  pre.style.cssText = 'margin: 0; padding: 16px; background: var(--color-bg-body); border: 1px solid var(--color-border-light); border-radius: var(--border-radius); overflow: auto; font-family: monospace; font-size: 13px; line-height: 1.4; white-space: pre; max-height: 600px;';
  pre.textContent = window.BOOTLOADER_SOURCE || '(Bootloader source not available)';
  wrapper.appendChild(pre);

  return wrapper;
}