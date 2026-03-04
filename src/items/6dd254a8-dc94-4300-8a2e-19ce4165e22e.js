// Item: window-minimize-lib
// ID: 6dd254a8-dc94-4300-8a2e-19ce4165e22e
// Type: 66666666-0000-0000-0000-000000000000
//
// Inventory bar and restore logic for spatial-canvas-view.
// Shows all attachments as compact chips with state indicators.

const BAR_HEIGHT = 24;
const CHIP_MAX_WIDTH = 140;
const CHIP_GAP = 2;
const SCROLL_STEP = 120;

function classifyState(child, isAnchoredFn) {
  const v = child.view || {};
  if (v.minimized) return 'minimized';
  if (v.maximized) return 'maximized';
  if (isAnchoredFn(v.anchor)) return 'anchored';
  return 'open';
}

const ARROW_STYLE = `
  flex-shrink: 0;
  width: 20px; height: 20px;
  padding: 0; border: none;
  background: transparent;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 0.675rem;
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.3;
`;

function createInventoryBar(container, api) {
  const wrapper = api.createElement('div', {
    'data-inventory-bar': 'true',
    style: `
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: ${BAR_HEIGHT}px;
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 0 2px;
      background: var(--color-bg-chrome);
      border-top: 1px solid var(--color-border-light);
      z-index: 10000;
      pointer-events: auto;
    `
  }, []);

  const leftBtn = api.createElement('button', {
    'data-scroll-left': 'true',
    style: ARROW_STYLE,
    title: 'Scroll left'
  }, ['\u25C0']);

  const track = api.createElement('div', {
    'data-inventory-track': 'true',
    style: `
      flex: 1; min-width: 0;
      display: flex;
      align-items: center;
      gap: ${CHIP_GAP}px;
      overflow-x: auto;
      scrollbar-width: none;
      white-space: nowrap;
      scroll-behavior: smooth;
    `
  }, []);

  const rightBtn = api.createElement('button', {
    'data-scroll-right': 'true',
    style: ARROW_STYLE,
    title: 'Scroll right'
  }, ['\u25B6']);

  leftBtn.addEventListener('click', () => { track.scrollLeft -= SCROLL_STEP; });
  rightBtn.addEventListener('click', () => { track.scrollLeft += SCROLL_STEP; });

  function updateArrows() {
    const canScrollLeft = track.scrollLeft > 1;
    const canScrollRight = track.scrollLeft < track.scrollWidth - track.clientWidth - 1;
    leftBtn.style.opacity = canScrollLeft ? '1' : '0.3';
    leftBtn.style.cursor = canScrollLeft ? 'pointer' : 'default';
    rightBtn.style.opacity = canScrollRight ? '1' : '0.3';
    rightBtn.style.cursor = canScrollRight ? 'pointer' : 'default';
  }

  track.addEventListener('scroll', updateArrows);

  wrapper.appendChild(leftBtn);
  wrapper.appendChild(track);
  wrapper.appendChild(rightBtn);
  container.appendChild(wrapper);

  return { track };
}

// Render inventory bar showing all children with state indicators
export function renderInventoryBar(allChildren, container, api, options) {
  const { isAnchoredFn, frontChildId, onRestore, onFocus, onMinimize } = options;

  const existing = container.querySelector('[data-inventory-bar]');
  if (existing) existing.remove();

  if (!allChildren || allChildren.length === 0) return;

  const { track } = createInventoryBar(container, api);

  const indicators = {
    open: '\u25CF',      // ●
    minimized: '\u25CB', // ○
    maximized: '\u25A0', // ■
    anchored: '\u25C6'   // ◆
  };

  allChildren.forEach(child => {
    const childId = child.id;
    const state = classifyState(child, isAnchoredFn);
    const name = child._name || childId.substring(0, 8);
    const isFront = childId === frontChildId;

    const bgStyle = isFront
      ? 'background: var(--color-primary-light); border: 1px solid var(--color-primary);'
      : state === 'minimized'
        ? 'background: var(--color-bg-hover); opacity: 0.7; border: 1px solid transparent;'
        : 'background: var(--color-bg-hover); border: 1px solid transparent;';

    const chip = api.createElement('div', {
      'data-inventory-id': childId,
      'data-sort-key': `inv-${childId}`,
      'data-state': state,
      'data-is-front': isFront ? 'true' : 'false',
      style: `
        height: 20px;
        padding: 0 6px;
        max-width: ${CHIP_MAX_WIDTH}px;
        border-radius: var(--border-radius);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        flex-shrink: 0;
        font-size: 0.675rem;
        line-height: 20px;
        ${bgStyle}
      `,
      title: `${name} (${state})`
    }, []);

    const indicator = api.createElement('span', {
      'data-sort-key': `inv-ind-${childId}`,
      style: `font-size: 0.5rem; color: ${isFront ? 'var(--color-primary)' : 'var(--color-text-tertiary)'};`
    }, [indicators[state]]);
    chip.appendChild(indicator);

    const text = api.createElement('span', {
      'data-sort-key': `inv-txt-${childId}`,
      style: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
    }, [name]);
    chip.appendChild(text);

    // Read state from data attributes at click time (not closures)
    // because morphdom keeps old elements with old handlers but updates attributes
    chip.addEventListener('click', async (e) => {
      e.stopPropagation();
      const curState = chip.getAttribute('data-state');
      const curIsFront = chip.getAttribute('data-is-front') === 'true';
      if (curState === 'minimized') {
        await onRestore(childId);
      } else if (curIsFront) {
        await onMinimize(childId);
      } else {
        await onFocus(childId);
      }
    });

    track.appendChild(chip);
  });

}

// Return the ID of the topmost floating or maximized child
export function calculateFrontChild(allChildren, baseZ, isAnchoredFn) {
  const maximized = allChildren.find(c => c.view?.maximized && !c.view?.minimized);
  if (maximized) return maximized.id;

  const floating = allChildren
    .filter(c => !isAnchoredFn(c.view?.anchor) && !c.view?.minimized && !c.view?.maximized)
    .sort((a, b) => (b.view?.z || 0) - (a.view?.z || 0));

  return floating.length > 0 ? floating[0].id : null;
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
