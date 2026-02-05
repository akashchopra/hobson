// Help Dialog Library
// Provides the keyboard shortcuts help modal. Moved from kernel to userland.

let api = null;

export async function onSystemBootComplete({ safeMode }, _api) {
  if (safeMode) return;
  api = _api;
}

export function show() {
  hide();

  const overlay = document.createElement("div");
  overlay.id = "help-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  const modal = document.createElement("div");
  modal.style.cssText = `
    background: var(--color-bg-surface);
    border-radius: 8px;
    padding: 24px;
    max-width: 400px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;

  modal.innerHTML = `
    <h2 style="margin-top: 0; margin-bottom: 16px;">Keyboard Shortcuts</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px 16px 8px 0;"><kbd style="background: var(--color-bg-hover); padding: 2px 8px; border-radius: var(--border-radius); border: 1px solid var(--color-border);">Esc</kbd></td><td>Toggle REPL</td></tr>
      <tr><td style="padding: 8px 16px 8px 0;"><kbd style="background: var(--color-bg-hover); padding: 2px 8px; border-radius: var(--border-radius); border: 1px solid var(--color-border);">Cmd+K</kbd></td><td>Search items</td></tr>
      <tr><td style="padding: 8px 16px 8px 0;"><kbd style="background: var(--color-bg-hover); padding: 2px 8px; border-radius: var(--border-radius); border: 1px solid var(--color-border);">Cmd+?</kbd></td><td>Show this help</td></tr>
    </table>
    <h3 style="margin-top: 20px; margin-bottom: 12px;">Mouse</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px 16px 8px 0;">Right-click</td><td>Context menu</td></tr>
      <tr><td style="padding: 8px 16px 8px 0;">Shift+Right-click</td><td>Browser menu</td></tr>
    </table>
    <h3 style="margin-top: 20px; margin-bottom: 12px;">Recovery</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px 16px 8px 0;"><kbd style="background: var(--color-bg-hover); padding: 2px 8px; border-radius: var(--border-radius); border: 1px solid var(--color-border);">Ctrl+Shift+S</kbd></td><td>Safe mode</td></tr>
    </table>
    <div style="margin-top: 20px; text-align: right;">
      <button id="help-close-btn" style="padding: 8px 16px; cursor: pointer;">Close</button>
    </div>
  `;

  overlay.appendChild(modal);

  // Close button handler
  modal.querySelector('#help-close-btn').onclick = () => hide();

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      hide();
    }
  };

  const escHandler = (e) => {
    if (e.key === "Escape") {
      hide();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);

  document.body.appendChild(overlay);
}

export function hide() {
  const existing = document.getElementById("help-overlay");
  if (existing) {
    existing.remove();
  }
}
