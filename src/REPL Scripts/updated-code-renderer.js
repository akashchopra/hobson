/**
 * Updated code-renderer using CodeMirror with JavaScript mode
 *
 * To install: Update the code-renderer item with this code
 */

const updatedCode = `
export async function render(item, api) {
  // Load CSS
  const cssLoader = await api.require('css-loader-lib');
  await cssLoader.loadCSS('codemirror-css', api);

  const container = api.createElement('div', { style: 'height: 100%; display: flex; flex-direction: column;' }, []);

  // Header with item name and type
  const header = api.createElement('div', {
    style: 'margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0; flex-shrink: 0;'
  }, []);

  const title = api.createElement('h3', { style: 'margin: 0; display: inline-block;' }, [
    item.name || item.id
  ]);
  header.appendChild(title);

  const typ = await api.get(item.type);
  const typeInfo = api.createElement('span', {
    style: 'margin-left: 15px; color: #666; font-size: 13px;'
  }, [\`Type: \${typ.name}\`]);
  header.appendChild(typeInfo);

  container.appendChild(header);

  // CodeMirror editor container
  const editorContainer = api.createElement('div', {
    style: 'flex: 1; border: 1px solid #d0d0d0; border-radius: 6px; overflow: hidden; min-height: 0;'
  }, []);
  container.appendChild(editorContainer);

  // Load CodeMirror
  await api.require('codemirror');
  await api.require('codemirror-javascript');
  const CM = window.CodeMirror;
  delete window.CodeMirror;

  const editor = CM(editorContainer, {
    value: item.content?.code || '',
    mode: 'javascript',
    lineNumbers: true,
    lineWrapping: true,
    theme: 'default',
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
    extraKeys: {
      'Tab': (cm) => {
        if (cm.somethingSelected()) {
          cm.indentSelection('add');
        } else {
          cm.replaceSelection('  ');
        }
      }
    }
  });

  // Make editor fill container
  editor.setSize('100%', '100%');

  // Auto-save indicator
  const saveIndicator = api.createElement('span', {
    style: 'margin-left: 10px; color: #999; font-size: 12px;'
  }, ['']);

  editor.on('change', () => {
    saveIndicator.textContent = 'Unsaved changes...';
    saveIndicator.style.color = '#cc6600';
  });

  // Button bar
  const buttonBar = api.createElement('div', {
    style: 'margin-top: 15px; display: flex; gap: 10px; align-items: center; flex-shrink: 0;'
  }, []);

  const saveBtn = api.createElement('button', {
    style: 'padding: 10px 20px; cursor: pointer; font-size: 14px; font-weight: 500;',
    onclick: async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        const updated = {
          ...item,
          content: {
            ...item.content,
            code: editor.getValue()
          }
        };
        await api.update(updated);

        saveIndicator.textContent = 'Saved!';
        saveIndicator.style.color = '#00aa00';
        saveBtn.textContent = 'Save';

        setTimeout(() => {
          saveIndicator.textContent = '';
        }, 2000);
      } catch (error) {
        alert(\`Error saving: \${error.message}\`);
        saveBtn.textContent = 'Save';
      } finally {
        saveBtn.disabled = false;
      }
    }
  }, ['Save']);
  buttonBar.appendChild(saveBtn);

  const saveAndTestBtn = api.createElement('button', {
    style: 'padding: 10px 20px; cursor: pointer; font-size: 14px;',
    onclick: async () => {
      saveAndTestBtn.disabled = true;
      saveAndTestBtn.textContent = 'Saving...';

      try {
        const updated = {
          ...item,
          content: {
            ...item.content,
            code: editor.getValue()
          }
        };
        await api.update(updated);

        // For renderers, refresh by navigating away and back
        const currentRoot = api.viewport.getRoot();
        if (currentRoot === item.id) {
          // Viewing this code item directly - refresh it
          await api.navigate(api.IDS.VIEWPORT);
          setTimeout(() => api.navigate(item.id), 50);
        } else {
          // Viewing something else that uses this code - refresh that
          await api.navigate(api.IDS.VIEWPORT);
          setTimeout(() => api.navigate(currentRoot), 50);
        }
      } catch (error) {
        alert(\`Error: \${error.message}\`);
        saveAndTestBtn.textContent = 'Save & Test';
        saveAndTestBtn.disabled = false;
      }
    }
  }, ['Save & Test']);
  buttonBar.appendChild(saveAndTestBtn);

  buttonBar.appendChild(saveIndicator);

  // Keyboard shortcuts hint
  const hint = api.createElement('span', {
    style: 'margin-left: auto; color: #999; font-size: 12px;'
  }, ['Tip: Ctrl+S to save (coming soon)']);
  buttonBar.appendChild(hint);

  container.appendChild(buttonBar);

  return container;
}
`;

// Export for use in REPL
if (typeof window !== 'undefined') {
  window.updatedCodeRendererCode = updatedCode;
}
