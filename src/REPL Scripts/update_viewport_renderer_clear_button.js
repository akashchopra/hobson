// REPL Script: Add Clear View button to viewport_renderer

const renderers = await api.query({ type: api.IDS.RENDERER });
const viewportRenderer = renderers.find(r => r.name === "viewport_renderer");

if (!viewportRenderer) {
  console.error("viewport_renderer not found!");
} else {
  let code = viewportRenderer.content.code;

  // Check if already has Clear View button
  if (code.includes("Clear View")) {
    console.log("viewport_renderer already has Clear View button.");
  } else {
    // Find the All Items button section and add Clear View after it
    const oldSection = `// All Items button (replaces Home since there's no predefined workspace)
  const allItemsBtn = api.createElement('button', {
    style: 'padding: 4px 12px; cursor: pointer;',
    onclick: async () => await api.showItemList()
  }, ['All Items']);
  navBar.appendChild(allItemsBtn);`;

    const newSection = `// All Items button
  const allItemsBtn = api.createElement('button', {
    style: 'padding: 4px 12px; cursor: pointer;',
    onclick: async () => await api.showItemList()
  }, ['All Items']);
  navBar.appendChild(allItemsBtn);

  // Clear View button - returns to empty viewport state
  if (rootId) {
    const clearBtn = api.createElement('button', {
      style: 'padding: 4px 12px; cursor: pointer;',
      onclick: async () => {
        // Clear the viewport's root and re-render
        const vp = await api.get(api.IDS.VIEWPORT);
        vp.children = [];
        vp.modified = Date.now();
        await api.set(vp);
        // Navigate to trigger re-render with empty viewport
        window.location.search = '';
      }
    }, ['Clear View']);
    navBar.appendChild(clearBtn);
  }`;

    if (code.includes(oldSection)) {
      code = code.replace(oldSection, newSection);
    } else {
      // Try simpler replacement - just add after allItemsBtn
      const simpleOld = `navBar.appendChild(allItemsBtn);

  // Current item info`;
      const simpleNew = `navBar.appendChild(allItemsBtn);

  // Clear View button - returns to empty viewport state
  if (rootId) {
    const clearBtn = api.createElement('button', {
      style: 'padding: 4px 12px; cursor: pointer;',
      onclick: async () => {
        const vp = await api.get(api.IDS.VIEWPORT);
        vp.children = [];
        vp.modified = Date.now();
        await api.set(vp);
        window.location.search = '';
      }
    }, ['Clear View']);
    navBar.appendChild(clearBtn);
  }

  // Current item info`;

      if (code.includes(simpleOld)) {
        code = code.replace(simpleOld, simpleNew);
      } else {
        console.error("Could not find insertion point in viewport_renderer code.");
        console.log("You may need to delete viewport_renderer and run create_viewport_renderer.js fresh.");
        throw new Error("Update failed");
      }
    }

    const updated = {
      ...viewportRenderer,
      content: {
        ...viewportRenderer.content,
        code: code
      },
      modified: Date.now()
    };

    await kernel.storage.set(updated, kernel);
    console.log("viewport_renderer updated with Clear View button!");
    console.log("Refresh the page to see the change.");
  }
}
