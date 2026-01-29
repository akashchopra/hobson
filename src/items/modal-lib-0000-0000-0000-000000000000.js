// Item: modal-lib
// ID: modal-lib-0000-0000-0000-000000000000
// Type: 66666666-0000-0000-0000-000000000000

/**
 * Shared modal library for consistent modal dialogs across Hobson.
 * Handles: backdrop, centering, Escape key, click-outside-to-close.
 */

/**
 * Shows a modal dialog with the provided content.
 * @param {Object} options - Modal options
 * @param {HTMLElement|Function} options.content - Content element or function that receives { close } and returns element
 * @param {string} [options.title] - Optional title for the modal header
 * @param {string} [options.width='500px'] - Modal width
 * @param {string} [options.maxHeight='80vh'] - Modal max height
 * @param {boolean} [options.showCloseButton=true] - Show X close button in header
 * @param {boolean} [options.closeOnBackdrop=true] - Close when clicking backdrop
 * @param {boolean} [options.closeOnEscape=true] - Close when pressing Escape
 * @param {Function} [options.onClose] - Callback when modal is closed
 * @param {Object} [options.api] - Hobson API (uses document.createElement if not provided)
 * @returns {{ close: Function, overlay: HTMLElement, modalBox: HTMLElement }}
 */
export function showModal(options = {}) {
  const {
    content,
    title,
    width = '500px',
    maxHeight = '80vh',
    showCloseButton = true,
    closeOnBackdrop = true,
    closeOnEscape = true,
    onClose,
    api
  } = options;

  // Use api.createElement if available, otherwise document.createElement
  const createElement = api?.createElement
    ? (tag, props, children) => api.createElement(tag, props, children || [])
    : (tag, props, children) => {
        const el = document.createElement(tag);
        if (props) {
          for (const [key, value] of Object.entries(props)) {
            if (key === 'style') {
              el.style.cssText = value;
            } else if (key.startsWith('on') && typeof value === 'function') {
              el.addEventListener(key.substring(2).toLowerCase(), value);
            } else {
              el.setAttribute(key, value);
            }
          }
        }
        if (children) {
          for (const child of children) {
            if (typeof child === 'string') {
              el.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
              el.appendChild(child);
            }
          }
        }
        return el;
      };

  let isClosing = false;

  // Close function
  const close = () => {
    if (isClosing) return;
    isClosing = true;

    // Remove escape handler
    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler);
    }

    // Remove overlay
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }

    // Call onClose callback
    if (onClose) {
      onClose();
    }
  };

  // Create overlay
  const overlay = createElement('div', {
    style: `
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
    `
  });

  // Create modal box
  const modalBox = createElement('div', {
    style: `
      background: white;
      border-radius: 8px;
      width: ${width};
      max-width: 90vw;
      max-height: ${maxHeight};
      overflow: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
    `
  });

  // Add header if title is provided
  if (title || showCloseButton) {
    const header = createElement('div', {
      style: `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e0e0e0;
        flex-shrink: 0;
      `
    });

    if (title) {
      const titleEl = createElement('h3', {
        style: 'margin: 0; font-size: 18px; font-weight: 600; color: #333;'
      }, [title]);
      header.appendChild(titleEl);
    } else {
      header.appendChild(createElement('div'));
    }

    if (showCloseButton) {
      const closeBtn = createElement('button', {
        style: `
          padding: 4px 8px;
          cursor: pointer;
          background: transparent;
          border: none;
          font-size: 20px;
          color: #666;
          line-height: 1;
          border-radius: 4px;
        `,
        onclick: close,
        title: 'Close (Escape)'
      }, ['\u00d7']);

      // Hover effect
      closeBtn.onmouseover = () => { closeBtn.style.background = '#f0f0f0'; };
      closeBtn.onmouseout = () => { closeBtn.style.background = 'transparent'; };

      header.appendChild(closeBtn);
    }

    modalBox.appendChild(header);
  }

  // Content container
  const contentContainer = createElement('div', {
    style: 'padding: 20px; overflow: auto; flex: 1;'
  });

  // Add content
  if (typeof content === 'function') {
    const contentEl = content({ close, overlay, modalBox });
    if (contentEl) {
      contentContainer.appendChild(contentEl);
    }
  } else if (content instanceof Node) {
    contentContainer.appendChild(content);
  }

  modalBox.appendChild(contentContainer);
  overlay.appendChild(modalBox);

  // Click backdrop to close
  if (closeOnBackdrop) {
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        close();
      }
    };
  }

  // Stop propagation on modal box
  modalBox.onclick = (e) => {
    e.stopPropagation();
  };

  // Escape key handler
  let escapeHandler = null;
  if (closeOnEscape) {
    escapeHandler = (e) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  // Add to document
  document.body.appendChild(overlay);

  return { close, overlay, modalBox, contentContainer };
}

/**
 * Shows a confirmation dialog.
 * @param {Object} options - Confirmation options
 * @param {string} options.message - Message to display
 * @param {string} [options.title='Confirm'] - Dialog title
 * @param {string} [options.confirmText='OK'] - Confirm button text
 * @param {string} [options.cancelText='Cancel'] - Cancel button text
 * @param {string} [options.confirmStyle='primary'] - Confirm button style: 'primary', 'danger'
 * @param {Object} [options.api] - Hobson API
 * @returns {Promise<boolean>} - true if confirmed, false if cancelled
 */
export function confirm(options = {}) {
  const {
    message,
    title = 'Confirm',
    confirmText = 'OK',
    cancelText = 'Cancel',
    confirmStyle = 'primary',
    api
  } = options;

  return new Promise((resolve) => {
    const confirmBtnColor = confirmStyle === 'danger' ? '#dc3545' : '#007bff';

    const { close } = showModal({
      title,
      width: '400px',
      api,
      onClose: () => resolve(false),
      content: ({ close: closeModal }) => {
        const container = document.createElement('div');

        // Message
        const messageEl = document.createElement('p');
        messageEl.textContent = message;
        messageEl.style.cssText = 'margin: 0 0 20px 0; font-size: 14px; color: #333; line-height: 1.5;';
        container.appendChild(messageEl);

        // Buttons
        const buttonRow = document.createElement('div');
        buttonRow.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = cancelText;
        cancelBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; border: 1px solid #ccc; background: white; border-radius: 4px;';
        cancelBtn.onclick = () => {
          closeModal();
          resolve(false);
        };
        buttonRow.appendChild(cancelBtn);

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = confirmText;
        confirmBtn.style.cssText = `padding: 8px 16px; cursor: pointer; border: none; background: ${confirmBtnColor}; color: white; border-radius: 4px;`;
        confirmBtn.onclick = () => {
          closeModal();
          resolve(true);
        };
        buttonRow.appendChild(confirmBtn);

        container.appendChild(buttonRow);
        return container;
      }
    });
  });
}

/**
 * Shows an alert dialog.
 * @param {Object} options - Alert options
 * @param {string} options.message - Message to display
 * @param {string} [options.title='Alert'] - Dialog title
 * @param {string} [options.buttonText='OK'] - Button text
 * @param {Object} [options.api] - Hobson API
 * @returns {Promise<void>}
 */
export function alert(options = {}) {
  const {
    message,
    title = 'Alert',
    buttonText = 'OK',
    api
  } = options;

  return new Promise((resolve) => {
    showModal({
      title,
      width: '400px',
      api,
      onClose: () => resolve(),
      content: ({ close }) => {
        const container = document.createElement('div');

        // Message
        const messageEl = document.createElement('p');
        messageEl.textContent = message;
        messageEl.style.cssText = 'margin: 0 0 20px 0; font-size: 14px; color: #333; line-height: 1.5;';
        container.appendChild(messageEl);

        // Button
        const buttonRow = document.createElement('div');
        buttonRow.style.cssText = 'display: flex; justify-content: flex-end;';

        const okBtn = document.createElement('button');
        okBtn.textContent = buttonText;
        okBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; border: none; background: #007bff; color: white; border-radius: 4px;';
        okBtn.onclick = () => {
          close();
          resolve();
        };
        buttonRow.appendChild(okBtn);

        container.appendChild(buttonRow);
        return container;
      }
    });
  });
}
