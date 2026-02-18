// Hob Language Interpreter — Phase 5
// A Lisp interpreter for the Hobson item system
// Phase 1: Reader, evaluator, printer, environment, stdlib, item ops
// Phase 2: Macros, quasiquote, destructuring, multi-arity, atoms, concurrency, error handling
// Phase 3: DOM runtime (hiccupToDOM, parseTag), view ops, def-view macro
// Phase 4: Watches and events (def-watch, emit!, hobToJs, JS interop fix)
// Phase 5: Reactivity (DependencyTracker, instrumented get-item/deref/swap!/reset!)

// ============================================================
// Error types
// ============================================================

class HobError extends Error {
  constructor(message, line, col, stack) {
    super(message);
    this.name = 'HobError';
    this.hobLine = line;
    this.hobCol = col;
    this.hobStack = stack || [];
  }
}

function hobError(msg, node, callStack) {
  const line = node?.line ?? null;
  const col = node?.col ?? null;
  const locStr = line != null ? ` at line ${line}, col ${col}` : '';
  const stackLines = (callStack || []).map(
    f => `  in ${f.name || '(anonymous)'}${f.line != null ? ` at line ${f.line}, col ${f.col}` : ''}`
  );
  const fullMsg = `HobError: ${msg}${locStr}` + (stackLines.length ? '\n' + stackLines.join('\n') : '');
  return new HobError(fullMsg, line, col, callStack);
}

// ============================================================
// Tokenizer
// ============================================================

const TOKEN = {
  NUMBER: 'number',
  STRING: 'string',
  KEYWORD: 'keyword',
  SYMBOL: 'symbol',
  BOOLEAN: 'boolean',
  NIL: 'nil',
  ITEM_REF: 'item-ref',
  LPAREN: '(',
  RPAREN: ')',
  LBRACKET: '[',
  RBRACKET: ']',
  LBRACE: '{',
  RBRACE: '}',
  QUOTE: 'quote',
  HASH_LBRACE: '#{',
  QUASIQUOTE: 'quasiquote',
  UNQUOTE: 'unquote',
  UNQUOTE_SPLICING: 'unquote-splicing',
  ANON_FN: 'anon-fn',
};

function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 0;
  const len = source.length;

  function ch() { return source[i]; }
  function advance() {
    if (source[i] === '\n') { line++; col = 0; }
    else { col++; }
    i++;
  }

  function isWhitespace(c) { return c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ','; }
  function isDigit(c) { return c >= '0' && c <= '9'; }
  function isSymbolChar(c) {
    return c && !isWhitespace(c) && c !== '(' && c !== ')' && c !== '[' && c !== ']'
      && c !== '{' && c !== '}' && c !== '"' && c !== ';' && c !== '@' && c !== '\''
      && c !== '`' && c !== '~' && c !== '#';
  }

  while (i < len) {
    // Skip whitespace
    if (isWhitespace(ch())) { advance(); continue; }

    // Skip comments
    if (ch() === ';') {
      while (i < len && ch() !== '\n') advance();
      continue;
    }

    const startLine = line;
    const startCol = col;

    // String
    if (ch() === '"') {
      advance(); // skip opening quote
      let str = '';
      while (i < len && ch() !== '"') {
        if (ch() === '\\') {
          advance();
          if (i >= len) throw hobError('Unterminated string escape', { line: startLine, col: startCol });
          const esc = ch();
          if (esc === 'n') str += '\n';
          else if (esc === 't') str += '\t';
          else if (esc === '\\') str += '\\';
          else if (esc === '"') str += '"';
          else str += esc;
          advance();
        } else {
          str += ch();
          advance();
        }
      }
      if (i >= len) throw hobError('Unterminated string', { line: startLine, col: startCol });
      advance(); // skip closing quote
      tokens.push({ type: TOKEN.STRING, value: str, line: startLine, col: startCol });
      continue;
    }

    // Delimiters
    if (ch() === '(') { tokens.push({ type: TOKEN.LPAREN, value: '(', line: startLine, col: startCol }); advance(); continue; }
    if (ch() === ')') { tokens.push({ type: TOKEN.RPAREN, value: ')', line: startLine, col: startCol }); advance(); continue; }
    if (ch() === '[') { tokens.push({ type: TOKEN.LBRACKET, value: '[', line: startLine, col: startCol }); advance(); continue; }
    if (ch() === ']') { tokens.push({ type: TOKEN.RBRACKET, value: ']', line: startLine, col: startCol }); advance(); continue; }
    if (ch() === '{') { tokens.push({ type: TOKEN.LBRACE, value: '{', line: startLine, col: startCol }); advance(); continue; }
    if (ch() === '}') { tokens.push({ type: TOKEN.RBRACE, value: '}', line: startLine, col: startCol }); advance(); continue; }

    // Quote shorthand
    if (ch() === '\'') { tokens.push({ type: TOKEN.QUOTE, value: '\'', line: startLine, col: startCol }); advance(); continue; }

    // Quasiquote
    if (ch() === '`') { tokens.push({ type: TOKEN.QUASIQUOTE, value: '`', line: startLine, col: startCol }); advance(); continue; }

    // Unquote-splicing (~@) must come before unquote (~)
    if (ch() === '~' && i + 1 < len && source[i + 1] === '@') {
      tokens.push({ type: TOKEN.UNQUOTE_SPLICING, value: '~@', line: startLine, col: startCol });
      advance(); advance();
      continue;
    }

    // Unquote
    if (ch() === '~') { tokens.push({ type: TOKEN.UNQUOTE, value: '~', line: startLine, col: startCol }); advance(); continue; }

    // Anonymous function shorthand #(...)
    if (ch() === '#' && i + 1 < len && source[i + 1] === '(') {
      tokens.push({ type: TOKEN.ANON_FN, value: '#(', line: startLine, col: startCol });
      advance(); // consume # only, leave ( in stream
      continue;
    }

    // Hash set literal (produce error token)
    if (ch() === '#' && i + 1 < len && source[i + 1] === '{') {
      tokens.push({ type: TOKEN.HASH_LBRACE, value: '#{', line: startLine, col: startCol });
      advance(); advance();
      continue;
    }

    // Item reference @name or @uuid
    if (ch() === '@') {
      advance(); // skip @
      let ref = '';
      while (i < len && isSymbolChar(ch())) {
        ref += ch();
        advance();
      }
      if (!ref) throw hobError('Empty item reference', { line: startLine, col: startCol });
      tokens.push({ type: TOKEN.ITEM_REF, value: ref, line: startLine, col: startCol });
      continue;
    }

    // Keyword
    if (ch() === ':') {
      advance(); // skip :
      let kw = '';
      while (i < len && isSymbolChar(ch())) {
        kw += ch();
        advance();
      }
      if (!kw) throw hobError('Empty keyword', { line: startLine, col: startCol });
      tokens.push({ type: TOKEN.KEYWORD, value: kw, line: startLine, col: startCol });
      continue;
    }

    // Number or symbol starting with - or +
    if (ch() === '-' || ch() === '+') {
      const next = source[i + 1];
      if (next && isDigit(next)) {
        // Negative/positive number
        let num = ch();
        advance();
        while (i < len && (isDigit(ch()) || ch() === '.')) { num += ch(); advance(); }
        // Check it's not followed by symbol chars (e.g. -foo is a symbol)
        if (i < len && isSymbolChar(ch())) {
          // It's a symbol like -foo
          while (i < len && isSymbolChar(ch())) { num += ch(); advance(); }
          tokens.push({ type: TOKEN.SYMBOL, value: num, line: startLine, col: startCol });
        } else {
          tokens.push({ type: TOKEN.NUMBER, value: parseFloat(num), line: startLine, col: startCol });
        }
        continue;
      }
      // Fall through to symbol
    }

    // Number
    if (isDigit(ch())) {
      let num = '';
      while (i < len && (isDigit(ch()) || ch() === '.')) { num += ch(); advance(); }
      tokens.push({ type: TOKEN.NUMBER, value: parseFloat(num), line: startLine, col: startCol });
      continue;
    }

    // Symbol (including +, -, *, /, etc.)
    if (isSymbolChar(ch())) {
      let sym = '';
      while (i < len && isSymbolChar(ch())) { sym += ch(); advance(); }

      // Check for special symbols
      if (sym === 'true') {
        tokens.push({ type: TOKEN.BOOLEAN, value: true, line: startLine, col: startCol });
      } else if (sym === 'false') {
        tokens.push({ type: TOKEN.BOOLEAN, value: false, line: startLine, col: startCol });
      } else if (sym === 'nil') {
        tokens.push({ type: TOKEN.NIL, value: null, line: startLine, col: startCol });
      } else {
        tokens.push({ type: TOKEN.SYMBOL, value: sym, line: startLine, col: startCol });
      }
      continue;
    }

    throw hobError(`Unexpected character '${ch()}'`, { line: startLine, col: startCol });
  }

  return tokens;
}

// ============================================================
// Parser
// ============================================================

function createParser(tokens) {
  let pos = 0;

  function peek() { return tokens[pos]; }
  function next() { return tokens[pos++]; }

  function wrapInForm(formName, tok) {
    next();
    const expr = parseExpr();
    return {
      type: 'list',
      elements: [
        { type: 'symbol', value: formName, line: tok.line, col: tok.col },
        expr
      ],
      line: tok.line,
      col: tok.col
    };
  }

  function parseExpr() {
    const tok = peek();
    if (!tok) throw hobError('Unexpected end of input', { line: 0, col: 0 });

    switch (tok.type) {
      case TOKEN.NUMBER:
      case TOKEN.STRING:
      case TOKEN.BOOLEAN:
      case TOKEN.NIL:
      case TOKEN.KEYWORD:
      case TOKEN.ITEM_REF:
        next();
        return { type: tok.type, value: tok.value, line: tok.line, col: tok.col };

      case TOKEN.SYMBOL:
        next();
        return { type: 'symbol', value: tok.value, line: tok.line, col: tok.col };

      case TOKEN.QUOTE:
        return wrapInForm('quote', tok);

      case TOKEN.QUASIQUOTE:
        return wrapInForm('quasiquote', tok);

      case TOKEN.UNQUOTE:
        return wrapInForm('unquote', tok);

      case TOKEN.UNQUOTE_SPLICING:
        return wrapInForm('unquote-splicing', tok);

      case TOKEN.ANON_FN:
        return parseAnonFn();

      case TOKEN.LPAREN:
        return parseList();

      case TOKEN.LBRACKET:
        return parseVector();

      case TOKEN.LBRACE:
        return parseMap();

      case TOKEN.HASH_LBRACE:
        throw hobError('Sets (#{...}) are not yet supported', { line: tok.line, col: tok.col });

      case TOKEN.RPAREN:
      case TOKEN.RBRACKET:
      case TOKEN.RBRACE:
        throw hobError(`Unexpected '${tok.value}'`, { line: tok.line, col: tok.col });

      default:
        throw hobError(`Unexpected token: ${tok.type}`, { line: tok.line, col: tok.col });
    }
  }

  function parseList() {
    const open = next(); // consume (
    const elements = [];
    while (peek() && peek().type !== TOKEN.RPAREN) {
      elements.push(parseExpr());
    }
    if (!peek()) throw hobError('Unterminated list — expected )', { line: open.line, col: open.col });
    next(); // consume )
    return { type: 'list', elements, line: open.line, col: open.col };
  }

  function parseVector() {
    const open = next(); // consume [
    const elements = [];
    while (peek() && peek().type !== TOKEN.RBRACKET) {
      elements.push(parseExpr());
    }
    if (!peek()) throw hobError('Unterminated vector — expected ]', { line: open.line, col: open.col });
    next(); // consume ]
    return { type: 'vector', elements, line: open.line, col: open.col };
  }

  function parseMap() {
    const open = next(); // consume {
    const entries = [];
    while (peek() && peek().type !== TOKEN.RBRACE) {
      const key = parseExpr();
      if (!peek() || peek().type === TOKEN.RBRACE) {
        throw hobError('Map literal must have an even number of forms', { line: key.line, col: key.col });
      }
      const val = parseExpr();
      entries.push([key, val]);
    }
    if (!peek()) throw hobError('Unterminated map — expected }', { line: open.line, col: open.col });
    next(); // consume }
    return { type: 'map', entries, line: open.line, col: open.col };
  }

  function parseAnonFn() {
    const tok = next(); // consume #( token
    // Now parse the following list (the ( is still in the token stream)
    const body = parseList();
    // Scan for % params
    const params = new Set();
    scanForParams(body, params);
    // Rewrite bare % to %1
    rewriteBarePercent(body);
    // Determine max param number
    let maxParam = 0;
    let hasRest = false;
    for (const p of params) {
      if (p === '%&') { hasRest = true; continue; }
      const name = p === '%' ? '%1' : p;
      const num = parseInt(name.slice(1), 10);
      if (!isNaN(num) && num > maxParam) maxParam = num;
    }
    // Build parameter vector
    const paramElements = [];
    for (let i = 1; i <= maxParam; i++) {
      paramElements.push({ type: 'symbol', value: '%' + i, line: tok.line, col: tok.col });
    }
    if (hasRest) {
      paramElements.push({ type: 'symbol', value: '&', line: tok.line, col: tok.col });
      paramElements.push({ type: 'symbol', value: '%&', line: tok.line, col: tok.col });
    }
    return {
      type: 'list',
      elements: [
        { type: 'symbol', value: 'fn', line: tok.line, col: tok.col },
        { type: 'vector', elements: paramElements, line: tok.line, col: tok.col },
        body
      ],
      line: tok.line,
      col: tok.col
    };
  }

  return { parseExpr, peek, next, getPos: () => pos };
}

function scanForParams(node, params) {
  if (!node) return;
  if (node.type === 'symbol' && node.value.startsWith('%')) {
    params.add(node.value);
  }
  if (node.elements) {
    for (const el of node.elements) scanForParams(el, params);
  }
  if (node.entries) {
    for (const [k, v] of node.entries) {
      scanForParams(k, params);
      scanForParams(v, params);
    }
  }
}

function rewriteBarePercent(node) {
  if (!node) return;
  if (node.type === 'symbol' && node.value === '%') {
    node.value = '%1';
  }
  if (node.elements) {
    for (const el of node.elements) rewriteBarePercent(el);
  }
  if (node.entries) {
    for (const [k, v] of node.entries) {
      rewriteBarePercent(k);
      rewriteBarePercent(v);
    }
  }
}

function parse(tokens) {
  const parser = createParser(tokens);
  const expr = parser.parseExpr();
  if (parser.peek()) {
    const extra = parser.peek();
    throw hobError(`Unexpected token after expression: ${extra.value}`, { line: extra.line, col: extra.col });
  }
  return expr;
}

function read(source) {
  const trimmed = source.trim();
  if (!trimmed) throw hobError('Empty input', { line: 1, col: 0 });
  const tokens = tokenize(trimmed);
  if (tokens.length === 0) throw hobError('Empty input', { line: 1, col: 0 });
  return compactify(parse(tokens));
}

// Read multiple top-level expressions — always returns compact JSON
function readAll(source) {
  if (Array.isArray(source)) return source;  // already compact JSON

  const trimmed = source.trim();
  if (!trimmed) return [];
  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return [];

  const parser = createParser(tokens);
  const exprs = [];
  while (parser.peek()) exprs.push(compactify(parser.parseExpr()));
  return exprs;
}

// ============================================================
// Compact JSON AST — bridge between storage format and internal AST
// ============================================================

// Internal AST node → compact JSON
function compactify(node) {
  switch (node.type) {
    case 'number':
    case 'boolean':
      return node.value;
    case 'nil':
      return null;
    case 'symbol':
      return node.value;
    case 'keyword':
      return ':' + node.value;
    case 'item-ref':
      return '@' + node.value;
    case 'string':
      return { s: node.value };
    case 'list':
      return node.elements.map(compactify);
    case 'vector':
      return { v: node.elements.map(compactify) };
    case 'map':
      return { m: node.entries.map(([k, v]) => [compactify(k), compactify(v)]) };
    default:
      throw new Error(`compactify: unknown node type '${node.type}'`);
  }
}

// Convenience: parse s-expression text → compact JSON array
function compactifyAll(source) { return readAll(source); }

// Compact JSON → pretty-printed s-expression text
// Handles let bindings, body forms, hiccup vectors, and maps idiomatically.

const BODY_FORMS = new Set([
  'let', 'when', 'if', 'do', 'fn', 'defn', 'for', 'doseq', 'cond',
  'when-let', 'loop', 'try', 'catch', 'def', 'defmacro', 'plet',
  '->', '->>', 'as->', 'defmacro', 'quote', 'quasiquote',
]);

const BINDING_FORMS = new Set(['let', 'loop', 'when-let', 'plet']);

function ppStr(s) {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"';
}

function prettyPrint(json, indent = 0) {
  if (json === null) return 'nil';
  if (typeof json === 'number') return String(json);
  if (typeof json === 'boolean') return json ? 'true' : 'false';
  if (typeof json === 'string') return json; // symbol, keyword (:x), item-ref (@x)
  if (typeof json === 'object' && !Array.isArray(json)) {
    if ('s' in json) return ppStr(json.s);
    if ('v' in json) return ppVec(json.v, indent);
    if ('m' in json) return ppMap(json.m, indent);
  }
  if (Array.isArray(json)) return ppList(json, indent);
  return String(json);
}

function ppList(list, indent) {
  if (list.length === 0) return '()';
  // Try flat
  const flat = '(' + list.map(e => prettyPrint(e, 0)).join(' ') + ')';
  if (flat.length + indent <= 80) return flat;

  const head = typeof list[0] === 'string' ? list[0] : null;
  const bi = indent + 2; // body indent

  // Binding forms: (let [name val ...]\n  body...)
  if (head && BINDING_FORMS.has(head) && list.length >= 3 && list[1]?.v) {
    const bracketCol = indent + 1 + head.length + 1; // position of '['
    const binds = ppBindings(list[1].v, bracketCol);
    const body = list.slice(2).map(b => ' '.repeat(bi) + prettyPrint(b, bi));
    return '(' + head + ' ' + binds + '\n' + body.join('\n') + ')';
  }

  // fn/defn: keep params on head line
  if (head === 'fn' && list.length >= 3 && list[1]?.v) {
    const params = ppVec(list[1].v, indent + 4);
    const body = list.slice(2).map(b => ' '.repeat(bi) + prettyPrint(b, bi));
    return '(fn ' + params + '\n' + body.join('\n') + ')';
  }
  if (head === 'defn' && list.length >= 4 && list[2]?.v) {
    const name = prettyPrint(list[1], 0);
    const params = ppVec(list[2].v, indent + 7 + name.length);
    const body = list.slice(3).map(b => ' '.repeat(bi) + prettyPrint(b, bi));
    return '(defn ' + name + ' ' + params + '\n' + body.join('\n') + ')';
  }

  // for/doseq: keep binding vec on head line
  if ((head === 'for' || head === 'doseq') && list.length >= 3 && list[1]?.v) {
    const binds = ppVec(list[1].v, indent + head.length + 2);
    const body = list.slice(2).map(b => ' '.repeat(bi) + prettyPrint(b, bi));
    return '(' + head + ' ' + binds + '\n' + body.join('\n') + ')';
  }

  // Body forms: (head arg1\n  arg2\n  arg3)
  if (head && BODY_FORMS.has(head)) {
    const rest = list.slice(1).map(e => ' '.repeat(bi) + prettyPrint(e, bi));
    return '(' + head + '\n' + rest.join('\n') + ')';
  }

  // Default: (head arg1\n  arg2\n  arg3)
  const parts = list.map(e => prettyPrint(e, bi));
  const rest = parts.slice(1).map(p => ' '.repeat(bi) + p);
  return '(' + parts[0] + '\n' + rest.join('\n') + ')';
}

function ppVec(elements, indent) {
  if (elements.length === 0) return '[]';
  // Try flat
  const flat = '[' + elements.map(e => prettyPrint(e, 0)).join(' ') + ']';
  if (flat.length + indent <= 80) return flat;

  const ci = indent + 2; // child indent

  // Hiccup vector: starts with keyword tag
  if (typeof elements[0] === 'string' && elements[0].startsWith(':')) {
    const tag = elements[0];
    let attrStr = '';
    let childStart = 1;
    // Check for attribute map as second element
    if (elements.length > 1 && elements[1]?.m !== undefined) {
      attrStr = ' ' + ppMap(elements[1].m, indent + tag.length + 2);
      childStart = 2;
    }
    const headLine = '[' + tag + attrStr;
    if (childStart >= elements.length) return headLine + ']';
    const children = elements.slice(childStart).map(c => ' '.repeat(ci) + prettyPrint(c, ci));
    return headLine + '\n' + children.join('\n') + ']';
  }

  // Regular vector
  const parts = elements.map(e => prettyPrint(e, ci));
  const rest = parts.slice(1).map(p => ' '.repeat(indent + 1) + p);
  return '[' + parts[0] + '\n' + rest.join('\n') + ']';
}

function ppMap(entries, indent) {
  if (entries.length === 0) return '{}';
  const flat = '{' + entries.map(([k, v]) => prettyPrint(k, 0) + ' ' + prettyPrint(v, 0)).join(' ') + '}';
  if (flat.length + indent <= 80) return flat;
  // One entry per line, closing } on last line
  const ci = indent + 1;
  const lines = entries.map(([k, v], i) => {
    const ks = prettyPrint(k, ci);
    const vs = prettyPrint(v, ci + ks.length + 1);
    const suffix = i === entries.length - 1 ? '}' : '';
    return ' '.repeat(ci) + ks + ' ' + vs + suffix;
  });
  return '{' + lines[0].trimStart() + '\n' + lines.slice(1).join('\n');
}

function ppBindings(elems, indent) {
  if (elems.length === 0) return '[]';
  // Try flat
  const flat = '[' + elems.map(e => prettyPrint(e, 0)).join(' ') + ']';
  if (flat.length + indent <= 80) return flat;
  // One name-value pair per line
  const ci = indent + 1;
  const pairs = [];
  for (let i = 0; i < elems.length; i += 2) {
    const name = prettyPrint(elems[i], ci);
    if (i + 1 < elems.length) {
      const val = prettyPrint(elems[i + 1], ci + name.length + 1);
      pairs.push(name + ' ' + val);
    } else {
      pairs.push(name);
    }
  }
  const lines = pairs.map(p => ' '.repeat(ci) + p);
  return '[' + lines[0].trimStart() + '\n' + lines.slice(1).join('\n') + ']';
}

// Pretty-print an array of top-level compact JSON expressions
function prettyPrintAll(jsonAst) {
  return jsonAst.map(expr => prettyPrint(expr, 0)).join('\n\n');
}

// ============================================================
// Environment
// ============================================================

class Environment {
  constructor(parent = null) {
    this.parent = parent;
    this.bindings = new Map();
  }

  define(name, value) {
    this.bindings.set(name, value);
    return value;
  }

  lookup(name) {
    if (this.bindings.has(name)) return this.bindings.get(name);
    if (this.parent) return this.parent.lookup(name);
    throw new Error(`Undefined symbol '${name}'`);
  }

  has(name) {
    if (this.bindings.has(name)) return true;
    if (this.parent) return this.parent.has(name);
    return false;
  }

  extend(bindings) {
    const child = new Environment(this);
    if (bindings) {
      for (const [k, v] of Object.entries(bindings)) {
        child.define(k, v);
      }
    }
    return child;
  }
}

// ============================================================
// Printer
// ============================================================

function prStr(value, readably = true) {
  if (value === null || value === undefined) return 'nil';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);

  if (typeof value === 'string') {
    // Keywords are stored as strings prefixed with \u029e
    if (value.startsWith('\u029e')) return ':' + value.slice(1);
    if (readably) {
      return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"';
    }
    return value;
  }

  if (typeof value === 'function') {
    return value._hobName ? `#<fn ${value._hobName}>` : '#<fn>';
  }

  if (Array.isArray(value)) {
    return '[' + value.map(v => prStr(v, readably)).join(' ') + ']';
  }

  if (value && typeof value === 'object') {
    // Check for DOM nodes
    if (value.nodeType) {
      return `#<dom ${value.nodeName.toLowerCase()}>`;
    }
    // Check for item-ref marker
    if (value._hobType === 'item-ref') {
      return '@' + value.value;
    }
    // Check for symbol marker
    if (value._hobType === 'symbol') {
      return value.value;
    }
    // Check for atom
    if (value._hobType === 'atom') {
      return '#<atom ' + prStr(value.value, readably) + '>';
    }
    // Regular map
    const entries = Object.entries(value).map(
      ([k, v]) => prStr(k.startsWith('\u029e') ? k : k, readably) + ' ' + prStr(v, readably)
    );
    return '{' + entries.join(', ') + '}';
  }

  return String(value);
}

// ============================================================
// DOM: parseTag and hiccupToDOM
// ============================================================

function parseTag(tagStr) {
  const parts = tagStr.split(/(?=[.#])/);
  let tag = null, id = null;
  const classes = [];
  for (const part of parts) {
    if (part.startsWith('#')) id = part.slice(1);
    else if (part.startsWith('.')) classes.push(part.slice(1));
    else if (part) tag = part;
  }
  return { tag: tag || 'div', id, classes };
}

function hiccupToDOM(hiccup, sourceCtx, _refs) {
  if (hiccup === null || hiccup === undefined) return null;
  if (typeof hiccup === 'string' || typeof hiccup === 'number') {
    return document.createTextNode(String(hiccup));
  }
  // DOM node passthrough
  if (hiccup.nodeType) return hiccup;

  if (Array.isArray(hiccup)) {
    if (hiccup.length === 0) return null;
    const first = hiccup[0];
    if (!isKeyword(first)) {
      // Not a hiccup element — treat as fragment of children
      const frag = document.createDocumentFragment();
      for (const child of hiccup) {
        const node = hiccupToDOM(child, sourceCtx, _refs);
        if (node) frag.appendChild(node);
      }
      return frag;
    }
    const tagName = keywordName(first);
    const parsed = parseTag(tagName);
    const el = document.createElement(parsed.tag);
    if (parsed.id) el.id = parsed.id;
    if (parsed.classes.length) el.classList.add(...parsed.classes);

    // Stamp source attribution for element inspector
    if (sourceCtx) {
      el.setAttribute('data-source', sourceCtx.viewName);
      el.setAttribute('data-source-lang', 'hob');
      el.setAttribute('data-view-id', sourceCtx.viewId);
      if (sourceCtx.forItem) el.setAttribute('data-for-item', sourceCtx.forItem);
      if (hiccup._hobLine != null) el.setAttribute('data-source-line', String(hiccup._hobLine));
    }

    let childStart = 1;
    // Check for attribute map
    if (hiccup.length > 1 && hiccup[1] && typeof hiccup[1] === 'object'
        && !Array.isArray(hiccup[1]) && !hiccup[1].nodeType && !isKeyword(hiccup[1])) {
      const attrs = hiccup[1];
      childStart = 2;
      for (const [k, v] of Object.entries(attrs)) {
        const attrName = isKeyword(k) ? keywordName(k) : k;
        if (attrName === 'ref' && _refs) {
          // Store element in refs map under the ref name
          const refName = isKeyword(v) ? keywordName(v) : String(v);
          _refs[refName] = el;
        } else if (attrName.startsWith('on-')) {
          const eventName = attrName.slice(3);
          let handler = v;
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            const rawHandler = v[keyword('handler')] || v['handler'];
            const debounceMs = v[keyword('debounce')] || v['debounce'];
            const throttleMs = v[keyword('throttle')] || v['throttle'];
            handler = rawHandler;
            if (debounceMs) {
              const orig = handler;
              handler = function(e) {
                if (el.__hobTimers?.[eventName]) clearTimeout(el.__hobTimers[eventName]);
                if (!el.__hobTimers) el.__hobTimers = {};
                el.__hobTimers[eventName] = setTimeout(() => orig(e), debounceMs);
              };
            } else if (throttleMs) {
              const orig = handler;
              handler = function(e) {
                if (el.__hobTimers?.[eventName]) return;
                if (!el.__hobTimers) el.__hobTimers = {};
                orig(e);
                el.__hobTimers[eventName] = setTimeout(() => { el.__hobTimers[eventName] = null; }, throttleMs);
              };
            }
          }
          if (typeof handler === 'function') {
            el.addEventListener(eventName, handler);
            if (!el.__hobEvents) el.__hobEvents = {};
            el.__hobEvents[eventName] = handler;
          }
        } else if (attrName === 'style' && typeof v === 'object' && v !== null) {
          for (const [sp, sv] of Object.entries(v)) {
            const cssProp = isKeyword(sp) ? keywordName(sp) : sp;
            el.style[cssProp] = sv;
          }
        } else if (attrName === 'class' && typeof v === 'string') {
          for (const c of v.split(/\s+/)) {
            if (c) el.classList.add(c);
          }
        } else if (attrName === 'autofocus' && v) {
          el.setAttribute('autofocus', '');
          setTimeout(() => { el.focus(); if (el.select) el.select(); }, 0);
        } else if (attrName === 'sortable') {
          const config = {};
          if (v && typeof v === 'object') {
            for (const [ck, cv] of Object.entries(v)) {
              config[isKeyword(ck) ? keywordName(ck) : ck] = cv;
            }
          }
          el.__hobSortable = config;
          el.setAttribute('data-hob-sortable', '');
        } else if (v === true) {
          el.setAttribute(attrName, '');
        } else if (v === false || v === null || v === undefined) {
          // skip
        } else {
          el.setAttribute(attrName, String(v));
        }
      }
    }

    // Process children (flatten nested arrays from map/for)
    for (let i = childStart; i < hiccup.length; i++) {
      appendHiccupChild(el, hiccup[i], sourceCtx, _refs);
    }
    return el;
  }

  return document.createTextNode(String(hiccup));
}

function hiccupToDOMWithRefs(hiccup, sourceCtx) {
  const refs = {};
  const dom = hiccupToDOM(hiccup, sourceCtx, refs);
  return [dom, refs];
}

function appendHiccupChild(parent, child, sourceCtx, _refs) {
  if (child === null || child === undefined) return;
  if (Array.isArray(child) && child.length > 0 && !isKeyword(child[0])) {
    // Flatten non-hiccup arrays (e.g. from map)
    for (const c of child) appendHiccupChild(parent, c, sourceCtx, _refs);
  } else {
    const node = hiccupToDOM(child, sourceCtx, _refs);
    if (node) parent.appendChild(node);
  }
}

// ============================================================
// setupSortable — declarative drag-and-drop for :sortable attr
// ============================================================

function setupSortable(el) {
  el.addEventListener('mousedown', (e) => {
    const config = el.__hobSortable;
    if (!config) return;
    const handleSelector = config.handle || '.drag-handle';
    const handle = e.target.closest(handleSelector);
    if (!handle || !el.contains(handle)) return;

    e.preventDefault();
    const items = Array.from(el.querySelectorAll(':scope > [data-item-id]'));
    const draggedItem = handle.closest('[data-item-id]');
    const draggedIndex = items.indexOf(draggedItem);
    if (draggedIndex === -1) return;

    draggedItem.style.opacity = '0.5';
    handle.style.cursor = 'grabbing';

    const indicator = document.createElement('div');
    indicator.style.cssText = 'height: 3px; background: var(--color-primary); margin: 4px 0; border-radius: 2px;';

    const onMouseMove = (moveE) => {
      const mouseY = moveE.clientY;
      let targetIndex = items.length;
      for (let i = 0; i < items.length; i++) {
        if (items[i] === draggedItem) continue;
        const rect = items[i].getBoundingClientRect();
        if (mouseY < rect.top + rect.height / 2) {
          targetIndex = i;
          break;
        }
      }
      if (targetIndex < items.length) {
        el.insertBefore(indicator, items[targetIndex]);
      } else {
        el.appendChild(indicator);
      }
    };

    const onMouseUp = (upE) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      draggedItem.style.opacity = '';
      handle.style.cursor = '';
      if (indicator.parentNode) indicator.remove();

      const mouseY = upE.clientY;
      let newIndex = items.length;
      for (let i = 0; i < items.length; i++) {
        if (items[i] === draggedItem) continue;
        const rect = items[i].getBoundingClientRect();
        if (mouseY < rect.top + rect.height / 2) {
          newIndex = i;
          break;
        }
      }
      if (newIndex > draggedIndex) newIndex--;

      if (newIndex !== draggedIndex && config['on-reorder']) {
        config['on-reorder'](draggedIndex, newIndex);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
  el.__hobSortableSetup = true;
}

// ============================================================
// hobToJs — convert Hob keyword-keyed maps to plain JS objects
// ============================================================

function hobToJs(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(hobToJs);
  if (value.nodeType) return value; // DOM passthrough
  const result = {};
  for (const [k, v] of Object.entries(value)) {
    const key = isKeyword(k) ? keywordName(k) : k;
    result[key] = hobToJs(v);
  }
  return result;
}

// ============================================================
// Dependency Tracking (reactive re-rendering)
// ============================================================

let _currentTrackingContext = null;
let _atomMutationCallback = null;

class DependencyTracker {
  constructor() {
    this.contextDeps = new Map();      // contextId -> Set<itemId>
    this.contextAtomDeps = new Map();  // contextId -> Set<atom>
    this.itemDependents = new Map();   // itemId -> Set<contextId>  (reverse index)
    this.atomDependents = new Map();   // atom -> Set<contextId>    (reverse index)
  }

  startTracking(contextId) {
    // Save parent context for proper nesting (render-item inside render-item)
    const prev = _currentTrackingContext;
    this.clearDeps(contextId);
    this.contextDeps.set(contextId, new Set());
    this.contextAtomDeps.set(contextId, new Set());
    _currentTrackingContext = { trackerId: contextId, tracker: this, _prev: prev };
  }

  stopTracking() {
    const ctx = _currentTrackingContext;
    // Restore parent context instead of nulling out
    _currentTrackingContext = ctx?._prev || null;
    if (!ctx) return { items: new Set(), atoms: new Set() };
    return {
      items: this.contextDeps.get(ctx.trackerId) || new Set(),
      atoms: this.contextAtomDeps.get(ctx.trackerId) || new Set()
    };
  }

  recordAccess(itemId) {
    if (!_currentTrackingContext) return;
    const ctxId = _currentTrackingContext.trackerId;
    const deps = this.contextDeps.get(ctxId);
    if (deps) deps.add(itemId);
    if (!this.itemDependents.has(itemId)) this.itemDependents.set(itemId, new Set());
    this.itemDependents.get(itemId).add(ctxId);
  }

  recordAtomAccess(atom) {
    if (!_currentTrackingContext) return;
    const ctxId = _currentTrackingContext.trackerId;
    // Skip tracking self-owned atoms — atoms created by this view's own evaluation
    // should not trigger re-renders of that same view (they're managed internally via handlers)
    if (atom._ownerCtx === ctxId) return;
    const deps = this.contextAtomDeps.get(ctxId);
    if (deps) deps.add(atom);
    if (!this.atomDependents.has(atom)) this.atomDependents.set(atom, new Set());
    this.atomDependents.get(atom).add(ctxId);
  }

  getDependents(itemId) {
    return this.itemDependents.get(itemId) || new Set();
  }

  getAtomDependents(atom) {
    return this.atomDependents.get(atom) || new Set();
  }

  clearDeps(contextId) {
    const itemDeps = this.contextDeps.get(contextId);
    if (itemDeps) {
      for (const itemId of itemDeps) {
        const s = this.itemDependents.get(itemId);
        if (s) { s.delete(contextId); if (s.size === 0) this.itemDependents.delete(itemId); }
      }
      this.contextDeps.delete(contextId);
    }
    const atomDeps = this.contextAtomDeps.get(contextId);
    if (atomDeps) {
      for (const atom of atomDeps) {
        const s = this.atomDependents.get(atom);
        if (s) { s.delete(contextId); if (s.size === 0) this.atomDependents.delete(atom); }
      }
      this.contextAtomDeps.delete(contextId);
    }
  }

  static isTracking() { return _currentTrackingContext !== null; }
}

function setAtomMutationCallback(cb) { _atomMutationCallback = cb; }

// ============================================================
// Keyword helpers
// ============================================================

function keyword(name) {
  return '\u029e' + name;
}

function isKeyword(val) {
  return typeof val === 'string' && val.startsWith('\u029e');
}

function keywordName(val) {
  return val.slice(1);
}

// ============================================================
// Built-in special forms (never macro-expanded)
// ============================================================

const BUILT_IN_SPECIAL_FORMS = new Set([
  'def', 'fn', 'let', 'if', 'do', 'quote', 'quasiquote',
  'loop', 'recur', 'try', 'throw', 'defmacro', 'plet', 'and', 'or'
]);

// ============================================================
// Compact JSON AST type predicates
// ============================================================

function isSym(n) { return typeof n === 'string' && n[0] !== ':' && n[0] !== '@'; }
function isVec(n) { return n != null && typeof n === 'object' && !Array.isArray(n) && 'v' in n; }
function isMap(n) { return n != null && typeof n === 'object' && !Array.isArray(n) && 'm' in n; }

// ============================================================
// Value ↔ AST conversion
// ============================================================

function valueToAst(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value.startsWith('\u029e')) return ':' + value.slice(1);
    return { s: value };
  }
  if (Array.isArray(value)) {
    if (value._isHobVector) return { v: value.map(valueToAst) };
    return value.map(valueToAst);
  }
  if (value && typeof value === 'object') {
    if (value._hobType === 'symbol') return value.value;
    if (value._hobType === 'item-ref') return '@' + value.value;
    const entries = Object.entries(value).map(([k, v]) => [valueToAst(k), valueToAst(v)]);
    return { m: entries };
  }
  return null;
}

// ============================================================
// Gensym counter
// ============================================================

let gensymCounter = 0;
function gensym(prefix = 'G__') {
  return { _hobType: 'symbol', value: prefix + (gensymCounter++) };
}

// ============================================================
// Evaluator
// ============================================================

// Sentinel for recur
const RECUR = Symbol('recur');

async function evaluate(ast, env, callStack) {
  if (!callStack) callStack = [];

  // Nil
  if (ast === null) return null;

  // Self-evaluating primitives
  if (typeof ast === 'number') return ast;
  if (typeof ast === 'boolean') return ast;

  // String types: keyword, item-ref, or symbol
  if (typeof ast === 'string') {
    if (ast[0] === ':') return keyword(ast.slice(1));
    if (ast[0] === '@') return { _hobType: 'item-ref', value: ast.slice(1) };
    // Symbol lookup
    try {
      return env.lookup(ast);
    } catch (e) {
      throw hobError(`Undefined symbol '${ast}'`, null, callStack);
    }
  }

  // List — special forms or function application
  if (Array.isArray(ast)) {
    if (ast.length === 0) return [];

    const head = ast[0];

    // Macro expansion — check before special forms
    if (isSym(head) && !BUILT_IN_SPECIAL_FORMS.has(head)) {
      if (env.has(head)) {
        const macroFn = env.lookup(head);
        if (typeof macroFn === 'function' && macroFn._isMacro) {
          const macroArgs = ast.slice(1).map(astToValue);
          let expanded = macroFn(...macroArgs);
          if (expanded && typeof expanded.then === 'function') expanded = await expanded;
          const expandedAst = valueToAst(expanded);
          return evaluate(expandedAst, env, callStack);
        }
      }
    }

    // Special forms
    if (isSym(head)) {
      switch (head) {
        case 'def': return evalDef(ast, env, callStack);
        case 'fn': return evalFn(ast, env, callStack);
        case 'let': return evalLet(ast, env, callStack);
        case 'if': return evalIf(ast, env, callStack);
        case 'do': return evalDo(ast, env, callStack);
        case 'quote': return evalQuote(ast, env, callStack);
        case 'quasiquote': return evalQuasiquote(ast, env, callStack);
        case 'and': return evalAnd(ast, env, callStack);
        case 'or': return evalOr(ast, env, callStack);
        case 'loop': return evalLoop(ast, env, callStack);
        case 'recur': return evalRecur(ast, env, callStack);
        case 'throw': return evalThrow(ast, env, callStack);
        case 'try': return evalTry(ast, env, callStack);
        case 'defmacro': return evalDefmacro(ast, env, callStack);
        case 'plet': return evalPlet(ast, env, callStack);
      }
    }

    // Function application
    return evalApply(ast, env, callStack);
  }

  // Object types: string literal, vector, map
  if (typeof ast === 'object') {
    if ('s' in ast) return ast.s;

    if ('v' in ast) {
      const results = [];
      for (const el of ast.v) {
        results.push(await evaluate(el, env, callStack));
      }
      Object.defineProperty(results, '_isHobVector', { value: true });
      return results;
    }

    if ('m' in ast) {
      const obj = {};
      for (const [keyNode, valNode] of ast.m) {
        let key = await evaluate(keyNode, env, callStack);
        const val = await evaluate(valNode, env, callStack);
        if (typeof key !== 'string') key = String(key);
        obj[key] = val;
      }
      return obj;
    }
  }

  throw hobError(`Unknown AST node: ${JSON.stringify(ast)}`, null, callStack);
}

// ---- Special forms ----

async function evalDef(ast, env, callStack) {
  if (ast.length !== 3) throw hobError('def requires exactly 2 arguments (name value)', null, callStack);
  const nameNode = ast[1];
  if (!isSym(nameNode)) throw hobError('def first argument must be a symbol', null, callStack);
  const value = await evaluate(ast[2], env, callStack);
  if (typeof value === 'function' && !value._hobName) value._hobName = nameNode;
  env.define(nameNode, value);
  return value;
}

async function evalFn(ast, env, callStack) {
  if (ast.length < 2) throw hobError('fn requires parameters and body', null, callStack);

  // Detect multi-arity: (fn ([p1] b1) ([p2 p3] b2))
  if (Array.isArray(ast[1])) {
    return evalFnMultiArity(ast, env, callStack);
  }

  return evalFnSingleArity(ast, env, callStack);
}

async function evalLet(ast, env, callStack) {
  if (ast.length < 3) throw hobError('let requires bindings and body', null, callStack);
  const bindingsNode = ast[1];
  if (!isVec(bindingsNode)) throw hobError('let bindings must be a vector', null, callStack);
  if (bindingsNode.v.length % 2 !== 0) throw hobError('let bindings must have an even number of forms', null, callStack);

  const letEnv = new Environment(env);

  // Build pairs with dependency info for auto-parallel
  const pairs = [];
  const definedNames = new Set();
  for (let i = 0; i < bindingsNode.v.length; i += 2) {
    const nameNode = bindingsNode.v[i];
    const exprNode = bindingsNode.v[i + 1];
    const refs = freeSymbols(exprNode, new Set());
    const dependsOn = new Set([...refs].filter(r => definedNames.has(r)));
    const names = new Set();
    if (isSym(nameNode)) {
      names.add(nameNode);
    } else {
      extractBoundNames(nameNode, names);
    }
    pairs.push({ nameNode, exprNode, dependsOn, names });
    for (const n of names) definedNames.add(n);
  }

  // Group into batches
  const batches = topologicalBatch(pairs);

  for (const batch of batches) {
    if (batch.length === 1) {
      // Sequential
      const { nameNode, exprNode } = batch[0];
      const value = await evaluate(exprNode, letEnv, callStack);
      if (isSym(nameNode)) {
        letEnv.define(nameNode, value);
      } else {
        const bindings = await destructure(nameNode, value, letEnv, callStack);
        for (const [bindName, bindVal] of bindings) {
          letEnv.define(bindName, bindVal);
        }
      }
    } else {
      // Parallel
      const values = await Promise.all(batch.map(b => evaluate(b.exprNode, letEnv, callStack)));
      for (let i = 0; i < batch.length; i++) {
        const { nameNode } = batch[i];
        if (isSym(nameNode)) {
          letEnv.define(nameNode, values[i]);
        } else {
          const bindings = await destructure(nameNode, values[i], letEnv, callStack);
          for (const [bindName, bindVal] of bindings) {
            letEnv.define(bindName, bindVal);
          }
        }
      }
    }
  }

  let result = null;
  for (let i = 2; i < ast.length; i++) {
    result = await evaluate(ast[i], letEnv, callStack);
  }
  return result;
}

async function evalIf(ast, env, callStack) {
  if (ast.length < 3 || ast.length > 4) {
    throw hobError('if requires 2 or 3 arguments', null, callStack);
  }
  const test = await evaluate(ast[1], env, callStack);
  // Only false and nil are falsy
  if (test !== false && test !== null) {
    return await evaluate(ast[2], env, callStack);
  } else {
    return ast.length > 3 ? await evaluate(ast[3], env, callStack) : null;
  }
}

async function evalDo(ast, env, callStack) {
  let result = null;
  for (let i = 1; i < ast.length; i++) {
    result = await evaluate(ast[i], env, callStack);
  }
  return result;
}

function evalQuote(ast) {
  if (ast.length !== 2) throw hobError('quote requires exactly 1 argument', null);
  return astToValue(ast[1]);
}

function astToValue(node) {
  if (node === null) return null;
  if (typeof node === 'number') return node;
  if (typeof node === 'boolean') return node;
  if (typeof node === 'string') {
    if (node[0] === ':') return keyword(node.slice(1));
    if (node[0] === '@') return { _hobType: 'item-ref', value: node.slice(1) };
    return { _hobType: 'symbol', value: node };
  }
  if (Array.isArray(node)) return node.map(astToValue);
  if (typeof node === 'object') {
    if ('s' in node) return node.s;
    if ('v' in node) {
      const arr = node.v.map(astToValue);
      Object.defineProperty(arr, '_isHobVector', { value: true });
      return arr;
    }
    if ('m' in node) {
      const obj = {};
      for (const [k, v] of node.m) {
        let key = astToValue(k);
        if (typeof key !== 'string') key = String(key);
        obj[key] = astToValue(v);
      }
      return obj;
    }
  }
  return null;
}

async function evalAnd(ast, env, callStack) {
  if (ast.length === 1) return true;
  let result = true;
  for (let i = 1; i < ast.length; i++) {
    result = await evaluate(ast[i], env, callStack);
    if (result === false || result === null) return result;
  }
  return result;
}

async function evalOr(ast, env, callStack) {
  if (ast.length === 1) return null;
  let result = null;
  for (let i = 1; i < ast.length; i++) {
    result = await evaluate(ast[i], env, callStack);
    if (result !== false && result !== null) return result;
  }
  return result;
}

async function evalLoop(ast, env, callStack) {
  if (ast.length < 3) throw hobError('loop requires bindings and body', null, callStack);
  const bindingsNode = ast[1];
  if (!isVec(bindingsNode)) throw hobError('loop bindings must be a vector', null, callStack);
  if (bindingsNode.v.length % 2 !== 0) throw hobError('loop bindings must have an even number of forms', null, callStack);

  const bindingPatterns = [];
  const loopEnv = new Environment(env);
  for (let i = 0; i < bindingsNode.v.length; i += 2) {
    const nameNode = bindingsNode.v[i];
    const value = await evaluate(bindingsNode.v[i + 1], loopEnv, callStack);
    if (isSym(nameNode)) {
      bindingPatterns.push({ pattern: nameNode, isSimple: true, name: nameNode });
      loopEnv.define(nameNode, value);
    } else {
      bindingPatterns.push({ pattern: nameNode, isSimple: false });
      const bindings = await destructure(nameNode, value, loopEnv, callStack);
      for (const [bindName, bindVal] of bindings) {
        loopEnv.define(bindName, bindVal);
      }
    }
  }

  const bodyExprs = ast.slice(2);

  while (true) {
    let result = null;
    for (const expr of bodyExprs) {
      result = await evaluate(expr, loopEnv, callStack);
    }
    if (result && result[RECUR]) {
      const newValues = result.values;
      if (newValues.length !== bindingPatterns.length) {
        throw hobError(`recur expected ${bindingPatterns.length} values, got ${newValues.length}`, null, callStack);
      }
      for (let i = 0; i < bindingPatterns.length; i++) {
        const bp = bindingPatterns[i];
        if (bp.isSimple) {
          loopEnv.define(bp.name, newValues[i]);
        } else {
          const bindings = await destructure(bp.pattern, newValues[i], loopEnv, callStack);
          for (const [bindName, bindVal] of bindings) {
            loopEnv.define(bindName, bindVal);
          }
        }
      }
      continue;
    }
    return result;
  }
}

async function evalRecur(ast, env, callStack) {
  const values = [];
  for (let i = 1; i < ast.length; i++) {
    values.push(await evaluate(ast[i], env, callStack));
  }
  return { [RECUR]: true, values };
}

// ---- throw / try / catch / finally ----

async function evalThrow(ast, env, callStack) {
  if (ast.length !== 2) throw hobError('throw requires exactly 1 argument', null, callStack);
  const value = await evaluate(ast[1], env, callStack);
  const err = new HobError(typeof value === 'string' ? value : prStr(value, false), null, null, callStack);
  err.hobValue = value;
  throw err;
}

async function evalTry(ast, env, callStack) {
  // Parse try body, catch clause, optional finally clause
  const bodyExprs = [];
  let catchClause = null;
  let finallyClause = null;

  for (let i = 1; i < ast.length; i++) {
    const el = ast[i];
    if (Array.isArray(el) && el.length > 0 && isSym(el[0])) {
      if (el[0] === 'catch') {
        if (el.length < 3) throw hobError('catch requires an error binding and body', null, callStack);
        if (!isSym(el[1])) throw hobError('catch error binding must be a symbol', null, callStack);
        catchClause = { bindName: el[1], body: el.slice(2), node: el };
        continue;
      }
      if (el[0] === 'finally') {
        finallyClause = { body: el.slice(1), node: el };
        continue;
      }
    }
    bodyExprs.push(el);
  }

  let result = null;
  let finallyRan = false;
  try {
    for (const expr of bodyExprs) {
      result = await evaluate(expr, env, callStack);
    }
  } catch (e) {
    if (catchClause) {
      const catchEnv = new Environment(env);
      const errValue = (e instanceof HobError && e.hobValue !== undefined) ? e.hobValue :
                        (e instanceof Error ? e.message : String(e));
      catchEnv.define(catchClause.bindName, errValue);
      result = null;
      for (const expr of catchClause.body) {
        result = await evaluate(expr, catchEnv, callStack);
      }
    } else {
      if (finallyClause) {
        finallyRan = true;
        for (const expr of finallyClause.body) {
          await evaluate(expr, env, callStack);
        }
      }
      throw e;
    }
  } finally {
    if (finallyClause && !finallyRan) {
      for (const expr of finallyClause.body) {
        await evaluate(expr, env, callStack);
      }
    }
  }
  return result;
}

// ---- Quasiquote ----

async function evalQuasiquote(ast, env, callStack) {
  if (ast.length !== 2) throw hobError('quasiquote requires exactly 1 argument', null, callStack);
  return qqProcess(ast[1], env, callStack);
}

async function qqProcess(node, env, callStack) {
  if (node === null) return null;

  // (unquote expr) → evaluate expr
  if (Array.isArray(node) && node.length === 2 && node[0] === 'unquote') {
    return evaluate(node[1], env, callStack);
  }

  // List — process elements, handling unquote-splicing
  if (Array.isArray(node)) {
    const result = [];
    for (const el of node) {
      if (Array.isArray(el) && el.length === 2 && el[0] === 'unquote-splicing') {
        const spliced = await evaluate(el[1], env, callStack);
        if (Array.isArray(spliced)) {
          result.push(...spliced);
        } else if (spliced !== null) {
          result.push(spliced);
        }
      } else {
        result.push(await qqProcess(el, env, callStack));
      }
    }
    return result;
  }

  // Vector — same as list but marks result as vector
  if (isVec(node)) {
    const result = [];
    for (const el of node.v) {
      if (Array.isArray(el) && el.length === 2 && el[0] === 'unquote-splicing') {
        const spliced = await evaluate(el[1], env, callStack);
        if (Array.isArray(spliced)) {
          result.push(...spliced);
        } else if (spliced !== null) {
          result.push(spliced);
        }
      } else {
        result.push(await qqProcess(el, env, callStack));
      }
    }
    Object.defineProperty(result, '_isHobVector', { value: true });
    return result;
  }

  // Map — process keys and values (no splicing)
  if (isMap(node)) {
    const obj = {};
    for (const [kNode, vNode] of node.m) {
      let key = await qqProcess(kNode, env, callStack);
      const val = await qqProcess(vNode, env, callStack);
      if (typeof key !== 'string') key = String(key);
      obj[key] = val;
    }
    return obj;
  }

  // Everything else — convert via astToValue (same as quote)
  return astToValue(node);
}

// ---- defmacro ----

async function evalDefmacro(ast, env, callStack) {
  if (ast.length < 4) throw hobError('defmacro requires name, params, and body', null, callStack);
  const nameNode = ast[1];
  if (!isSym(nameNode)) throw hobError('defmacro name must be a symbol', null, callStack);

  const paramsNode = ast[2];
  if (!isVec(paramsNode)) throw hobError('defmacro params must be a vector', null, callStack);

  // Build a fn from the params and body, then mark as macro
  const fnAst = ['fn', paramsNode, ...ast.slice(3)];
  const macroFn = await evalFn(fnAst, env, callStack);
  macroFn._isMacro = true;
  macroFn._hobName = nameNode;
  env.define(nameNode, macroFn);
  return macroFn;
}

// ---- Multi-arity fn ----

function parseParamList(paramsNode, callStack) {
  const paramNames = [];
  let restParam = null;
  const paramPatterns = [];
  for (let i = 0; i < paramsNode.v.length; i++) {
    const p = paramsNode.v[i];
    if (p === '&') {
      if (i + 1 >= paramsNode.v.length) throw hobError('& must be followed by a parameter name', null, callStack);
      const restNode = paramsNode.v[i + 1];
      if (isSym(restNode)) {
        restParam = restNode;
      } else {
        restParam = '__rest__' + i;
        paramPatterns.push({ name: restParam, pattern: restNode });
      }
      break;
    }
    if (isSym(p)) {
      paramNames.push(p);
    } else {
      const tmpName = '__destr__' + i;
      paramNames.push(tmpName);
      paramPatterns.push({ name: tmpName, pattern: p });
    }
  }
  return { paramNames, restParam, paramPatterns };
}

async function bindArgs(fnEnv, paramNames, restParam, args, paramPatterns, callStack) {
  for (let i = 0; i < paramNames.length; i++) {
    fnEnv.define(paramNames[i], args[i] !== undefined ? args[i] : null);
  }
  if (restParam) {
    fnEnv.define(restParam, args.slice(paramNames.length));
  }
  // Apply destructuring patterns
  if (paramPatterns && paramPatterns.length > 0) {
    for (const { name, pattern } of paramPatterns) {
      const val = fnEnv.lookup(name);
      const bindings = await destructure(pattern, val, fnEnv, callStack);
      for (const [bindName, bindVal] of bindings) {
        fnEnv.define(bindName, bindVal);
      }
    }
  }
}

async function evalFnSingleArity(ast, env, callStack) {
  const paramsNode = ast[1];
  if (!isVec(paramsNode)) throw hobError('fn parameters must be a vector', null, callStack);

  const { paramNames, restParam, paramPatterns } = parseParamList(paramsNode, callStack);
  const bodyExprs = ast.slice(2);
  const closureEnv = env;

  const fn = async function (...args) {
    const fnEnv = new Environment(closureEnv);
    await bindArgs(fnEnv, paramNames, restParam, args, paramPatterns, callStack);
    let result = null;
    for (const expr of bodyExprs) {
      result = await evaluate(expr, fnEnv, callStack);
    }
    return result;
  };
  fn._hobName = null;
  fn._hobParams = paramNames;
  fn._hobRestParam = restParam;
  fn._hobBody = bodyExprs;
  fn._hobEnv = closureEnv;
  fn._hobCallStack = callStack;
  return fn;
}

async function evalFnMultiArity(ast, env, callStack) {
  const arities = [];
  for (let i = 1; i < ast.length; i++) {
    const clause = ast[i];
    if (!Array.isArray(clause) || clause.length < 2) {
      throw hobError('Multi-arity fn clause must be a list with params and body', null, callStack);
    }
    const paramsNode = clause[0];
    if (!isVec(paramsNode)) throw hobError('fn parameters must be a vector', null, callStack);
    const { paramNames, restParam, paramPatterns } = parseParamList(paramsNode, callStack);
    const bodyExprs = clause.slice(1);
    arities.push({ paramNames, restParam, paramPatterns, bodyExprs, arityCount: paramNames.length });
  }

  const closureEnv = env;

  const fn = async function (...args) {
    let matched = null;
    for (const arity of arities) {
      if (!arity.restParam && args.length === arity.arityCount) {
        matched = arity;
        break;
      }
    }
    if (!matched) {
      for (const arity of arities) {
        if (arity.restParam && args.length >= arity.arityCount) {
          matched = arity;
          break;
        }
      }
    }
    if (!matched) {
      throw hobError(`No matching arity for ${args.length} arguments`, null, callStack);
    }

    const fnEnv = new Environment(closureEnv);
    await bindArgs(fnEnv, matched.paramNames, matched.restParam, args, matched.paramPatterns, callStack);
    let result = null;
    for (const expr of matched.bodyExprs) {
      result = await evaluate(expr, fnEnv, callStack);
    }
    return result;
  };
  fn._hobName = null;
  fn._hobEnv = closureEnv;
  fn._hobCallStack = callStack;
  return fn;
}

// ---- plet ----

async function evalPlet(ast, env, callStack) {
  if (ast.length < 3) throw hobError('plet requires bindings and body', null, callStack);
  const bindingsNode = ast[1];
  if (!isVec(bindingsNode)) throw hobError('plet bindings must be a vector', null, callStack);
  if (bindingsNode.v.length % 2 !== 0) throw hobError('plet bindings must have an even number of forms', null, callStack);

  const names = [];
  const patterns = [];
  const promises = [];
  for (let i = 0; i < bindingsNode.v.length; i += 2) {
    names.push(bindingsNode.v[i]);
    patterns.push(bindingsNode.v[i]);
    promises.push(evaluate(bindingsNode.v[i + 1], env, callStack));
  }
  const values = await Promise.all(promises);

  const pletEnv = new Environment(env);
  for (let i = 0; i < names.length; i++) {
    const nameNode = names[i];
    if (isSym(nameNode)) {
      pletEnv.define(nameNode, values[i]);
    } else {
      const bindings = await destructure(nameNode, values[i], pletEnv, callStack);
      for (const [bindName, bindVal] of bindings) {
        pletEnv.define(bindName, bindVal);
      }
    }
  }

  let result = null;
  for (let i = 2; i < ast.length; i++) {
    result = await evaluate(ast[i], pletEnv, callStack);
  }
  return result;
}

// ---- Destructuring ----

async function destructure(pattern, value, env, callStack) {
  const bindings = [];

  if (isVec(pattern)) {
    // Vector destructuring
    const arr = value === null ? [] : value;
    if (value !== null && !Array.isArray(arr)) {
      throw hobError('Cannot destructure non-sequential value as vector', null, callStack);
    }
    for (let i = 0; i < pattern.v.length; i++) {
      const p = pattern.v[i];
      if (p === '&') {
        if (i + 1 < pattern.v.length) {
          const restPattern = pattern.v[i + 1];
          if (isSym(restPattern)) {
            bindings.push([restPattern, arr.slice(i)]);
          } else {
            const nested = await destructure(restPattern, arr.slice(i), env, callStack);
            bindings.push(...nested);
          }
        }
        break;
      }
      if (p === '_') {
        continue;
      }
      const val = i < arr.length ? arr[i] : null;
      if (isSym(p)) {
        bindings.push([p, val]);
      } else {
        const nested = await destructure(p, val, env, callStack);
        bindings.push(...nested);
      }
    }
    return bindings;
  }

  if (isMap(pattern)) {
    // Map destructuring
    const map = value === null ? {} : value;
    let keysEntries = null;
    let strsEntries = null;
    let orDefaults = null;
    let asName = null;
    const directBindings = [];

    for (const [kNode, vNode] of pattern.m) {
      let keyStr = null;
      if (typeof kNode === 'string' && kNode[0] === ':') keyStr = kNode.slice(1);
      else if (isSym(kNode)) keyStr = kNode;

      if (keyStr === 'keys' && isVec(vNode)) {
        keysEntries = vNode.v;
        continue;
      }
      if (keyStr === 'strs' && isVec(vNode)) {
        strsEntries = vNode.v;
        continue;
      }
      if (keyStr === 'or' && isMap(vNode)) {
        orDefaults = vNode;
        continue;
      }
      if (keyStr === 'as' && isSym(vNode)) {
        asName = vNode;
        continue;
      }
      directBindings.push([kNode, vNode]);
    }

    // Process :keys [a b] — look up keyword ʞa, ʞb
    if (keysEntries) {
      for (const entry of keysEntries) {
        const name = entry; // symbol string in compact JSON
        const key = keyword(name);
        const val = (map && typeof map === 'object' && key in map) ? map[key] : null;
        bindings.push([name, val]);
      }
    }

    // Process :strs [a b] — look up string "a", "b"
    if (strsEntries) {
      for (const entry of strsEntries) {
        const name = entry;
        const val = (map && typeof map === 'object' && name in map) ? map[name] : null;
        bindings.push([name, val]);
      }
    }

    // Direct bindings: {a :a} → bind local `a` to map[ʞa]
    for (const [localNode, keyNode] of directBindings) {
      let key;
      if (typeof keyNode === 'string' && keyNode[0] === ':') {
        key = keyword(keyNode.slice(1));
      } else {
        key = await evaluate(keyNode, env, callStack);
        if (typeof key !== 'string') key = String(key);
      }
      const val = (map && typeof map === 'object' && key in map) ? map[key] : null;
      if (isSym(localNode)) {
        bindings.push([localNode, val]);
      } else {
        const nested = await destructure(localNode, val, env, callStack);
        bindings.push(...nested);
      }
    }

    // Apply :or defaults
    if (orDefaults) {
      for (const [kNode, vNode] of orDefaults.m) {
        const defName = isSym(kNode) ? kNode : (typeof kNode === 'string' && kNode[0] === ':' ? kNode.slice(1) : String(kNode));
        const idx = bindings.findIndex(([n]) => n === defName);
        if (idx !== -1 && bindings[idx][1] === null) {
          bindings[idx][1] = await evaluate(vNode, env, callStack);
        }
      }
    }

    // :as whole binding
    if (asName) {
      bindings.push([asName, value]);
    }

    return bindings;
  }

  throw hobError('Destructuring pattern must be a vector or map', null, callStack);
}

// ---- Free symbol analysis for auto-parallel let ----

function freeSymbols(ast, bound) {
  if (!bound) bound = new Set();
  const free = new Set();

  function walk(node, localBound) {
    if (node === null || node === undefined) return;

    if (typeof node === 'string') {
      if (isSym(node) && !localBound.has(node)) free.add(node);
      return;
    }

    if (typeof node === 'number' || typeof node === 'boolean') return;

    if (typeof node === 'object' && !Array.isArray(node)) {
      if ('s' in node) return;
      if ('v' in node) {
        for (const el of node.v) walk(el, localBound);
        return;
      }
      if ('m' in node) {
        for (const [k, v] of node.m) {
          walk(k, localBound);
          walk(v, localBound);
        }
        return;
      }
      return;
    }

    if (Array.isArray(node)) {
      if (node.length === 0) return;
      const head = node[0];

      if (head === 'quote') return;

      if (head === 'quasiquote') {
        walkQQ(node[1], localBound);
        return;
      }

      if (head === 'fn') {
        if (node.length >= 3 && isVec(node[1])) {
          const fnBound = new Set(localBound);
          extractBoundNames(node[1], fnBound);
          for (let i = 2; i < node.length; i++) {
            walk(node[i], fnBound);
          }
        } else {
          for (let i = 1; i < node.length; i++) {
            const clause = node[i];
            if (Array.isArray(clause) && isVec(clause[0])) {
              const fnBound = new Set(localBound);
              extractBoundNames(clause[0], fnBound);
              for (let j = 1; j < clause.length; j++) {
                walk(clause[j], fnBound);
              }
            }
          }
        }
        return;
      }

      if (head === 'let' || head === 'loop') {
        if (node.length >= 3 && isVec(node[1])) {
          const letBound = new Set(localBound);
          const binds = node[1].v;
          for (let i = 0; i < binds.length; i += 2) {
            if (i + 1 < binds.length) walk(binds[i + 1], letBound);
            extractBoundNames(binds[i], letBound);
          }
          for (let i = 2; i < node.length; i++) {
            walk(node[i], letBound);
          }
          return;
        }
      }

      for (const el of node) walk(el, localBound);
    }
  }

  function walkQQ(node, localBound) {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      if (node.length === 2 && isSym(node[0])) {
        if (node[0] === 'unquote' || node[0] === 'unquote-splicing') {
          walk(node[1], localBound);
          return;
        }
      }
      for (const el of node) walkQQ(el, localBound);
      return;
    }
    if (isVec(node)) {
      for (const el of node.v) walkQQ(el, localBound);
      return;
    }
    if (isMap(node)) {
      for (const [k, v] of node.m) {
        walkQQ(k, localBound);
        walkQQ(v, localBound);
      }
    }
  }

  walk(ast, bound);
  return free;
}

function extractBoundNames(pattern, nameSet) {
  if (pattern === null || pattern === undefined) return;
  if (isSym(pattern)) {
    if (pattern !== '&' && pattern !== '_') nameSet.add(pattern);
    return;
  }
  if (isVec(pattern)) {
    for (const el of pattern.v) extractBoundNames(el, nameSet);
    return;
  }
  if (isMap(pattern)) {
    for (const [k, v] of pattern.m) {
      let keyStr = null;
      if (typeof k === 'string' && k[0] === ':') keyStr = k.slice(1);
      else if (isSym(k)) keyStr = k;
      if (keyStr === 'keys' || keyStr === 'strs') {
        if (isVec(v)) {
          for (const el of v.v) extractBoundNames(el, nameSet);
        }
      } else if (keyStr === 'as') {
        extractBoundNames(v, nameSet);
      } else if (keyStr !== 'or') {
        extractBoundNames(k, nameSet);
      }
    }
  }
}

function topologicalBatch(pairs) {
  const batches = [];
  const resolved = new Set();

  let remaining = [...pairs];
  while (remaining.length > 0) {
    const batch = [];
    const deferred = [];
    for (const pair of remaining) {
      const unresolved = [...pair.dependsOn].filter(d => !resolved.has(d));
      if (unresolved.length === 0) {
        batch.push(pair);
      } else {
        deferred.push(pair);
      }
    }
    if (batch.length === 0) {
      // Cycle or unresolvable — just run everything remaining sequentially
      for (const pair of deferred) batches.push([pair]);
      break;
    }
    batches.push(batch);
    for (const pair of batch) {
      for (const name of pair.names) resolved.add(name);
    }
    remaining = deferred;
  }
  return batches;
}

// ---- Function application ----

async function evalApply(ast, env, callStack) {
  const headNode = ast[0];
  const headVal = await evaluate(headNode, env, callStack);

  // Keywords as functions: (:key map) => get(map, key)
  if (isKeyword(headVal)) {
    if (ast.length < 2 || ast.length > 3) {
      throw hobError('Keyword lookup requires 1 or 2 arguments', null, callStack);
    }
    const target = await evaluate(ast[1], env, callStack);
    const defaultVal = ast.length > 2 ? await evaluate(ast[2], env, callStack) : null;
    if (target && typeof target === 'object' && !Array.isArray(target)) {
      if (headVal in target) return target[headVal];
      const plainKey = keywordName(headVal);
      if (plainKey in target) return target[plainKey];
      return defaultVal;
    }
    return defaultVal;
  }

  if (typeof headVal !== 'function') {
    throw hobError(`'${prStr(headVal, false)}' is not a function`, null, callStack);
  }

  // Evaluate arguments
  const args = [];
  for (let i = 1; i < ast.length; i++) {
    args.push(await evaluate(ast[i], env, callStack));
  }

  // Push call frame
  const frame = {
    name: headVal._hobName || (isSym(headNode) ? headNode : null),
    line: null,
    col: null
  };
  callStack.push(frame);

  try {
    let result = headVal(...args);
    if (result && typeof result.then === 'function') result = await result;
    return result;
  } catch (e) {
    if (e instanceof HobError) throw e;
    throw hobError(e.message, null, callStack);
  } finally {
    callStack.pop();
  }
}

// ============================================================
// Standard Library
// ============================================================

function createStdlib() {
  const env = new Environment();

  // --- Arithmetic ---
  env.define('+', Object.assign((...args) => args.reduce((a, b) => a + b, 0), { _hobName: '+' }));
  env.define('-', Object.assign((...args) => {
    if (args.length === 0) return 0;
    if (args.length === 1) return -args[0];
    return args.reduce((a, b) => a - b);
  }, { _hobName: '-' }));
  env.define('*', Object.assign((...args) => args.reduce((a, b) => a * b, 1), { _hobName: '*' }));
  env.define('/', Object.assign((...args) => {
    if (args.length === 0) throw new Error('/ requires at least 1 argument');
    if (args.length === 1) return 1 / args[0];
    return args.reduce((a, b) => a / b);
  }, { _hobName: '/' }));
  env.define('mod', Object.assign((a, b) => a % b, { _hobName: 'mod' }));
  env.define('inc', Object.assign((n) => n + 1, { _hobName: 'inc' }));
  env.define('dec', Object.assign((n) => n - 1, { _hobName: 'dec' }));

  // --- Comparison ---
  env.define('<', Object.assign((a, b) => a < b, { _hobName: '<' }));
  env.define('>', Object.assign((a, b) => a > b, { _hobName: '>' }));
  env.define('<=', Object.assign((a, b) => a <= b, { _hobName: '<=' }));
  env.define('>=', Object.assign((a, b) => a >= b, { _hobName: '>=' }));
  env.define('=', Object.assign((...args) => {
    if (args.length < 2) return true;
    const first = args[0];
    return args.every(a => deepEquals(a, first));
  }, { _hobName: '=' }));
  env.define('not=', Object.assign((a, b) => !deepEquals(a, b), { _hobName: 'not=' }));
  env.define('not', Object.assign((a) => a === false || a === null, { _hobName: 'not' }));

  // --- Strings ---
  env.define('str', Object.assign((...args) => args.map(a => {
    if (a === null) return '';
    if (isKeyword(a)) return ':' + keywordName(a);
    if (typeof a === 'string') return a;
    return prStr(a, false);
  }).join(''), { _hobName: 'str' }));
  env.define('pr-str', Object.assign((...args) => args.map(a => prStr(a, true)).join(' '), { _hobName: 'pr-str' }));
  env.define('subs', Object.assign((s, start, end) => {
    if (end !== undefined) return s.substring(start, end);
    return s.substring(start);
  }, { _hobName: 'subs' }));
  env.define('str/upper-case', Object.assign((s) => s.toUpperCase(), { _hobName: 'str/upper-case' }));
  env.define('str/lower-case', Object.assign((s) => s.toLowerCase(), { _hobName: 'str/lower-case' }));
  env.define('str/trim', Object.assign((s) => s.trim(), { _hobName: 'str/trim' }));
  env.define('str/split', Object.assign((s, sep) => s.split(sep), { _hobName: 'str/split' }));
  env.define('str/join', Object.assign((sep, coll) => {
    if (coll === undefined) { coll = sep; sep = ''; }
    return coll.join(sep);
  }, { _hobName: 'str/join' }));
  env.define('str/includes?', Object.assign((s, sub) => s.includes(sub), { _hobName: 'str/includes?' }));
  env.define('str/replace', Object.assign((s, match, replacement) => s.split(match).join(replacement), { _hobName: 'str/replace' }));

  // --- Collections ---
  env.define('count', Object.assign((coll) => {
    if (coll === null) return 0;
    if (typeof coll === 'string') return coll.length;
    if (Array.isArray(coll)) return coll.length;
    if (typeof coll === 'object') return Object.keys(coll).length;
    return 0;
  }, { _hobName: 'count' }));

  env.define('first', Object.assign((coll) => {
    if (coll === null) return null;
    if (Array.isArray(coll)) return coll.length > 0 ? coll[0] : null;
    return null;
  }, { _hobName: 'first' }));

  env.define('rest', Object.assign((coll) => {
    if (coll === null) return [];
    if (Array.isArray(coll)) return coll.slice(1);
    return [];
  }, { _hobName: 'rest' }));

  env.define('cons', Object.assign((x, coll) => {
    if (coll === null) return [x];
    return [x, ...coll];
  }, { _hobName: 'cons' }));

  env.define('conj', Object.assign((coll, ...items) => {
    if (coll === null) return [...items];
    if (Array.isArray(coll)) return [...coll, ...items];
    if (typeof coll === 'object') {
      const result = { ...coll };
      for (const item of items) {
        if (Array.isArray(item) && item.length === 2) {
          result[item[0]] = item[1];
        }
      }
      return result;
    }
    return coll;
  }, { _hobName: 'conj' }));

  env.define('concat', Object.assign((...colls) => {
    const result = [];
    for (const c of colls) {
      if (Array.isArray(c)) result.push(...c);
      else if (c !== null) result.push(c);
    }
    return result;
  }, { _hobName: 'concat' }));

  env.define('nth', Object.assign((coll, n) => {
    if (coll === null || n >= coll.length) return null;
    return coll[n];
  }, { _hobName: 'nth' }));

  env.define('get', Object.assign((coll, key, defaultVal = null) => {
    if (coll === null) return defaultVal;
    if (Array.isArray(coll)) {
      if (typeof key === 'number') return key < coll.length ? coll[key] : defaultVal;
      return defaultVal;
    }
    if (typeof coll === 'object') {
      if (key in coll) return coll[key];
      // Keyword fallback for JS interop
      if (isKeyword(key)) {
        const plain = keywordName(key);
        if (plain in coll) return coll[plain];
      }
      return defaultVal;
    }
    return defaultVal;
  }, { _hobName: 'get' }));

  env.define('assoc', Object.assign((coll, ...kvs) => {
    if (coll === null) coll = {};
    const result = Array.isArray(coll) ? [...coll] : { ...coll };
    for (let i = 0; i < kvs.length; i += 2) {
      const key = kvs[i];
      const val = kvs[i + 1];
      if (Array.isArray(result) && typeof key === 'number') {
        result[key] = val;
      } else {
        result[key] = val;
      }
    }
    return result;
  }, { _hobName: 'assoc' }));

  env.define('dissoc', Object.assign((coll, ...keys) => {
    if (coll === null) return null;
    const result = { ...coll };
    for (const k of keys) delete result[k];
    return result;
  }, { _hobName: 'dissoc' }));

  env.define('update', Object.assign(async (coll, key, fn, ...args) => {
    if (coll === null) coll = {};
    const result = Array.isArray(coll) ? [...coll] : { ...coll };
    const oldVal = Array.isArray(result) ? result[key] : (result[key] ?? null);
    let newVal = fn(oldVal, ...args);
    if (newVal && typeof newVal.then === 'function') newVal = await newVal;
    if (Array.isArray(result) && typeof key === 'number') {
      result[key] = newVal;
    } else {
      result[key] = newVal;
    }
    return result;
  }, { _hobName: 'update' }));

  env.define('get-in', Object.assign((coll, path) => {
    let current = coll;
    for (const key of path) {
      if (current === null || current === undefined) return null;
      if (Array.isArray(current)) {
        current = typeof key === 'number' && key < current.length ? current[key] : null;
      } else if (typeof current === 'object') {
        if (key in current) {
          current = current[key];
        } else if (isKeyword(key)) {
          // Keyword fallback for JS interop
          const plain = keywordName(key);
          current = plain in current ? current[plain] : null;
        } else {
          current = null;
        }
      } else {
        return null;
      }
    }
    return current;
  }, { _hobName: 'get-in' }));

  env.define('assoc-in', Object.assign((coll, path, value) => {
    if (path.length === 0) return value;
    if (path.length === 1) {
      const result = coll === null ? {} : (Array.isArray(coll) ? [...coll] : { ...coll });
      result[path[0]] = value;
      return result;
    }
    const result = coll === null ? {} : (Array.isArray(coll) ? [...coll] : { ...coll });
    const key = path[0];
    const child = (Array.isArray(result) ? result[key] : result[key]) ?? null;
    result[key] = env.lookup('assoc-in')(child, path.slice(1), value);
    return result;
  }, { _hobName: 'assoc-in' }));

  env.define('update-in', Object.assign(async (coll, path, fn, ...args) => {
    if (path.length === 0) {
      let result = fn(coll, ...args);
      if (result && typeof result.then === 'function') result = await result;
      return result;
    }
    const result = coll === null ? {} : (Array.isArray(coll) ? [...coll] : { ...coll });
    const key = path[0];
    const child = result[key] ?? null;
    result[key] = await env.lookup('update-in')(child, path.slice(1), fn, ...args);
    return result;
  }, { _hobName: 'update-in' }));

  env.define('keys', Object.assign((m) => {
    if (m === null) return [];
    return Object.keys(m);
  }, { _hobName: 'keys' }));

  env.define('vals', Object.assign((m) => {
    if (m === null) return [];
    return Object.values(m);
  }, { _hobName: 'vals' }));

  env.define('merge', Object.assign((...maps) => {
    const result = {};
    for (const m of maps) {
      if (m && typeof m === 'object' && !Array.isArray(m)) {
        Object.assign(result, m);
      }
    }
    return result;
  }, { _hobName: 'merge' }));

  env.define('into', Object.assign((to, from) => {
    if (to === null) to = [];
    if (Array.isArray(to)) {
      if (Array.isArray(from)) return [...to, ...from];
      if (from && typeof from === 'object') {
        return [...to, ...Object.entries(from).map(([k, v]) => [k, v])];
      }
      return to;
    }
    if (typeof to === 'object') {
      const result = { ...to };
      if (Array.isArray(from)) {
        for (const entry of from) {
          if (Array.isArray(entry) && entry.length >= 2) result[entry[0]] = entry[1];
        }
      } else if (from && typeof from === 'object') {
        Object.assign(result, from);
      }
      return result;
    }
    return to;
  }, { _hobName: 'into' }));

  env.define('empty?', Object.assign((coll) => {
    if (coll === null) return true;
    if (Array.isArray(coll)) return coll.length === 0;
    if (typeof coll === 'string') return coll.length === 0;
    if (typeof coll === 'object') return Object.keys(coll).length === 0;
    return true;
  }, { _hobName: 'empty?' }));

  env.define('seq', Object.assign((coll) => {
    if (coll === null) return null;
    if (Array.isArray(coll)) return coll.length > 0 ? coll : null;
    if (typeof coll === 'string') return coll.length > 0 ? coll.split('') : null;
    if (typeof coll === 'object') {
      const entries = Object.entries(coll);
      return entries.length > 0 ? entries.map(([k, v]) => [k, v]) : null;
    }
    return null;
  }, { _hobName: 'seq' }));

  env.define('vec', Object.assign((coll) => {
    if (coll === null) return [];
    if (Array.isArray(coll)) return [...coll];
    if (typeof coll === 'string') return coll.split('');
    return [coll];
  }, { _hobName: 'vec' }));

  env.define('contains?', Object.assign((coll, key) => {
    if (coll === null) return false;
    if (Array.isArray(coll)) return typeof key === 'number' && key >= 0 && key < coll.length;
    if (typeof coll === 'object') return key in coll;
    return false;
  }, { _hobName: 'contains?' }));

  // Coerce keywords to getter functions (Clojure-style keyword-as-function)
  function asFunc(f) {
    if (typeof f === 'function') return f;
    if (isKeyword(f)) {
      const kw = f;
      return (obj) => {
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          if (kw in obj) return obj[kw];
          const plain = keywordName(kw);
          if (plain in obj) return obj[plain];
        }
        return null;
      };
    }
    return f; // will fail at call site with a clear error
  }

  // Higher-order collection functions
  env.define('map', Object.assign(async (fn, coll) => {
    if (coll === null) return [];
    fn = asFunc(fn);
    const result = [];
    for (const item of coll) {
      let val = fn(item);
      if (val && typeof val.then === 'function') val = await val;
      result.push(val);
    }
    return result;
  }, { _hobName: 'map' }));

  env.define('mapcat', Object.assign(async (fn, coll) => {
    if (coll === null) return [];
    fn = asFunc(fn);
    const result = [];
    for (const item of coll) {
      let val = fn(item);
      if (val && typeof val.then === 'function') val = await val;
      if (val != null && typeof val[Symbol.iterator] === 'function') {
        for (const v of val) result.push(v);
      }
    }
    return result;
  }, { _hobName: 'mapcat' }));

  env.define('filter', Object.assign(async (fn, coll) => {
    if (coll === null) return [];
    fn = asFunc(fn);
    const result = [];
    for (const item of coll) {
      let val = fn(item);
      if (val && typeof val.then === 'function') val = await val;
      if (val !== false && val !== null) result.push(item);
    }
    return result;
  }, { _hobName: 'filter' }));

  env.define('reduce', Object.assign(async (...args) => {
    let fn, init, coll;
    if (args.length === 2) {
      fn = args[0]; coll = args[1];
      if (!coll || coll.length === 0) {
        let r = fn();
        if (r && typeof r.then === 'function') r = await r;
        return r;
      }
      init = coll[0]; coll = coll.slice(1);
    } else {
      fn = args[0]; init = args[1]; coll = args[2];
    }
    if (coll === null) coll = [];
    let acc = init;
    for (const item of coll) {
      acc = fn(acc, item);
      if (acc && typeof acc.then === 'function') acc = await acc;
    }
    return acc;
  }, { _hobName: 'reduce' }));

  env.define('some', Object.assign(async (fn, coll) => {
    if (coll === null) return null;
    fn = asFunc(fn);
    for (const item of coll) {
      let val = fn(item);
      if (val && typeof val.then === 'function') val = await val;
      if (val !== false && val !== null) return val;
    }
    return null;
  }, { _hobName: 'some' }));

  env.define('every?', Object.assign(async (fn, coll) => {
    if (coll === null) return true;
    fn = asFunc(fn);
    for (const item of coll) {
      let val = fn(item);
      if (val && typeof val.then === 'function') val = await val;
      if (val === false || val === null) return false;
    }
    return true;
  }, { _hobName: 'every?' }));

  env.define('sort', Object.assign((coll) => {
    if (coll === null) return [];
    return [...coll].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  }, { _hobName: 'sort' }));

  env.define('sort-by', Object.assign(async (fn, coll) => {
    if (coll === null) return [];
    fn = asFunc(fn);
    const decorated = [];
    for (const item of coll) {
      let key = fn(item);
      if (key && typeof key.then === 'function') key = await key;
      decorated.push({ key, item });
    }
    decorated.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    return decorated.map(d => d.item);
  }, { _hobName: 'sort-by' }));

  env.define('reverse', Object.assign((coll) => {
    if (coll === null) return [];
    return [...coll].reverse();
  }, { _hobName: 'reverse' }));

  env.define('distinct', Object.assign((coll) => {
    if (coll === null) return [];
    const seen = new Set();
    const result = [];
    for (const item of coll) {
      const key = typeof item === 'object' ? JSON.stringify(item) : item;
      if (!seen.has(key)) { seen.add(key); result.push(item); }
    }
    return result;
  }, { _hobName: 'distinct' }));

  env.define('take', Object.assign((n, coll) => {
    if (coll === null) return [];
    return [...coll].slice(0, n);
  }, { _hobName: 'take' }));

  // --- Predicates ---
  env.define('nil?', Object.assign((x) => x === null, { _hobName: 'nil?' }));
  env.define('number?', Object.assign((x) => typeof x === 'number', { _hobName: 'number?' }));
  env.define('string?', Object.assign((x) => typeof x === 'string' && !isKeyword(x), { _hobName: 'string?' }));
  env.define('keyword?', Object.assign((x) => isKeyword(x), { _hobName: 'keyword?' }));
  env.define('symbol?', Object.assign((x) => x && typeof x === 'object' && x._hobType === 'symbol', { _hobName: 'symbol?' }));
  env.define('list?', Object.assign((x) => Array.isArray(x) && !x._isHobVector, { _hobName: 'list?' }));
  env.define('vector?', Object.assign((x) => Array.isArray(x) && !!x._isHobVector, { _hobName: 'vector?' }));
  env.define('sequential?', Object.assign((x) => Array.isArray(x), { _hobName: 'sequential?' }));
  env.define('map?', Object.assign((x) => x !== null && typeof x === 'object' && !Array.isArray(x) && x._hobType !== 'symbol' && x._hobType !== 'item-ref' && x._hobType !== 'atom', { _hobName: 'map?' }));
  env.define('set?', Object.assign(() => false, { _hobName: 'set?' }));
  env.define('fn?', Object.assign((x) => typeof x === 'function', { _hobName: 'fn?' }));
  env.define('item-ref?', Object.assign((x) => x && typeof x === 'object' && x._hobType === 'item-ref', { _hobName: 'item-ref?' }));
  env.define('boolean?', Object.assign((x) => typeof x === 'boolean', { _hobName: 'boolean?' }));
  env.define('atom?', Object.assign((x) => x && typeof x === 'object' && x._hobType === 'atom', { _hobName: 'atom?' }));

  // --- Atoms ---
  env.define('atom', Object.assign((value) => {
    const a = { _hobType: 'atom', value };
    // Tag with creation context so self-owned atoms don't trigger re-renders of their own view
    if (_currentTrackingContext) a._ownerCtx = _currentTrackingContext.trackerId;
    return a;
  }, { _hobName: 'atom' }));
  env.define('deref', Object.assign((atom) => {
    if (!atom || atom._hobType !== 'atom') throw new Error('deref requires an atom');
    if (_currentTrackingContext) _currentTrackingContext.tracker.recordAtomAccess(atom);
    return atom.value;
  }, { _hobName: 'deref' }));
  env.define('swap!', Object.assign(async (atom, fn, ...args) => {
    if (!atom || atom._hobType !== 'atom') throw new Error('swap! requires an atom');
    let newVal = fn(atom.value, ...args);
    if (newVal && typeof newVal.then === 'function') newVal = await newVal;
    atom.value = newVal;
    if (_atomMutationCallback) _atomMutationCallback(atom);
    return newVal;
  }, { _hobName: 'swap!' }));
  env.define('reset!', Object.assign((atom, value) => {
    if (!atom || atom._hobType !== 'atom') throw new Error('reset! requires an atom');
    atom.value = value;
    if (_atomMutationCallback) _atomMutationCallback(atom);
    return value;
  }, { _hobName: 'reset!' }));

  // --- I/O ---
  env.define('log', Object.assign((...args) => { console.log(...args.map(a => prStr(a, false))); return null; }, { _hobName: 'log' }));
  env.define('log/warn', Object.assign((...args) => { console.warn(...args.map(a => prStr(a, false))); return null; }, { _hobName: 'log/warn' }));
  env.define('log/error', Object.assign((...args) => { console.error(...args.map(a => prStr(a, false))); return null; }, { _hobName: 'log/error' }));
  env.define('confirm', Object.assign((msg) => confirm(prStr(msg, false)), { _hobName: 'confirm' }));
  env.define('alert', Object.assign((msg) => { alert(prStr(msg, false)); return null; }, { _hobName: 'alert' }));

  // --- Date/Time ---
  env.define('now', Object.assign(() => Date.now(), { _hobName: 'now' }));
  env.define('format-date', Object.assign((ts) => new Date(ts).toLocaleString(), { _hobName: 'format-date' }));

  // --- Utility ---
  env.define('type-of', Object.assign((x) => {
    if (x === null) return 'nil';
    if (typeof x === 'boolean') return 'boolean';
    if (typeof x === 'number') return 'number';
    if (typeof x === 'function') return 'fn';
    if (isKeyword(x)) return 'keyword';
    if (typeof x === 'string') return 'string';
    if (Array.isArray(x)) return 'vector';
    if (x && x._hobType === 'symbol') return 'symbol';
    if (x && x._hobType === 'item-ref') return 'item-ref';
    if (x && x._hobType === 'atom') return 'atom';
    if (typeof x === 'object') return 'map';
    return 'unknown';
  }, { _hobName: 'type-of' }));

  env.define('apply', Object.assign(async (fn, ...args) => {
    const lastArg = args[args.length - 1];
    const leading = args.slice(0, -1);
    const allArgs = Array.isArray(lastArg) ? [...leading, ...lastArg] : [...leading, lastArg];
    let result = fn(...allArgs);
    if (result && typeof result.then === 'function') result = await result;
    return result;
  }, { _hobName: 'apply' }));

  env.define('identity', Object.assign((x) => x, { _hobName: 'identity' }));
  env.define('constantly', Object.assign((x) => Object.assign(() => x, { _hobName: 'constantly' }), { _hobName: 'constantly' }));
  env.define('comp', Object.assign((...fns) => {
    return Object.assign(async (...args) => {
      const reversed = [...fns].reverse();
      let result = reversed[0](...args);
      if (result && typeof result.then === 'function') result = await result;
      for (let i = 1; i < reversed.length; i++) {
        result = reversed[i](result);
        if (result && typeof result.then === 'function') result = await result;
      }
      return result;
    }, { _hobName: 'comp' });
  }, { _hobName: 'comp' }));

  env.define('partial', Object.assign((fn, ...partialArgs) => {
    return Object.assign(async (...args) => {
      let result = fn(...partialArgs, ...args);
      if (result && typeof result.then === 'function') result = await result;
      return result;
    }, { _hobName: fn._hobName ? `partial(${fn._hobName})` : 'partial' });
  }, { _hobName: 'partial' }));

  // --- Macro helpers ---
  env.define('gensym', Object.assign((prefix) => gensym(prefix || 'G__'), { _hobName: 'gensym' }));
  env.define('symbol', Object.assign((name) => ({ _hobType: 'symbol', value: name }), { _hobName: 'symbol' }));
  env.define('list', Object.assign((...args) => [...args], { _hobName: 'list' }));
  env.define('keyword', Object.assign((name) => keyword(name), { _hobName: 'keyword' }));
  env.define('name', Object.assign((x) => {
    if (isKeyword(x)) return keywordName(x);
    if (x && typeof x === 'object' && x._hobType === 'symbol') return x.value;
    if (typeof x === 'string') return x;
    return String(x);
  }, { _hobName: 'name' }));

  // --- Concurrency ---
  env.define('pmap', Object.assign(async (fn, coll) => {
    if (coll === null) return [];
    return Promise.all(coll.map(item => {
      let result = fn(item);
      if (result && typeof result.then === 'function') return result;
      return result;
    }));
  }, { _hobName: 'pmap' }));

  // --- JS Interop ---
  env.define('invoke', Object.assign(async (obj, method, ...args) => {
    const jsArgs = args.map(a => hobToJs(a));
    const result = obj[method](...jsArgs);
    return (result && typeof result.then === 'function') ? await result : result;
  }, { _hobName: 'invoke' }));

  return env;
}

// Deep equality for = and not=
function deepEquals(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEquals(v, b[i]));
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => Object.hasOwn(b, k) && deepEquals(a[k], b[k]));
}

// ============================================================
// Item Operations (wired by createInterpreter)
// ============================================================

function registerItemOps(env, api) {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  env.define('get-item', Object.assign(async (id) => {
    if (_currentTrackingContext) _currentTrackingContext.tracker.recordAccess(id);
    try { return await api.get(id); } catch { return null; }
  }, { _hobName: 'get-item' }));

  env.define('set-item!', Object.assign(async (item) => {
    await api.set(hobToJs(item));
    return item;
  }, { _hobName: 'set-item!' }));

  env.define('delete-item!', Object.assign(async (id) => {
    await api.delete(id);
    return null;
  }, { _hobName: 'delete-item!' }));

  env.define('get-all', Object.assign(async () => {
    return await api.getAll();
  }, { _hobName: 'get-all' }));

  env.define('find-items', Object.assign(async (filter) => {
    return await api.query(hobToJs(filter));
  }, { _hobName: 'find-items' }));

  // Resolve item references
  env.define('resolve-ref', Object.assign(async (ref) => {
    if (!ref || ref._hobType !== 'item-ref') return ref;
    const value = ref.value;
    if (UUID_RE.test(value)) {
      return await api.get(value);
    }
    const items = await api.query({ name: value });
    if (items.length === 0) throw new Error(`Could not resolve item reference @${value}`);
    return items[0];
  }, { _hobName: 'resolve-ref' }));
}

// ============================================================
// View Operations (wired by createInterpreter or renderHobView)
// ============================================================

function registerViewOps(env, api) {
  env.define('api', api);

  // Cleanup registry for the current view render.
  // Handlers pushed here are wired to the DOM by renderHobView after evaluation.
  if (!api._hobCleanups) api._hobCleanups = [];

  const _drHob = new URLSearchParams(window.location.search).has('debug-render');
  env.define('render-item', Object.assign(async (itemId, viewIdOrOpts) => {
    if (_drHob) console.log(`[hob:render-item] START itemId=${String(itemId).slice(0,8)} opts=${typeof viewIdOrOpts}`);
    const t0 = _drHob ? performance.now() : 0;
    let dom;
    if (viewIdOrOpts && typeof viewIdOrOpts === 'object' && !Array.isArray(viewIdOrOpts)) {
      // Options map — extract keyword keys
      const opts = hobToJs(viewIdOrOpts);
      const viewId = opts.view || null;
      const renderOpts = {};
      if (opts['on-cycle']) renderOpts.onCycle = opts['on-cycle'];
      if (opts.decorator) renderOpts.decorator = opts.decorator;
      if (opts['sibling-container']) renderOpts.siblingContainer = opts['sibling-container'];
      dom = await api.renderItem(itemId, viewId, renderOpts);
    } else {
      // String or nil — backward-compatible
      dom = await api.renderItem(itemId, viewIdOrOpts || null);
    }
    if (_drHob) console.log(`[hob:render-item] DONE itemId=${String(itemId).slice(0,8)} ${(performance.now()-t0).toFixed(1)}ms hasDOM=${!!dom}`);
    return dom;
  }, { _hobName: 'render-item' }));

  env.define('on-cleanup!', Object.assign((handler) => {
    api._hobCleanups.push(handler);
    return null;
  }, { _hobName: 'on-cleanup!' }));

  env.define('on-document!', Object.assign((eventName, handler) => {
    const name = isKeyword(eventName) ? keywordName(eventName) : String(eventName);
    document.addEventListener(name, handler);
    const remove = () => document.removeEventListener(name, handler);
    api._hobCleanups.push(remove);
    return remove;
  }, { _hobName: 'on-document!' }));

  env.define('on-event!', Object.assign((eventId, handler) => {
    const id = isKeyword(eventId) ? keywordName(eventId) : String(eventId);
    const unsub = api.events.on(id, handler);
    api._hobCleanups.push(unsub);
    return unsub;
  }, { _hobName: 'on-event!' }));

  env.define('get-sibling-container', Object.assign(() => {
    return api.siblingContainer;
  }, { _hobName: 'get-sibling-container' }));

  env.define('navigate!', Object.assign((itemId) => {
    api.navigate(itemId);
    return null;
  }, { _hobName: 'navigate!' }));

  env.define('open-item!', Object.assign((itemId, options) => {
    api.openItem(itemId, options ? hobToJs(options) : undefined);
    return null;
  }, { _hobName: 'open-item!' }));

  env.define('clear-selection!', Object.assign(async () => {
    if (api.viewport?.clearSelection) await api.viewport.clearSelection();
    return null;
  }, { _hobName: 'clear-selection!' }));

  env.define('rerender!', Object.assign(() => {
    api.rerenderItem();
    return null;
  }, { _hobName: 'rerender!' }));

  env.define('get-view-config', Object.assign(async () => {
    if (!api.getViewConfig) return null;
    const config = await api.getViewConfig();
    return config || null;
  }, { _hobName: 'get-view-config' }));

  env.define('update-view-config!', Object.assign(async (updates) => {
    if (!api.updateViewConfig) return false;
    return await api.updateViewConfig(hobToJs(updates));
  }, { _hobName: 'update-view-config!' }));

  env.define('require', Object.assign(async (name) => {
    return await api.require(name);
  }, { _hobName: 'require' }));

  env.define('search-items!', Object.assign(async (query, options) => {
    const searchLib = await api.require('item-search-lib');
    return await searchLib.searchItems(query, api, options ? hobToJs(options) : {});
  }, { _hobName: 'search-items!' }));

  env.define('get-starred-items!', Object.assign(async (options) => {
    const searchLib = await api.require('item-search-lib');
    return await searchLib.getStarredItems(api, options ? hobToJs(options) : {});
  }, { _hobName: 'get-starred-items!' }));

  env.define('render-markdown', Object.assign(async (text) => {
    const hobsonMarkdown = await api.require('hobson-markdown');
    return await hobsonMarkdown.render(text, api);
  }, { _hobName: 'render-markdown' }));

  env.define('copy-to-clipboard!', Object.assign(async (text) => {
    await navigator.clipboard.writeText(text);
    return null;
  }, { _hobName: 'copy-to-clipboard!' }));

  env.define('detach!', Object.assign(async (childId) => {
    await api.detach(childId);
    return null;
  }, { _hobName: 'detach!' }));

  env.define('reorder-attachments!', Object.assign(async (fromIndex, toIndex) => {
    const itemId = api.getCurrentItem().id;
    const fresh = await api.get(itemId);
    const attachments = [...(fresh.attachments || [])];
    const [moved] = attachments.splice(fromIndex, 1);
    attachments.splice(toIndex, 0, moved);
    await api.set({ ...fresh, attachments, modified: Date.now() });
    return null;
  }, { _hobName: 'reorder-attachments!' }));

  env.define('get-selection!', Object.assign(async () => {
    const selectionMgr = await api.require('selection-manager');
    return selectionMgr.getSelection() || null;
  }, { _hobName: 'get-selection!' }));

  env.define('get-related!', Object.assign(async (itemId) => {
    const relatedLib = await api.require('related-items-lib');
    await relatedLib.ensureBuilt(api);
    return await relatedLib.getRelated(itemId, api);
  }, { _hobName: 'get-related!' }));

  env.define('get-fqn!', Object.assign(async (itemId, rootId) => {
    const tagTreeBuilder = await api.require('tag-tree-builder');
    return await tagTreeBuilder.getFullyQualifiedName(itemId, api, rootId || undefined);
  }, { _hobName: 'get-fqn!' }));

  env.define('get-tagged-with-grouped!', Object.assign(async (itemId) => {
    const relatedLib = await api.require('related-items-lib');
    await relatedLib.ensureBuilt(api);
    return relatedLib.getItemsTaggedWithGrouped(itemId);
  }, { _hobName: 'get-tagged-with-grouped!' }));

  env.define('get-debug-mode', Object.assign(() => {
    return window.kernel?.debugMode || false;
  }, { _hobName: 'get-debug-mode' }));

  env.define('set-debug-mode!', Object.assign((value) => {
    window.kernel.debugMode = !!value;
    return null;
  }, { _hobName: 'set-debug-mode!' }));

  env.define('get-viewport-root', Object.assign(() => {
    return api.viewport.getRoot();
  }, { _hobName: 'get-viewport-root' }));
}

// ============================================================
// Event Operations (wired by createInterpreter or callHobWatchHandler)
// ============================================================

function registerEventOps(env, eventApi) {
  env.define('emit!', Object.assign((event) => {
    eventApi.emit(hobToJs(event));
    return null;
  }, { _hobName: 'emit!' }));
}

// ============================================================
// Public API
// ============================================================

export { read, readAll, evaluate, prStr, Environment, HobError, tokenize, parse,
         keyword, isKeyword, valueToAst, astToValue, hiccupToDOM, hiccupToDOMWithRefs, parseTag,
         registerViewOps, registerItemOps, registerEventOps, hobToJs,
         DependencyTracker, setAtomMutationCallback, setupSortable,
         compactify, compactifyAll, prettyPrint, prettyPrintAll };

// ============================================================
// Standard Macros (loaded at interpreter creation time)
// ============================================================

const STANDARD_MACROS = `
;; defn — single and multi-arity sugar
(defmacro defn [name & decls]
  (if (vector? (first decls))
    ;; Single-arity: (defn name [params] body...)
    (let [params (first decls)
          body (rest decls)]
      \`(def ~name (fn ~params ~@body)))
    ;; Multi-arity: (defn name ([p1] b1) ([p2] b2))
    \`(def ~name (fn ~@decls))))

;; when — (when test body...) => (if test (do body...) nil)
(defmacro when [test & body]
  \`(if ~test (do ~@body) nil))

;; when-let — (when-let [x expr] body...)
(defmacro when-let [binding & body]
  (let [sym (first binding)
        expr (first (rest binding))
        g (gensym "wl__")]
    \`(let [~g ~expr]
       (if ~g
         (let [~sym ~g] ~@body)
         nil))))

;; cond — recursive nested if
(defmacro cond [& clauses]
  (if (empty? clauses)
    nil
    (let [test (first clauses)
          then (first (rest clauses))
          remaining (rest (rest clauses))]
      (if (= test (keyword "else"))
        then
        \`(if ~test ~then (cond ~@remaining))))))

;; -> thread-first
(defmacro -> [x & forms]
  (if (empty? forms)
    x
    (let [form (first forms)
          remaining (rest forms)
          threaded (if (list? form)
                     (concat [(first form) x] (rest form))
                     (list form x))]
      \`(-> ~threaded ~@remaining))))

;; ->> thread-last
(defmacro ->> [x & forms]
  (if (empty? forms)
    x
    (let [form (first forms)
          remaining (rest forms)
          threaded (if (list? form)
                     (concat form (list x))
                     (list form x))]
      \`(->> ~threaded ~@remaining))))

;; for — (for [x coll] body) => (vec (map (fn [x] body) coll))
(defmacro for [bindings body]
  (let [sym (first bindings)
        coll (first (rest bindings))]
    \`(vec (map (fn [~sym] ~body) ~coll))))

;; doseq — (doseq [x coll] body...) => run body for side effects, return nil
(defmacro doseq [bindings & body]
  (let [sym (first bindings)
        coll (first (rest bindings))]
    \`(do (map (fn [~sym] ~@body) ~coll) nil)))

;; and — recursive with gensym
(defmacro and [& args]
  (if (empty? args)
    true
    (if (= 1 (count args))
      (first args)
      (let [g (gensym "and__")]
        \`(let [~g ~(first args)]
           (if ~g (and ~@(rest args)) ~g))))))

;; or — recursive with gensym
(defmacro or [& args]
  (if (empty? args)
    nil
    (if (= 1 (count args))
      (first args)
      (let [g (gensym "or__")]
        \`(let [~g ~(first args)]
           (if ~g ~g (or ~@(rest args))))))))

;; def-view — (def-view name for-type [item api] body...)
;; Defines a view render function
(defmacro def-view [name for-type params & body]
  \`(def ~name {:for-type ~for-type
               :render (fn ~params ~@body)}))

;; def-watch — (def-watch name watch-spec [event] body...)
;; Defines a watch handler
(defmacro def-watch [name watch-spec params & body]
  \`(def ~name {:watches [~watch-spec]
               :handler (fn ~params ~@body)}))
`;

export function createInterpreter(api, viewApi, eventApi) {
  const stdlib = createStdlib();
  // hiccup->dom is always available (pure function, no API dependency)
  stdlib.define('hiccup->dom', Object.assign((hiccup) => {
    return hiccupToDOM(hiccup);
  }, { _hobName: 'hiccup->dom' }));

  // hiccup->dom+ returns [dom-node refs-map] for imperative DOM manipulation
  stdlib.define('hiccup->dom+', Object.assign((hiccup) => {
    return hiccupToDOMWithRefs(hiccup);
  }, { _hobName: 'hiccup->dom+' }));

  // DOM mutation ops (no API dependency — pure DOM operations)
  stdlib.define('dom-on!', Object.assign((el, event, handler) => {
    const eventName = isKeyword(event) ? keywordName(event) : String(event);
    // Remove previous handler for this event if registered (prevents accumulation)
    if (el.__hobEvents?.[eventName]) {
      el.removeEventListener(eventName, el.__hobEvents[eventName]);
    }
    el.addEventListener(eventName, handler);
    // Register in __hobEvents so morphdom's onBeforeElUpdated can transfer handlers
    if (!el.__hobEvents) el.__hobEvents = {};
    el.__hobEvents[eventName] = handler;
    return null;
  }, { _hobName: 'dom-on!' }));

  stdlib.define('dom-set!', Object.assign((el, prop, value) => {
    const propName = isKeyword(prop) ? keywordName(prop) : String(prop);
    el[propName] = value;
    return null;
  }, { _hobName: 'dom-set!' }));

  stdlib.define('dom-get', Object.assign((el, prop) => {
    const propName = isKeyword(prop) ? keywordName(prop) : String(prop);
    return el[propName];
  }, { _hobName: 'dom-get' }));

  stdlib.define('dom-set-content!', Object.assign((el, content) => {
    el.innerHTML = '';
    if (content === null || content === undefined) return null;
    if (typeof content === 'string') {
      el.appendChild(document.createTextNode(content));
    } else if (content.nodeType) {
      el.appendChild(content);
    } else {
      // Treat as hiccup
      const node = hiccupToDOM(content);
      if (node) el.appendChild(node);
    }
    return null;
  }, { _hobName: 'dom-set-content!' }));

  stdlib.define('stop-propagation!', Object.assign((e) => {
    e.stopPropagation();
    return null;
  }, { _hobName: 'stop-propagation!' }));

  stdlib.define('prevent-default!', Object.assign((e) => {
    e.preventDefault();
    return null;
  }, { _hobName: 'prevent-default!' }));

  stdlib.define('set-timeout!', Object.assign((f, ms) => {
    return setTimeout(f, ms);
  }, { _hobName: 'set-timeout!' }));

  stdlib.define('clear-timeout!', Object.assign((id) => {
    clearTimeout(id);
    return null;
  }, { _hobName: 'clear-timeout!' }));

  if (api) registerItemOps(stdlib, api);
  if (viewApi) registerViewOps(stdlib, viewApi);
  if (eventApi) registerEventOps(stdlib, eventApi);

  // Load standard macros
  let macrosReady = null;
  const macrosPromise = (async () => {
    const exprs = readAll(STANDARD_MACROS);
    for (const ast of exprs) {
      await evaluate(ast, stdlib, []);
    }
    macrosReady = true;
  })();

  // Create a version of evaluate that resolves item-refs eagerly
  async function hobEval(source) {
    // Ensure macros are loaded before any user eval
    if (!macrosReady) await macrosPromise;
    const exprs = readAll(source);
    if (exprs.length === 0) return null;
    let result = null;
    for (const ast of exprs) {
      result = await evaluate(ast, stdlib, []);
      // Auto-resolve item refs
      if (result && result._hobType === 'item-ref' && api) {
        result = await stdlib.lookup('resolve-ref')(result);
      }
    }
    return result;
  }

  return {
    eval: hobEval,
    read,
    readAll,
    evaluate: (ast) => evaluate(ast, stdlib, []),
    print: prStr,
    env: stdlib,
    createEnvironment: () => new Environment(stdlib),
    macrosReady: macrosPromise,
    compactify,
    compactifyAll,
    prettyPrint,
    prettyPrintAll,
  };
}
