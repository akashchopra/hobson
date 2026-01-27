// Item: field_view_markdown_readonly
// ID: 8fd956ff-01f4-48f5-8afb-42fc2718005b
// Type: cccccccc-0000-0000-0000-000000000000


// Markdown readonly field view
export async function render(value, options, api) {
  const { label } = options;
  const markdown = value || '';
  
  const wrapper = api.createElement('div', { className: 'field-markdown-readonly' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  // Use the hobson-markdown library for rendering
  const hobsonMarkdown = await api.require('hobson-markdown');
  const content = await hobsonMarkdown.render(markdown, api);

  wrapper.appendChild(content);
  return wrapper;
}
