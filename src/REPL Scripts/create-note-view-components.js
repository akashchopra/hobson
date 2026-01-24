// Create Note View Components
// Extracts tag and markdown field views from note-renderer, creates view-specs
// Run this in the Hobson REPL after installing the unified view system

(async function() {
  const IDS = api.IDS;
  const FIELD_VIEW_TYPE = "cccccccc-0000-0000-0000-000000000000";
  const VIEW_SPEC_TYPE = "bbbbbbbb-0000-0000-0000-000000000000";
  const NOTE_TYPE = "871ae771-b9b1-4f40-8c7f-d9038bfb69c3";

  console.log("Creating note view components...");

  // =========================================================================
  // 1. field_view_tags
  // =========================================================================

  console.log("\n1. Creating field_view_tags...");

  const fieldViewTags = {
    id: crypto.randomUUID(),
    name: "field_view_tags",
    type: FIELD_VIEW_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Field view for tag arrays. Displays colored pills with hierarchical paths. Editable mode includes tag picker.",
      code: `
// Tag field view - displays and edits arrays of tag IDs
export function render(value, options, api) {
  const { mode, onChange, label } = options;
  const tags = value || [];

  const wrapper = api.createElement('div', { className: 'field-tags' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  // Container for pills
  const pillsContainer = api.createElement('div');
  pillsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; align-items: center;';
  wrapper.appendChild(pillsContainer);

  // State for editable mode
  let pendingTags = [...tags];
  let isPickerOpen = false;
  let pickerPanel = null;
  const expandedState = new Map();

  // Helper: get tag path
  const getTagPath = async (tag) => {
    const path = [];
    let currentTag = tag;
    while (currentTag) {
      const tagName = currentTag.content?.name || currentTag.name || currentTag.id;
      path.unshift(tagName);
      if (currentTag.content?.parent) {
        try {
          currentTag = await api.get(currentTag.content.parent);
        } catch { break; }
      } else {
        break;
      }
    }
    return path.join(' / ');
  };

  // Render function (called on state changes)
  const renderPills = async () => {
    pillsContainer.innerHTML = '';
    const tagsToRender = mode === 'editable' ? pendingTags : tags;

    for (const tagId of tagsToRender) {
      try {
        const tag = await api.get(tagId);
        const tagPath = await getTagPath(tag);
        const tagColor = tag.content?.color || '#3b82f6';

        const pill = api.createElement('span');
        pill.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 4px ' +
          (mode === 'editable' ? '8px 4px 12px' : '12px') +
          '; background: ' + tagColor + '20; border: 1px solid ' + tagColor +
          '; border-radius: 12px; font-size: 12px; font-weight: 500; color: ' + tagColor + ';';

        const pillText = api.createElement('span');
        pillText.textContent = tagPath;
        pill.appendChild(pillText);

        // Remove button in editable mode
        if (mode === 'editable' && onChange) {
          const removeBtn = api.createElement('button');
          removeBtn.textContent = '×';
          removeBtn.style.cssText = 'background: none; border: none; color: ' + tagColor +
            '; cursor: pointer; padding: 0; margin: 0; font-size: 14px; line-height: 1; font-weight: bold;';
          removeBtn.onclick = async () => {
            pendingTags = pendingTags.filter(id => id !== tagId);
            onChange(pendingTags);
            await renderPills();
          };
          pill.appendChild(removeBtn);
        }

        pillsContainer.appendChild(pill);
      } catch (err) {
        // Tag not found
        const pill = api.createElement('span');
        pill.style.cssText = 'display: inline-block; padding: 4px 12px; background: #fee; border: 1px solid #f88; border-radius: 12px; font-size: 12px; color: #c44; font-family: monospace;';
        pill.title = 'Tag not found: ' + tagId;
        pill.textContent = tagId.substring(0, 8) + '...';
        pillsContainer.appendChild(pill);
      }
    }

    // Add Tag button in editable mode
    if (mode === 'editable' && onChange) {
      const addBtn = api.createElement('button');
      addBtn.textContent = '+ Add Tag';
      addBtn.style.cssText = 'padding: 4px 12px; background: #3b82f6; color: white; border: none; border-radius: 12px; font-size: 12px; font-weight: 500; cursor: pointer;';
      addBtn.onclick = () => togglePicker();
      pillsContainer.appendChild(addBtn);
    }
  };

  // Toggle picker panel
  const togglePicker = async () => {
    isPickerOpen = !isPickerOpen;
    if (isPickerOpen) {
      await showPicker();
    } else {
      hidePicker();
    }
  };

  const showPicker = async () => {
    if (pickerPanel) pickerPanel.remove();

    pickerPanel = api.createElement('div');
    pickerPanel.style.cssText = 'margin-top: 12px; padding: 15px; background: #f9f9f9; border: 1px solid #d0d0d0; border-radius: 6px; max-height: 300px; overflow-y: auto;';

    const header = api.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';

    const title = api.createElement('div');
    title.textContent = 'Select tags';
    title.style.cssText = 'font-weight: 500; color: #333;';
    header.appendChild(title);

    const closeBtn = api.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'background: none; border: none; font-size: 18px; cursor: pointer; color: #666;';
    closeBtn.onclick = () => { isPickerOpen = false; hidePicker(); };
    header.appendChild(closeBtn);

    pickerPanel.appendChild(header);

    const treeContainer = api.createElement('div');
    pickerPanel.appendChild(treeContainer);

    wrapper.appendChild(pickerPanel);

    // Load and render tag tree
    const treeBuilder = await api.require('tag-tree-builder');
    const tagPickerUI = await api.require('tag-picker-ui');
    const allTags = await api.query({ type: "d1da8525-b0dc-4a79-8bef-0cbed1ed003d" });
    const tree = treeBuilder.buildTagTree(allTags);

    const renderTree = () => {
      treeContainer.innerHTML = '';
      tagPickerUI.renderTagPicker({
        container: treeContainer,
        tree: tree,
        selectedTags: pendingTags,
        expandedState: expandedState,
        onToggle: async (tagId) => {
          if (!pendingTags.includes(tagId)) {
            pendingTags.push(tagId);
            onChange(pendingTags);
            await renderPills();
            renderTree();
          }
        },
        onExpand: () => renderTree()
      }, api);
    };

    renderTree();
  };

  const hidePicker = () => {
    if (pickerPanel) {
      pickerPanel.remove();
      pickerPanel = null;
    }
  };

  // Initial render
  renderPills();

  return wrapper;
}
`
    }
  };

  await api.set(fieldViewTags);
  console.log("  Created: " + fieldViewTags.id);

  // =========================================================================
  // 2. field_view_markdown_readonly
  // =========================================================================

  console.log("\n2. Creating field_view_markdown_readonly...");

  const fieldViewMarkdownReadonly = {
    id: crypto.randomUUID(),
    name: "field_view_markdown_readonly",
    type: FIELD_VIEW_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Displays rendered markdown with item:// link support and transclusion (full and partial).",
      code: `
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

  // Helper: Parse item URL
  const parseItemUrl = (url) => {
    const match = url.match(/item:\\/\\/([a-f0-9\\-]+)(?:#([^?]+))?(?:\\?(.+))?/);
    if (!match) return null;
    const itemId = match[1];
    const fragment = match[2] || null;
    const queryString = match[3] || null;
    const queryParams = {};
    if (queryString) {
      queryString.split('&').forEach(pair => {
        const [key, val] = pair.split('=');
        queryParams[key] = val;
      });
    }
    return { itemId, fragment, queryParams };
  };

  // Helper: Get field value
  const getFieldValue = (item, fieldName) => {
    if (fieldName === 'name') return item.name || '';
    if (fieldName === 'content') return JSON.stringify(item.content, null, 2);
    return item.content?.[fieldName] || '';
  };

  // Helper: Extract region
  const extractRegion = (text, regionName) => {
    const lines = text.split('\\n');
    const beginMarker = '[BEGIN:' + regionName + ']';
    const endMarker = '[END:' + regionName + ']';
    let beginIdx = -1, endIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const cleaned = lines[i].trim().replace(/^\\/\\/\\s*/, '').replace(/^#\\s*/, '').replace(/^<!--\\s*/, '').replace(/\\s*-->$/, '').trim();
      if (cleaned === beginMarker) beginIdx = i;
      else if (cleaned === endMarker && beginIdx >= 0) { endIdx = i; break; }
    }
    if (beginIdx === -1 || endIdx === -1) throw new Error('Region not found: ' + regionName);
    return { text: lines.slice(beginIdx + 1, endIdx).join('\\n'), startLine: beginIdx + 2 };
  };

  // Helper: Apply line range
  const applyLineRange = (text, linesParam, baseStartLine = 1) => {
    if (!linesParam) return { text, startLine: baseStartLine };
    const lines = text.split('\\n');
    let startLine, endLine;
    if (linesParam.includes('-')) {
      const parts = linesParam.split('-');
      startLine = parts[0] ? parseInt(parts[0]) : 1;
      endLine = parts[1] ? parseInt(parts[1]) : lines.length;
    } else {
      startLine = endLine = parseInt(linesParam);
    }
    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, endLine);
    return { text: lines.slice(start, end).join('\\n'), startLine: baseStartLine + start };
  };

  // Load markdown-it
  await api.require('markdown-it');
  const markdownitModule = await api.require('markdown-it-wrapper');
  const markdownit = markdownitModule.default;

  // Configure link rendering for item:// links
  const renderer = markdownit.renderer;
  const defaultLinkRender = renderer.rules.link_open || function(tokens, idx, opts, env, self) {
    return self.renderToken(tokens, idx, opts);
  };

  renderer.rules.link_open = function(tokens, idx, opts, env, self) {
    const token = tokens[idx];
    const hrefIndex = token.attrIndex('href');
    if (hrefIndex >= 0) {
      const href = token.attrs[hrefIndex][1];
      if (href.startsWith('item://')) {
        token.attrSet('data-item-link', href);
        token.attrSet('href', '#');
      }
    }
    return defaultLinkRender(tokens, idx, opts, env, self);
  };

  // Render markdown
  const html = markdownit.render(markdown);

  const content = api.createElement('div', { className: 'markdown-content' });
  content.style.cssText = 'line-height: 1.8; font-size: 16px;';
  content.innerHTML = html;

  // Handle item:// link clicks
  const links = content.querySelectorAll('a[data-item-link]');
  links.forEach(link => {
    const href = link.getAttribute('data-item-link');
    const parsed = parseItemUrl(href);
    if (parsed) {
      link.onclick = (e) => {
        e.preventDefault();
        api.navigate(parsed.itemId);
      };
      link.style.cssText = 'color: #007bff; text-decoration: none; border-bottom: 1px solid #007bff; cursor: pointer;';
    }
  });

  // Handle transclusions
  const transclusionImages = content.querySelectorAll('img[src^="item://"]');
  for (const img of transclusionImages) {
    const fullUrl = img.src.replace(/^.*item:\\/\\//, 'item://');
    const parsed = parseItemUrl(fullUrl);
    const altText = img.alt;

    if (!parsed) {
      const errorDiv = api.createElement('div');
      errorDiv.style.cssText = 'background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 8px 12px; margin: 10px 0; color: #856404; font-style: italic;';
      errorDiv.textContent = '[Invalid URL: ' + altText + ']';
      img.parentNode.replaceChild(errorDiv, img);
      continue;
    }

    try {
      const transcludedItem = await api.get(parsed.itemId);
      const isPartial = parsed.fragment || Object.keys(parsed.queryParams).length > 0;

      const wrapperDiv = api.createElement('div', { className: 'transclusion-container' });
      wrapperDiv.style.cssText = 'background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 15px; margin: 15px 0;';

      if (isPartial) {
        // Partial transclusion
        const fieldName = parsed.fragment || 'content';
        let fieldValue = getFieldValue(transcludedItem, fieldName);
        if (!fieldValue) throw new Error('Field not found: ' + fieldName);

        let text, startLine = 1;
        if (parsed.queryParams.region) {
          const regionResult = extractRegion(fieldValue, parsed.queryParams.region);
          text = regionResult.text;
          startLine = regionResult.startLine;
        } else {
          text = fieldValue;
        }

        if (parsed.queryParams.lines) {
          const rangeResult = applyLineRange(text, parsed.queryParams.lines, startLine);
          text = rangeResult.text;
          startLine = rangeResult.startLine;
        }

        let headerDesc = transcludedItem.name || transcludedItem.id;
        if (parsed.fragment) {
          headerDesc += ' (#' + parsed.fragment;
          if (parsed.queryParams.region) headerDesc += ', region=' + parsed.queryParams.region;
          if (parsed.queryParams.lines) headerDesc += ', lines=' + parsed.queryParams.lines;
          headerDesc += ')';
        }

        const header = api.createElement('div');
        header.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #ddd; cursor: pointer;';
        header.textContent = 'Transcluded from: ' + headerDesc;
        header.onclick = () => api.navigate(parsed.itemId);
        wrapperDiv.appendChild(header);

        const pre = api.createElement('pre');
        pre.style.cssText = 'margin: 0; padding: 10px; background: #fff; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 13px; line-height: 1.5;';

        const code = api.createElement('code');
        const lines = text.split('\\n');
        lines.forEach((line, idx) => {
          const lineNum = startLine + idx;
          const lineNumSpan = api.createElement('span');
          lineNumSpan.style.cssText = 'display: inline-block; width: 40px; color: #999; user-select: none; text-align: right; margin-right: 10px;';
          lineNumSpan.textContent = lineNum + '';
          code.appendChild(lineNumSpan);
          code.appendChild(document.createTextNode(line));
          if (idx < lines.length - 1) code.appendChild(document.createTextNode('\\n'));
        });

        pre.appendChild(code);
        wrapperDiv.appendChild(pre);
      } else {
        // Full transclusion
        const header = api.createElement('div');
        header.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #ddd; cursor: pointer;';
        header.textContent = 'Transcluded from: ' + (transcludedItem.name || transcludedItem.id);
        header.onclick = () => api.navigate(parsed.itemId);
        wrapperDiv.appendChild(header);

        const renderedContent = await api.renderItem(parsed.itemId);
        wrapperDiv.appendChild(renderedContent);
      }

      img.parentNode.replaceChild(wrapperDiv, img);
    } catch (err) {
      const errorDiv = api.createElement('div');
      errorDiv.style.cssText = 'background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 8px 12px; margin: 10px 0; color: #856404; font-style: italic;';
      errorDiv.textContent = '[Missing: ' + altText + ' - ' + err.message + ']';
      img.parentNode.replaceChild(errorDiv, img);
    }
  }

  wrapper.appendChild(content);
  return wrapper;
}
`
    }
  };

  await api.set(fieldViewMarkdownReadonly);
  console.log("  Created: " + fieldViewMarkdownReadonly.id);

  // =========================================================================
  // 3. field_view_markdown_editable
  // =========================================================================

  console.log("\n3. Creating field_view_markdown_editable...");

  const fieldViewMarkdownEditable = {
    id: crypto.randomUUID(),
    name: "field_view_markdown_editable",
    type: FIELD_VIEW_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "CodeMirror-based markdown editor with item link/transclusion insertion.",
      code: `
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
`
    }
  };

  await api.set(fieldViewMarkdownEditable);
  console.log("  Created: " + fieldViewMarkdownEditable.id);

  // =========================================================================
  // 4. note_view_readonly (view-spec)
  // =========================================================================

  console.log("\n4. Creating note_view_readonly view-spec...");

  const noteViewReadonly = {
    id: crypto.randomUUID(),
    name: "note_view_readonly",
    type: VIEW_SPEC_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      for_type: NOTE_TYPE,
      description: "Readonly view for notes. Displays title, tags, rendered markdown content, and metadata.",
      ui_hints: {
        "name": {
          field_view: "text",
          mode: "readonly",
          label: "Title"
        },
        "tags": {
          field_view: "tags",
          mode: "readonly",
          label: "Tags"
        },
        "content.description": {
          field_view: "markdown_readonly",
          mode: "readonly"
        },
        "modified": {
          field_view: "timestamp",
          mode: "readonly",
          label: "Last Modified",
          format: "full"
        },
        "created": {
          field_view: "timestamp",
          mode: "readonly",
          label: "Created",
          format: "full"
        }
      }
    }
  };

  await api.set(noteViewReadonly);
  console.log("  Created: " + noteViewReadonly.id);

  // =========================================================================
  // 5. note_view_editable (view-spec)
  // =========================================================================

  console.log("\n5. Creating note_view_editable view-spec...");

  const noteViewEditable = {
    id: crypto.randomUUID(),
    name: "note_view_editable",
    type: VIEW_SPEC_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      for_type: NOTE_TYPE,
      description: "Editable view for notes. Allows editing title, tags, and markdown content.",
      ui_hints: {
        "name": {
          field_view: "text",
          mode: "editable",
          label: "Title",
          placeholder: "Note title..."
        },
        "tags": {
          field_view: "tags",
          mode: "editable",
          label: "Tags"
        },
        "content.description": {
          field_view: "markdown_editable",
          mode: "editable",
          label: "Content"
        },
        "modified": {
          field_view: "timestamp",
          mode: "readonly",
          label: "Last Modified",
          format: "full"
        }
      }
    }
  };

  await api.set(noteViewEditable);
  console.log("  Created: " + noteViewEditable.id);

  // =========================================================================
  // Summary
  // =========================================================================

  console.log("\n" + "=".repeat(60));
  console.log("Note view components created successfully!");
  console.log("=".repeat(60));
  console.log("\nField Views:");
  console.log("  - field_view_tags: " + fieldViewTags.id);
  console.log("  - field_view_markdown_readonly: " + fieldViewMarkdownReadonly.id);
  console.log("  - field_view_markdown_editable: " + fieldViewMarkdownEditable.id);
  console.log("\nView Specs:");
  console.log("  - note_view_readonly: " + noteViewReadonly.id);
  console.log("  - note_view_editable: " + noteViewEditable.id);
  console.log("\nTo test:");
  console.log("  1. Reload kernel to pick up changes");
  console.log("  2. Navigate to a note item");
  console.log("  3. The existing note-renderer will still be used (it's a RENDERER type)");
  console.log("  4. Once view system is active, use 'Display As...' to switch views");
  console.log("\nNote: The unified view system must be installed first (run phase1-4 scripts).");

  return {
    fieldViewTags,
    fieldViewMarkdownReadonly,
    fieldViewMarkdownEditable,
    noteViewReadonly,
    noteViewEditable
  };
})();
