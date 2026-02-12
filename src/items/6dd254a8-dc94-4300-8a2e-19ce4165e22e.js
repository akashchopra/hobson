// Item: window-minimize-lib
// ID: 6dd254a8-dc94-4300-8a2e-19ce4165e22e
// Type: 66666666-0000-0000-0000-000000000000
//
// Minimize/restore for spatial-canvas-view. Single code path fixes overlay bug.

const PILL_WIDTH = 150;
const PILL_GAP = 8;
const PILL_STRIDE = PILL_WIDTH + PILL_GAP;
const PILL_BOTTOM = 8;
const PILL_LEFT_START = 8;

// Create a single minimized pill (idempotent — removes existing pill for same childId first)
export function createMinimizedPill(childId, childName, dockOverlay, index, api, { onRestore }) {
  // Remove existing pill for this child if present (idempotent)
  const existing = dockOverlay.querySelector(`[data-minimized-id="${childId}"]`);
  if (existing) existing.remove();

  const pill = api.createElement('div', {
    'data-minimized-id': childId,
    'data-minimized': 'true',
    style: `
      position: absolute;
      bottom: ${PILL_BOTTOM}px;
      left: ${PILL_LEFT_START + index * PILL_STRIDE}px;
      width: ${PILL_WIDTH}px;
      height: 32px;
      background: var(--color-bg-hover);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      display: flex;
      align-items: center;
      padding: 0 8px;
      cursor: pointer;
      z-index: 10000;
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

  dockOverlay.appendChild(pill);
  return pill;
}

// Render all minimized pills into dockOverlay (used by render loop)
// Clears existing pills, creates one per minimized child at correct index
export function renderMinimizedPills(minimizedChildren, dockOverlay, api, { getItemName, onRestore }) {
  // Clear existing pills
  const existing = dockOverlay.querySelectorAll('[data-minimized="true"]');
  existing.forEach(el => el.remove());

  minimizedChildren.forEach((child, index) => {
    const name = getItemName(child);
    createMinimizedPill(child.id, name, dockOverlay, index, api, { onRestore });
  });
}

// Reposition existing pills after one is removed (e.g. after restore)
export function repositionPills(dockOverlay) {
  const pills = dockOverlay.querySelectorAll('[data-minimized="true"]');
  pills.forEach((pill, i) => {
    pill.style.left = `${PILL_LEFT_START + i * PILL_STRIDE}px`;
  });
}

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
