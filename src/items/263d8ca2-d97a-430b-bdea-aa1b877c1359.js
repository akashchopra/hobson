// Widget Checkbox Group View - renders checkboxes from a code-defined source

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

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

  const sourceCode = item.content?.source;
  const labelField = item.content?.labelField || 'name';
  const stateKey = item.content?.stateKey;

  let options = [];
  if (sourceCode) {
    try {
      const fn = new Function('api', `return (async () => { ${sourceCode} })()`);
      options = await fn(api) || [];
    } catch (err) {
      window.kernel?.captureError(err, { operation: 'widget-checkbox-group-source', itemId: item.id, itemName: item.name });
      const errEl = api.createElement('div', {
        style: 'color: var(--color-danger, #e74c3c); padding: 8px; border: 1px solid var(--color-danger, #e74c3c); border-radius: var(--border-radius, 4px); font-size: 13px;'
      });
      errEl.textContent = 'Failed to load options: ' + err.message;
      container.appendChild(errEl);
      return container;
    }
  }

  const selected = new Set();

  const listEl = api.createElement('div', {
    style: 'display: flex; flex-direction: column; gap: 2px;'
  });

  for (const opt of options) {
    const row = api.createElement('label', {
      style: 'display: flex; align-items: center; gap: 8px; padding: 4px 6px; cursor: pointer; font-size: 13px; border-radius: var(--border-radius, 4px);'
    });

    // Hover effect
    row.addEventListener('mouseenter', () => { row.style.background = 'var(--color-bg-hover, rgba(255,255,255,0.05))'; });
    row.addEventListener('mouseleave', () => { row.style.background = ''; });

    const checkbox = api.createElement('input', { type: 'checkbox' });
    checkbox.style.cursor = 'pointer';
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selected.add(opt.id);
      } else {
        selected.delete(opt.id);
      }
      if (stateKey && api.pageContext) {
        api.pageContext.setState(stateKey, Array.from(selected));
      }
    });

    const labelSpan = api.createElement('span');
    labelSpan.textContent = getNestedValue(opt, labelField) || opt.id;

    row.appendChild(checkbox);
    row.appendChild(labelSpan);
    listEl.appendChild(row);
  }

  container.appendChild(listEl);

  if (options.length === 0 && !sourceCode) {
    const emptyEl = api.createElement('div', {
      style: 'color: var(--color-text-secondary, #888); font-size: 13px; font-style: italic;'
    });
    emptyEl.textContent = 'No source configured';
    container.appendChild(emptyEl);
  }

  return container;
}
// [END:render]
