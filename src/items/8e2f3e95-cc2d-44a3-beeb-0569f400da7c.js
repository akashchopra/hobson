// Code Readonly Field View - CodeMirror-based readonly code display
// See [field-view-code-readonly documentation](item://8e2f3e95-cc2d-44a3-beeb-0569f400da7c)

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

// [BEGIN:render]
// Code readonly field view (CodeMirror)
export async function render(value, options, api) {
  const { label, language = 'javascript', scrollToLines, scrollToRegion, scrollToSymbol } = options;
  const code = value || '';

  const wrapper = api.createElement('div', { className: 'field-code-readonly' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: var(--color-text);';
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
  editorContainer.style.cssText = 'border: 1px solid var(--color-border); border-radius: var(--border-radius); overflow: hidden;';
  wrapper.appendChild(editorContainer);

  // Create CodeMirror instance in readonly mode
  const cm = CodeMirror(editorContainer, {
    value: code,
    mode: language,
    lineNumbers: true,
    lineWrapping: true,
    theme: 'default',
    readOnly: true,
    cursorBlinkRate: -1,
    viewportMargin: 2000
  });

  cm.setSize('100%', '400px');

  // Process comment spans to make item:// links clickable
  const processCommentLinks = () => {
    // Match [text](item://guid) or [text](item://guid#fragment)
    const linkRegex = /\[([^\]]+)\]\(item:\/\/([a-f0-9-]+)(#[^\)]+)?\)/g;
    const comments = editorContainer.querySelectorAll('.cm-comment:not([data-links-processed])');
    
    comments.forEach(span => {
      span.setAttribute('data-links-processed', 'true');
      const text = span.textContent;
      if (!linkRegex.test(text)) return;
      
      // Reset regex state and process
      linkRegex.lastIndex = 0;
      const parts = [];
      let lastIndex = 0;
      let match;
      
      while ((match = linkRegex.exec(text)) !== null) {
        // Add text before this match
        if (match.index > lastIndex) {
          parts.push(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        // Create clickable link
        const linkText = match[1];
        const itemId = match[2];
        const fragment = match[3]; // e.g., "#code?region=ModuleSystem" or undefined
        const link = document.createElement('a');
        link.textContent = linkText;
        link.href = '#';
        link.style.cssText = 'color: var(--color-primary); text-decoration: underline; cursor: pointer;';
        link.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Parse fragment using documented syntax: #field?region=X&lines=Y
          // Examples: #code?region=ModuleSystem -> field='code', region='ModuleSystem'
          //           #description -> field='description'
          //           #code?lines=10-20 -> field='code', lines='10-20'
          let navigateTo = null;
          if (fragment) {
            const fragContent = fragment.slice(1); // Remove leading #
            const [field, queryString] = fragContent.split('?', 2);
            navigateTo = { field: field || null };
            if (queryString) {
              const params = new URLSearchParams(queryString);
              if (params.has('region')) navigateTo.region = params.get('region');
              if (params.has('lines')) navigateTo.lines = params.get('lines');
              if (params.has('symbol')) navigateTo.symbol = params.get('symbol');
            }
          }
          if (api.siblingContainer) {
            api.siblingContainer.addSibling(itemId, navigateTo);
          } else {
            api.navigate(itemId, navigateTo);
          }
        };
        parts.push(link);
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text after last match
      if (lastIndex < text.length) {
        parts.push(document.createTextNode(text.slice(lastIndex)));
      }
      
      // Replace span contents
      if (parts.length > 0) {
        span.textContent = '';
        parts.forEach(part => span.appendChild(part));
      }
    });
  };

  // Helper: Parse lines param ("5" or "10-20") into { start, end }
  const parseLines = (linesStr) => {
    if (!linesStr) return null;
    if (linesStr.includes('-')) {
      const [start, end] = linesStr.split('-').map(n => parseInt(n, 10));
      return { start, end };
    }
    const line = parseInt(linesStr, 10);
    return { start: line, end: line };
  };

  // Function to handle line/region navigation
  const navigateToTarget = () => {
    // Parse scrollToLines ("5" or "10-20")
    let lineRange = parseLines(scrollToLines);

    // If scrollToRegion is specified but no lines, find the region
    if (scrollToRegion && !lineRange) {
      const regionStart = findRegionStartLine(code, scrollToRegion);
      if (regionStart) {
        lineRange = { start: regionStart, end: regionStart };
      }
    }

    // If scrollToSymbol is specified, look up in item's _symbols
    if (scrollToSymbol && !lineRange) {
      const currentItem = api.getCurrentItem();
      const symbols = currentItem?.content?._symbols || {};
      // Try exact match first, then unqualified match
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
        lineRange = { start: symbolInfo.line, end: symbolInfo.endLine };
      }
    }

    // Fallback to URL params for backward compatibility
    if (!lineRange) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlLines = urlParams.get('lines');
      if (urlLines) {
        lineRange = parseLines(urlLines);
      }
    }

    if (lineRange) {
      // CodeMirror uses 0-based line numbers
      const startLine = lineRange.start - 1;
      const endLine = lineRange.end - 1;

      // Scroll first line into view
      cm.scrollIntoView({ line: startLine, ch: 0 }, 100);

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
        processCommentLinks();
        navigateToTarget();
        observer.disconnect();
        break;
      }
    }
  }, { threshold: 0.1 });
  observer.observe(editorContainer);

  // Also refresh on first click as fallback
  const clickHandler = () => {
    cm.refresh();
    processCommentLinks();
    navigateToTarget();
    editorContainer.removeEventListener('click', clickHandler);
  };
  editorContainer.addEventListener('click', clickHandler);

  // Register cleanup handler for DOM removal (prevents CodeMirror memory leaks)
  wrapper.setAttribute('data-hobson-cleanup', '');
  wrapper.__hobsonCleanup = () => {
    observer.disconnect();
  };

  // Re-process links when viewport changes (scroll/resize)
  cm.on('viewportChange', () => {
    requestAnimationFrame(processCommentLinks);
  });

  return wrapper;
}
// [END:render]
