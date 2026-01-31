// Item: keyboard-shortcuts
// ID: f1111111-0004-0000-0000-000000000000
// Type: 66666666-0000-0000-0000-000000000000

// Keyboard Shortcuts Library
// Registers global keyboard shortcuts, moved from kernel to userland

let api = null;

export async function onSystemBootComplete({ safeMode }, _api) {
  if (safeMode) return;  // No shortcuts in safe mode

  api = _api;

  // Register keyboard handler (only if not already registered)
  if (!window._userKeyboardHandler) {
    window._userKeyboardHandler = async (e) => {
      // Cmd/Ctrl+Shift+? - Help dialog
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '?') {
        e.preventDefault();
        window.kernel?.showHelp();
      }
      // Note: Cmd+K (item palette) is handled by system:viewport-view
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
