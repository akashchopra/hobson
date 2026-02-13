// Tag Tree Builder Library
// Shared logic for building hierarchical tag trees

/**
 * Builds a hierarchical tree structure from a flat list of tag items
 * @param {Array} tags - Flat array of tag items
 * @returns {Array} Root nodes of the tree, each with a children array
 */
export function buildTagTree(tags) {
  // Create map of tags by ID for quick lookup
  const tagMap = new Map();
  tags.forEach(tag => tagMap.set(tag.id, { ...tag, children: [] }));

  // Separate root and child tags
  const roots = [];
  tags.forEach(tag => {
    const parent = tag.content.parent;
    if (!parent) {
      // Root tag (no parent)
      roots.push(tagMap.get(tag.id));
    } else {
      // Child tag - add to parent's children array
      const parentNode = tagMap.get(parent);
      if (parentNode) {
        parentNode.children.push(tagMap.get(tag.id));
      } else {
        // Parent not found - treat as root
        roots.push(tagMap.get(tag.id));
      }
    }
  });

  // Sort all nodes by name (case-insensitive)
  const sortByName = (a, b) => {
    const nameA = (a.content.name || a.name || a.id).toLowerCase();
    const nameB = (b.content.name || b.name || b.id).toLowerCase();
    return nameA.localeCompare(nameB);
  };

  roots.sort(sortByName);
  tagMap.forEach(node => node.children.sort(sortByName));

  return roots;
}

/**
 * Gets display name for a tag node
 * @param {Object} tagNode - Tag node from tree
 * @returns {string} Display name
 */
export function getTagName(tagNode) {
  return tagNode.content.name || tagNode.name || tagNode.id;
}

/**
 * Gets fully-qualified tag name by walking up the parent chain
 * @param {string} tagId - Tag item ID
 * @param {Object} api - Hobson API (needs api.get)
 * @param {string} [stopAtId] - Optional ancestor ID to stop before (for relative paths)
 * @returns {Promise<string>} Fully-qualified name like "Root / Child / Grandchild"
 */
export async function getFullyQualifiedName(tagId, api, stopAtId) {
  const parts = [];
  let currentId = tagId;
  const seen = new Set();
  while (currentId) {
    if (currentId === stopAtId) break;
    if (seen.has(currentId)) break;
    seen.add(currentId);
    let item;
    try { item = await api.get(currentId); } catch (e) { break; }
    if (!item) break;
    parts.unshift(item.content?.name || item.name || currentId.substring(0, 8));
    currentId = item.content?.parent;
  }
  return parts.join(' / ');
}

/**
 * Gets color for a tag node
 * @param {Object} tagNode - Tag node from tree
 * @returns {string} Hex color code
 */
export function getTagColor(tagNode) {
  return tagNode.content.color || '#3b82f6';
}
