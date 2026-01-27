// Item: field_view_markdown_editable
// ID: 56f77a00-baf5-43cc-9dc4-8ad0c66f1e8f
// Type: cccccccc-0000-0000-0000-000000000000


// Markdown editable field view
export async function render(value, options, api) {
  const { onChange, label, placeholder } = options;
  const markdown = value || '';

  const wrapper = api.createElement('div', { className: 'field-markdown-editable' });
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
  await api.require('codemirror-markdown');
  const CodeMirror = window.CodeMirror;

  // Editor container
  const editorContainer = api.createElement('div');
  editorContainer.style.cssText = 'border: 1px solid #d0d0d0; border-radius: 6px; overflow: hidden; min-height: 300px;';
  wrapper.appendChild(editorContainer);

  // Create CodeMirror instance
  const cm = CodeMirror(editorContainer, {
    value: markdown,
    mode: 'markdown',
    lineNumbers: true,
    lineWrapping: true,
    theme: 'default',
    viewportMargin: 2000,
    placeholder: placeholder || '',
    extraKeys: {
      'Tab': (editor) => editor.replaceSelection('  ')
    }
  });

  cm.setSize('100%', '300px');

  // Refresh after layout completes to fix gutter width calculation
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
  insertBtn.style.cssText = 'padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; align-self: flex-start;';
  wrapper.appendChild(insertBtn);

  // Picker container (hidden initially)
  const pickerContainer = api.createElement('div');
  pickerContainer.style.cssText = 'display: none; padding: 15px; border: 1px solid #ddd; border-radius: 6px; background: #f9f9f9;';
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
    closeBtn.style.cssText = 'padding: 6px 12px; cursor: pointer; background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px;';
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
      actionButtons.style.cssText = 'margin-top: 15px; padding: 15px; background: #fff; border: 1px solid #ddd; border-radius: 4px; display: flex; gap: 10px; align-items: center;';

      const selectedLabel = api.createElement('div');
      selectedLabel.style.cssText = 'flex: 1; font-weight: 500;';
      selectedLabel.textContent = 'Selected: ' + (targetItem.name || targetItem.id);
      actionButtons.appendChild(selectedLabel);

      const linkBtn = api.createElement('button');
      linkBtn.textContent = 'Insert Link';
      linkBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;';
      linkBtn.onclick = () => insertReference(targetItem, false);
      actionButtons.appendChild(linkBtn);

      const transcludeBtn = api.createElement('button');
      transcludeBtn.textContent = 'Insert Transclusion';
      transcludeBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; background: #28a745; color: white; border: none; border-radius: 4px;';
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
