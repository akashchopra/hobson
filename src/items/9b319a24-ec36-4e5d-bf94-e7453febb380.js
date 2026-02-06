// Item: window-drag-resize-lib
// ID: 9b319a24-ec36-4e5d-bf94-e7453febb380
// Type: 66666666-0000-0000-0000-000000000000
//
// Drag and resize event handlers for spatial-canvas-view windows.

// Attach drag behavior to a titlebar
// Returns cleanup function
export function attachDrag(titlebar, wrapper, { onDragStart, onDragEnd }) {
  const handler = async (e) => {
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    e.stopPropagation();

    // Bring to front on drag start
    const newZ = await onDragStart();
    if (newZ !== null) {
      wrapper.style.zIndex = newZ;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const leftPx = parseInt(wrapper.style.left);
    const topPx = parseInt(wrapper.style.top);
    const startLeft = isNaN(leftPx) ? 0 : leftPx;
    const startTop = isNaN(topPx) ? 0 : topPx;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const newX = startLeft + deltaX;
      const newY = Math.max(0, startTop + deltaY);
      wrapper.style.left = newX + 'px';
      wrapper.style.top = newY + 'px';
    };

    const onMouseUp = async (upEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      const deltaX = upEvent.clientX - startX;
      const deltaY = upEvent.clientY - startY;
      const finalX = startLeft + deltaX;
      const finalY = Math.max(0, startTop + deltaY);
      await onDragEnd(finalX, finalY);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  titlebar.addEventListener('mousedown', handler);
  return () => titlebar.removeEventListener('mousedown', handler);
}

// Attach 4 corner resize handles
// Returns cleanup function that removes all handles
export function attachCornerResize(wrapper, api, { onResizeStart, onResizeEnd, minWidth, minHeight }) {
  const corners = [
    { id: 'tl', cursor: 'nwse-resize', top: '0', left: '0' },
    { id: 'tr', cursor: 'nesw-resize', top: '0', right: '0' },
    { id: 'bl', cursor: 'nesw-resize', bottom: '0', left: '0' },
    { id: 'br', cursor: 'nwse-resize', bottom: '0', right: '0' }
  ];

  const handles = corners.map(({ id: corner, cursor, ...pos }) => {
    const posStyle = Object.entries(pos).map(([k, v]) => `${k}: ${v};`).join(' ');
    const handle = api.createElement('div', {
      class: 'resize-handle',
      style: `position: absolute; ${posStyle} width: 8px; height: 8px; background: var(--color-border-dark); cursor: ${cursor}; z-index: 10;`
    }, []);

    handle.addEventListener('mousedown', async (handleE) => {
      handleE.preventDefault();
      handleE.stopPropagation();

      const newZ = await onResizeStart();
      if (newZ !== null) {
        wrapper.style.zIndex = newZ;
      }

      const startX = handleE.clientX;
      const startY = handleE.clientY;
      const startWidth = parseInt(wrapper.style.width) || minWidth;
      const startHeight = parseInt(wrapper.style.height) || minHeight;
      const leftPx = parseInt(wrapper.style.left);
      const topPx = parseInt(wrapper.style.top);
      const startLeft = isNaN(leftPx) ? 0 : leftPx;
      const startTop = isNaN(topPx) ? 0 : topPx;

      const onMouseMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;

        if (corner === 'br') {
          newWidth = Math.max(minWidth, startWidth + deltaX);
          newHeight = Math.max(minHeight, startHeight + deltaY);
        } else if (corner === 'bl') {
          newWidth = Math.max(minWidth, startWidth - deltaX);
          newHeight = Math.max(minHeight, startHeight + deltaY);
          newLeft = startLeft + (startWidth - newWidth);
        } else if (corner === 'tr') {
          newWidth = Math.max(minWidth, startWidth + deltaX);
          newHeight = Math.max(minHeight, startHeight - deltaY);
          newTop = startTop + (startHeight - newHeight);
        } else if (corner === 'tl') {
          newWidth = Math.max(minWidth, startWidth - deltaX);
          newHeight = Math.max(minHeight, startHeight - deltaY);
          newLeft = startLeft + (startWidth - newWidth);
          newTop = startTop + (startHeight - newHeight);
        }

        wrapper.style.width = newWidth + 'px';
        wrapper.style.height = newHeight + 'px';
        wrapper.style.left = newLeft + 'px';
        wrapper.style.top = newTop + 'px';
      };

      const onMouseUp = async () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        const finalX = parseInt(wrapper.style.left);
        const finalY = parseInt(wrapper.style.top);
        const finalW = parseInt(wrapper.style.width);
        const finalH = parseInt(wrapper.style.height);
        await onResizeEnd(finalX, finalY, finalW, finalH);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    wrapper.appendChild(handle);
    return handle;
  });

  return () => handles.forEach(h => h.remove());
}

// Attach single edge resize handle for docked windows
// dockDirection: 'left'|'right'|'top'|'bottom'
// Returns cleanup function
export function attachEdgeResize(wrapper, dockDirection, api, { onResizeEnd, minWidth, minHeight }) {
  // Determine which edge gets the handle (opposite of dock side)
  const edgeMap = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
  const edge = edgeMap[dockDirection];
  const cursorMap = { left: 'ew-resize', right: 'ew-resize', top: 'ns-resize', bottom: 'ns-resize' };
  const cursor = cursorMap[edge];

  let handleStyle = 'position: absolute; background: transparent;';
  if (edge === 'right') handleStyle += ' right: 0; top: 0; bottom: 0; width: 6px;';
  else if (edge === 'left') handleStyle += ' left: 0; top: 0; bottom: 0; width: 6px;';
  else if (edge === 'bottom') handleStyle += ' bottom: 0; left: 0; right: 0; height: 6px;';
  else if (edge === 'top') handleStyle += ' top: 0; left: 0; right: 0; height: 6px;';

  const handle = api.createElement('div', {
    class: 'resize-handle',
    style: handleStyle + ` cursor: ${cursor};`
  }, []);

  handle.addEventListener('mouseenter', () => { handle.style.background = 'rgba(0, 0, 0, 0.1)'; });
  handle.addEventListener('mouseleave', () => { handle.style.background = 'transparent'; });

  handle.addEventListener('mousedown', async (handleE) => {
    handleE.preventDefault();
    handleE.stopPropagation();

    const startX = handleE.clientX;
    const startY = handleE.clientY;
    const startWidth = parseInt(wrapper.style.width) || minWidth;
    const startHeight = parseInt(wrapper.style.height) || minHeight;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (edge === 'right' && dockDirection === 'left') {
        wrapper.style.width = Math.max(minWidth, startWidth + deltaX) + 'px';
      } else if (edge === 'left' && dockDirection === 'right') {
        wrapper.style.width = Math.max(minWidth, startWidth - deltaX) + 'px';
      } else if (edge === 'bottom' && dockDirection === 'top') {
        wrapper.style.height = Math.max(minHeight, startHeight + deltaY) + 'px';
      } else if (edge === 'top' && dockDirection === 'bottom') {
        wrapper.style.height = Math.max(minHeight, startHeight - deltaY) + 'px';
      }
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      const finalWidth = parseInt(wrapper.style.width);
      const finalHeight = parseInt(wrapper.style.height);
      await onResizeEnd(finalWidth, finalHeight);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  wrapper.appendChild(handle);
  return () => handle.remove();
}

