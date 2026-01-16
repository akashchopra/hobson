// REPL Script: Add "Edit..." and "Edit With..." to viewport_renderer context menu

const renderers = await api.query({ type: api.IDS.RENDERER });
const viewportRenderer = renderers.find(r => r.name === "viewport_renderer");

if (!viewportRenderer) {
  console.error("viewport_renderer not found!");
} else {
  let code = viewportRenderer.content.code;

  // Check if already has Edit menu
  if (code.includes("Edit With...")) {
    console.log("viewport_renderer already has Edit menu.");
  } else {
    // Find the separator after Display As submenu and add Edit menu
    const oldSection = `    displayAsItem.appendChild(displayAsSubmenu);
    contextMenu.appendChild(displayAsItem);

    // Separator
    const separator = api.createElement('div', { class: 'context-menu-separator' }, []);
    contextMenu.appendChild(separator);

    // Edit Raw JSON`;

    const newSection = `    displayAsItem.appendChild(displayAsSubmenu);
    contextMenu.appendChild(displayAsItem);

    // "Edit With..." submenu (parallel to Display As)
    const editWithItem = api.createElement('div', {
      class: 'context-menu-item context-menu-submenu'
    }, ['Edit With...']);

    const editWithSubmenu = api.createElement('div', {
      class: 'context-menu-submenu-items'
    }, []);

    // Get available editors
    const editors = await api.getEditors(menuItem.type);

    if (editors.length === 0) {
      const noEditors = api.createElement('div', {
        class: 'context-menu-item disabled'
      }, ['(No editors available)']);
      editWithSubmenu.appendChild(noEditors);
    } else {
      for (const { editor, forType, inherited } of editors) {
        const editorOption = api.createElement('div', {
          class: 'context-menu-item'
        }, []);

        let label = editor.name || editor.id.slice(0, 8);
        if (inherited) {
          const typeItem = await api.get(forType);
          label += ' (from ' + (typeItem?.name || forType.slice(0, 8)) + ')';
        }
        editorOption.textContent = label;

        editorOption.onclick = async () => {
          hideContextMenu();
          await api.editItem(itemId, editor.id);
        };
        editWithSubmenu.appendChild(editorOption);
      }
    }

    editWithItem.appendChild(editWithSubmenu);
    contextMenu.appendChild(editWithItem);

    // Separator
    const separator = api.createElement('div', { class: 'context-menu-separator' }, []);
    contextMenu.appendChild(separator);

    // Edit Raw JSON`;

    if (code.includes(oldSection)) {
      code = code.replace(oldSection, newSection);
    } else {
      console.error("Could not find insertion point for Edit menu.");
      console.log("You may need to manually update viewport_renderer or recreate it.");
      throw new Error("Update failed - pattern not found");
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
    console.log("viewport_renderer updated with 'Edit With...' menu!");
    console.log("Refresh the page to see the change.");
  }
}
