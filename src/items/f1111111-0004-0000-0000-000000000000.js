// Keyboard Shortcuts Library
// Registers global keyboard shortcuts, moved from kernel to userland

let api = null;

// Minimal createElement matching viewport-rendering's API shape (without debug attribution)
function createElement(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'function') el[key] = value;
    else if (key === 'class') el.className = value;
    else if (key === 'style' && typeof value === 'string') el.style.cssText = value;
    else el.setAttribute(key, value);
  }
  for (const child of children) {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child instanceof Node) el.appendChild(child);
    else if (Array.isArray(child)) el.appendChild(createElement(child[0], child[1], child[2]));
  }
  return el;
}

export async function onKernelBootComplete({ safeMode }, _api) {
  if (safeMode) return;  // No shortcuts in safe mode

  api = _api;

  // Register keyboard handler (only if not already registered)
  if (!window._userKeyboardHandler) {
    window._userKeyboardHandler = async (e) => {
      // Cmd/Ctrl+Shift+? - Help dialog
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '?') {
        e.preventDefault();
        try {
          const helpDialog = await api.require('help-dialog');
          helpDialog.show();
        } catch (err) {
          console.warn('help-dialog not available:', err.message);
        }
      }
      // Ctrl+E - Edit selected item
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.key === 'e') {
        // Don't steal from text inputs
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

        const selMgr = await api.require('selection-manager');
        const selectedId = selMgr.getSelection();
        if (!selectedId) return;

        e.preventDefault();

        const parentId = selMgr.getSelectionParent();

        try {
          const ctxLib = await api.require('context-menu-lib');
          const vpMgr = await api.require('viewport-manager');
          const rendering = vpMgr.getRendering();
          const item = await api.get(selectedId);
          // findEditableView needs api.getViews which is rendering-only
          const enrichedApi = { ...api, getViews: (t) => rendering.getViews(t) };
          const editView = await ctxLib.findEditableView(enrichedApi, item.type);
          if (!editView) return;

          if (parentId) {
            // Inline setAttachmentView: update parent's attachment spec
            const parent = await api.get(parentId);
            const idx = parent.attachments.findIndex(c => c.id === selectedId);
            if (idx >= 0) {
              const child = parent.attachments[idx];
              parent.attachments = [...parent.attachments];
              parent.attachments[idx] = {
                ...child,
                previousView: child.view ? { ...child.view } : null,
                view: { ...(child.view || {}), type: editView.id }
              };
              await api.set(parent); // triggers reactive re-render
            }
          } else {
            await vpMgr.setRootView(editView.id);
            await rendering.renderViewport();
          }
        } catch (err) {
          console.warn('Ctrl+E edit failed:', err.message);
        }
      }

      // Ctrl+Shift+N - New child item on spatial canvas
      if (e.ctrlKey && !e.metaKey && e.shiftKey && !e.altKey && e.key === 'N') {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

        const vpMgr = await api.require('viewport-manager');
        const rootId = vpMgr.getRoot();
        if (!document.querySelector(`[data-container-id="${rootId}"]`)) return;

        e.preventDefault();

        try {
          const typePicker = await api.require('type-picker-lib');
          const ctxLib = await api.require('context-menu-lib');
          const rendering = vpMgr.getRendering();
          const enrichedApi = { ...api, getViews: (t) => rendering.getViews(t), createElement };

          const selectedType = await typePicker.showTypePicker(enrichedApi);
          if (!selectedType) return;

          const editView = await ctxLib.findEditableView(enrichedApi, selectedType);

          const newItem = {
            id: crypto.randomUUID(),
            name: new Date().toISOString(),
            type: selectedType,
            created: Date.now(),
            modified: Date.now(),
            attachments: [],
            content: {}
          };
          await api.set(newItem);

          const attachment = { id: newItem.id };
          if (editView) attachment.view = { type: editView.id };

          const root = await api.get(rootId);
          root.attachments = [...(root.attachments || []), attachment];
          root.modified = Date.now();
          await api.set(root);
        } catch (err) {
          console.warn('Ctrl+Shift+N failed:', err.message);
        }
      }

      // Ctrl+Shift+A - Add existing item to spatial canvas
      if (e.ctrlKey && !e.metaKey && e.shiftKey && !e.altKey && e.key === 'A') {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

        const vpMgr = await api.require('viewport-manager');
        const rootId = vpMgr.getRoot();
        if (!document.querySelector(`[data-container-id="${rootId}"]`)) return;

        e.preventDefault();

        try {
          const modalLib = await api.require('modal-lib');
          const searchLib = await api.require('item-search-lib');

          const searchContainer = document.createElement('div');
          const enrichedApi = { ...api, createElement };
          const { close } = modalLib.showModal({
            title: 'Add Existing Item',
            width: '600px',
            maxHeight: '80vh',
            api: enrichedApi,
            content: searchContainer
          });

          searchLib.createSearchUI(
            searchContainer,
            async (selectedItem) => {
              close();
              const root = await api.get(rootId);
              root.attachments = [...(root.attachments || []), { id: selectedItem.id }];
              root.modified = Date.now();
              await api.set(root);
            },
            enrichedApi,
            { placeholder: 'Search for items to add...', autoFocus: true }
          );
        } catch (err) {
          console.warn('Ctrl+Shift+A failed:', err.message);
        }
      }

      // Note: Cmd+K (item palette) is handled by viewport-view
    };
    document.addEventListener('keydown', window._userKeyboardHandler);
  }
}

// Cleanup function for hot-reload scenarios
export function cleanup() {
  if (window._userKeyboardHandler) {
    document.removeEventListener('keydown', window._userKeyboardHandler);
    delete window._userKeyboardHandler;
  }
}
