// Widget Radio Group View - renders radio buttons for single-selection from static options

// [BEGIN:render]
export async function render(item, api) {
  const container = api.createElement('div');

  const labelText = item.content?.label;
  if (labelText) {
    const labelEl = api.createElement('div', {
      style: 'font-weight: 600; margin-bottom: 8px; font-size: 13px; color: var(--color-text-secondary, #aaa);'
    });
    labelEl.textContent = labelText;
    container.appendChild(labelEl);
  }

  const options = item.content?.options || [];
  const defaultValue = item.content?.defaultValue;
  const stateKey = item.content?.stateKey;
  const groupName = 'radio-' + item.id;

  // Initialize state with default value
  if (defaultValue && stateKey && api.pageContext) {
    api.pageContext.setState(stateKey, defaultValue);
  }

  const horizontal = item.content?.layout === 'horizontal';
  const listEl = api.createElement('div', {
    style: `display: flex; flex-direction: ${horizontal ? 'row' : 'column'}; gap: ${horizontal ? '12px' : '2px'}; ${horizontal ? 'flex-wrap: wrap;' : ''}`
  });

  for (const opt of options) {
    const row = api.createElement('label', {
      style: 'display: flex; align-items: center; gap: 8px; padding: 4px 6px; cursor: pointer; font-size: 13px; border-radius: var(--border-radius, 4px);'
    });

    row.addEventListener('mouseenter', () => { row.style.background = 'var(--color-bg-hover, rgba(255,255,255,0.05))'; });
    row.addEventListener('mouseleave', () => { row.style.background = ''; });

    const radio = api.createElement('input', { type: 'radio', name: groupName, value: opt.value });
    radio.style.cursor = 'pointer';

    if (opt.value === defaultValue) {
      radio.checked = true;
    }

    radio.addEventListener('change', () => {
      if (radio.checked && stateKey && api.pageContext) {
        api.pageContext.setState(stateKey, opt.value);
      }
    });

    const labelSpan = api.createElement('span');
    labelSpan.textContent = opt.label || opt.value;

    row.appendChild(radio);
    row.appendChild(labelSpan);
    listEl.appendChild(row);
  }

  container.appendChild(listEl);

  if (options.length === 0) {
    const emptyEl = api.createElement('div', {
      style: 'color: var(--color-text-secondary, #888); font-size: 13px; font-style: italic;'
    });
    emptyEl.textContent = 'No options configured';
    container.appendChild(emptyEl);
  }

  return container;
}
// [END:render]
