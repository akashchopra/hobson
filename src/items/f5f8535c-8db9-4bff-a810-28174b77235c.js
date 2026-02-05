// related-items-lib — Inverse index library for item relationships

const LINK_RE = /item:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;

// State lives on globalThis so it survives moduleSystem.clearCache()
const CACHE_KEY = '__relatedItemsLib__';
if (!globalThis[CACHE_KEY]) {
  globalThis[CACHE_KEY] = {
    typeIndex: new Map(),
    tagIndex: new Map(),
    parentIndex: new Map(),
    extendsIndex: new Map(),
    containerIndex: new Map(),
    linkIndex: new Map(),
    forTypeIndex: new Map(),
    preferredViewIndex: new Map(),
    built: false,
  };
}
const S = globalThis[CACHE_KEY];

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
  addToIndex(S.typeIndex, item.type, id);

  // tags
  if (Array.isArray(item.content?.tags)) {
    for (const tag of item.content.tags) addToIndex(S.tagIndex, tag, id);
  }

  // parent
  addToIndex(S.parentIndex, item.content?.parent, id);

  // extends
  addToIndex(S.extendsIndex, item.extends, id);

  // containers (attachment parents): key = child ID, value = this item
  if (Array.isArray(item.attachments)) {
    for (const att of item.attachments) {
      const childId = typeof att === 'string' ? att : att?.id;
      if (childId) addToIndex(S.containerIndex, childId, id);
    }
  }

  // links
  for (const target of extractLinks(item)) {
    addToIndex(S.linkIndex, target, id);
  }

  // for_type
  addToIndex(S.forTypeIndex, item.content?.for_type, id);

  // preferredView
  addToIndex(S.preferredViewIndex, item.preferredView, id);
}

function unindexItem(item) {
  const id = item.id;

  removeFromIndex(S.typeIndex, item.type, id);

  if (Array.isArray(item.content?.tags)) {
    for (const tag of item.content.tags) removeFromIndex(S.tagIndex, tag, id);
  }

  removeFromIndex(S.parentIndex, item.content?.parent, id);
  removeFromIndex(S.extendsIndex, item.extends, id);

  if (Array.isArray(item.attachments)) {
    for (const att of item.attachments) {
      const childId = typeof att === 'string' ? att : att?.id;
      if (childId) removeFromIndex(S.containerIndex, childId, id);
    }
  }

  for (const target of extractLinks(item)) {
    removeFromIndex(S.linkIndex, target, id);
  }

  removeFromIndex(S.forTypeIndex, item.content?.for_type, id);
  removeFromIndex(S.preferredViewIndex, item.preferredView, id);
}

function clearAll() {
  for (const key of ['typeIndex', 'tagIndex', 'parentIndex', 'extendsIndex', 'containerIndex', 'linkIndex', 'forTypeIndex', 'preferredViewIndex']) {
    S[key].clear();
  }
  S.built = false;
}

// --- Event handlers ---

export async function onKernelBootComplete(payload, api) {
  clearAll();
  const items = await api.getAll();
  for (const item of items) indexItem(item);
  S.built = true;
  console.log(`[related-items-lib] Indexed ${items.length} items`);
}

export async function onItemCreated({ item }, api) {
  await ensureBuilt(api);
  indexItem(item);
}

export async function onItemUpdated({ item, previous }, api) {
  await ensureBuilt(api);
  if (previous) unindexItem(previous);
  indexItem(item);
}

export async function onItemDeleted({ id, item }, api) {
  await ensureBuilt(api);
  if (item) unindexItem(item);
}

// --- Raw index accessors ---

export function getInstancesOf(typeId)      { return getFromIndex(S.typeIndex, typeId); }
export function getItemsTaggedWith(tagId)   { return getFromIndex(S.tagIndex, tagId); }
export function getChildrenOf(parentId)     { return getFromIndex(S.parentIndex, parentId); }
export function getSubtypesOf(typeId)       { return getFromIndex(S.extendsIndex, typeId); }
export function getContainersOf(itemId)     { return getFromIndex(S.containerIndex, itemId); }
export function getLinksTo(itemId)          { return getFromIndex(S.linkIndex, itemId); }
export function getViewsFor(typeId)         { return getFromIndex(S.forTypeIndex, typeId); }
export function getItemsPreferring(viewId)  { return getFromIndex(S.preferredViewIndex, viewId); }

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
    instances: getFromIndex(S.typeIndex, itemId),
    taggedWith: getFromIndex(S.tagIndex, itemId),
    children: getFromIndex(S.parentIndex, itemId),
    subtypes: getFromIndex(S.extendsIndex, itemId),
    containers: getFromIndex(S.containerIndex, itemId),
    incomingLinks: getFromIndex(S.linkIndex, itemId),
    viewsFor: getFromIndex(S.forTypeIndex, itemId),
    preferredBy: getFromIndex(S.preferredViewIndex, itemId),
  };
}

export function isBuilt() { return S.built; }

export async function ensureBuilt(api) {
  if (S.built) return;
  const items = await api.getAll();
  for (const item of items) indexItem(item);
  S.built = true;
}
