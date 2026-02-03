// Item: system:hobson-instance-view
// ID: 99999999-1111-0000-0000-000000000000
// Type: aaaaaaaa-0000-0000-0000-000000000000

// Hobson Instance View - iframe-based isolation
// See [system:hobson-instance-view documentation](item://99999999-1111-0000-0000-000000000000)

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
    border: 2px solid #0066cc;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #f5f5f5;
  `;
  
  // Header showing this is a nested instance
  const header = document.createElement('div');
  header.style.cssText = `
    background: #0066cc;
    color: white;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  `;
  
  const title = document.createElement('span');
  title.textContent = `Nested: ${item.name || instanceId.slice(0, 8)}...`;
  header.appendChild(title);
  
  // Controls
  const controls = document.createElement('div');
  controls.style.cssText = 'display: flex; gap: 8px;';
  
  // Reload button
  const reloadBtn = document.createElement('button');
  reloadBtn.textContent = 'Reload';
  reloadBtn.style.cssText = 'padding: 4px 12px; background: white; color: #0066cc; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;';
  reloadBtn.onclick = () => {
    iframe.src = iframe.src; // Force reload
  };
  controls.appendChild(reloadBtn);
  
  // Open in new tab button
  const newTabBtn = document.createElement('button');
  newTabBtn.textContent = 'Open in Tab';
  newTabBtn.style.cssText = 'padding: 4px 12px; background: white; color: #0066cc; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;';
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
    color: #666;
    font-size: 14px;
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
  
  // Show iframe once loaded
  iframe.onload = () => {
    loading.style.display = 'none';
    iframe.style.opacity = '1';
  };
  
  iframe.onerror = () => {
    loading.textContent = 'Failed to load nested instance';
    loading.style.color = '#cc0000';
  };
  
  iframeContainer.appendChild(iframe);
  
  container.appendChild(header);
  container.appendChild(iframeContainer);
  
  return container;
}
// [END:render]
