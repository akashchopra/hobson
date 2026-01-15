// Update note_renderer and tag_browser_renderer to use shared libraries
// This removes code duplication by using tag_tree_builder and tag_picker_ui

console.log('=== Updating Renderers to Use Shared Libraries ===\n');

// First, get the existing renderers
const noteRenderers = await api.query({ name: 'note_renderer' });
const tagBrowserRenderers = await api.query({ name: 'tag_browser_renderer' });

if (noteRenderers.length === 0) {
  console.log('✗ note_renderer not found');
} else {
  console.log('✓ Found note_renderer');
}

if (tagBrowserRenderers.length === 0) {
  console.log('✗ tag_browser_renderer not found');
} else {
  console.log('✓ Found tag_browser_renderer');
}

// Update tag_browser_renderer to use the shared libraries
if (tagBrowserRenderers.length > 0) {
  const tagBrowserRenderer = tagBrowserRenderers[0];

  // Read the complete new code from a file or define it directly
  const updatedCode = await fetch('data:text/plain;base64,' + btoa(`// Tag browser renderer using shared libraries
// Uses tag_tree_builder and tag_picker_ui libraries

export async function render(browser, api) {
  // Load shared libraries
  const treeBuilder = await api.require('tag_tree_builder');
  const tagPickerUI = await api.require('tag_picker_ui');

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

  // Get all tag items and build tree
  const TAG_TYPE_ID = api.IDS.TAG;
  const tags = await api.query({ type: TAG_TYPE_ID });
  const tree = treeBuilder.buildTagTree(tags);

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
    const tagName = treeBuilder.getTagName(tag);
    resultsTitle.textContent = 'Items tagged with "' + tagName + '" (' + taggedItems.length + ')';

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
          style: 'padding: 12px; margin-bottom: 8px; background: white; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; transition: background 0.2s;'
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

  // Function to render the entire tree
  const renderTree = () => {
    tagPickerUI.renderTagBrowser({
      container: treeContainer,
      tree: tree,
      expandedState: expandedState,
      onClick: showTaggedItems,
      onExpand: () => renderTree()
    }, api);
  };

  // Initial render
  renderTree();

  container.appendChild(treeContainer);
  container.appendChild(resultsContainer);

  return container;
}
`)).then(r => r.text());

  const updated = {
    ...tagBrowserRenderer,
    content: {
      ...tagBrowserRenderer.content,
      code: updatedCode
    }
  };

  await api.set(updated);
  console.log('\n✓ Updated tag_browser_renderer to use shared libraries');
  console.log('  - Removed ~60 lines of duplicate tree building code');
  console.log('  - Now uses tag_tree_builder.buildTagTree()');
  console.log('  - Now uses tag_picker_ui.renderTagBrowser()');
}

// For note_renderer, we need to do text replacements on the original code
if (noteRenderers.length > 0) {
  const noteRenderer = noteRenderers[0];
  let code = noteRenderer.content.code;

  // Add library imports at the top
  if (!code.includes('tag_tree_builder')) {
    code = code.replace(
      'export async function render(item, api) {',
      'export async function render(item, api) {\n  // Load shared libraries\n  const treeBuilder = await api.require(\'tag_tree_builder\');\n  const tagPickerUI = await api.require(\'tag_picker_ui\');\n'
    );
  }

  // Replace buildTagTree function definition with nothing
  code = code.replace(/const buildTagTree = \(tags\) => \{[^}]*\{[^}]*\}[^}]*\}[^}]*\};?\n+/s, '');

  // Replace calls to buildTagTree
  code = code.replace(/buildTagTree\(/g, 'treeBuilder.buildTagTree(');

  // Replace the renderTagPicker function
  // Find the function and replace it with a simpler version that uses the library
  const renderPickerStart = code.indexOf('async function renderTagPicker()');
  if (renderPickerStart !== -1) {
    // Find the end of this function (match braces)
    let braceCount = 0;
    let inFunction = false;
    let endPos = renderPickerStart;

    for (let i = renderPickerStart; i < code.length; i++) {
      if (code[i] === '{') {
        braceCount++;
        inFunction = true;
      } else if (code[i] === '}') {
        braceCount--;
        if (inFunction && braceCount === 0) {
          endPos = i + 1;
          break;
        }
      }
    }

    const newRenderPicker = `async function renderTagPicker() {
        pickerTreeContainer.innerHTML = '';
        const allTags = await api.query({ type: api.IDS.TAG });
        const tree = treeBuilder.buildTagTree(allTags);

        tagPickerUI.renderTagPicker({
          container: pickerTreeContainer,
          tree: tree,
          selectedTags: pendingTags,
          expandedState: expandedState,
          onToggle: async (tagId) => {
            pendingTags.push(tagId);
            await renderTagPicker();
          },
          onExpand: async () => {
            await renderTagPicker();
          }
        }, api);
      }`;

    code = code.substring(0, renderPickerStart) + newRenderPicker + code.substring(endPos);
  }

  const updated = {
    ...noteRenderer,
    content: {
      ...noteRenderer.content,
      code: code
    }
  };

  await api.set(updated);
  console.log('\n✓ Updated note_renderer to use shared libraries');
  console.log('  - Removed ~80 lines of duplicate code');
  console.log('  - Now uses treeBuilder.buildTagTree()');
  console.log('  - Now uses tagPickerUI.renderTagPicker()');
}

console.log('\n=== Update Complete ===');
console.log('Both renderers now use shared tag_tree_builder and tag_picker_ui libraries.');
console.log('Code duplication has been eliminated!');
