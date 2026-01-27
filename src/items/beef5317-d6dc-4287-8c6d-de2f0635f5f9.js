// Item: field-editor-number
// ID: beef5317-d6dc-4287-8c6d-de2f0635f5f9
// Type: 66666666-0000-0000-0000-000000000000


export function render(value, onChange, api, options = {}) {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = value ?? '';
  input.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;';

  if (options.min !== undefined) input.min = options.min;
  if (options.max !== undefined) input.max = options.max;
  if (options.step !== undefined) input.step = options.step;

  if (options.readonly) {
    input.readOnly = true;
    input.style.background = '#f5f5f5';
  }

  input.addEventListener('input', (e) => {
    const val = e.target.value === '' ? null : Number(e.target.value);
    onChange(val);
  });

  return input;
}
