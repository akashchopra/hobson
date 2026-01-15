// REPL Script: Fix viewport_renderer Home button
// The Home button referenced IDS.WORKSPACE which no longer exists.
// This updates it to use "All Items" instead.

const renderers = await api.query({ type: api.IDS.RENDERER });
const viewportRenderer = renderers.find(r => r.name === "viewport_renderer");

if (!viewportRenderer) {
  console.error("viewport_renderer not found!");
} else {
  let code = viewportRenderer.content.code;

  // Replace the Home button with All Items button
  const oldCode = `// Home button
  const homeBtn = api.createElement('button', {
    style: 'padding: 4px 12px; cursor: pointer;',
    onclick: async () => await api.navigate(api.IDS.WORKSPACE)
  }, ['Home']);
  navBar.appendChild(homeBtn);`;

  const newCode = `// All Items button (replaces Home since there's no predefined workspace)
  const allItemsBtn = api.createElement('button', {
    style: 'padding: 4px 12px; cursor: pointer;',
    onclick: async () => await api.showItemList()
  }, ['All Items']);
  navBar.appendChild(allItemsBtn);`;

  if (code.includes("api.IDS.WORKSPACE")) {
    code = code.replace(oldCode, newCode);

    const updated = {
      ...viewportRenderer,
      content: {
        ...viewportRenderer.content,
        code: code
      },
      modified: Date.now()
    };

    await kernel.storage.set(updated, kernel);
    console.log("viewport_renderer updated successfully!");
    console.log("Home button replaced with All Items button.");
  } else {
    console.log("viewport_renderer already updated or doesn't have WORKSPACE reference.");
  }
}
