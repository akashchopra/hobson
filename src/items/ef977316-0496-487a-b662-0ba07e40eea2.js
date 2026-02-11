// App Page View - renders app-page items as a CSS grid with shared widget state

// [BEGIN:render]
export async function render(pageItem, api) {
  // --- Page State (runtime only, not persisted) ---
  const pageState = {};
  const stateListeners = {};  // key -> [callback]

  const pageContext = {
    getState(key) {
      return pageState[key];
    },
    setState(key, value) {
      pageState[key] = value;
      (stateListeners[key] || []).forEach(cb => {
        try { cb(value); } catch (e) { window.kernel?.captureError(e, { operation: 'app-page-state-listener', key }); }
      });
    },
    onStateChange(key, callback) {
      if (!stateListeners[key]) stateListeners[key] = [];
      stateListeners[key].push(callback);
      return () => {
        const arr = stateListeners[key];
        if (arr) {
          const idx = arr.indexOf(callback);
          if (idx >= 0) arr.splice(idx, 1);
        }
      };
    }
  };

  // --- Grid Container ---
  const columns = pageItem.content?.columns || 12;
  const gap = pageItem.content?.gap || 8;

  const grid = api.createElement('div', {
    style: `
      display: grid;
      grid-template-columns: repeat(${columns}, 1fr);
      gap: ${gap}px;
      padding: 16px;
      max-width: 960px;
      width: 100%;
      align-content: start;
    `
  });

  // --- Render Each Child Widget ---
  const children = pageItem.attachments || [];

  for (const childSpec of children) {
    const childId = typeof childSpec === 'string' ? childSpec : childSpec.id;
    const viewConfig = (typeof childSpec === 'object' ? childSpec.view : null) || {};

    try {
      // Load child item
      const childItem = await api.get(childId);

      // Resolve view through preference hierarchy
      const viewItem = await api.getEffectiveView(childId);
      if (!viewItem) {
        console.warn('App page: no view for child', childId);
        continue;
      }

      // Load view module
      const viewModule = await api.require(viewItem.id);

      // Create augmented API with page context
      const widgetApi = Object.create(api);
      widgetApi.pageContext = pageContext;

      // Render the widget
      let widgetElement;
      try {
        widgetElement = await viewModule.render(childItem, widgetApi);
      } catch (err) {
        window.kernel?.captureError(err, { operation: 'app-page-widget-render', itemId: childId, itemName: childItem.name });
        widgetElement = api.createElement('div', {
          style: 'color: var(--color-danger, #e74c3c); padding: 8px; border: 1px solid var(--color-danger, #e74c3c); border-radius: var(--border-radius, 4px); font-size: 13px;'
        });
        widgetElement.textContent = `Error rendering ${childItem.name || childId}: ${err.message}`;
      }

      // Wrap in grid cell with positioning
      const col = viewConfig.col || 1;
      const row = viewConfig.row || 'auto';
      const colSpan = viewConfig.colSpan || columns;
      const rowSpan = viewConfig.rowSpan || 1;

      const cell = api.createElement('div', {
        style: `
          grid-column: ${col} / span ${colSpan};
          ${row !== 'auto' ? `grid-row: ${row} / span ${rowSpan};` : ''}
          min-width: 0;
        `,
        'data-item-id': childId
      });

      cell.appendChild(widgetElement);
      grid.appendChild(cell);
    } catch (err) {
      window.kernel?.captureError(err, { operation: 'app-page-load-child', itemId: childId });
      const errorCell = api.createElement('div', {
        style: 'color: var(--color-danger, #e74c3c); padding: 8px; font-size: 13px;'
      });
      errorCell.textContent = `Failed to load widget ${childId}: ${err.message}`;
      grid.appendChild(errorCell);
    }
  }

  // --- Outer wrapper ---
  const wrapper = api.createElement('div', {
    style: 'display: flex; justify-content: center; height: 100%; overflow-y: auto;'
  });
  wrapper.appendChild(grid);

  return wrapper;
}
// [END:render]
