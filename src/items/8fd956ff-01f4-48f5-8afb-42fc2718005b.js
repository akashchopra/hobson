
// Markdown readonly field view
export async function render(value, options, api) {
  const { label, scrollToRegion } = options;
  const markdown = value || '';

  const wrapper = api.createElement('div', { className: 'field-markdown-readonly' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: var(--color-text);';
    wrapper.appendChild(labelEl);
  }

  // Use the hobson-markdown library for rendering
  const hobsonMarkdown = await api.require('hobson-markdown');
  const content = await hobsonMarkdown.render(markdown, api);

  wrapper.appendChild(content);

  // Handle scroll-to-region navigation
  // Supports both region markers ([BEGIN:name]) and heading navigation (## Name)
  if (scrollToRegion) {
    // Use setTimeout to ensure DOM is ready after append
    setTimeout(() => {
      let target = null;

      // First try: region marker (hobson-markdown emits <span data-region-start="name">)
      const anchor = wrapper.querySelector(`[data-region-start="${scrollToRegion}"]`);
      if (anchor) {
        // Find the next visible sibling to scroll to (the anchor itself is display:none)
        target = anchor.nextElementSibling;
        if (!target) target = anchor.parentElement;
      }

      // Second try: heading with matching text or id
      if (!target) {
        const headings = wrapper.querySelectorAll('h1, h2, h3, h4, h5, h6');
        for (const h of headings) {
          // Match by id (kebab-case) or text content
          const headingId = h.id || '';
          const headingText = h.textContent.trim();
          if (headingId === scrollToRegion ||
              headingId === scrollToRegion.toLowerCase().replace(/\s+/g, '-') ||
              headingText === scrollToRegion ||
              headingText.toLowerCase() === scrollToRegion.toLowerCase()) {
            target = h;
            break;
          }
        }
      }

      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Add brief highlight effect
        target.style.transition = 'background 0.3s';
        target.style.background = 'var(--color-warning-light)';
        setTimeout(() => {
          target.style.background = '';
        }, 2000);
      }
    }, 100);
  }

  return wrapper;
}
