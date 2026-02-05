
// Error List View - displays all errors newest first with clear all option

const ERROR_TYPE_ID = 'e7707000-0000-0000-0000-000000000001';

export async function render(errorList, api) {
  // Find compact_card_view for rendering errors
  const compactViews = await api.query({ name: 'system:compact-card-view' });
  const compactViewId = compactViews[0]?.id || null;
  const container = api.createElement('div', {
    class: 'error-list-view',
    style: 'max-width: 800px; margin: 0 auto; padding: 20px;'
  }, []);

  // Header with title and clear all button
  const header = api.createElement('div', {
    style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid var(--color-border-light);'
  }, []);

  const titleSection = api.createElement('div', {}, []);

  const title = api.createElement('h2', {
    style: 'margin: 0; font-size: 20px;'
  }, [errorList.name || 'Error List']);
  titleSection.appendChild(title);

  const countLabel = api.createElement('div', {
    style: 'font-size: 14px; color: var(--color-text-secondary); margin-top: 4px;'
  }, []);
  titleSection.appendChild(countLabel);

  header.appendChild(titleSection);

  const buttonGroup = api.createElement('div', {
    style: 'display: flex; gap: 8px;'
  }, []);

  const refreshBtn = api.createElement('button', {
    style: 'padding: 8px 16px; background: var(--color-bg-hover); color: var(--color-text); border: none; border-radius: var(--border-radius); cursor: pointer; font-size: 14px;'
  }, ['Refresh']);
  refreshBtn.onmouseover = () => { refreshBtn.style.background = 'var(--color-border-light)'; };
  refreshBtn.onmouseout = () => { refreshBtn.style.background = 'var(--color-bg-hover)'; };
  buttonGroup.appendChild(refreshBtn);

  const clearAllBtn = api.createElement('button', {
    style: 'padding: 8px 16px; background: var(--color-danger); color: white; border: none; border-radius: var(--border-radius); cursor: pointer; font-size: 14px;'
  }, ['Clear All']);
  clearAllBtn.onmouseover = () => { clearAllBtn.style.background = '#b91c1c'; };
  clearAllBtn.onmouseout = () => { clearAllBtn.style.background = 'var(--color-danger)'; };
  buttonGroup.appendChild(clearAllBtn);

  header.appendChild(buttonGroup);

  container.appendChild(header);

  // Results area
  const resultsArea = api.createElement('div', {}, []);
  container.appendChild(resultsArea);

  // Cycle handler for items in render path
  const onCycle = (cycleItem) => {
    const card = api.createElement('div', {
      'data-item-id': cycleItem.id,
      style: 'padding: 12px; margin-bottom: 8px; background: var(--color-warning-light); border: 1px dashed var(--color-warning); border-radius: var(--border-radius); cursor: pointer;'
    }, []);

    const titleRow = api.createElement('div', {
      style: 'display: flex; align-items: center; gap: 8px;'
    }, []);

    titleRow.appendChild(api.createElement('span', { style: 'color: var(--color-warning);' }, ['\u21bb']));
    titleRow.appendChild(api.createElement('span', { style: 'font-weight: 500;' }, [cycleItem.name || cycleItem.id.substring(0, 8)]));
    titleRow.appendChild(api.createElement('span', {
      style: 'font-size: 11px; color: #92400e; background: #fef3c7; padding: 2px 6px; border-radius: var(--border-radius);'
    }, ['in current view']));

    card.appendChild(titleRow);
    card.onclick = (e) => { e.stopPropagation(); api.siblingContainer?.addSibling(cycleItem.id); };
    return card;
  };

  // Refresh errors from database
  const refreshErrors = async () => {
    const allItems = await api.getAll();

    // Filter to error items and sort by timestamp descending (newest first)
    const errors = allItems
      .filter(item => item.type === ERROR_TYPE_ID)
      .sort((a, b) => (b.content?.timestamp || 0) - (a.content?.timestamp || 0));

    // Store as children
    const updated = {
      ...errorList,
      attachments: errors.map(e => ({ id: e.id }))
    };
    await api.set(updated);

    // Update local reference
    errorList.attachments = updated.attachments;

    return errors;
  };

  // Render the results
  const renderResults = async () => {
    resultsArea.innerHTML = '';
    const children = errorList.attachments || [];
    let renderedCount = 0;

    // Render each error, skipping deleted items
    for (const childSpec of children) {
      const childId = typeof childSpec === 'string' ? childSpec : childSpec.id;
      const childViewId = (typeof childSpec === 'object' && childSpec.view) ? childSpec.view : compactViewId;

      // Check if item still exists before rendering
      const item = await api.get(childId);
      if (!item) continue;

      try {
        const childNode = await api.renderItem(childId, childViewId, { onCycle });
        childNode.setAttribute('data-parent-id', errorList.id);
        resultsArea.appendChild(childNode);
        renderedCount++;
      } catch (err) {
        // Skip items that fail to render
      }
    }

    // Update count label based on actually rendered items
    countLabel.textContent = renderedCount === 0
      ? 'No errors'
      : renderedCount + ' error' + (renderedCount === 1 ? '' : 's');

    // Show/hide clear all button
    clearAllBtn.style.display = renderedCount === 0 ? 'none' : 'block';

    if (renderedCount === 0) {
      const emptyMsg = api.createElement('div', {
        style: 'padding: 40px; text-align: center; color: var(--color-text-secondary); font-style: italic;'
      }, ['No errors']);
      resultsArea.appendChild(emptyMsg);
    }
  };

  // Clear all handler
  clearAllBtn.onclick = async () => {
    const count = errorList.attachments?.length || 0;
    if (count === 0) return;

    if (!confirm('Delete ' + count + ' error' + (count === 1 ? '' : 's') + '?')) {
      return;
    }

    // Delete all error items
    for (const childSpec of errorList.attachments) {
      const childId = typeof childSpec === 'string' ? childSpec : childSpec.id;
      try {
        await api.delete(childId);
      } catch (err) {
        console.error('Failed to delete error:', childId, err);
      }
    }

    // Clear children and save
    errorList.attachments = [];
    await api.set(errorList);

    // Refresh from database to ensure consistent state after deletions
    await refreshErrors();
    await renderResults();
  };

  // Refresh button handler
  refreshBtn.onclick = async () => {
    await refreshErrors();
    await renderResults();
  };

  // Always refresh from database to get latest errors (including on re-render)
  await refreshErrors();
  await renderResults();

  return container;
}
