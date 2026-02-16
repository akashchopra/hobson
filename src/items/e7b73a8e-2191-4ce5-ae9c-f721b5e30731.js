// Item: field-view-code-editable
// ID: e7b73a8e-2191-4ce5-ae9c-f721b5e30731
// Type: cccccccc-0000-0000-0000-000000000000

// Code Editable Field View - CodeMirror-based code editor
// See [field-view-code-editable documentation](item://e7b73a8e-2191-4ce5-ae9c-f721b5e30731)

// [BEGIN:findRegionStartLine]
// Helper: Find the line number where a region starts
function findRegionStartLine(text, regionName) {
  const lines = text.split('\n');
  const marker = '[BEGIN:' + regionName + ']';
  for (let i = 0; i < lines.length; i++) {
    const cleaned = lines[i].trim()
      .replace(/^\/\/\s*/, '')
      .replace(/^#\s*/, '')
      .replace(/^<!--\s*/, '')
      .replace(/\s*-->$/, '')
      .trim();
    if (cleaned === marker) return i + 2; // Line after marker (1-indexed)
  }
  return null;
}
// [END:findRegionStartLine]

// Helper: Parse lines param ("5" or "10-20") into { start, end }
const parseLines = (linesStr) => {
  if (!linesStr) return null;
  if (typeof linesStr === 'number') return { start: linesStr, end: linesStr };
  const str = String(linesStr);
  if (str.includes('-')) {
    const [start, end] = str.split('-').map(n => parseInt(n, 10));
    return { start, end };
  }
  const line = parseInt(str, 10);
  return { start: line, end: line };
};

// Inline compact JSON AST → s-expression pretty-printer (avoids loading hob-interpreter)
const _BF = new Set(['let','when','if','do','fn','defn','for','doseq','cond','when-let','loop','try','catch','def','defmacro','plet','->','->>','as->','quote','quasiquote']);
const _LF = new Set(['let','loop','when-let','plet']);
function _esc(s) { return '"' + s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\t/g,'\\t') + '"'; }
function pp(j, ind) {
  if (j === null) return 'nil';
  if (typeof j === 'number') return String(j);
  if (typeof j === 'boolean') return j ? 'true' : 'false';
  if (typeof j === 'string') return j;
  if (typeof j === 'object' && !Array.isArray(j)) {
    if ('s' in j) return _esc(j.s);
    if ('v' in j) return _ppV(j.v, ind);
    if ('m' in j) return _ppM(j.m, ind);
  }
  if (Array.isArray(j)) return _ppL(j, ind);
  return String(j);
}
function _ppL(l, ind) {
  if (!l.length) return '()';
  const flat = '(' + l.map(e => pp(e, 0)).join(' ') + ')';
  if (flat.length + ind <= 80) return flat;
  const h = typeof l[0] === 'string' ? l[0] : null, bi = ind + 2;
  if (h && _LF.has(h) && l.length >= 3 && l[1]?.v) {
    const b = _ppB(l[1].v, ind + 1 + h.length + 1);
    return '(' + h + ' ' + b + '\n' + l.slice(2).map(x => ' '.repeat(bi) + pp(x, bi)).join('\n') + ')';
  }
  if (h === 'fn' && l.length >= 3 && l[1]?.v) {
    const p = _ppV(l[1].v, ind + 4);
    return '(fn ' + p + '\n' + l.slice(2).map(x => ' '.repeat(bi) + pp(x, bi)).join('\n') + ')';
  }
  if (h === 'defn' && l.length >= 4 && l[2]?.v) {
    const n = pp(l[1], 0), p = _ppV(l[2].v, ind + 7 + n.length);
    return '(defn ' + n + ' ' + p + '\n' + l.slice(3).map(x => ' '.repeat(bi) + pp(x, bi)).join('\n') + ')';
  }
  if ((h === 'for' || h === 'doseq') && l.length >= 3 && l[1]?.v) {
    const b = _ppV(l[1].v, ind + h.length + 2);
    return '(' + h + ' ' + b + '\n' + l.slice(2).map(x => ' '.repeat(bi) + pp(x, bi)).join('\n') + ')';
  }
  if (h && _BF.has(h))
    return '(' + h + '\n' + l.slice(1).map(e => ' '.repeat(bi) + pp(e, bi)).join('\n') + ')';
  const parts = l.map(e => pp(e, bi));
  return '(' + parts[0] + '\n' + parts.slice(1).map(p => ' '.repeat(bi) + p).join('\n') + ')';
}
function _ppV(els, ind) {
  if (!els.length) return '[]';
  const flat = '[' + els.map(e => pp(e, 0)).join(' ') + ']';
  if (flat.length + ind <= 80) return flat;
  const ci = ind + 2;
  if (typeof els[0] === 'string' && els[0][0] === ':') {
    let a = '', cs = 1;
    if (els.length > 1 && els[1]?.m !== undefined) { a = ' ' + _ppM(els[1].m, ind + els[0].length + 2); cs = 2; }
    const hl = '[' + els[0] + a;
    if (cs >= els.length) return hl + ']';
    return hl + '\n' + els.slice(cs).map(c => ' '.repeat(ci) + pp(c, ci)).join('\n') + ']';
  }
  const parts = els.map(e => pp(e, ind + 1));
  return '[' + parts[0] + '\n' + parts.slice(1).map(p => ' '.repeat(ind + 1) + p).join('\n') + ']';
}
function _ppM(entries, ind) {
  if (!entries.length) return '{}';
  const flat = '{' + entries.map(([k,v]) => pp(k, 0) + ' ' + pp(v, 0)).join(' ') + '}';
  if (flat.length + ind <= 80) return flat;
  const ci = ind + 1;
  const lines = entries.map(([k,v], i) => {
    const ks = pp(k, ci), suf = i === entries.length - 1 ? '}' : '';
    return ' '.repeat(ci) + ks + ' ' + pp(v, ci + ks.length + 1) + suf;
  });
  return '{' + lines[0].trimStart() + '\n' + lines.slice(1).join('\n');
}
function _ppB(elems, ind) {
  if (!elems.length) return '[]';
  const flat = '[' + elems.map(e => pp(e, 0)).join(' ') + ']';
  if (flat.length + ind <= 80) return flat;
  const ci = ind + 1, pairs = [];
  for (let i = 0; i < elems.length; i += 2) {
    const n = pp(elems[i], ci);
    pairs.push(i + 1 < elems.length ? n + ' ' + pp(elems[i+1], ci + n.length + 1) : n);
  }
  const lines = pairs.map(p => ' '.repeat(ci) + p);
  return '[' + lines[0].trimStart() + '\n' + lines.slice(1).join('\n') + ']';
}
function ppAll(ast) { return ast.map(e => pp(e, 0)).join('\n\n'); }

// [BEGIN:render]
// Code editable field view
export async function render(value, options, api) {
  const { onChange, label, language = 'javascript', scrollToLines, scrollToLine, scrollToRegion, scrollToSymbol } = options;

  // JSON AST support: if value is a compact JSON AST array, pretty-print for editing.
  // Inline printer avoids loading hob-interpreter (which can trigger re-render).
  // Edits save as text — the dual-format system handles both string and array.
  const code = Array.isArray(value) ? ppAll(value) : (value || '');

  const wrapper = api.createElement('div', { className: 'field-code-editable' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 0.875rem; color: var(--color-text);';
    wrapper.appendChild(labelEl);
  }

  // Load CSS and CodeMirror
  const cssLoader = await api.require('css-loader-lib');
  await cssLoader.loadCSS('codemirror-css', api);
  await api.require('codemirror');
  await api.require('codemirror-javascript');
  const CodeMirror = window.CodeMirror;

  // Editor container
  const editorContainer = api.createElement('div');
  editorContainer.style.cssText = 'border: 1px solid var(--color-border); border-radius: var(--border-radius); overflow: hidden; min-height: 300px;';
  wrapper.appendChild(editorContainer);

  // Create CodeMirror instance
  const cm = CodeMirror(editorContainer, {
    value: code,
    mode: language,
    lineNumbers: true,
    lineWrapping: true,
    theme: 'default',
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
    viewportMargin: 2000,
    extraKeys: {
      'Tab': (editor) => {
        if (editor.somethingSelected()) {
          editor.indentSelection('add');
        } else {
          editor.replaceSelection('  ');
        }
      }
    }
  });

  cm.setSize('100%', '400px');

  // Function to handle line/region navigation
  const navigateToTarget = () => {
    // Parse scrollToLines ("5" or "10-20") - prefer plural, fall back to singular
    let lineRange = parseLines(scrollToLines) || parseLines(scrollToLine);

    // If scrollToRegion is specified but no lines, find the region
    if (scrollToRegion && !lineRange) {
      const regionStart = findRegionStartLine(code, scrollToRegion);
      if (regionStart) {
        lineRange = { start: regionStart, end: regionStart };
      }
    }

    // If scrollToSymbol is specified, look up in item's _symbols
    if (scrollToSymbol && !lineRange) {
      const currentItem = api.getCurrentItem ? api.getCurrentItem() : null;
      const symbols = currentItem?.content?._symbols || {};
      let symbolInfo = symbols[scrollToSymbol];
      if (!symbolInfo) {
        for (const [key, info] of Object.entries(symbols)) {
          if (info.name === scrollToSymbol) {
            symbolInfo = info;
            break;
          }
        }
      }
      if (symbolInfo) {
        lineRange = { start: symbolInfo.line, end: symbolInfo.endLine || symbolInfo.line };
      }
    }

    // Fallback to URL params for backward compatibility
    if (!lineRange) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlLines = urlParams.get('lines');
      if (urlLines) {
        lineRange = parseLines(urlLines);
      } else {
        const urlLine = parseInt(urlParams.get('line'), 10);
        if (!isNaN(urlLine) && urlLine > 0) {
          lineRange = { start: urlLine, end: urlLine };
        }
      }
    }

    if (lineRange) {
      // CodeMirror uses 0-based line numbers
      const startLine = lineRange.start - 1;
      const endLine = lineRange.end - 1;

      // Scroll first line into view and set cursor
      cm.scrollIntoView({ line: startLine, ch: 0 }, 100);
      cm.setCursor({ line: startLine, ch: 0 });
      cm.focus();

      // Add CSS for highlight if not present
      if (!document.getElementById('line-highlight-css')) {
        const style = document.createElement('style');
        style.id = 'line-highlight-css';
        style.textContent = '.line-highlight { background: var(--color-warning-light) !important; }';
        document.head.appendChild(style);
      }

      // Highlight all lines in range
      for (let i = startLine; i <= endLine; i++) {
        cm.addLineClass(i, 'background', 'line-highlight');
      }
    }
  };

  // Use IntersectionObserver to refresh CodeMirror when visible
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        cm.refresh();
        navigateToTarget();
        observer.disconnect();
        break;
      }
    }
  }, { threshold: 0.1 });
  observer.observe(editorContainer);

  // Also refresh on first focus as fallback
  const focusHandler = () => {
    cm.refresh();
    navigateToTarget();
    editorContainer.removeEventListener('click', focusHandler);
  };
  editorContainer.addEventListener('click', focusHandler);

  // Register cleanup handler for DOM removal (prevents CodeMirror memory leaks)
  wrapper.setAttribute('data-hobson-cleanup', '');
  wrapper.__hobsonCleanup = () => {
    if (cm.display?.blinker) clearInterval(cm.display.blinker);
    observer.disconnect();
  };

  // Call onChange on edits
  if (onChange) {
    cm.on('change', () => {
      onChange(cm.getValue());
    });
  }

  // Keyboard shortcut hint
  const hint = api.createElement('div');
  hint.style.cssText = 'font-size: 0.75rem; color: var(--color-text-tertiary);';
  hint.textContent = 'Tip: Tab for indent, Shift+Tab to dedent';
  wrapper.appendChild(hint);

  return wrapper;
}
// [END:render]
