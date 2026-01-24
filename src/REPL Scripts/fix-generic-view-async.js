// Fix: Make generic_view await async field view render calls
// Run this in the Hobson REPL

(async function() {
  console.log("Fixing generic_view to await async field views...\n");

  const genericView = await api.helpers.findByName('generic_view');

  if (!genericView) {
    console.error("ERROR: generic_view not found. Run phase2-create-generic-view.js first.");
    return;
  }

  // Replace with fixed version that awaits render calls
  genericView.content.code = `
// Generic view library - interprets view-spec items
// Supports both sync and async field views

function getNestedValue(obj, path) {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((curr, key) => {
    if (!curr[key]) curr[key] = {};
    return curr[key];
  }, obj);
  target[lastKey] = value;
}

export async function render(item, viewSpec, api) {
  const form = api.createElement('div', { className: 'generic-view' });
  form.style.cssText = 'display: flex; flex-direction: column; gap: 16px; padding: 16px;';

  // Clone item for editing
  let editedItem = JSON.parse(JSON.stringify(item));

  // Track if any field is editable
  let hasEditableFields = false;

  // Get ui_hints from view spec
  const uiHints = viewSpec.content?.ui_hints || {};

  // Render each field according to ui_hints
  for (const [path, hint] of Object.entries(uiHints)) {
    if (hint.hidden) continue;

    // Get current value from item
    const value = getNestedValue(item, path);

    // Load field view
    const fieldViewName = 'field_view_' + (hint.field_view || 'json');
    let fieldView;

    try {
      fieldView = await api.require(fieldViewName);
    } catch (e) {
      console.warn('Field view not found: ' + fieldViewName + ', using field_view_json');
      try {
        fieldView = await api.require('field_view_json');
      } catch (e2) {
        // Ultimate fallback - create inline
        fieldView = {
          render: (val, opts, api) => {
            const span = api.createElement('span');
            span.textContent = JSON.stringify(val);
            return span;
          }
        };
      }
    }

    // Determine if this field is editable
    const isEditable = hint.mode === 'editable';
    if (isEditable) hasEditableFields = true;

    // Create onChange handler if editable
    const onChange = isEditable
      ? (newValue) => {
          setNestedValue(editedItem, path, newValue);
        }
      : null;

    // Render field - AWAIT in case it's async!
    const fieldElement = await fieldView.render(value, {
      mode: hint.mode || 'readonly',
      onChange,
      label: hint.label,
      placeholder: hint.placeholder,
      ...hint
    }, api);

    form.appendChild(fieldElement);
  }

  // Add save/cancel buttons if any field is editable
  if (hasEditableFields) {
    const actions = api.createElement('div', { className: 'view-actions' });
    actions.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ddd;';

    const cancelBtn = api.createElement('button', {
      style: 'padding: 8px 16px; cursor: pointer;'
    });
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
      // Reset to original values and re-render
      api.navigate(item.id);
    };
    actions.appendChild(cancelBtn);

    const saveBtn = api.createElement('button', {
      style: 'padding: 8px 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;'
    });
    saveBtn.textContent = 'Save';
    saveBtn.onclick = async () => {
      try {
        await api.update(editedItem);
        console.log('Saved successfully');
      } catch (e) {
        alert('Save failed: ' + e.message);
      }
    };
    actions.appendChild(saveBtn);

    form.appendChild(actions);
  }

  return form;
}

export { getNestedValue, setNestedValue };
`;

  genericView.modified = Date.now();
  await api.set(genericView);

  console.log("Fixed generic_view to await field view render calls.");
  console.log("\nReload kernel and try again.");

  return genericView;
})();
