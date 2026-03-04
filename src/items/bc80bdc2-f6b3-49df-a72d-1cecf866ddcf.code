// Item: window-zindex-lib
// ID: bc80bdc2-f6b3-49df-a72d-1cecf866ddcf
// Type: 66666666-0000-0000-0000-000000000000
//
// Z-index management for spatial-canvas-view. DB-authoritative — no DOM queries.

// Get max z-index from DB only
// children: fresh item.attachments array
// baseZ: base z-index offset (typically 1)
// isAnchoredFn: function to check if an anchor string means the window is anchored
export function getMaxZ(children, baseZ, isAnchoredFn) {
  const floating = children.filter(c => !isAnchoredFn(c.view?.anchor) && !c.view?.minimized);
  const maxStoredZ = Math.max(...floating.map(c => c.view?.z || 0), 0);
  return maxStoredZ + baseZ;
}

// Calculate new z-index for bringing window to front
// Returns null if already at front
// Pure calculation — caller handles persistence and DOM update
export function bringToFrontZ(childId, children, baseZ, isAnchoredFn) {
  const floating = children.filter(c => !isAnchoredFn(c.view?.anchor) && !c.view?.minimized);
  const maxStoredZ = Math.max(...floating.map(c => c.view?.z || 0), 0);

  const target = floating.find(c => c.id === childId);
  if (!target) return null; // Anchored or minimized

  const currentZ = (target.view?.z || 0) + baseZ;
  const maxZ = maxStoredZ + baseZ;

  if (currentZ >= maxZ) return null; // Already at front

  const newDomZ = maxZ + 1;
  const newStoredZ = newDomZ - baseZ;

  return { newZ: newDomZ, newStoredZ };
}

// Normalize all z-indices to sequential 0, 1, 2...
// Returns Map<childId, newZ> for caller to apply in one batch
export function normalizeZIndices(children, isAnchoredFn) {
  const floating = children
    .filter(c => !isAnchoredFn(c.view?.anchor) && !c.view?.minimized)
    .map(c => ({ id: c.id, z: c.view?.z || 0 }))
    .sort((a, b) => a.z - b.z);

  const result = new Map();
  floating.forEach((c, idx) => {
    result.set(c.id, idx);
  });
  return result;
}
