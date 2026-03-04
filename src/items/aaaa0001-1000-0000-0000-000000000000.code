// Kernel Export Library
// Exports starter packs based on starter-pack/* tags

const TAG_IDS = {
  BARE: 'aaaa0001-0001-0000-0000-000000000000',
  BASIC: 'aaaa0001-0002-0000-0000-000000000000',
  ALL: 'aaaa0001-0003-0000-0000-000000000000'
};

const TIER_TAGS = {
  bare: [TAG_IDS.BARE],
  basic: [TAG_IDS.BARE, TAG_IDS.BASIC],
  all: [TAG_IDS.BARE, TAG_IDS.BASIC, TAG_IDS.ALL]
};

const FILENAMES = {
  bare: 'initial-kernel.json',
  basic: 'starter-basic.json',
  all: 'starter-all.json'
};

/**
 * Collect items for a given tier
 * @param {'bare'|'basic'|'all'} tier - The tier to collect
 * @param {object} api - The Hobson API object
 * @returns {Promise<Array>} Array of items to export
 */
export async function collect(tier, api) {
  if (!api) {
    // Allow calling from REPL where api is global
    api = window.kernel?.createAPI();
  }
  
  if (!TIER_TAGS[tier]) {
    throw new Error(`Unknown tier: ${tier}. Use 'bare', 'basic', or 'all'.`);
  }
  
  const tagIds = TIER_TAGS[tier];
  const allItems = await api.getAll();
  
  // Filter items that have any of the tier's tags
  const items = allItems.filter(item => {
    const itemTags = item.tags || [];
    return tagIds.some(tagId => itemTags.includes(tagId));
  });
  
  // Always include the starter-pack tags themselves so importing works
  const tagTypeId = 'd1da8525-b0dc-4a79-8bef-0cbed1ed003d';
  const starterPackParentId = 'aaaa0001-0000-0000-0000-000000000000';
  
  // Add parent tag and tier tags if not already included
  const idsToInclude = new Set(items.map(i => i.id));
  idsToInclude.add(starterPackParentId);
  tagIds.forEach(id => idsToInclude.add(id));
  
  // Also include the tag type definition itself
  idsToInclude.add(tagTypeId);
  
  // Re-filter to get the complete set
  const result = allItems.filter(item => idsToInclude.has(item.id));
  
  // Sort by type chain order (types before instances) for clean import
  return sortForExport(result);
}

/**
 * Sort items so types come before their instances
 */
function sortForExport(items) {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const itemIds = new Set(items.map(i => i.id));
  
  // Build dependency graph
  const dependsOn = new Map();
  
  for (const item of items) {
    const deps = [];
    
    // Type dependency
    if (item.type && itemIds.has(item.type) && item.type !== item.id) {
      deps.push(item.type);
    }
    
    // Extends dependency
    if (item.extends && itemIds.has(item.extends) && item.extends !== item.id) {
      deps.push(item.extends);
    }
    
    dependsOn.set(item.id, deps);
  }
  
  // Topological sort (Kahn's algorithm)
  const mustComeBefore = new Map();
  const inDegree = new Map();
  
  for (const item of items) {
    inDegree.set(item.id, dependsOn.get(item.id).length);
    
    for (const dep of dependsOn.get(item.id)) {
      if (!mustComeBefore.has(dep)) mustComeBefore.set(dep, []);
      mustComeBefore.get(dep).push(item.id);
    }
  }
  
  const queue = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }
  
  const result = [];
  while (queue.length > 0) {
    const id = queue.shift();
    result.push(itemMap.get(id));
    
    for (const dependent of (mustComeBefore.get(id) || [])) {
      const newDegree = inDegree.get(dependent) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }
  
  // Handle cycles: append remaining
  if (result.length < items.length) {
    const resultIds = new Set(result.map(i => i.id));
    for (const item of items) {
      if (!resultIds.has(item.id)) {
        result.push(item);
      }
    }
  }
  
  return result;
}

/**
 * Download a starter pack as a JSON file
 * @param {'bare'|'basic'|'all'} tier - The tier to export
 * @param {object} api - The Hobson API object
 */
export async function download(tier, api) {
  if (!api) {
    api = window.kernel?.createAPI();
  }
  
  const items = await collect(tier, api);
  const filename = FILENAMES[tier];
  
  const json = JSON.stringify(items, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log(`Downloaded ${filename} with ${items.length} items`);
  return { filename, count: items.length };
}

/**
 * List items in each tier with counts
 * @param {object} api - The Hobson API object
 */
export async function summary(api) {
  if (!api) {
    api = window.kernel?.createAPI();
  }
  
  const result = {};
  
  for (const tier of ['bare', 'basic', 'all']) {
    const items = await collect(tier, api);
    result[tier] = {
      count: items.length,
      items: items.map(i => i.name || i.id)
    };
  }
  
  return result;
}

/**
 * Check which tier(s) an item is tagged for
 * @param {string} itemId - The item ID to check
 * @param {object} api - The Hobson API object
 */
export async function tierOf(itemId, api) {
  if (!api) {
    api = window.kernel?.createAPI();
  }
  
  const item = await api.get(itemId);
  const itemTags = item.tags || [];
  
  const tiers = [];
  if (itemTags.includes(TAG_IDS.BARE)) tiers.push('bare');
  if (itemTags.includes(TAG_IDS.BASIC)) tiers.push('basic');
  if (itemTags.includes(TAG_IDS.ALL)) tiers.push('all');
  
  return tiers;
}
