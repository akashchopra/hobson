// Item: system:tag-browser-view
// ID: 08f3da07-81e2-4031-bd89-b26f9ebea54d
// Type: aaaaaaaa-0000-0000-0000-000000000000


// Tag browser view - stores results as attachments for uniform interaction
// Uses tag-tree-builder and tag-picker-ui libraries

export async function render(browser, api) {
  // Load shared libraries
  const treeBuilder = await api.require('tag-tree-builder');
  const tagPickerUI = await api.require('tag-picker-ui');

  const container = api.createElement('div', {
    class: 'tag-browser-view',
    style: 'max-width: 600px; margin: 0 auto;'
  }, []);

  // Header
  const header = api.createElement('div', {
    style: 'margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid var(--color-border-light);'
  }, []);

  const title = api.createElement('h2', {
    style: 'margin: 0; font-size: 20px;'
  }, [browser.name || 'Tag Browser']);
  header.appendChild(title);

  container.appendChild(header);

  // Discover tags by scanning content.tags arrays across all items
  const allItems = await api.getAll();
  const usedAsTag = new Set();
  allItems.forEach(item => {
    (item.content?.tags || []).forEach(tagId => usedAsTag.add(tagId));
  });

  // Walk up parent chains to include ancestors
  const toInclude = new Set(usedAsTag);
  for (const tagId of usedAsTag) {
    let current = await api.get(tagId);
    while (current?.content?.parent) {
      toInclude.add(current.content.parent);
      current = await api.get(current.content.parent);
    }
  }

  // Fetch all tag items and build tree
  const tagItems = (await Promise.all(
    [...toInclude].map(id => api.get(id))
  )).filter(Boolean);
  const tree = treeBuilder.buildTagTree(tagItems);

  // Track expanded state (tag ID -> boolean)
  const expandedState = new Map();

  // Tag tree container
  const treeContainer = api.createElement('div', {
    style: 'display: flex; flex-direction: column;'
  }, []);

  // Results container
  const resultsContainer = api.createElement('div', {
    style: 'margin-top: 20px; padding: 15px; background: var(--color-bg-surface-alt); border-radius: var(--border-radius);'
  }, []);

  const resultsTitle = api.createElement('h3', {
    style: 'margin: 0 0 15px 0; font-size: 16px; color: var(--color-text);'
  }, []);
  resultsContainer.appendChild(resultsTitle);

  const resultsList = api.createElement('div', {
    style: 'max-height: 400px; overflow-y: auto;'
  }, []);
  resultsContainer.appendChild(resultsList);

  // Find compact_card_view for rendering results (default view)
  const compactViews = await api.query({ name: 'system:compact-card-view' });
  const compactViewId = compactViews[0]?.id || null;

  // Cycle handler - returns a clickable card for items in render path
  const onCycle = (cycleItem) => {
    const card = api.createElement('div', {
      style: 'padding: 12px; margin-bottom: 8px; background: var(--color-warning-light); border: 1px dashed var(--color-warning); border-radius: var(--border-radius); cursor: pointer; transition: all 0.2s;'
    }, []);

    const titleRow = api.createElement('div', {
      style: 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;'
    }, []);

    const icon = api.createElement('span', {
      style: 'color: var(--color-warning);'
    }, ['\u21bb']);
    titleRow.appendChild(icon);

    const name = api.createElement('span', {
      style: 'font-weight: 500; color: var(--color-text);'
    }, [cycleItem.name || cycleItem.id.substring(0, 8)]);
    titleRow.appendChild(name);

    const badge = api.createElement('span', {
      style: 'font-size: 11px; color: #92400e; background: #fef3c7; padding: 2px 6px; border-radius: var(--border-radius);'
    }, ['in current view']);
    titleRow.appendChild(badge);

    card.appendChild(titleRow);

    const meta = api.createElement('div', {
      style: 'font-size: 12px; color: var(--color-border-dark);'
    }, ['Click to open']);
    card.appendChild(meta);

    card.onmouseover = () => {
      card.style.background = '#fef3c7';
      card.style.borderColor = '#d97706';
      card.style.transform = 'translateX(4px)';
    };
    card.onmouseout = () => {
      card.style.background = 'var(--color-warning-light)';
      card.style.borderColor = 'var(--color-warning)';
      card.style.transform = 'translateX(0)';
    };

    card.onclick = (e) => {
      e.stopPropagation();
      api.siblingContainer?.addSibling(cycleItem.id);
    };

    return card;
  };

  // Render results from attachments
  const renderResults = async () => {
    resultsList.innerHTML = '';

    const selectedTag = browser.content?.selectedTag;
    const attachments = browser.attachments || [];

    if (!selectedTag) {
      resultsContainer.style.display = 'none';
      return;
    }

    // Get tag name for title
    let tagName = selectedTag;
    try {
      const tagItem = await api.get(selectedTag);
      tagName = treeBuilder.getTagName(tagItem);
    } catch (e) {
      // Use ID if tag not found
    }

    resultsTitle.textContent = 'Items tagged with "' + tagName + '" (' + attachments.length + ')';
    resultsContainer.style.display = 'block';

    if (attachments.length === 0) {
      const emptyMsg = api.createElement('div', {
        style: 'padding: 20px; text-align: center; color: var(--color-border-dark); font-style: italic;'
      }, ['No items found with this tag.']);
      resultsList.appendChild(emptyMsg);
    } else {
      for (const childSpec of attachments) {
        const childId = typeof childSpec === 'string' ? childSpec : childSpec.id;
        // Respect per-child view override (from "Display As..."), fall back to compact view
        const childViewId = (typeof childSpec === 'object' && childSpec.view) ? childSpec.view : compactViewId;

        try {
          const childNode = await api.renderItem(childId, childViewId, { onCycle });
          // data-item-id is set automatically by api.renderItem()
          childNode.setAttribute('data-parent-id', browser.id);
          resultsList.appendChild(childNode);
        } catch (err) {
          const errorNode = api.createElement('div', {
            style: 'padding: 12px; margin-bottom: 8px; color: var(--color-danger); border: 1px solid var(--color-danger); border-radius: var(--border-radius); background: var(--color-danger-light);'
          }, ['Error loading item: ' + childId]);
          resultsList.appendChild(errorNode);
        }
      }
    }
  };

  // Function to select a tag and update attachments
  const selectTag = async (tag) => {
    // Find all items with this tag in content.tags
    const taggedItems = allItems.filter(item =>
      item.content?.tags?.includes(tag.id)
    );

    // Store results as attachments and save selected tag
    const updated = {
      ...browser,
      attachments: taggedItems.map(item => ({ id: item.id })),
      content: {
        ...browser.content,
        selectedTag: tag.id
      }
    };

    await api.set(updated);

    // Update local reference and re-render results
    browser.attachments = updated.attachments;
    browser.content = updated.content;
    await renderResults();
  };

  // Function to render the tag tree
  const renderTree = () => {
    tagPickerUI.renderTagBrowser({
      container: treeContainer,
      tree: tree,
      expandedState: expandedState,
      onClick: selectTag,
      onExpand: () => renderTree()
    }, api);
  };

  // Initial render
  renderTree();

  container.appendChild(treeContainer);
  container.appendChild(resultsContainer);

  // Render existing results if there's a selected tag
  await renderResults();

  return container;
}
