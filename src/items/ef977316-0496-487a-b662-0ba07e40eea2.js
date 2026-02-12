// App Page View - renders app-page items as a CSS grid with shared widget state
// Supports design mode toggle for visual layout editing

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

  // --- Design mode state (runtime only) ---
  let designMode = false;

  // --- Outer wrapper (stable across re-renders) ---
  const wrapper = api.createElement('div', {
    style: 'display: flex; flex-direction: column; align-items: center; height: 100%; overflow-y: auto;'
  });

  // --- Render function (called on initial + after design operations) ---
  async function renderPage() {
    wrapper.innerHTML = '';

    // Always fresh-read so design mode changes are visible in live mode
    const currentPageItem = await api.get(pageItem.id);

    const columns = currentPageItem.content?.columns || 12;
    const gap = currentPageItem.content?.gap || 8;
    const rowHeight = currentPageItem.content?.rowHeight || 40;

    // --- Design toolbar ---
    if (designMode) {
      let designLib;
      try {
        designLib = await api.require('app-page-design-lib');
      } catch (err) {
        window.kernel?.captureError(err, { operation: 'app-page-load-design-lib' });
        const errEl = api.createElement('div', {
          style: 'color: var(--color-danger); padding: 8px; font-size: 13px;'
        });
        errEl.textContent = 'Failed to load design library: ' + err.message;
        wrapper.appendChild(errEl);
        return;
      }

      const toolbar = designLib.renderToolbar(currentPageItem, api, {
        onToggle: () => {
          designMode = false;
          renderPage();
        },
        onAddWidget: async () => {
          const NOTE_TYPE = '871ae771-b9b1-4f40-8c7f-d9038bfb69c3';
          const NOTE_WIDGET_VIEW = 'b7f3a1d2-8e5c-4f6a-9d0b-1c2e3f4a5b6c';

          const result = await designLib.showWidgetPicker(api);
          if (!result) return;

          let childId, typeName;

          if (result.mode === 'create') {
            // Create new widget item
            const newId = crypto.randomUUID();
            const typeDef = await api.get(result.typeId);
            const newItem = {
              id: newId,
              name: (typeDef.name || 'widget') + '-' + newId.slice(0, 4),
              type: result.typeId,
              created: Date.now(),
              modified: Date.now(),
              content: {},
              attachments: []
            };
            await api.set(newItem);
            childId = newId;
            typeName = (typeDef.name || '').toLowerCase();
          } else {
            // Attach existing — no item creation
            childId = result.item.id;
            const typeDef = await api.get(result.item.type).catch(() => null);
            typeName = (typeDef?.name || '').toLowerCase();
          }

          // Add to page attachments
          const freshPage = await api.get(pageItem.id);
          const children = freshPage.attachments || [];
          // Calculate next row
          let maxRow = 0;
          for (const child of children) {
            const cv = (typeof child === 'object' ? child.view : null) || {};
            const r = cv.row || 0;
            const rs = cv.rowSpan || 1;
            if (r + rs > maxRow) maxRow = r + rs;
          }
          const nextRow = maxRow > 0 ? maxRow : children.length + 1;

          // Default rowSpan heuristic
          let defaultRowSpan = 2;
          if (typeName.includes('button')) defaultRowSpan = 1;
          else if (typeName.includes('markdown') || typeName === 'note') defaultRowSpan = 4;

          // Build attachment spec
          const spec = {
            id: childId,
            view: { col: 1, row: nextRow, colSpan: columns, rowSpan: defaultRowSpan }
          };

          // For notes, use note-widget-view via viewId override
          if (result.mode === 'attach' && result.item.type === NOTE_TYPE) {
            spec.view.viewId = NOTE_WIDGET_VIEW;
          }

          children.push(spec);
          await api.updateSilent({ ...freshPage, attachments: children, modified: Date.now() });
          renderPage();
        }
      });
      wrapper.appendChild(toolbar);
    }

    // --- Live mode toggle button (small, unobtrusive) ---
    if (!designMode) {
      const liveToolbar = api.createElement('div', {
        style: `
          display: flex; justify-content: flex-end; padding: 4px 16px;
          max-width: 960px; width: 100%; box-sizing: border-box;
        `
      });
      const designBtn = api.createElement('button', {
        style: `
          padding: 2px 8px; cursor: pointer; border: 1px solid var(--color-border, #444);
          background: transparent; color: var(--color-text-secondary, #888);
          border-radius: var(--border-radius, 4px); font-size: 11px; opacity: 0.6;
        `,
        title: 'Enter design mode'
      });
      designBtn.textContent = 'Design';
      designBtn.onmouseenter = () => { designBtn.style.opacity = '1'; };
      designBtn.onmouseleave = () => { designBtn.style.opacity = '0.6'; };
      designBtn.onclick = () => {
        designMode = true;
        renderPage();
      };
      liveToolbar.appendChild(designBtn);
      wrapper.appendChild(liveToolbar);
    }

    // --- Grid Container ---
    const grid = api.createElement('div', {
      style: `
        display: grid;
        grid-template-columns: repeat(${columns}, 1fr);
        grid-auto-rows: ${rowHeight}px;
        column-gap: ${gap}px;
        row-gap: 0;
        padding: 16px;
        max-width: 960px;
        width: 100%;
        align-content: start;
        ${designMode ? 'position: relative;' : ''}
      `
    });

    // --- Column overlay in design mode ---
    if (designMode) {
      try {
        const designLib = await api.require('app-page-design-lib');
        const overlay = designLib.renderColumnOverlay(grid, columns);
        grid.appendChild(overlay);
      } catch (_) { /* overlay is non-essential */ }
    }

    // --- Render Each Child Widget ---
    const children = currentPageItem.attachments || [];

    for (const childSpec of children) {
      const childId = typeof childSpec === 'string' ? childSpec : childSpec.id;
      const viewConfig = (typeof childSpec === 'object' ? childSpec.view : null) || {};

      try {
        // Load child item
        const childItem = await api.get(childId);

        // Resolve view — use per-attachment override if specified, else preference hierarchy
        let viewItem;
        if (viewConfig.viewId) {
          try {
            viewItem = await api.get(viewConfig.viewId);
          } catch (_) { /* fall through to default resolution */ }
        }
        if (!viewItem) {
          viewItem = await api.getEffectiveView(childId);
        }
        if (!viewItem) {
          console.warn('App page: no view for child', childId);
          continue;
        }

        // Load view module
        const viewModule = await api.require(viewItem.id);

        // Create augmented API with page context and correct view ID
        const widgetApi = Object.create(api);
        widgetApi.pageContext = pageContext;
        widgetApi.getViewId = () => viewItem.id;

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

        if (designMode) {
          // Wrap widget with design overlay
          const designLib = await api.require('app-page-design-lib');
          const designCell = designLib.wrapWidgetForDesign(widgetElement, childSpec, childItem, currentPageItem, api, {
            onSelect: (id) => { /* selection state is visual-only for now */ },
            onMove: async (id, { col, row }) => {
              const freshPage = await api.get(pageItem.id);
              const freshChildren = freshPage.attachments || [];
              const updated = freshChildren.map(c => {
                if ((typeof c === 'string' ? c : c.id) === id) {
                  return { ...(typeof c === 'object' ? c : { id: c }), view: { ...(c.view || {}), col, row } };
                }
                return c;
              });
              await api.updateSilent({ ...freshPage, attachments: updated, modified: Date.now() });
              renderPage();
            },
            onResize: async (id, { colSpan, rowSpan }) => {
              const freshPage = await api.get(pageItem.id);
              const freshChildren = freshPage.attachments || [];
              const updated = freshChildren.map(c => {
                if ((typeof c === 'string' ? c : c.id) === id) {
                  return { ...(typeof c === 'object' ? c : { id: c }), view: { ...(c.view || {}), colSpan, rowSpan } };
                }
                return c;
              });
              await api.updateSilent({ ...freshPage, attachments: updated, modified: Date.now() });
              renderPage();
            },
            onDelete: async (id) => {
              const modalLib = await api.require('modal-lib');
              const widgetName = childItem.name || id.slice(0, 8);

              const action = await new Promise((resolve) => {
                let resolved = false;
                modalLib.showModal({
                  title: 'Remove Widget',
                  width: '420px',
                  onClose: () => { if (!resolved) resolve(null); },
                  content: ({ close }) => {
                    const el = document.createElement('div');

                    const msg = document.createElement('p');
                    msg.textContent = `What would you like to do with "${widgetName}"?`;
                    msg.style.cssText = 'margin: 0 0 16px 0; font-size: 14px; color: var(--color-text); line-height: 1.5;';
                    el.appendChild(msg);

                    const btnRow = document.createElement('div');
                    btnRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;';

                    const cancelBtn = document.createElement('button');
                    cancelBtn.textContent = 'Cancel';
                    cancelBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; border: 1px solid var(--color-border); background: var(--color-bg-surface); color: var(--color-text); border-radius: var(--border-radius);';
                    cancelBtn.onclick = () => { resolved = true; close(); resolve(null); };
                    btnRow.appendChild(cancelBtn);

                    const removeBtn = document.createElement('button');
                    removeBtn.textContent = 'Remove from Page';
                    removeBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; border: none; background: var(--color-primary, #7c3aed); color: white; border-radius: var(--border-radius);';
                    removeBtn.onclick = () => { resolved = true; close(); resolve('remove'); };
                    btnRow.appendChild(removeBtn);

                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = 'Delete Permanently';
                    deleteBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; border: none; background: var(--color-danger, #e74c3c); color: white; border-radius: var(--border-radius);';
                    deleteBtn.onclick = () => { resolved = true; close(); resolve('delete'); };
                    btnRow.appendChild(deleteBtn);

                    el.appendChild(btnRow);
                    return el;
                  }
                });
              });

              if (!action) return;

              const freshPage = await api.get(pageItem.id);
              const freshChildren = freshPage.attachments || [];
              const filtered = freshChildren.filter(c => (typeof c === 'string' ? c : c.id) !== id);
              await api.updateSilent({ ...freshPage, attachments: filtered, modified: Date.now() });

              if (action === 'delete') {
                await api.delete(id);
              }

              renderPage();
            },
            onEdit: async (id) => {
              const designLib = await api.require('app-page-design-lib');
              const freshChild = await api.get(id);
              const saved = await designLib.showPropertyEditor(freshChild, api);
              if (saved) renderPage();
            }
          });
          grid.appendChild(designCell);
        } else {
          // Live mode: standard grid cell
          const col = viewConfig.col || 1;
          const row = viewConfig.row || 'auto';
          const colSpan = viewConfig.colSpan || columns;
          const rowSpan = viewConfig.rowSpan || 1;

          const cell = api.createElement('div', {
            style: `
              grid-column: ${col} / span ${colSpan};
              ${row !== 'auto' ? `grid-row: ${row} / span ${rowSpan};` : ''}
              min-width: 0;
              overflow: auto;
              padding: 4px 0;
            `,
            'data-item-id': childId
          });

          cell.appendChild(widgetElement);
          grid.appendChild(cell);
        }
      } catch (err) {
        window.kernel?.captureError(err, { operation: 'app-page-load-child', itemId: childId });
        const errorCell = api.createElement('div', {
          style: 'color: var(--color-danger, #e74c3c); padding: 8px; font-size: 13px;'
        });
        errorCell.textContent = `Failed to load widget ${childId}: ${err.message}`;
        grid.appendChild(errorCell);
      }
    }

    wrapper.appendChild(grid);
  }

  // Initial render
  await renderPage();

  return wrapper;
}
// [END:render]
