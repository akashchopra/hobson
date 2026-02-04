
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
