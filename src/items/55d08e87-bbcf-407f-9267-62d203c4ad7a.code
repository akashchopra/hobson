// Widget Button View - renders a button that executes inline code on click

// [BEGIN:render]
export async function render(item, api) {
  const label = item.content?.label || 'Button';
  const variant = item.content?.variant || 'secondary';

  // Variant-specific styles
  const variantStyles = {
    primary: `
      background: var(--color-accent, #4a9eff);
      color: #fff;
      border-color: var(--color-accent, #4a9eff);
    `,
    secondary: `
      background: var(--color-bg-surface, #2a2a2a);
      color: var(--color-text, #e0e0e0);
      border-color: var(--color-border, #555);
    `,
    danger: `
      background: #c0392b;
      color: #fff;
      border-color: #c0392b;
    `
  };

  const baseStyle = `
    padding: 8px 20px;
    border: 1px solid;
    border-radius: var(--border-radius, 4px);
    cursor: pointer;
    font-size: 0.8125rem;
    font-family: inherit;
    transition: filter 0.15s;
    ${variantStyles[variant] || variantStyles.secondary}
  `;

  const button = api.createElement('button', { style: baseStyle });
  button.textContent = label;

  // Hover effect
  button.addEventListener('mouseenter', () => { button.style.filter = 'brightness(1.15)'; });
  button.addEventListener('mouseleave', () => { button.style.filter = ''; });

  // Error display element (hidden by default)
  const errorEl = api.createElement('div', {
    style: 'color: var(--color-danger, #e74c3c); font-size: 0.75rem; margin-top: 4px; display: none;'
  });

  button.addEventListener('click', async () => {
    const code = item.content?.code;
    if (!code) return;

    try {
      button.disabled = true;
      button.style.opacity = '0.6';
      button.style.cursor = 'wait';
      button.textContent = 'Working...';
      errorEl.style.display = 'none';

      const pageContext = api.pageContext || { getState() {}, setState() {}, onStateChange() { return () => {}; } };
      const fn = new Function('api', 'pageContext', `return (async () => { ${code} })()`);
      await fn(api, pageContext);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      window.kernel?.captureError(err, { operation: 'widget-button', itemId: item.id, itemName: item.name });
    } finally {
      button.disabled = false;
      button.style.opacity = '';
      button.style.cursor = 'pointer';
      button.textContent = label;
    }
  });

  const wrapper = api.createElement('div');
  wrapper.appendChild(button);
  wrapper.appendChild(errorEl);

  return wrapper;
}
// [END:render]
