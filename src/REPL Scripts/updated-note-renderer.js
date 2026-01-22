/**
 * Updated note-renderer code using markdown-it and CodeMirror
 *
 * To install: Copy the code below and update the note-renderer item via REPL
 */

const updatedCode = `
export async function render(item, api) {
  // Load CSS
  const cssLoader = await api.require('css-loader-lib');
  await cssLoader.loadCSS('codemirror-css', api);

  // Load shared libraries
  const treeBuilder = await api.require('tag-tree-builder');
  const tagPickerUI = await api.require('tag-picker-ui');

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
    value: item.name || '',
    placeholder: 'Untitled Note',
    style: 'width: 100%; font-size: 24px; font-weight: bold; border: none; outline: none; padding: 8px 0; background: transparent;',
    onchange: async (e) => {
      const updated = {
        ...item,
        name: e.target.value
      };
      await api.update(updated);
      item = await api.get(item.id);
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
  let codeMirrorInstance = null;
  const bodyContainer = api.createElement('div', {}, []);

  // Pending tags (buffered changes, not yet saved)
  let pendingTags = null;

  // Track picker open state across re-renders
  let isPickerOpen = false;

  // Helper function to build tag path
  const getTagPath = async (tag) => {
    const path = [];
    let currentTag = tag;

    while (currentTag) {
      const tagName = currentTag.content.name || currentTag.name || currentTag.id;
      path.unshift(tagName);

      if (currentTag.content.parent) {
        try {
          currentTag = await api.get(currentTag.content.parent);
        } catch (err) {
          break;
        }
      } else {
        break;
      }
    }

    return path.join(' / ');
  };

  // Save pending tags to database
  const saveTags = async () => {
    if (pendingTags === null) return;

    const updated = {
      ...item,
      tags: pendingTags
    };
    await api.update(updated);
    item = await api.get(item.id);
    pendingTags = null;
  };

  // Track expanded state (shared across re-renders)
  const expandedState = new Map();

  // Function to render tags (called in both modes)
  const renderTags = async (editMode) => {
    tagsContainer.innerHTML = '';

    if (editMode) {
      // Initialize pending tags on first render in edit mode
      if (pendingTags === null) {
        pendingTags = [...(item.tags || [])];
      }

      // Edit mode: pills with remove buttons + add button + picker
      const tagsLabel = api.createElement('div', {
        style: 'font-size: 13px; color: #666; font-weight: 500; margin-bottom: 6px;'
      }, ['Tags:']);
      tagsContainer.appendChild(tagsLabel);

      const tagPillsAndButtons = api.createElement('div', {
        style: 'display: flex; flex-wrap: wrap; gap: 6px; align-items: center;'
      }, []);

      // Render current tags as removable pills (using pendingTags)
      if (pendingTags.length > 0) {
        for (const tagId of pendingTags) {
          try {
            const tag = await api.get(tagId);
            const tagPath = await getTagPath(tag);
            const tagColor = tag.content.color || '#3b82f6';

            const pill = api.createElement('span', {
              style: 'display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px 4px 12px; background: ' + tagColor + '20; border: 1px solid ' + tagColor + '; border-radius: 12px; font-size: 12px; font-weight: 500; color: ' + tagColor + ';'
            }, []);

            const pillText = api.createElement('span', {}, [tagPath]);
            pill.appendChild(pillText);

            // Remove button
            const removeBtn = api.createElement('button', {
              style: 'background: none; border: none; color: ' + tagColor + '; cursor: pointer; padding: 0; margin: 0; font-size: 14px; line-height: 1; font-weight: bold;',
              onclick: async () => {
                pendingTags = pendingTags.filter(id => id !== tagId);
                await renderTags(true);
              }
            }, ['×']);
            pill.appendChild(removeBtn);

            tagPillsAndButtons.appendChild(pill);
          } catch (err) {
            const pill = api.createElement('span', {
              style: 'display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px 4px 12px; background: #fee; border: 1px solid #f88; border-radius: 12px; font-size: 12px; font-weight: 500; color: #c44; font-family: monospace;',
              title: 'Tag not found: ' + tagId
            }, [tagId.substring(0, 8) + '...']);

            tagPillsAndButtons.appendChild(pill);
          }
        }
      }

      // Add Tag button
      const addTagBtn = api.createElement('button', {
        style: 'padding: 4px 12px; background: #3b82f6; color: white; border: none; border-radius: 12px; font-size: 12px; font-weight: 500; cursor: pointer;',
        onclick: () => {
          toggleTagPicker();
        }
      }, ['+ Add Tag']);
      tagPillsAndButtons.appendChild(addTagBtn);

      tagsContainer.appendChild(tagPillsAndButtons);

      // Tag picker panel
      const pickerPanel = api.createElement('div', {
        style: (isPickerOpen ? 'display: block;' : 'display: none;') + ' margin-top: 12px; padding: 15px; background: #f9f9f9; border: 1px solid #d0d0d0; border-radius: 6px; max-height: 400px; overflow-y: auto;'
      }, []);

      const pickerHeader = api.createElement('div', {
        style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;'
      }, []);

      const pickerTitle = api.createElement('div', {
        style: 'font-weight: 500; color: #333;'
      }, ['Select tags']);
      pickerHeader.appendChild(pickerTitle);

      const closePickerBtn = api.createElement('button', {
        style: 'background: none; border: none; font-size: 18px; cursor: pointer; color: #666;',
        onclick: async () => {
          await saveTags();
          isPickerOpen = false;
          await renderTags(true);
        }
      }, ['×']);
      pickerHeader.appendChild(closePickerBtn);

      pickerPanel.appendChild(pickerHeader);

      const pickerTreeContainer = api.createElement('div', {}, []);
      pickerPanel.appendChild(pickerTreeContainer);

      tagsContainer.appendChild(pickerPanel);

      // Toggle picker visibility and load tags
      const toggleTagPicker = async () => {
        if (!isPickerOpen) {
          isPickerOpen = true;
          await renderTags(true);
        } else {
          await saveTags();
          isPickerOpen = false;
          await renderTags(true);
        }
      };

      // If picker is open, render the tree
      if (isPickerOpen) {
        await renderTagPicker();
      }

      // Render tag picker tree
      async function renderTagPicker() {
        pickerTreeContainer.innerHTML = '';
        const allTags = await api.query({ type: "d1da8525-b0dc-4a79-8bef-0cbed1ed003d" });
        const tree = treeBuilder.buildTagTree(allTags);

        tagPickerUI.renderTagPicker({
          container: pickerTreeContainer,
          tree: tree,
          selectedTags: pendingTags,
          expandedState: expandedState,
          onToggle: async (tagId) => {
            pendingTags.push(tagId);
            await renderTagPicker();
          },
          onExpand: async () => {
            await renderTagPicker();
          }
        }, api);
      }

    } else {
      // View mode: display tag names as pills with full paths
      if (item.tags && item.tags.length > 0) {
        const tagsLabel = api.createElement('div', {
          style: 'font-size: 13px; color: #666; font-weight: 500; margin-bottom: 6px;'
        }, ['Tags:']);
        tagsContainer.appendChild(tagsLabel);

        const tagPills = api.createElement('div', {
          style: 'display: flex; flex-wrap: wrap; gap: 6px;'
        }, []);

        for (const tagId of item.tags) {
          try {
            const tag = await api.get(tagId);
            const tagPath = await getTagPath(tag);
            const tagColor = tag.content.color || '#3b82f6';

            const pill = api.createElement('span', {
              style: 'display: inline-block; padding: 4px 12px; background: ' + tagColor + '20; border: 1px solid ' + tagColor + '; border-radius: 12px; font-size: 12px; font-weight: 500; color: ' + tagColor + ';'
            }, [tagPath]);

            tagPills.appendChild(pill);
          } catch (err) {
            const pill = api.createElement('span', {
              style: 'display: inline-block; padding: 4px 12px; background: #fee; border: 1px solid #f88; border-radius: 12px; font-size: 12px; font-weight: 500; color: #c44; font-family: monospace;',
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
      // Edit mode: CodeMirror editor
      const CodeMirror = await api.require('codemirror-wrapper');
      await api.require('codemirror-markdown');

      const editorContainer = api.createElement('div', {
        style: 'border: 1px solid #d0d0d0; border-radius: 6px; overflow: hidden;'
      }, []);
      bodyContainer.appendChild(editorContainer);

      codeMirrorInstance = CodeMirror(editorContainer, {
        value: item.content.description || '',
        mode: 'markdown',
        lineNumbers: true,
        lineWrapping: true,
        theme: 'default',
        extraKeys: {
          'Tab': (cm) => {
            cm.replaceSelection('  ');
          }
        }
      });

      // Buttons
      const buttons = api.createElement('div', {
        style: 'margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;'
      }, []);

      const saveBtn = api.createElement('button', {
        style: 'padding: 10px 20px; cursor: pointer; font-weight: 500;',
        onclick: async () => {
          await saveTags();
          const updated = {
            ...item,
            content: {
              ...item.content,
              description: codeMirrorInstance.getValue()
            }
          };
          await api.update(updated);
          item = await api.get(item.id);
          isEditing = false;
          isPickerOpen = false;
          pendingTags = null;
          codeMirrorInstance = null;
          await renderTags(false);
          await renderBody();
        }
      }, ['Save']);
      buttons.appendChild(saveBtn);

      const cancelBtn = api.createElement('button', {
        style: 'padding: 10px 20px; cursor: pointer;',
        onclick: async () => {
          isEditing = false;
          isPickerOpen = false;
          pendingTags = null;
          codeMirrorInstance = null;
          item = await api.get(item.id);
          await renderTags(false);
          await renderBody();
        }
      }, ['Cancel']);
      buttons.appendChild(cancelBtn);

      const insertLinkBtn = api.createElement('button', {
        style: 'padding: 10px 20px; cursor: pointer; background: #28a745; color: white; border: none; border-radius: 4px;',
        onclick: () => showLinkPicker()
      }, ['Insert Link']);
      buttons.appendChild(insertLinkBtn);

      bodyContainer.appendChild(buttons);

      // Link picker UI
      const pickerContainer = api.createElement('div', {
        style: 'display: none; margin-top: 15px; padding: 15px; border: 1px solid #ddd; border-radius: 6px; background: #f9f9f9;'
      }, []);
      bodyContainer.appendChild(pickerContainer);

      const showLinkPicker = async () => {
        pickerContainer.innerHTML = '';
        pickerContainer.style.display = 'block';

        const pickerHeader = api.createElement('div', {
          style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;'
        }, []);

        const pickerTitle = api.createElement('h4', {
          style: 'margin: 0;'
        }, ['Insert Link']);
        pickerHeader.appendChild(pickerTitle);

        const pickerClose = api.createElement('button', {
          style: 'padding: 6px 12px; cursor: pointer; background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px;',
          onclick: () => {
            pickerContainer.style.display = 'none';
            pickerContainer.innerHTML = '';
          }
        }, ['Close']);
        pickerHeader.appendChild(pickerClose);

        pickerContainer.appendChild(pickerHeader);

        const searchContainer = api.createElement('div', {}, []);
        pickerContainer.appendChild(searchContainer);

        const searchLib = await api.require('item-search-lib');

        const insertLink = (targetItem) => {
          const targetName = targetItem.name || targetItem.id;
          const linkText = '[' + targetName + '](item://' + targetItem.id + ')';
          codeMirrorInstance.replaceSelection(linkText);
          pickerContainer.style.display = 'none';
          pickerContainer.innerHTML = '';
          codeMirrorInstance.focus();
        };

        searchLib.createSearchUI(
          searchContainer,
          insertLink,
          api,
          {
            placeholder: 'Search items to link...',
            autoFocus: true
          }
        );
      };

      await renderTags(true);

    } else {
      // View mode: markdown-it rendering
      const markdownit = await api.require('markdown-it-wrapper');

      // Configure markdown-it to handle item:// links
      const renderer = markdownit.renderer;
      const defaultLinkRender = renderer.rules.link_open || function(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

      renderer.rules.link_open = function(tokens, idx, options, env, self) {
        const token = tokens[idx];
        const hrefIndex = token.attrIndex('href');

        if (hrefIndex >= 0) {
          const href = token.attrs[hrefIndex][1];
          if (href.startsWith('item://')) {
            // Mark as item link
            token.attrSet('data-item-link', href);
            token.attrSet('href', '#');
          }
        }

        return defaultLinkRender(tokens, idx, options, env, self);
      };

      const body = item.content.description || '*No content yet. Click Edit to add some.*';
      const html = markdownit.render(body);

      const content = api.createElement('div', {
        class: 'markdown-content',
        style: 'line-height: 1.8; font-size: 16px;'
      }, []);
      content.innerHTML = html;

      // Handle item:// link clicks
      const links = content.querySelectorAll('a[data-item-link]');
      links.forEach(link => {
        const href = link.getAttribute('data-item-link');
        const itemId = href.replace('item://', '');
        link.onclick = (e) => {
          e.preventDefault();
          api.openSibling(itemId);
        };
        link.style.color = '#007bff';
        link.style.textDecoration = 'none';
        link.style.borderBottom = '1px solid #007bff';
        link.style.cursor = 'pointer';
      });

      bodyContainer.appendChild(content);

      const editBtn = api.createElement('button', {
        style: 'margin-top: 20px; padding: 10px 20px; cursor: pointer;',
        onclick: () => {
          isEditing = true;
          renderBody();
        }
      }, ['Edit']);
      bodyContainer.appendChild(editBtn);

      await renderTags(false);
    }
  };

  await renderBody();
  container.appendChild(bodyContainer);

  return container;
}
`;

console.log("Updated note-renderer code:");
console.log("To install, run:");
console.log("");
console.log("// Get the note-renderer item");
console.log("const noteRenderer = await api.helpers.findByName('note-renderer');");
console.log("");
console.log("// Update it with the new code");
console.log("noteRenderer.content.code = `" + updatedCode.trim() + "`;");
console.log("noteRenderer.modified = Date.now();");
console.log("await api.set(noteRenderer);");
console.log("");
console.log("// Navigate to a note to see the changes");
