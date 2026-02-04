// Item: symbol-extractor-lib
// ID: ac0ac0ac-0003-0000-0000-000000000000
// Type: 66666666-0000-0000-0000-000000000000

// symbol-extractor-lib
// Extracts symbol definitions from JavaScript code using Acorn

export async function extractSymbols(code, api) {
  await api.require('acorn');
  const acorn = await api.require('acorn-wrapper');

  let ast;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
      allowReturnOutsideFunction: true,
    });
  } catch (e) {
    console.warn('Symbol extraction parse error:', e.message);
    return {};
  }

  const symbols = {};
  walkNode(ast, null, symbols);
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