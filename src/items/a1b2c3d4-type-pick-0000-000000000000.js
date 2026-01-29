// Item: type-picker-lib
// ID: a1b2c3d4-type-pick-0000-000000000000
// Type: 66666666-0000-0000-0000-000000000000


/**
 * Shows a modal dialog for selecting an item type.
 * @param {Object} api - The Hobson API object
 * @returns {Promise<string|null>} - The selected type ID, or null if cancelled
 */
export async function showTypePicker(api) {
  const modalLib = await api.require('modal-lib');

  const allItems = await api.getAll();
  const types = allItems.filter(i => i.type === api.IDS.TYPE_DEFINITION);

  return new Promise((resolve) => {
    const { close } = modalLib.showModal({
      title: 'Select Item Type',
      width: '500px',
      maxHeight: '600px',
      api,
      onClose: () => resolve(null),
      content: ({ close: closeModal }) => {
        const typeList = api.createElement('div', {
          style: 'display: flex; flex-direction: column; gap: 8px;'
        }, []);

        for (const type of types) {
          const typeBtn = api.createElement('button', {
            style: 'padding: 12px; text-align: left; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer;',
            onclick: () => {
              resolve(type.id);
              closeModal();
            }
          }, []);

          // Hover effect
          typeBtn.onmouseover = () => { typeBtn.style.background = '#f5f5f5'; };
          typeBtn.onmouseout = () => { typeBtn.style.background = 'white'; };

          const typeName = api.createElement('div', { style: 'font-weight: bold;' }, [type.name || type.id.slice(0, 8)]);
          typeBtn.appendChild(typeName);

          if (type.content?.description) {
            const typeDesc = api.createElement('div', { style: 'font-size: 12px; color: #666; margin-top: 4px;' }, [type.content.description]);
            typeBtn.appendChild(typeDesc);
          }

          typeList.appendChild(typeBtn);
        }

        return typeList;
      }
    });
  });
}
