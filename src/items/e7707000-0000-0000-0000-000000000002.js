// Item: default-error-handler
// ID: e7707000-0000-0000-0000-000000000002
// Type: 66666666-0000-0000-0000-000000000000

// Default error handler - creates error items and shows toast notifications

const ERROR_TYPE_ID = 'e7707000-0000-0000-0000-000000000001';

export async function onSystemError({ error, context, timestamp }, api) {
  try {
    // Parse stack trace into structured data (async - looks up item names)
    const frames = await parseStackTrace(error.stack, api);
    
    // Create error item
    const errorId = await api.create({
      type: ERROR_TYPE_ID,
      name: `Error: ${(error.message || '').substring(0, 40)}`,
      content: {
        message: error.message,
        errorType: error.name || 'Error',
        frames: frames,
        context: context,
        timestamp: timestamp,
        resolved: false
      }
    });
    
    // Show toast notification
    showErrorToast(error.message, errorId, context, api);
  } catch (handlerError) {
    // If our handler fails, just log to console
    console.error('Error handler failed:', handlerError);
    console.error('Original error:', error);
  }
}

async function parseStackTrace(stack, api) {
  if (!stack) return [];
  
  const lines = stack.split('\n').slice(1); // Skip "Error: message" line
  const frames = [];
  
  // Cache item lookups to avoid repeated queries
  const itemCache = new Map();
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Parse stack frame formats:
    // Firefox classic: "functionName@sourceURL:line:column"
    // Firefox simple:  "functionName sourceURL:line"
    // Chrome:          "    at functionName (sourceURL:line:column)"
    // Anonymous:       "@sourceURL:line:column"
    
    let sourceName = null;
    let lineNum = null;
    let colNum = null;
    
    // Try Firefox classic format: funcName@source:line:col
    const firefoxClassicMatch = trimmed.match(/@([^:]+):(\d+):(\d+)$/);
    if (firefoxClassicMatch) {
      sourceName = firefoxClassicMatch[1];
      lineNum = firefoxClassicMatch[2];
      colNum = firefoxClassicMatch[3];
    }
    
    // Try Firefox simple format: funcName source:line (space-separated, no column)
    if (!sourceName) {
      const firefoxSimpleMatch = trimmed.match(/^(\S+)\s+([^:]+):(\d+)$/);
      if (firefoxSimpleMatch) {
        sourceName = firefoxSimpleMatch[2];
        lineNum = firefoxSimpleMatch[3];
        colNum = '0';
      }
    }
    
    // Try Firefox simple format with column: funcName source:line:col
    if (!sourceName) {
      const firefoxSimpleColMatch = trimmed.match(/^(\S+)\s+([^:]+):(\d+):(\d+)$/);
      if (firefoxSimpleColMatch) {
        sourceName = firefoxSimpleColMatch[2];
        lineNum = firefoxSimpleColMatch[3];
        colNum = firefoxSimpleColMatch[4];
      }
    }
    
    // Try Chrome format: at funcName (source:line:col)
    if (!sourceName) {
      const chromeMatch = trimmed.match(/\(([^:]+):(\d+):(\d+)\)$/);
      if (chromeMatch) {
        sourceName = chromeMatch[1];
        lineNum = chromeMatch[2];
        colNum = chromeMatch[3];
      }
    }
    
    // Try to find item by source name
    let itemId = null;
    if (sourceName) {
      // Remove .js extension if present
      const itemName = sourceName.replace(/\.js$/, '');
      
      // Skip built-in browser sources
      if (!itemName.includes('://') &&
          !itemName.startsWith('blob:')) {
        
        if (itemCache.has(itemName)) {
          itemId = itemCache.get(itemName);
        } else {
          try {
            const item = await api.helpers.findByName(itemName);
            if (item) {
              itemId = item.id;
              itemCache.set(itemName, itemId);
            } else {
              itemCache.set(itemName, null);
            }
          } catch (e) {
            itemCache.set(itemName, null);
          }
        }
      }
    }
    
    frames.push({
      raw: trimmed,
      sourceName: sourceName,
      field: 'code',
      line: lineNum,
      column: colNum,
      itemId: itemId,
      navigable: !!itemId
    });
  }
  
  return frames;
}

function showErrorToast(message, errorId, context, api) {
  // Remove any existing toast
  const existing = document.querySelector('.error-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #d32f2f;
    color: white;
    padding: 16px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    max-width: 400px;
    z-index: 9999;
    cursor: pointer;
    font-family: system-ui, sans-serif;
  `;
  
  const truncatedMessage = (message || 'Unknown error').length > 100 
    ? message.substring(0, 100) + '...' 
    : message;
  
  toast.innerHTML = `
    <div style="display: flex; gap: 12px; align-items: start;">
      <span style="font-size: 24px;">&#9888;</span>
      <div style="flex: 1;">
        <strong>Error Occurred</strong>
        <p style="margin: 4px 0 0 0; font-size: 14px;">${truncatedMessage}</p>
        <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">Click to view details</p>
      </div>
    </div>
  `;
  
  toast.onclick = () => {
    const currentRoot = api.viewport.getRoot();
    if (context.itemId === currentRoot) {
      // Error was in root item - navigate to error
      api.navigate(errorId);
    } else {
      // Error was in child - open error as sibling
      api.siblingContainer?.addSibling(errorId);
    }
    toast.remove();
  };
  
  document.body.appendChild(toast);
  
  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 8000);
}
