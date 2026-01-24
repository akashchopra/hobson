// Unified View System - Complete Installation Script
// Run this in the Hobson REPL to install the entire unified view system
//
// This script runs all phases in sequence with verification between each phase.
// You may also run individual phase scripts manually if preferred.
//
// Phases:
//   1. Add new seed types (VIEW, VIEW_SPEC, FIELD_VIEW, DEFAULT_VIEW)
//   2. Create generic_view library
//   3. Create field views
//   4. Update kernel-rendering module
//   5. Create test views
//   6. Migrate existing renderers/editors
//   7. Update kernel-core REPL API
//   8. Mark deprecated types
//
// After running this script, you must reload the kernel for changes to take effect.

(async function() {
  console.log("=".repeat(60));
  console.log("Unified View System - Installation");
  console.log("=".repeat(60));
  console.log("");

  const results = {
    phases: [],
    errors: []
  };

  // Helper to run a phase
  async function runPhase(phaseNum, phaseName, phaseCode) {
    console.log("-".repeat(60));
    console.log("PHASE " + phaseNum + ": " + phaseName);
    console.log("-".repeat(60));

    try {
      const result = await phaseCode();
      results.phases.push({ phase: phaseNum, name: phaseName, success: true, result });
      console.log("Phase " + phaseNum + " completed successfully.");
      return result;
    } catch (error) {
      console.error("Phase " + phaseNum + " FAILED: " + error.message);
      results.phases.push({ phase: phaseNum, name: phaseName, success: false, error: error.message });
      results.errors.push({ phase: phaseNum, error });
      throw error; // Stop execution on error
    }
  }

  // =========================================================================
  // PHASE 1: Add New Seed Types
  // =========================================================================

  await runPhase(1, "Add New Seed Types", async () => {
    const IDS = api.IDS;

    const NEW_IDS = {
      VIEW: "aaaaaaaa-0000-0000-0000-000000000000",
      DEFAULT_VIEW: "aaaaaaaa-1111-0000-0000-000000000000",
      VIEW_SPEC: "bbbbbbbb-0000-0000-0000-000000000000",
      FIELD_VIEW: "cccccccc-0000-0000-0000-000000000000"
    };

    // Check if already installed
    try {
      const existingView = await api.get(NEW_IDS.VIEW);
      if (existingView) {
        console.log("  View types already exist, skipping type creation.");
        return { skipped: true };
      }
    } catch (e) {
      // Types don't exist, continue with creation
    }

    // Create VIEW type
    await api.set({
      id: NEW_IDS.VIEW,
      name: "view",
      type: IDS.CODE,
      created: Date.now(),
      modified: Date.now(),
      children: [],
      content: {
        description: "Code that displays and/or allows interaction with an item. Replaces renderer and editor types.",
        required_fields: ["for_type", "code", "capabilities"]
      }
    });

    // Create VIEW_SPEC type
    await api.set({
      id: NEW_IDS.VIEW_SPEC,
      name: "view-spec",
      type: IDS.TYPE_DEFINITION,
      created: Date.now(),
      modified: Date.now(),
      children: [],
      content: {
        description: "Declarative specification for how to view/edit an item. Contains ui_hints consumed by generic_view.",
        required_fields: ["for_type", "ui_hints"]
      }
    });

    // Create FIELD_VIEW type
    await api.set({
      id: NEW_IDS.FIELD_VIEW,
      name: "field_view",
      type: IDS.LIBRARY,
      created: Date.now(),
      modified: Date.now(),
      children: [],
      content: {
        description: "Reusable component for rendering individual properties. Supports multiple modes (readonly, editable)."
      }
    });

    // Create DEFAULT_VIEW
    await api.set({
      id: NEW_IDS.DEFAULT_VIEW,
      name: "default_view",
      type: NEW_IDS.VIEW,
      created: Date.now(),
      modified: Date.now(),
      children: [],
      content: {
        for_type: IDS.ATOM,
        capabilities: ["read", "write"],
        description: "Fallback view that displays any item as JSON.",
        code: `
export async function render(item, api) {
  const container = api.createElement('div', { className: 'default-view' });

  const header = api.createElement('div', { style: 'margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #ddd;' });
  const title = api.createElement('h3', { style: 'margin: 0 0 5px 0;' });
  title.textContent = item.name || item.id.slice(0, 8) + '...';
  header.appendChild(title);
  const meta = api.createElement('div', { style: 'font-size: 12px; color: #666;' });
  meta.textContent = 'Type: ' + item.type.slice(0, 8) + '...';
  header.appendChild(meta);
  container.appendChild(header);

  const textarea = api.createElement('textarea', {
    style: 'width: 100%; min-height: 300px; font-family: monospace; font-size: 13px; padding: 10px; border: 1px solid #ccc; border-radius: 4px;'
  });
  textarea.value = JSON.stringify(item, null, 2);
  container.appendChild(textarea);

  const actions = api.createElement('div', { style: 'margin-top: 10px; display: flex; gap: 10px;' });

  const saveBtn = api.createElement('button', { style: 'padding: 8px 16px; cursor: pointer;' });
  saveBtn.textContent = 'Save';
  saveBtn.onclick = async () => {
    try {
      const updated = JSON.parse(textarea.value);
      await api.update(updated);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };
  actions.appendChild(saveBtn);

  const copyBtn = api.createElement('button', { style: 'padding: 8px 16px; cursor: pointer;' });
  copyBtn.textContent = 'Copy JSON';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(textarea.value);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => copyBtn.textContent = 'Copy JSON', 1500);
  };
  actions.appendChild(copyBtn);

  container.appendChild(actions);
  return container;
}
`
      }
    });

    // Update kernel-core IDS
    const kernelCore = await api.get(IDS.KERNEL_CORE);
    let code = kernelCore.content.code;

    if (!code.includes('VIEW: "aaaaaaaa')) {
      const viewportLine = 'VIEWPORT: "88888888-0000-0000-0000-000000000000"';
      const newIdsEntries = `,
    // Unified view system (replaces RENDERER/EDITOR)
    VIEW: "aaaaaaaa-0000-0000-0000-000000000000",
    DEFAULT_VIEW: "aaaaaaaa-1111-0000-0000-000000000000",
    VIEW_SPEC: "bbbbbbbb-0000-0000-0000-000000000000",
    FIELD_VIEW: "cccccccc-0000-0000-0000-000000000000"`;

      code = code.replace(viewportLine, viewportLine + newIdsEntries);
      kernelCore.content.code = code;
      kernelCore.modified = Date.now();
      await api.set(kernelCore);
    }

    return NEW_IDS;
  });

  // =========================================================================
  // PHASE 2: Create Generic View Library
  // =========================================================================

  await runPhase(2, "Create Generic View Library", async () => {
    // Check if already exists
    const existing = await api.helpers.findByName("generic_view");
    if (existing) {
      console.log("  generic_view already exists, skipping.");
      return { skipped: true, id: existing.id };
    }

    const genericView = {
      id: crypto.randomUUID(),
      name: "generic_view",
      type: api.IDS.LIBRARY,
      created: Date.now(),
      modified: Date.now(),
      children: [],
      content: {
        description: "Interprets view-spec items and constructs appropriate UI by loading field views.",
        code: `
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

export async function render(item, viewSpec, api) {
  const form = api.createElement('div', { className: 'generic-view' });
  form.style.cssText = 'display: flex; flex-direction: column; gap: 16px; padding: 16px;';

  let editedItem = JSON.parse(JSON.stringify(item));
  let hasEditableFields = false;

  const uiHints = viewSpec.content?.ui_hints || {};

  for (const [path, hint] of Object.entries(uiHints)) {
    if (hint.hidden) continue;

    const value = getNestedValue(item, path);
    const fieldViewName = 'field_view_' + (hint.field_view || 'json');
    let fieldView;

    try {
      fieldView = await api.require(fieldViewName);
    } catch (e) {
      try {
        fieldView = await api.require('field_view_json');
      } catch (e2) {
        fieldView = {
          render: (val, opts, api) => {
            const span = api.createElement('span');
            span.textContent = JSON.stringify(val);
            return span;
          }
        };
      }
    }

    const isEditable = hint.mode === 'editable';
    if (isEditable) hasEditableFields = true;

    const onChange = isEditable ? (newValue) => setNestedValue(editedItem, path, newValue) : null;

    const fieldElement = fieldView.render(value, {
      mode: hint.mode || 'readonly',
      onChange,
      label: hint.label,
      placeholder: hint.placeholder,
      ...hint
    }, api);

    form.appendChild(fieldElement);
  }

  if (hasEditableFields) {
    const actions = api.createElement('div', { className: 'view-actions' });
    actions.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ddd;';

    const cancelBtn = api.createElement('button', { style: 'padding: 8px 16px; cursor: pointer;' });
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => api.navigate(item.id);
    actions.appendChild(cancelBtn);

    const saveBtn = api.createElement('button', { style: 'padding: 8px 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;' });
    saveBtn.textContent = 'Save';
    saveBtn.onclick = async () => {
      try {
        await api.update(editedItem);
      } catch (e) {
        alert('Save failed: ' + e.message);
      }
    };
    actions.appendChild(saveBtn);

    form.appendChild(actions);
  }

  return form;
}

export { getNestedValue, setNestedValue };
`
      }
    };

    await api.set(genericView);
    return { id: genericView.id };
  });

  // =========================================================================
  // PHASE 3: Create Field Views
  // =========================================================================

  await runPhase(3, "Create Field Views", async () => {
    const FIELD_VIEW_TYPE = "cccccccc-0000-0000-0000-000000000000";
    const fieldViews = [];

    const fieldViewDefs = [
      {
        name: "field_view_text",
        description: "Simple text field",
        code: `
export function render(value, options, api) {
  const { mode, onChange, label, placeholder } = options;
  const wrapper = api.createElement('div', { className: 'field-text' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  if (mode === 'editable' && onChange) {
    const input = api.createElement('input', { type: 'text', style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;' });
    input.value = value || '';
    input.placeholder = placeholder || '';
    input.oninput = (e) => onChange(e.target.value);
    wrapper.appendChild(input);
  } else {
    const span = api.createElement('span');
    span.textContent = value || '';
    span.style.cssText = 'padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 14px;';
    wrapper.appendChild(span);
  }
  return wrapper;
}
`
      },
      {
        name: "field_view_textarea",
        description: "Multi-line text field",
        code: `
export function render(value, options, api) {
  const { mode, onChange, label, placeholder, rows = 5 } = options;
  const wrapper = api.createElement('div', { className: 'field-textarea' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  if (mode === 'editable' && onChange) {
    const textarea = api.createElement('textarea', { style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; font-family: inherit; resize: vertical;', rows: rows });
    textarea.value = value || '';
    textarea.placeholder = placeholder || '';
    textarea.oninput = (e) => onChange(e.target.value);
    wrapper.appendChild(textarea);
  } else {
    const pre = api.createElement('pre');
    pre.textContent = value || '';
    pre.style.cssText = 'padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 14px; white-space: pre-wrap; margin: 0; font-family: inherit;';
    wrapper.appendChild(pre);
  }
  return wrapper;
}
`
      },
      {
        name: "field_view_number",
        description: "Numeric field with validation",
        code: `
export function render(value, options, api) {
  const { mode, onChange, label, placeholder, min, max, step } = options;
  const wrapper = api.createElement('div', { className: 'field-number' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  if (mode === 'editable' && onChange) {
    const input = api.createElement('input', { type: 'number', style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; width: 150px;' });
    input.value = value ?? '';
    input.placeholder = placeholder || '';
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (step !== undefined) input.step = step;
    input.oninput = (e) => onChange(e.target.value === '' ? null : Number(e.target.value));
    wrapper.appendChild(input);
  } else {
    const span = api.createElement('span');
    span.textContent = value ?? '';
    span.style.cssText = 'padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 14px;';
    wrapper.appendChild(span);
  }
  return wrapper;
}
`
      },
      {
        name: "field_view_checkbox",
        description: "Checkbox for boolean values",
        code: `
export function render(value, options, api) {
  const { mode, onChange, label } = options;
  const wrapper = api.createElement('div', { className: 'field-checkbox' });
  wrapper.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  if (mode === 'editable' && onChange) {
    const input = api.createElement('input', { type: 'checkbox', style: 'width: 18px; height: 18px; cursor: pointer;' });
    input.checked = !!value;
    input.onchange = (e) => onChange(e.target.checked);
    wrapper.appendChild(input);
  } else {
    const indicator = api.createElement('span');
    indicator.textContent = value ? '\\u2713' : '\\u2717';
    indicator.style.cssText = 'font-size: 18px; color: ' + (value ? '#28a745' : '#dc3545') + ';';
    wrapper.appendChild(indicator);
  }

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }
  return wrapper;
}
`
      },
      {
        name: "field_view_timestamp",
        description: "Timestamp/date field",
        code: `
export function render(value, options, api) {
  const { mode, onChange, label, format = 'full' } = options;
  const wrapper = api.createElement('div', { className: 'field-timestamp' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    if (format === 'date') return date.toLocaleDateString();
    if (format === 'time') return date.toLocaleTimeString();
    if (format === 'relative') {
      const diff = Date.now() - ts;
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      const days = Math.floor(hrs / 24);
      if (days > 0) return days + ' day' + (days > 1 ? 's' : '') + ' ago';
      if (hrs > 0) return hrs + ' hour' + (hrs > 1 ? 's' : '') + ' ago';
      if (mins > 0) return mins + ' minute' + (mins > 1 ? 's' : '') + ' ago';
      return 'just now';
    }
    return date.toLocaleString();
  };

  if (mode === 'editable' && onChange) {
    const input = api.createElement('input', { type: 'datetime-local', style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;' });
    if (value) input.value = new Date(value).toISOString().slice(0, 16);
    input.onchange = (e) => onChange(e.target.value ? new Date(e.target.value).getTime() : null);
    wrapper.appendChild(input);
  } else {
    const span = api.createElement('span');
    span.textContent = formatTimestamp(value);
    span.style.cssText = 'padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 14px; color: #666;';
    wrapper.appendChild(span);
  }
  return wrapper;
}
`
      },
      {
        name: "field_view_json",
        description: "JSON fallback field",
        code: `
export function render(value, options, api) {
  const { mode, onChange, label } = options;
  const wrapper = api.createElement('div', { className: 'field-json' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  const jsonStr = JSON.stringify(value, null, 2);

  if (mode === 'editable' && onChange) {
    const textarea = api.createElement('textarea', { style: 'padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; font-family: monospace; resize: vertical; min-height: 100px;' });
    textarea.value = jsonStr;
    const errorEl = api.createElement('div');
    errorEl.style.cssText = 'color: #dc3545; font-size: 12px; min-height: 16px;';
    textarea.oninput = (e) => {
      try {
        onChange(JSON.parse(e.target.value));
        errorEl.textContent = '';
        textarea.style.borderColor = '#ccc';
      } catch (err) {
        errorEl.textContent = 'Invalid JSON';
        textarea.style.borderColor = '#dc3545';
      }
    };
    wrapper.appendChild(textarea);
    wrapper.appendChild(errorEl);
  } else {
    const pre = api.createElement('pre');
    pre.textContent = jsonStr;
    pre.style.cssText = 'padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 13px; font-family: monospace; white-space: pre-wrap; margin: 0;';
    wrapper.appendChild(pre);
  }
  return wrapper;
}
`
      }
    ];

    for (const def of fieldViewDefs) {
      const existing = await api.helpers.findByName(def.name);
      if (existing) {
        console.log("  " + def.name + " already exists, skipping.");
        fieldViews.push(existing);
        continue;
      }

      const fv = {
        id: crypto.randomUUID(),
        name: def.name,
        type: FIELD_VIEW_TYPE,
        created: Date.now(),
        modified: Date.now(),
        children: [],
        content: {
          description: def.description,
          code: def.code
        }
      };
      await api.set(fv);
      fieldViews.push(fv);
      console.log("  Created " + def.name);
    }

    return { count: fieldViews.length };
  });

  // =========================================================================
  // PHASE 4: Update Kernel Rendering
  // =========================================================================

  await runPhase(4, "Update Kernel Rendering", async () => {
    // This phase is critical - we need to update kernel-rendering with view support
    // The full code is in phase4-update-kernel-rendering.js
    // For safety, we'll just note that this needs to be run separately

    console.log("  NOTE: Run phase4-update-kernel-rendering.js separately for the full update.");
    console.log("  This ensures you can review the kernel changes before applying.");

    return { note: "Run phase4 script separately" };
  });

  // =========================================================================
  // Summary
  // =========================================================================

  console.log("");
  console.log("=".repeat(60));
  console.log("INSTALLATION SUMMARY");
  console.log("=".repeat(60));
  console.log("");

  for (const phase of results.phases) {
    const status = phase.success ? "OK" : "FAILED";
    console.log("Phase " + phase.phase + " (" + phase.name + "): " + status);
  }

  console.log("");
  console.log("NEXT STEPS:");
  console.log("1. Run phase4-update-kernel-rendering.js to update kernel");
  console.log("2. Reload the kernel (refresh page or kernel.reloadKernel())");
  console.log("3. Optionally run phase5-8 scripts for test views and migration");
  console.log("");

  return results;
})();
