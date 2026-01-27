// Item: field-editor-textarea
// ID: 8271c69e-ec45-485b-9233-89efd8b562ab
// Type: 66666666-0000-0000-0000-000000000000


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
