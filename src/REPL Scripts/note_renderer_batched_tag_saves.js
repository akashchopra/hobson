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
  let currentTextarea = null;
  const bodyContainer = api.createElement('div', {}, []);

  // Pending tags (buffered changes, not yet saved)
  let pendingTags = null;

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

  // Helper function to build tag tree
  const buildTagTree = (tags) => {
    const tagMap = new Map();
    tags.forEach(tag => tagMap.set(tag.id, { ...tag, children: [] }));

    const roots = [];
    tags.forEach(tag => {
      const parent = tag.content.parent;
      if (!parent) {
        roots.push(tagMap.get(tag.id));
      } else {
        const parentNode = tagMap.get(parent);
        if (parentNode) {
          parentNode.children.push(tagMap.get(tag.id));
        } else {
          roots.push(tagMap.get(tag.id));
        }
      }
    });

    const sortByName = (a, b) => {
      const nameA = (a.content.name || a.name || a.id).toLowerCase();
      const nameB = (b.content.name || b.name || b.id).toLowerCase();
      return nameA.localeCompare(nameB);
    };

    roots.sort(sortByName);
    tagMap.forEach(node => node.children.sort(sortByName));

    return roots;
  };

  // Save pending tags to database
  const saveTags = async () => {
    if (pendingTags === null) return; // No changes

    const updated = {
      ...item,
      tags: pendingTags
    };
    await api.update(updated);
    item = await api.get(item.id);
    pendingTags = null; // Clear pending changes
  };

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
                // Remove from pending tags (don't save yet)
                pendingTags = pendingTags.filter(id => id !== tagId);
                await renderTags(true);
              }
            }, ['×']);
            pill.appendChild(removeBtn);

            tagPillsAndButtons.appendChild(pill);
          } catch (err) {
            // Tag not found - show as error pill
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

      // Tag picker panel (hidden by default)
      const pickerPanel = api.createElement('div', {
        style: 'display: none; margin-top: 12px; padding: 15px; background: #f9f9f9; border: 1px solid #d0d0d0; border-radius: 6px; max-height: 400px; overflow-y: auto;'
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
          // Save tags when closing picker
          await saveTags();
          pickerPanel.style.display = 'none';
          await renderTags(true); // Re-render to show saved state
        }
      }, ['×']);
      pickerHeader.appendChild(closePickerBtn);

      pickerPanel.appendChild(pickerHeader);

      const pickerTreeContainer = api.createElement('div', {}, []);
      pickerPanel.appendChild(pickerTreeContainer);

      tagsContainer.appendChild(pickerPanel);

      // Track expanded state
      const expandedState = new Map();

      // Toggle picker visibility and load tags
      const toggleTagPicker = async () => {
        if (pickerPanel.style.display === 'none') {
          // Show picker and load tags
          pickerPanel.style.display = 'block';
          await renderTagPicker();
        } else {
          // Hide picker and save
          await saveTags();
          pickerPanel.style.display = 'none';
          await renderTags(true);
        }
      };

      // Render tag picker tree
      const renderTagPicker = async () => {
        pickerTreeContainer.innerHTML = '';

        // Get all tags
        const allTags = await api.query({ type: api.IDS.TAG });
        const tree = buildTagTree(allTags);

        if (tree.length === 0) {
          const emptyMsg = api.createElement('div', {
            style: 'padding: 20px; text-align: center; color: #999; font-style: italic;'
          }, ['No tags available. Create tag items first.']);
          pickerTreeContainer.appendChild(emptyMsg);
          return;
        }

        // Render tree
        const renderTagNode = (tagNode, depth = 0) => {
          const nodeContainer = api.createElement('div', {
            style: 'display: flex; flex-direction: column;'
          }, []);

          const tagName = tagNode.content.name || tagNode.name || tagNode.id;
          const tagColor = tagNode.content.color || '#3b82f6';
          const hasChildren = tagNode.children.length > 0;
          const isExpanded = expandedState.get(tagNode.id) || false;
          const isSelected = pendingTags.includes(tagNode.id);

          // Tag row
          const tagRow = api.createElement('div', {
            style: 'padding: 6px 8px; padding-left: ' + (depth * 20 + 8) + 'px; display: flex; align-items: center; gap: 8px; cursor: pointer; border-radius: 4px; transition: background 0.2s;' + (isSelected ? ' opacity: 0.5;' : '')
          }, []);

          // Expand/collapse icon
          if (hasChildren) {
            const expandIcon = api.createElement('span', {
              style: 'font-size: 10px; color: #666; width: 10px;'
            }, [isExpanded ? '▼' : '▶']);
            tagRow.appendChild(expandIcon);
          } else {
            const spacer = api.createElement('span', {
              style: 'width: 10px;'
            }, ['•']);
            tagRow.appendChild(spacer);
          }

          // Color dot
          const colorDot = api.createElement('div', {
            style: 'width: 8px; height: 8px; border-radius: 50%; background: ' + tagColor + '; flex-shrink: 0;'
          }, []);
          tagRow.appendChild(colorDot);

          // Tag name
          const nameText = api.createElement('span', {
            style: 'font-size: 13px; color: #333; flex-grow: 1;'
          }, [tagName]);
          tagRow.appendChild(nameText);

          // Click handler
          tagRow.onclick = async (e) => {
            e.stopPropagation();

            if (hasChildren && e.offsetX < depth * 20 + 30) {
              // Clicked on expand icon
              expandedState.set(tagNode.id, !isExpanded);
              await renderTagPicker();
            } else if (!isSelected) {
              // Add tag to pending (don't save yet)
              pendingTags.push(tagNode.id);
              await renderTags(true);
              // Re-render picker to update selection state
              await renderTagPicker();
            }
          };

          // Hover effect (only if not selected)
          if (!isSelected) {
            tagRow.onmouseover = () => {
              tagRow.style.background = tagColor + '10';
            };
            tagRow.onmouseout = () => {
              tagRow.style.background = 'transparent';
            };
          }

          nodeContainer.appendChild(tagRow);

          // Render children if expanded
          if (hasChildren && isExpanded) {
            tagNode.children.forEach(child => {
              nodeContainer.appendChild(renderTagNode(child, depth + 1));
            });
          }

          return nodeContainer;
        };

        tree.forEach(rootNode => {
          pickerTreeContainer.appendChild(renderTagNode(rootNode, 0));
        });
      };

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
      // Edit mode: textarea
      const textarea = api.createElement('textarea', {
        style: 'width: 100%; min-height: 400px; font-family: monospace; font-size: 14px; line-height: 1.6; padding: 15px; border: 1px solid #d0d0d0; border-radius: 6px; resize: vertical;',
        spellcheck: false
      }, []);
      textarea.value = item.content.body || '';
      currentTextarea = textarea;

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
          // Save both body and tags
          await saveTags();
          const updated = {
            ...item,
            content: {
              ...item.content,
              body: textarea.value
            }
          };
          await api.update(updated);
          item = await api.get(item.id);
          isEditing = false;
          pendingTags = null; // Clear pending changes
          await renderTags(false);
          await renderBody();
        }
      }, ['Save']);
      buttons.appendChild(saveBtn);

      const cancelBtn = api.createElement('button', {
        style: 'padding: 10px 20px; cursor: pointer;',
        onclick: async () => {
          isEditing = false;
          pendingTags = null; // Discard pending changes
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

      const showLinkPicker = () => {
        pickerList.innerHTML = '';
        const recent = window.kernel.getRecentItems();

        if (recent.length === 0) {
          pickerList.appendChild(api.createElement('div', {
            style: 'padding: 20px; text-align: center; color: #999;'
          }, ['No recent items. Navigate to some items first!']));
        } else {
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

      const insertLink = (targetId, targetName) => {
        const textarea = currentTextarea;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const linkText = '[' + targetName + '](item://' + targetId + ')';
        textarea.value = textarea.value.substring(0, start) + linkText + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + linkText.length;
        pickerContainer.style.display = 'none';
        textarea.focus();
      };

      await renderTags(true);

    } else {
      // View mode
      const body = item.content.body || '*No content yet. Click Edit to add some.*';
      const marked = await api.require('marked');
      const html = marked.default.parse(body);

      const content = api.createElement('div', {
        class: 'markdown-content',
        style: 'line-height: 1.8; font-size: 16px;'
      }, []);
      content.innerHTML = html;

      const links = content.querySelectorAll('a[href^="item://"]');
      links.forEach(link => {
        const href = link.getAttribute('href');
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
