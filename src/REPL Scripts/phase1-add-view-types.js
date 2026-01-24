// Phase 1: Add New Seed Types for Unified View System
// Run this in the Hobson REPL

(async function() {
  const IDS = api.IDS;

  // New type IDs as defined in the design doc
  const NEW_IDS = {
    VIEW: "aaaaaaaa-0000-0000-0000-000000000000",
    DEFAULT_VIEW: "aaaaaaaa-1111-0000-0000-000000000000",
    VIEW_SPEC: "bbbbbbbb-0000-0000-0000-000000000000",
    FIELD_VIEW: "cccccccc-0000-0000-0000-000000000000"
  };

  console.log("Phase 1: Adding new seed types for unified view system...");

  // 1. Create the VIEW type (replaces RENDERER)
  const viewType = {
    id: NEW_IDS.VIEW,
    name: "view",
    type: IDS.CODE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Code that displays and/or allows interaction with an item. Replaces renderer and editor types. Views declare capabilities (read, write) and export a render(item, api) function.",
      required_fields: ["for_type", "code", "capabilities"]
    }
  };

  // 2. Create the VIEW_SPEC type (declarative view specifications)
  const viewSpecType = {
    id: NEW_IDS.VIEW_SPEC,
    name: "view-spec",
    type: IDS.TYPE_DEFINITION,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Declarative specification for how to view/edit an item. Contains ui_hints consumed by generic_view. Allows per-property mode control (readonly/editable).",
      required_fields: ["for_type", "ui_hints"]
    }
  };

  // 3. Create the FIELD_VIEW type (reusable field components)
  const fieldViewType = {
    id: NEW_IDS.FIELD_VIEW,
    name: "field_view",
    type: IDS.LIBRARY,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Reusable component for rendering individual properties. Supports multiple modes (readonly, editable). Exports render(value, options, api) function."
    }
  };

  // 4. Create the DEFAULT_VIEW (fallback JSON view, replaces DEFAULT_RENDERER)
  const defaultView = {
    id: NEW_IDS.DEFAULT_VIEW,
    name: "default_view",
    type: NEW_IDS.VIEW,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      for_type: IDS.ATOM,
      capabilities: ["read", "write"],
      description: "Fallback view that displays any item as JSON. Supports editing in JSON format.",
      code: `
export async function render(item, api) {
  const container = api.createElement('div', { className: 'default-view' });

  // Header with item info
  const header = api.createElement('div', { className: 'view-header' });
  header.style.cssText = 'margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #ddd;';

  const title = api.createElement('h3', { style: 'margin: 0 0 5px 0;' });
  title.textContent = item.name || item.id.slice(0, 8) + '...';
  header.appendChild(title);

  const meta = api.createElement('div', { style: 'font-size: 12px; color: #666;' });
  meta.textContent = 'Type: ' + item.type.slice(0, 8) + '...';
  header.appendChild(meta);

  container.appendChild(header);

  // JSON display/edit area
  const jsonContainer = api.createElement('div');

  const textarea = api.createElement('textarea', {
    style: 'width: 100%; min-height: 300px; font-family: monospace; font-size: 13px; padding: 10px; border: 1px solid #ccc; border-radius: 4px;'
  });
  textarea.value = JSON.stringify(item, null, 2);
  jsonContainer.appendChild(textarea);

  // Actions
  const actions = api.createElement('div', { style: 'margin-top: 10px; display: flex; gap: 10px;' });

  const saveBtn = api.createElement('button', { style: 'padding: 8px 16px; cursor: pointer;' });
  saveBtn.textContent = 'Save';
  saveBtn.onclick = async () => {
    try {
      const updated = JSON.parse(textarea.value);
      await api.update(updated);
      console.log('Saved successfully');
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

  jsonContainer.appendChild(actions);
  container.appendChild(jsonContainer);

  return container;
}
`
    }
  };

  // Save all new types
  console.log("Creating view type...");
  await api.set(viewType);

  console.log("Creating view-spec type...");
  await api.set(viewSpecType);

  console.log("Creating field_view type...");
  await api.set(fieldViewType);

  console.log("Creating default_view...");
  await api.set(defaultView);

  // 5. Update kernel-core to add new IDS
  console.log("Updating kernel-core IDS constant...");

  const kernelCore = await api.get(IDS.KERNEL_CORE);
  let code = kernelCore.content.code;

  // Find the IDS block and add new entries before the closing brace
  const idsEndMarker = '// [END:SEED_IDS]';
  const viewportLine = 'VIEWPORT: "88888888-0000-0000-0000-000000000000"';

  if (code.includes(viewportLine) && !code.includes('VIEW: "aaaaaaaa')) {
    // Add the new IDS entries after VIEWPORT
    const newIdsEntries = `,
    // Unified view system (replaces RENDERER/EDITOR)
    VIEW: "aaaaaaaa-0000-0000-0000-000000000000",
    DEFAULT_VIEW: "aaaaaaaa-1111-0000-0000-000000000000",
    VIEW_SPEC: "bbbbbbbb-0000-0000-0000-000000000000",
    FIELD_VIEW: "cccccccc-0000-0000-0000-000000000000"`;

    code = code.replace(
      viewportLine,
      viewportLine + newIdsEntries
    );

    // Also mark RENDERER and EDITOR as deprecated in comments
    code = code.replace(
      '// Code that displays item\\n    RENDERER:',
      '// Code that displays item (DEPRECATED - use VIEW)\\n    RENDERER:'
    );
    code = code.replace(
      '// Code that edits items\\n    EDITOR:',
      '// Code that edits items (DEPRECATED - use VIEW/VIEW_SPEC)\\n    EDITOR:'
    );

    kernelCore.content.code = code;
    kernelCore.modified = Date.now();
    await api.set(kernelCore);
    console.log("Kernel-core IDS updated successfully!");
  } else if (code.includes('VIEW: "aaaaaaaa')) {
    console.log("IDS already contains VIEW entries, skipping update.");
  } else {
    console.error("Could not find VIEWPORT line in kernel-core. Manual update required.");
  }

  console.log("\\nPhase 1 complete! New types created:");
  console.log("  - view (aaaaaaaa-0000-0000-0000-000000000000)");
  console.log("  - view-spec (bbbbbbbb-0000-0000-0000-000000000000)");
  console.log("  - field_view (cccccccc-0000-0000-0000-000000000000)");
  console.log("  - default_view (aaaaaaaa-1111-0000-0000-000000000000)");
  console.log("\\nReload the kernel to use the new IDS constants.");

  return { viewType, viewSpecType, fieldViewType, defaultView };
})();
