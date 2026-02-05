// Related Items Widget View
// Displays all relationships for the currently selected item.
// Watches viewport:selection-changed to reactively update.

const WIDGET_TYPE_ID = '1e9ffc8d-0e0d-4020-9865-b4ca6a05cbae';

// Group definitions: [label, key from getRelated result, isSingle]
const FORWARD_GROUPS = [
  ['Type', 'type', true],
  ['Tags', 'tags', false],
  ['Parent', 'parent', true],
  ['Extends', 'extends', true],
  ['For Type', 'forType', true],
  ['Preferred View', 'preferredView', true],
  ['Attachments', 'attachments', false],
  ['Links To', 'outgoingLinks', false],
];

const INVERSE_GROUPS = [
  ['Instances', 'instances', false],
  ['Tagged With', 'taggedWith', false],
  ['Parent Of', 'children', false],
  ['Subtypes', 'subtypes', false],
  ['Attached To', 'containers', false],
  ['Linked From', 'incomingLinks', false],
  ['Views For', 'viewsFor', false],
  ['Preferred By', 'preferredBy', false],
];

const TRUNCATE_LIMIT = 10;

export async function render(widget, api) {
  const selectionMgr = await api.require('selection-manager');
  const relatedLib = await api.require('related-items-lib');

  const container = api.createElement('div', {
    style: 'max-width: 600px; margin: 0 auto; font-size: 14px;'
  }, []);

  // Ensure indexes are built (rebuilds if module cache was cleared)
  await relatedLib.ensureBuilt(api);

  const selectedId = selectionMgr.getSelection();

  // Header - shows selection state
  const header = api.createElement('div', {
    style: 'margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid var(--color-border-light);'
  }, []);
  container.appendChild(header);

  if (!selectedId) {
    const title = api.createElement('h2', {
      style: 'margin: 0; font-size: 14px; color: var(--color-border-dark); font-style: italic;'
    }, ['Select an item to see relationships']);
    header.appendChild(title);
    return container;
  }

  // Body
  const body = api.createElement('div', {}, []);
  container.appendChild(body);

  let selectedItem;
  try { selectedItem = await api.get(selectedId); } catch (e) { selectedItem = null; }
  if (!selectedItem) {
    const title = api.createElement('h2', {
      style: 'margin: 0; font-size: 18px; color: var(--color-border-dark); font-style: italic;'
    }, ['Item not found']);
    header.appendChild(title);
    return container;
  }

  const title = api.createElement('h2', {
    style: 'margin: 0; font-size: 16px;'
  }, ['Related to: ' + (selectedItem.name || selectedId.substring(0, 8))]);
  header.appendChild(title);

  const related = await relatedLib.getRelated(selectedId, api);
  if (!related) {
    return container;
  }

  // Render forward groups
  const forwardSection = await renderSection('Forward', FORWARD_GROUPS, related, api);
  if (forwardSection) body.appendChild(forwardSection);

  // Render inverse groups
  const inverseSection = await renderSection('Inverse', INVERSE_GROUPS, related, api);
  if (inverseSection) body.appendChild(inverseSection);

  return container;
}

async function renderSection(sectionLabel, groups, related, api) {
  const nonEmpty = [];

  for (const [label, key, isSingle] of groups) {
    const value = related[key];
    if (isSingle) {
      if (value) nonEmpty.push([label, [value]]);
    } else {
      if (Array.isArray(value) && value.length > 0) nonEmpty.push([label, value]);
    }
  }

  if (nonEmpty.length === 0) return null;

  const section = api.createElement('div', {
    style: 'margin-bottom: 16px;'
  }, []);

  const heading = api.createElement('h3', {
    style: 'margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-border-dark);'
  }, [sectionLabel]);
  section.appendChild(heading);

  for (const [label, ids] of nonEmpty) {
    const group = await renderGroup(label, ids, api);
    section.appendChild(group);
  }

  return section;
}

async function renderGroup(label, ids, api) {
  const group = api.createElement('div', {
    style: 'margin-bottom: 12px;'
  }, []);

  const groupLabel = api.createElement('div', {
    style: 'font-weight: 600; margin-bottom: 4px; font-size: 13px;'
  }, [label]);
  group.appendChild(groupLabel);

  const list = api.createElement('div', {
    style: 'padding-left: 8px;'
  }, []);

  const uniqueIds = [...new Set(ids)];
  const truncated = uniqueIds.length > TRUNCATE_LIMIT;
  const displayIds = truncated ? uniqueIds.slice(0, TRUNCATE_LIMIT) : uniqueIds;

  for (const id of displayIds) {
    const link = await renderItemLink(id, api);
    list.appendChild(link);
  }

  if (truncated) {
    const more = api.createElement('div', {
      style: 'font-size: 12px; color: var(--color-border-dark); font-style: italic; padding: 2px 0;'
    }, ['\u2026 and ' + (uniqueIds.length - TRUNCATE_LIMIT) + ' more']);
    list.appendChild(more);
  }

  group.appendChild(list);
  return group;
}

async function renderItemLink(itemId, api) {
  let item;
  try { item = await api.get(itemId); } catch (e) { item = null; }

  const row = api.createElement('div', {
    style: 'display: flex; align-items: baseline; gap: 6px; padding: 3px 0; cursor: pointer; border-radius: var(--border-radius); transition: background 0.15s;'
  }, []);

  if (!item) {
    const deleted = api.createElement('span', {
      style: 'color: var(--color-border-dark); font-style: italic; font-size: 13px;'
    }, ['[deleted: ' + itemId.substring(0, 13) + ']']);
    row.appendChild(deleted);
    return row;
  }

  const name = api.createElement('span', {
    style: 'color: var(--color-link, #2563eb); font-size: 13px;'
  }, [item.name || itemId.substring(0, 8)]);
  row.appendChild(name);

  // Show type name in muted text
  if (item.type) {
    let typeItem;
    try { typeItem = await api.get(item.type); } catch (e) { typeItem = null; }
    if (typeItem) {
      const typeName = api.createElement('span', {
        style: 'color: var(--color-border-dark); font-size: 11px;'
      }, [typeItem.name || '']);
      row.appendChild(typeName);
    }
  }

  row.onmouseover = () => { row.style.background = 'var(--color-bg-surface-alt, #f3f4f6)'; };
  row.onmouseout = () => { row.style.background = ''; };
  row.onclick = (e) => {
    e.stopPropagation();
    api.siblingContainer?.addSibling(itemId);
  };

  return row;
}

// Declarative watch handler: called when viewport selection changes
export async function onViewportSelectionChanged(payload, api) {
  const selectedId = payload?.current?.itemId;
  if (selectedId) {
    let item;
    try { item = await api.get(selectedId); } catch (e) { item = null; }
    if (item && item.type === WIDGET_TYPE_ID) return;
  }
  await api.rerenderByType(WIDGET_TYPE_ID);
}
