
/**
 * Shows a modal dialog for selecting an item type.
 * @param {Object} api - The Hobson API object
 * @returns {Promise<string|null>} - The selected type ID, or null if cancelled
 */
export async function showTypePicker(api) {
  const modalLib = await api.require('modal-lib');

  const allItems = await api.getAll();
  allItems.sort((a,b) => (a.name || a.id).localeCompare(b.name || b.id));
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
            style: 'padding: 12px; text-align: left; border: 1px solid var(--color-border-light); border-radius: var(--border-radius); background: var(--color-bg-surface); cursor: pointer;',
            onclick: () => {
              resolve(type.id);
              closeModal();
            }
          }, []);

          // Hover effect
          typeBtn.onmouseover = () => { typeBtn.style.background = 'var(--color-bg-body)'; };
          typeBtn.onmouseout = () => { typeBtn.style.background = 'white'; };

          const typeName = api.createElement('div', { style: 'font-weight: bold;' }, [type.name || type.id.slice(0, 8)]);
          typeBtn.appendChild(typeName);

          if (type.content?.description) {
            const typeDesc = api.createElement('div', { style: 'font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 4px;' }, [type.content.description.slice(0, 300)]);
            typeBtn.appendChild(typeDesc);
          }

          typeList.appendChild(typeBtn);
        }

        return typeList;
      }
    });
  });
}
