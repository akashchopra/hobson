// Item: field-view-markdown-editable
// ID: 56f77a00-baf5-43cc-9dc4-8ad0c66f1e8f
// Type: cccccccc-0000-0000-0000-000000000000


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

// Markdown editable field view
// Supports sizing option: "compact" (default) or "fill"
export async function render(value, options, api) {
  const { onChange, label, placeholder, sizing, scrollToLine, scrollToRegion } = options;
  const markdown = value || '';
  const isFill = sizing === 'fill';

  const wrapper = api.createElement('div', { className: 'field-markdown-editable' });
  // For fill mode, wrapper needs flex: 1 and min-height: 0 to allow shrinking
  wrapper.style.cssText = isFill
    ? 'display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0;'
    : 'display: flex; flex-direction: column; gap: 8px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: var(--color-text); flex-shrink: 0;';
    wrapper.appendChild(labelEl);
  }

  // Load CSS and CodeMirror
  const cssLoader = await api.require('css-loader-lib');
  await cssLoader.loadCSS('codemirror-css', api);
  await api.require('codemirror');
  await api.require('codemirror-markdown');
  const CodeMirror = window.CodeMirror;

  // Editor container - sizing depends on mode
  const editorContainer = api.createElement('div');
  editorContainer.style.cssText = isFill
    ? 'border: 1px solid var(--color-border); border-radius: var(--border-radius); overflow: hidden; flex: 1; min-height: 150px;'
    : 'border: 1px solid var(--color-border); border-radius: var(--border-radius); overflow: hidden; min-height: 120px; height: 150px; resize: vertical;';
  wrapper.appendChild(editorContainer);

  // Create CodeMirror instance
  const cm = CodeMirror(editorContainer, {
    value: markdown,
    mode: 'markdown',
    lineNumbers: true,
    lineWrapping: true,
    theme: 'default',
    viewportMargin: Infinity,
    placeholder: placeholder || '',
    extraKeys: {
      'Tab': (editor) => editor.replaceSelection('  ')
    }
  });

  cm.setSize('100%', '100%');

  // Function to handle line/region navigation
  const navigateToTarget = () => {
    let targetLine = scrollToLine;

    // If scrollToRegion is specified but no line, find the region
    if (scrollToRegion && !targetLine) {
      targetLine = findRegionStartLine(markdown, scrollToRegion);
    }

    if (targetLine) {
      // CodeMirror uses 0-based line numbers
      const cmLine = targetLine - 1;

      // Scroll line into view and set cursor
      cm.scrollIntoView({ line: cmLine, ch: 0 }, 100);
      cm.setCursor({ line: cmLine, ch: 0 });
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

  // Refresh CodeMirror when container is resized
  const resizeObserver = new ResizeObserver(() => cm.refresh());
  resizeObserver.observe(editorContainer);

  // Use IntersectionObserver to refresh CodeMirror when visible and navigate
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

  // Also refresh after layout completes to fix gutter width calculation
  requestAnimationFrame(() => cm.refresh());

  // Call onChange on edits
  if (onChange) {
    cm.on('change', () => {
      onChange(cm.getValue());
    });
  }

  // Insert link/transclusion button
  const insertBtn = api.createElement('button');
  insertBtn.textContent = 'Insert Link/Transclusion';
  insertBtn.style.cssText = 'padding: 8px 16px; background: var(--color-success); color: var(--color-bg-surface); border: none; border-radius: var(--border-radius); cursor: pointer; align-self: flex-start; flex-shrink: 0;';
  wrapper.appendChild(insertBtn);

  // Picker container (hidden initially)
  const pickerContainer = api.createElement('div');
  pickerContainer.style.cssText = 'display: none; padding: 15px; border: 1px solid var(--color-border-light); border-radius: var(--border-radius); background: var(--color-bg-surface-alt); flex-shrink: 0;';
  wrapper.appendChild(pickerContainer);

  insertBtn.onclick = async () => {
    pickerContainer.innerHTML = '';
    pickerContainer.style.display = 'block';

    const header = api.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;';

    const title = api.createElement('h4');
    title.style.cssText = 'margin: 0;';
    title.textContent = 'Insert Link or Transclusion';
    header.appendChild(title);

    const closeBtn = api.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'padding: 6px 12px; cursor: pointer; background: var(--color-bg-hover); border: 1px solid var(--color-border); border-radius: var(--border-radius);';
    closeBtn.onclick = () => {
      pickerContainer.style.display = 'none';
      pickerContainer.innerHTML = '';
    };
    header.appendChild(closeBtn);
    pickerContainer.appendChild(header);

    const searchContainer = api.createElement('div');
    pickerContainer.appendChild(searchContainer);

    const searchLib = await api.require('item-search-lib');

    const insertReference = (targetItem, asTransclusion) => {
      const targetName = targetItem.name || targetItem.id;
      const prefix = asTransclusion ? '!' : '';
      const refText = prefix + '[' + targetName + '](item://' + targetItem.id + ')';
      cm.replaceSelection(refText);
      pickerContainer.style.display = 'none';
      pickerContainer.innerHTML = '';
      cm.focus();
    };

    const onSelectCallback = (targetItem) => {
      const existing = searchContainer.querySelector('.item-action-buttons');
      if (existing) existing.remove();

      const actionButtons = api.createElement('div', { className: 'item-action-buttons' });
      actionButtons.style.cssText = 'margin-top: 15px; padding: 15px; background: var(--color-bg-surface); border: 1px solid var(--color-border-light); border-radius: var(--border-radius); display: flex; gap: 10px; align-items: center;';

      const selectedLabel = api.createElement('div');
      selectedLabel.style.cssText = 'flex: 1; font-weight: 500;';
      selectedLabel.textContent = 'Selected: ' + (targetItem.name || targetItem.id);
      actionButtons.appendChild(selectedLabel);

      const linkBtn = api.createElement('button');
      linkBtn.textContent = 'Insert Link';
      linkBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; background: var(--color-primary); color: var(--color-bg-surface); border: none; border-radius: var(--border-radius);';
      linkBtn.onclick = () => insertReference(targetItem, false);
      actionButtons.appendChild(linkBtn);

      const transcludeBtn = api.createElement('button');
      transcludeBtn.textContent = 'Insert Transclusion';
      transcludeBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; background: var(--color-success); color: var(--color-bg-surface); border: none; border-radius: var(--border-radius);';
      transcludeBtn.onclick = () => insertReference(targetItem, true);
      actionButtons.appendChild(transcludeBtn);

      searchContainer.appendChild(actionButtons);
    };

    searchLib.createSearchUI(searchContainer, onSelectCallback, api, {
      placeholder: 'Search items...',
      autoFocus: true
    });
  };

  return wrapper;
}
