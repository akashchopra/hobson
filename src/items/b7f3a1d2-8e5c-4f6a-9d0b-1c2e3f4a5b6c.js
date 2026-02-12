// Note Widget View - renders notes as compact markdown body for app-page embedding

// [BEGIN:render]
export async function render(item, api) {
  const container = api.createElement('div', {
    style: 'line-height: 1.5;'
  });

  const body = item.content?.description || '';

  try {
    const hobsonMarkdown = await api.require('hobson-markdown');
    const rendered = await hobsonMarkdown.render(body, api);
    if (rendered instanceof HTMLElement) {
      container.appendChild(rendered);
    } else {
      container.innerHTML = rendered;
    }
  } catch (e) {
    // Fallback: render as pre-formatted text
    const pre = api.createElement('pre', {
      style: 'white-space: pre-wrap; margin: 0; font-family: inherit;'
    });
    pre.textContent = body;
    container.appendChild(pre);
  }

  return container;
}
// [END:render]
