// Phase 2: Create Generic View Library
// Run this in the Hobson REPL after Phase 1

(async function() {
  const IDS = api.IDS;

  console.log("Phase 2: Creating generic_view library...");

  const genericView = {
    id: crypto.randomUUID(),
    name: "generic_view",
    type: IDS.LIBRARY,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Interprets view-spec items and constructs appropriate UI by loading field views. Supports per-property mode control (readonly/editable) and save/cancel functionality.",
      code: `
// Helper: get nested value from object using dot-notation path
function getNestedValue(obj, path) {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}

// Helper: set nested value in object using dot-notation path
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((curr, key) => {
    if (!curr[key]) curr[key] = {};
    return curr[key];
  }, obj);
  target[lastKey] = value;
}

// Main render function
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
      // Fallback to JSON field view
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

    // Render field
    const fieldElement = fieldView.render(value, {
      mode: hint.mode || 'readonly',
      onChange,
      label: hint.label,
      placeholder: hint.placeholder,
      ...hint // Pass through any additional options
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
      // Reset to original values
      editedItem = JSON.parse(JSON.stringify(item));
      // Re-render (navigate to same item to refresh)
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

// Export helpers for potential reuse
export { getNestedValue, setNestedValue };
`
    }
  };

  await api.set(genericView);

  console.log("\\nPhase 2 complete! Created generic_view library:");
  console.log("  ID: " + genericView.id);
  console.log("\\nTest it with: const gv = await api.require('generic_view')");

  return genericView;
})();
