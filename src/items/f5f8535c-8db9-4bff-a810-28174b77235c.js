// related-items-lib — Inverse index library for item relationships

const LINK_RE = /item:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;

// All indexes: Map<string, Set<string>> — target ID → set of source item IDs
const typeIndex = new Map();
const tagIndex = new Map();
const parentIndex = new Map();
const extendsIndex = new Map();
const containerIndex = new Map();
const linkIndex = new Map();
const forTypeIndex = new Map();
const preferredViewIndex = new Map();

let built = false;

// --- Helpers ---

function addToIndex(index, key, itemId) {
  if (!key) return;
  let set = index.get(key);
  if (!set) { set = new Set(); index.set(key, set); }
  set.add(itemId);
}

function removeFromIndex(index, key, itemId) {
  if (!key) return;
  const set = index.get(key);
  if (!set) return;
  set.delete(itemId);
  if (set.size === 0) index.delete(key);
}

function getFromIndex(index, key) {
  const set = index.get(key);
  return set ? [...set] : [];
}

function extractLinks(item) {
  const links = new Set();
  function scan(val) {
    if (typeof val === 'string') {
      LINK_RE.lastIndex = 0;
      let m;
      while ((m = LINK_RE.exec(val)) !== null) links.add(m[1]);
    } else if (Array.isArray(val)) {
      for (const v of val) scan(v);
    } else if (val && typeof val === 'object') {
      for (const v of Object.values(val)) scan(v);
    }
  }
  if (item.content) scan(item.content);
  return links;
}

function indexItem(item) {
  const id = item.id;

  // type
  addToIndex(typeIndex, item.type, id);

  // tags
  if (Array.isArray(item.content?.tags)) {
    for (const tag of item.content.tags) addToIndex(tagIndex, tag, id);
  }

  // parent
  addToIndex(parentIndex, item.content?.parent, id);

  // extends
  addToIndex(extendsIndex, item.extends, id);

  // containers (attachment parents): key = child ID, value = this item
  if (Array.isArray(item.attachments)) {
    for (const att of item.attachments) {
      const childId = typeof att === 'string' ? att : att?.id;
      if (childId) addToIndex(containerIndex, childId, id);
    }
  }

  // links
  for (const target of extractLinks(item)) {
    addToIndex(linkIndex, target, id);
  }

  // for_type
  addToIndex(forTypeIndex, item.content?.for_type, id);

  // preferredView
  addToIndex(preferredViewIndex, item.preferredView, id);
}

function unindexItem(item) {
  const id = item.id;

  removeFromIndex(typeIndex, item.type, id);

  if (Array.isArray(item.content?.tags)) {
    for (const tag of item.content.tags) removeFromIndex(tagIndex, tag, id);
  }

  removeFromIndex(parentIndex, item.content?.parent, id);
  removeFromIndex(extendsIndex, item.extends, id);

  if (Array.isArray(item.attachments)) {
    for (const att of item.attachments) {
      const childId = typeof att === 'string' ? att : att?.id;
      if (childId) removeFromIndex(containerIndex, childId, id);
    }
  }

  for (const target of extractLinks(item)) {
    removeFromIndex(linkIndex, target, id);
  }

  removeFromIndex(forTypeIndex, item.content?.for_type, id);
  removeFromIndex(preferredViewIndex, item.preferredView, id);
}

function clearAll() {
  for (const idx of [typeIndex, tagIndex, parentIndex, extendsIndex, containerIndex, linkIndex, forTypeIndex, preferredViewIndex]) {
    idx.clear();
  }
  built = false;
}

// --- Event handlers ---

export async function onSystemBootComplete(payload, api) {
  clearAll();
  const items = await api.getAll();
  for (const item of items) indexItem(item);
  built = true;
  console.log(`[related-items-lib] Indexed ${items.length} items`);
}

export async function onItemCreated({ item }, api) {
  if (!built) return;
  indexItem(item);
}

export async function onItemUpdated({ item, previous }, api) {
  if (!built) return;
  if (previous) unindexItem(previous);
  indexItem(item);
}

export async function onItemDeleted({ id, item }, api) {
  if (!built) return;
  if (item) unindexItem(item);
}

// --- Raw index accessors ---

export function getInstancesOf(typeId)      { return getFromIndex(typeIndex, typeId); }
export function getItemsTaggedWith(tagId)   { return getFromIndex(tagIndex, tagId); }
export function getChildrenOf(parentId)     { return getFromIndex(parentIndex, parentId); }
export function getSubtypesOf(typeId)       { return getFromIndex(extendsIndex, typeId); }
export function getContainersOf(itemId)     { return getFromIndex(containerIndex, itemId); }
export function getLinksTo(itemId)          { return getFromIndex(linkIndex, itemId); }
export function getViewsFor(typeId)         { return getFromIndex(forTypeIndex, typeId); }
export function getItemsPreferring(viewId)  { return getFromIndex(preferredViewIndex, viewId); }

// --- Convenience: all relationships for one item ---

export async function getRelated(itemId, api) {
  const item = await api.get(itemId);
  if (!item) return null;

  // Forward relationships (from reading the item itself)
  const attachmentIds = Array.isArray(item.attachments)
    ? item.attachments.map(a => typeof a === 'string' ? a : a?.id).filter(Boolean)
    : [];
  const outgoing = [...extractLinks(item)];

  return {
    // Forward
    type: item.type || null,
    tags: Array.isArray(item.content?.tags) ? [...item.content.tags] : [],
    parent: item.content?.parent || null,
    extends: item.extends || null,
    forType: item.content?.for_type || null,
    preferredView: item.preferredView || null,
    attachments: attachmentIds,
    outgoingLinks: outgoing,

    // Inverse
    instances: getFromIndex(typeIndex, itemId),
    taggedWith: getFromIndex(tagIndex, itemId),
    children: getFromIndex(parentIndex, itemId),
    subtypes: getFromIndex(extendsIndex, itemId),
    containers: getFromIndex(containerIndex, itemId),
    incomingLinks: getFromIndex(linkIndex, itemId),
    viewsFor: getFromIndex(forTypeIndex, itemId),
    preferredBy: getFromIndex(preferredViewIndex, itemId),
  };
}

export function isBuilt() { return built; }
