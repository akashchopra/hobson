// Item: type-picker-lib
// ID: a1b2c3d4-type-pick-0000-000000000000
// Type: 66666666-0000-0000-0000-000000000000


/**
 * Shows a modal dialog for selecting an item type.
 * @param {Object} api - The Hobson API object
 * @returns {Promise<string|null>} - The selected type ID, or null if cancelled
 */
export async function showTypePicker(api) {
  return new Promise(async (resolve) => {
    const allItems = await api.getAll();
    const types = allItems.filter(i => i.type === api.IDS.TYPE_DEFINITION);

    const overlay = api.createElement('div', {
      style: 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;'
    }, []);

    const modal = api.createElement('div', {
      style: 'background: white; border-radius: 8px; padding: 24px; max-width: 500px; max-height: 600px; overflow: auto;'
    }, []);

    const title = api.createElement('h3', { style: 'margin-top: 0;' }, ['Select Item Type']);
    modal.appendChild(title);

    const typeList = api.createElement('div', {
      style: 'display: flex; flex-direction: column; gap: 8px;'
    }, []);

    for (const type of types) {
      const typeBtn = api.createElement('button', {
        style: 'padding: 12px; text-align: left; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer;',
        onclick: () => {
          document.body.removeChild(overlay);
          resolve(type.id);
        }
      }, []);

      const typeName = api.createElement('div', { style: 'font-weight: bold;' }, [type.name || type.id.slice(0, 8)]);
      typeBtn.appendChild(typeName);

      if (type.content?.description) {
        const typeDesc = api.createElement('div', { style: 'font-size: 12px; color: #666; margin-top: 4px;' }, [type.content.description]);
        typeBtn.appendChild(typeDesc);
      }

      typeList.appendChild(typeBtn);
    }

    modal.appendChild(typeList);

    const cancelBtn = api.createElement('button', {
      style: 'margin-top: 16px; padding: 8px 16px; cursor: pointer;',
      onclick: () => {
        document.body.removeChild(overlay);
        resolve(null);
      }
    }, ['Cancel']);
    modal.appendChild(cancelBtn);

    overlay.appendChild(modal);
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve(null);
      }
    };

    document.body.appendChild(overlay);
  });
}
