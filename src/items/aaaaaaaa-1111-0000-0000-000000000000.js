// Item: kernel:default-view
// ID: aaaaaaaa-1111-0000-0000-000000000000
// Type: aaaaaaaa-0000-0000-0000-000000000000

// Default View - Fallback JSON display
// See [Views & Rendering](item://a0a0a0a0-d0c0-4000-8000-000000000004)

// [BEGIN:render]
export async function render(item, api) {
  const container = api.createElement('div', { className: 'default-view' });

  const header = api.createElement('div', { style: 'margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--color-border-light);' });
  const title = api.createElement('h3', { style: 'margin: 0 0 5px 0;' });
  title.textContent = item.name || item.id.slice(0, 8) + '...';
  header.appendChild(title);
  const meta = api.createElement('div', { style: 'font-size: 12px; color: var(--color-text-secondary);' });
  meta.textContent = 'Type: ' + item.type.slice(0, 8) + '...';
  header.appendChild(meta);
  container.appendChild(header);

  const textarea = api.createElement('textarea', {
    style: 'width: 100%; min-height: 300px; font-family: monospace; font-size: 13px; padding: 10px; border: 1px solid var(--color-border); border-radius: var(--border-radius);'
  });
  textarea.value = JSON.stringify(item, null, 2);
  container.appendChild(textarea);

  const actions = api.createElement('div', { style: 'margin-top: 10px; display: flex; gap: 10px;' });

  const saveBtn = api.createElement('button', { style: 'padding: 8px 16px; cursor: pointer;' });
  saveBtn.textContent = 'Save';
  saveBtn.onclick = async () => {
    try {
      const updated = JSON.parse(textarea.value);
      await api.set(updated);
      await api.rerenderItem(updated.id);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };
  actions.appendChild(saveBtn);

  const copyBtn = api.createElement('button', { style: 'padding: 8px 16px; cursor: pointer;' });
  copyBtn.textContent = 'Copy JSON';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(textarea.value);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => copyBtn.textContent = 'Copy JSON', 1500);
  };
  actions.appendChild(copyBtn);

  container.appendChild(actions);
  return container;
}
// [END:render]
