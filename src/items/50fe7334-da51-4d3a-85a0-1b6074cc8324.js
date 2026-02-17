// field-view-hob-structural — Structural editor for Hob JSON AST (Phase 2a: Mutation Infrastructure)

// --- Special forms for indentation ---
const SPECIAL_FORMS = new Set([
  'let', 'defn', 'fn', 'if', 'when', 'cond', 'do', 'loop', 'try',
  'def-view', 'def-watch', '->', '->>', 'for', 'doseq', 'def', 'defmacro',
  'on-event!', 'match', 'case', 'binding'
]);
const BINDING_FORMS = new Set(['let', 'loop', 'binding', 'for', 'doseq']);

// --- Inflater: compact JSON AST → editor AST ---

function inflateAll(compactForms) {
  let nextId = 1;
  const nodeMap = new Map();
  const parentMap = new Map();

  function inflate(compact) {
    let node;
    if (compact === null) {
      node = { id: nextId++, type: 'nil' };
    } else if (typeof compact === 'number') {
      node = { id: nextId++, type: 'number', value: compact };
    } else if (typeof compact === 'boolean') {
      node = { id: nextId++, type: 'boolean', value: compact };
    } else if (typeof compact === 'string') {
      if (compact.startsWith(':')) {
        node = { id: nextId++, type: 'keyword', value: compact.slice(1) };
      } else if (compact.startsWith('@')) {
        node = { id: nextId++, type: 'item-ref', value: compact.slice(1) };
      } else {
        node = { id: nextId++, type: 'symbol', value: compact };
      }
    } else if (Array.isArray(compact)) {
      node = { id: nextId++, type: 'list', children: [] };
      nodeMap.set(node.id, node);
      node.children = compact.map(child => {
        const cNode = inflate(child);
        parentMap.set(cNode.id, node);
        return cNode;
      });
      return node;
    } else if (compact.s !== undefined) {
      node = { id: nextId++, type: 'string', value: compact.s };
    } else if (compact.v) {
      node = { id: nextId++, type: 'vector', children: [] };
      nodeMap.set(node.id, node);
      node.children = compact.v.map(child => {
        const cNode = inflate(child);
        parentMap.set(cNode.id, node);
        return cNode;
      });
      return node;
    } else if (compact.m) {
      node = { id: nextId++, type: 'map', children: [] };
      nodeMap.set(node.id, node);
      node.children = compact.m.flatMap(([k, v]) => {
        const kNode = inflate(k);
        const vNode = inflate(v);
        parentMap.set(kNode.id, node);
        parentMap.set(vNode.id, node);
        return [kNode, vNode];
      });
      return node;
    } else {
      node = { id: nextId++, type: 'nil' }; // fallback
    }
    nodeMap.set(node.id, node);
    return node;
  }

  const root = { id: 0, type: 'root', children: [] };
  nodeMap.set(0, root);
  root.children = compactForms.map(form => {
    const child = inflate(form);
    parentMap.set(child.id, root);
    return child;
  });

  return { root, nodeMap, parentMap };
}

// --- Deflater: editor AST → compact JSON AST (inverse of inflate) ---

function deflate(node) {
  switch (node.type) {
    case 'nil': return null;
    case 'number': return node.value;
    case 'boolean': return node.value;
    case 'symbol': return node.value;
    case 'keyword': return ':' + node.value;
    case 'item-ref': return '@' + node.value;
    case 'string': return { s: node.value };
    case 'list': return node.children.map(deflate);
    case 'vector': return { v: node.children.map(deflate) };
    case 'map': {
      const pairs = [];
      for (let i = 0; i < node.children.length; i += 2) {
        pairs.push([deflate(node.children[i]), deflate(node.children[i + 1])]);
      }
      return { m: pairs };
    }
    default: return null;
  }
}

function deflateAll(root) {
  return root.children.map(deflate);
}

// --- Flat width calculation ---

function leafText(node) {
  switch (node.type) {
    case 'nil': return 'nil';
    case 'number': return String(node.value);
    case 'boolean': return String(node.value);
    case 'symbol': return node.value;
    case 'keyword': return ':' + node.value;
    case 'string': return '"' + node.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    case 'item-ref': return '@' + node.value.slice(0, 8);
    default: return '';
  }
}

function flatWidth(node) {
  if (node._fw !== undefined) return node._fw;
  if (node.children) {
    if (node.type === 'list') {
      const inner = node.children.reduce((s, c) => s + flatWidth(c), 0);
      node._fw = 2 + inner + Math.max(0, node.children.length - 1); // parens + spaces
    } else if (node.type === 'vector') {
      const inner = node.children.reduce((s, c) => s + flatWidth(c), 0);
      node._fw = 2 + inner + Math.max(0, node.children.length - 1);
    } else if (node.type === 'map') {
      const inner = node.children.reduce((s, c) => s + flatWidth(c), 0);
      // pairs: key val key val — spaces between all, plus braces
      node._fw = 2 + inner + Math.max(0, node.children.length - 1);
    } else {
      node._fw = 0;
    }
  } else {
    node._fw = leafText(node).length;
  }
  return node._fw;
}

// --- DOM Renderer ---

const MAX_LINE = 60;

function renderNode(node, state, itemNames, api, indent) {
  if (!node.children) {
    return renderLeaf(node, state, itemNames, api);
  }
  if (node.type === 'list') return renderList(node, state, itemNames, api, indent);
  if (node.type === 'vector') return renderCollection(node, '[', ']', 'hob-vector', state, itemNames, api, indent);
  if (node.type === 'map') return renderMap(node, state, itemNames, api, indent);
  return renderLeaf(node, state, itemNames, api); // fallback
}

function renderLeaf(node, state, itemNames, api) {
  const span = document.createElement('span');
  span.setAttribute('data-node-id', node.id);
  state.domMap.set(node.id, span);

  switch (node.type) {
    case 'nil':
      span.className = 'hob-nil';
      span.textContent = 'nil';
      break;
    case 'number':
      span.className = 'hob-number';
      span.textContent = String(node.value);
      break;
    case 'boolean':
      span.className = 'hob-boolean';
      span.textContent = String(node.value);
      break;
    case 'symbol':
      span.className = SPECIAL_FORMS.has(node.value) ? 'hob-symbol hob-special' : 'hob-symbol';
      span.textContent = node.value;
      break;
    case 'keyword':
      span.className = 'hob-keyword';
      span.textContent = ':' + node.value;
      break;
    case 'string':
      span.className = 'hob-string';
      span.textContent = '"' + node.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
      break;
    case 'item-ref': {
      const name = itemNames.get(node.value) || node.value.slice(0, 8);
      span.className = 'hob-item-ref';
      span.textContent = name;
      span.title = node.value;
      break;
    }
    default:
      span.textContent = '?';
  }

  return span;
}

function ws() {
  const s = document.createElement('span');
  s.className = 'hob-ws';
  s.textContent = ' ';
  return s;
}

function newline(indentLevel) {
  const nl = document.createElement('span');
  nl.className = 'hob-newline';
  nl.textContent = '\n';
  const ind = document.createElement('span');
  ind.className = 'hob-indent';
  ind.textContent = ' '.repeat(indentLevel);
  const frag = document.createDocumentFragment();
  frag.appendChild(nl);
  frag.appendChild(ind);
  return frag;
}

function delim(text) {
  const s = document.createElement('span');
  s.className = 'hob-delim';
  s.textContent = text;
  return s;
}

function renderList(node, state, itemNames, api, indent) {
  const span = document.createElement('span');
  span.className = 'hob-list';
  span.setAttribute('data-node-id', node.id);
  state.domMap.set(node.id, span);

  if (node.children.length === 0) {
    span.appendChild(delim('('));
    span.appendChild(delim(')'));
    return span;
  }

  const fw = flatWidth(node);

  // Check if the head is a special form
  const head = node.children[0];
  const headName = (head.type === 'symbol') ? head.value : null;
  const isSpecial = headName && SPECIAL_FORMS.has(headName);
  const isBinding = headName && BINDING_FORMS.has(headName);

  // Try flat rendering
  if (fw <= MAX_LINE) {
    span.appendChild(delim('('));
    for (let i = 0; i < node.children.length; i++) {
      if (i > 0) span.appendChild(ws());
      span.appendChild(renderNode(node.children[i], state, itemNames, api, indent + 2));
    }
    span.appendChild(delim(')'));
    return span;
  }

  // Multi-line rendering
  span.appendChild(delim('('));

  if (isSpecial) {
    // Render head
    span.appendChild(renderNode(head, state, itemNames, api, indent + 2));
    const bodyIndent = indent + 2;

    if (isBinding && node.children.length >= 2) {
      // binding form: (let [bindings...] body...)
      // Head + space + bindings on first line, then body indented
      span.appendChild(ws());
      span.appendChild(renderNode(node.children[1], state, itemNames, api, bodyIndent));
      for (let i = 2; i < node.children.length; i++) {
        span.appendChild(newline(bodyIndent));
        span.appendChild(renderNode(node.children[i], state, itemNames, api, bodyIndent));
      }
    } else {
      // Non-binding special: (defn name args\n  body...)
      // Put first 1-2 args on same line as head, rest indented
      const argsOnLine = (headName === 'defn' || headName === 'defmacro') ? 2 : 1;
      for (let i = 1; i < node.children.length; i++) {
        if (i <= argsOnLine) {
          span.appendChild(ws());
        } else {
          span.appendChild(newline(bodyIndent));
        }
        span.appendChild(renderNode(node.children[i], state, itemNames, api, bodyIndent));
      }
    }
  } else {
    // Normal list: first child, then all remaining indented
    span.appendChild(renderNode(head, state, itemNames, api, indent + 2));
    const restIndent = indent + 2;
    for (let i = 1; i < node.children.length; i++) {
      span.appendChild(newline(restIndent));
      span.appendChild(renderNode(node.children[i], state, itemNames, api, restIndent));
    }
  }

  span.appendChild(delim(')'));
  return span;
}

function renderCollection(node, open, close, className, state, itemNames, api, indent) {
  const span = document.createElement('span');
  span.className = className;
  span.setAttribute('data-node-id', node.id);
  state.domMap.set(node.id, span);

  if (node.children.length === 0) {
    span.appendChild(delim(open));
    span.appendChild(delim(close));
    return span;
  }

  const fw = flatWidth(node);

  if (fw <= MAX_LINE) {
    span.appendChild(delim(open));
    for (let i = 0; i < node.children.length; i++) {
      if (i > 0) span.appendChild(ws());
      span.appendChild(renderNode(node.children[i], state, itemNames, api, indent + 1));
    }
    span.appendChild(delim(close));
  } else {
    const childIndent = indent + 1;
    span.appendChild(delim(open));
    span.appendChild(renderNode(node.children[0], state, itemNames, api, childIndent));
    for (let i = 1; i < node.children.length; i++) {
      span.appendChild(newline(childIndent));
      span.appendChild(renderNode(node.children[i], state, itemNames, api, childIndent));
    }
    span.appendChild(delim(close));
  }

  return span;
}

function renderMap(node, state, itemNames, api, indent) {
  const span = document.createElement('span');
  span.className = 'hob-map';
  span.setAttribute('data-node-id', node.id);
  state.domMap.set(node.id, span);

  if (node.children.length === 0) {
    span.appendChild(delim('{'));
    span.appendChild(delim('}'));
    return span;
  }

  const fw = flatWidth(node);

  if (fw <= MAX_LINE) {
    span.appendChild(delim('{'));
    for (let i = 0; i < node.children.length; i++) {
      if (i > 0) span.appendChild(ws());
      span.appendChild(renderNode(node.children[i], state, itemNames, api, indent + 1));
    }
    span.appendChild(delim('}'));
  } else {
    const childIndent = indent + 1;
    span.appendChild(delim('{'));
    // Render as key-value pairs, one pair per line
    for (let i = 0; i < node.children.length; i += 2) {
      if (i > 0) span.appendChild(newline(childIndent));
      span.appendChild(renderNode(node.children[i], state, itemNames, api, childIndent));
      if (i + 1 < node.children.length) {
        span.appendChild(ws());
        span.appendChild(renderNode(node.children[i + 1], state, itemNames, api, childIndent));
      }
    }
    span.appendChild(delim('}'));
  }

  return span;
}

function renderAST(root, state, itemNames, api) {
  const el = document.createElement('div');
  el.className = 'hob-editor';
  el.setAttribute('tabindex', '0');

  for (let i = 0; i < root.children.length; i++) {
    if (i > 0) {
      // Blank line between top-level forms
      el.appendChild(document.createTextNode('\n\n'));
    }
    el.appendChild(renderNode(root.children[i], state, itemNames, api, 0));
  }

  return el;
}

// --- Rerender ---

function clearFlatWidth(node) {
  delete node._fw;
  if (node.children) node.children.forEach(clearFlatWidth);
}

function rerender(state, itemNames, api, statusBar) {
  // Clear cached flat widths (stale after mutations)
  clearFlatWidth(state.nodeMap.get(0));

  // Clear domMap
  state.domMap = new Map();

  // Rebuild DOM children (reuse same editorEl to preserve event listeners)
  state.editorEl.textContent = '';
  const root = state.nodeMap.get(0);
  for (let i = 0; i < root.children.length; i++) {
    if (i > 0) state.editorEl.appendChild(document.createTextNode('\n\n'));
    state.editorEl.appendChild(renderNode(root.children[i], state, itemNames, api, 0));
  }

  // Validate selection still exists
  if (state.selectedId != null && !state.nodeMap.has(state.selectedId)) {
    state.selectedId = root.children[0]?.id || null;
  }
  state.expansionStack = [];

  updateSelectionVisual(state);
  updateStatusBar(state, statusBar);
}

// --- Undo/Redo (snapshot approach) ---

function getNodePath(nodeId, state) {
  const path = [];
  let current = state.nodeMap.get(nodeId);
  if (!current) return null;
  let parent = state.parentMap.get(nodeId);
  while (parent) {
    const idx = parent.children.indexOf(current);
    if (idx === -1) return null;
    path.unshift(idx);
    current = parent;
    parent = state.parentMap.get(current.id);
  }
  return path;
}

function resolveNodePath(path, root) {
  let node = root;
  for (const idx of path) {
    if (!node.children || idx >= node.children.length) return null;
    node = node.children[idx];
  }
  return node;
}

function pushUndo(state) {
  const root = state.nodeMap.get(0);
  const compact = JSON.stringify(deflateAll(root));
  const selectionPath = state.selectedId != null ? getNodePath(state.selectedId, state) : null;
  state.undoStack.push({ compact, selectionPath });
  if (state.undoStack.length > 100) state.undoStack.shift();
  state.redoStack = [];
}

function restoreFromCompact(state, compactForms, selectionPath) {
  const { root, nodeMap, parentMap } = inflateAll(compactForms);
  // Replace maps in place so all references stay valid
  state.nodeMap.clear();
  for (const [k, v] of nodeMap) state.nodeMap.set(k, v);
  state.parentMap.clear();
  for (const [k, v] of parentMap) state.parentMap.set(k, v);
  // Restore selection
  if (selectionPath) {
    const node = resolveNodePath(selectionPath, root);
    state.selectedId = node ? node.id : (root.children[0]?.id || null);
  } else {
    state.selectedId = root.children[0]?.id || null;
  }
}

function notifyChange(state) {
  if (state.onChange) {
    const root = state.nodeMap.get(0);
    state.onChange(deflateAll(root));
  }
}

function undo(state, itemNames, api, statusBar) {
  if (state.undoStack.length === 0) return;
  // Push current state to redo
  const root = state.nodeMap.get(0);
  const currentCompact = JSON.stringify(deflateAll(root));
  const currentPath = state.selectedId != null ? getNodePath(state.selectedId, state) : null;
  state.redoStack.push({ compact: currentCompact, selectionPath: currentPath });
  // Pop undo
  const snapshot = state.undoStack.pop();
  restoreFromCompact(state, JSON.parse(snapshot.compact), snapshot.selectionPath);
  rerender(state, itemNames, api, statusBar);
  notifyChange(state);
}

function redo(state, itemNames, api, statusBar) {
  if (state.redoStack.length === 0) return;
  // Push current state to undo
  const root = state.nodeMap.get(0);
  const currentCompact = JSON.stringify(deflateAll(root));
  const currentPath = state.selectedId != null ? getNodePath(state.selectedId, state) : null;
  state.undoStack.push({ compact: currentCompact, selectionPath: currentPath });
  // Pop redo
  const snapshot = state.redoStack.pop();
  restoreFromCompact(state, JSON.parse(snapshot.compact), snapshot.selectionPath);
  rerender(state, itemNames, api, statusBar);
  notifyChange(state);
}

// --- Mutation wrapper ---

function applyMutation(state, itemNames, api, statusBar, mutationFn) {
  pushUndo(state);
  mutationFn();
  rerender(state, itemNames, api, statusBar);
  notifyChange(state);
}

// --- Delete operation ---

function removeFromMaps(node, state) {
  state.nodeMap.delete(node.id);
  state.parentMap.delete(node.id);
  if (node.children) node.children.forEach(child => removeFromMaps(child, state));
}

function deleteSelected(state) {
  const node = state.nodeMap.get(state.selectedId);
  if (!node) return;
  const parent = state.parentMap.get(state.selectedId);
  if (!parent || !parent.children) return;

  // Prevent deleting the last top-level form
  if (parent.type === 'root' && parent.children.length <= 1) return;

  const idx = parent.children.indexOf(node);
  if (idx === -1) return;

  if (parent.type === 'map') {
    // Map special case: delete the entire key-value pair
    const pairStart = idx % 2 === 0 ? idx : idx - 1;
    const removed = parent.children.splice(pairStart, 2);
    removed.forEach(n => removeFromMaps(n, state));
    // Selection: next pair, or previous pair, or parent
    if (parent.children.length === 0) {
      state.selectedId = parent.id;
    } else if (pairStart < parent.children.length) {
      state.selectedId = parent.children[pairStart].id;
    } else {
      state.selectedId = parent.children[parent.children.length - 2].id; // key of last pair
    }
  } else {
    // Normal case: remove single child
    parent.children.splice(idx, 1);
    removeFromMaps(node, state);
    // Selection: next sibling → previous sibling → parent
    if (parent.children.length === 0) {
      state.selectedId = parent.id;
    } else if (idx < parent.children.length) {
      state.selectedId = parent.children[idx].id;
    } else {
      state.selectedId = parent.children[idx - 1].id;
    }
  }
}

// --- Selection System ---

function updateSelectionVisual(state) {
  // Remove previous selection
  const prevSelected = state.editorEl?.querySelector('.hob-selected');
  if (prevSelected) prevSelected.classList.remove('hob-selected');
  const prevAncestors = state.editorEl?.querySelectorAll('.hob-ancestor');
  if (prevAncestors) prevAncestors.forEach(el => el.classList.remove('hob-ancestor'));

  if (state.selectedId == null) return;

  // Add selection to current
  const el = state.domMap.get(state.selectedId);
  if (!el) return;
  el.classList.add('hob-selected');

  // Walk parent chain for ancestor highlighting
  let parentNode = state.parentMap.get(state.selectedId);
  while (parentNode && parentNode.type !== 'root') {
    const parentEl = state.domMap.get(parentNode.id);
    if (parentEl) parentEl.classList.add('hob-ancestor');
    parentNode = state.parentMap.get(parentNode.id);
  }

  // Scroll into view
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function nodeLabel(node) {
  if (!node) return '?';
  if (node.type === 'root') return 'root';
  if (node.type === 'list' && node.children.length > 0 && node.children[0].type === 'symbol') {
    return '(' + node.children[0].value + ')';
  }
  if (node.type === 'list') return '()';
  if (node.type === 'vector') return '[]';
  if (node.type === 'map') return '{}';
  return leafText(node);
}

function updateStatusBar(state, statusBar) {
  const breadcrumbsEl = statusBar.querySelector('.hob-breadcrumbs');
  const nodeInfoEl = statusBar.querySelector('.hob-node-info');
  const modeEl = statusBar.querySelector('.hob-mode');

  if (state.selectedId == null) {
    breadcrumbsEl.textContent = '';
    nodeInfoEl.textContent = '';
    return;
  }

  const node = state.nodeMap.get(state.selectedId);
  if (!node) return;

  // Update mode indicator
  if (state.onChange) {
    modeEl.textContent = state.mode === 'nav' ? 'NAV' : state.mode.toUpperCase();
    modeEl.className = 'hob-mode hob-mode-nav';
  } else {
    modeEl.textContent = 'VIEW';
    modeEl.className = 'hob-mode hob-mode-view';
  }

  // Build breadcrumb chain
  const chain = [];
  let current = node;
  while (current) {
    chain.unshift(current);
    current = state.parentMap.get(current.id);
  }

  // Render breadcrumbs
  breadcrumbsEl.textContent = '';
  for (let i = 0; i < chain.length; i++) {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'hob-breadcrumb-sep';
      sep.textContent = ' \u203a ';
      breadcrumbsEl.appendChild(sep);
    }
    const crumb = document.createElement('span');
    crumb.textContent = nodeLabel(chain[i]);
    const crumbNodeId = chain[i].id;
    crumb.addEventListener('click', (e) => {
      e.stopPropagation();
      state.selectedId = crumbNodeId;
      state.expansionStack = [];
      updateSelectionVisual(state);
      updateStatusBar(state, statusBar);
    });
    breadcrumbsEl.appendChild(crumb);
  }

  // Node info
  if (node.children) {
    nodeInfoEl.textContent = node.type + ' (' + node.children.length + ')';
  } else {
    nodeInfoEl.textContent = node.type + ': ' + leafText(node);
  }
}

// --- Navigation ---

function siblingIndex(node, parentMap, nodeMap) {
  const parent = parentMap.get(node.id);
  if (!parent || !parent.children) return -1;
  return parent.children.indexOf(node);
}

function handleKey(e, ctx) {
  const { state, statusBar, itemNames, api } = ctx;
  const node = state.nodeMap.get(state.selectedId);
  if (!node) return;
  const parent = state.parentMap.get(state.selectedId);

  let handled = true;

  if (e.key === 'ArrowLeft' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    // Previous sibling
    if (parent && parent.children) {
      const idx = parent.children.indexOf(node);
      if (idx > 0) {
        state.selectedId = parent.children[idx - 1].id;
        state.expansionStack = [];
      }
    }
  } else if (e.key === 'ArrowRight' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    // Next sibling
    if (parent && parent.children) {
      const idx = parent.children.indexOf(node);
      if (idx < parent.children.length - 1) {
        state.selectedId = parent.children[idx + 1].id;
        state.expansionStack = [];
      }
    }
  } else if (e.key === 'ArrowUp' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    // Select parent
    if (parent && parent.type !== 'root') {
      state.selectedId = parent.id;
      state.expansionStack = [];
    }
  } else if (e.key === 'ArrowDown' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    // Select first child
    if (node.children && node.children.length > 0) {
      state.selectedId = node.children[0].id;
      state.expansionStack = [];
    }
  } else if (e.key === 'Home' && !e.ctrlKey && !e.metaKey) {
    // First sibling
    if (parent && parent.children && parent.children.length > 0) {
      state.selectedId = parent.children[0].id;
      state.expansionStack = [];
    }
  } else if (e.key === 'End' && !e.ctrlKey && !e.metaKey) {
    // Last sibling
    if (parent && parent.children && parent.children.length > 0) {
      state.selectedId = parent.children[parent.children.length - 1].id;
      state.expansionStack = [];
    }
  } else if (e.key === 'ArrowUp' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
    // Select top-level: walk up to root's child
    let cur = node;
    let curParent = parent;
    while (curParent && curParent.type !== 'root') {
      cur = curParent;
      curParent = state.parentMap.get(curParent.id);
    }
    if (cur.id !== node.id) {
      state.selectedId = cur.id;
      state.expansionStack = [];
    }
  } else if (e.key === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
    // Previous top-level form
    const root = state.nodeMap.get(0);
    let cur = node;
    let curParent = parent;
    while (curParent && curParent.type !== 'root') {
      cur = curParent;
      curParent = state.parentMap.get(curParent.id);
    }
    const idx = root.children.indexOf(cur);
    if (idx > 0) {
      state.selectedId = root.children[idx - 1].id;
      state.expansionStack = [];
    }
  } else if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
    // Next top-level form
    const root = state.nodeMap.get(0);
    let cur = node;
    let curParent = parent;
    while (curParent && curParent.type !== 'root') {
      cur = curParent;
      curParent = state.parentMap.get(curParent.id);
    }
    const idx = root.children.indexOf(cur);
    if (idx < root.children.length - 1) {
      state.selectedId = root.children[idx + 1].id;
      state.expansionStack = [];
    }
  } else if (e.key === 'ArrowUp' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
    // Expand selection: push current, select parent
    if (parent && parent.type !== 'root') {
      state.expansionStack.push(state.selectedId);
      state.selectedId = parent.id;
    }
  } else if (e.key === 'ArrowDown' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
    // Contract selection: pop from stack
    if (state.expansionStack.length > 0) {
      state.selectedId = state.expansionStack.pop();
    }
  } else if (e.key === 'Escape') {
    // Select parent, or clear if at root level
    if (parent && parent.type !== 'root') {
      state.selectedId = parent.id;
      state.expansionStack = [];
    }
  } else if ((e.key === 'Backspace' || e.key === 'Delete') && state.onChange) {
    // Delete selected node (editable mode only)
    applyMutation(state, itemNames, api, statusBar, () => deleteSelected(state));
  } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && state.onChange) {
    // Undo
    undo(state, itemNames, api, statusBar);
  } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey && state.onChange) {
    // Redo
    redo(state, itemNames, api, statusBar);
  } else {
    handled = false;
  }

  if (handled) {
    e.preventDefault();
    e.stopPropagation();
    updateSelectionVisual(state);
    updateStatusBar(state, statusBar);
  }
}

function handleClick(e, ctx) {
  const { state, statusBar } = ctx;
  const target = e.target.closest('[data-node-id]');
  if (!target) return;
  const id = parseInt(target.getAttribute('data-node-id'), 10);
  if (!state.nodeMap.has(id)) return;
  state.selectedId = id;
  state.expansionStack = [];
  updateSelectionVisual(state);
  updateStatusBar(state, statusBar);
}

// --- Status Bar Builder ---

function buildStatusBar() {
  const bar = document.createElement('div');
  bar.className = 'hob-status-bar';

  const breadcrumbs = document.createElement('span');
  breadcrumbs.className = 'hob-breadcrumbs';

  const nodeInfo = document.createElement('span');
  nodeInfo.className = 'hob-node-info';

  const mode = document.createElement('span');
  mode.className = 'hob-mode';
  mode.textContent = 'NAV';

  bar.appendChild(breadcrumbs);
  bar.appendChild(nodeInfo);
  bar.appendChild(mode);

  return bar;
}

// --- Main render entry point ---

export async function render(value, options, api) {
  // Load CSS
  const cssLoader = await api.require('css-loader-lib');
  await cssLoader.loadCSS('hob-structural-css', api);

  // Handle empty/missing value
  if (!value || !Array.isArray(value) || value.length === 0) {
    const empty = api.createElement('div');
    empty.className = 'hob-empty';
    empty.textContent = 'No Hob code';
    empty.style.cssText = 'border: 1px solid var(--color-border); border-radius: var(--border-radius); padding: 24px; text-align: center; color: var(--color-text-tertiary); font-style: italic;';
    return empty;
  }

  // Inflate AST
  const { root, nodeMap, parentMap } = inflateAll(value);

  // Build state
  const state = {
    selectedId: root.children[0]?.id || null,
    expansionStack: [],
    nodeMap,
    parentMap,
    domMap: new Map(),
    editorEl: null,
    onChange: options.onChange || null,
    mode: 'nav',
    undoStack: [],
    redoStack: []
  };

  // Resolve item references (async, batch)
  const itemRefs = [...nodeMap.values()].filter(n => n.type === 'item-ref');
  const itemNames = new Map();
  await Promise.all(itemRefs.map(async (ref) => {
    try {
      const it = await api.get(ref.value);
      itemNames.set(ref.value, it.name || ref.value.slice(0, 8));
    } catch {
      itemNames.set(ref.value, ref.value.slice(0, 8));
    }
  }));

  // Render AST to DOM
  const editorEl = renderAST(root, state, itemNames, api);
  state.editorEl = editorEl;

  // Status bar
  const statusBar = buildStatusBar();

  // Wrapper
  const wrapper = api.createElement('div');
  wrapper.style.cssText = 'display: flex; flex-direction: column; border: 1px solid var(--color-border); border-radius: var(--border-radius); overflow: hidden; min-height: 200px;';
  wrapper.appendChild(editorEl);
  wrapper.appendChild(statusBar);

  // Event context (shared by key and click handlers)
  const ctx = { state, statusBar, itemNames, api };

  // Key handler
  editorEl.addEventListener('keydown', (e) => handleKey(e, ctx));

  // Click handler
  editorEl.addEventListener('click', (e) => handleClick(e, ctx));

  // Initial selection
  updateSelectionVisual(state);
  updateStatusBar(state, statusBar);

  // Cleanup
  wrapper.setAttribute('data-hobson-cleanup', '');
  wrapper.__hobsonCleanup = () => {};

  return wrapper;
}
