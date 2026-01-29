// Item: field_view_code_readonly
// ID: 8e2f3e95-cc2d-44a3-beeb-0569f400da7c
// Type: cccccccc-0000-0000-0000-000000000000


// Code readonly field view (CodeMirror)
export async function render(value, options, api) {
  const { label, language = 'javascript' } = options;
  const code = value || '';

  const wrapper = api.createElement('div', { className: 'field-code-readonly' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
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
  editorContainer.style.cssText = 'border: 1px solid #d0d0d0; border-radius: 6px; overflow: hidden;';
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
    const linkRegex = /\[([^\]]+)\]\(item:\/\/([a-f0-9-]+)\)/g;
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
        const link = document.createElement('a');
        link.textContent = linkText;
        link.href = '#';
        link.style.cssText = 'color: #007bff; text-decoration: underline; cursor: pointer;';
        link.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (api.siblingContainer) {
            api.siblingContainer.addSibling(itemId);
          } else {
            api.navigate(itemId);
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

  // Function to handle line navigation
  const navigateToLine = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const line = parseInt(urlParams.get('line'), 10);
    const col = parseInt(urlParams.get('col'), 10) || 0;

    if (!isNaN(line) && line > 0) {
      // CodeMirror uses 0-based line numbers
      const cmLine = line - 1;

      // Scroll line into view
      cm.scrollIntoView({ line: cmLine, ch: col }, 100);

      // Add highlight class to the line
      cm.addLineClass(cmLine, 'background', 'line-highlight');

      // Add CSS for highlight if not present
      if (!document.getElementById('line-highlight-css')) {
        const style = document.createElement('style');
        style.id = 'line-highlight-css';
        style.textContent = '.line-highlight { background: #fff3cd !important; }';
        document.head.appendChild(style);
      }
    }
  };

  // Use IntersectionObserver to refresh CodeMirror when visible
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        cm.refresh();
        processCommentLinks();
        navigateToLine();
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
    navigateToLine();
    editorContainer.removeEventListener('click', clickHandler);
  };
  editorContainer.addEventListener('click', clickHandler);

  // Re-process links when viewport changes (scroll/resize)
  cm.on('viewportChange', () => {
    requestAnimationFrame(processCommentLinks);
  });

  return wrapper;
}
