// Hobson Instance View - iframe-based isolation
// See [hobson-instance-view documentation](item://99999999-1111-0000-0000-000000000000)

// [BEGIN:render]
// hobson-instance renderer - iframe-based isolation
export async function render(item, api) {
  // Build full instance ID by chaining current prefix with this item's ID
  const currentInstanceId = api.getInstanceId();
  const instanceId = currentInstanceId ? `${currentInstanceId}:${item.id}` : item.id;

  // Container element
  const container = document.createElement('div');
  container.style.cssText = `
    width: 100%;
    height: 100%;
    border: 1px solid var(--color-border-light);
    border-radius: var(--border-radius);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-body);
  `;

  // Header — matches spatial window chrome
  const header = document.createElement('div');
  header.style.cssText = `
    height: 24px;
    background: var(--color-bg-hover);
    border-bottom: 1px solid var(--color-border);
    padding: 0 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    font-weight: 500;
    flex-shrink: 0;
    user-select: none;
  `;

  const title = document.createElement('span');
  title.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
  title.textContent = `Nested: ${item.name || instanceId.slice(0, 8)}...`;
  header.appendChild(title);

  // Controls
  const controls = document.createElement('div');
  controls.style.cssText = 'display: flex; gap: 4px; align-items: center;';

  const btnStyle = 'padding: 0 6px; height: 18px; background: transparent; color: var(--color-text-secondary); border: none; cursor: pointer; font-size: 0.6875rem; border-radius: var(--border-radius);';

  // Track iframe navigation depth to prevent Back from escaping into parent
  let iframeNavDepth = 0;

  // Back button for nested instance history navigation
  const backBtn = document.createElement('button');
  backBtn.textContent = '\u2190 Back';
  backBtn.style.cssText = btnStyle;
  backBtn.onclick = () => {
    if (iframeNavDepth > 0) {
      iframeNavDepth--;
      iframe.contentWindow.history.back();
    }
  };
  controls.appendChild(backBtn);

  // Reload button
  const reloadBtn = document.createElement('button');
  reloadBtn.textContent = 'Reload';
  reloadBtn.style.cssText = btnStyle;
  reloadBtn.onclick = () => {
    iframeNavDepth = 0;
    iframe.src = iframe.src; // Force reload
  };
  controls.appendChild(reloadBtn);

  // Open in new tab button
  const newTabBtn = document.createElement('button');
  newTabBtn.textContent = 'Open in Tab';
  newTabBtn.style.cssText = btnStyle;
  newTabBtn.onclick = () => {
    window.open(iframe.src, '_blank');
  };
  controls.appendChild(newTabBtn);

  header.appendChild(controls);

  // Loading indicator
  const loading = document.createElement('div');
  loading.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  `;
  loading.textContent = 'Loading nested instance...';

  // Iframe container (for positioning)
  const iframeContainer = document.createElement('div');
  iframeContainer.style.cssText = `
    flex: 1;
    position: relative;
    overflow: hidden;
  `;
  iframeContainer.appendChild(loading);

  // Create iframe pointing to bootstrap with instance parameter
  const iframe = document.createElement('iframe');
  const bootstrapPath = window.location.pathname;
  iframe.src = `${bootstrapPath}?instance=${encodeURIComponent(instanceId)}`;
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
    opacity: 0;
    transition: opacity 0.2s;
  `;

  // Show iframe once loaded, and patch pushState to track navigation depth
  iframe.onload = () => {
    loading.style.display = 'none';
    iframe.style.opacity = '1';
    iframeNavDepth = 0;
    try {
      const iframeHistory = iframe.contentWindow.history;
      const origPushState = iframeHistory.pushState.bind(iframeHistory);
      iframeHistory.pushState = function(...args) {
        iframeNavDepth++;
        return origPushState(...args);
      };
    } catch(e) {}
  };

  iframe.onerror = () => {
    loading.textContent = 'Failed to load nested instance';
    loading.style.color = 'var(--color-danger)';
  };

  iframeContainer.appendChild(iframe);

  container.appendChild(header);
  container.appendChild(iframeContainer);

  return container;
}
// [END:render]
