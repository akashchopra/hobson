// Item: field-editor-select
// ID: c28eeb82-aac7-4bea-9d7b-7d17c1fd73e7
// Type: 66666666-0000-0000-0000-000000000000


export function render(value, onChange, api, options = {}) {
  const select = document.createElement('select');
  select.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; background: white;';

  if (options.readonly) {
    select.disabled = true;
    select.style.background = '#f5f5f5';
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
