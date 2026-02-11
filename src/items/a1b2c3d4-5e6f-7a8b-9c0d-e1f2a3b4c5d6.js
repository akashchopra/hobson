

// Hobson-flavored markdown renderer
// Handles item:// links, transclusions, and query blocks

// Helper: Escape HTML for safe attribute values
const escapeHtml = (str) => {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Helper: Parse item URL
const parseItemUrl = (url) => {
  const match = url.match(/item:\/\/([a-f0-9\-]+)(?:#([^?]+))?(?:\?(.+))?/);
  if (!match) return null;
  const itemId = match[1];
  const fragment = match[2] || null;
  const queryString = match[3] || null;
  const queryParams = {};
  if (queryString) {
    queryString.split('&').forEach(pair => {
      const [key, val] = pair.split('=');
      queryParams[decodeURIComponent(key)] = decodeURIComponent(val || '');
    });
  }
  return { itemId, fragment, queryParams };
};

// Helper: Resolve symbol name to line range
const resolveSymbol = (item, symbolName) => {
  const symbols = item.content?._symbols || {};
  // Try exact match first (qualified name like 'createAPI.get')
  let symbolInfo = symbols[symbolName];
  // If not found, try unqualified match (first symbol with that name)
  if (!symbolInfo) {
    for (const [key, info] of Object.entries(symbols)) {
      if (info.name === symbolName) {
        symbolInfo = info;
        break;
      }
    }
  }
  if (!symbolInfo) return null;
  return { startLine: symbolInfo.line, endLine: symbolInfo.endLine };
};

// Helper: Get field value from item
const getFieldValue = (item, fieldName) => {
  if (fieldName === 'name') return item.name || '';
  if (fieldName === 'content') return JSON.stringify(item.content, null, 2);
  return item.content?.[fieldName] || '';
};

// Helper: Extract named region from text
const extractRegion = (text, regionName) => {
  const lines = text.split('\n');
  const beginMarker = '[BEGIN:' + regionName + ']';
  const endMarker = '[END:' + regionName + ']';
  let beginIdx = -1, endIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const cleaned = lines[i].trim().replace(/^\/\/\s*/, '').replace(/^#\s*/, '').replace(/^<!--\s*/, '').replace(/\s*-->$/, '').trim();
    if (cleaned === beginMarker) beginIdx = i;
    else if (cleaned === endMarker && beginIdx >= 0) { endIdx = i; break; }
  }
  if (beginIdx === -1 || endIdx === -1) throw new Error('Region not found: ' + regionName);
  return { text: lines.slice(beginIdx + 1, endIdx).join('\n'), startLine: beginIdx + 2 };
};

// Helper: Apply line range to text
const applyLineRange = (text, linesParam, baseStartLine = 1) => {
  if (!linesParam) return { text, startLine: baseStartLine };
  const lines = text.split('\n');
  let startLine, endLine;
  if (linesParam.includes('-')) {
    const parts = linesParam.split('-');
    startLine = parts[0] ? parseInt(parts[0]) : 1;
    endLine = parts[1] ? parseInt(parts[1]) : lines.length;
  } else {
    startLine = endLine = parseInt(linesParam);
  }
  const start = Math.max(0, startLine - 1);
  const end = Math.min(lines.length, endLine);
  return { text: lines.slice(start, end).join('\n'), startLine: baseStartLine + start };
};

let _perfCounter = 0;

/**
 * Render markdown with Hobson extensions.
 * @param {string} markdown - The markdown text to render
 * @param {object} api - The Hobson API object
 * @returns {Promise<HTMLElement>} - A div containing the rendered markdown
 */
export async function render(markdown, api, options = {}) {
  const perf = window.hobsonPerf;
  const perfId = ++_perfCounter;
  const md = markdown || '';

  // Load markdown-it (reuse if passed from parent render)
  let markdownit = options.markdownit;
  if (!markdownit) {
    perf?.mark(`md-require-${perfId}-start`);
    await api.require('markdown-it');
    const markdownitModule = await api.require('markdown-it-wrapper');
    markdownit = markdownitModule.default;
    perf?.mark(`md-require-${perfId}-end`);
    perf?.measure(`md-require-${perfId}`, `md-require-${perfId}-start`, `md-require-${perfId}-end`);
  }

  // Configure link rendering for item:// links and external links
  const renderer = markdownit.renderer;
  const defaultLinkRender = renderer.rules.link_open || function(tokens, idx, opts, env, self) {
    return self.renderToken(tokens, idx, opts);
  };

  renderer.rules.link_open = function(tokens, idx, opts, env, self) {
    const token = tokens[idx];
    const hrefIndex = token.attrIndex('href');
    if (hrefIndex >= 0) {
      const href = token.attrs[hrefIndex][1];
      if (href.startsWith('item://')) {
        token.attrSet('data-item-link', href);
        token.attrSet('href', '#');
      } else if (href.startsWith('http://') || href.startsWith('https://')) {
        // External links open in new tab
        token.attrSet('target', '_blank');
        token.attrSet('rel', 'noopener noreferrer');
      }
    }
    return defaultLinkRender(tokens, idx, opts, env, self);
  };

  // Render markdown to HTML
  perf?.mark(`md-parse-${perfId}-start`);
  let html = markdownit.render(md);
  perf?.mark(`md-parse-${perfId}-end`);
  perf?.measure(`md-parse-${perfId}`, `md-parse-${perfId}-start`, `md-parse-${perfId}-end`);

  // Process region markers: emit invisible anchor spans for [BEGIN:name] markers
  // This allows scroll-to-region navigation in rendered markdown
  html = html.replace(
    /<!--\s*\[BEGIN:([^\]]+)\]\s*-->/g,
    (match, regionName) => {
      return `<span data-region-start="${escapeHtml(regionName)}" style="display:none;"></span>${match}`;
    }
  );

  const content = api.createElement('div', { className: 'markdown-content' });
  content.style.cssText = 'line-height: 1.6; font-size: 13px;';
  content.innerHTML = html;

  // Handle item:// link clicks - open as sibling in current container, or navigate if root
  const links = content.querySelectorAll('a[data-item-link]');
  links.forEach(link => {
    const href = link.getAttribute('data-item-link');
    const parsed = parseItemUrl(href);
    if (parsed) {
      link.onclick = (e) => {
        e.preventDefault();
        // Build navigateTo params from URL fragment and query params
        const navigateTo = {
          field: parsed.fragment,
          line: parsed.queryParams.lines ? parseInt(parsed.queryParams.lines) : null,
          region: parsed.queryParams.region || null,
          symbol: parsed.queryParams.symbol || null
        };
        const hasNavigation = navigateTo.field || navigateTo.line || navigateTo.region || navigateTo.symbol;

        api.openItem(parsed.itemId, hasNavigation ? navigateTo : null);
      };
      link.style.cssText = 'color: var(--color-primary); text-decoration: none; border-bottom: 1px solid var(--color-primary); cursor: pointer;';
    }
  });

  // Handle transclusions (images with item:// src)
  const transclusionImages = content.querySelectorAll('img[src^="item://"]');
  perf?.mark('transclusions-start');
  let transclusionCount = 0;
  for (const img of transclusionImages) {
    transclusionCount++;
    perf?.mark(`transclusion-${transclusionCount}-start`);
    const fullUrl = img.src.replace(/^.*item:\/\//, 'item://');
    const parsed = parseItemUrl(fullUrl);
    const altText = img.alt;

    if (!parsed) {
      const errorDiv = api.createElement('div');
      errorDiv.style.cssText = 'background: var(--color-warning-light); border: 1px solid var(--color-warning); border-radius: var(--border-radius); padding: 8px 12px; margin: 10px 0; color: var(--color-warning-text); font-style: italic;';
      errorDiv.textContent = '[Invalid URL: ' + altText + ']';
      img.parentNode.replaceChild(errorDiv, img);
      continue;
    }

    try {
      const transcludedItem = await api.get(parsed.itemId);

      // Functional transclusion: ?call=fnName requires item as module, calls export
      if (parsed.queryParams.call) {
        const module = await api.require(parsed.itemId);
        const fnName = parsed.queryParams.call;
        const fn = module[fnName];
        if (typeof fn !== 'function') throw new Error('Export not found: ' + fnName);

        const result = await fn(api, parsed.queryParams);

        const wrapperDiv = api.createElement('details', { className: 'transclusion-container' });
        wrapperDiv.setAttribute('open', '');
        wrapperDiv.style.cssText = 'background: var(--color-bg-surface-alt); border: 1px solid var(--color-border-light); border-radius: var(--border-radius); padding: 15px; margin: 15px 0;';

        const header = api.createElement('summary');
        header.style.cssText = 'font-size: 12px; color: var(--color-text-secondary); padding-bottom: 8px; cursor: pointer;';
        header.textContent = 'From: ' + (transcludedItem.name || transcludedItem.id.slice(0, 8)) + '.' + fnName + '() ';
        const navLink = api.createElement('span');
        navLink.textContent = '↗';
        navLink.title = 'Open ' + (transcludedItem.name || transcludedItem.id);
        navLink.style.cssText = 'color: var(--color-primary); cursor: pointer;';
        navLink.onclick = (e) => { e.preventDefault(); e.stopPropagation(); api.openItem(parsed.itemId); };
        header.appendChild(navLink);
        wrapperDiv.appendChild(header);

        if (result?.nodeType) {
          wrapperDiv.appendChild(result);
        } else {
          const rendered = await render(result || '', api, { markdownit });
          wrapperDiv.appendChild(rendered);
        }

        img.parentNode.replaceChild(wrapperDiv, img);
        perf?.mark(`transclusion-${transclusionCount}-end`);
        perf?.measure(`transclusion-${transclusionCount}`, `transclusion-${transclusionCount}-start`, `transclusion-${transclusionCount}-end`);
        continue;
      }

      const isPartial = parsed.fragment || Object.keys(parsed.queryParams).length > 0;

      const wrapperDiv = api.createElement('details', { className: 'transclusion-container' });
      wrapperDiv.setAttribute('open', '');
      wrapperDiv.style.cssText = 'background: var(--color-bg-surface-alt); border: 1px solid var(--color-border-light); border-radius: var(--border-radius); padding: 15px; margin: 15px 0;';

      if (isPartial) {
        // Partial transclusion
        // Default to 'code' field when symbol is specified, otherwise 'content'
        const fieldName = parsed.fragment || (parsed.queryParams.symbol ? 'code' : 'content');
        let fieldValue = getFieldValue(transcludedItem, fieldName);
        if (!fieldValue) throw new Error('Field not found: ' + fieldName);

        let text, startLine = 1, endLine = null;
        if (parsed.queryParams.region) {
          const regionResult = extractRegion(fieldValue, parsed.queryParams.region);
          text = regionResult.text;
          startLine = regionResult.startLine;
        } else if (parsed.queryParams.symbol) {
          const symbolRange = resolveSymbol(transcludedItem, parsed.queryParams.symbol);
          if (!symbolRange) throw new Error('Symbol not found: ' + parsed.queryParams.symbol);
          text = fieldValue;
          startLine = symbolRange.startLine;
          endLine = symbolRange.endLine;
          // Apply symbol range as line range
          const lines = text.split('\n');
          text = lines.slice(startLine - 1, endLine).join('\n');
        } else {
          text = fieldValue;
        }

        if (parsed.queryParams.lines) {
          const rangeResult = applyLineRange(text, parsed.queryParams.lines, startLine);
          text = rangeResult.text;
          startLine = rangeResult.startLine;
        }

        let headerDesc = transcludedItem.name || transcludedItem.id;
        if (parsed.fragment) {
          headerDesc += ' (#' + parsed.fragment;
          if (parsed.queryParams.symbol) headerDesc += ', symbol=' + parsed.queryParams.symbol;
          if (parsed.queryParams.region) headerDesc += ', region=' + parsed.queryParams.region;
          if (parsed.queryParams.lines) headerDesc += ', lines=' + parsed.queryParams.lines;
          headerDesc += ')';
        }

        const header = api.createElement('summary');
        header.style.cssText = 'font-size: 12px; color: var(--color-text-secondary); padding-bottom: 8px; cursor: pointer;';
        header.textContent = 'Transcluded from: ' + headerDesc + ' ';
        const navLink = api.createElement('span');
        navLink.textContent = '↗';
        navLink.title = 'Open ' + (transcludedItem.name || transcludedItem.id);
        navLink.style.cssText = 'color: var(--color-primary); cursor: pointer;';
        navLink.onclick = (e) => { e.preventDefault(); e.stopPropagation(); api.openItem(parsed.itemId); };
        header.appendChild(navLink);
        wrapperDiv.appendChild(header);

        // Determine render mode: explicit override > auto-detect > default (code)
        const renderMode = parsed.queryParams.render
          || (fieldName === 'description' ? 'markdown' : null)
          || 'code';

        if (renderMode === 'markdown') {
          // Render as markdown (recursive call, reuse markdownit instance)
          const renderedMarkdown = await render(text, api, { markdownit });
          wrapperDiv.appendChild(renderedMarkdown);
        } else {
          // Render as code block
          const pre = api.createElement('pre');
          pre.style.cssText = 'margin: 0; padding: 10px; background: var(--color-bg-surface); border-radius: var(--border-radius); overflow-x: auto; font-family: monospace; font-size: 13px; line-height: 1.5;';

          const code = api.createElement('code');
          const lines = text.split('\n');
          lines.forEach((line, idx) => {
            const lineNum = startLine + idx;
            const lineNumSpan = api.createElement('span');
            lineNumSpan.style.cssText = 'display: inline-block; width: 40px; color: var(--color-border-dark); user-select: none; text-align: right; margin-right: 10px;';
            lineNumSpan.textContent = lineNum + '';
            code.appendChild(lineNumSpan);
            code.appendChild(document.createTextNode(line));
            if (idx < lines.length - 1) code.appendChild(document.createTextNode('\n'));
          });

          pre.appendChild(code);
          wrapperDiv.appendChild(pre);
        }
      } else {
        // Full transclusion
        const header = api.createElement('summary');
        header.style.cssText = 'font-size: 12px; color: var(--color-text-secondary); padding-bottom: 8px; cursor: pointer;';
        header.textContent = 'Transcluded from: ' + (transcludedItem.name || transcludedItem.id) + ' ';
        const navLink = api.createElement('span');
        navLink.textContent = '↗';
        navLink.title = 'Open ' + (transcludedItem.name || transcludedItem.id);
        navLink.style.cssText = 'color: var(--color-primary); cursor: pointer;';
        navLink.onclick = (e) => { e.preventDefault(); e.stopPropagation(); api.navigate(parsed.itemId); };
        header.appendChild(navLink);
        wrapperDiv.appendChild(header);

        const renderedContent = await api.renderItem(parsed.itemId);
        wrapperDiv.appendChild(renderedContent);
      }

      img.parentNode.replaceChild(wrapperDiv, img);
      perf?.mark(`transclusion-${transclusionCount}-end`);
      perf?.measure(`transclusion-${transclusionCount}`, `transclusion-${transclusionCount}-start`, `transclusion-${transclusionCount}-end`);
    } catch (err) {
      const errorDiv = api.createElement('div');
      errorDiv.style.cssText = 'background: var(--color-warning-light); border: 1px solid var(--color-warning); border-radius: var(--border-radius); padding: 8px 12px; margin: 10px 0; color: var(--color-warning-text); font-style: italic;';
      errorDiv.textContent = '[Missing: ' + altText + ' - ' + err.message + ']';
      img.parentNode.replaceChild(errorDiv, img);
      perf?.mark(`transclusion-${transclusionCount}-end`);
      perf?.measure(`transclusion-${transclusionCount}`, `transclusion-${transclusionCount}-start`, `transclusion-${transclusionCount}-end`);
    }
  }
  perf?.mark('transclusions-end');
  if (transclusionCount > 0) {
    perf?.measure(`transclusions-total(${transclusionCount})`, 'transclusions-start', 'transclusions-end');
  }

  // Handle query blocks (```query ... ```)
  const queryBlocks = content.querySelectorAll('pre > code.language-query');
  perf?.mark('queries-start');
  let queryCount = 0;
  for (const codeBlock of queryBlocks) {
    queryCount++;
    perf?.mark(`query-${queryCount}-start`);
    const pre = codeBlock.parentElement;
    const queryCode = codeBlock.textContent;

    try {
      // Helper: wrap content with transclusion chrome
      const transclude = (item, text, options = {}) => {
        const chrome = options.chrome || 'subtle';
        const itemId = typeof item === 'string' ? item : item.id;
        const itemName = typeof item === 'string' ? itemId : (item.name || itemId);
        if (chrome === 'none') return text;
        if (chrome === 'full') {
          return `<div class="query-transclude-full" data-item-id="${escapeHtml(itemId)}" data-item-name="${escapeHtml(itemName)}">\n\n${text}\n\n</div>`;
        }
        // Subtle chrome: append a link marker (doesn't interfere with markdown list processing)
        return `${text} [↗](transclude://${itemId}?name=${encodeURIComponent(itemName)})`;
      };

      // Helper: apply transclude to each item
      const transcludeEach = (items, formatter, options = {}) => {
        return items.map(item => transclude(item, formatter(item), options)).join('\n');
      };

      // Execute the query code with api and helpers in scope
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('api', 'transclude', 'transcludeEach', queryCode);
      const result = await fn(api, transclude, transcludeEach);

      const resultDiv = api.createElement('div', { className: 'query-result' });

      if (result?.nodeType) {
        // DOM node returned — insert directly
        resultDiv.appendChild(result);
      } else {
        // String returned — render as markdown (existing behaviour)
        const resultHtml = markdownit.render(result || '');
        resultDiv.innerHTML = resultHtml;

        // Process item:// links in the query result
        const resultLinks = resultDiv.querySelectorAll('a[data-item-link]');
        resultLinks.forEach(link => {
          const href = link.getAttribute('data-item-link');
          const parsed = parseItemUrl(href);
          if (parsed) {
            link.onclick = (e) => {
              e.preventDefault();
              const navigateTo = {
                field: parsed.fragment,
                line: parsed.queryParams.lines ? parseInt(parsed.queryParams.lines) : null,
                region: parsed.queryParams.region || null,
                symbol: parsed.queryParams.symbol || null
              };
              const hasNavigation = navigateTo.field || navigateTo.line || navigateTo.region || navigateTo.symbol;

              api.openItem(parsed.itemId, hasNavigation ? navigateTo : null);
            };
            link.style.cssText = 'color: var(--color-primary); text-decoration: none; border-bottom: 1px solid var(--color-primary); cursor: pointer;';
          }
        });

        // Process transclude:// links (subtle chrome)
        const transcludeLinks = resultDiv.querySelectorAll('a[href^="transclude://"]');
        for (const link of transcludeLinks) {
          const href = link.getAttribute('href');
          const match = href.match(/^transclude:\/\/([^?]+)\?name=(.+)$/);
          if (match) {
            const itemId = match[1];
            const itemName = decodeURIComponent(match[2]);

            // Style as subtle chrome
            link.style.cssText = 'color: var(--color-border-dark); font-size: 0.75em; margin-left: 3px; cursor: pointer; text-decoration: none; vertical-align: super;';
            link.title = 'From: ' + itemName;
            link.onclick = (e) => {
              e.preventDefault();
              api.openItem(itemId);
            };
          }
        }

        // Process full transclusion markers
        const fullMarkers = resultDiv.querySelectorAll('.query-transclude-full');
        for (const marker of fullMarkers) {
          const itemId = marker.getAttribute('data-item-id');
          const itemName = marker.getAttribute('data-item-name');

          // Create full chrome wrapper
          const wrapperDiv = api.createElement('details', { className: 'transclusion-container' });
          wrapperDiv.setAttribute('open', '');
          wrapperDiv.style.cssText = 'background: var(--color-bg-surface-alt); border: 1px solid var(--color-border-light); border-radius: var(--border-radius); padding: 15px; margin: 15px 0;';

          const header = api.createElement('summary');
          header.style.cssText = 'font-size: 12px; color: var(--color-text-secondary); padding-bottom: 8px; cursor: pointer;';
          header.textContent = 'From: ' + itemName + ' ';
          const navLink = api.createElement('span');
          navLink.textContent = '↗';
          navLink.title = 'Open ' + itemName;
          navLink.style.cssText = 'color: var(--color-primary); cursor: pointer;';
          navLink.onclick = (e) => { e.preventDefault(); e.stopPropagation(); api.openItem(itemId); };
          header.appendChild(navLink);
          wrapperDiv.appendChild(header);

          // Move marker contents into wrapper
          const contentDiv = api.createElement('div');
          while (marker.firstChild) {
            contentDiv.appendChild(marker.firstChild);
          }
          wrapperDiv.appendChild(contentDiv);

          marker.parentNode.replaceChild(wrapperDiv, marker);
        }
      }

      // Replace the pre block with the result
      pre.parentNode.replaceChild(resultDiv, pre);
      perf?.mark(`query-${queryCount}-end`);
      perf?.measure(`query-${queryCount}`, `query-${queryCount}-start`, `query-${queryCount}-end`);

    } catch (err) {
      const errorDiv = api.createElement('div');
      errorDiv.style.cssText = 'background: var(--color-danger-light); border: 1px solid var(--color-danger); border-radius: var(--border-radius); padding: 8px 12px; margin: 10px 0; color: var(--color-danger-text);';
      errorDiv.textContent = '[Query error: ' + err.message + ']';
      pre.parentNode.replaceChild(errorDiv, pre);
      perf?.mark(`query-${queryCount}-end`);
      perf?.measure(`query-${queryCount}`, `query-${queryCount}-start`, `query-${queryCount}-end`);
    }
  }
  perf?.mark('queries-end');
  if (queryCount > 0) {
    perf?.measure(`queries-total(${queryCount})`, 'queries-start', 'queries-end');
  }

  return content;
}

