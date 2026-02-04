// Item: field-editor-checkbox
// ID: a5e1fd60-8c4c-4cee-a0e0-f060aa75f739
// Type: 66666666-0000-0000-0000-000000000000


export function render(value, onChange, api, options = {}) {
  const wrapper = api.createElement('label', {
    style: 'display: flex; align-items: center; gap: 8px; cursor: pointer;'
  });

  const checkbox = api.createElement('input', {
    type: 'checkbox',
    checked: !!value,
    style: 'width: 18px; height: 18px; cursor: pointer;',
    onchange: (e) => onChange(e.target.checked)
  });

  if (options.readonly) {
    checkbox.disabled = true;
  }

  wrapper.appendChild(checkbox);

  if (options.label) {
    const labelText = api.createElement('span', {}, [options.label]);
    wrapper.appendChild(labelText);
  }

  return wrapper;
}
