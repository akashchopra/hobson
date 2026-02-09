// Keyboard Shortcuts Library
// Registers global keyboard shortcuts, moved from kernel to userland

let api = null;

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

        const selectedId = api.viewport.getSelection();
        if (!selectedId) return;

        e.preventDefault();

        const parentId = api.viewport.getSelectionParent();

        try {
          const ctxLib = await api.require('context-menu-lib');
          const item = await api.get(selectedId);
          const editView = await ctxLib.findEditableView(api, item.type);
          if (!editView) return;

          if (parentId) {
            await api.setAttachmentView(parentId, selectedId, editView.id);
            await api.rerenderItem(selectedId);
          } else {
            await api.viewport.setRootView(editView.id);
            await api.renderViewport();
          }
        } catch (err) {
          console.warn('Ctrl+E edit failed:', err.message);
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
