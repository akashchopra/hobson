// iframe-nav-tracker — synchronous pushState patching for iframe navigation depth tracking
//
// Hob functions are always async, but browsers reject async calls to
// History.pushState as insecure. This library provides a synchronous JS
// wrapper that patches pushState inside an iframe's contentWindow.
//
// Uses replaceState + renderViewport() instead of history.back() because
// the viewport-manager's popstate handler doesn't handle back-to-no-root.

/**
 * Patch pushState on an iframe to track navigation depth.
 * Call this from the iframe's onload handler.
 *
 * Returns an object with:
 *   - depth()  — current navigation depth (0 = at initial page)
 *   - back()   — go back if depth > 0; returns true if navigated
 *   - reset()  — reset depth to 0 (call on iframe reload)
 *
 * Returns null if the iframe's contentWindow is inaccessible (cross-origin).
 */
export function patch(iframe) {
  // Stack of URLs before each pushState — used for back navigation
  const urlStack = [];

  try {
    const iframeHistory = iframe.contentWindow.history;
    const origPushState = iframeHistory.pushState.bind(iframeHistory);
    iframeHistory.pushState = function(...args) {
      // Capture current URL before the push so we can go back to it
      urlStack.push(iframe.contentWindow.location.href);
      return origPushState(...args);
    };
  } catch (e) {
    return null;
  }

  return {
    depth() { return urlStack.length; },
    back() {
      if (urlStack.length > 0) {
        const prevUrl = urlStack.pop();
        // Replace current URL with the previous one (no new history entry)
        iframe.contentWindow.history.replaceState(null, '', prevUrl);
        // Tell the nested kernel to re-render from the updated URL
        iframe.contentWindow.kernel.renderViewport();
        return true;
      }
      return false;
    },
    reset() { urlStack.length = 0; }
  };
}
