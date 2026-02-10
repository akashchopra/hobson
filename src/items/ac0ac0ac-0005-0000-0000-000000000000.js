// REPL introspection — dir(), help(), symbols(), symbolSearch()

let _api = null;

export async function onKernelBootComplete(payload, api) {
  _api = api;
  window.dir = dir;
  window.help = help;
  window.symbols = symbols;
  window.symbolSearch = symbolSearch;
}

// --- dir(obj) — synchronous ---
// Enumerates keys, groups into Functions / Namespaces / Values
function dir(obj) {
  if (obj == null) return 'dir() requires an argument';
  if (typeof obj !== 'object' && typeof obj !== 'function') {
    return `(${typeof obj}) ${String(obj)}`;
  }

  const keys = Object.keys(obj).sort();
  if (keys.length === 0) return '(no enumerable properties)';

  const fns = [], ns = [], vals = [];
  for (const k of keys) {
    try {
      const v = obj[k];
      if (typeof v === 'function') fns.push(k);
      else if (v && typeof v === 'object' && Object.keys(v).length > 0) ns.push(k);
      else vals.push(k);
    } catch { vals.push(k); }
  }

  const lines = [];
  if (fns.length)  lines.push('Functions:  ' + fns.join(', '));
  if (ns.length)   lines.push('Namespaces: ' + ns.join(', '));
  if (vals.length) lines.push('Values:     ' + vals.join(', '));
  return lines.join('\n');
}

// --- help(obj, methodName?) — async ---
// Resolves source item via kernel API detection, sub-namespace matching, or WeakMap provenance.
// Shows symbols from _symbols index.
async function help(obj, methodName) {
  if (!_api) return 'help() not ready \u2014 wait for boot';
  if (obj == null) return 'Usage: help(obj) or help(obj, "methodName")';
  if (typeof obj === 'string') return await symbols(obj);
  if (typeof obj !== 'object' && typeof obj !== 'function') {
    return `(${typeof obj}) \u2014 pass an object or module to help()`;
  }

  const source = resolveSource(obj);
  if (!source) {
    if (methodName) return 'Could not determine source item. Try: await symbols("item-name")';
    return 'Could not determine source item.\n\n' + dir(obj);
  }

  const item = await _api.get(source.itemId);
  const syms = item?.content?._symbols;
  if (!syms) return `Source: ${source.itemName}\nNo _symbols indexed for this item.`;

  return methodName
    ? formatMethodHelp(syms, source, methodName)
    : formatScopeHelp(syms, source);
}

// Resolve an object to { itemId, itemName, scope }
function resolveSource(obj) {
  // Strategy 1: Kernel API — IDS is a shared module-level const across all createAPI() calls
  if (obj.IDS && obj.IDS === window.kernel?.IDS) {
    return { itemId: _api.IDS.KERNEL_CORE, itemName: 'kernel:core', scope: 'api' };
  }

  // Strategy 2: API sub-namespaces — match keys against our boot api's sub-namespace objects
  const nsMap = { events: 'api.events', viewport: 'api.viewport', instances: 'api.instances', helpers: 'api.helpers' };
  for (const [ns, scope] of Object.entries(nsMap)) {
    if (_api[ns] && keysMatch(obj, _api[ns])) {
      return { itemId: _api.IDS.KERNEL_CORE, itemName: 'kernel:core', scope };
    }
  }

  // Strategy 3: WeakMap provenance (loaded libraries)
  const info = window.kernel?.moduleSystem?.getModuleInfo(obj);
  if (info) return { itemId: info.itemId, itemName: info.itemName, scope: null };

  return null;
}

function keysMatch(a, b) {
  const ak = Object.keys(a).sort().join('\0');
  const bk = Object.keys(b).sort().join('\0');
  return ak === bk && ak.length > 0;
}

// Format help for a single method/symbol
function formatMethodHelp(syms, source, methodName) {
  const prefix = source.scope ? source.scope + '.' : '';
  let sym = syms[prefix + methodName];

  // Fallback: search by name within scope
  if (!sym) {
    for (const s of Object.values(syms)) {
      if (s.name === methodName && (!source.scope || s.scope === source.scope)) {
        sym = s;
        break;
      }
    }
  }

  if (!sym) {
    const hint = source.scope ? ` (scope: ${source.scope})` : '';
    return `No symbol "${methodName}" found in ${source.itemName}${hint}`;
  }

  return [
    `${sym.name}${sym.signature || ''}`,
    `  Kind: ${sym.kind}  |  Line: ${sym.line}`,
    `  Source: ${source.itemName}`,
    `  Navigate: api.navigate('${source.itemId}', { symbol: '${sym.name}' })`
  ].join('\n');
}

// Format help for an entire scope (all symbols at that level)
function formatScopeHelp(syms, source) {
  const entries = Object.values(syms);
  let relevant;

  if (source.scope) {
    // Scoped (kernel API / sub-namespace): show symbols AT this scope
    relevant = entries.filter(s => s.scope === source.scope);
  } else {
    // Unscoped (library): show top-level symbols + class methods
    const topLevel = entries.filter(s => s.scope === null);
    const classNames = new Set(topLevel.filter(s => s.kind === 'class').map(s => s.name));
    const classMethods = classNames.size > 0
      ? entries.filter(s => s.scope && classNames.has(s.scope))
      : [];
    relevant = [...topLevel, ...classMethods];
  }

  if (relevant.length === 0) {
    const hint = source.scope ? ` in scope "${source.scope}"` : '';
    return `Source: ${source.itemName}\nNo symbols found${hint}.`;
  }

  const labelOf = (kind) => ({
    'class': 'Classes', 'method': 'Methods', 'function': 'Functions',
    'property-function': 'Functions', 'field-function': 'Functions',
    'property': 'Properties', 'field': 'Fields', 'variable': 'Variables'
  })[kind] || kind;

  const groups = {};
  for (const s of relevant) {
    const label = labelOf(s.kind);
    (groups[label] ??= []).push(s);
  }

  const lines = [`Source: ${source.itemName} (${source.itemId})`];
  if (source.scope) lines.push(`Scope: ${source.scope}`);
  lines.push('');

  const labelOrder = ['Classes', 'Methods', 'Functions', 'Properties', 'Fields', 'Variables'];
  for (const label of labelOrder) {
    if (!groups[label]) continue;
    lines.push(`${label}:`);
    for (const s of groups[label].sort((a, b) => a.name.localeCompare(b.name))) {
      const scope = s.scope && s.scope !== source.scope ? ` [${s.scope}]` : '';
      lines.push(`  ${s.name}${s.signature || ''}${scope}  (line ${s.line})`);
    }
    delete groups[label];
  }

  // Any remaining kind labels not in labelOrder
  for (const [label, arr] of Object.entries(groups)) {
    lines.push(`${label}:`);
    for (const s of arr.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`  ${s.name}${s.signature || ''}  (line ${s.line})`);
    }
  }

  return lines.join('\n');
}

// --- symbols(nameOrId) — async ---
// Full dump of all _symbols for an item, grouped by kind.
async function symbols(nameOrId) {
  if (!_api) return 'symbols() not ready \u2014 wait for boot';
  if (!nameOrId) return 'Usage: await symbols("item-name") or await symbols("guid")';

  let item;
  if (nameOrId.includes('-') && nameOrId.length >= 36) {
    try { item = await _api.get(nameOrId); } catch (e) { /* not found by id */ }
  }
  if (!item) {
    item = await _api.helpers.findByName(nameOrId);
  }
  if (!item) return `Item not found: ${nameOrId}`;

  const syms = item.content?._symbols;
  if (!syms) return `${item.name || item.id} has no indexed symbols.`;

  const entries = Object.values(syms);
  const groups = {};
  for (const s of entries) {
    (groups[s.kind] ??= []).push(s);
  }

  const lines = [`Symbols for: ${item.name || item.id} (${item.id})`];
  lines.push(`Total: ${entries.length} symbols`);
  lines.push('');

  const kindOrder = ['class', 'method', 'function', 'property-function', 'field-function', 'property', 'field', 'variable'];
  const kindLabels = {
    'class': 'Classes', 'method': 'Methods', 'function': 'Functions',
    'property-function': 'Property Functions', 'field-function': 'Field Functions',
    'property': 'Properties', 'field': 'Fields', 'variable': 'Variables'
  };

  for (const kind of kindOrder) {
    if (!groups[kind]) continue;
    lines.push(`${kindLabels[kind]}:`);
    for (const s of groups[kind].sort((a, b) => a.line - b.line)) {
      const scope = s.scope ? ` [${s.scope}]` : '';
      lines.push(`  ${s.name}${s.signature || ''}  (line ${s.line})${scope}`);
    }
    delete groups[kind];
  }

  // Any remaining kinds
  for (const [kind, arr] of Object.entries(groups)) {
    lines.push(`${kind}:`);
    for (const s of arr.sort((a, b) => a.line - b.line)) {
      lines.push(`  ${s.name}${s.signature || ''}  (line ${s.line})${s.scope ? ` [${s.scope}]` : ''}`);
    }
  }

  return lines.join('\n');
}

// --- symbolSearch(pattern, options?) — async ---
// Cross-item symbol search. Scans _symbols across all code items.
// pattern: string (case-insensitive substring) or RegExp
// options: { kind?, scope?, limit? }
async function symbolSearch(pattern, options = {}) {
  if (!_api) return 'symbolSearch() not ready \u2014 wait for boot';
  if (!pattern) return 'Usage: await symbolSearch("name") or await symbolSearch(/pattern/, { kind: "function" })';

  const isRegex = pattern instanceof RegExp;
  const test = isRegex
    ? (name) => pattern.test(name)
    : (name) => name.toLowerCase().includes(pattern.toLowerCase());

  const { kind, scope, limit = 50 } = options;

  const allItems = await _api.getAll();
  const matches = []; // { itemName, itemId, sym }

  for (const item of allItems) {
    const syms = item.content?._symbols;
    if (!syms) continue;

    for (const sym of Object.values(syms)) {
      if (!test(sym.name)) continue;
      if (kind && sym.kind !== kind) continue;
      if (scope !== undefined && sym.scope !== scope) continue;
      matches.push({ itemName: item.name || item.id, itemId: item.id, sym });
    }
  }

  if (matches.length === 0) {
    return `No symbols matching "${pattern}" found.`;
  }

  // Group by item
  const byItem = new Map();
  for (const m of matches) {
    (byItem.get(m.itemId) ?? (() => { const a = []; byItem.set(m.itemId, a); return a; })()).push(m);
  }

  const truncated = matches.length > limit;
  const lines = [`Symbol search: ${isRegex ? pattern : `"${pattern}"`} (${matches.length} match${matches.length === 1 ? '' : 'es'} across ${byItem.size} item${byItem.size === 1 ? '' : 's'})${truncated ? ` \u2014 showing first ${limit}` : ''}`];
  lines.push('');

  let shown = 0;
  for (const [itemId, itemMatches] of byItem) {
    if (shown >= limit) break;
    lines.push(`${itemMatches[0].itemName}:`);
    for (const m of itemMatches.sort((a, b) => a.sym.line - b.sym.line)) {
      if (shown >= limit) break;
      const s = m.sym;
      const scopeHint = s.scope ? ` [${s.scope}]` : '';
      lines.push(`  ${s.name}${s.signature || ''}  ${s.kind}  (line ${s.line})${scopeHint}`);
      shown++;
    }
  }

  return lines.join('\n');
}
