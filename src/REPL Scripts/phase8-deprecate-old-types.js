// Phase 8: Mark Deprecated Types
// Run this in the Hobson REPL after Phase 7

(async function() {
  const IDS = api.IDS;
  const VIEW_TYPE = "aaaaaaaa-0000-0000-0000-000000000000";
  const VIEW_SPEC_TYPE = "bbbbbbbb-0000-0000-0000-000000000000";

  console.log("Phase 8: Marking deprecated types...");

  // 1. Update RENDERER type
  console.log("Updating RENDERER type...");
  const rendererType = await api.get(IDS.RENDERER);
  rendererType.content = {
    ...rendererType.content,
    description: "DEPRECATED: Use 'view' type instead. Code that renders an item type.",
    deprecated: true,
    superseded_by: VIEW_TYPE,
    deprecation_note: "The unified view system replaces both renderers and editors with a single 'view' concept."
  };
  rendererType.modified = Date.now();
  await api.set(rendererType);

  // 2. Update EDITOR type
  console.log("Updating EDITOR type...");
  const editorType = await api.get(IDS.EDITOR);
  editorType.content = {
    ...editorType.content,
    description: "DEPRECATED: Use 'view' or 'view-spec' type instead. Code that edits an item.",
    deprecated: true,
    superseded_by: VIEW_TYPE,
    alternative: VIEW_SPEC_TYPE,
    deprecation_note: "Imperative editors should use 'view' type with capabilities: ['read', 'write']. Declarative editors should use 'view-spec' type."
  };
  editorType.modified = Date.now();
  await api.set(editorType);

  // 3. Look for and update custom-editor type if it exists
  const customEditorType = await api.helpers.findByName("custom-editor");
  if (customEditorType) {
    console.log("Updating custom-editor type...");
    customEditorType.content = {
      ...customEditorType.content,
      description: "DEPRECATED: Use 'view-spec' type instead. Declarative editor specification.",
      deprecated: true,
      superseded_by: VIEW_SPEC_TYPE,
      deprecation_note: "Custom editors are now view-specs. Convert ui_hints from 'editor' to 'field_view' and 'readonly' to 'mode'."
    };
    customEditorType.modified = Date.now();
    await api.set(customEditorType);
  }

  // 4. Update DEFAULT_RENDERER to note it's superseded
  console.log("Updating DEFAULT_RENDERER...");
  const defaultRenderer = await api.get(IDS.DEFAULT_RENDERER);
  defaultRenderer.content = {
    ...defaultRenderer.content,
    description: "DEPRECATED: Use DEFAULT_VIEW instead. Fallback JSON renderer for any item type.",
    deprecated: true,
    superseded_by: "aaaaaaaa-1111-0000-0000-000000000000", // DEFAULT_VIEW
    deprecation_note: "The unified view system uses DEFAULT_VIEW as the fallback."
  };
  defaultRenderer.modified = Date.now();
  await api.set(defaultRenderer);

  // 5. Update DEFAULT_EDITOR to note it's superseded
  console.log("Updating DEFAULT_EDITOR...");
  const defaultEditor = await api.get(IDS.DEFAULT_EDITOR);
  defaultEditor.content = {
    ...defaultEditor.content,
    description: "DEPRECATED: Use DEFAULT_VIEW instead. Fallback JSON editor for any item type.",
    deprecated: true,
    superseded_by: "aaaaaaaa-1111-0000-0000-000000000000", // DEFAULT_VIEW
    deprecation_note: "The unified view system uses DEFAULT_VIEW which supports both viewing and editing."
  };
  defaultEditor.modified = Date.now();
  await api.set(defaultEditor);

  console.log("\\nPhase 8 complete! Marked as deprecated:");
  console.log("  - RENDERER type -> use VIEW");
  console.log("  - EDITOR type -> use VIEW or VIEW_SPEC");
  console.log("  - custom-editor type -> use VIEW_SPEC");
  console.log("  - DEFAULT_RENDERER -> use DEFAULT_VIEW");
  console.log("  - DEFAULT_EDITOR -> use DEFAULT_VIEW");
  console.log("\\nDeprecation metadata added:");
  console.log("  - deprecated: true");
  console.log("  - superseded_by: <new type ID>");
  console.log("  - deprecation_note: <migration guidance>");

  return {
    rendererType,
    editorType,
    customEditorType,
    defaultRenderer,
    defaultEditor
  };
})();
