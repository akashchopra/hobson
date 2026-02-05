
export function render(value, onChange, api, options = {}) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  input.placeholder = options.placeholder || '';
  input.style.cssText = 'width: 100%; padding: 8px; border: 1px solid var(--color-border); border-radius: var(--border-radius); font-size: 14px;';

  if (options.readonly) {
    input.readOnly = true;
    input.style.background = 'var(--color-bg-body)';
  }

  input.addEventListener('input', (e) => {
    onChange(e.target.value);
  });

  return input;
}
