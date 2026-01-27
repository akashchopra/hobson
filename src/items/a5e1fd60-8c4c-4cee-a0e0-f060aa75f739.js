// Item: field-editor-checkbox
// ID: a5e1fd60-8c4c-4cee-a0e0-f060aa75f739
// Type: 66666666-0000-0000-0000-000000000000


export function render(value, onChange, api, options = {}) {
  const wrapper = document.createElement('label');
  wrapper.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer;';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = !!value;
  checkbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';

  if (options.readonly) {
    checkbox.disabled = true;
  }

  checkbox.addEventListener('change', (e) => {
    onChange(e.target.checked);
  });

  wrapper.appendChild(checkbox);

  if (options.label) {
    const labelText = document.createElement('span');
    labelText.textContent = options.label;
    wrapper.appendChild(labelText);
  }

  return wrapper;
}
