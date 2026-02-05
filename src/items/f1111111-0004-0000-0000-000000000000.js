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
