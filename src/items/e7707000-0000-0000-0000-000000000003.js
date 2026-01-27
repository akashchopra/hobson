// Item: error_view
// ID: e7707000-0000-0000-0000-000000000003
// Type: aaaaaaaa-0000-0000-0000-000000000000

// Error renderer - displays error details with clickable stack traces

export function render(item, api) {
  const content = item.content || {};
  const frames = content.frames || [];
  const context = content.context || {};
  
  const container = document.createElement('div');
  container.className = 'error-item-view';
  container.style.cssText = 'font-family: system-ui, sans-serif;';
  
  // Header with error info
  const header = document.createElement('div');
  header.style.cssText = `
    background: ${content.resolved ? '#e8f5e9' : '#ffebee'};
    border-left: 4px solid ${content.resolved ? '#4caf50' : '#d32f2f'};
    padding: 16px;
    margin-bottom: 16px;
  `;
  
  header.innerHTML = `
    <div style="display: flex; align-items: start; gap: 12px;">
      <span style="font-size: 32px;">${content.resolved ? '&#10004;' : '&#9888;'}</span>
      <div style="flex: 1;">
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
          ${content.errorType || 'Error'}${content.resolved ? ' (Resolved)' : ''}
        </div>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">
          ${escapeHtml(content.message || 'Unknown error')}
        </div>
        <div style="font-size: 12px; color: #666;">
          ${new Date(content.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  `;
  container.appendChild(header);
  
  // Context section
  if (context.operation || context.itemId || context.itemName) {
    const contextSection = document.createElement('div');
    contextSection.style.cssText = 'margin-bottom: 16px;';
    
    const contextHeading = document.createElement('h4');
    contextHeading.style.cssText = 'margin: 0 0 8px 0;';
    contextHeading.textContent = 'Context';
    contextSection.appendChild(contextHeading);
    
    const contextBox = document.createElement('div');
    contextBox.style.cssText = `
      font-family: monospace;
      font-size: 12px;
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
    `;
    
    let contextHtml = '';
    if (context.operation) {
      contextHtml += `<div>Operation: ${escapeHtml(context.operation)}</div>`;
    }
    if (context.itemName) {
      contextHtml += `<div>Item: ${escapeHtml(context.itemName)}</div>`;
    }
    if (context.itemId) {
      contextHtml += `<div>Item ID: <a href="#" class="context-item-link" data-item-id="${context.itemId}" style="color: #1976d2;">${context.itemId}</a></div>`;
    }
    if (context.rendererId) {
      const rendererLabel = context.rendererName || context.rendererId;
      contextHtml += `<div>Renderer: <a href="#" class="context-item-link" data-item-id="${context.rendererId}" style="color: #1976d2;">${rendererLabel}</a></div>`;
    }
    contextBox.innerHTML = contextHtml;
    
    // Add click handlers for item links
    contextBox.querySelectorAll('.context-item-link').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        api.navigate(link.dataset.itemId);
      };
    });
    
    contextSection.appendChild(contextBox);
    container.appendChild(contextSection);
  }
  
  // Check if the renderer is in the stack trace
  const rendererInStack = context.rendererId && frames.some(f => f.itemId === context.rendererId);
  
  // Show prominent source link if renderer not in stack (async truncation) or no stack at all
  if ((context.rendererId && !rendererInStack) || (frames.length === 0 && context.itemId)) {
    const sourceId = context.rendererId || context.itemId;
    const sourceSection = document.createElement('div');
    sourceSection.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      background: #e3f2fd;
      border: 1px solid #2196f3;
      border-radius: 4px;
    `;
    const message = frames.length === 0 
      ? 'No stack trace available (syntax/parse error).'
      : 'Error originated in renderer (async stack trace truncated). See browser console for full trace.';
    sourceSection.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: 500;">${message}</div>
    `;
    const viewSourceBtn = document.createElement('button');
    viewSourceBtn.textContent = 'View ' + (context.rendererName || 'Source Code');
    viewSourceBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; background: #2196f3; color: white; border: none; border-radius: 4px; font-weight: 500;';
    viewSourceBtn.onclick = () => api.navigate(sourceId);
    sourceSection.appendChild(viewSourceBtn);
    container.appendChild(sourceSection);
  }
  
  // Stack trace section
  if (frames.length > 0) {
    const stackSection = document.createElement('div');
    stackSection.style.cssText = 'margin-bottom: 16px;';
    
    const stackHeading = document.createElement('h4');
    stackHeading.style.cssText = 'margin: 0 0 8px 0;';
    stackHeading.textContent = 'Stack Trace';
    stackSection.appendChild(stackHeading);
    
    const stackBox = document.createElement('div');
    stackBox.style.cssText = `
      font-family: monospace;
      font-size: 12px;
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      overflow: auto;
      max-height: 300px;
    `;
    
    for (const frame of frames) {
      const frameLine = document.createElement('div');
      frameLine.style.cssText = 'padding: 2px 0; white-space: nowrap;';
      
      if (frame.navigable && frame.itemId) {
        frameLine.style.cssText += 'cursor: pointer; color: #1976d2;';
        frameLine.innerHTML = `&#8594; ${escapeHtml(frame.raw)}`;
        frameLine.onclick = () => api.navigate(frame.itemId, {
          field: frame.field,
          line: frame.line,
          col: frame.column
        });
        frameLine.title = `Click to navigate to ${frame.sourceName}:${frame.line}`;
      } else {
        frameLine.style.color = '#666';
        frameLine.textContent = frame.raw;
      }
      
      stackBox.appendChild(frameLine);
    }
    
    stackSection.appendChild(stackBox);
    container.appendChild(stackSection);
  }
  
  // Actions section
  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; gap: 8px; margin-top: 16px;';
  
  // Mark resolved / unresolve button
  const resolveBtn = document.createElement('button');
  resolveBtn.textContent = content.resolved ? 'Mark Unresolved' : 'Mark Resolved';
  resolveBtn.style.cssText = 'padding: 8px 16px; cursor: pointer;';
  resolveBtn.onclick = async () => {
    const updated = {
      ...item,
      content: {
        ...item.content,
        resolved: !content.resolved
      }
    };
    await api.update(updated);
  };
  actions.appendChild(resolveBtn);
  
  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; color: #c62828;';
  deleteBtn.onclick = async () => {
    if (confirm('Delete this error?')) {
      await api.delete(item.id);
      api.viewport.clearSelection();
    }
  };
  actions.appendChild(deleteBtn);
  
  container.appendChild(actions);
  
  return container;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
