// REPL Script: Create custom_editor type
// This type is for declarative editors that use ui_hints

const customEditorType = {
  id: crypto.randomUUID(),
  name: "custom_editor",
  type: api.IDS.EDITOR,  // extends editor
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    description: "Declarative editor defined via ui_hints. Rendered by generic_editor_renderer.",
    required_fields: ["for_type", "ui_hints"]
  }
};

await kernel.storage.set(customEditorType, kernel);
console.log("Created custom_editor type:", customEditorType.id);
console.log("");
console.log("Editors of this type use ui_hints to define their form structure.");
console.log("The generic_editor_renderer renders them into editing forms.");
console.log("");
console.log("Next: run create_generic_editor_renderer.js");
