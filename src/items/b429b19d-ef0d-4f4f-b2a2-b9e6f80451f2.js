// Item: system:generic-view
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
  if (!field) return null;
  return {
    field,
    region: params.get('region') || null,
    lines: params.get('lines') || null  // "5" or "10-20"
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
  console.log('[returnToDefaultView] itemId:', itemId);
  // Try restorePreviousView first
  const restored = await api.restorePreviousView(itemId);
  console.log('[returnToDefaultView] restorePreviousView returned:', restored);
  if (restored) return;

  // Fallback: clear view override and re-render
  // Check if item is the viewport root (not just if it has a data parent)
  const isViewportRoot = api.viewport.getRoot() === itemId;
  console.log('[returnToDefaultView] fallback, isViewportRoot:', isViewportRoot);
  if (isViewportRoot) {
    // It's the viewport root - clear root view override
    console.log('[returnToDefaultView] clearing viewport root view');
    await api.viewport.setRootView(null);
    // Root view change needs full re-render
    console.log('[returnToDefaultView] navigating to:', api.viewport.getRoot());
    await api.navigate(api.viewport.getRoot());
  } else {
    // It's a child - use rendering parent from context, fall back to data hierarchy
    const renderingParentId = api.getParentId ? api.getParentId() : null;
    console.log('[returnToDefaultView] renderingParentId:', renderingParentId);
    const parent = renderingParentId
      ? await api.get(renderingParentId)
      : await api.findParentOf(itemId);
    console.log('[returnToDefaultView] clearing child view, parent:', parent?.id);
    if (parent) {
      await api.setChildView(parent.id, itemId, null);
    }
    // Re-render just this item (preserves sibling scroll positions)
    console.log('[returnToDefaultView] re-rendering item:', itemId);
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
  container.style.cssText = 'display: flex; flex-direction: column; height: 100%; min-height: 0;';

  // Scrollable content area
  const scrollArea = api.createElement('div', { className: 'generic-view-content' });
  scrollArea.style.cssText = 'flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; min-height: 0;';

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
        label: hint.label,
        placeholder: hint.placeholder,
        // Pass scroll params if this is the navigation target
        scrollToRegion: isNavigationTarget ? navigateTo.region : null,
        scrollToLines: isNavigationTarget ? navigateTo.lines : null,  // "5" or "10-20"
        scrollToSymbol: isNavigationTarget ? navigateTo.symbol : null,
        ...hint
      }, api);
    } catch (renderError) {
      console.error('Error rendering field:', path, 'with view:', fieldViewName, renderError);
      fieldElement = api.createElement('div');
      fieldElement.style.cssText = 'color: var(--color-danger); font-size: 12px;';
      fieldElement.textContent = 'Error: ' + renderError.message;
    }

    scrollArea.appendChild(fieldElement);

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
    actions.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; padding: 16px; border-top: 1px solid var(--color-border-light); background: var(--color-bg-surface-alt); flex-shrink: 0;';

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
        console.log('Saved successfully');
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
        await api.rerenderItem(editedItem.id);
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
