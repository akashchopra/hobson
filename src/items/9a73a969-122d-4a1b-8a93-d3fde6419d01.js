// Item: system:script-view
// ID: 9a73a969-122d-4a1b-8a93-d3fde6419d01
// Type: aaaaaaaa-0000-0000-0000-000000000000

// Script View - Renders script items
// See [Views & Rendering](item://a0a0a0a0-d0c0-4000-8000-000000000004)

// [BEGIN:render]
export async function render(item, api) {
  const container = api.createElement('div', { style: 'padding: 15px;' }, []);
  
  // Header
  const header = api.createElement('h3', { style: 'margin-top: 0;' }, [
    item.name || 'Untitled Script'
  ]);
  container.appendChild(header);
  
  // Description
  if (item.content.description) {
    const desc = api.createElement('p', { style: 'color: #666; font-style: italic;' }, [
      item.content.description
    ]);
    container.appendChild(desc);
  }
  
  // Code display
  const code = api.createElement('pre', {
    style: `
      background: #f8f8f8;
      padding: 15px;
      border-radius: 4px;
      border: 1px solid #ddd;
      overflow-x: auto;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
      line-height: 1.5;
    `
  }, [item.content.code || '// No code']);
  container.appendChild(code);
  
  // Buttons
  const buttons = api.createElement('div', { 
    style: 'margin-top: 15px; display: flex; gap: 10px;' 
  }, []);
  
  const runBtn = api.createElement('button', {
    style: 'padding: 10px 20px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; font-weight: 500;',
    onclick: async () => {
      runBtn.disabled = true;
      runBtn.textContent = 'Running...';
      
      try {
        // Get the REPL API which has the helper functions
        const replApi = api.createREPLContext();
        
        // Execute the script code with REPL API
        const asyncFn = new Function('api', `
          return (async () => {
            ${item.content.code}
          })();
        `);
        
        const result = await asyncFn(replApi);
        alert('Script executed!\n\nResult: ' + (
          result !== undefined 
            ? JSON.stringify(result, null, 2) 
            : 'No return value'
        ));
      } catch (error) {
        alert('Error executing script:\n\n' + error.message);
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = 'Run Script';
      }
    }
  }, ['Run Script']);
  buttons.appendChild(runBtn);
  
  const editBtn = api.createElement('button', {
    style: 'padding: 10px 20px; cursor: pointer;',
    onclick: () => {
      // Navigate to raw editor for this item
      api.editRaw(item.id);
    }
  }, ['Edit']);
  buttons.appendChild(editBtn);
  
  const copyBtn = api.createElement('button', {
    style: 'padding: 10px 20px; cursor: pointer;',
    onclick: () => {
      navigator.clipboard.writeText(item.content.code);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy Code', 1000);
    }
  }, ['Copy Code']);
  buttons.appendChild(copyBtn);
  
  container.appendChild(buttons);
  
  return container;
}
// [END:render]
  