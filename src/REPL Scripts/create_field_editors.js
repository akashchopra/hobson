// REPL Script: Create field editor libraries
// Field editors are libraries that render input widgets for specific field types

// ============================================================================
// field_editor_text - Simple single-line text input
// ============================================================================
const fieldEditorText = {
  id: crypto.randomUUID(),
  name: "field_editor_text",
  type: api.IDS.LIBRARY,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    code: `
export function render(value, onChange, api, options = {}) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  input.placeholder = options.placeholder || '';
  input.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;';

  if (options.readonly) {
    input.readOnly = true;
    input.style.background = '#f5f5f5';
  }

  input.addEventListener('input', (e) => {
    onChange(e.target.value);
  });

  return input;
}
`
  }
};

// ============================================================================
// field_editor_textarea - Multi-line text input
// ============================================================================
const fieldEditorTextarea = {
  id: crypto.randomUUID(),
  name: "field_editor_textarea",
  type: api.IDS.LIBRARY,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    code: `
export function render(value, onChange, api, options = {}) {
  const textarea = document.createElement('textarea');
  textarea.value = value || '';
  textarea.placeholder = options.placeholder || '';
  textarea.rows = options.rows || 4;
  textarea.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; font-family: inherit; resize: vertical;';

  if (options.readonly) {
    textarea.readOnly = true;
    textarea.style.background = '#f5f5f5';
  }

  textarea.addEventListener('input', (e) => {
    onChange(e.target.value);
  });

  return textarea;
}
`
  }
};

// ============================================================================
// field_editor_checkbox - Boolean checkbox
// ============================================================================
const fieldEditorCheckbox = {
  id: crypto.randomUUID(),
  name: "field_editor_checkbox",
  type: api.IDS.LIBRARY,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    code: `
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
`
  }
};

// ============================================================================
// field_editor_number - Number input
// ============================================================================
const fieldEditorNumber = {
  id: crypto.randomUUID(),
  name: "field_editor_number",
  type: api.IDS.LIBRARY,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    code: `
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
`
  }
};

// ============================================================================
// field_editor_select - Dropdown select
// ============================================================================
const fieldEditorSelect = {
  id: crypto.randomUUID(),
  name: "field_editor_select",
  type: api.IDS.LIBRARY,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    code: `
export function render(value, onChange, api, options = {}) {
  const select = document.createElement('select');
  select.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; background: white;';

  if (options.readonly) {
    select.disabled = true;
    select.style.background = '#f5f5f5';
  }

  // options.choices should be [{value, label}] or ['value1', 'value2']
  const choices = options.choices || [];

  for (const choice of choices) {
    const opt = document.createElement('option');
    if (typeof choice === 'object') {
      opt.value = choice.value;
      opt.textContent = choice.label || choice.value;
    } else {
      opt.value = choice;
      opt.textContent = choice;
    }
    if (opt.value === value) {
      opt.selected = true;
    }
    select.appendChild(opt);
  }

  select.addEventListener('change', (e) => {
    onChange(e.target.value);
  });

  return select;
}
`
  }
};

// Save all field editors
const editors = [
  fieldEditorText,
  fieldEditorTextarea,
  fieldEditorCheckbox,
  fieldEditorNumber,
  fieldEditorSelect
];

for (const editor of editors) {
  await kernel.storage.set(editor, kernel);
  console.log(`Created ${editor.name}: ${editor.id}`);
}

console.log("\nField editors created. Test with:");
console.log("  const lib = await api.require('field_editor_text');");
console.log("  const widget = lib.render('hello', (v) => console.log('changed:', v), api);");
console.log("  document.body.appendChild(widget);");
