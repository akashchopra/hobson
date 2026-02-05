
// Tag field view - displays and edits arrays of tag IDs
export function render(value, options, api) {
  const { mode, onChange, label } = options;
  const tags = value || [];

  const wrapper = api.createElement('div', { className: 'field-tags' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: var(--color-text);';
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
        const tagColor = tag.content?.color || 'var(--color-primary)';

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
        pill.style.cssText = 'display: inline-block; padding: 4px 12px; background: var(--color-danger-light); border: 1px solid var(--color-danger); border-radius: 12px; font-size: 12px; color: var(--color-danger); font-family: monospace;';
        pill.title = 'Tag not found: ' + tagId;
        pill.textContent = tagId.substring(0, 8) + '...';
        pillsContainer.appendChild(pill);
      }
    }

    // Add Tag button in editable mode
    if (mode === 'editable' && onChange) {
      const addBtn = api.createElement('button');
      addBtn.textContent = '+ Add Tag';
      addBtn.style.cssText = 'padding: 4px 12px; background: var(--color-primary); color: var(--color-bg-surface); border: none; border-radius: 12px; font-size: 12px; font-weight: 500; cursor: pointer;';
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
    pickerPanel.style.cssText = 'margin-top: 12px; padding: 15px; background: var(--color-bg-surface-alt); border: 1px solid var(--color-border); border-radius: var(--border-radius); max-height: 400px; overflow-y: auto;';

    const header = api.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';

    const title = api.createElement('div');
    title.textContent = 'Select tags';
    title.style.cssText = 'font-weight: 500; color: var(--color-text);';
    header.appendChild(title);

    const closeBtn = api.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'background: none; border: none; font-size: 18px; cursor: pointer; color: var(--color-text-secondary);';
    closeBtn.onclick = () => { isPickerOpen = false; hidePicker(); };
    header.appendChild(closeBtn);

    pickerPanel.appendChild(header);

    // Load libraries and all items
    const treeBuilder = await api.require('tag-tree-builder');
    const tagPickerUI = await api.require('tag-picker-ui');
    const allItems = await api.getAll();

    // Discover items used as tags (same algorithm as tag browser)
    const usedAsTag = new Set();
    allItems.forEach(item => {
      (item.content?.tags || []).forEach(tagId => usedAsTag.add(tagId));
    });

    // Walk up parent chains to include ancestors
    const toInclude = new Set(usedAsTag);
    for (const tagId of usedAsTag) {
      try {
        let current = await api.get(tagId);
        while (current?.content?.parent) {
          toInclude.add(current.content.parent);
          try {
            current = await api.get(current.content.parent);
          } catch { break; }
        }
      } catch {
        // Tag referenced but no longer exists - skip
      }
    }

    // Build tree from discovered tags
    const tagItems = (await Promise.all(
      [...toInclude].map(id => api.get(id).catch(() => null))
    )).filter(Boolean);
    const tree = treeBuilder.buildTagTree(tagItems);

    // Helper to add tag
    const selectTag = async (tagId) => {
      if (!pendingTags.includes(tagId)) {
        pendingTags.push(tagId);
        onChange(pendingTags);
        await renderPills();
        renderTree();
        searchInput.value = '';
        searchResults.innerHTML = '';
      }
    };

    // Search box for finding any item
    const searchInput = api.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search all items...';
    searchInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 12px; border: 1px solid var(--color-border); border-radius: var(--border-radius); box-sizing: border-box;';

    const searchResults = api.createElement('div');
    searchResults.style.cssText = 'margin-bottom: 12px;';

    searchInput.oninput = () => {
      const query = searchInput.value.toLowerCase().trim();
      searchResults.innerHTML = '';

      if (query.length < 2) return;

      const matches = allItems.filter(item => {
        const name = (item.name || item.content?.name || '').toLowerCase();
        return name.includes(query) && !pendingTags.includes(item.id);
      }).slice(0, 10);

      matches.forEach(item => {
        const row = api.createElement('div');
        row.style.cssText = 'padding: 6px 8px; cursor: pointer; border-radius: 4px; background: var(--color-bg-surface); margin-bottom: 4px;';
        row.textContent = item.name || item.content?.name || item.id.substring(0, 8);
        row.onmouseover = () => { row.style.background = 'var(--color-primary-light)'; };
        row.onmouseout = () => { row.style.background = 'var(--color-bg-surface)'; };
        row.onclick = () => selectTag(item.id);
        searchResults.appendChild(row);
      });
    };

    pickerPanel.appendChild(searchInput);
    pickerPanel.appendChild(searchResults);

    // Tree section label
    if (tagItems.length > 0) {
      const treeLabel = api.createElement('div');
      treeLabel.textContent = 'Previously used tags:';
      treeLabel.style.cssText = 'font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px;';
      pickerPanel.appendChild(treeLabel);
    }

    const treeContainer = api.createElement('div');
    pickerPanel.appendChild(treeContainer);

    wrapper.appendChild(pickerPanel);

    const renderTree = () => {
      treeContainer.innerHTML = '';
      if (tagItems.length === 0) {
        const emptyMsg = api.createElement('div');
        emptyMsg.textContent = 'No tags in use yet. Search above to tag with any item.';
        emptyMsg.style.cssText = 'color: var(--color-text-secondary); font-style: italic; font-size: 13px;';
        treeContainer.appendChild(emptyMsg);
        return;
      }
      tagPickerUI.renderTagPicker({
        container: treeContainer,
        tree: tree,
        selectedTags: pendingTags,
        expandedState: expandedState,
        onToggle: (tagId) => selectTag(tagId),
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
