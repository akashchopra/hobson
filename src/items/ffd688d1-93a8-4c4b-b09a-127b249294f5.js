// Item: generic-editor
// ID: ffd688d1-93a8-4c4b-b09a-127b249294f5
// Type: 66666666-0000-0000-0000-000000000000


// Helper: get nested value from object using path array
function getNestedValue(obj, path) {
  let current = obj;
  for (const key of path) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }
  return current;
}

// Helper: set nested value in object using path array
function setNestedValue(obj, path, value) {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (current[key] === undefined || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
  current[path[path.length - 1]] = value;
}

// Helper: recursively collect fields from ui_hints
function collectFields(hints, basePath = []) {
  const fields = [];
  for (const [key, value] of Object.entries(hints)) {
    const path = [...basePath, key];
    if (value.editor) {
      // This is a field hint
      fields.push({ path, hint: value });
    } else if (typeof value === 'object' && value !== null) {
      // Nested structure - recurse
      fields.push(...collectFields(value, path));
    }
  }
  return fields;
}

// Helper: collect all leaf fields from an object (for fields not in ui_hints)
function collectAllFields(obj, basePath = [], visited = new Set()) {
  const fields = [];
  if (obj === null || obj === undefined || typeof obj !== 'object') return fields;

  const objId = basePath.join('.');
  if (visited.has(objId)) return fields;
  visited.add(objId);

  for (const [key, value] of Object.entries(obj)) {
    const path = [...basePath, key];
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      // Leaf value or array - treat as field
      fields.push({ path, value });
    } else {
      // Nested object - recurse
      fields.push(...collectAllFields(value, path, visited));
    }
  }
  return fields;
}

export async function render(item, editor, api) {
  const uiHints = editor.content?.ui_hints || {};

  // Create a working copy of the item
  const workingCopy = JSON.parse(JSON.stringify(item));

  // Container
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 16px; min-width: 500px; max-width: 800px;';

  // Collect hinted fields
  const hintedFields = collectFields(uiHints);
  const hintedPaths = new Set(hintedFields.map(f => f.path.join('.')));

  // Collect all fields from item (excluding system fields)
  const systemFields = new Set(['id', 'type', 'created', 'modified', 'children']);
  const allItemFields = collectAllFields(workingCopy)
    .filter(f => !systemFields.has(f.path[0]));

  // Find unhinted fields
  const unhintedFields = allItemFields.filter(f => !hintedPaths.has(f.path.join('.')));

  // Render hinted fields first
  for (const { path, hint } of hintedFields) {
    if (hint.hidden) continue;

    const fieldContainer = document.createElement('div');
    fieldContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

    // Label
    const label = document.createElement('label');
    label.textContent = hint.label || path[path.length - 1];
    label.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    fieldContainer.appendChild(label);

    // Get current value
    const currentValue = getNestedValue(workingCopy, path);

    // Load field editor
    const editorType = hint.editor || 'text';
    let fieldWidget;

    try {
      const fieldEditorLib = await api.require('field-editor-' + editorType);
      fieldWidget = fieldEditorLib.render(
        currentValue,
        (newValue) => setNestedValue(workingCopy, path, newValue),
        api,
        {
          readonly: hint.readonly,
          placeholder: hint.placeholder,
          ...hint.options
        }
      );
    } catch (e) {
      // Fallback to text editor
      console.warn('Field editor not found: field_editor_' + editorType + ', using text');
      const textLib = await api.require('field-editor-text');
      fieldWidget = textLib.render(
        String(currentValue ?? ''),
        (newValue) => setNestedValue(workingCopy, path, newValue),
        api,
        { readonly: hint.readonly, placeholder: hint.placeholder }
      );
    }

    fieldContainer.appendChild(fieldWidget);
    container.appendChild(fieldContainer);
  }

  // Render unhinted fields with default text editor
  if (unhintedFields.length > 0) {
    const separator = document.createElement('hr');
    separator.style.cssText = 'border: none; border-top: 1px solid #ddd; margin: 8px 0;';
    container.appendChild(separator);

    const otherLabel = document.createElement('div');
    otherLabel.textContent = 'Other Fields';
    otherLabel.style.cssText = 'font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;';
    container.appendChild(otherLabel);

    for (const { path } of unhintedFields) {
      const fieldContainer = document.createElement('div');
      fieldContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

      const label = document.createElement('label');
      label.textContent = path.join('.');
      label.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
      fieldContainer.appendChild(label);

      const currentValue = getNestedValue(workingCopy, path);
      const textLib = await api.require('field-editor-text');
      const fieldWidget = textLib.render(
        String(currentValue ?? ''),
        (newValue) => setNestedValue(workingCopy, path, newValue),
        api,
        {}
      );

      fieldContainer.appendChild(fieldWidget);
      container.appendChild(fieldContainer);
    }
  }

  // Error area
  const errorArea = document.createElement('div');
  errorArea.style.cssText = 'color: #c00; font-size: 13px; min-height: 20px;';
  container.appendChild(errorArea);

  // Button row
  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'padding: 8px 16px; cursor: pointer;';
  cancelBtn.onclick = () => api.close();
  buttonRow.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;';
  saveBtn.onclick = async () => {
    try {
      await api.saveAndClose(workingCopy);
    } catch (e) {
      errorArea.textContent = 'Save failed: ' + e.message;
    }
  };
  buttonRow.appendChild(saveBtn);

  container.appendChild(buttonRow);

  return container;
}
