# Code Items Catalog

Reference of all code items created within the Hobson system. This catalog provides a backup and reference for all custom renderers, libraries, and other code items.

**Last Updated:** 2025-01-11

---

## How to Use This Catalog

Each code item entry includes:
- **Type:** The item's type (renderer, library, etc.)
- **For Type:** (Renderers only) Which item type this renders
- **Purpose:** What this code item does
- **Dependencies:** Other code items or libraries it requires
- **Status:** Current state (Working, Experimental, Deprecated, etc.)

To restore a code item, copy the code and use the REPL:

```javascript
await api.set({
  id: crypto.randomUUID(), // or use a specific ID
  name: "item_name",
  type: api.IDS.RENDERER, // or api.IDS.LIBRARY
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    for_type: "type_id", // for renderers only
    code: `/* paste code here */`
  }
});
```

---

## Renderers

### code_editor_renderer

**Type:** renderer  
**For Type:** code (`00000000-0000-0000-0000-000000000002`)  
**Created:** 2025-01-11  
**Status:** Working  
**Purpose:** Provides a comfortable editing experience for all code items (renderers, libraries, etc.) with improved textarea, tab support, save functionality, and automatic refresh on test.

**Features:**
- Large, monospace textarea with proper styling
- Tab key for indentation
- Save button with visual feedback
- Save & Test button that automatically refreshes the view
- Unsaved changes indicator
- Keyboard shortcuts hint

**Dependencies:** None

**Code:**

```javascript
export async function render(item, api) {
  const container = api.h('div', { class: 'code-editor-view' }, []);
  
  // Header with item name and type
  const header = api.h('div', { 
    style: 'margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0;' 
  }, []);
  
  const title = api.h('h3', { style: 'margin: 0; display: inline-block;' }, [
    item.name || item.id
  ]);
  header.appendChild(title);
  
  const typeInfo = api.h('span', { 
    style: 'margin-left: 15px; color: #666; font-size: 13px;' 
  }, [`Type: ${item.type}`]);
  header.appendChild(typeInfo);
  
  container.appendChild(header);
  
  // Code textarea with better styling
  const textarea = api.h('textarea', {
    style: `
      width: 100%;
      min-height: 500px;
      font-family: 'SF Mono', Monaco, Menlo, 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      padding: 15px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #fafafa;
      resize: vertical;
      tab-size: 2;
      -moz-tab-size: 2;
    `,
    spellcheck: false,
    autocomplete: 'off',
    autocorrect: 'off',
    autocapitalize: 'off'
  }, []);
  
  textarea.value = item.content?.code || '';
  
  // Tab key handling for indentation
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
    }
  });
  
  // Auto-save indicator
  const saveIndicator = api.h('span', { 
    style: 'margin-left: 10px; color: #999; font-size: 12px;' 
  }, ['']);
  
  textarea.addEventListener('input', () => {
    saveIndicator.textContent = 'Unsaved changes...';
    saveIndicator.style.color = '#cc6600';
  });
  
  container.appendChild(textarea);
  
  // Button bar
  const buttonBar = api.h('div', { 
    style: 'margin-top: 15px; display: flex; gap: 10px; align-items: center;' 
  }, []);
  
  const saveBtn = api.h('button', {
    style: 'padding: 10px 20px; cursor: pointer; font-size: 14px; font-weight: 500;',
    onclick: async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      
      try {
        const updated = {
          ...item,
          content: {
            ...item.content,
            code: textarea.value
          }
        };
        await api.update(updated);
        
        saveIndicator.textContent = 'Saved!';
        saveIndicator.style.color = '#00aa00';
        saveBtn.textContent = 'Save';
        
        setTimeout(() => {
          saveIndicator.textContent = '';
        }, 2000);
      } catch (error) {
        alert(`Error saving: ${error.message}`);
        saveBtn.textContent = 'Save';
      } finally {
        saveBtn.disabled = false;
      }
    }
  }, ['Save']);
  buttonBar.appendChild(saveBtn);
  
  const saveAndTestBtn = api.h('button', {
    style: 'padding: 10px 20px; cursor: pointer; font-size: 14px;',
    onclick: async () => {
      saveAndTestBtn.disabled = true;
      saveAndTestBtn.textContent = 'Saving...';
      
      try {
        const updated = {
          ...item,
          content: {
            ...item.content,
            code: textarea.value
          }
        };
        await api.update(updated);
        
        // For renderers, refresh by navigating away and back
        const currentRoot = api.getCurrentRoot();
        if (currentRoot === item.id) {
          // Viewing this code item directly - refresh it
          await api.navigate(api.IDS.WORKSPACE);
          setTimeout(() => api.navigate(item.id), 50);
        } else {
          // Viewing something else that uses this code - refresh that
          await api.navigate(api.IDS.WORKSPACE);
          setTimeout(() => api.navigate(currentRoot), 50);
        }
      } catch (error) {
        alert(`Error: ${error.message}`);
        saveAndTestBtn.textContent = 'Save & Test';
        saveAndTestBtn.disabled = false;
      }
    }
  }, ['Save & Test']);
  buttonBar.appendChild(saveAndTestBtn);
  
  buttonBar.appendChild(saveIndicator);
  
  // Keyboard shortcuts hint
  const hint = api.h('span', { 
    style: 'margin-left: auto; color: #999; font-size: 12px;' 
  }, ['Tip: Use Tab for indentation']);
  buttonBar.appendChild(hint);
  
  container.appendChild(buttonBar);
  
  return container;
}
```

---

## Libraries

*(No libraries created yet)*

---

## Other Code Items

*(No other code items created yet)*

---

## Notes

- Code items are stored in IndexedDB within the Hobson system
- This file serves as a backup and reference, not the source of truth
- When restoring, generate new IDs unless you specifically need to preserve references
- The REPL is the easiest way to create/restore code items programmatically
