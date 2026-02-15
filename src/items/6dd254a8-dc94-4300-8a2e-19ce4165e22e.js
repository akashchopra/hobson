// Item: window-minimize-lib
// ID: 6dd254a8-dc94-4300-8a2e-19ce4165e22e
// Type: 66666666-0000-0000-0000-000000000000
//
// Minimize/restore for spatial-canvas-view. Single code path fixes overlay bug.
// Pills are placed in a flex tray that wraps rows upward automatically.

const PILL_WIDTH = 150;
const PILL_HEIGHT = 32;
const PILL_GAP = 8;

// Find or create the flex tray at the bottom of the container
function getPillTray(container, api) {
  let tray = container.querySelector('[data-pill-tray]');
  if (!tray) {
    tray = api.createElement('div', {
      'data-pill-tray': 'true',
      style: `
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        display: flex;
        flex-wrap: wrap-reverse;
        gap: ${PILL_GAP}px;
        padding: ${PILL_GAP}px;
        pointer-events: none;
        z-index: 10000;
      `
    }, []);
    container.appendChild(tray);
  }
  return tray;
}

// Create a single minimized pill (idempotent — removes existing pill for same childId first)
export function createMinimizedPill(childId, childName, container, index, api, { onRestore }) {
  // Remove existing pill for this child if present (idempotent)
  const existing = container.querySelector(`[data-minimized-id="${childId}"]`);
  if (existing) existing.remove();

  const tray = getPillTray(container, api);

  const pill = api.createElement('div', {
    'data-minimized-id': childId,
    'data-minimized': 'true',
    style: `
      width: ${PILL_WIDTH}px;
      height: ${PILL_HEIGHT}px;
      background: var(--color-bg-hover);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      display: flex;
      align-items: center;
      padding: 0 8px;
      cursor: pointer;
      pointer-events: auto;
      box-shadow: var(--shadow-sm);
    `,
    title: childName
  }, []);

  const text = api.createElement('span', {
    style: 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem;'
  }, [childName]);
  pill.appendChild(text);

  pill.addEventListener('click', async () => {
    await onRestore(childId);
  });

  tray.appendChild(pill);
  return pill;
}

// Render all minimized pills into container (used by render loop)
// Clears existing pills, creates one per minimized child
export function renderMinimizedPills(minimizedChildren, container, api, { getItemName, onRestore }) {
  // Clear existing tray (will be recreated by createMinimizedPill)
  const existingTray = container.querySelector('[data-pill-tray]');
  if (existingTray) existingTray.remove();

  minimizedChildren.forEach((child, index) => {
    const name = getItemName(child);
    createMinimizedPill(child.id, name, container, index, api, { onRestore });
  });
}

// No-op — flex tray handles repositioning via CSS
export function repositionPills(container) {}

// Calculate what happens when restoring a window
// Returns updated attachments array with target unminimized at front and all z-indices normalized
export function calculateRestore(childId, allChildren, isAnchoredFn) {
  // Get floating, non-minimized children sorted by z (excluding the one being restored)
  const floating = allChildren
    .filter(c => !isAnchoredFn(c.view?.anchor) && !c.view?.minimized && c.id !== childId)
    .map(c => ({ id: c.id, z: c.view?.z || 0 }))
    .sort((a, b) => a.z - b.z);

  // Add restored window at the end (front)
  floating.push({ id: childId, z: floating.length });

  // Build map of new z-values
  const newZValues = new Map();
  floating.forEach((c, idx) => {
    newZValues.set(c.id, idx);
  });

  // Build updated children array
  const updatedChildren = allChildren.map(c => {
    if (c.id === childId) {
      return {
        ...c,
        view: { ...(c.view || {}), minimized: false, z: newZValues.get(c.id) }
      };
    }
    if (newZValues.has(c.id)) {
      return {
        ...c,
        view: { ...(c.view || {}), z: newZValues.get(c.id) }
      };
    }
    return c;
  });

  return { updatedChildren };
}
