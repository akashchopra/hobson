// Widget Slider View - renders a range slider that writes to page state

// [BEGIN:render]
export async function render(item, api) {
  const label = item.content?.label || 'Slider';
  const min = item.content?.min ?? 0;
  const max = item.content?.max ?? 100;
  const step = item.content?.step ?? 1;
  const stateKey = item.content?.stateKey;
  const defaultValue = item.content?.defaultValue ?? min;

  const pageContext = api.pageContext || { getState(){}, setState(){}, onStateChange(){ return ()=>{}; } };

  // Initialize state with default if stateKey provided
  if (stateKey && pageContext.getState(stateKey) === undefined) {
    pageContext.setState(stateKey, defaultValue);
  }

  const wrapper = api.createElement('div', {
    style: 'display: flex; align-items: center; gap: 12px; padding: 4px 0;'
  });

  // Label
  const labelEl = api.createElement('label', {
    style: 'font-size: 13px; color: var(--color-text-secondary); min-width: 100px;'
  });
  labelEl.textContent = label;

  // Range input
  const input = api.createElement('input', {
    type: 'range',
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(pageContext.getState(stateKey) ?? defaultValue),
    style: 'flex: 1; cursor: pointer;'
  });

  // Numeric display
  const display = api.createElement('span', {
    style: 'font-size: 13px; color: var(--color-text); min-width: 50px; text-align: right; font-variant-numeric: tabular-nums;'
  });
  display.textContent = input.value;

  input.addEventListener('input', () => {
    const val = Number(input.value);
    display.textContent = input.value;
    if (stateKey) pageContext.setState(stateKey, val);
  });

  // Listen for external state changes
  if (stateKey) {
    pageContext.onStateChange(stateKey, (val) => {
      input.value = String(val);
      display.textContent = String(val);
    });
  }

  wrapper.appendChild(labelEl);
  wrapper.appendChild(input);
  wrapper.appendChild(display);
  return wrapper;
}
// [END:render]
