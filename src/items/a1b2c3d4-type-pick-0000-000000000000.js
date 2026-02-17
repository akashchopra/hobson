
/**
 * Shows a searchable modal dialog for selecting an item type.
 * @param {Object} api - The Hobson API object
 * @returns {Promise<string|null>} - The selected type ID, or null if cancelled
 */
export async function showTypePicker(api) {
  const modalLib = await api.require('modal-lib');

  const allItems = await api.getAll();
  const types = allItems
    .filter(i => i.type === api.IDS.TYPE_DEFINITION)
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

  return new Promise((resolve) => {
    const container = api.createElement('div', {}, []);

    const { close } = modalLib.showModal({
      title: 'Select Item Type',
      width: '500px',
      maxHeight: '80vh',
      api,
      onClose: () => resolve(null),
      content: container
    });

    // Search input
    const input = api.createElement('input', {
      type: 'text',
      placeholder: 'Filter types...',
      style: 'width: 100%; padding: 12px 16px; font-size: 1rem; border: 2px solid var(--color-border); border-radius: var(--border-radius); outline: none; box-sizing: border-box; transition: border-color 0.2s; margin-bottom: 12px;'
    }, []);
    input.onfocus = () => { input.style.borderColor = 'var(--color-primary)'; };
    input.onblur = () => { input.style.borderColor = 'var(--color-border)'; };
    container.appendChild(input);

    // Results list
    const resultsList = api.createElement('div', {
      style: 'max-height: 50vh; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;'
    }, []);
    container.appendChild(resultsList);

    let highlightIndex = 0;
    let currentFiltered = types;
    let buttons = [];

    const updateHighlight = () => {
      buttons.forEach((btn, i) => {
        if (i === highlightIndex) {
          btn.style.background = 'var(--color-bg-surface-alt)';
          btn.style.borderColor = 'var(--color-primary)';
          btn.scrollIntoView({ block: 'nearest' });
        } else {
          btn.style.background = 'var(--color-bg-surface)';
          btn.style.borderColor = 'var(--color-border-light)';
        }
      });
    };

    const selectType = (type) => {
      resolve(type.id);
      close();
    };

    const renderTypes = (filtered) => {
      currentFiltered = filtered;
      highlightIndex = 0;
      buttons = [];
      resultsList.innerHTML = '';

      if (filtered.length === 0) {
        const noMatch = api.createElement('div', {
          style: 'padding: 40px; text-align: center; color: var(--color-text-secondary); font-style: italic;'
        }, ['No matching types']);
        resultsList.appendChild(noMatch);
        return;
      }

      for (const type of filtered) {
        const btn = api.createElement('div', {
          style: 'padding: 10px 12px; border: 1px solid var(--color-border-light); border-radius: var(--border-radius); background: var(--color-bg-surface); cursor: pointer; transition: all 0.15s;'
        }, []);
        btn.onclick = () => selectType(type);
        btn.onmouseover = () => {
          highlightIndex = buttons.indexOf(btn);
          updateHighlight();
        };

        const name = api.createElement('div', {
          style: 'font-weight: 500; font-size: 0.9375rem;'
        }, [type.name || type.id.slice(0, 8)]);
        btn.appendChild(name);

        if (type.content?.description) {
          const desc = api.createElement('div', {
            style: 'font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;'
          }, [type.content.description.slice(0, 200)]);
          btn.appendChild(desc);
        }

        resultsList.appendChild(btn);
        buttons.push(btn);
      }

      updateHighlight();
    };

    input.oninput = () => {
      const q = input.value.toLowerCase().trim();
      if (!q) {
        renderTypes(types);
        return;
      }
      renderTypes(types.filter(t => {
        const name = (t.name || '').toLowerCase();
        const desc = (t.content?.description || '').toLowerCase();
        return name.includes(q) || desc.includes(q);
      }));
    };

    input.onkeydown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentFiltered.length > 0) {
          highlightIndex = (highlightIndex + 1) % currentFiltered.length;
          updateHighlight();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentFiltered.length > 0) {
          highlightIndex = (highlightIndex - 1 + currentFiltered.length) % currentFiltered.length;
          updateHighlight();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentFiltered.length > 0) {
          selectType(currentFiltered[highlightIndex]);
        }
      }
    };

    // Show all types initially
    renderTypes(types);

    // Focus input after modal is in DOM
    setTimeout(() => input.focus(), 0);
  });
}
