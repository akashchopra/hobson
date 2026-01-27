// Item: default-editor
// ID: 55555555-1111-0000-0000-000000000000
// Type: 55555555-0000-0000-0000-000000000000


export async function render(item, api) {
  const container = api.createElement('div', {
    style: 'display: flex; flex-direction: column; gap: 16px; min-width: 500px;'
  }, []);

  // JSON textarea
  const textarea = api.createElement('textarea', {
    style: 'width: 100%; height: 400px; font-family: monospace; font-size: 13px; padding: 12px; border: 1px solid #ccc; border-radius: 4px; resize: vertical;',
    spellcheck: 'false'
  }, []);
  textarea.value = JSON.stringify(item, null, 2);
  container.appendChild(textarea);

  // Error message area
  const errorArea = api.createElement('div', {
    style: 'color: #c00; font-size: 13px; min-height: 20px;'
  }, []);
  container.appendChild(errorArea);

  // Button row
  const buttonRow = api.createElement('div', {
    style: 'display: flex; gap: 10px; justify-content: flex-end;'
  }, []);

  // Cancel button
  const cancelBtn = api.createElement('button', {
    style: 'padding: 8px 16px; cursor: pointer;',
    onclick: () => api.close()
  }, ['Cancel']);
  buttonRow.appendChild(cancelBtn);

  // Save button
  const saveBtn = api.createElement('button', {
    style: 'padding: 8px 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;',
    onclick: async () => {
      try {
        const parsed = JSON.parse(textarea.value);
        // Preserve the original ID - prevent accidental ID changes
        parsed.id = item.id;
        await api.saveAndClose(parsed);
      } catch (e) {
        errorArea.textContent = 'Invalid JSON: ' + e.message;
      }
    }
  }, ['Save']);
  buttonRow.appendChild(saveBtn);

  container.appendChild(buttonRow);

  // Keyboard shortcut: Ctrl/Cmd+S to save
  textarea.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      try {
        const parsed = JSON.parse(textarea.value);
        parsed.id = item.id;
        await api.saveAndClose(parsed);
      } catch (err) {
        errorArea.textContent = 'Invalid JSON: ' + err.message;
      }
    }
  });

  return container;
}
