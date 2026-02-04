// Code Editable Field View - CodeMirror-based code editor
// See [field-view-code-editable documentation](item://e7b73a8e-2191-4ce5-ae9c-f721b5e30731)

// [BEGIN:findRegionStartLine]
// Helper: Find the line number where a region starts
function findRegionStartLine(text, regionName) {
  const lines = text.split('\n');
  const marker = '[BEGIN:' + regionName + ']';
  for (let i = 0; i < lines.length; i++) {
    const cleaned = lines[i].trim()
      .replace(/^\/\/\s*/, '')
      .replace(/^#\s*/, '')
      .replace(/^<!--\s*/, '')
      .replace(/\s*-->$/, '')
      .trim();
    if (cleaned === marker) return i + 2; // Line after marker (1-indexed)
  }
  return null;
}
// [END:findRegionStartLine]

// [BEGIN:render]
// Code editable field view
export async function render(value, options, api) {
  const { onChange, label, language = 'javascript', scrollToLine, scrollToRegion } = options;
  const code = value || '';

  const wrapper = api.createElement('div', { className: 'field-code-editable' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: var(--color-text);';
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
  editorContainer.style.cssText = 'border: 1px solid var(--color-border); border-radius: var(--border-radius); overflow: hidden; min-height: 300px;';
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

  // Function to handle line/region navigation
  const navigateToTarget = () => {
    // First try options (passed from generic_view), then fall back to URL params
    let targetLine = scrollToLine;
    let col = 0;

    // If scrollToRegion is specified but no line, find the region
    if (scrollToRegion && !targetLine) {
      targetLine = findRegionStartLine(code, scrollToRegion);
    }

    // Fallback to URL params for backward compatibility
    if (!targetLine) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlLine = parseInt(urlParams.get('line'), 10);
      col = parseInt(urlParams.get('col'), 10) || 0;
      if (!isNaN(urlLine) && urlLine > 0) {
        targetLine = urlLine;
      }
    }

    if (targetLine) {
      // CodeMirror uses 0-based line numbers
      const cmLine = targetLine - 1;

      // Scroll line into view and set cursor
      cm.scrollIntoView({ line: cmLine, ch: col }, 100);
      cm.setCursor({ line: cmLine, ch: col });
      cm.focus();

      // Add highlight class to the line
      cm.addLineClass(cmLine, 'background', 'line-highlight');

      // Add CSS for highlight if not present
      if (!document.getElementById('line-highlight-css')) {
        const style = document.createElement('style');
        style.id = 'line-highlight-css';
        style.textContent = '.line-highlight { background: var(--color-warning-light) !important; }';
        document.head.appendChild(style);
      }
    }
  };

  // Use IntersectionObserver to refresh CodeMirror when visible
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        cm.refresh();
        navigateToTarget();
        observer.disconnect();
        break;
      }
    }
  }, { threshold: 0.1 });
  observer.observe(editorContainer);

  // Also refresh on first focus as fallback
  const focusHandler = () => {
    cm.refresh();
    navigateToTarget();
    editorContainer.removeEventListener('click', focusHandler);
  };
  editorContainer.addEventListener('click', focusHandler);

  // Call onChange on edits
  if (onChange) {
    cm.on('change', () => {
      onChange(cm.getValue());
    });
  }

  // Keyboard shortcut hint
  const hint = api.createElement('div');
  hint.style.cssText = 'font-size: 12px; color: var(--color-text-tertiary);';
  hint.textContent = 'Tip: Tab for indent, Shift+Tab to dedent';
  wrapper.appendChild(hint);

  return wrapper;
}
// [END:render]
