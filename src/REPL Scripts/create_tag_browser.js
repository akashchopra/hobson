// Script to create tag browser type and renderer
// Run this in the Hobson REPL

// First, create the tag_browser type
const tagBrowserTypeId = crypto.randomUUID();
await api.set({
  id: tagBrowserTypeId,
  name: 'tag_browser',
  type: api.IDS.TYPE_DEFINITION,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    description: 'A browser for navigating and filtering items by tags'
  }
});

console.log('✓ Created tag_browser type:', tagBrowserTypeId);

// Now create the tag_browser renderer
const tagBrowserRendererCode = `
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

  // Sort tags by name
  tags.sort((a, b) => {
    const nameA = (a.content.name || a.name || a.id).toLowerCase();
    const nameB = (b.content.name || b.name || b.id).toLowerCase();
    return nameA.localeCompare(nameB);
  });

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

  // Tag list
  const tagList = api.createElement('div', {
    style: 'display: flex; flex-direction: column; gap: 8px;'
  }, []);

  if (tags.length === 0) {
    const emptyMsg = api.createElement('div', {
      style: 'padding: 40px; text-align: center; color: #999; font-style: italic;'
    }, ['No tags found. Create tag items to get started.']);
    tagList.appendChild(emptyMsg);
  } else {
    // Render each tag as a clickable button
    tags.forEach(tag => {
      const tagName = tag.content.name || tag.name || tag.id;
      const tagColor = tag.content.color || '#3b82f6';

      const tagButton = api.createElement('div', {
        style: \`
          padding: 12px 16px;
          background: white;
          border: 2px solid \${tagColor};
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: center;
        \`,
        onclick: async () => {
          await showTaggedItems(tag);
        }
      }, []);

      // Tag name with colored indicator
      const tagNameEl = api.createElement('div', {
        style: 'display: flex; align-items: center; gap: 10px;'
      }, []);

      const colorDot = api.createElement('div', {
        style: \`
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: \${tagColor};
        \`
      }, []);
      tagNameEl.appendChild(colorDot);

      const nameText = api.createElement('span', {
        style: 'font-weight: 500; color: #333;'
      }, [tagName]);
      tagNameEl.appendChild(nameText);

      tagButton.appendChild(tagNameEl);

      // Tag ID (for reference)
      const tagId = api.createElement('span', {
        style: 'font-family: monospace; font-size: 11px; color: #999;'
      }, [tag.id.substring(0, 8) + '...']);
      tagButton.appendChild(tagId);

      // Hover effects
      tagButton.onmouseover = () => {
        tagButton.style.background = tagColor + '10';
        tagButton.style.transform = 'translateX(4px)';
      };
      tagButton.onmouseout = () => {
        tagButton.style.background = 'white';
        tagButton.style.transform = 'translateX(0)';
      };

      tagList.appendChild(tagButton);
    });
  }

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
    resultsTitle.textContent = \`Items tagged with "\${tagName}" (\${taggedItems.length})\`;

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
          style: \`
            padding: 12px;
            margin-bottom: 8px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
          \`,
          onclick: () => {
            api.openSibling(item.id);
          }
        }, []);

        const itemName = api.createElement('div', {
          style: 'font-weight: 500; color: #333; margin-bottom: 4px;'
        }, [item.name || item.content?.title || item.id]);
        itemDiv.appendChild(itemName);

        const itemMeta = api.createElement('div', {
          style: 'font-size: 12px; color: #999;'
        }, ['Type: ' + item.type.substring(0, 8) + '... | Modified: ' + new Date(item.modified).toLocaleDateString()]);
        itemDiv.appendChild(itemMeta);

        itemDiv.onmouseover = () => { itemDiv.style.background = '#f0f0f0'; };
        itemDiv.onmouseout = () => { itemDiv.style.background = 'white'; };

        resultsList.appendChild(itemDiv);
      });
    }

    // Show results container
    resultsContainer.style.display = 'block';
  };

  container.appendChild(tagList);
  container.appendChild(resultsContainer);

  return container;
}
`;

const tagBrowserRendererId = crypto.randomUUID();
await api.set({
  id: tagBrowserRendererId,
  name: 'tag_browser_renderer',
  type: api.IDS.RENDERER,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    for_type: tagBrowserTypeId,
    code: tagBrowserRendererCode
  }
});

console.log('✓ Created tag_browser_renderer:', tagBrowserRendererId);

// Now create a sample tag browser instance
const tagBrowserInstanceId = crypto.randomUUID();
await api.set({
  id: tagBrowserInstanceId,
  name: 'my_tag_browser',
  type: tagBrowserTypeId,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    title: 'Browse by Tag'
  }
});

console.log('✓ Created tag_browser instance:', tagBrowserInstanceId);
console.log('');
console.log('Summary:');
console.log('  Tag Browser Type:', tagBrowserTypeId);
console.log('  Tag Browser Renderer:', tagBrowserRendererId);
console.log('  Tag Browser Instance:', tagBrowserInstanceId);
console.log('');
console.log('To view it, navigate to:', tagBrowserInstanceId);
