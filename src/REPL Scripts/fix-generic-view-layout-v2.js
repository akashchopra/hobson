// Fix generic_view layout v2: sticky buttons, scrollable content, generous markdown height
(async function() {
  console.log("Fixing generic_view layout (v2)...\n");

  const genericView = await api.helpers.findByName('generic_view');
  if (!genericView) {
    console.error("generic_view not found!");
    return;
  }

  // Replace with improved layout version
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
  // Outer container - full height flex column
  const container = api.createElement('div', { className: 'generic-view' });
  container.style.cssText = 'display: flex; flex-direction: column; height: 100%; min-height: 0;';

  // Scrollable content area
  const scrollArea = api.createElement('div', { className: 'generic-view-content' });
  scrollArea.style.cssText = 'flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; min-height: 0;';

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

    // Give markdown fields a generous fixed height
    const isMarkdown = hint.field_view === 'markdown_editable' ||
                       hint.field_view === 'markdown_readonly';

    if (isMarkdown) {
      fieldElement.style.minHeight = '400px';
    }

    scrollArea.appendChild(fieldElement);

    // Add divider after field if requested
    if (hint.dividerAfter) {
      const divider = api.createElement('hr');
      divider.style.cssText = 'border: none; border-top: 2px solid #e0e0e0; margin: 8px 0; flex-shrink: 0;';
      scrollArea.appendChild(divider);
    }
  }

  container.appendChild(scrollArea);

  // Add save/cancel buttons if any field is editable (sticky at bottom)
  if (hasEditableFields) {
    const actions = api.createElement('div', { className: 'view-actions' });
    actions.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; padding: 16px; border-top: 1px solid #ddd; background: #f9f9f9; flex-shrink: 0;';

    const cancelBtn = api.createElement('button', {
      style: 'padding: 8px 16px; cursor: pointer;'
    });
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = async () => {
      // Try to restore previous view
      const restored = await api.restorePreviousView(item.id);
      if (!restored) {
        // No previous view, just re-render current root
        api.navigate(api.viewport.getRoot());
      }
    };
    actions.appendChild(cancelBtn);

    const saveBtn = api.createElement('button', {
      style: 'padding: 8px 16px; cursor: pointer; background: #6c757d; color: white; border: none; border-radius: 4px;'
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

    const saveAndViewBtn = api.createElement('button', {
      style: 'padding: 8px 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;'
    });
    saveAndViewBtn.textContent = 'Save & View';
    saveAndViewBtn.onclick = async () => {
      try {
        await api.update(editedItem);
        // Return to previous view (readonly)
        const restored = await api.restorePreviousView(item.id);
        if (!restored) {
          api.navigate(api.viewport.getRoot());
        }
      } catch (e) {
        alert('Save failed: ' + e.message);
      }
    };
    actions.appendChild(saveAndViewBtn);

    container.appendChild(actions);
  }

  return container;
}

export { getNestedValue, setNestedValue };
`;

  genericView.modified = Date.now();
  await api.set(genericView);

  console.log("Updated generic_view with simpler layout:");
  console.log("  - Buttons fixed at bottom");
  console.log("  - Content area scrollable");
  console.log("  - Markdown fields have generous 400px min-height");
  console.log("\nReload kernel to see changes.");
})();
