// Phase 6: Migrate Existing Renderers and Editors to Views
// Run this in the Hobson REPL after Phase 5

(async function() {
  const IDS = api.IDS;
  const VIEW_TYPE = "aaaaaaaa-0000-0000-0000-000000000000";
  const VIEW_SPEC_TYPE = "bbbbbbbb-0000-0000-0000-000000000000";

  console.log("Phase 6: Migrating existing renderers and editors to unified view system...");

  let migratedRenderers = 0;
  let migratedEditors = 0;
  let skipped = 0;

  // 1. Find all renderer items (excluding default renderer and seed renderers we want to keep)
  const renderers = await api.query({ type: IDS.RENDERER });
  console.log("Found " + renderers.length + " renderers to evaluate");

  for (const renderer of renderers) {
    // Skip the default renderer - we have DEFAULT_VIEW now
    if (renderer.id === IDS.DEFAULT_RENDERER) {
      console.log("  Skipping default renderer (superseded by DEFAULT_VIEW)");
      skipped++;
      continue;
    }

    // Skip if already migrated (check if a view with same name exists)
    const viewName = renderer.name;
    const existingView = await api.helpers.findByName(viewName);
    if (existingView && existingView.type === VIEW_TYPE) {
      console.log("  Skipping " + renderer.name + " (already migrated)");
      skipped++;
      continue;
    }

    // Migrate renderer to view
    console.log("  Migrating renderer: " + renderer.name);

    // Determine capabilities - most renderers support both read and write
    // (many existing renderers have inline editing)
    const capabilities = ["read", "write"];

    const migratedView = {
      ...renderer,
      type: VIEW_TYPE,
      modified: Date.now(),
      content: {
        ...renderer.content,
        capabilities,
        // Keep original description or add one
        description: renderer.content?.description || "Migrated from renderer: " + renderer.name
      }
    };

    await api.set(migratedView);
    migratedRenderers++;
  }

  // 2. Find all editor items
  const editors = await api.query({ type: IDS.EDITOR });
  console.log("Found " + editors.length + " editors to evaluate");

  for (const editor of editors) {
    // Skip default editor
    if (editor.id === IDS.DEFAULT_EDITOR) {
      console.log("  Skipping default editor (will use DEFAULT_VIEW)");
      skipped++;
      continue;
    }

    // Check if it has code (imperative editor) or ui_hints (declarative editor)
    if (editor.content?.code) {
      // Imperative editor -> View with write capability
      console.log("  Migrating imperative editor: " + editor.name);

      const migratedView = {
        ...editor,
        type: VIEW_TYPE,
        modified: Date.now(),
        content: {
          ...editor.content,
          capabilities: ["read", "write"],
          description: editor.content?.description || "Migrated from editor: " + editor.name
        }
      };

      await api.set(migratedView);
      migratedEditors++;
    } else if (editor.content?.ui_hints) {
      // Declarative editor -> View Spec
      console.log("  Migrating declarative editor: " + editor.name);

      // Convert ui_hints format: 'editor' -> 'field_view', 'readonly' -> 'mode'
      const convertedHints = {};
      for (const [path, hint] of Object.entries(editor.content.ui_hints)) {
        convertedHints[path] = {
          ...hint,
          // Convert 'editor' to 'field_view' (field-editor-X -> field_view_X)
          field_view: hint.editor || hint.field_view || 'text',
          // Convert 'readonly' boolean to 'mode' string
          mode: hint.mode || (hint.readonly ? 'readonly' : 'editable'),
        };
        // Remove old properties
        delete convertedHints[path].editor;
        delete convertedHints[path].readonly;
      }

      const migratedViewSpec = {
        ...editor,
        type: VIEW_SPEC_TYPE,
        modified: Date.now(),
        content: {
          ...editor.content,
          ui_hints: convertedHints,
          description: editor.content?.description || "Migrated from declarative editor: " + editor.name
        }
      };

      await api.set(migratedViewSpec);
      migratedEditors++;
    } else {
      console.log("  Skipping " + editor.name + " (no code or ui_hints)");
      skipped++;
    }
  }

  // 3. Look for custom-editor type items and migrate them
  const customEditorType = await api.helpers.findByName("custom-editor");
  if (customEditorType) {
    const customEditors = await api.query({ type: customEditorType.id });
    console.log("Found " + customEditors.length + " custom-editor items to migrate");

    for (const customEditor of customEditors) {
      console.log("  Migrating custom-editor: " + customEditor.name);

      // Convert ui_hints format
      const convertedHints = {};
      if (customEditor.content?.ui_hints) {
        for (const [path, hint] of Object.entries(customEditor.content.ui_hints)) {
          convertedHints[path] = {
            ...hint,
            field_view: hint.editor || hint.field_view || 'text',
            mode: hint.mode || (hint.readonly ? 'readonly' : 'editable'),
          };
          delete convertedHints[path].editor;
          delete convertedHints[path].readonly;
        }
      }

      const migratedViewSpec = {
        ...customEditor,
        type: VIEW_SPEC_TYPE,
        modified: Date.now(),
        content: {
          ...customEditor.content,
          ui_hints: convertedHints,
          description: customEditor.content?.description || "Migrated from custom-editor: " + customEditor.name
        }
      };

      await api.set(migratedViewSpec);
      migratedEditors++;
    }
  }

  console.log("\\nPhase 6 complete! Migration summary:");
  console.log("  - Migrated renderers: " + migratedRenderers);
  console.log("  - Migrated editors: " + migratedEditors);
  console.log("  - Skipped: " + skipped);
  console.log("\\nNote: Original items were updated in place (same IDs preserved).");
  console.log("This allows existing references to continue working.");

  return {
    migratedRenderers,
    migratedEditors,
    skipped
  };
})();
