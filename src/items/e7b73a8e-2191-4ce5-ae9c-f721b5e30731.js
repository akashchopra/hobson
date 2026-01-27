// Item: field_view_code_editable
// ID: e7b73a8e-2191-4ce5-ae9c-f721b5e30731
// Type: cccccccc-0000-0000-0000-000000000000


// Code editable field view
export async function render(value, options, api) {
  const { onChange, label, language = 'javascript' } = options;
  const code = value || '';

  const wrapper = api.createElement('div', { className: 'field-code-editable' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  // Load CSS and CodeMirror
  const cssLoader = await api.require('css-loader-lib');
  await cssLoader.loadCSS('codemirror-css', api);
  await api.require('codemirror');
  await api.require('codemirror-javascript');
  const CodeMirror = window.CodeMirror;

  // Editor container
  const editorContainer = api.createElement('div');
  editorContainer.style.cssText = 'border: 1px solid #d0d0d0; border-radius: 6px; overflow: hidden; min-height: 300px;';
  wrapper.appendChild(editorContainer);

  // Create CodeMirror instance
  const cm = CodeMirror(editorContainer, {
    value: code,
    mode: language,
    lineNumbers: true,
    lineWrapping: true,
    theme: 'default',
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
    viewportMargin: 2000,
    extraKeys: {
      'Tab': (editor) => {
        if (editor.somethingSelected()) {
          editor.indentSelection('add');
        } else {
          editor.replaceSelection('  ');
        }
      }
    }
  });

  cm.setSize('100%', '400px');

  // Refresh after layout completes to fix gutter width calculation
  requestAnimationFrame(() => {
    cm.refresh();

    // Check URL params for line navigation (field=code&line=X&col=Y)
    const urlParams = new URLSearchParams(window.location.search);
    const field = urlParams.get('field');
    const line = parseInt(urlParams.get('line'), 10);
    const col = parseInt(urlParams.get('col'), 10) || 0;

    if (field === 'code' && !isNaN(line) && line > 0) {
      // CodeMirror uses 0-based line numbers
      const cmLine = line - 1;

      // Scroll line into view and set cursor
      cm.scrollIntoView({ line: cmLine, ch: col }, 100);
      cm.setCursor({ line: cmLine, ch: col });

      // Add highlight class to the line
      cm.addLineClass(cmLine, 'background', 'line-highlight');

      // Add CSS for highlight if not present
      if (!document.getElementById('line-highlight-css')) {
        const style = document.createElement('style');
        style.id = 'line-highlight-css';
        style.textContent = '.line-highlight { background: #fff3cd !important; }';
        document.head.appendChild(style);
      }
    }
  });

  // Call onChange on edits
  if (onChange) {
    cm.on('change', () => {
      onChange(cm.getValue());
    });
  }

  // Keyboard shortcut hint
  const hint = api.createElement('div');
  hint.style.cssText = 'font-size: 12px; color: #999;';
  hint.textContent = 'Tip: Tab for indent, Shift+Tab to dedent';
  wrapper.appendChild(hint);

  return wrapper;
}
