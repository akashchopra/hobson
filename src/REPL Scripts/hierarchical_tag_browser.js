// Updated tag browser renderer with hierarchy support
// This replaces the existing tag_browser_renderer

export async function render(browser, api) {
  const container = api.createElement('div', {
    class: 'tag-browser-view',
    style: 'max-width: 600px; margin: 0 auto;'
  }, []);

  // Header
  const header = api.createElement('div', {
    style: 'margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0;'
  }, []);

  const title = api.createElement('h2', {
    style: 'margin: 0; font-size: 20px;'
  }, [browser.content.title || 'Tag Browser']);
  header.appendChild(title);

  container.appendChild(header);

  // Get all tag items
  const TAG_TYPE_ID = api.IDS.TAG;
  const tags = await api.query({ type: TAG_TYPE_ID });

  // Build tree structure
  const buildTree = (tags) => {
    // Create map of tags by ID for quick lookup
    const tagMap = new Map();
    tags.forEach(tag => tagMap.set(tag.id, { ...tag, children: [] }));

    // Separate root and child tags
    const roots = [];
    tags.forEach(tag => {
      const parent = tag.content.parent;
      if (!parent) {
        // Root tag
        roots.push(tagMap.get(tag.id));
      } else {
        // Child tag - add to parent's children
        const parentNode = tagMap.get(parent);
        if (parentNode) {
          parentNode.children.push(tagMap.get(tag.id));
        } else {
          // Parent not found - treat as root
          roots.push(tagMap.get(tag.id));
        }
      }
    });

    // Sort roots and children by name
    const sortByName = (a, b) => {
      const nameA = (a.content.name || a.name || a.id).toLowerCase();
      const nameB = (b.content.name || b.name || b.id).toLowerCase();
      return nameA.localeCompare(nameB);
    };

    roots.sort(sortByName);
    tagMap.forEach(node => node.children.sort(sortByName));

    return roots;
  };

  const tree = buildTree(tags);

  // Track expanded state (tag ID -> boolean)
  const expandedState = new Map();

  // Results container (for showing matched items)
  const resultsContainer = api.createElement('div', {
    style: 'margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 6px; display: none;'
  }, []);

  const resultsTitle = api.createElement('h3', {
    style: 'margin: 0 0 15px 0; font-size: 16px; color: #333;'
  }, []);
  resultsContainer.appendChild(resultsTitle);

  const resultsList = api.createElement('div', {
    style: 'max-height: 400px; overflow-y: auto;'
  }, []);
  resultsContainer.appendChild(resultsList);

  // Tag tree container
  const treeContainer = api.createElement('div', {
    style: 'display: flex; flex-direction: column;'
  }, []);

  // Function to render a tag node
  const renderTagNode = (tagNode, depth = 0) => {
    const nodeContainer = api.createElement('div', {
      style: 'display: flex; flex-direction: column;'
    }, []);

    const tagName = tagNode.content.name || tagNode.name || tagNode.id;
    const tagColor = tagNode.content.color || '#3b82f6';
    const hasChildren = tagNode.children.length > 0;
    const isExpanded = expandedState.get(tagNode.id) || false;

    // Tag row
    const tagRow = api.createElement('div', {
      style: `
        padding: 8px 12px;
        padding-left: ${depth * 20 + 12}px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        transition: background 0.2s;
        border-radius: 4px;
      `
    }, []);

    // Expand/collapse icon (if has children)
    if (hasChildren) {
      const expandIcon = api.createElement('span', {
        style: 'font-size: 12px; color: #666; user-select: none; width: 12px;'
      }, [isExpanded ? '▼' : '▶']);
      tagRow.appendChild(expandIcon);
    } else {
      // Spacer for leaf nodes
      const spacer = api.createElement('span', {
        style: 'width: 12px;'
      }, ['•']);
      tagRow.appendChild(spacer);
    }

    // Color dot
    const colorDot = api.createElement('div', {
      style: `
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: ${tagColor};
        flex-shrink: 0;
      `
    }, []);
    tagRow.appendChild(colorDot);

    // Tag name
    const nameText = api.createElement('span', {
      style: 'font-weight: 500; color: #333; flex-grow: 1;'
    }, [tagName]);
    tagRow.appendChild(nameText);

    // Tag ID (shortened)
    const tagId = api.createElement('span', {
      style: 'font-family: monospace; font-size: 11px; color: #999;'
    }, [tagNode.id.substring(0, 8) + '...']);
    tagRow.appendChild(tagId);

    // Click handler
    tagRow.onclick = async (e) => {
      e.stopPropagation();

      // If has children and clicked on left side, toggle expansion
      if (hasChildren && e.offsetX < depth * 20 + 40) {
        expandedState.set(tagNode.id, !isExpanded);
        renderTree();
      } else {
        // Show tagged items
        await showTaggedItems(tagNode);
      }
    };

    // Hover effects
    tagRow.onmouseover = () => {
      tagRow.style.background = tagColor + '10';
    };
    tagRow.onmouseout = () => {
      tagRow.style.background = 'transparent';
    };

    nodeContainer.appendChild(tagRow);

    // Render children if expanded
    if (hasChildren && isExpanded) {
      tagNode.children.forEach(child => {
        nodeContainer.appendChild(renderTagNode(child, depth + 1));
      });
    }

    return nodeContainer;
  };

  // Function to render the entire tree
  const renderTree = () => {
    treeContainer.innerHTML = '';

    if (tree.length === 0) {
      const emptyMsg = api.createElement('div', {
        style: 'padding: 40px; text-align: center; color: #999; font-style: italic;'
      }, ['No tags found. Create tag items to get started.']);
      treeContainer.appendChild(emptyMsg);
    } else {
      tree.forEach(rootNode => {
        treeContainer.appendChild(renderTagNode(rootNode, 0));
      });
    }
  };

  // Function to show items tagged with a specific tag
  const showTaggedItems = async (tag) => {
    console.log('Clicked tag:', tag);

    // Find all items with this tag
    const allItems = await api.getAll();
    const taggedItems = allItems.filter(item =>
      item.tags && item.tags.includes(tag.id)
    );

    console.log('Found tagged items:', taggedItems);

    // Update results title
    const tagName = tag.content.name || tag.name || tag.id;
    resultsTitle.textContent = `Items tagged with "${tagName}" (${taggedItems.length})`;

    // Clear and populate results list
    resultsList.innerHTML = '';

    if (taggedItems.length === 0) {
      const emptyMsg = api.createElement('div', {
        style: 'padding: 20px; text-align: center; color: #999; font-style: italic;'
      }, ['No items found with this tag.']);
      resultsList.appendChild(emptyMsg);
    } else {
      taggedItems.forEach(item => {
        const itemDiv = api.createElement('div', {
          style: `
            padding: 12px;
            margin-bottom: 8px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
          `
        }, []);

        const itemName = api.createElement('div', {
          style: 'font-weight: 500; color: #333; margin-bottom: 4px;'
        }, [item.name || item.content?.title || item.id]);
        itemDiv.appendChild(itemName);

        const itemMeta = api.createElement('div', {
          style: 'font-size: 12px; color: #999;'
        }, ['Type: ' + item.type.substring(0, 8) + '... | Modified: ' + new Date(item.modified).toLocaleDateString()]);
        itemDiv.appendChild(itemMeta);

        itemDiv.onclick = () => {
          api.openSibling(item.id);
        };

        itemDiv.onmouseover = () => { itemDiv.style.background = '#f0f0f0'; };
        itemDiv.onmouseout = () => { itemDiv.style.background = 'white'; };

        resultsList.appendChild(itemDiv);
      });
    }

    // Show results container
    resultsContainer.style.display = 'block';
  };

  // Initial render
  renderTree();

  container.appendChild(treeContainer);
  container.appendChild(resultsContainer);

  return container;
}
