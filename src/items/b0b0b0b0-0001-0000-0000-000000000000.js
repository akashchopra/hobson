export async function render(item, api) {
  // The target to display is the first attachment of this frame item
  const targetSpec = (item.attachments || [])[0];
  if (!targetSpec) {
    return api.createElement('div', {}, ['Modal frame: no target']);
  }

  const targetId = typeof targetSpec === 'string' ? targetSpec : targetSpec.id;

  // Close handler — removes overlay from DOM
  let closed = false;
  const escHandler = (e) => {
    if (e.key === 'Escape') close();
  };

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', escHandler);
    overlay.remove();
  };

  // siblingContainer: close modal, then open item as sibling on the canvas (or navigate)
  const parentSiblingContainer = api.siblingContainer;
  const wrappedSiblingContainer = {
    id: parentSiblingContainer?.id || null,
    addSibling: async (childId, navigateTo) => {
      close();
      if (parentSiblingContainer) {
        parentSiblingContainer.addSibling(childId, navigateTo);
      } else {
        api.navigate(childId);
      }
    }
  };

  // Fixed overlay
  const overlay = api.createElement('div', {
    style: `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 10vh;
      z-index: 10000000;
    `
  }, []);

  // Modal box — min-width prevents collapse during search loading states
  const modal = api.createElement('div', {
    style: `
      background: var(--color-bg-surface);
      border-radius: 8px;
      width: 600px;
      min-width: 600px;
      max-width: 90vw;
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      overflow: auto;
    `
  }, []);

  // Render the target item inside the modal
  const targetNode = await api.renderItem(targetId, null, { siblingContainer: wrappedSiblingContainer });
  modal.appendChild(targetNode);

  overlay.appendChild(modal);

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', escHandler);

  // Auto-focus the first input inside the modal after render
  setTimeout(() => {
    const input = modal.querySelector('input');
    if (input) input.focus();
  }, 0);

  return overlay;
}
