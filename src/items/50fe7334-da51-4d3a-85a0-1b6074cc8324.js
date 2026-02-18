// field-view-hob-structural — Structural editor for Hob JSON AST (Phase 6: Scope-Aware Autocomplete)

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

  _nextId = nextId;  // sync global counter so makeNode continues from here
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
    case 'hole': return null;
    case 'list': return node.children.filter(c => c.type !== 'hole').map(deflate);
    case 'vector': return { v: node.children.filter(c => c.type !== 'hole').map(deflate) };
    case 'map': {
      const pairs = [];
      const kids = node.children.filter(c => c.type !== 'hole');
      for (let i = 0; i < kids.length; i += 2) {
        pairs.push([deflate(kids[i]), deflate(kids[i + 1] || { type: 'nil' })]);
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
    case 'hole': return '·';
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
    case 'hole':
      if (state.mode !== 'nav' && state.inputHoleId === node.id) {
        span.className = 'hob-hole hob-hole-active';
        if (state.inputSelectAll) {
          span.classList.add('hob-hole-select-all');
          span.textContent = state.inputBuffer;
        } else if (state.mode === 'string') {
          const b = state.inputBuffer, c = state.inputCursor;
          span.textContent = '"' + b.slice(0, c) + '|' + b.slice(c) + '"';
          span.classList.add('hob-string');
        } else {
          const b = state.inputBuffer, c = state.inputCursor;
          span.textContent = b.slice(0, c) + '|' + b.slice(c);
          if (!b) span.textContent = '|';
        }
      } else {
        span.className = 'hob-hole';
        span.textContent = '·';
      }
      break;
    default:
      span.textContent = '?';
  }

  return span;
}

function ws(insertAfterId) {
  const s = document.createElement('span');
  s.className = 'hob-ws';
  s.textContent = ' ';
  if (insertAfterId != null) s.setAttribute('data-insert-after', insertAfterId);
  return s;
}

function newline(indentLevel, insertAfterId) {
  const nl = document.createElement('span');
  nl.className = 'hob-newline';
  nl.textContent = '\n';
  const ind = document.createElement('span');
  ind.className = 'hob-indent';
  ind.textContent = ' '.repeat(indentLevel);
  if (insertAfterId != null) ind.setAttribute('data-insert-after', insertAfterId);
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
      if (i > 0) span.appendChild(ws(node.children[i - 1].id));
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
      span.appendChild(ws(head.id));
      const bindingsNode = node.children[1];
      if (bindingsNode.type === 'vector') {
        span.appendChild(renderBindingVector(bindingsNode, state, itemNames, api, bodyIndent));
      } else {
        span.appendChild(renderNode(bindingsNode, state, itemNames, api, bodyIndent));
      }
      for (let i = 2; i < node.children.length; i++) {
        span.appendChild(newline(bodyIndent, node.children[i - 1].id));
        span.appendChild(renderNode(node.children[i], state, itemNames, api, bodyIndent));
      }
    } else {
      // Non-binding special: (defn name args\n  body...)
      // Put first 1-2 args on same line as head, rest indented
      const argsOnLine = (headName === 'defn' || headName === 'defmacro') ? 2 : 1;
      for (let i = 1; i < node.children.length; i++) {
        if (i <= argsOnLine) {
          span.appendChild(ws(node.children[i - 1].id));
        } else {
          span.appendChild(newline(bodyIndent, node.children[i - 1].id));
        }
        span.appendChild(renderNode(node.children[i], state, itemNames, api, bodyIndent));
      }
    }
  } else {
    // Normal list: first child, then all remaining indented
    span.appendChild(renderNode(head, state, itemNames, api, indent + 2));
    const restIndent = indent + 2;
    for (let i = 1; i < node.children.length; i++) {
      span.appendChild(newline(restIndent, node.children[i - 1].id));
      span.appendChild(renderNode(node.children[i], state, itemNames, api, restIndent));
    }
  }

  // Trailing gap before closing delimiter (clickable insert-after last child)
  const lastChild = node.children[node.children.length - 1];
  span.appendChild(newline(indent, lastChild.id));
  span.appendChild(delim(')'));
  return span;
}

function renderBindingVector(node, state, itemNames, api, indent) {
  const span = document.createElement('span');
  span.className = 'hob-vector';
  span.setAttribute('data-node-id', node.id);
  state.domMap.set(node.id, span);

  const kids = node.children;

  if (kids.length === 0) {
    span.appendChild(delim('['));
    span.appendChild(delim(']'));
    return span;
  }

  // Try flat rendering first
  const fw = flatWidth(node);
  if (fw <= MAX_LINE) {
    span.appendChild(delim('['));
    for (let i = 0; i < kids.length; i++) {
      if (i > 0) span.appendChild(ws(kids[i - 1].id));
      span.appendChild(renderNode(kids[i], state, itemNames, api, indent + 1));
    }
    span.appendChild(delim(']'));
    return span;
  }

  // Multi-line: render as pairs (name value)
  const childIndent = indent + 1;
  span.appendChild(delim('['));

  for (let i = 0; i < kids.length; i += 2) {
    const name = kids[i];
    const value = kids[i + 1];

    // Newline before each pair (including first, so all pairs align)
    span.appendChild(newline(childIndent, i > 0 ? kids[i - 1].id : null));

    // Render name
    span.appendChild(renderNode(name, state, itemNames, api, childIndent));

    if (value) {
      // Check if name + value fit on the rest of the line
      const pairWidth = flatWidth(name) + 1 + flatWidth(value);
      if (childIndent + pairWidth <= MAX_LINE) {
        span.appendChild(ws(name.id));
        span.appendChild(renderNode(value, state, itemNames, api, childIndent));
      } else {
        // Value on next line with extra indent
        span.appendChild(newline(childIndent + 2, name.id));
        span.appendChild(renderNode(value, state, itemNames, api, childIndent + 2));
      }
    }
  }

  // Trailing gap before closing delimiter
  const lastKid = kids[kids.length - 1];
  span.appendChild(newline(indent, lastKid.id));
  span.appendChild(delim(']'));
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
      if (i > 0) span.appendChild(ws(node.children[i - 1].id));
      span.appendChild(renderNode(node.children[i], state, itemNames, api, indent + 1));
    }
    span.appendChild(delim(close));
  } else {
    const childIndent = indent + 1;
    span.appendChild(delim(open));
    span.appendChild(renderNode(node.children[0], state, itemNames, api, childIndent));
    for (let i = 1; i < node.children.length; i++) {
      span.appendChild(newline(childIndent, node.children[i - 1].id));
      span.appendChild(renderNode(node.children[i], state, itemNames, api, childIndent));
    }
    // Trailing gap before closing delimiter
    const lastChild = node.children[node.children.length - 1];
    span.appendChild(newline(indent, lastChild.id));
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
      if (i > 0) span.appendChild(ws(node.children[i - 1].id));
      span.appendChild(renderNode(node.children[i], state, itemNames, api, indent + 1));
    }
    span.appendChild(delim('}'));
  } else {
    const childIndent = indent + 1;
    span.appendChild(delim('{'));
    // Render as key-value pairs, one pair per line
    for (let i = 0; i < node.children.length; i += 2) {
      if (i > 0) span.appendChild(newline(childIndent, node.children[i - 1].id));
      span.appendChild(renderNode(node.children[i], state, itemNames, api, childIndent));
      if (i + 1 < node.children.length) {
        span.appendChild(ws(node.children[i].id));
        span.appendChild(renderNode(node.children[i + 1], state, itemNames, api, childIndent));
      }
    }
    // Trailing gap before closing delimiter
    const lastChild = node.children[node.children.length - 1];
    span.appendChild(newline(indent, lastChild.id));
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

// --- AST manipulation helpers ---

let _nextId = 1;  // will be set from inflateAll result

function makeNode(state, type, props) {
  const node = { id: _nextId++, type, ...props };
  state.nodeMap.set(node.id, node);
  return node;
}

function insertAfter(state, refId, node) {
  const parent = state.parentMap.get(refId);
  if (!parent || !parent.children) return;
  const idx = parent.children.findIndex(c => c.id === refId);
  if (idx === -1) return;
  parent.children.splice(idx + 1, 0, node);
  state.parentMap.set(node.id, parent);
}

function insertBefore(state, refId, node) {
  const parent = state.parentMap.get(refId);
  if (!parent || !parent.children) return;
  const idx = parent.children.findIndex(c => c.id === refId);
  if (idx === -1) return;
  parent.children.splice(idx, 0, node);
  state.parentMap.set(node.id, parent);
}

function appendChild(state, parentId, node) {
  const parent = state.nodeMap.get(parentId);
  if (!parent || !parent.children) return;
  parent.children.push(node);
  state.parentMap.set(node.id, parent);
}

function replaceNode(state, targetId, node) {
  const parent = state.parentMap.get(targetId);
  if (!parent || !parent.children) return;
  const idx = parent.children.findIndex(c => c.id === targetId);
  if (idx === -1) return;
  // Remove old node from maps
  removeFromMaps(parent.children[idx], state);
  parent.children[idx] = node;
  state.nodeMap.set(node.id, node);
  state.parentMap.set(node.id, parent);
  // If new node has children, register them too
  if (node.children) {
    const registerChildren = (n) => {
      if (n.children) n.children.forEach(c => {
        state.nodeMap.set(c.id, c);
        state.parentMap.set(c.id, n);
        registerChildren(c);
      });
    };
    registerChildren(node);
  }
}

function inflateSubtree(compact, state) {
  if (compact === null) return makeNode(state, 'nil', {});
  if (typeof compact === 'number') return makeNode(state, 'number', { value: compact });
  if (typeof compact === 'boolean') return makeNode(state, 'boolean', { value: compact });
  if (typeof compact === 'string') {
    if (compact.startsWith(':')) return makeNode(state, 'keyword', { value: compact.slice(1) });
    if (compact.startsWith('@')) return makeNode(state, 'item-ref', { value: compact.slice(1) });
    return makeNode(state, 'symbol', { value: compact });
  }
  if (Array.isArray(compact)) {
    const node = makeNode(state, 'list', { children: [] });
    node.children = compact.map(c => {
      const child = inflateSubtree(c, state);
      state.parentMap.set(child.id, node);
      return child;
    });
    return node;
  }
  if (compact.s !== undefined) return makeNode(state, 'string', { value: compact.s });
  if (compact.v) {
    const node = makeNode(state, 'vector', { children: [] });
    node.children = compact.v.map(c => {
      const child = inflateSubtree(c, state);
      state.parentMap.set(child.id, node);
      return child;
    });
    return node;
  }
  if (compact.m) {
    const node = makeNode(state, 'map', { children: [] });
    node.children = compact.m.flatMap(([k, v]) => {
      const kc = inflateSubtree(k, state);
      const vc = inflateSubtree(v, state);
      state.parentMap.set(kc.id, node);
      state.parentMap.set(vc.id, node);
      return [kc, vc];
    });
    return node;
  }
  return makeNode(state, 'nil', {});
}

// --- Token resolution ---

function resolveToken(buffer) {
  if (/^-?\d+(\.\d+)?$/.test(buffer)) return { type: 'number', value: parseFloat(buffer) };
  if (buffer === 'true') return { type: 'boolean', value: true };
  if (buffer === 'false') return { type: 'boolean', value: false };
  if (buffer === 'nil') return { type: 'nil' };
  if (buffer.startsWith(':')) return { type: 'keyword', value: buffer.slice(1) };
  if (buffer.startsWith('@') && buffer.length > 1) return { type: 'item-ref', value: buffer.slice(1) };
  return { type: 'symbol', value: buffer };
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

  // Scroll selected element into view
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
    const modeText = state.mode === 'nav' ? 'NAV' : state.mode === 'input' ? 'INPUT' : 'STRING';
    modeEl.textContent = modeText;
    modeEl.className = 'hob-mode ' + (state.mode === 'nav' ? 'hob-mode-nav' : 'hob-mode-input');
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

// --- Hole utilities ---

function updateHoleDisplay(state) {
  const el = state.domMap.get(state.inputHoleId);
  if (!el) return;
  if (state.inputSelectAll) {
    el.textContent = state.inputBuffer;
    el.classList.add('hob-hole-select-all');
  } else {
    el.classList.remove('hob-hole-select-all');
    const b = state.inputBuffer, c = state.inputCursor;
    if (state.mode === 'string') {
      el.textContent = '"' + b.slice(0, c) + '|' + b.slice(c) + '"';
    } else if (b) {
      el.textContent = b.slice(0, c) + '|' + b.slice(c);
    } else {
      el.textContent = '|';
    }
  }
}

function findHoles(state) {
  // Collect all hole node IDs in document order (depth-first)
  const holes = [];
  function walk(node) {
    if (node.type === 'hole') { holes.push(node.id); return; }
    if (node.children) node.children.forEach(walk);
  }
  walk(state.nodeMap.get(0));
  return holes;
}

function enterInputMode(state, holeId) {
  hideAutocomplete(state);
  state.mode = 'input';
  state.inputHoleId = holeId;
  state.inputBuffer = '';
  state.inputCursor = 0;
  state.inputSelectAll = false;
  state.selectedId = holeId;
  state.expansionStack = [];
}

function exitToNav(state, selectId) {
  hideAutocomplete(state);
  state.mode = 'nav';
  state.inputBuffer = '';
  state.inputCursor = 0;
  state.inputHoleId = null;
  state.inputSelectAll = false;
  state.replaceOriginal = null;
  if (selectId != null) {
    state.selectedId = selectId;
    state.expansionStack = [];
  }
}

function commitToken(state, itemNames, api, statusBar) {
  if (!state.inputBuffer) return null;
  const resolved = resolveToken(state.inputBuffer);
  const newNode = makeNode(state, resolved.type, resolved);
  pushUndo(state);
  replaceNode(state, state.inputHoleId, newNode);
  notifyChange(state);
  return newNode;
}

// --- Autocomplete ---

function collectSymbols(state) {
  const syms = new Set(SPECIAL_FORMS);
  for (const node of state.nodeMap.values()) {
    if (node.type === 'symbol') syms.add(node.value);
  }
  return [...syms].sort();
}

function collectScopeSymbols(state, holeId) {
  const scopeSymbols = [];
  const seen = new Set();

  function addSym(name, detail) {
    if (!seen.has(name)) {
      seen.add(name);
      scopeSymbols.push({ name, detail });
    }
  }

  // Walk up from hole through parent chain
  let currentId = holeId;
  while (state.parentMap.has(currentId)) {
    const parent = state.parentMap.get(currentId);
    if (parent.type === 'list' && parent.children.length > 0 && parent.children[0].type === 'symbol') {
      const headName = parent.children[0].value;

      if (BINDING_FORMS.has(headName)) {
        // (let [a 1 b 2] body) — bindings vector is children[1]
        if (parent.children.length >= 2 && parent.children[1].type === 'vector') {
          const bindings = parent.children[1].children;
          for (let i = 0; i < bindings.length; i += 2) {
            if (bindings[i].type === 'symbol') addSym(bindings[i].value, 'local');
          }
        }
      }

      if (headName === 'fn') {
        // (fn [x y & rest] body)
        if (parent.children.length >= 2 && parent.children[1].type === 'vector') {
          for (const param of parent.children[1].children) {
            if (param.type === 'symbol' && param.value !== '&') addSym(param.value, 'param');
          }
        }
      }

      if (headName === 'defn' || headName === 'defmacro') {
        // (defn name [x y] body)
        if (parent.children.length >= 3 && parent.children[2].type === 'vector') {
          for (const param of parent.children[2].children) {
            if (param.type === 'symbol' && param.value !== '&') addSym(param.value, 'param');
          }
        }
      }
    }
    currentId = parent.id;
  }

  // Top-level defs
  const root = state.nodeMap.get(0);
  if (root && root.children) {
    for (const form of root.children) {
      if (form.type === 'list' && form.children.length >= 2 && form.children[0].type === 'symbol') {
        const head = form.children[0].value;
        if (head === 'def' && form.children[1].type === 'symbol') {
          addSym(form.children[1].value, 'def');
        }
        if ((head === 'defn' || head === 'defmacro') && form.children[1].type === 'symbol') {
          addSym(form.children[1].value, 'defn');
        }
      }
    }
  }

  return scopeSymbols;
}

function hideAutocomplete(state) {
  state.acVisible = false;
  state.acItems = [];
  state.acIndex = 0;
  state.acMode = null;
  if (state._acTimer) {
    clearTimeout(state._acTimer);
    state._acTimer = null;
  }
  if (state.acEl && state.acEl.parentNode) {
    state.acEl.parentNode.removeChild(state.acEl);
  }
}

function renderAutocomplete(state) {
  if (!state.acVisible) {
    if (state.acEl && state.acEl.parentNode) {
      state.acEl.parentNode.removeChild(state.acEl);
    }
    return;
  }

  if (!state.acEl) {
    state.acEl = document.createElement('div');
    state.acEl.className = 'hob-autocomplete';
  }

  const holeEl = state.domMap.get(state.inputHoleId);
  if (holeEl) {
    const rect = holeEl.getBoundingClientRect();
    state.acEl.style.position = 'fixed';
    state.acEl.style.left = rect.left + 'px';
    state.acEl.style.top = (rect.bottom + 2) + 'px';
  }

  state.acEl.textContent = '';
  state.acItems.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'hob-ac-item' + (i === state.acIndex ? ' hob-ac-selected' : '');

    const label = document.createElement('span');
    label.textContent = item.label;
    row.appendChild(label);

    if (item.detail) {
      const detail = document.createElement('span');
      detail.className = 'hob-ac-detail';
      detail.textContent = item.detail;
      row.appendChild(detail);
    }

    row.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectAutocomplete(state, i, state._ctx);
    });

    state.acEl.appendChild(row);
  });

  if (!state.acEl.parentNode) {
    document.body.appendChild(state.acEl);
  }
}

function updateAutocomplete(state, ctx) {
  const { itemNames, api } = ctx;
  const buf = state.inputBuffer;

  if (state._acTimer) {
    clearTimeout(state._acTimer);
    state._acTimer = null;
  }

  state._acGeneration = (state._acGeneration || 0) + 1;
  const gen = state._acGeneration;

  if (buf.startsWith('@')) {
    state.acMode = 'item';
    const query = buf.slice(1);

    if (!state._itemSearchLib) {
      hideAutocomplete(state);
      return;
    }

    const doSearch = async () => {
      try {
        let results;
        if (!query) {
          results = await state._itemSearchLib.getStarredItems(api);
        } else {
          results = await state._itemSearchLib.searchItems(query, api);
        }
        if (gen !== state._acGeneration) return;
        state.acItems = results.slice(0, 8).map(item => ({
          label: item.name || item.id.slice(0, 8),
          detail: '',
          value: item.id,
          acType: 'item-ref'
        }));
        state.acIndex = 0;
        state.acVisible = state.acItems.length > 0;
        renderAutocomplete(state);
      } catch {
        if (gen !== state._acGeneration) return;
        hideAutocomplete(state);
      }
    };

    if (!query) {
      doSearch();
    } else {
      state._acTimer = setTimeout(doSearch, 150);
    }
  } else if (buf.length >= 2) {
    state.acMode = 'symbol';
    const scopeSyms = collectScopeSymbols(state, state.inputHoleId);
    const astSyms = collectSymbols(state);

    // Build suggestions: scope symbols first (with detail), then remaining AST symbols
    const seen = new Set();
    const allItems = [];

    for (const s of scopeSyms) {
      if (s.name.startsWith(buf) && s.name !== buf && !seen.has(s.name)) {
        seen.add(s.name);
        allItems.push({ label: s.name, detail: s.detail, value: s.name, acType: 'symbol' });
      }
    }
    for (const sym of astSyms) {
      if (sym.startsWith(buf) && sym !== buf && !seen.has(sym)) {
        seen.add(sym);
        allItems.push({ label: sym, detail: SPECIAL_FORMS.has(sym) ? 'special' : '', value: sym, acType: 'symbol' });
      }
    }

    state.acItems = allItems.slice(0, 8);
    state.acIndex = 0;
    state.acVisible = state.acItems.length > 0;
    renderAutocomplete(state);
  } else {
    hideAutocomplete(state);
  }
}

function selectAutocomplete(state, index, ctx) {
  const { statusBar, itemNames, api } = ctx;
  const item = state.acItems[index];
  if (!item) return;

  hideAutocomplete(state);

  if (item.acType === 'symbol') {
    state.inputBuffer = item.value;
    state.inputCursor = item.value.length;
    state.inputSelectAll = false;
    const newNode = commitToken(state, itemNames, api, statusBar);
    exitToNav(state, newNode.id);
    rerender(state, itemNames, api, statusBar);
  } else if (item.acType === 'item-ref') {
    pushUndo(state);
    const newNode = makeNode(state, 'item-ref', { value: item.value });
    replaceNode(state, state.inputHoleId, newNode);
    itemNames.set(item.value, item.label);
    notifyChange(state);
    exitToNav(state, newNode.id);
    rerender(state, itemNames, api, statusBar);
  }
}

// --- Navigation ---

function handleNavKey(e, ctx) {
  const { state, statusBar, itemNames, api } = ctx;
  const node = state.nodeMap.get(state.selectedId);
  if (!node) return;
  const parent = state.parentMap.get(state.selectedId);

  let handled = true;

  if (e.key === 'ArrowLeft' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    // Go to parent (shallower)
    if (parent && parent.type !== 'root') {
      state.selectedId = parent.id;
      state.expansionStack = [];
    }
  } else if (e.key === 'ArrowRight' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    // Enter container (deeper)
    if (node.children && node.children.length > 0) {
      state.selectedId = node.children[0].id;
      state.expansionStack = [];
    }
  } else if (e.key === 'ArrowUp' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    // Previous sibling, or parent if at first child
    if (parent && parent.children) {
      const idx = parent.children.indexOf(node);
      if (idx > 0) {
        state.selectedId = parent.children[idx - 1].id;
        state.expansionStack = [];
      } else if (parent.type !== 'root') {
        state.selectedId = parent.id;
        state.expansionStack = [];
      }
    }
  } else if (e.key === 'ArrowDown' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    // Next sibling, or walk up to find ancestor's next sibling
    let cur = node;
    let curParent = parent;
    while (curParent && curParent.type !== 'root') {
      const idx = curParent.children.indexOf(cur);
      if (idx < curParent.children.length - 1) {
        state.selectedId = curParent.children[idx + 1].id;
        state.expansionStack = [];
        break;
      }
      cur = curParent;
      curParent = state.parentMap.get(curParent.id);
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
  } else if (e.key === 'Tab' && !e.shiftKey && state.onChange) {
    // Jump to next hole
    const holes = findHoles(state);
    if (holes.length > 0) {
      const curIdx = holes.indexOf(state.selectedId);
      const nextIdx = curIdx < 0 ? 0 : (curIdx + 1) % holes.length;
      state.selectedId = holes[nextIdx];
      state.expansionStack = [];
    } else { handled = false; }
  } else if (e.key === 'Tab' && e.shiftKey && state.onChange) {
    // Jump to previous hole
    const holes = findHoles(state);
    if (holes.length > 0) {
      const curIdx = holes.indexOf(state.selectedId);
      const prevIdx = curIdx <= 0 ? holes.length - 1 : curIdx - 1;
      state.selectedId = holes[prevIdx];
      state.expansionStack = [];
    } else { handled = false; }
  } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && state.onChange) {
    // Insert hole after selected node as sibling
    const hole = makeNode(state, 'hole', {});
    applyMutation(state, itemNames, api, statusBar, () => insertAfter(state, node.id, hole));
    enterInputMode(state, hole.id);
    rerender(state, itemNames, api, statusBar);
  } else if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey && !e.metaKey && state.onChange) {
    // Insert hole before selected
    const hole = makeNode(state, 'hole', {});
    applyMutation(state, itemNames, api, statusBar, () => insertBefore(state, node.id, hole));
    enterInputMode(state, hole.id);
    rerender(state, itemNames, api, statusBar);
  } else if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey && state.onChange) {
    // Replace: swap selected with hole pre-filled (select-all: first keystroke replaces)
    if (!node.children) {
      const prefill = leafText(node);
      const hole = makeNode(state, 'hole', {});
      state.replaceOriginal = { nodeSnapshot: JSON.parse(JSON.stringify(node)), parentId: state.parentMap.get(node.id)?.id };
      applyMutation(state, itemNames, api, statusBar, () => replaceNode(state, node.id, hole));
      enterInputMode(state, hole.id);
      state.inputBuffer = prefill;
      state.inputCursor = prefill.length;
      state.inputSelectAll = true;
      rerender(state, itemNames, api, statusBar);
    } else { handled = false; }
  } else if ((e.key === '(' || e.key === '[' || e.key === '{') && state.onChange) {
    // Create container with inner hole, insert after selected
    const containerType = e.key === '(' ? 'list' : e.key === '[' ? 'vector' : 'map';
    const innerHole = makeNode(state, 'hole', {});
    const container = makeNode(state, containerType, { children: [innerHole] });
    state.parentMap.set(innerHole.id, container);
    applyMutation(state, itemNames, api, statusBar, () => insertAfter(state, node.id, container));
    enterInputMode(state, innerHole.id);
    rerender(state, itemNames, api, statusBar);
  } else if (e.key === 'ArrowLeft' && e.altKey && !e.ctrlKey && !e.metaKey && state.onChange) {
    // Move left: swap with previous sibling
    if (parent && parent.children) {
      const idx = parent.children.indexOf(node);
      if (idx > 0) {
        applyMutation(state, itemNames, api, statusBar, () => {
          parent.children[idx] = parent.children[idx - 1];
          parent.children[idx - 1] = node;
        });
      }
    }
  } else if (e.key === 'ArrowRight' && e.altKey && !e.ctrlKey && !e.metaKey && state.onChange) {
    // Move right: swap with next sibling
    if (parent && parent.children) {
      const idx = parent.children.indexOf(node);
      if (idx >= 0 && idx < parent.children.length - 1) {
        applyMutation(state, itemNames, api, statusBar, () => {
          parent.children[idx] = parent.children[idx + 1];
          parent.children[idx + 1] = node;
        });
      }
    }
  } else if (e.key === 'w' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && state.onChange) {
    // Wrap in list: (· selected) — hole as head, enter input mode
    if (parent && parent.children) {
      const hole = makeNode(state, 'hole', {});
      const wrapper = makeNode(state, 'list', { children: [hole, node] });
      state.parentMap.set(hole.id, wrapper);
      pushUndo(state);
      const idx = parent.children.indexOf(node);
      parent.children[idx] = wrapper;
      state.parentMap.set(wrapper.id, parent);
      state.parentMap.set(node.id, wrapper);
      notifyChange(state);
      enterInputMode(state, hole.id);
      rerender(state, itemNames, api, statusBar);
    }
  } else if (e.key === 'W' && !e.ctrlKey && !e.metaKey && !e.altKey && state.onChange) {
    // Wrap in vector: [selected] — stay in nav, select wrapper
    if (parent && parent.children) {
      const wrapper = makeNode(state, 'vector', { children: [node] });
      applyMutation(state, itemNames, api, statusBar, () => {
        const idx = parent.children.indexOf(node);
        parent.children[idx] = wrapper;
        state.parentMap.set(wrapper.id, parent);
        state.parentMap.set(node.id, wrapper);
        state.selectedId = wrapper.id;
      });
    }
  } else if (e.key === 'u' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && state.onChange) {
    // Unwrap/splice: replace container with its children
    if (node.children && parent && parent.children) {
      applyMutation(state, itemNames, api, statusBar, () => {
        const idx = parent.children.indexOf(node);
        const kids = node.children;
        parent.children.splice(idx, 1, ...kids);
        kids.forEach(child => state.parentMap.set(child.id, parent));
        state.nodeMap.delete(node.id);
        state.parentMap.delete(node.id);
        state.selectedId = kids[0]?.id ?? parent.id;
      });
    }
  } else if (e.key === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && state.onChange) {
    // Duplicate: clone subtree as next sibling
    if (parent && parent.children) {
      const compact = deflate(node);
      const clone = inflateSubtree(compact, state);
      applyMutation(state, itemNames, api, statusBar, () => {
        insertAfter(state, node.id, clone);
        state.selectedId = clone.id;
      });
    }
  } else if (e.key === '>' && !e.ctrlKey && !e.metaKey && !e.altKey && state.onChange) {
    // Slurp right: pull next sibling into container as last child
    if (node.children && parent && parent.children) {
      const idx = parent.children.indexOf(node);
      if (idx >= 0 && idx < parent.children.length - 1) {
        applyMutation(state, itemNames, api, statusBar, () => {
          const victim = parent.children[idx + 1];
          parent.children.splice(idx + 1, 1);
          node.children.push(victim);
          state.parentMap.set(victim.id, node);
        });
      }
    }
  } else if (e.key === '<' && !e.ctrlKey && !e.metaKey && !e.altKey && state.onChange) {
    // Barf right: eject last child as next sibling
    if (node.children && node.children.length > 0 && parent && parent.children) {
      applyMutation(state, itemNames, api, statusBar, () => {
        const idx = parent.children.indexOf(node);
        const ejected = node.children.pop();
        parent.children.splice(idx + 1, 0, ejected);
        state.parentMap.set(ejected.id, parent);
      });
    }
  } else if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && state.onChange) {
    // Change container type: list → vector → map → list
    if (node.children) {
      const cycle = { list: 'vector', vector: 'map', map: 'list' };
      if (cycle[node.type]) {
        applyMutation(state, itemNames, api, statusBar, () => {
          node.type = cycle[node.type];
        });
      }
    }
  } else {
    handled = false;
  }

  return handled;
}

function handleInputKey(e, ctx) {
  const { state, statusBar, itemNames, api } = ctx;
  let handled = true;

  // Autocomplete intercept — when dropdown is visible, capture nav keys
  if (state.acVisible) {
    if (e.key === 'ArrowDown') {
      state.acIndex = (state.acIndex + 1) % state.acItems.length;
      renderAutocomplete(state);
      return true;
    }
    if (e.key === 'ArrowUp') {
      state.acIndex = (state.acIndex - 1 + state.acItems.length) % state.acItems.length;
      renderAutocomplete(state);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      selectAutocomplete(state, state.acIndex, ctx);
      return true;
    }
    if (e.key === 'Escape') {
      hideAutocomplete(state);
      return true;
    }
  }

  const isTypable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
  const TYPABLE_CHARS = /^[a-zA-Z0-9\-_?!+*=<>\/.:@]$/;

  if (e.key === 'Escape') {
    // Cancel: restore or remove hole
    if (state.replaceOriginal) {
      // Restore original node
      const orig = state.replaceOriginal.nodeSnapshot;
      const restored = makeNode(state, orig.type, orig);
      pushUndo(state);
      replaceNode(state, state.inputHoleId, restored);
      notifyChange(state);
      exitToNav(state, restored.id);
    } else {
      // Remove the hole
      const holeId = state.inputHoleId;
      state.selectedId = holeId;
      pushUndo(state);
      deleteSelected(state);
      notifyChange(state);
      exitToNav(state, state.selectedId);
    }
    rerender(state, itemNames, api, statusBar);
  } else if (e.key === 'Enter') {
    if (state.inputBuffer) {
      const newNode = commitToken(state, itemNames, api, statusBar);
      exitToNav(state, newNode.id);
    } else {
      // Empty buffer: remove hole and exit
      const holeId = state.inputHoleId;
      state.selectedId = holeId;
      pushUndo(state);
      deleteSelected(state);
      notifyChange(state);
      exitToNav(state, state.selectedId);
    }
    rerender(state, itemNames, api, statusBar);
  } else if (e.key === ' ') {
    if (state.inputBuffer) {
      // Commit token, create new hole after it
      const newNode = commitToken(state, itemNames, api, statusBar);
      const nextHole = makeNode(state, 'hole', {});
      pushUndo(state);
      insertAfter(state, newNode.id, nextHole);
      notifyChange(state);
      enterInputMode(state, nextHole.id);
      rerender(state, itemNames, api, statusBar);
    }
    // If empty buffer, no-op
  } else if (e.key === 'Backspace') {
    if (state.inputSelectAll) {
      state.inputBuffer = '';
      state.inputCursor = 0;
      state.inputSelectAll = false;
      updateHoleDisplay(state);
      updateAutocomplete(state, ctx);
    } else if (state.inputCursor > 0) {
      state.inputBuffer = state.inputBuffer.slice(0, state.inputCursor - 1) + state.inputBuffer.slice(state.inputCursor);
      state.inputCursor--;
      updateHoleDisplay(state);
      updateAutocomplete(state, ctx);
    } else if (!state.inputBuffer) {
      // Empty buffer: remove hole, exit to nav
      const holeId = state.inputHoleId;
      state.selectedId = holeId;
      if (state.replaceOriginal) {
        const orig = state.replaceOriginal.nodeSnapshot;
        const restored = makeNode(state, orig.type, orig);
        pushUndo(state);
        replaceNode(state, holeId, restored);
        notifyChange(state);
        exitToNav(state, restored.id);
      } else {
        pushUndo(state);
        deleteSelected(state);
        notifyChange(state);
        exitToNav(state, state.selectedId);
      }
      rerender(state, itemNames, api, statusBar);
    }
  } else if (e.key === '(' || e.key === '[' || e.key === '{') {
    // Commit buffer if non-empty, then create container with inner hole
    let afterId = state.inputHoleId;
    if (state.inputBuffer) {
      const newNode = commitToken(state, itemNames, api, statusBar);
      afterId = newNode.id;
    }
    const containerType = e.key === '(' ? 'list' : e.key === '[' ? 'vector' : 'map';
    const innerHole = makeNode(state, 'hole', {});
    const container = makeNode(state, containerType, { children: [innerHole] });
    state.parentMap.set(innerHole.id, container);
    // If we committed, insert container as sibling after committed node
    // If buffer was empty, replace the hole with the container
    if (afterId !== state.inputHoleId) {
      // Buffer was committed; the old hole is gone. Insert container after committed node.
      pushUndo(state);
      insertAfter(state, afterId, container);
      notifyChange(state);
    } else {
      // Buffer was empty, replace hole with container
      pushUndo(state);
      replaceNode(state, state.inputHoleId, container);
      notifyChange(state);
    }
    enterInputMode(state, innerHole.id);
    rerender(state, itemNames, api, statusBar);
  } else if (e.key === ')' || e.key === ']' || e.key === '}') {
    // Commit buffer if non-empty, then select matching ancestor container
    if (state.inputBuffer) {
      const newNode = commitToken(state, itemNames, api, statusBar);
      state.selectedId = newNode.id;
    } else {
      // Remove empty hole
      const holeId = state.inputHoleId;
      state.selectedId = holeId;
      pushUndo(state);
      deleteSelected(state);
      notifyChange(state);
    }
    // Walk up to find matching container
    const targetType = e.key === ')' ? 'list' : e.key === ']' ? 'vector' : 'map';
    let cur = state.nodeMap.get(state.selectedId);
    let found = null;
    while (cur) {
      cur = state.parentMap.get(cur.id);
      if (cur && cur.type === targetType) { found = cur; break; }
      if (cur && cur.type === 'root') break;
    }
    exitToNav(state, found ? found.id : state.selectedId);
    rerender(state, itemNames, api, statusBar);
  } else if (e.key === '"') {
    if (!state.inputBuffer) {
      // Enter string mode
      state.mode = 'string';
      state.inputBuffer = '';
      updateHoleDisplay(state);
    } else {
      // Commit current, then create new hole in string mode
      const newNode = commitToken(state, itemNames, api, statusBar);
      const nextHole = makeNode(state, 'hole', {});
      pushUndo(state);
      insertAfter(state, newNode.id, nextHole);
      notifyChange(state);
      state.mode = 'string';
      state.inputHoleId = nextHole.id;
      state.inputBuffer = '';
      state.selectedId = nextHole.id;
      state.expansionStack = [];
      rerender(state, itemNames, api, statusBar);
    }
  } else if (e.key === 'Tab' && !e.shiftKey) {
    // Jump to next hole
    if (state.inputBuffer) {
      commitToken(state, itemNames, api, statusBar);
    }
    const holes = findHoles(state);
    if (holes.length > 0) {
      const curIdx = holes.indexOf(state.inputHoleId);
      const nextIdx = curIdx < 0 ? 0 : (curIdx + 1) % holes.length;
      enterInputMode(state, holes[nextIdx]);
    } else {
      exitToNav(state, state.selectedId);
    }
    rerender(state, itemNames, api, statusBar);
  } else if (e.key === 'Tab' && e.shiftKey) {
    // Jump to previous hole
    if (state.inputBuffer) {
      commitToken(state, itemNames, api, statusBar);
    }
    const holes = findHoles(state);
    if (holes.length > 0) {
      const curIdx = holes.indexOf(state.inputHoleId);
      const prevIdx = curIdx <= 0 ? holes.length - 1 : curIdx - 1;
      enterInputMode(state, holes[prevIdx]);
    } else {
      exitToNav(state, state.selectedId);
    }
    rerender(state, itemNames, api, statusBar);
  } else if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
    if (state.inputSelectAll) {
      state.inputCursor = 0;
      state.inputSelectAll = false;
      updateHoleDisplay(state);
    } else if (state.inputCursor > 0) {
      state.inputCursor--;
      updateHoleDisplay(state);
    }
  } else if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
    if (state.inputSelectAll) {
      state.inputCursor = state.inputBuffer.length;
      state.inputSelectAll = false;
      updateHoleDisplay(state);
    } else if (state.inputCursor < state.inputBuffer.length) {
      state.inputCursor++;
      updateHoleDisplay(state);
    }
  } else if (e.key === 'Home') {
    state.inputCursor = 0;
    state.inputSelectAll = false;
    updateHoleDisplay(state);
  } else if (e.key === 'End') {
    state.inputCursor = state.inputBuffer.length;
    state.inputSelectAll = false;
    updateHoleDisplay(state);
  } else if (isTypable && TYPABLE_CHARS.test(e.key)) {
    if (state.inputSelectAll) {
      state.inputBuffer = e.key;
      state.inputCursor = 1;
      state.inputSelectAll = false;
    } else {
      state.inputBuffer = state.inputBuffer.slice(0, state.inputCursor) + e.key + state.inputBuffer.slice(state.inputCursor);
      state.inputCursor++;
    }
    updateHoleDisplay(state);
    updateAutocomplete(state, ctx);
  } else {
    handled = false;
  }

  return handled;
}

function handleStringKey(e, ctx) {
  const { state, statusBar, itemNames, api } = ctx;
  let handled = true;

  if (e.key === 'Escape') {
    // Cancel string
    if (state.replaceOriginal) {
      const orig = state.replaceOriginal.nodeSnapshot;
      const restored = makeNode(state, orig.type, orig);
      pushUndo(state);
      replaceNode(state, state.inputHoleId, restored);
      notifyChange(state);
      exitToNav(state, restored.id);
    } else {
      const holeId = state.inputHoleId;
      state.selectedId = holeId;
      pushUndo(state);
      deleteSelected(state);
      notifyChange(state);
      exitToNav(state, state.selectedId);
    }
    rerender(state, itemNames, api, statusBar);
  } else if (e.key === '"' && !e.shiftKey) {
    // Commit string
    const strNode = makeNode(state, 'string', { value: state.inputBuffer });
    pushUndo(state);
    replaceNode(state, state.inputHoleId, strNode);
    notifyChange(state);
    exitToNav(state, strNode.id);
    rerender(state, itemNames, api, statusBar);
  } else if (e.key === 'Backspace') {
    if (state.inputCursor > 0) {
      state.inputBuffer = state.inputBuffer.slice(0, state.inputCursor - 1) + state.inputBuffer.slice(state.inputCursor);
      state.inputCursor--;
      updateHoleDisplay(state);
    }
    // Don't delete hole on empty backspace in string mode — stay in mode
  } else if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
    if (state.inputCursor > 0) { state.inputCursor--; updateHoleDisplay(state); }
  } else if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
    if (state.inputCursor < state.inputBuffer.length) { state.inputCursor++; updateHoleDisplay(state); }
  } else if (e.key === 'Home') {
    state.inputCursor = 0; updateHoleDisplay(state);
  } else if (e.key === 'End') {
    state.inputCursor = state.inputBuffer.length; updateHoleDisplay(state);
  } else if (e.key === 'Enter' && e.shiftKey) {
    state.inputBuffer = state.inputBuffer.slice(0, state.inputCursor) + '\n' + state.inputBuffer.slice(state.inputCursor);
    state.inputCursor++;
    updateHoleDisplay(state);
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    // Any printable char
    state.inputBuffer = state.inputBuffer.slice(0, state.inputCursor) + e.key + state.inputBuffer.slice(state.inputCursor);
    state.inputCursor++;
    updateHoleDisplay(state);
  } else {
    handled = false;
  }

  return handled;
}

function handleKey(e, ctx) {
  const { state, statusBar } = ctx;
  let handled;
  if (state.mode === 'string') {
    handled = handleStringKey(e, ctx);
  } else if (state.mode === 'input') {
    handled = handleInputKey(e, ctx);
  } else {
    handled = handleNavKey(e, ctx);
  }

  if (handled) {
    e.preventDefault();
    e.stopPropagation();
    updateSelectionVisual(state);
    updateStatusBar(state, statusBar);
  }
}

function commitOrCancelInput(state, itemNames, api, statusBar) {
  hideAutocomplete(state);
  if (state.mode === 'nav') return;
  if (state.inputBuffer && state.mode === 'input') {
    const newNode = commitToken(state, itemNames, api, statusBar);
    exitToNav(state, newNode.id);
  } else if (state.inputBuffer && state.mode === 'string') {
    const strNode = makeNode(state, 'string', { value: state.inputBuffer });
    pushUndo(state);
    replaceNode(state, state.inputHoleId, strNode);
    notifyChange(state);
    exitToNav(state, strNode.id);
  } else {
    // Empty buffer: remove hole
    const holeId = state.inputHoleId;
    if (holeId && state.nodeMap.has(holeId)) {
      state.selectedId = holeId;
      pushUndo(state);
      deleteSelected(state);
      notifyChange(state);
    }
    exitToNav(state, null);
  }
  rerender(state, itemNames, api, statusBar);
}

function handleClick(e, ctx) {
  const { state, statusBar, itemNames, api } = ctx;

  // Check for insert-between-siblings click (editable mode only)
  if (state.onChange) {
    const insertTarget = e.target.closest('[data-insert-after]');
    if (insertTarget) {
      if (state.mode !== 'nav') commitOrCancelInput(state, itemNames, api, statusBar);
      const afterId = parseInt(insertTarget.getAttribute('data-insert-after'), 10);
      if (state.nodeMap.has(afterId)) {
        const hole = makeNode(state, 'hole', {});
        applyMutation(state, itemNames, api, statusBar, () => insertAfter(state, afterId, hole));
        enterInputMode(state, hole.id);
        rerender(state, itemNames, api, statusBar);
        updateSelectionVisual(state);
        updateStatusBar(state, statusBar);
        return;
      }
    }
  }

  const target = e.target.closest('[data-node-id]');
  if (!target) return;
  const id = parseInt(target.getAttribute('data-node-id'), 10);
  if (!state.nodeMap.has(id)) return;

  // If in input/string mode, commit or cancel before handling click
  if (state.mode !== 'nav') commitOrCancelInput(state, itemNames, api, statusBar);

  // Now handle the click target (re-check in case node was removed)
  if (!state.nodeMap.has(id)) return;
  state.selectedId = id;
  state.expansionStack = [];
  updateSelectionVisual(state);
  updateStatusBar(state, statusBar);
}

function handleDoubleClick(e, ctx) {
  const { state, statusBar, itemNames, api } = ctx;
  if (!state.onChange) return;

  // Commit/cancel any active input mode
  if (state.mode !== 'nav') commitOrCancelInput(state, itemNames, api, statusBar);

  const target = e.target.closest('[data-node-id]');
  if (!target) return;
  const id = parseInt(target.getAttribute('data-node-id'), 10);
  const node = state.nodeMap.get(id);
  if (!node) return;

  e.preventDefault();

  if (node.type === 'hole') {
    // Hole not in input mode → enter input mode
    if (state.mode === 'nav') {
      enterInputMode(state, node.id);
      rerender(state, itemNames, api, statusBar);
      updateSelectionVisual(state);
      updateStatusBar(state, statusBar);
    }
  } else if (node.children) {
    // Container → append child hole, enter input mode
    const hole = makeNode(state, 'hole', {});
    applyMutation(state, itemNames, api, statusBar, () => appendChild(state, node.id, hole));
    enterInputMode(state, hole.id);
    rerender(state, itemNames, api, statusBar);
    updateSelectionVisual(state);
    updateStatusBar(state, statusBar);
  } else {
    // Leaf → replace mode with select-all
    const prefill = leafText(node);
    const hole = makeNode(state, 'hole', {});
    state.replaceOriginal = { nodeSnapshot: JSON.parse(JSON.stringify(node)), parentId: state.parentMap.get(node.id)?.id };
    applyMutation(state, itemNames, api, statusBar, () => replaceNode(state, node.id, hole));
    enterInputMode(state, hole.id);
    state.inputBuffer = prefill;
    state.inputCursor = prefill.length;
    state.inputSelectAll = true;
    rerender(state, itemNames, api, statusBar);
    updateSelectionVisual(state);
    updateStatusBar(state, statusBar);
  }
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

  // Load item search lib for autocomplete
  let itemSearchLib = null;
  try { itemSearchLib = await api.require('item-search-lib'); } catch {}

  // Handle empty/missing value
  if (!value || !Array.isArray(value) || value.length === 0) {
    if (!options.onChange) {
      const empty = api.createElement('div');
      empty.className = 'hob-empty';
      empty.textContent = 'No Hob code';
      empty.style.cssText = 'border: 1px solid var(--color-border); border-radius: var(--border-radius); padding: 24px; text-align: center; color: var(--color-text-tertiary); font-style: italic;';
      return empty;
    }
    value = [null]; // bootstrap with nil so the user can start editing
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
    inputBuffer: '',
    inputCursor: 0,
    inputHoleId: null,
    inputSelectAll: false,
    replaceOriginal: null,
    undoStack: [],
    redoStack: [],
    acVisible: false,
    acItems: [],
    acIndex: 0,
    acMode: null,
    acEl: null,
    _acTimer: null,
    _acGeneration: 0,
    _itemSearchLib: itemSearchLib,
    _ctx: null
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
  if (state.onChange) editorEl.classList.add('hob-editable');

  // Status bar
  const statusBar = buildStatusBar();

  // Wrapper
  const wrapper = api.createElement('div');
  wrapper.style.cssText = 'display: flex; flex-direction: column; border: 1px solid var(--color-border); border-radius: var(--border-radius); overflow: hidden; min-height: 200px;';
  wrapper.appendChild(editorEl);
  wrapper.appendChild(statusBar);

  // Event context (shared by key and click handlers)
  const ctx = { state, statusBar, itemNames, api };
  state._ctx = ctx;

  // Key handler
  editorEl.addEventListener('keydown', (e) => handleKey(e, ctx));

  // Click and double-click handlers
  editorEl.addEventListener('click', (e) => handleClick(e, ctx));
  editorEl.addEventListener('dblclick', (e) => handleDoubleClick(e, ctx));

  // Initial selection
  updateSelectionVisual(state);
  updateStatusBar(state, statusBar);

  // Cleanup
  wrapper.setAttribute('data-hobson-cleanup', '');
  wrapper.__hobsonCleanup = () => { hideAutocomplete(state); };

  return wrapper;
}
