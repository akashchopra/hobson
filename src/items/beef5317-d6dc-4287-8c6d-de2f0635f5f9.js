// Item: field-editor-number
// ID: beef5317-d6dc-4287-8c6d-de2f0635f5f9
// Type: 66666666-0000-0000-0000-000000000000


export function render(value, onChange, api, options = {}) {
  const props = {
    type: 'number',
    value: value ?? '',
    style: 'width: 100%; padding: 8px; border: 1px solid var(--color-border); border-radius: var(--border-radius); font-size: 14px;' +
           (options.readonly ? ' background: var(--color-bg-body);' : ''),
    oninput: (e) => {
      const val = e.target.value === '' ? null : Number(e.target.value);
      onChange(val);
    }
  };

  if (options.min !== undefined) props.min = options.min;
  if (options.max !== undefined) props.max = options.max;
  if (options.step !== undefined) props.step = options.step;
  if (options.readonly) props.readonly = true;

  return api.createElement('input', props);
}
