// symbol-extractor-lib
// Extracts symbol definitions from JavaScript code using Acorn

export async function extractSymbols(code, api) {
  await api.require('acorn');
  const acorn = await api.require('acorn-wrapper');

  const comments = [];
  let ast;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
      allowReturnOutsideFunction: true,
      onComment: comments,
    });
  } catch (e) {
    console.warn('Symbol extraction parse error:', e.message);
    return {};
  }

  const symbols = {};
  walkNode(ast, null, symbols);
  attachJSDoc(comments, symbols);
  return symbols;
}

// Helper: Extract function signature from params
function extractSignature(params) {
  if (!params || params.length === 0) return '()';
  const parts = params.map(p => {
    switch (p.type) {
      case 'Identifier': return p.name;
      case 'AssignmentPattern':
        // foo = default
        const name = p.left.type === 'Identifier' ? p.left.name : '?';
        return name + ' = ...';
      case 'RestElement':
        // ...args
        const restName = p.argument.type === 'Identifier' ? p.argument.name : 'args';
        return '...' + restName;
      case 'ObjectPattern': return '{ ... }';
      case 'ArrayPattern': return '[ ... ]';
      default: return '?';
    }
  });
  return '(' + parts.join(', ') + ')';
}

// Helper: Get params from a function node (works for FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)
function getFunctionParams(node) {
  if (!node) return null;
  if (node.params) return node.params;
  if (node.value?.params) return node.value.params;  // MethodDefinition
  return null;
}

function walkNode(node, scope, symbols) {
  if (!node || typeof node !== 'object') return;

  switch (node.type) {
    case 'FunctionDeclaration':
      if (node.id?.name) {
        const sig = extractSignature(node.params);
        addSymbol(symbols, node.id.name, node.loc, 'function', scope, sig);
        walkNode(node.body, node.id.name, symbols);
      }
      break;

    case 'VariableDeclaration':
      for (const decl of node.declarations) {
        if (decl.id?.name) {
          const isFunc = decl.init?.type === 'ArrowFunctionExpression' ||
                         decl.init?.type === 'FunctionExpression';
          const kind = isFunc ? 'function' : 'variable';
          const sig = isFunc ? extractSignature(decl.init.params) : null;
          addSymbol(symbols, decl.id.name, decl.loc, kind, scope, sig);

          if (decl.init) {
            const initScope = decl.id.name;
            if (decl.init.body) {
              walkNode(decl.init.body, initScope, symbols);
            } else if (decl.init.type === 'ObjectExpression') {
              walkNode(decl.init, initScope, symbols);
            }
          }
        }
      }
      break;

    case 'ClassDeclaration':
      if (node.id?.name) {
        addSymbol(symbols, node.id.name, node.loc, 'class', scope);
        walkNode(node.body, node.id.name, symbols);
      }
      break;

    case 'MethodDefinition':
      if (node.key?.name) {
        const sig = extractSignature(node.value?.params);
        addSymbol(symbols, node.key.name, node.loc, 'method', scope, sig);
        walkNode(node.value?.body, `${scope}.${node.key.name}`, symbols);
      }
      break;

    case 'PropertyDefinition':
      if (node.key?.name) {
        const isFunc = node.value?.type === 'FunctionExpression' ||
                       node.value?.type === 'ArrowFunctionExpression';
        const kind = isFunc ? 'field-function' : 'field';
        const sig = isFunc ? extractSignature(node.value.params) : null;
        addSymbol(symbols, node.key.name, node.loc, kind, scope, sig);

        if (node.value?.body) {
          const newScope = scope ? `${scope}.${node.key.name}` : node.key.name;
          walkNode(node.value.body, newScope, symbols);
        }
      }
      break;

    case 'Property':
      if (node.key?.name) {
        const isFunc = node.value?.type === 'FunctionExpression' ||
                       node.value?.type === 'ArrowFunctionExpression' ||
                       node.method;
        const kind = isFunc ? 'property-function' : 'property';
        const sig = isFunc ? extractSignature(node.value?.params) : null;
        addSymbol(symbols, node.key.name, node.loc, kind, scope, sig);

        const newScope = scope ? `${scope}.${node.key.name}` : node.key.name;

        if (node.value?.body) {
          walkNode(node.value.body, newScope, symbols);
        } else if (node.value?.type === 'ObjectExpression') {
          walkNode(node.value, newScope, symbols);
        }
      }
      break;

    case 'ExportNamedDeclaration':
      if (node.declaration) {
        walkNode(node.declaration, scope, symbols);
      }
      break;

    case 'ExportDefaultDeclaration':
      if (node.declaration) {
        walkNode(node.declaration, scope, symbols);
      }
      break;

    default:
      for (const key of Object.keys(node)) {
        if (key === 'loc' || key === 'range') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          for (const c of child) {
            walkNode(c, scope, symbols);
          }
        } else if (child && typeof child === 'object' && child.type) {
          walkNode(child, scope, symbols);
        }
      }
  }
}

function addSymbol(symbols, name, loc, kind, scope, signature = null) {
  const key = scope ? `${scope}.${name}` : name;
  const info = {
    name,
    line: loc.start.line,
    col: loc.start.column,
    endLine: loc.end.line,
    endCol: loc.end.column,
    kind,
    scope: scope || null
  };
  if (signature) info.signature = signature;
  symbols[key] = info;
}

// Parse a JSDoc comment value (the text between /** and */)
function parseJSDoc(value) {
  const lines = value.split('\n').map(l => l.replace(/^\s*\*\s?/, '').trimEnd());
  // Drop empty first/last lines (from /** and */)
  if (lines.length && lines[0].trim() === '') lines.shift();
  if (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  let description = '';
  const params = [];
  let returns = null;

  for (const line of lines) {
    const paramMatch = line.match(/^@param\s+(?:\{([^}]*)\}\s+)?(\[?\w+\]?)\s*(?:-\s*)?(.*)$/);
    if (paramMatch) {
      const p = { name: paramMatch[2].replace(/^\[|\]$/g, '') };
      if (paramMatch[1]) p.type = paramMatch[1];
      if (paramMatch[3]) p.description = paramMatch[3];
      params.push(p);
      continue;
    }

    const returnMatch = line.match(/^@returns?\s+(?:\{([^}]*)\}\s*)?(.*)$/);
    if (returnMatch) {
      returns = {};
      if (returnMatch[1]) returns.type = returnMatch[1];
      if (returnMatch[2]) returns.description = returnMatch[2];
      continue;
    }

    // Skip other @ tags
    if (/^@\w/.test(line)) continue;

    // Accumulate description (lines before any @tag)
    if (params.length === 0 && !returns) {
      description += (description ? '\n' : '') + line;
    }
  }

  const result = {};
  description = description.trim();
  if (description) result.description = description;
  if (params.length) result.params = params;
  if (returns) result.returns = returns;
  return result;
}

// Attach JSDoc comments to the nearest symbol that follows them
function attachJSDoc(comments, symbols) {
  // Filter to JSDoc block comments (start with *)
  const jsdocs = comments.filter(c => c.type === 'Block' && c.value.startsWith('*'));
  if (!jsdocs.length) return;

  // Build array of symbols sorted by line
  const symEntries = Object.values(symbols);
  if (!symEntries.length) return;

  for (const comment of jsdocs) {
    const commentEndLine = comment.loc.end.line;
    // Find the symbol whose start line is closest after the comment end (within 1-line gap)
    let best = null;
    for (const sym of symEntries) {
      const gap = sym.line - commentEndLine;
      if (gap >= 0 && gap <= 1) {
        if (!best || sym.line < best.line) best = sym;
      }
    }
    if (!best) continue;

    const parsed = parseJSDoc(comment.value);
    if (parsed.description) best.description = parsed.description;
    if (parsed.params) best.params = parsed.params;
    if (parsed.returns) best.returns = parsed.returns;
  }
}