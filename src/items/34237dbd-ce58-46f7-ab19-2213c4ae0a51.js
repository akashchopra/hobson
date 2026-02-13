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

const TRUNCATE_LIMIT = 30;

export async function render(widget, api) {
  const selectionMgr = await api.require('selection-manager');
  const relatedLib = await api.require('related-items-lib');
  const tagTreeBuilder = await api.require('tag-tree-builder');

  const container = api.createElement('div', {
    style: 'max-width: 600px; margin: 0 auto; font-size: 0.875rem;'
  }, []);

  // Ensure indexes are built (rebuilds if module cache was cleared)
  await relatedLib.ensureBuilt(api);

  // Prefer explicit targetId on the widget (e.g. from modal context menu),
  // fall back to global selection (e.g. docked widget watching viewport)
  const selectedId = widget.content?.targetId || selectionMgr.getSelection();

  // Header - shows selection state
  const header = api.createElement('div', {
    style: 'margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid var(--color-border-light);'
  }, []);
  container.appendChild(header);

  if (!selectedId) {
    const title = api.createElement('h2', {
      style: 'margin: 0; font-size: 0.875rem; color: var(--color-border-dark); font-style: italic;'
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
      style: 'margin: 0; font-size: 1.125rem; color: var(--color-border-dark); font-style: italic;'
    }, ['Item not found']);
    header.appendChild(title);
    return container;
  }

  const title = api.createElement('h2', {
    style: 'margin: 0; font-size: 1rem;'
  }, ['Related to: ' + (selectedItem.name || selectedId.substring(0, 8))]);
  header.appendChild(title);

  const related = await relatedLib.getRelated(selectedId, api);
  if (!related) {
    return container;
  }

  // Render forward groups
  const forwardSection = await renderSection('Forward', FORWARD_GROUPS, related, api, { tagTreeBuilder });
  if (forwardSection) body.appendChild(forwardSection);

  // Render inverse groups
  const inverseSection = await renderSection('Inverse', INVERSE_GROUPS, related, api, { relatedLib, selectedId, tagTreeBuilder });
  if (inverseSection) body.appendChild(inverseSection);

  return container;
}

async function renderSection(sectionLabel, groups, related, api, context) {
  const nonEmpty = [];

  for (const [label, key, isSingle] of groups) {
    const value = related[key];
    if (isSingle) {
      if (value) nonEmpty.push([label, [value], key]);
    } else {
      if (Array.isArray(value) && value.length > 0) nonEmpty.push([label, value, key]);
    }
  }

  if (nonEmpty.length === 0) return null;

  const section = api.createElement('div', {
    style: 'margin-bottom: 16px;'
  }, []);

  const heading = api.createElement('h3', {
    style: 'margin: 0 0 8px 0; font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-border-dark);'
  }, [sectionLabel]);
  section.appendChild(heading);

  for (const [label, ids, key] of nonEmpty) {
    // Special grouped rendering for Tagged With when sub-tags exist
    if (key === 'taggedWith' && context?.relatedLib) {
      const tagGroups = context.relatedLib.getItemsTaggedWithGrouped(context.selectedId);
      if (tagGroups.length > 1) {
        const group = await renderTaggedWithGrouped(label, tagGroups, context.selectedId, api, context.tagTreeBuilder);
        section.appendChild(group);
        continue;
      }
    }
    const group = await renderGroup(label, ids, api, { fullyQualified: key === 'tags', tagTreeBuilder: context?.tagTreeBuilder });
    section.appendChild(group);
  }

  return section;
}

async function renderGroup(label, ids, api, opts = {}) {
  const group = api.createElement('div', {
    style: 'margin-bottom: 12px;'
  }, []);

  const groupLabel = api.createElement('div', {
    style: 'font-weight: 600; margin-bottom: 4px; font-size: 0.8125rem;'
  }, [label]);
  group.appendChild(groupLabel);

  const list = api.createElement('div', {
    style: 'padding-left: 8px;'
  }, []);

  const uniqueIds = [...new Set(ids)];

  // Resolve display names (fully qualified for tags)
  const nameMap = new Map();
  for (const id of uniqueIds) {
    if (opts.fullyQualified && opts.tagTreeBuilder) {
      nameMap.set(id, await opts.tagTreeBuilder.getFullyQualifiedName(id, api));
    } else {
      let it;
      try { it = await api.get(id); } catch (e) { it = null; }
      nameMap.set(id, it?.name || '');
    }
  }
  uniqueIds.sort((a, b) => nameMap.get(a).toLowerCase().localeCompare(nameMap.get(b).toLowerCase()));

  const truncated = uniqueIds.length > TRUNCATE_LIMIT;
  const displayIds = truncated ? uniqueIds.slice(0, TRUNCATE_LIMIT) : uniqueIds;

  for (const id of displayIds) {
    const link = await renderItemLink(id, api, opts.fullyQualified ? nameMap.get(id) : undefined);
    list.appendChild(link);
  }

  if (truncated) {
    const more = api.createElement('div', {
      style: 'font-size: 0.75rem; color: var(--color-border-dark); font-style: italic; padding: 2px 0;'
    }, ['\u2026 and ' + (uniqueIds.length - TRUNCATE_LIMIT) + ' more']);
    list.appendChild(more);
  }

  group.appendChild(list);
  return group;
}

async function renderTaggedWithGrouped(label, tagGroups, selectedId, api, tagTreeBuilder) {
  const group = api.createElement('div', {
    style: 'margin-bottom: 12px;'
  }, []);

  const groupLabel = api.createElement('div', {
    style: 'font-weight: 600; margin-bottom: 4px; font-size: 0.8125rem;'
  }, [label]);
  group.appendChild(groupLabel);

  // Get fully qualified root tag name for full path display
  const rootName = await tagTreeBuilder.getFullyQualifiedName(selectedId, api);

  for (const { tagId, items } of tagGroups) {
    const path = tagId === selectedId
      ? rootName
      : rootName + ' / ' + await tagTreeBuilder.getFullyQualifiedName(tagId, api, selectedId);

    const subSection = api.createElement('div', {
      style: 'margin-left: 8px; margin-bottom: 8px;'
    }, []);

    const subLabel = api.createElement('div', {
      style: 'font-weight: 500; font-size: 0.75rem; color: var(--color-border-dark); margin-bottom: 2px;'
    }, [path + ' (' + items.length + ')']);
    subSection.appendChild(subLabel);

    const list = api.createElement('div', {
      style: 'padding-left: 8px;'
    }, []);

    const uniqueIds = [...new Set(items)];
    const nameMap = new Map();
    for (const id of uniqueIds) {
      let it;
      try { it = await api.get(id); } catch (e) { it = null; }
      nameMap.set(id, (it?.name || '').toLowerCase());
    }
    uniqueIds.sort((a, b) => nameMap.get(a).localeCompare(nameMap.get(b)));

    const truncated = uniqueIds.length > TRUNCATE_LIMIT;
    const displayIds = truncated ? uniqueIds.slice(0, TRUNCATE_LIMIT) : uniqueIds;

    for (const id of displayIds) {
      const link = await renderItemLink(id, api);
      list.appendChild(link);
    }

    if (truncated) {
      const more = api.createElement('div', {
        style: 'font-size: 0.75rem; color: var(--color-border-dark); font-style: italic; padding: 2px 0;'
      }, ['\u2026 and ' + (uniqueIds.length - TRUNCATE_LIMIT) + ' more']);
      list.appendChild(more);
    }

    subSection.appendChild(list);
    group.appendChild(subSection);
  }

  return group;
}

async function renderItemLink(itemId, api, displayName) {
  let item;
  try { item = await api.get(itemId); } catch (e) { item = null; }

  const row = api.createElement('div', {
    style: 'display: flex; align-items: baseline; gap: 6px; padding: 3px 0; cursor: pointer; border-radius: var(--border-radius); transition: background 0.15s;'
  }, []);

  if (!item) {
    const deleted = api.createElement('span', {
      style: 'color: var(--color-border-dark); font-style: italic; font-size: 0.8125rem;'
    }, ['[deleted: ' + itemId.substring(0, 13) + ']']);
    row.appendChild(deleted);
    return row;
  }

  const name = api.createElement('span', {
    style: 'color: var(--color-link, #2563eb); font-size: 0.8125rem;'
  }, [displayName || item.name || itemId.substring(0, 8)]);
  row.appendChild(name);

  // Show type name in muted text
  if (item.type) {
    let typeItem;
    try { typeItem = await api.get(item.type); } catch (e) { typeItem = null; }
    if (typeItem) {
      const typeName = api.createElement('span', {
        style: 'color: var(--color-border-dark); font-size: 0.6875rem;'
      }, [typeItem.name || '']);
      row.appendChild(typeName);
    }
  }

  row.onmouseover = () => { row.style.background = 'var(--color-bg-surface-alt, #f3f4f6)'; };
  row.onmouseout = () => { row.style.background = ''; };
  row.onclick = (e) => {
    e.stopPropagation();
    api.openItem(itemId);
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
