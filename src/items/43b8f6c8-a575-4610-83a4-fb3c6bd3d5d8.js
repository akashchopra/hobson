// Item: field-view-heading
// ID: 43b8f6c8-a575-4610-83a4-fb3c6bd3d5d8
// Type: cccccccc-0000-0000-0000-000000000000


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
      style: 'width: 100%; border: none; border-bottom: 2px solid var(--color-border-light); background: transparent; outline: none; font-weight: bold; padding: 4px 0;'
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
