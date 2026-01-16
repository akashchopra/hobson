// REPL Script: Create generic_editor_renderer
// This renderer handles custom_editor type items, building forms from ui_hints

// First, find the custom_editor type
const types = await api.query({ type: api.IDS.EDITOR });
const customEditorType = types.find(t => t.name === "custom_editor");

if (!customEditorType) {
  console.error("custom_editor type not found! Run create_custom_editor_type.js first.");
  throw new Error("custom_editor type not found");
}

const genericEditorRendererCode = `
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

export async function render(editorItem, api) {
  // Get the editing context (the item being edited)
  const context = api.getEditingContext();
  if (!context) {
    return api.createElement('div', { style: 'color: red; padding: 20px;' },
      ['Error: No editing context. This renderer should only be used via editItem().']);
  }

  const { item, editorAPI } = context;
  const uiHints = editorItem.content?.ui_hints || {};

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
      const fieldEditorLib = await api.require('field_editor_' + editorType);
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
      const textLib = await api.require('field_editor_text');
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
      const textLib = await api.require('field_editor_text');
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
  cancelBtn.onclick = () => editorAPI.close();
  buttonRow.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;';
  saveBtn.onclick = async () => {
    try {
      await editorAPI.saveAndClose(workingCopy);
    } catch (e) {
      errorArea.textContent = 'Save failed: ' + e.message;
    }
  };
  buttonRow.appendChild(saveBtn);

  container.appendChild(buttonRow);

  return container;
}
`;

const genericEditorRenderer = {
  id: crypto.randomUUID(),
  name: "generic_editor_renderer",
  type: api.IDS.RENDERER,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    for_type: customEditorType.id,
    code: genericEditorRendererCode
  }
};

await kernel.storage.set(genericEditorRenderer, kernel);
console.log("Created generic_editor_renderer:", genericEditorRenderer.id);
console.log("  for_type:", customEditorType.id, "(custom_editor)");
console.log("");
console.log("This renderer handles custom_editor items, building forms from ui_hints.");
