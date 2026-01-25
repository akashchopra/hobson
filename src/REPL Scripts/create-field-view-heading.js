// Create field_view_heading for titles and headings
(async function() {
  const FIELD_VIEW_TYPE = api.IDS.FIELD_VIEW;

  // Create field_view_heading
  const fieldViewHeading = {
    id: crypto.randomUUID(),
    name: "field_view_heading",
    type: FIELD_VIEW_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Heading field view for titles. Renders as h1-h6 based on level option.",
      code: `
export function render(value, options, api) {
  const { level = 1, mode, onChange } = options;

  // Clamp level to 1-6
  const headingLevel = Math.max(1, Math.min(6, level));
  const tag = 'h' + headingLevel;

  const wrapper = api.createElement('div', { className: 'field-heading' });
  wrapper.style.cssText = 'margin-bottom: 8px;';

  if (mode === 'editable' && onChange) {
    // Editable mode: use contenteditable or input styled as heading
    const input = api.createElement('input', {
      type: 'text',
      style: 'width: 100%; border: none; border-bottom: 2px solid #ddd; background: transparent; outline: none; font-weight: bold; padding: 4px 0;'
    });

    // Set font size based on level
    const sizes = { 1: '28px', 2: '24px', 3: '20px', 4: '18px', 5: '16px', 6: '14px' };
    input.style.fontSize = sizes[headingLevel];

    input.value = value || '';
    input.placeholder = 'Enter title...';
    input.oninput = (e) => onChange(e.target.value);
    wrapper.appendChild(input);
  } else {
    // Readonly mode: render as actual heading element
    const heading = api.createElement(tag);
    heading.textContent = value || '';
    heading.style.cssText = 'margin: 0; font-weight: bold;';
    wrapper.appendChild(heading);
  }

  return wrapper;
}
`
    }
  };

  await api.set(fieldViewHeading);
  console.log("Created field_view_heading:", fieldViewHeading.id);

  // Update note_view_readonly to use heading for name
  const noteViewReadonly = await api.helpers.findByName('note_view_readonly');
  if (noteViewReadonly) {
    noteViewReadonly.content.ui_hints.name = {
      field_view: "heading",
      mode: "readonly",
      level: 1
    };
    noteViewReadonly.modified = Date.now();
    await api.set(noteViewReadonly);
    console.log("Updated note_view_readonly to use heading for title");
  }

  // Also update note_view_editable to use heading for name
  const noteViewEditable = await api.helpers.findByName('note_view_editable');
  if (noteViewEditable) {
    noteViewEditable.content.ui_hints.name = {
      field_view: "heading",
      mode: "editable",
      level: 1
    };
    noteViewEditable.modified = Date.now();
    await api.set(noteViewEditable);
    console.log("Updated note_view_editable to use heading for title");
  }

  console.log("\nDone! Reload or clear module cache to see changes.");
  return fieldViewHeading.id;
})();
