// Fixed script to update note renderer with proper tags editing
// Run this in the Hobson REPL

const noteRendererId = '625850e6-d7ae-49ac-a1e0-452137523a3a';
const noteTypeId = '871ae771-b9b1-4f40-8c7f-d9038bfb69c3';

const updatedCode = `
export async function render(item, api) {
  const container = api.createElement('div', {
    class: 'note-view',
    style: 'max-width: 800px; margin: 0 auto;'
  }, []);

  // Header section
  const header = api.createElement('div', {
    style: 'margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0;'
  }, []);

  // Title (editable)
  const titleInput = api.createElement('input', {
    type: 'text',
    value: item.content.title || '',
    placeholder: 'Untitled Note',
    style: 'width: 100%; font-size: 24px; font-weight: bold; border: none; outline: none; padding: 8px 0; background: transparent;',
    onchange: async (e) => {
      const updated = {
        ...item,
        content: {
          ...item.content,
          title: e.target.value
        }
      };
      await api.update(updated);
      item = await api.get(item.id); // Refresh item reference
    }
  }, []);
  header.appendChild(titleInput);

  // Tags section - this will be updated by renderTags()
  const tagsContainer = api.createElement('div', {
    style: 'margin-top: 12px;'
  }, []);
  header.appendChild(tagsContainer);

  // Metadata
  const meta = api.createElement('div', {
    style: 'margin-top: 8px; font-size: 12px; color: #999;'
  }, [
    'Modified: ' + new Date(item.modified).toLocaleString()
  ]);
  header.appendChild(meta);

  container.appendChild(header);

  // Body section with view/edit toggle
  let isEditing = false;
  let currentTextarea = null;
  const bodyContainer = api.createElement('div', {}, []);

  // Function to render tags (called in both modes)
  const renderTags = async (editMode) => {
    tagsContainer.innerHTML = '';

    if (editMode) {
      // Edit mode: text input for tag IDs
      const tagsLabel = api.createElement('label', {
        style: 'font-size: 13px; color: #666; font-weight: 500; display: block; margin-bottom: 4px;'
      }, ['Tags (comma-separated IDs):']);
      tagsContainer.appendChild(tagsLabel);

      const tagsInput = api.createElement('input', {
        type: 'text',
        value: (item.tags || []).join(', '),
        placeholder: 'e.g., tag-id-1, tag-id-2',
        style: 'width: 100%; font-size: 13px; padding: 6px 8px; border: 1px solid #d0d0d0; border-radius: 4px; outline: none; font-family: monospace;',
        onchange: async (e) => {
          // Parse comma-separated tag IDs
          const tagIds = e.target.value
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);

          const updated = {
            ...item,
            tags: tagIds
          };
          await api.update(updated);
          item = await api.get(item.id); // Refresh item reference
          console.log('Tags updated:', item.tags);
        }
      }, []);
      tagsContainer.appendChild(tagsInput);

    } else {
      // View mode: display tag names as pills
      if (item.tags && item.tags.length > 0) {
        const tagsLabel = api.createElement('div', {
          style: 'font-size: 13px; color: #666; font-weight: 500; margin-bottom: 6px;'
        }, ['Tags:']);
        tagsContainer.appendChild(tagsLabel);

        const tagPills = api.createElement('div', {
          style: 'display: flex; flex-wrap: wrap; gap: 6px;'
        }, []);

        // Fetch tag items to get names and colors
        for (const tagId of item.tags) {
          try {
            const tag = await api.get(tagId);
            const tagName = tag.content.name || tag.name || tagId;
            const tagColor = tag.content.color || '#3b82f6';

            const pill = api.createElement('span', {
              style: \`
                display: inline-block;
                padding: 4px 12px;
                background: \${tagColor}20;
                border: 1px solid \${tagColor};
                border-radius: 12px;
                font-size: 12px;
                font-weight: 500;
                color: \${tagColor};
              \`
            }, [tagName]);

            tagPills.appendChild(pill);
          } catch (err) {
            // Tag not found - show ID with warning color
            const pill = api.createElement('span', {
              style: \`
                display: inline-block;
                padding: 4px 12px;
                background: #fee;
                border: 1px solid #f88;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 500;
                color: #c44;
                font-family: monospace;
              \`,
              title: 'Tag not found: ' + tagId
            }, [tagId.substring(0, 8) + '...']);

            tagPills.appendChild(pill);
          }
        }

        tagsContainer.appendChild(tagPills);
      }
    }
  };

  const renderBody = async () => {
    bodyContainer.innerHTML = '';

    if (isEditing) {
      // Edit mode: textarea
      const textarea = api.createElement('textarea', {
        style: 'width: 100%; min-height: 400px; font-family: monospace; font-size: 14px; line-height: 1.6; padding: 15px; border: 1px solid #d0d0d0; border-radius: 6px; resize: vertical;',
        spellcheck: false
      }, []);
      textarea.value = item.content.body || '';
      currentTextarea = textarea;

      // Tab key handling
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }
      });

      bodyContainer.appendChild(textarea);

      // Buttons
      const buttons = api.createElement('div', {
        style: 'margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;'
      }, []);

      const saveBtn = api.createElement('button', {
        style: 'padding: 10px 20px; cursor: pointer; font-weight: 500;',
        onclick: async () => {
          const updated = {
            ...item,
            content: {
              ...item.content,
              body: textarea.value
            }
          };
          await api.update(updated);
          item = await api.get(item.id); // Refresh item reference
          isEditing = false;
          await renderTags(false);
          await renderBody();
        }
      }, ['Save']);
      buttons.appendChild(saveBtn);

      const cancelBtn = api.createElement('button', {
        style: 'padding: 10px 20px; cursor: pointer;',
        onclick: async () => {
          isEditing = false;
          item = await api.get(item.id); // Refresh to discard any unsaved changes
          await renderTags(false);
          await renderBody();
        }
      }, ['Cancel']);
      buttons.appendChild(cancelBtn);

      // INSERT LINK button
      const insertLinkBtn = api.createElement('button', {
        style: 'padding: 10px 20px; cursor: pointer; background: #28a745; color: white; border: none; border-radius: 4px;',
        onclick: () => showLinkPicker()
      }, ['Insert Link']);
      buttons.appendChild(insertLinkBtn);

      bodyContainer.appendChild(buttons);

      // Link picker UI (hidden by default)
      const pickerContainer = api.createElement('div', {
        style: 'display: none; margin-top: 15px; padding: 15px; border: 1px solid #ddd; border-radius: 6px; background: #f9f9f9;'
      }, []);

      const pickerTitle = api.createElement('h4', {
        style: 'margin: 0 0 10px 0;'
      }, ['Recent Items']);
      pickerContainer.appendChild(pickerTitle);

      const pickerList = api.createElement('div', {
        style: 'max-height: 300px; overflow-y: auto;'
      }, []);
      pickerContainer.appendChild(pickerList);

      const pickerClose = api.createElement('button', {
        style: 'margin-top: 10px; padding: 8px 16px; cursor: pointer;',
        onclick: () => {
          pickerContainer.style.display = 'none';
        }
      }, ['Close']);
      pickerContainer.appendChild(pickerClose);

      bodyContainer.appendChild(pickerContainer);

      // Show link picker
      const showLinkPicker = () => {
        pickerList.innerHTML = '';

        // Get recent items from kernel
        const recent = window.kernel.getRecentItems();

        if (recent.length === 0) {
          pickerList.appendChild(api.createElement('div', {
            style: 'padding: 20px; text-align: center; color: #999;'
          }, ['No recent items. Navigate to some items first!']));
        } else {
          // Show most recent first
          const reversed = recent.slice().reverse();

          reversed.forEach(recentItem => {
            const itemBtn = api.createElement('div', {
              style: 'padding: 10px; margin-bottom: 5px; background: white; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; transition: background 0.2s;',
              onclick: () => insertLink(recentItem.id, recentItem.name),
              onmouseover: (e) => { e.target.style.background = '#f0f0f0'; },
              onmouseout: (e) => { e.target.style.background = 'white'; }
            }, [recentItem.name]);
            pickerList.appendChild(itemBtn);
          });
        }

        pickerContainer.style.display = 'block';
      };

      // Insert link at cursor position
      const insertLink = (targetId, targetName) => {
        const textarea = currentTextarea;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        // Create markdown link
        const linkText = '[' + targetName + '](item://' + targetId + ')';

        // Insert at cursor
        textarea.value = textarea.value.substring(0, start) + linkText + textarea.value.substring(end);

        // Move cursor to after inserted link
        textarea.selectionStart = textarea.selectionEnd = start + linkText.length;

        // Hide picker
        pickerContainer.style.display = 'none';

        // Focus back on textarea
        textarea.focus();
      };

      // Render tags in edit mode
      await renderTags(true);

    } else {
      // View mode: rendered markdown
      const body = item.content.body || '*No content yet. Click Edit to add some.*';

      // Parse markdown
      const marked = await api.require('marked');
      const html = marked.default.parse(body);

      // Create content div
      const content = api.createElement('div', {
        class: 'markdown-content',
        style: 'line-height: 1.8; font-size: 16px;'
      }, []);
      content.innerHTML = html;

      // Post-process: handle item:// links
      const links = content.querySelectorAll('a[href^="item://"]');
      links.forEach(link => {
        const href = link.getAttribute('href');
        const itemId = href.replace('item://', '');

        // Override click behavior
        link.onclick = (e) => {
          e.preventDefault();
          api.openSibling(itemId);
        };

        // Style internal links
        link.style.color = '#007bff';
        link.style.textDecoration = 'none';
        link.style.borderBottom = '1px solid #007bff';
        link.style.cursor = 'pointer';
      });

      bodyContainer.appendChild(content);

      // Edit button
      const editBtn = api.createElement('button', {
        style: 'margin-top: 20px; padding: 10px 20px; cursor: pointer;',
        onclick: () => {
          isEditing = true;
          renderBody();
        }
      }, ['Edit']);
      bodyContainer.appendChild(editBtn);

      // Render tags in view mode
      await renderTags(false);
    }
  };

  await renderBody();
  container.appendChild(bodyContainer);

  return container;
}
`;

// Update the renderer
const renderer = await api.get(noteRendererId);
const updated = {
  ...renderer,
  content: {
    ...renderer.content,
    code: updatedCode
  }
};
await api.set(updated);

console.log('✓ Note renderer fixed (v2)!');
console.log('  - Tags input now properly handles comma-separated IDs');
console.log('  - Item reference is refreshed after updates');
console.log('  - Console logs show tags array when updated');
console.log('');
console.log('Reload the page to see changes.');
