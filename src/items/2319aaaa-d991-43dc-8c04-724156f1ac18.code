// Item: window-anchor-lib
// ID: 2319aaaa-d991-43dc-8c04-724156f1ac18
// Type: 66666666-0000-0000-0000-000000000000
//
// Pure anchor positioning calculations for spatial-canvas-view windows.

export const DEFAULT_WINDOW_WIDTH = 600;
export const DEFAULT_WINDOW_HEIGHT = 500;
export const MIN_WINDOW_WIDTH = 200;
export const MIN_WINDOW_HEIGHT = 150;
export const MIN_DOCKED_WIDTH = 100;
export const MIN_DOCKED_HEIGHT = 50;

export function isCornerAnchor(anchor) {
  return anchor === 'top-right' || anchor === 'bottom-left' || anchor === 'bottom-right';
}

export function isEdgeAnchor(anchor) {
  return anchor === 'left' || anchor === 'right' || anchor === 'top' || anchor === 'bottom';
}

export function isAnchored(anchor) {
  return isCornerAnchor(anchor) || isEdgeAnchor(anchor);
}

// Convert anchor-relative position to absolute CSS values
export function calculateAbsolutePosition(view, containerWidth, containerHeight) {
  const anchor = view.anchor || 'top-left';
  const isEdgeH = anchor === 'top' || anchor === 'bottom';
  const isEdgeV = anchor === 'left' || anchor === 'right';

  const width = isEdgeH ? containerWidth : (view.width || DEFAULT_WINDOW_WIDTH);
  const height = isEdgeV ? containerHeight : (view.height || DEFAULT_WINDOW_HEIGHT);

  let left, top;
  switch (anchor) {
    case 'top-left':
    default:
      left = view.x || 0;
      top = view.y || 0;
      break;
    case 'top-right':
      left = containerWidth - (view.x || 0) - width;
      top = view.y || 0;
      break;
    case 'bottom-left':
      left = view.x || 0;
      top = containerHeight - (view.y || 0) - height;
      break;
    case 'bottom-right':
      left = containerWidth - (view.x || 0) - width;
      top = containerHeight - (view.y || 0) - height;
      break;
    case 'left':
      left = view.x || 0;
      top = 0;
      break;
    case 'right':
      left = containerWidth - (view.x || 0) - width;
      top = 0;
      break;
    case 'top':
      left = 0;
      top = view.y || 0;
      break;
    case 'bottom':
      left = 0;
      top = containerHeight - (view.y || 0) - height;
      break;
  }
  return { left, top, width, height };
}

// Find nearest corner from absolute position and convert to anchor-relative coordinates
export function pinToNearestCorner(view, containerWidth, containerHeight) {
  const x = view.x || 0;
  const y = view.y || 0;
  const width = view.width || DEFAULT_WINDOW_WIDTH;
  const height = view.height || DEFAULT_WINDOW_HEIGHT;

  const centerX = x + width / 2;
  const centerY = y + height / 2;

  const anchorX = centerX < containerWidth / 2 ? 'left' : 'right';
  const anchorY = centerY < containerHeight / 2 ? 'top' : 'bottom';
  const anchor = `${anchorY}-${anchorX}`;

  const newX = anchorX === 'left' ? x : containerWidth - x - width;
  const newY = anchorY === 'top' ? y : containerHeight - y - height;

  return { anchor, x: newX, y: newY };
}

// Generate CSS inset string for anchored/docked windows
// Returns null for floating windows (top-left or no anchor)
export function generateInsetStyle(anchor, view) {
  const width = view.width || DEFAULT_WINDOW_WIDTH;
  const height = view.height || DEFAULT_WINDOW_HEIGHT;
  const ox = view.x || 0;
  const oy = view.y || 0;

  if (isEdgeAnchor(anchor)) {
    switch (anchor) {
      case 'left':
        return `left: 0; top: 0; bottom: 0; width: ${width}px;`;
      case 'right':
        return `right: 0; top: 0; bottom: 0; width: ${width}px;`;
      case 'top':
        return `left: 0; right: 0; top: 0; height: ${height}px;`;
      case 'bottom':
        return `left: 0; right: 0; bottom: 0; height: ${height}px;`;
    }
  }

  if (isCornerAnchor(anchor)) {
    switch (anchor) {
      case 'top-right':
        return `right: ${ox}px; top: ${oy}px; width: ${width}px; height: ${height}px;`;
      case 'bottom-left':
        return `left: ${ox}px; bottom: ${oy}px; width: ${width}px; height: ${height}px;`;
      case 'bottom-right':
        return `right: ${ox}px; bottom: ${oy}px; width: ${width}px; height: ${height}px;`;
    }
  }

  return null;
}
