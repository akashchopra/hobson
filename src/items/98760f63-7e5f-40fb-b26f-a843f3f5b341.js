// Item: tag-tree-builder
// ID: 98760f63-7e5f-40fb-b26f-a843f3f5b341
// Type: 66666666-0000-0000-0000-000000000000

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
 * Gets color for a tag node
 * @param {Object} tagNode - Tag node from tree
 * @returns {string} Hex color code
 */
export function getTagColor(tagNode) {
  return tagNode.content.color || '#3b82f6';
}
