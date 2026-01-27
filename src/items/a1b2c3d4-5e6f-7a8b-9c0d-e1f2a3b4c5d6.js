// Item: hobson-markdown
// ID: a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6
// Type: 66666666-0000-0000-0000-000000000000



// Hobson-flavored markdown renderer
// Handles item:// links and transclusions

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
      queryParams[key] = val;
    });
  }
  return { itemId, fragment, queryParams };
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

/**
 * Render markdown with Hobson extensions.
 * @param {string} markdown - The markdown text to render
 * @param {object} api - The Hobson API object
 * @returns {Promise<HTMLElement>} - A div containing the rendered markdown
 */
export async function render(markdown, api) {
  const md = markdown || '';

  // Load markdown-it
  await api.require('markdown-it');
  const markdownitModule = await api.require('markdown-it-wrapper');
  const markdownit = markdownitModule.default;

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
  const html = markdownit.render(md);

  const content = api.createElement('div', { className: 'markdown-content' });
  content.style.cssText = 'line-height: 1.8; font-size: 16px;';
  content.innerHTML = html;

  // Handle item:// link clicks - open as sibling in current container
  const links = content.querySelectorAll('a[data-item-link]');
  links.forEach(link => {
    const href = link.getAttribute('data-item-link');
    const parsed = parseItemUrl(href);
    if (parsed) {
      link.onclick = (e) => {
        e.preventDefault();
        api.siblingContainer?.addSibling(parsed.itemId);
      };
      link.style.cssText = 'color: #007bff; text-decoration: none; border-bottom: 1px solid #007bff; cursor: pointer;';
    }
  });

  // Handle transclusions (images with item:// src)
  const transclusionImages = content.querySelectorAll('img[src^="item://"]');
  for (const img of transclusionImages) {
    const fullUrl = img.src.replace(/^.*item:\/\//, 'item://');
    const parsed = parseItemUrl(fullUrl);
    const altText = img.alt;

    if (!parsed) {
      const errorDiv = api.createElement('div');
      errorDiv.style.cssText = 'background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 8px 12px; margin: 10px 0; color: #856404; font-style: italic;';
      errorDiv.textContent = '[Invalid URL: ' + altText + ']';
      img.parentNode.replaceChild(errorDiv, img);
      continue;
    }

    try {
      const transcludedItem = await api.get(parsed.itemId);
      const isPartial = parsed.fragment || Object.keys(parsed.queryParams).length > 0;

      const wrapperDiv = api.createElement('div', { className: 'transclusion-container' });
      wrapperDiv.style.cssText = 'background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 15px; margin: 15px 0;';

      if (isPartial) {
        // Partial transclusion
        const fieldName = parsed.fragment || 'content';
        let fieldValue = getFieldValue(transcludedItem, fieldName);
        if (!fieldValue) throw new Error('Field not found: ' + fieldName);

        let text, startLine = 1;
        if (parsed.queryParams.region) {
          const regionResult = extractRegion(fieldValue, parsed.queryParams.region);
          text = regionResult.text;
          startLine = regionResult.startLine;
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
          if (parsed.queryParams.region) headerDesc += ', region=' + parsed.queryParams.region;
          if (parsed.queryParams.lines) headerDesc += ', lines=' + parsed.queryParams.lines;
          headerDesc += ')';
        }

        const header = api.createElement('div');
        header.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #ddd; cursor: pointer;';
        header.textContent = 'Transcluded from: ' + headerDesc;
        header.onclick = () => api.siblingContainer.addSibling(parsed.itemId);
        wrapperDiv.appendChild(header);

        const pre = api.createElement('pre');
        pre.style.cssText = 'margin: 0; padding: 10px; background: #fff; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 13px; line-height: 1.5;';

        const code = api.createElement('code');
        const lines = text.split('\n');
        lines.forEach((line, idx) => {
          const lineNum = startLine + idx;
          const lineNumSpan = api.createElement('span');
          lineNumSpan.style.cssText = 'display: inline-block; width: 40px; color: #999; user-select: none; text-align: right; margin-right: 10px;';
          lineNumSpan.textContent = lineNum + '';
          code.appendChild(lineNumSpan);
          code.appendChild(document.createTextNode(line));
          if (idx < lines.length - 1) code.appendChild(document.createTextNode('\n'));
        });

        pre.appendChild(code);
        wrapperDiv.appendChild(pre);
      } else {
        // Full transclusion
        const header = api.createElement('div');
        header.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #ddd; cursor: pointer;';
        header.textContent = 'Transcluded from: ' + (transcludedItem.name || transcludedItem.id);
        header.onclick = () => api.navigate(parsed.itemId);
        wrapperDiv.appendChild(header);

        const renderedContent = await api.renderItem(parsed.itemId);
        wrapperDiv.appendChild(renderedContent);
      }

      img.parentNode.replaceChild(wrapperDiv, img);
    } catch (err) {
      const errorDiv = api.createElement('div');
      errorDiv.style.cssText = 'background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 8px 12px; margin: 10px 0; color: #856404; font-style: italic;';
      errorDiv.textContent = '[Missing: ' + altText + ' - ' + err.message + ']';
      img.parentNode.replaceChild(errorDiv, img);
    }
  }

  return content;
}
