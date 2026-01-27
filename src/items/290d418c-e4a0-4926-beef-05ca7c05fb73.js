// Item: code_view
// ID: 290d418c-e4a0-4926-beef-05ca7c05fb73
// Type: aaaaaaaa-0000-0000-0000-000000000000

                                                                               
  export async function render(item, api) {                                                                   
    // Load CSS                                                                                               
    const cssLoader = await api.require('css-loader-lib');                                                    
    await cssLoader.loadCSS('codemirror-css', api);                                                           
                                                                                                              
    const container = api.createElement('div', { style: 'height: 100%; display: flex; flex-direction: column;'
   }, []);                                                                                                    
                                                                                                              
    // Header with item name and type                                                                         
    const header = api.createElement('div', {                                                                 
      style: 'margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0; flex-shrink: 0;'   
    }, []);                                                                                                   
                                                                                                              
    const title = api.createElement('h3', { style: 'margin: 0; display: inline-block;' }, [                   
      item.name || item.id                                                                                    
    ]);                                                                                                       
    header.appendChild(title);                                                                                
                                                                                                              
    const typ = await api.get(item.type);                                                                     
    const typeInfo = api.createElement('span', {                                                              
      style: 'margin-left: 15px; color: #666; font-size: 13px;'                                               
    }, ['Type: ' + typ.name]);                                                                                
    header.appendChild(typeInfo);                                                                             
                                                                                                              
    container.appendChild(header);                                                                            
                                                                                                              
    // CodeMirror editor container                                                                            
    const editorContainer = api.createElement('div', {                                                        
      style: 'flex: 1; border: 1px solid #d0d0d0; border-radius: 6px; overflow: hidden; min-height: 0;'       
    }, []);                                                                                                   
    container.appendChild(editorContainer);                                                                   
                                                                                                              
    // Auto-save indicator                                                                                    
    const saveIndicator = api.createElement('span', {                                                         
      style: 'margin-left: 10px; color: #999; font-size: 12px;'                                               
    }, ['']);                                                                                                                                           
                                                                                              
    // Button bar                                                                                             
    const buttonBar = api.createElement('div', {                                                              
      style: 'margin-top: 15px; display: flex; gap: 10px; align-items: center; flex-shrink: 0;'               
    }, []);                                                                                                   
                                                                                                              
    const saveBtn = api.createElement('button', {                                                             
      style: 'padding: 10px 20px; cursor: pointer; font-size: 14px; font-weight: 500;',                       
      onclick: async () => {                                                                                  
        saveBtn.disabled = true;                                                                              
        saveBtn.textContent = 'Saving...';                                                                    
                                                                                                              
        try {                                                                                                 
          const updated = {                                                                                   
            ...item,                                                                                          
            content: {                                                                                        
              ...item.content,                                                                                
              code: editor.getValue()                                                                         
            }                                                                                                 
          };
          await api.set(updated);
          // No need to rerender, as the editor visual state is already up to date with latest edits.
          //await api.rerenderItem(updated.id);

          saveIndicator.textContent = 'Saved!';                                                               
          saveIndicator.style.color = '#00aa00';                                                              
          saveBtn.textContent = 'Save';                                                                       
                                                                                                              
          setTimeout(() => {                                                                                  
            saveIndicator.textContent = '';                                                                   
          }, 2000);                                                                                           
        } catch (error) {                                                                                     
          alert('Error saving: ' + error.message);                                                            
          saveBtn.textContent = 'Save';                                                                       
        } finally {                                                                                           
          saveBtn.disabled = false;                                                                           
        }                                                                                                     
      }                                                                                                       
    }, ['Save']);                                                                                             
    buttonBar.appendChild(saveBtn);                                                                                                                                                                            
                                                                                                              
    buttonBar.appendChild(saveIndicator);                                                                     
         
        // Load CodeMirror                                                                                        
    await api.require('codemirror');                                                                          
    await api.require('codemirror-javascript');
    
    const CM = window.CodeMirror;                                                                             
    //delete window.CodeMirror;                                                                                 
                                                                                                              
    const editor = CM(editorContainer, {
      value: item.content?.code || '',
      mode: 'javascript',
      lineNumbers: true,
      lineWrapping: true,
      theme: 'default',
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      viewportMargin: 2000,
      extraKeys: {
        'Tab': (cm) => {
          if (cm.somethingSelected()) {
            cm.indentSelection('add');
          } else {
            cm.replaceSelection('  ');
          }
        }
      }
    });                                                                                                       
                                                                                                              
    // Make editor fill container
    editor.setSize('100%', '100%');

    // Refresh after layout completes to fix gutter width calculation
    requestAnimationFrame(() => {
      editor.refresh();
      
      // Check URL params for line navigation (field=code&line=X&col=Y)
      const urlParams = new URLSearchParams(window.location.search);
      const field = urlParams.get('field');
      const line = parseInt(urlParams.get('line'), 10);
      const col = parseInt(urlParams.get('col'), 10) || 0;
      
      if (field === 'code' && !isNaN(line) && line > 0) {
        // CodeMirror uses 0-based line numbers
        const cmLine = line - 1;
        
        // Scroll line into view and highlight
        editor.scrollIntoView({ line: cmLine, ch: col }, 100);
        editor.setCursor({ line: cmLine, ch: col });
        
        // Add highlight class to the line
        editor.addLineClass(cmLine, 'background', 'line-highlight');
        
        // Add CSS for highlight if not present
        if (!document.getElementById('line-highlight-css')) {
          const style = document.createElement('style');
          style.id = 'line-highlight-css';
          style.textContent = '.line-highlight { background: #fff3cd !important; }';
          document.head.appendChild(style);
        }
        
        // Clear highlight params from URL (optional - keeps URL clean after navigation)
        // Commenting out to keep URL shareable
        // const newUrl = new URL(window.location);
        // newUrl.searchParams.delete('field');
        // newUrl.searchParams.delete('line');
        // newUrl.searchParams.delete('col');
        // window.history.replaceState({}, '', newUrl);
      }
    });

    editor.on('change', () => {
      saveIndicator.textContent = 'Unsaved changes...';
      saveIndicator.style.color = '#cc6600';
    });
    
    // Keyboard shortcuts hint                                                                                
    const hint = api.createElement('span', {                                                                  
      style: 'margin-left: auto; color: #999; font-size: 12px;'                                               
    }, ['Tip: Tab for indent']);                                                                              
    buttonBar.appendChild(hint);                                                                              
                                                                                                              
    container.appendChild(buttonBar);                                                                         
                                                                                                              
    return container;                                                                                         
  }                                                                                                           
  