// Item: generic-view
// ID: b429b19d-ef0d-4f4f-b2a2-b9e6f80451f2
// Type: 66666666-0000-0000-0000-000000000000

// Generic view library - interprets view-spec items
// Supports both sync and async field views
// See [Views & Rendering](item://a0a0a0a0-d0c0-4000-8000-000000000004#generic-view)

// Helper: Parse navigation params from URL (for root context)
// Supports: ?field=code&region=X&lines=10-20
function getNavigateToFromURL() {
  const params = new URLSearchParams(window.location.search);
  const field = params.get('field');
  const symbol = params.get('symbol');
  if (!field && !symbol) return null;
  return {
    field: field || null,
    region: params.get('region') || null,
    lines: params.get('lines') || null,  // "5" or "10-20"
    symbol: symbol || null
  };
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((curr, key) => {
    if (!curr[key]) curr[key] = {};
    return curr[key];
  }, obj);
  target[lastKey] = value;
}

// [BEGIN:returnToDefaultView]
// Helper to return to default view for an item
async function returnToDefaultView(itemId, api) {
  // Try restorePreviousView first
  const restored = await api.restorePreviousView(itemId);
  if (restored) return;

  // Fallback: clear view override and re-render
  // Check if item is the viewport root (not just if it has a data parent)
  const isViewportRoot = api.viewport.getRoot() === itemId;
  if (isViewportRoot) {
    // It's the viewport root - clear root view override
    await api.viewport.setRootView(null);
    // Root view change needs full re-render
    await api.navigate(api.viewport.getRoot());
  } else {
    // It's a child - use rendering parent from context, fall back to data hierarchy
    const renderingParentId = api.getParentId ? api.getParentId() : null;
    const parent = renderingParentId
      ? await api.get(renderingParentId)
      : await api.findContainerOf(itemId);
    if (parent) {
      await api.setAttachmentView(parent.id, itemId, null);
    }
    // Re-render just this item (preserves sibling scroll positions)
    await api.rerenderItem(itemId);
  }
}
// [END:returnToDefaultView]

// [BEGIN:render]
export async function render(item, api) {
  // Fetch the view item that's using this library to get the spec
  const viewId = api.getViewId();
  const viewSpec = viewId ? await api.get(viewId) : null;

  // Outer container - full height flex column
  const container = api.createElement('div', { className: 'generic-view' });
  container.style.cssText = 'display: flex; flex-direction: column; min-height: 100%;';

  // Content area (scrolling delegated to parent .window-content for scroll preservation)
  const scrollArea = api.createElement('div', { className: 'generic-view-content' });
  scrollArea.style.cssText = 'padding: 16px; display: flex; flex-direction: column; gap: 16px;';

  // Clone item for editing
  let editedItem = JSON.parse(JSON.stringify(item));

  // Track if any field is editable
  let hasEditableFields = false;

  // Get ui_hints from view spec
  const uiHints = viewSpec?.content?.ui_hints || {};

  // Get navigation params for scroll-to-line/region support
  // Try context first (sibling navigation), then URL params (root navigation)
  const navigateTo = (api.getNavigateTo ? api.getNavigateTo() : null) || getNavigateToFromURL();
  // Render each field according to ui_hints
  for (const [path, hint] of Object.entries(uiHints)) {
    if (hint.hidden) continue;

    // Get current value from item
    const value = getNestedValue(item, path);

    // Skip optional fields that aren't present on this item
    if (hint.showIfPresent && !value) continue;

    // Load field view
    // Default to markdown for description field, json for everything else
    const defaultFieldView = path === 'content.description' ? 'markdown' : 'json';
    const fieldViewName = 'field-view-' + (hint.field_view || defaultFieldView);
    let fieldView;

    try {
      fieldView = await api.require(fieldViewName);
    } catch (e) {
      console.warn('Field view not found: ' + fieldViewName + ', using field-view-json');
      try {
        fieldView = await api.require('field-view-json');
      } catch (e2) {
        // Ultimate fallback - create inline
        fieldView = {
          render: (val, opts, api) => {
            const span = api.createElement('span');
            span.textContent = JSON.stringify(val);
            return span;
          }
        };
      }
    }

    // Determine if this field is editable
    const isEditable = hint.mode === 'editable';
    if (isEditable) hasEditableFields = true;

    // Create onChange handler if editable
    const onChange = isEditable
      ? (newValue) => {
          setNestedValue(editedItem, path, newValue);
        }
      : null;

    // Check if this field is the navigation target for scroll-to-line/region
    // navigateTo.field is just 'code' but path might be 'content.code', so compare last segment
    const fieldName = path.split('.').pop();
    // Navigation target: explicit field match, OR symbol without field defaults to 'code'
    const isNavigationTarget = navigateTo && (
      navigateTo.field === fieldName ||
      (navigateTo.symbol && !navigateTo.field && fieldName === 'code')
    );
    // Render field - AWAIT in case it's async!
    let fieldElement;
    try {
      fieldElement = await fieldView.render(value, {
        mode: hint.mode || 'readonly',
        onChange,
        placeholder: hint.placeholder,
        // Pass scroll params if this is the navigation target
        scrollToRegion: isNavigationTarget ? navigateTo.region : null,
        scrollToLines: isNavigationTarget ? navigateTo.lines : null,  // "5" or "10-20"
        scrollToSymbol: isNavigationTarget ? navigateTo.symbol : null,
        ...hint,
        // Suppress inner label when collapsible (summary provides it)
        label: hint.collapsible ? null : hint.label,
      }, api);
    } catch (renderError) {
      console.error('Error rendering field:', path, 'with view:', fieldViewName, renderError);
      fieldElement = api.createElement('div');
      fieldElement.style.cssText = 'color: var(--color-danger); font-size: 0.75rem;';
      fieldElement.textContent = 'Error: ' + renderError.message;
    }

    // Key each field by path+mode so morphdom replaces (not patches) when mode changes.
    // Without this, morphdom patches the old field DOM in place, keeping stale event
    // handlers whose closures captured the old mode's state (e.g. onChange = null).
    const fieldKey = `field-${path}-${hint.mode || 'readonly'}`;

    // Wrap in collapsible <details> if requested
    if (hint.collapsible) {
      const details = api.createElement('details');
      details.setAttribute('data-sort-key', fieldKey);
      const shouldOpen = hint.startCollapsed === 'ifEmpty' ? !!value : !hint.startCollapsed;
      if (shouldOpen) details.setAttribute('open', '');
      const summary = api.createElement('summary');
      summary.textContent = hint.label || fieldName;
      summary.style.cssText = 'cursor: pointer; font-size: 0.8125rem; font-weight: 500; color: var(--color-text-secondary); user-select: none; padding: 2px 0;';
      details.appendChild(summary);
      details.appendChild(fieldElement);
      scrollArea.appendChild(details);
    } else {
      fieldElement.setAttribute('data-sort-key', fieldKey);
      scrollArea.appendChild(fieldElement);
    }

    // Add divider after field if requested
    if (hint.dividerAfter) {
      const divider = api.createElement('hr');
      divider.style.cssText = 'border: none; border-top: 2px solid var(--color-border); margin: 8px 0; flex-shrink: 0;';
      scrollArea.appendChild(divider);
    }
  }

  container.appendChild(scrollArea);

  // Add save/cancel buttons if any field is editable (sticky at bottom)
  if (hasEditableFields) {
    const actions = api.createElement('div', { className: 'view-actions' });
    actions.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; padding: 16px; border-top: 1px solid var(--color-border-light); background: var(--color-bg-surface-alt); position: sticky; bottom: 0;';

    const cancelBtn = api.createElement('button', {
      style: 'padding: 8px 16px; cursor: pointer;'
    });
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = async () => {
      await returnToDefaultView(item.id, api);
    };
    actions.appendChild(cancelBtn);

    const saveBtn = api.createElement('button', {
      style: 'padding: 8px 16px; cursor: pointer; background: var(--color-text-secondary); color: white; border: none; border-radius: var(--border-radius);'
    });
    saveBtn.textContent = 'Save';
    saveBtn.onclick = async () => {
      try {
        await api.set(editedItem);
        await api.rerenderItem(editedItem.id);
      } catch (e) {
        alert('Save failed: ' + e.message);
      }
    };
    actions.appendChild(saveBtn);

    const saveAndViewBtn = api.createElement('button', {
      style: 'padding: 8px 16px; cursor: pointer; background: var(--color-primary); color: white; border: none; border-radius: var(--border-radius);'
    });
    saveAndViewBtn.textContent = 'Save & View';
    saveAndViewBtn.onclick = async () => {
      try {
        await api.set(editedItem);
        await returnToDefaultView(item.id, api);
      } catch (e) {
        alert('Save failed: ' + e.message);
      }
    };
    actions.appendChild(saveAndViewBtn);

    container.appendChild(actions);
  }

  return container;
}
// [END:render]

export { getNestedValue, setNestedValue };
