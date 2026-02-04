
export function render(value, onChange, api, options = {}) {
  const select = document.createElement('select');
  select.style.cssText = 'width: 100%; padding: 8px; border: 1px solid var(--color-border); border-radius: var(--border-radius); font-size: 14px; background: var(--color-bg-surface);';

  if (options.readonly) {
    select.disabled = true;
    select.style.background = 'var(--color-bg-body)';
  }

  // options.choices should be [{value, label}] or ['value1', 'value2']
  const choices = options.choices || [];

  for (const choice of choices) {
    const opt = document.createElement('option');
    if (typeof choice === 'object') {
      opt.value = choice.value;
      opt.textContent = choice.label || choice.value;
    } else {
      opt.value = choice;
      opt.textContent = choice;
    }
    if (opt.value === value) {
      opt.selected = true;
    }
    select.appendChild(opt);
  }

  select.addEventListener('change', (e) => {
    onChange(e.target.value);
  });

  return select;
}
