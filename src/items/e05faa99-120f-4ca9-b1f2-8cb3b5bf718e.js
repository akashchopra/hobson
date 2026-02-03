// Item: tag-picker-ui
// ID: e05faa99-120f-4ca9-b1f2-8cb3b5bf718e
// Type: 66666666-0000-0000-0000-000000000000

// Tag Picker UI Library
// Shared component for rendering hierarchical tag picker
// See [tag-picker-ui documentation](item://e05faa99-120f-4ca9-b1f2-8cb3b5bf718e)

// [BEGIN:renderTagPicker]
/**
 * Renders a hierarchical tag picker tree
 * @param {Object} config - Configuration object
 * @param {HTMLElement} config.container - Container element to render into
 * @param {Array} config.tree - Tree structure (from buildTagTree)
 * @param {Array} config.selectedTags - Array of selected tag IDs
 * @param {Map} config.expandedState - Map tracking expanded/collapsed state
 * @param {Function} config.onToggle - Callback when tag is selected/deselected (tagId)
 * @param {Function} config.onExpand - Callback when node is expanded/collapsed (tagId, isExpanded)
 * @param {Object} api - Hobson API
 */
export function renderTagPicker(config, api) {
  const { container, tree, selectedTags, expandedState, onToggle, onExpand } = config;

  container.innerHTML = '';

  if (tree.length === 0) {
    const emptyMsg = api.createElement('div', {
      style: 'padding: 20px; text-align: center; color: var(--color-border-dark); font-style: italic;'
    }, ['No tags available. Create tag items first.']);
    container.appendChild(emptyMsg);
    return;
  }

  /**
   * Renders a single tag node and its children
   */
  const renderTagNode = (tagNode, depth = 0) => {
    const nodeContainer = api.createElement('div', {
      style: 'display: flex; flex-direction: column;'
    }, []);

    const tagName = tagNode.content.name || tagNode.name || tagNode.id;
    const tagColor = tagNode.content.color || '#3b82f6';
    const hasChildren = tagNode.children.length > 0;
    const isExpanded = expandedState.get(tagNode.id) || false;
    const isSelected = selectedTags.includes(tagNode.id);

    // Tag row
    const tagRow = api.createElement('div', {
      style: `
        padding: 6px 8px;
        padding-left: ${depth * 20 + 8}px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        border-radius: var(--border-radius);
        transition: background 0.2s;
        ${isSelected ? 'opacity: 0.5;' : ''}
      `
    }, []);

    // Expand/collapse icon (if has children)
    if (hasChildren) {
      const expandIcon = api.createElement('span', {
        style: 'font-size: 10px; color: var(--color-text-secondary); width: 10px;'
      }, [isExpanded ? '▼' : '▶']);
      tagRow.appendChild(expandIcon);
    } else {
      // Spacer for leaf nodes
      const spacer = api.createElement('span', {
        style: 'width: 10px;'
      }, ['•']);
      tagRow.appendChild(spacer);
    }

    // Color dot
    const colorDot = api.createElement('div', {
      style: `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${tagColor};
        flex-shrink: 0;
      `
    }, []);
    tagRow.appendChild(colorDot);

    // Tag name
    const nameText = api.createElement('span', {
      style: 'font-size: 13px; color: var(--color-text); flex-grow: 1;'
    }, [tagName]);
    tagRow.appendChild(nameText);

    // Click handler
    tagRow.onclick = (e) => {
      e.stopPropagation();

      if (hasChildren && e.offsetX < depth * 20 + 30) {
        // Clicked on expand/collapse icon
        const newExpandedState = !isExpanded;
        expandedState.set(tagNode.id, newExpandedState);
        if (onExpand) {
          onExpand(tagNode.id, newExpandedState);
        }
      } else if (!isSelected && onToggle) {
        // Clicked on tag itself (and not already selected)
        onToggle(tagNode.id);
      }
    };

    // Hover effect (only if not selected)
    if (!isSelected) {
      tagRow.onmouseover = () => {
        tagRow.style.background = tagColor + '10';
      };
      tagRow.onmouseout = () => {
        tagRow.style.background = 'transparent';
      };
    }

    nodeContainer.appendChild(tagRow);

    // Render children if expanded
    if (hasChildren && isExpanded) {
      tagNode.children.forEach(child => {
        nodeContainer.appendChild(renderTagNode(child, depth + 1));
      });
    }

    return nodeContainer;
  };

  // Render all root nodes
  tree.forEach(rootNode => {
    container.appendChild(renderTagNode(rootNode, 0));
  });
}
// [END:renderTagPicker]

// [BEGIN:renderTagBrowser]
/**
 * Renders a simple tag browser tree (for browsing/viewing, not picking)
 * @param {Object} config - Configuration object
 * @param {HTMLElement} config.container - Container element
 * @param {Array} config.tree - Tree structure
 * @param {Map} config.expandedState - Expanded state map
 * @param {Function} config.onClick - Callback when tag is clicked (tagNode)
 * @param {Function} config.onExpand - Callback when expanded/collapsed (tagId, isExpanded)
 * @param {Object} api - Hobson API
 */
export function renderTagBrowser(config, api) {
  const { container, tree, expandedState, onClick, onExpand } = config;

  container.innerHTML = '';

  if (tree.length === 0) {
    const emptyMsg = api.createElement('div', {
      style: 'padding: 40px; text-align: center; color: var(--color-border-dark); font-style: italic;'
    }, ['No tags found. Create tag items to get started.']);
    container.appendChild(emptyMsg);
    return;
  }

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
        border-radius: var(--border-radius);
      `
    }, []);

    // Expand/collapse icon (if has children)
    if (hasChildren) {
      const expandIcon = api.createElement('span', {
        style: 'font-size: 12px; color: var(--color-text-secondary); user-select: none; width: 12px;'
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
      style: 'font-weight: 500; color: var(--color-text); flex-grow: 1;'
    }, [tagName]);
    tagRow.appendChild(nameText);

    // Tag ID (shortened)
    const tagId = api.createElement('span', {
      style: 'font-family: monospace; font-size: 11px; color: var(--color-border-dark);'
    }, [tagNode.id.substring(0, 8) + '...']);
    tagRow.appendChild(tagId);

    // Click handler
    tagRow.onclick = (e) => {
      e.stopPropagation();

      // If has children and clicked on left side, toggle expansion
      if (hasChildren && e.offsetX < depth * 20 + 40) {
        const newExpandedState = !isExpanded;
        expandedState.set(tagNode.id, newExpandedState);
        if (onExpand) {
          onExpand(tagNode.id, newExpandedState);
        }
      } else if (onClick) {
        // Show tagged items
        onClick(tagNode);
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

  tree.forEach(rootNode => {
    container.appendChild(renderTagNode(rootNode, 0));
  });
}
// [END:renderTagBrowser]
